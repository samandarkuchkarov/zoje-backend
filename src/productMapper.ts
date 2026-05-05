import type { Product } from './types.js';
import { config } from './config.js';

type ProductRow = {
  id: string;
  slug: string;
  name: Product['name'];
  category: Product['category'];
  model: string;
  images: string[];
  price: number;
  old_price: number | null;
  sort_order: number;
  in_stock: boolean;
  featured: boolean;
  hidden: boolean;
  placeholder: boolean;
  short_description: Product['shortDescription'];
  description: Product['description'];
  specs: Product['specs'];
  official_url: string | null;
  video_urls: string[];
  manuals: Product['manuals'];
  support_material_url: string | null;
  official_description_ru: string | null;
  official_parameters: Product['officialParameters'];
};

function assetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(`/assets${normalized}`, config.publicBaseUrl).toString();
}

function withAssetUrls(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('/products/') || value.startsWith('/hero/')
      ? assetUrl(value)
      : value;
  }

  if (Array.isArray(value)) return value.map(withAssetUrls);

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, withAssetUrls(nested)])
    );
  }

  return value;
}

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    model: row.model,
    images: row.images.map(assetUrl),
    price: row.price,
    oldPrice: row.old_price ?? undefined,
    sortOrder: row.sort_order,
    inStock: row.in_stock,
    featured: row.featured,
    hidden: row.hidden,
    placeholder: row.placeholder,
    officialUrl: row.official_url ?? undefined,
    videoUrls: row.video_urls,
    manuals: row.manuals,
    supportMaterialUrl: row.support_material_url ?? undefined,
    officialDescriptionRu: row.official_description_ru ?? undefined,
    officialParameters: withAssetUrls(row.official_parameters) as Product['officialParameters'],
    shortDescription: row.short_description,
    description: row.description,
    specs: row.specs,
  };
}
