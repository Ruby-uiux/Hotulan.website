import type { ProductSpec } from "@/lib/catalog";

/** Product as stored in data/store.json (v1) and in the demo catalogue. */
export interface SeedProduct {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  badge?: string;
  stock: number;
  warrantyMonths: number;
  summary: string;
  description: string;
  features: string[];
  specs: ProductSpec[];
  keywords?: string[];
}

/** Order as stored in data/store.json (v1): 4 statuses, 4 payment methods, district only. */
export interface LegacyOrder {
  id: string;
  customer: string;
  phone: string;
  district: string;
  createdAt: string;
  payment: string;
  status: string;
  lines: { productId: string; title: string; unitPrice: number; quantity: number }[];
  deliveryFee: number;
}

export interface LegacyStoreJson {
  version: 1;
  products: SeedProduct[];
  orders: LegacyOrder[];
  settings: Record<string, unknown>;
}
