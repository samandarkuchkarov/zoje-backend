import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { pool, closePool } from '../src/db.js';

const LocalizedTextSchema = z.object({
  uz: z.string(),
  ru: z.string(),
});

const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: LocalizedTextSchema,
  category: z.string(),
  model: z.string(),
  images: z.array(z.string()),
  price: z.number().int().nonnegative(),
  oldPrice: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  inStock: z.boolean(),
  featured: z.boolean().optional(),
  placeholder: z.boolean().optional(),
  officialUrl: z.string().optional(),
  videoUrls: z.array(z.string()).optional(),
  manuals: z.array(z.record(z.unknown())).optional(),
  supportMaterialUrl: z.string().optional(),
  officialDescriptionRu: z.string().optional(),
  officialParameters: z.array(z.record(z.unknown())).optional(),
  shortDescription: LocalizedTextSchema,
  description: LocalizedTextSchema,
  specs: z.record(z.string().optional()),
});

const ProductsSchema = z.array(ProductSchema);

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type OfficialImageRef = {
  remoteUrl?: string;
  localPath?: string;
};

type OfficialProduct = {
  gallery?: OfficialImageRef[];
  introduction?: { images?: OfficialImageRef[] };
  parameters?: { images?: OfficialImageRef[] };
};

function collectOfficialImageMap(officialProducts: OfficialProduct[]) {
  const map = new Map<string, string>();

  for (const product of officialProducts) {
    const refs = [
      ...(product.gallery ?? []),
      ...(product.introduction?.images ?? []),
      ...(product.parameters?.images ?? []),
    ];

    for (const ref of refs) {
      if (ref.remoteUrl && ref.localPath) map.set(ref.remoteUrl, ref.localPath);
    }
  }

  return map;
}

async function loadOfficialImageMap() {
  const officialPath = path.resolve(
    process.cwd(),
    process.env.SEED_OFFICIAL_PRODUCTS_PATH ??
      '../zoje/data/zoje-official-products.json'
  );

  try {
    const raw = await readFile(officialPath, 'utf8');
    const parsed = JSON.parse(raw) as { products?: OfficialProduct[] };
    return collectOfficialImageMap(parsed.products ?? []);
  } catch {
    return new Map<string, string>();
  }
}

function replaceRemoteImages(value: JsonValue, imageMap: Map<string, string>): JsonValue {
  if (typeof value === 'string') return imageMap.get(value) ?? value;
  if (Array.isArray(value)) {
    return value.map((item) => replaceRemoteImages(item, imageMap));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        replaceRemoteImages(nested, imageMap),
      ])
    );
  }
  return value;
}

async function main() {
  const seedPath = path.resolve(
    process.cwd(),
    process.env.SEED_PRODUCTS_PATH ?? 'data/products.json'
  );
  const raw = await readFile(seedPath, 'utf8');
  const products = ProductsSchema.parse(JSON.parse(raw));
  const officialImageMap = await loadOfficialImageMap();

  await pool.query('BEGIN');
  try {
    for (const product of products) {
      const officialParameters = replaceRemoteImages(
        (product.officialParameters ?? []) as JsonValue,
        officialImageMap
      );

      await pool.query(
        `
        INSERT INTO products (
          id, slug, name, category, model, images, price, old_price, in_stock,
          sort_order, featured, placeholder, short_description, description, specs,
          official_url, video_urls, manuals, support_material_url,
          official_description_ru, official_parameters, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          model = EXCLUDED.model,
          images = EXCLUDED.images,
          price = EXCLUDED.price,
          old_price = EXCLUDED.old_price,
          in_stock = EXCLUDED.in_stock,
          sort_order = EXCLUDED.sort_order,
          featured = EXCLUDED.featured,
          placeholder = EXCLUDED.placeholder,
          short_description = EXCLUDED.short_description,
          description = EXCLUDED.description,
          specs = EXCLUDED.specs,
          official_url = EXCLUDED.official_url,
          video_urls = EXCLUDED.video_urls,
          manuals = EXCLUDED.manuals,
          support_material_url = EXCLUDED.support_material_url,
          official_description_ru = EXCLUDED.official_description_ru,
          official_parameters = EXCLUDED.official_parameters,
          updated_at = now()
        `,
        [
          product.id,
          product.slug,
          JSON.stringify(product.name),
          product.category,
          product.model,
          JSON.stringify(product.images),
          product.price,
          product.oldPrice ?? null,
          product.inStock,
          product.sortOrder ?? (Number.parseInt(product.id, 10) || 0),
          product.featured ?? false,
          product.placeholder ?? false,
          JSON.stringify(product.shortDescription),
          JSON.stringify(product.description),
          JSON.stringify(product.specs),
          product.officialUrl ?? null,
          JSON.stringify(product.videoUrls ?? []),
          JSON.stringify(product.manuals ?? []),
          product.supportMaterialUrl ?? null,
          product.officialDescriptionRu ?? null,
          JSON.stringify(officialParameters),
        ]
      );
    }

    await pool.query('COMMIT');
    console.log(
      `Seeded ${products.length} products from ${seedPath}; mapped ${officialImageMap.size} official image URLs`
    );
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
