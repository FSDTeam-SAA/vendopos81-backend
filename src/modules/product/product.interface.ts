import { Types } from "mongoose";

export interface IProductVariant {
  label: string;
  price: number;
  stock: number;
  unit: string;
  discount?: number;
  discountPrice?: number;
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
  discountPriceFrom?: number;
  showOnlyDiscount?: number;
  shelfLife?: string;
  originCountry?: string;
  isHalal?: boolean;
  isOrganic?: boolean;
  isFrozen?: boolean;
  isKosher?: boolean;
  isVendorBrand?: boolean;
  seo: ISEO;
  averageRating: number;
  totalRatings: number;
  totalSold: number;
  // totalReviews: number;
  status: "pending" | "approved" | "rejected";
  isFeatured: boolean;
  isPallet: boolean;
  isCase: boolean;
  quantity?: number;
  isAvailable: boolean;
  addBy: "admin" | "supplier";
  wholesaleId?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
