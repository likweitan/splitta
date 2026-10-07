-- ============================================================
-- Public receipt access migration
-- Allows anonymous (non-authenticated) users to read receipts,
-- items, profiles, and payment_methods by direct ID lookup.
-- This enables the public /r/:id receipt sharing page.
-- ============================================================

-- Allow anonymous read access to receipts (for public sharing)
CREATE POLICY "Anyone can view receipts by id"
  ON receipts FOR SELECT
  USING (true);

-- Allow anonymous read access to items tied to receipts
CREATE POLICY "Anyone can view receipt items"
  ON items FOR SELECT
  USING (true);

-- Allow anonymous read access to profiles (for paid_by display)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- Allow anonymous read access to payment methods (for payment display)
CREATE POLICY "Anyone can view payment methods"
  ON payment_methods FOR SELECT
  USING (true);
