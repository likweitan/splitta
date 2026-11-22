import cds from '@sap/cds';
import { OrchestrationClient } from '@sap-ai-sdk/orchestration';
import { readReceiptImage } from './receipt-image.js';
import {
  deliveryUpdate,
  notifyAfterCommit,
  sendWebhook,
  validateWebhookUrl,
} from './webhooks.js';

const { INSERT, SELECT, UPDATE } = cds.ql;

const BANKS = new Set(['CIMB', 'Maybank', 'OCBC', 'RytBank', 'UOB']);

const LOG = cds.log('receipt-extraction');
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Non-grouped quantifiers avoid regex backtracking stack overflow on large images.
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);
const RECEIPT_PROMPT = `Read the receipt image and extract its merchant, currency, totals, tax, discounts, rounding adjustment, and every line item.
Return a JSON object with this exact shape:
{
  "receipt_info": {
    "merchant_name": "string",
    "currency": "three-letter currency code",
    "total_tax_amount": 0,
    "prices_include_tax": true,
    "tax_percentage": 0,
    "header_discount": 0,
    "anchor_total": 0,
    "rounding_adjustment": 0
  },
  "items": [
    {
      "description": "string",
      "qty": 1,
      "unit_price": 0,
      "item_specific_discount": 0
    }
  ]
}
Use numbers, not formatted strings, for amounts and quantities. Do not include currency symbols in numeric values. Do not guess unreadable values; use null when a value cannot be determined. Include all visible purchased items and do not include subtotal, tax, service charge, or total rows as items.
unit_price is the price of one unit exactly as printed; if only the line amount is shown, divide it by qty.
total_tax_amount is the sum of all taxes and service charges shown on the receipt.
prices_include_tax is false when tax or service charge is added below the item subtotal, and true when item prices already include tax.
anchor_total is the final amount payable.`;

function extractionNumber(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid numeric value for ${field}.`);
  return number;
}

export function parseExtraction(content) {
  const result = JSON.parse(content);
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The model response is not a JSON object.');
  }

  const info = result.receipt_info;
  if (!info || typeof info !== 'object' || !Array.isArray(result.items)) {
    throw new Error('The model response is missing receipt fields.');
  }

  const items = result.items.map((item, index) => {
    if (!item || typeof item.description !== 'string' || !item.description.trim()) {
      throw new Error(`Receipt item ${index + 1} has no description.`);
    }
    return {
      description: item.description.trim().slice(0, 255),
      quantity: extractionNumber(item.qty, `items[${index}].qty`),
      priceTaxInclusive: extractionNumber(
        item.unit_price ?? item.price_tax_inclusive,
        `items[${index}].unit_price`,
      ),
      itemSpecificDiscount: extractionNumber(
        item.item_specific_discount,
        `items[${index}].item_specific_discount`,
      ),
    };
  });

  if (items.length === 0) throw new Error('No receipt items were recognized.');

  const receiptInfo = parseReceiptInfo(info);
  receiptInfo.pricesIncludeTax = detectPricesIncludeTax(
    receiptInfo,
    items,
    info.prices_include_tax,
  );

  return { receiptInfo, items: mergeDuplicateItems(items) };
}

// Prefer the receipt's own arithmetic over the model's flag: whichever
// assumption reproduces the printed total decides whether tax is on top.
function detectPricesIncludeTax(receiptInfo, items, modelFlag) {
  const { taxAmount, discountAmount, roundingAdjustment, priceAmount } = receiptInfo;
  const amountsAreKnown = [
    taxAmount,
    discountAmount,
    roundingAdjustment,
    priceAmount,
  ].every(Number.isFinite);
  const itemsAreKnown = items.every((item) =>
    [item.quantity, item.priceTaxInclusive, item.itemSpecificDiscount].every(
      Number.isFinite,
    ),
  );
  if (amountsAreKnown && itemsAreKnown && taxAmount > 0 && priceAmount > 0) {
    const itemsNet = items.reduce(
      (sum, item) => sum + item.priceTaxInclusive * item.quantity - item.itemSpecificDiscount,
      0,
    );
    const base = itemsNet - discountAmount + roundingAdjustment;
    const inclusiveGap = Math.abs(base - priceAmount);
    const exclusiveGap = Math.abs(base + taxAmount - priceAmount);
    if (Math.min(inclusiveGap, exclusiveGap) <= 0.05) return inclusiveGap <= exclusiveGap;
  }
  return typeof modelFlag === 'boolean' ? modelFlag : true;
}

const roundTo = (value, decimals) => Number(value.toFixed(decimals));

// Combine repeated lines (same name and unit price) into one line with summed quantity and discount.
function mergeDuplicateItems(items) {
  if (
    items.some((item) =>
      [item.quantity, item.priceTaxInclusive, item.itemSpecificDiscount].some(
        (value) => !Number.isFinite(value),
      ),
    )
  ) {
    return items;
  }

  const merged = new Map();
  for (const item of items) {
    const name = item.description.toLowerCase().replace(/\s+/g, ' ');
    const key = `${name}|${item.priceTaxInclusive.toFixed(2)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = roundTo(existing.quantity + item.quantity, 3);
      existing.itemSpecificDiscount = roundTo(
        existing.itemSpecificDiscount + item.itemSpecificDiscount,
        2,
      );
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()];
}

function parseReceiptInfo(info) {
  const taxAmount = extractionNumber(info.total_tax_amount, 'total_tax_amount');
  const taxPercentage = extractionNumber(info.tax_percentage, 'tax_percentage');
  return {
    merchantName:
      typeof info.merchant_name === 'string' && info.merchant_name.trim()
        ? info.merchant_name.trim().slice(0, 255)
        : 'Unknown',
    currency:
      typeof info.currency === 'string' && info.currency.trim()
        ? info.currency.trim().toUpperCase().slice(0, 3)
        : 'MYR',
    taxAmount: taxAmount === null ? null : Math.max(0, taxAmount),
    taxPercentage:
      taxPercentage === null
        ? null
        : Math.min(100, Math.max(0, taxPercentage)),
    discountAmount: extractionNumber(info.header_discount, 'header_discount'),
    priceAmount: extractionNumber(info.anchor_total, 'anchor_total'),
    roundingAdjustment: extractionNumber(
      info.rounding_adjustment,
      'rounding_adjustment',
    ),
  };
}

async function isTeamMember(teamID, userID) {
  if (!teamID) return false;
  const membership = await SELECT.one
    .from('splitta.TeamMembers')
    .columns('team_ID')
    .where({ team_ID: teamID, userID });
  return Boolean(membership);
}

function userDisplayName(user) {
  const { id, attr = {} } = user;
  return attr.givenName && attr.familyName
    ? `${attr.givenName} ${attr.familyName}`
    : attr.name || id;
}

async function extractReceipt(req) {
  const { imageData, contentType } = req.data;
  if (typeof imageData !== 'string' || !imageData || imageData.length % 4 !== 0 || !BASE64_PATTERN.test(imageData)) {
    return req.reject(400, 'Upload a valid receipt image.');
  }
  if (
    typeof contentType !== 'string' ||
    !IMAGE_TYPES.has(contentType.toLowerCase())
  ) {
    return req.reject(400, 'The uploaded file must be an image.');
  }

  const image = Buffer.from(imageData, 'base64');
  if (image.length === 0) return req.reject(400, 'The uploaded image is empty.');
  if (image.length > MAX_IMAGE_BYTES) {
    return req.reject(413, 'Receipt images must be 8 MB or smaller.');
  }

  const model = process.env.AICORE_MODEL?.trim();
  if (!model) {
    return req.reject(503, 'Receipt extraction is not configured. Set AICORE_MODEL.');
  }

  try {
    const client = new OrchestrationClient({
      promptTemplating: {
        model: { name: model, params: { temperature: 0 } },
        prompt: {
          template: [{ role: 'system', content: RECEIPT_PROMPT }],
          response_format: { type: 'json_object' },
        },
      },
    });
    const response = await client.chatCompletion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the receipt details from this image.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${contentType};base64,${imageData}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.getContent();
    if (!content) throw new Error('The AI model returned an empty response.');
    return parseExtraction(content);
  } catch (error) {
    LOG.error('SAP AI Core receipt extraction failed', error);
    return req.reject(502, 'Receipt extraction failed. Please try again.');
  }
}

export default class ReceiptService extends cds.ApplicationService {
  async init() {
    this.on('extractReceipt', extractReceipt);

    this.on('receiptImage', async (req) => {
      const receipt = await SELECT.one
        .from('splitta.Receipts')
        .columns('ID', 'owner', 'team_ID')
        .where({ ID: req.data.ID });
      if (!receipt) return req.reject(404, 'Receipt not found.');
      if (receipt.owner !== req.user.id) {
        if (!(await isTeamMember(receipt.team_ID, req.user.id))) {
          return req.reject(404, 'Receipt not found.');
        }
      }
      return readReceiptImage(cds.db, req.data.ID);
    });

    this.before('CREATE', 'Receipts', async (req) => {
      const teamID = req.data.team_ID ?? req.data.team?.ID;
      if (teamID) {
        if (!(await isTeamMember(teamID, req.user.id))) {
          return req.reject(403, 'You must belong to a team to add its receipts.');
        }
        req.data.team_ID = teamID;
      }
      req.data.owner = req.user.id;
      for (const item of req.data.items ?? []) item.owner = req.user.id;
    });

    this.after('CREATE', 'Receipts', (receipt, req) => {
      const data = { ...req.data, ...receipt };
      notifyAfterCommit(req, 'receipt.created', req.user.id, {
        receiptID: data.ID,
        merchantName: data.merchantName,
        priceAmount: data.priceAmount,
        currency: data.currency ?? 'MYR',
        itemCount: data.items?.length ?? 0,
        createdBy: userDisplayName(req.user),
      });
    });

    this.before(['CREATE', 'UPDATE'], 'Webhooks', (req) => {
      const { data } = req;
      if (req.event === 'UPDATE') delete data.owner;
      if (req.event === 'CREATE' || 'url' in data) {
        data.url = String(data.url ?? '').trim();
        const invalid = validateWebhookUrl(data.url);
        if (invalid) return req.reject(400, invalid);
      }
      if ('name' in data) data.name = data.name?.trim() || null;
    });

    this.on('testWebhook', async (req) => {
      const webhook = await SELECT.one
        .from('splitta.Webhooks')
        .columns('ID', 'url')
        .where({ ID: req.data.ID, owner: req.user.id });
      if (!webhook) return req.reject(404, 'Webhook not found.');
      const result = await sendWebhook(webhook, 'test');
      await deliveryUpdate(webhook.ID, result);
      return result;
    });

    this.before('UPDATE', 'Receipts', async (req) => {
      delete req.data.owner;
      if (!('team_ID' in req.data) && !('team' in req.data)) return;

      const teamID = req.data.team_ID ?? req.data.team?.ID;
      if (teamID && !(await isTeamMember(teamID, req.user.id))) {
        return req.reject(403, 'You must belong to a team to share its receipts.');
      }
      req.data.team_ID = teamID ?? null;
      delete req.data.team;
    });

    this.before(['CREATE', 'UPDATE'], 'PaymentMethods', async (req) => {
      const { data } = req;
      if ((req.event === 'CREATE' || 'bankName' in data) && !BANKS.has(data.bankName)) {
        return req.reject(400, `Select a supported bank: ${[...BANKS].join(', ')}.`);
      }
      if (req.event === 'CREATE' || 'paymentType' in data) {
        if (data.paymentType && data.paymentType !== 'bank_account') {
          return req.reject(400, 'Only bank account payment methods are supported.');
        }
        data.paymentType = 'bank_account';
      }
      if (req.event === 'UPDATE') delete data.owner;

      if (req.event === 'CREATE') {
        const existingDefault = await SELECT.one
          .from('splitta.PaymentMethods')
          .columns('ID')
          .where({ owner: req.user.id, isDefault: true });
        if (!existingDefault) data.isDefault = true;
      }

      if (data.isDefault === true) {
        await UPDATE('splitta.PaymentMethods')
          .set({ isDefault: false })
          .where({ owner: req.user.id, isDefault: true });
      }
    });

    this.before('CREATE', ['ReceiptItems', 'PaymentMethods', 'Teams', 'Webhooks'], (req) => {
      req.data.owner = req.user.id;
    });

    this.after('CREATE', 'Teams', async (team, req) => {
      await INSERT.into('splitta.TeamMembers').entries({
        team_ID: team.ID,
        userID: req.user.id,
        role: 'owner',
      });
    });

    this.before('UPDATE', 'Teams', (req) => {
      delete req.data.owner;
    });

    this.before(['CREATE', 'UPDATE'], 'ReceiptItems', async (req) => {
      const { data } = req;
      if (req.event === 'UPDATE') {
        delete data.owner;
        delete data.receipt_ID;
      } else {
        const receipt = data.receipt_ID
          ? await SELECT.one
              .from('splitta.Receipts')
              .columns('ID')
              .where({ ID: data.receipt_ID, owner: req.user.id })
          : null;
        if (!receipt) return req.reject(404, 'Receipt not found.');
      }

      if ('description' in data || req.event === 'CREATE') {
        data.description = data.description?.trim();
        if (!data.description) return req.reject(400, 'Enter an item description.');
      }
      if ('quantity' in data && !(Number(data.quantity) > 0)) {
        return req.reject(400, 'Quantity must be greater than 0.');
      }
      for (const field of ['priceTaxInclusive', 'itemSpecificDiscount']) {
        if (field in data && data[field] !== null && !(Number(data[field]) >= 0)) {
          return req.reject(400, 'Prices and discounts cannot be negative.');
        }
      }
    });

    this.before('CREATE', 'Profiles', (req) => {
      req.data.ID = req.user.id;
    });

    this.before('UPDATE', 'Profiles', (req) => {
      if (req.data.ID && req.data.ID !== req.user.id) {
        req.reject(403, 'You can only update your own profile.');
      }
    });

    this.on('whoAmI', (req) => {
      return {
        ID: req.user.id,
        displayName: userDisplayName(req.user),
        email: req.user.attr?.email || '',
      };
    });

    return super.init();
  }
}
