import { Types } from 'mongoose';

export interface IJoinAsSupplier {
  _id: string;
  userId: Types.ObjectId;
  firstName: string;
  lastName: string;
  shopName: string;
  brandName: string;
  shopSlug: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  phone: string;
  email: string;
  reasonForRejection?: string;
  warehouseLocation: string;
  address: string;
  street: string;
  postalCode: string;
  logo: {
    public_id: string;
    url: string;
  };
  documentUrl: {
    public_id: string;
    url: string;
  }[];
  rating?: number;
  totalSales?: number;
  totalOrders?: number;
  isSuspended?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuery {
  page?: string;
  limit?: string;
  status?: 'pending' | 'approved' | 'rejected';
  sort?: '1day' | '7day' | 'atoz';
  search?: string;
}
