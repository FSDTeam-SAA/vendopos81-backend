import { Types } from "mongoose";

export interface IJoinAsDriver {
  _id: string;
  userId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  yearsOfExperience: number;
  licenseExpiryDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  status: "pending" | "approved" | "rejected";
  documentUrl: {
    public_id: string;
    url: string;
  }[];
  isSuspended: boolean;
  suspendedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDriverQuery {
  page?: string;
  limit?: string;
  status?: "pending" | "approved" | "rejected";
  sort?: "1day" | "7day" | "atoz";
  search?: string;
}


