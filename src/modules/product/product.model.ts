/* eslint-disable @typescript-eslint/no-this-alias */
import { model, Schema } from "mongoose";
import { IProduct, IProductVariant, ISEO } from "./product.interface";

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    label: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    unit: { type: String, required: true },
    discount: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
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
    discountPriceFrom: { type: Number },
    shelfLife: { type: String },
    originCountry: { type: String },
    isHalal: { type: Boolean, default: false },
    isOrganic: { type: Boolean, default: false },
    isFrozen: { type: Boolean, default: false },
    isKosher: { type: Boolean, default: false },
    isVendorBrand: { type: Boolean, default: false },
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
    quantity: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    wholesaleId: [
      {
        type: Schema.Types.ObjectId,
        ref: "Wholesale",
        index: true,
        default: [],
      },
    ],
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

ProductSchema.pre("save", function (next) {
  const product = this;

  if (product.variants && product.variants.length > 0) {
    product.variants = product.variants.map((variant: any) => {
      // discountPrice auto calculate
      if (variant.discount && variant.discount > 0) {
        variant.discountPrice =
          variant.price - (variant.price * variant.discount) / 100;
      } else {
        variant.discountPrice = variant.price;
      }
      return variant;
    });
  }

  next();
});


const Product = model<IProduct>("Product", ProductSchema);

export default Product;
