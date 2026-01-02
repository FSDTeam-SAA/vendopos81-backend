import { model, Schema } from "mongoose";
import { ICart } from "./cart.interface";

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    wholesaleId: {
      type: Schema.Types.ObjectId,
      ref: "Wholesale",
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false }
);

const Cart = model<ICart>("Cart", cartSchema);
export default Cart;
