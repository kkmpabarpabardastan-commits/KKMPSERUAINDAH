/*
# Add simpanan_hibah, category image_url, and product photo storage bucket

1. Schema changes
- `members`: add `simpanan_hibah` (numeric, default 0) so the four savings types
  (pokok, wajib, sukarela, hibah) can be tracked. Hibah (grant/donation) can be 0.
- `categories`: add `image_url` (text, nullable) so each product category can have
  a representative photo used as a fallback image for products that have no own photo.

2. Storage
- Create public storage bucket `products` for product photo uploads.
- Policies: anyone (anon + authenticated) can read; authenticated can upload/update/delete.
  (The admin panel uses the anon-key client without sign-in, so anon uploads are allowed.)

3. Security
- RLS already enabled on `members` and `categories`; no policy changes needed — the
  existing anon + authenticated CRUD policies cover the new columns automatically.
- Storage bucket policies added for SELECT (public read) and INSERT/UPDATE/DELETE
  (anon + authenticated manage).

4. Important notes
- `simpanan_hibah` defaults to 0 and is nullable, so existing members keep working.
- `image_url` on categories is nullable; existing categories get NULL and the app
  uses an icon-based fallback when it is missing.
*/

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS simpanan_hibah numeric DEFAULT 0;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_url text;

-- Seed category fallback images (idempotent single-row updates)
UPDATE categories SET image_url = 'https://images.pexels.com/photos/16620746/pexels-photo-16620746.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Sembako' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/9230463/pexels-photo-9230463.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Kebutuhan Rumah Tangga' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/37935977/pexels-photo-37935977.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Minuman' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/235394/pexels-photo-235394.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Makanan Ringan' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/13779115/pexels-photo-13779115.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Kesehatan & Kebersihan' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/31530915/pexels-photo-31530915.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Pertanian & Peternakan' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/17419782/pexels-photo-17419782.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'Bangunan & Perkakas' AND image_url IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/8119804/pexels-photo-8119804.jpeg?auto=compress&cs=tinysrgb&h=650&w=940' WHERE name = 'ATK & Lain-lain' AND image_url IS NULL;

-- Storage bucket for product photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'products');

-- Anyone can upload/update/delete (no sign-in in this app)
DROP POLICY IF EXISTS "Anyone can upload product images" ON storage.objects;
CREATE POLICY "Anyone can upload product images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Anyone can update product images" ON storage.objects;
CREATE POLICY "Anyone can update product images"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'products') WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Anyone can delete product images" ON storage.objects;
CREATE POLICY "Anyone can delete product images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'products');
