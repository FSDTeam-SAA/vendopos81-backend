import generateShopSlug from "../../middleware/generateShopSlug";
import { User } from "../user/user.model";
import { IJoinAsSupplier } from "./joinAsSupplier.interface";
import JoinAsSupplier from "./joinAsSupplier.model";

const joinAsSupplier = async (email: string, payload: IJoinAsSupplier) => {
  const user = await User.isUserExistByEmail(email);

  if (!user) {
    throw new Error("Your account does not exist");
  }

  if (user.role === "supplier") {
    throw new Error("You are already a supplier");
  }

  const existingRequest = await JoinAsSupplier.findOne({
    userId: user._id,
  });

  if (existingRequest) {
    if (existingRequest.status === "pending") {
      throw new Error("Your supplier request is under review");
    }

    if (existingRequest.status === "approved") {
      throw new Error("You are already approved as a supplier");
    }
  }

  const shopSlug = generateShopSlug(payload.shopName);

  const slugExists = await JoinAsSupplier.findOne({ shopSlug });
  if (slugExists) {
    throw new Error("Shop name already exists, choose another name");
  }

  const result = await JoinAsSupplier.create({
    ...payload,
    shopSlug,
    userId: user._id,
    status: "pending",
  });

  return result;
};

const joinAsSupplierService = {
  joinAsSupplier,
};
export default joinAsSupplierService;
