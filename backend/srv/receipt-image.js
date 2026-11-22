import cds from '@sap/cds';

const { SELECT } = cds.ql;

const SIGNATURES = [
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
];

function mimeType(bytes) {
  for (const [type, signature] of SIGNATURES) {
    if (signature.every((byte, index) => bytes[index] === byte)) return type;
  }
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

async function toBuffer(value) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'base64');
  const chunks = [];
  for await (const chunk of value) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// LargeBinary columns come back from the database as streams and are left out of
// OData entity reads, so receipt images are delivered to the UI as data URLs.
export async function readReceiptImage(db, ID) {
  const row = await db.run(
    SELECT.one.from('splitta.Receipts').columns('imageData').where({ ID }),
  );
  const bytes = await toBuffer(row?.imageData);
  if (!bytes?.length) return null;
  return `data:${mimeType(bytes)};base64,${bytes.toString('base64')}`;
}
