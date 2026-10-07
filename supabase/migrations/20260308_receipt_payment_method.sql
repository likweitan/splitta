-- Store the selected payment method per receipt.
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_payment_method_id
  ON receipts(payment_method_id);

-- Payment method selection is now per receipt, not global.
ALTER TABLE payment_methods
  DROP COLUMN IF EXISTS is_preferred;
