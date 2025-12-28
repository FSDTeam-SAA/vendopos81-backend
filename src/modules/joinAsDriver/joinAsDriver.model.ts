import { model, Schema } from "mongoose";
import { applyEncryption } from "../../middleware/encryptionMiddleware";
import { IJoinAsDriver } from "./joinAsDriver.interface";

const JoinAsDriverSchema = new Schema<IJoinAsDriver>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    firstName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    lastName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: { 
      type: String, 
      required: true, 
      index: true 
    },
    phone: { 
      type: String, 
      required: true, 
      unique: true 
    },
    yearsOfExperience: { 
      type: Number, 
      required: true 
    },
    licenseExpiryDate: { 
      type: String, 
      required: true 
    },
    address: { 
      type: String, 
      required: true 
    },
    city: { 
      type: String, 
      required: true 
    },
    state: { 
      type: String, 
      required: true 
    },
    zipCode: { 
      type: String, 
      required: true 
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    documentUrl: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    isSuspended: { 
      type: Boolean, 
      default: false 
    },
    suspendedUntil: { 
      type: Date, 
      default: null 
    },
    isOnline: { 
      type: Boolean, 
      default: false 
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Applying encryption to sensitive fields as per your security middleware
applyEncryption(JoinAsDriverSchema, [
  "phone",
  "address",
  "city",
  "state",
  "zipCode",
]);

const JoinAsDriver = model<IJoinAsDriver>(
  "JoinAsDriver",
  JoinAsDriverSchema
);

export default JoinAsDriver;