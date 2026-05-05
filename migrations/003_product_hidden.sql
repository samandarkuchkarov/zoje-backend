ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_hidden_idx ON products (hidden);
