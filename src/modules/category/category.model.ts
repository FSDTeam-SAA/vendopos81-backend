import { model, Schema } from 'mongoose';
import { ICategory } from './category.interface';

const ProductCategorySchema = new Schema(
  {
    productType: {
      type: String,
      required: true,
      trim: true,
    },
    productName: {
      type: [String],
      required: true,
    },
    productImage: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
  },
  { _id: false },
);

const CategorySchema = new Schema<ICategory>(
  {
    region: {
      type: String,
      required: true,
      trim: true,
    },

    categories: {
      type: [ProductCategorySchema],
      required: true,
    },

    productImage: {
      public_id: { type: String },
      url: { type: String },
    },

    regionImage: {
      public_id: { type: String },
      url: { type: String },
    },

    country: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const category = model<ICategory>('Category', CategorySchema);

export default category;
