import { Types } from "mongoose";

export interface IOrder {
  orderUniqueId?: string;
  userId: Types.ObjectId;
  orderType: "single" | "addToCart";
  paymentType: "online" | "cod";
  paymentStatus: "unpaid" | "paid" | "failed";
  orderStatus:
    | "pending"
    | "delivered"
    | "cancelled"
  items: {
    productId: Types.ObjectId;
    supplierId: Types.ObjectId;
    userId: Types.ObjectId;
    quantity: number;
    variantId?: Types.ObjectId;
    wholesaleId?: Types.ObjectId;
    unitPrice: number;
    cartId?: Types.ObjectId; 
  }[];
  totalPrice: number;
  billingInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  };
  purchaseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
