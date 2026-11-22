import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWebhookMessage, validateWebhookUrl } from '../srv/webhooks.js';

test('accepts public https webhook URLs', () => {
  assert.equal(
    validateWebhookUrl('https://contoso.webhook.office.com/webhookb2/abc'),
    null,
  );
});

test('rejects non-https, credentialed and private webhook URLs', () => {
  for (const url of [
    'http://example.com/hook',
    'not a url',
    'https://user:pass@example.com/hook',
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://10.1.2.3/hook',
    'https://192.168.0.5/hook',
    'https://169.254.169.254/latest',
    'https://[::1]/hook',
    'https://metadata.google.internal/',
  ]) {
    assert.notEqual(validateWebhookUrl(url), null, url);
  }
});

const cardOf = (message) => message.attachments[0].content;

test('builds a Teams adaptive card for paid items', () => {
  const message = buildWebhookMessage('items.paid', {
    merchantName: 'Corner Shop',
    paidByName: 'Alice',
    priceAmount: 12.5,
    currency: 'MYR',
    items: [{ description: 'Teh tarik', quantity: 2 }],
  });

  assert.equal(message.type, 'message');
  assert.equal(
    message.attachments[0].contentType,
    'application/vnd.microsoft.card.adaptive',
  );
  const card = cardOf(message);
  assert.equal(card.body[0].text, '✅ Alice paid on Corner Shop');
  assert.equal(card.body[1].text, '- 2 × Teh tarik');
  assert.deepEqual(card.body[2].facts, [
    { title: 'Paid by', value: 'Alice' },
    { title: 'Receipt total', value: 'MYR 12.50' },
  ]);
});

test('omits unknown facts and links the receipt when APP_URL is set', (t) => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = 'https://splitta.example.com/';
  t.after(() => {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  });

  const card = cardOf(
    buildWebhookMessage('receipt.created', {
      receiptID: 'r1',
      merchantName: 'Corner Shop',
      priceAmount: null,
      itemCount: 3,
      createdBy: 'Bob',
    }),
  );

  assert.deepEqual(card.body[1].facts, [
    { title: 'Items', value: '3' },
    { title: 'Created by', value: 'Bob' },
  ]);
  assert.equal(card.actions[0].url, 'https://splitta.example.com/receipt/r1');
});
