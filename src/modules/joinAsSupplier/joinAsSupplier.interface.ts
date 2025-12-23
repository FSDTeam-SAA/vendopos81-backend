import { Types } from "mongoose";

export interface IJoinAsSupplier {
  _id: string;
  userId: Types.ObjectId;
  shopName: string;
  brandName: string;
  shopSlug: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  phone: string;
  email: string;
  reasonForRejection?: string;
  warehouseLocation: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  documentUrl: {
    public_id: string;
    url: string;
  };
  rating?: number;
  totalSales?: number;
  createdAt: Date;
  updatedAt: Date;
}
