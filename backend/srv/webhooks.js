import cds from '@sap/cds';
import net from 'node:net';

const { SELECT, UPDATE } = cds.ql;

const LOG = cds.log('webhooks');
const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_LISTED_ITEMS = 10;

export const WEBHOOK_EVENTS = {
  'receipt.created': 'onReceiptCreated',
  'items.paid': 'onItemsPaid',
};

function isPrivateAddress(host) {
  const address = host.replace(/^\[|\]$/g, '').toLowerCase();
  const version = net.isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (version === 6) {
    return (
      address === '::' ||
      address === '::1' ||
      address.startsWith('fc') ||
      address.startsWith('fd') ||
      address.startsWith('fe80') ||
      address.startsWith('::ffff:')
    );
  }
  return false;
}

/** Returns an error message, or null when the URL may receive webhook calls. */
export function validateWebhookUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    return 'Enter a valid webhook URL.';
  }
  if (url.protocol !== 'https:') return 'Webhook URLs must use https://.';
  if (url.username || url.password) return 'Webhook URLs cannot contain credentials.';
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isPrivateAddress(host)
  ) {
    return 'Webhook URLs must point to a public host.';
  }
  return null;
}

const formatAmount = (amount, currency) =>
  amount === null || amount === undefined || amount === ''
    ? null
    : `${currency || ''} ${Number(amount).toFixed(2)}`.trim();

function formatQuantity(quantity) {
  const value = Number(quantity);
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : '1';
}

function receiptLink(receiptID) {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, '');
  return base && receiptID ? `${base}/receipt/${encodeURIComponent(receiptID)}` : null;
}

function sharedReceiptLink(receiptID) {
  const link = receiptLink(receiptID);
  return link ? `${link}?ref=share` : null;
}

/** Wraps an Adaptive Card in the envelope accepted by Microsoft Teams incoming webhooks and Workflows. */
function teamsMessage({ title, text, facts = [], link }) {
  const body = [
    { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true },
  ];
  if (text) body.push({ type: 'TextBlock', text, wrap: true });
  const visibleFacts = facts.filter((fact) => fact.value);
  if (visibleFacts.length) body.push({ type: 'FactSet', facts: visibleFacts });

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body,
          ...(link
            ? { actions: [{ type: 'Action.OpenUrl', title: 'Open receipt', url: link }] }
            : {}),
        },
      },
    ],
  };
}

export function buildWebhookMessage(event, details = {}) {
  const merchant = details.merchantName || 'a receipt';
  if (event === 'receipt.created') {
    return teamsMessage({
      title: `🧾 New receipt: ${merchant}`,
      facts: [
        { title: 'Total', value: formatAmount(details.priceAmount, details.currency) },
        { title: 'Items', value: details.itemCount ? String(details.itemCount) : null },
        { title: 'Created by', value: details.createdBy },
        { title: 'Shared link', value: sharedReceiptLink(details.receiptID) },
      ],
      link: receiptLink(details.receiptID),
    });
  }
  if (event === 'items.paid') {
    const items = details.items ?? [];
    const listed = items
      .slice(0, MAX_LISTED_ITEMS)
      .map((item) => `- ${formatQuantity(item.quantity)} × ${item.description}`);
    if (items.length > MAX_LISTED_ITEMS) {
      listed.push(`- …and ${items.length - MAX_LISTED_ITEMS} more`);
    }
    return teamsMessage({
      title: `✅ ${details.paidByName || 'Someone'} paid on ${merchant}`,
      text: listed.join('\n'),
      facts: [
        { title: 'Paid by', value: details.paidByName },
        { title: 'Receipt total', value: formatAmount(details.priceAmount, details.currency) },
      ],
      link: receiptLink(details.receiptID),
    });
  }
  return teamsMessage({
    title: '🔔 Splitta webhook test',
    text: 'Your webhook is connected. You will receive receipt updates here.',
    facts: [{ title: 'Sent at', value: new Date().toISOString() }],
  });
}

export async function postWebhook(url, payload) {
  const invalid = validateWebhookUrl(url);
  if (invalid) return { ok: false, status: 0, message: invalid };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    const message = response.ok
      ? `Delivered (${response.status})`
      : `Failed (${response.status} ${response.statusText})`.trim();
    return { ok: response.ok, status: response.status, message: message.slice(0, 255) };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'timed out' : error?.message || 'network error';
    return { ok: false, status: 0, message: `Failed (${reason})`.slice(0, 255) };
  }
}

export function deliveryUpdate(webhookID, result) {
  return UPDATE('splitta.Webhooks')
    .set({ lastTriggeredAt: new Date().toISOString(), lastStatus: result.message })
    .where({ ID: webhookID });
}

export async function sendWebhook(webhook, event, details) {
  const result = await postWebhook(webhook.url, buildWebhookMessage(event, details));
  if (!result.ok) LOG.warn(`Webhook ${webhook.ID} ${event}: ${result.message}`);
  return result;
}

async function dispatch(event, owner, details) {
  const flag = WEBHOOK_EVENTS[event];
  // Fresh root transactions: the request's transaction has already been committed.
  const webhooks = await cds.db.tx((tx) =>
    tx.run(
      SELECT.from('splitta.Webhooks')
        .columns('ID', 'url')
        .where({ owner, active: true, [flag]: true }),
    ),
  );
  await Promise.all(
    webhooks.map(async (webhook) => {
      const result = await sendWebhook(webhook, event, details);
      await cds.db.tx((tx) => tx.run(deliveryUpdate(webhook.ID, result)));
    }),
  );
}

/** Notifies the owner's webhooks once the current request has committed successfully. */
export function notifyAfterCommit(req, event, owner, details) {
  if (!owner || !WEBHOOK_EVENTS[event]) return;
  req.on('succeeded', () => {
    dispatch(event, owner, details).catch((error) =>
      LOG.error(`Webhook dispatch for ${event} failed`, error),
    );
  });
}
