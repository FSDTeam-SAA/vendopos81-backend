import { Types } from "mongoose";

export interface IProductImage {
  public_id: string;
  url: string;
}

export interface IProductVariant {
  label: string;
  price: number;
  stock: number;
  sku?: string;
  unit: string;
  // minOrderQty?: number;
}

export interface ISEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl?: string;
}

export interface IProduct {
  supplierId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  images: IProductImage[];
  productType: string;
  productName?: string;
  variants: IProductVariant[];
  priceFrom?: number;
  shelfLife?: string;
  originCountry?: string;
  isHalal?: boolean;
  isOrganic?: boolean;
  isFrozen?: boolean;
  isKosher?: boolean;
  seo: ISEO;
  averageRating: number;
  totalRatings: number;
  totalReviews: number;
  status: "pending" | "approved" | "rejected";
  isFeatured: boolean;
  isNewArrival: boolean;
  createdAt: Date;
  updatedAt: Date;
}
