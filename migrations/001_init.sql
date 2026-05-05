CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL,
  category TEXT NOT NULL,
  model TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  price INTEGER NOT NULL CHECK (price >= 0),
  old_price INTEGER CHECK (old_price IS NULL OR old_price >= 0),
  in_stock BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  placeholder BOOLEAN NOT NULL DEFAULT false,
  short_description JSONB NOT NULL,
  description JSONB NOT NULL,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  official_url TEXT,
  video_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  manuals JSONB NOT NULL DEFAULT '[]'::jsonb,
  support_material_url TEXT,
  official_description_ru TEXT,
  official_parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products (featured);
CREATE INDEX IF NOT EXISTS products_in_stock_idx ON products (in_stock);
CREATE INDEX IF NOT EXISTS products_price_idx ON products (price);
CREATE INDEX IF NOT EXISTS products_model_idx ON products (model);
