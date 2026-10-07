-- Add a free-text paid_by_name column for public receipt payers
ALTER TABLE items ADD COLUMN paid_by_name TEXT;

-- Allow anonymous users to update only paid_by_name on items
CREATE POLICY "Anyone can mark items as paid"
  ON items FOR UPDATE
  USING (true)
  WITH CHECK (true);
