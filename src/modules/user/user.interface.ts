import { Model, Types } from "mongoose";
import { USER_ROLE } from "./user.constant";

export interface IUser {
  userId: any;
  id: any;
  _id: string;
  supplierId?: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  street: string;
  location: string;
  postalCode: string;
  dateOfBirth: Date;
  role: "customer" | "admin" | "supplier" | "driver";
  image: {
    public_id: string;
    url: string;
  };
  isVerified: boolean;
  isSuspended: boolean;
  otp?: string | null;
  otpExpires?: Date | null;
  resetPasswordOtp?: string | null;
  resetPasswordOtpExpires?: Date | null;
  stripeAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  stripeOnboardingCompleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface userModel extends Model<IUser> {
  isPasswordMatch(password: string, hashedPassword: string): Promise<boolean>;
  isUserExistByEmail(email: string): Promise<IUser | null>;
  isUserExistById(_id: string): Promise<IUser | null>;
}

export type TUserRole = keyof typeof USER_ROLE;
