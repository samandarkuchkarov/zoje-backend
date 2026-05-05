export type LocalizedText = {
  uz: string;
  ru: string;
};

export type ProductCategory =
  | 'industrial'
  | 'overlock'
  | 'buttonhole'
  | 'bartack'
  | 'pattern'
  | 'embroidery'
  | 'heavy-duty'
  | 'domestic'
  | 'specialty';

export type ProductManual = {
  label: string;
  url: string;
};

export type ProductParameterCell = {
  text: string;
  images: string[];
};

export type ProductParameterTable = {
  className: string;
  rows: ProductParameterCell[][];
};

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: ProductCategory;
  model: string;
  images: string[];
  price: number;
  oldPrice?: number;
  sortOrder?: number;
  inStock: boolean;
  featured?: boolean;
  hidden?: boolean;
  placeholder?: boolean;
  officialUrl?: string;
  videoUrls?: string[];
  manuals?: ProductManual[];
  supportMaterialUrl?: string;
  officialDescriptionRu?: string;
  officialParameters?: ProductParameterTable[];
  shortDescription: LocalizedText;
  description: LocalizedText;
  specs: Record<string, string | undefined>;
};
