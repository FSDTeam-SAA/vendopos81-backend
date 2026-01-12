import { model, Schema, Types } from "mongoose";
import {
  IPalletItem,
  IWholesale,
  IWholesaleCaseItem,
  IWholesalePallet,
} from "./wholeSale.interface";

const wholesaleCaseItemSchema = new Schema<IWholesaleCaseItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
//   { _id: false }
);

const palletItemSchema = new Schema<IPalletItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // caseQuantity: {
    //   type: Number,
    //   required: true,
    //   min: 1,
    // },
  },
//   { _id: false }
);

const wholesalePalletSchema = new Schema<IWholesalePallet>(
  {
    palletName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [palletItemSchema],
      required: true,
    },
    totalCases: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedWeight: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
    },
    isMixed: {
      type: Boolean,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
//   { _id: false }
);

const fastMovingItemSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
//   { _id: false }
);

const wholesaleSchema = new Schema<IWholesale>(
  {
    type: {
      type: String,
      enum: ["case", "pallet", "fastMoving"],
      required: true,
    },

    label: {
      type: String,
      required: true,
    },

    caseItems: {
      type: [wholesaleCaseItemSchema],
      default: [],
    },

    palletItems: {
      type: [wholesalePalletSchema],
      default: [],
    },

    fastMovingItems: {
      type: [fastMovingItemSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Wholesale = model("Wholesale", wholesaleSchema);

export default Wholesale;
