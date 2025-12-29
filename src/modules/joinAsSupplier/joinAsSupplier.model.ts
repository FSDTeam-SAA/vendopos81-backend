import { model, Schema } from "mongoose";
import { applyEncryption } from "../../middleware/encryptionMiddleware";
import { IJoinAsSupplier } from "./joinAsSupplier.interface";

const JoinAsSupplierSchema = new Schema<IJoinAsSupplier>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    shopName: { type: String, required: true, trim: true },
    brandName: { type: String, required: true, trim: true },
    shopSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true, // SEO + fast lookup
    },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    email: { type: String, required: true, index: true },
    reasonForRejection: { type: String },
    warehouseLocation: { type: String, required: true },
    address: { type: String, required: true },
    location: { type: String, required: true },
    street: { type: String, required: true },
    postalCode: { type: String, required: true },
    documentUrl: [
      {
        public_id: { type: String },
        url: { type: String },
      },
    ],
    rating: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    isSuspended: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

applyEncryption(JoinAsSupplierSchema, [
  "phone",
  "address",
  "warehouseLocation",
  "city",
  "state",
  "zipCode",
]);

const JoinAsSupplier = model<IJoinAsSupplier>(
  "JoinAsSupplier",
  JoinAsSupplierSchema
);
export default JoinAsSupplier;
