import cds from '@sap/cds';
import { readReceiptImage } from './receipt-image.js';
import { notifyAfterCommit } from './webhooks.js';

const { SELECT, UPDATE, INSERT } = cds.ql;

export default class PublicReceiptService extends cds.ApplicationService {
  async init() {
    const db = await cds.connect.to('db');

    this.on('getReceipt', async (req) => {
      const { ID } = req.data;
      const receipt = await db.run(
        SELECT.one
          .from('splitta.Receipts')
          .columns(
            'ID',
            'merchantName',
            'currency',
            'priceAmount',
            'taxAmount',
            'taxPercentage',
            'discountAmount',
            'roundingAdjustment',
            'pricesIncludeTax',
            'createdAt',
            'paymentMethod_ID',
            'owner',
          )
          .where({ ID }),
      );

      if (!receipt) return req.reject(404, 'Receipt not found.');
      receipt.imageData = await readReceiptImage(db, ID);

      const items = await db.run(
        SELECT.from('splitta.ReceiptItems')
          .columns(
            'ID',
            'description',
            'quantity',
            'priceTaxInclusive',
            'itemSpecificDiscount',
            'paidBy',
            'paidByName',
          )
          .where({ receipt_ID: ID }),
      );

      const paymentMethodColumns = [
        'bankName',
        'accountName',
        'paymentType',
        'paymentValue',
        'qrData',
      ];
      // The receipt's chosen method takes precedence over the owner's default.
      const paymentMethod =
        (receipt.paymentMethod_ID &&
          (await db.run(
            SELECT.one
              .from('splitta.PaymentMethods')
              .columns(...paymentMethodColumns)
              .where({ ID: receipt.paymentMethod_ID, owner: receipt.owner }),
          ))) ||
        (await db.run(
          SELECT.one
            .from('splitta.PaymentMethods')
            .columns(...paymentMethodColumns)
            .where({ owner: receipt.owner })
            .orderBy('isDefault desc', 'createdAt desc'),
        )) ||
        null;

      delete receipt.paymentMethod_ID;
      delete receipt.owner;
      return { ...receipt, items, paymentMethod };
    });

    this.on('markAsPaid', async (req) => {
      const { ID, itemIDs, paidByName } = req.data;
      let ids;

      try {
        ids = JSON.parse(itemIDs);
      } catch {
        return req.reject(400, 'Invalid item list.');
      }

      const name = paidByName?.trim();
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > 100 ||
        ids.some((id) => typeof id !== 'string') ||
        !name
      ) {
        return req.reject(400, 'Select receipt items and enter a name.');
      }

      let quantities = {};
      if (req.data.quantities) {
        try {
          quantities = JSON.parse(req.data.quantities);
        } catch {
          return req.reject(400, 'Invalid quantities.');
        }
        if (!quantities || typeof quantities !== 'object') {
          return req.reject(400, 'Invalid quantities.');
        }
      }

      const receipt = await db.run(
        SELECT.one
          .from('splitta.Receipts')
          .columns('ID', 'owner', 'merchantName', 'priceAmount', 'currency')
          .where({ ID }),
      );
      if (!receipt) return req.reject(404, 'Receipt not found.');

      const selectedIDs = [...new Set(ids)];
      const matchingItems = await db.run(
        SELECT.from('splitta.ReceiptItems')
          .columns(
            'ID',
            'owner',
            'description',
            'quantity',
            'priceTaxInclusive',
            'itemSpecificDiscount',
          )
          .where({ receipt_ID: ID, ID: { in: selectedIDs } }),
      );

      if (matchingItems.length !== selectedIDs.length) {
        return req.reject(404, 'One or more receipt items were not found.');
      }

      const paidItems = [];
      {
        for (const item of matchingItems) {
          const total = Number(item.quantity);
          const requested = quantities[item.ID];
          const qty =
            requested === undefined ? total : Math.floor(Number(requested));
          if (!Number.isFinite(qty) || qty < 1) {
            return req.reject(400, 'Invalid quantity.');
          }

          // Whole line paid: mark it. Otherwise split the paid quantity into
          // its own line so the remainder stays available to other people.
          if (qty >= total) {
            const marked = await db.run(
              UPDATE('splitta.ReceiptItems')
                .set({ paidByName: name })
                .where({ ID: item.ID, paidByName: null }),
            );
            if (marked) paidItems.push({ description: item.description, quantity: total });
            continue;
          }

          const discount = Number(item.itemSpecificDiscount) || 0;
          const paidDiscount = Number(((discount / total) * qty).toFixed(2));
          const updated = await db.run(
            UPDATE('splitta.ReceiptItems')
              .set({
                quantity: Number((total - qty).toFixed(3)),
                itemSpecificDiscount: Number((discount - paidDiscount).toFixed(2)),
              })
              .where({ ID: item.ID, paidByName: null }),
          );
          if (!updated) continue;
          await db.run(
            INSERT.into('splitta.ReceiptItems').entries({
              receipt_ID: ID,
              owner: item.owner,
              description: item.description,
              quantity: qty,
              priceTaxInclusive: item.priceTaxInclusive,
              itemSpecificDiscount: paidDiscount,
              paidByName: name,
            }),
          );
          paidItems.push({ description: item.description, quantity: qty });
        }
      }

      if (paidItems.length) {
        notifyAfterCommit(req, 'items.paid', receipt.owner, {
          receiptID: receipt.ID,
          merchantName: receipt.merchantName,
          priceAmount: receipt.priceAmount,
          currency: receipt.currency,
          paidByName: name,
          items: paidItems,
        });
      }

      return true;
    });

    return super.init();
  }
}
