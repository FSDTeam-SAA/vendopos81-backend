import { Types } from "mongoose";

export interface IReview {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  productId: Types.ObjectId;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  isReviewAdded: boolean;
  createdAt: Date;
  updatedAt: Date;
}
