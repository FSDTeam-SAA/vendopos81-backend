import { Types } from "mongoose";

export interface IProductVariant {
  label: string;
  price: number;
  stock: number;
  unit: string;
}

export interface ISEO {
  metaTitle: string;
  metaDescription: string;
  // keywords: string[];
  canonicalUrl?: string;
}

export interface IProduct {
  userId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  supplierId?: Types.ObjectId;
  title: string;
  slug: string;
  type: "single" | "case";
  shortDescription: string;
  description: string;
  images: {
    public_id: string;
    url: string;
  };
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
  // isNewArrival: boolean;
  addBy: "admin" | "supplier"; //
  createdAt: Date;
  updatedAt: Date;
}
