import { pool } from './db.js';
import { mapProductRow } from './productMapper.js';
import type { Product, ProductCategory } from './types.js';

const PUBLIC_CATEGORIES: ProductCategory[] = [
  'industrial',
  'overlock',
  'pattern',
  'specialty',
  'spare-parts',
  'accessories',
];

const SPECIALTY_CATEGORY_KEYS: ProductCategory[] = [
  'specialty',
  'buttonhole',
  'bartack',
  'embroidery',
  'heavy-duty',
  'domestic',
];

export type ProductListFilters = {
  category?: ProductCategory;
  featured?: boolean;
  inStock?: boolean;
  includeHidden?: boolean;
  q?: string;
  sort?: 'newest' | 'priceAsc' | 'priceDesc';
};

function buildProductWhere(filters: ProductListFilters) {
  const where: string[] = [];
  const values: unknown[] = [];

  if (!filters.includeHidden) {
    where.push('hidden = false');
  }

  if (filters.category) {
    if (filters.category === 'specialty') {
      values.push(SPECIALTY_CATEGORY_KEYS);
      where.push(`category = ANY($${values.length})`);
    } else {
      values.push(filters.category);
      where.push(`category = $${values.length}`);
    }
  }

  if (typeof filters.featured === 'boolean') {
    values.push(filters.featured);
    where.push(`featured = $${values.length}`);
  }

  if (typeof filters.inStock === 'boolean') {
    values.push(filters.inStock);
    where.push(`in_stock = $${values.length}`);
  }

  if (filters.q) {
    values.push(`%${filters.q}%`);
    where.push(
      `(model ILIKE $${values.length} OR name->>'ru' ILIKE $${values.length} OR name->>'uz' ILIKE $${values.length})`
    );
  }

  return {
    clause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
}

function orderBy(sort: ProductListFilters['sort']) {
  if (sort === 'priceAsc') return 'price ASC, id ASC';
  if (sort === 'priceDesc') return 'price DESC, id ASC';
  if (sort === 'newest') return 'created_at DESC, id ASC';
  return 'sort_order ASC, id ASC';
}

export async function listProducts(filters: ProductListFilters = {}) {
  const { clause, values } = buildProductWhere(filters);
  const result = await pool.query(
    `SELECT * FROM products ${clause} ORDER BY ${orderBy(filters.sort)}`,
    values
  );
  return result.rows.map(mapProductRow);
}

export async function getProductBySlug(slug: string) {
  return getProductBySlugWithOptions(slug);
}

export async function getProductBySlugWithOptions(
  slug: string,
  options: { includeHidden?: boolean } = {}
) {
  const result = await pool.query(
    `SELECT * FROM products WHERE slug = $1${options.includeHidden ? '' : ' AND hidden = false'}`,
    [slug]
  );
  return result.rows[0] ? mapProductRow(result.rows[0]) : undefined;
}

export async function getCategories() {
  return PUBLIC_CATEGORIES;
}

export async function getRelatedProducts(product: Product, limit = 4) {
  const result = await pool.query(
    `SELECT * FROM products
     WHERE category = $1 AND id <> $2 AND hidden = false
     ORDER BY featured DESC, created_at DESC, id ASC
     LIMIT $3`,
    [product.category, product.id, limit]
  );
  return result.rows.map(mapProductRow);
}

async function nextProductId() {
  const result = await pool.query(
    "SELECT COALESCE(MAX(id::INTEGER), 0) + 1 AS id FROM products WHERE id ~ '^[0-9]+$'"
  );
  return String(result.rows[0].id);
}

async function nextSortOrder() {
  const result = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM products'
  );
  return Number(result.rows[0].sort_order);
}

type ProductInput = Omit<Product, 'id'> & { id?: string };

function productValues(product: ProductInput, id: string) {
  return [
    id,
    product.slug,
    JSON.stringify(product.name),
    product.category,
    product.model,
    JSON.stringify(product.images ?? []),
    product.price,
    product.oldPrice ?? null,
    product.inStock,
    product.sortOrder ?? 0,
    product.featured ?? false,
    product.hidden ?? false,
    product.placeholder ?? false,
    JSON.stringify(product.shortDescription),
    JSON.stringify(product.description),
    JSON.stringify(product.specs ?? {}),
    product.officialUrl ?? null,
    JSON.stringify(product.videoUrls ?? []),
    JSON.stringify(product.manuals ?? []),
    product.supportMaterialUrl ?? null,
    product.officialDescriptionRu ?? null,
    JSON.stringify(product.officialParameters ?? []),
  ];
}

const productColumns = `
  id, slug, name, category, model, images, price, old_price, in_stock,
  sort_order, featured, hidden, placeholder, short_description, description, specs,
  official_url, video_urls, manuals, support_material_url,
  official_description_ru, official_parameters, updated_at
`;

export async function createProduct(product: ProductInput) {
  const id = product.id || (await nextProductId());
  const sortOrder = product.sortOrder ?? (await nextSortOrder());
  const values = productValues({ ...product, sortOrder }, id);

  const result = await pool.query(
    `
    INSERT INTO products (${productColumns})
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, now()
    )
    RETURNING *
    `,
    values
  );

  return mapProductRow(result.rows[0]);
}

export async function updateProduct(slug: string, product: ProductInput) {
  const existing = await getProductBySlugWithOptions(slug, { includeHidden: true });
  if (!existing) return undefined;

  const id = product.id || existing.id;
  const values = productValues(
    { ...product, hidden: product.hidden ?? existing.hidden },
    id
  );
  values.push(slug);

  const result = await pool.query(
    `
    UPDATE products SET
      id = $1,
      slug = $2,
      name = $3,
      category = $4,
      model = $5,
      images = $6,
      price = $7,
      old_price = $8,
      in_stock = $9,
      sort_order = $10,
      featured = $11,
      hidden = $12,
      placeholder = $13,
      short_description = $14,
      description = $15,
      specs = $16,
      official_url = $17,
      video_urls = $18,
      manuals = $19,
      support_material_url = $20,
      official_description_ru = $21,
      official_parameters = $22,
      updated_at = now()
    WHERE slug = $23
    RETURNING *
    `,
    values
  );

  return result.rows[0] ? mapProductRow(result.rows[0]) : undefined;
}

export async function reorderProducts(items: Array<{ slug: string; sortOrder: number }>) {
  await pool.query('BEGIN');
  try {
    for (const item of items) {
      await pool.query('UPDATE products SET sort_order = $1, updated_at = now() WHERE slug = $2', [
        item.sortOrder,
        item.slug,
      ]);
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  return listProducts({ includeHidden: true });
}
