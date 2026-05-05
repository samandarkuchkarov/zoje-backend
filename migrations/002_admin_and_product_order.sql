ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE products
SET sort_order = CASE
  WHEN id ~ '^[0-9]+$' THEN id::INTEGER
  ELSE sort_order
END
WHERE sort_order = 0;

CREATE INDEX IF NOT EXISTS products_sort_order_idx ON products (sort_order);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
