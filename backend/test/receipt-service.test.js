import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExtraction } from '../srv/receipt-service.js';

test('preserves unknown receipt amounts and item values as null', () => {
  const extraction = parseExtraction(
    JSON.stringify({
      receipt_info: {
        merchant_name: 'Corner Shop',
        currency: 'MYR',
        total_tax_amount: null,
        tax_percentage: null,
        header_discount: null,
        anchor_total: null,
        rounding_adjustment: null,
        prices_include_tax: true,
      },
      items: [
        {
          description: 'Unclear item',
          qty: null,
          unit_price: null,
          item_specific_discount: null,
        },
      ],
    }),
  );

  assert.deepEqual(extraction.receiptInfo, {
    merchantName: 'Corner Shop',
    currency: 'MYR',
    taxAmount: null,
    taxPercentage: null,
    discountAmount: null,
    priceAmount: null,
    roundingAdjustment: null,
    pricesIncludeTax: true,
  });
  assert.deepEqual(extraction.items, [
    {
      description: 'Unclear item',
      quantity: null,
      priceTaxInclusive: null,
      itemSpecificDiscount: null,
    },
  ]);
});

test('preserves explicit zero values', () => {
  const extraction = parseExtraction(
    JSON.stringify({
      receipt_info: {
        merchant_name: 'Corner Shop',
        currency: 'MYR',
        total_tax_amount: 0,
        tax_percentage: 0,
        header_discount: 0,
        anchor_total: 0,
        rounding_adjustment: 0,
        prices_include_tax: true,
      },
      items: [
        {
          description: 'Free sample',
          qty: 1,
          unit_price: 0,
          item_specific_discount: 0,
        },
      ],
    }),
  );

  assert.equal(extraction.receiptInfo.priceAmount, 0);
  assert.equal(extraction.receiptInfo.taxAmount, 0);
  assert.equal(extraction.items[0].priceTaxInclusive, 0);
});
