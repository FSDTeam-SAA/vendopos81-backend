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
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const Cart = model<ICart>("Cart", cartSchema);
export default Cart;
