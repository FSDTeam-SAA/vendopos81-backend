import { model, Schema } from "mongoose";
import { ICategory } from "./category.interface";

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, lowercase: true, required: true },
    slug: { type: String, lowercase: true, unique: true },
    subcategories: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

CategorySchema.pre("save", function (next) {
  if (this.name) {
    this.name = this.name.toLowerCase();
  }

  if (this.slug) {
    this.slug = this.slug.toLowerCase();
  }

  if (this.subcategories?.length) {
    this.subcategories = this.subcategories.map((sub) => sub.toLowerCase());
  }

  next();
});

const category = model<ICategory>("Category", CategorySchema);

export default category;
