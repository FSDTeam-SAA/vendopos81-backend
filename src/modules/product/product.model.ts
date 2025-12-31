import { model, Schema } from "mongoose";
import { IProduct, IProductVariant, ISEO } from "./product.interface";

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    label: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    unit: { type: String, required: true },
  }
  //   { _id: false }
);

const SEOSchema = new Schema<ISEO>(
  {
    metaTitle: { type: String, required: true },
    metaDescription: { type: String, required: true },
    // keywords: { type: [String], default: [] },
    canonicalUrl: { type: String },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "JoinAsSupplier",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    shortDescription: { type: String, required: true },
    description: { type: String, required: true },
    images: [
      {
        public_id: { type: String },
        url: { type: String },
      },
    ],
    productType: { type: String, required: true },
    productName: { type: String, required: true },
    variants: {
      type: [ProductVariantSchema],
      required: true,
    },
    priceFrom: { type: Number },
    shelfLife: { type: String },
    originCountry: { type: String },
    isHalal: { type: Boolean, default: false },
    isOrganic: { type: Boolean, default: false },
    isFrozen: { type: Boolean, default: false },
    isKosher: { type: Boolean, default: false },
    seo: {
      type: SEOSchema,
      required: true,
    },
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isFeatured: { type: Boolean, default: false },
    // isNewArrival: { type: Boolean, default: true },
    addBy: {
      type: String,
      enum: ["admin", "supplier"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Product = model<IProduct>("Product", ProductSchema);

export default Product;
