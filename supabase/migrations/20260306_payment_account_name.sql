-- Add account_name and qr_data columns to payment_methods
ALTER TABLE payment_methods
  ADD COLUMN account_name TEXT,
  ADD COLUMN qr_data TEXT;
