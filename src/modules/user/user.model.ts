import bcrypt from "bcrypt";
import { model, Schema } from "mongoose";
import config from "../../config";
import { applyEncryption } from "../../middleware/encryptionMiddleware";
import { IUser, userModel } from "./user.interface";

const userSchema = new Schema<IUser>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
    },
    firstName: {
      type: String,
      // required: true,
    },
    lastName: {
      type: String,
      // required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
      // required: true,
    },
    street: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    postalCode: {
      type: String,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "supplier", "driver"],
      default: "customer",
    },
    image: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    resetPasswordOtp: { type: String, default: null },
    resetPasswordOtpExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        // extra safety layer
        delete ret.password;
        delete ret.otp;
        delete ret.otpExpires;
        delete ret.resetPasswordOtp;
        delete ret.resetPasswordOtpExpires;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function (next) {
  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcryptSaltRounds)
  );

  next();
});

userSchema.post("save", function (doc, next) {
  doc.password = "";
  next();
});

userSchema.statics.isPasswordMatch = async function (
  password: string,
  hashedPassword: string
) {
  return await bcrypt.compare(password, hashedPassword);
};

userSchema.statics.isUserExistByEmail = async function (
  email: string
): Promise<IUser | null> {
  return await User.findOne({ email });
};

userSchema.statics.isUserExistById = async function (
  _id: string
): Promise<IUser | null> {
  return await User.findOne({ _id });
};

applyEncryption(userSchema, ["phone", "street", "location", "postalCode"]);

export const User = model<IUser, userModel>("User", userSchema);
