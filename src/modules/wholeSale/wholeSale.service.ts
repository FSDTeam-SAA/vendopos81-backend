/* eslint-disable prefer-const */
import mongoose, { Types } from "mongoose";
import AppError from "../../errors/AppError";
import checkProductsExist from "../../lib/checkProductExist";
import { IGetWholesaleParams } from "../../lib/globalType";
import Product from "../product/product.model";
import { IWholesale } from "./wholeSale.interface";
import Wholesale from "./wholeSale.model";

const addWholeSale = async (payload: IWholesale) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (!payload.type) {
      throw new AppError("Wholesale type is required", 400);
    }

    let productIdsToUpdate: Types.ObjectId[] = [];

    switch (payload.type) {
      /* ===================== CASE ===================== */
      case "case": {
        if (!payload.caseItems || payload.caseItems.length === 0) {
          throw new AppError("You must provide at least one case item", 400);
        }

        const ids = payload.caseItems.map((i) => i.productId.toString());

        if (new Set(ids).size !== ids.length) {
          throw new AppError("Duplicate product found in case items", 400);
        }

        const exists = await Wholesale.findOne(
          {
            type: "case",
            "caseItems.productId": { $in: ids },
          },
          null,
          { session }
        );

        if (exists) {
          throw new AppError("Product already exists in case wholesale", 409);
        }

        await checkProductsExist(ids.map((id) => new Types.ObjectId(id)));

        payload.caseItems = payload.caseItems.map((item) => {
          const pid = new Types.ObjectId(item.productId);
          productIdsToUpdate.push(pid);
          return { ...item, productId: pid };
        });

        break;
      }

      /* ===================== PALLET ===================== */
      case "pallet": {
        if (!payload.palletItems || payload.palletItems.length === 0) {
          throw new AppError("You must provide at least one pallet", 400);
        }

        const ids = payload.palletItems.flatMap((p) =>
          p.items.map((i) => i.productId.toString())
        );

        if (new Set(ids).size !== ids.length) {
          throw new AppError("Duplicate product found in pallet items", 400);
        }

        const exists = await Wholesale.findOne(
          {
            type: "pallet",
            "palletItems.items.productId": { $in: ids },
          },
          null,
          { session }
        );

        if (exists) {
          throw new AppError("Product already exists in pallet wholesale", 409);
        }

        await checkProductsExist(ids.map((id) => new Types.ObjectId(id)));

        payload.palletItems = payload.palletItems.map((pallet) => ({
          ...pallet,
          items: pallet.items.map((item) => {
            const pid = new Types.ObjectId(item.productId);
            productIdsToUpdate.push(pid);
            return { ...item, productId: pid };
          }),
        }));

        break;
      }

      /* ===================== FAST MOVING ===================== */
      case "fastMoving": {
        if (!payload.fastMovingItems || payload.fastMovingItems.length === 0) {
          throw new AppError(
            "You must provide at least one fast moving item",
            400
          );
        }

        const ids = payload.fastMovingItems.map((i) => i.productId.toString());

        if (new Set(ids).size !== ids.length) {
          throw new AppError(
            "Duplicate product found in fast moving items",
            400
          );
        }

        const exists = await Wholesale.findOne(
          {
            type: "fastMoving",
            "fastMovingItems.productId": { $in: ids },
          },
          null,
          { session }
        );

        if (exists) {
          throw new AppError(
            "Product already exists in fast moving wholesale",
            409
          );
        }

        await checkProductsExist(ids.map((id) => new Types.ObjectId(id)));

        payload.fastMovingItems = payload.fastMovingItems.map((item) => {
          const pid = new Types.ObjectId(item.productId);
          productIdsToUpdate.push(pid);
          return { ...item, productId: pid };
        });

        break;
      }

      default:
        throw new AppError("Invalid wholesale type", 400);
    }

    /* ===================== CREATE WHOLESALE ===================== */
    const wholesale = await Wholesale.create([payload], { session });
    const wholesaleId = wholesale[0]._id;

    /* ===================== UPDATE PRODUCTS ===================== */
    await Product.updateMany(
      { _id: { $in: productIdsToUpdate } },
      {
        $addToSet: { wholesaleId: wholesaleId },
        $set: {
          isPallet: payload.type === "pallet",
          isCase: payload.type === "case",
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return wholesale[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllWholeSale = async ({
  type,
  page = 1,
  limit = 10,
}: IGetWholesaleParams) => {
  const filter: any = {};

  // 🔍 Type filter
  if (type) {
    filter.type = type;
  }

  throw new Error("Not implemented this one right now i think that...");

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Wholesale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Wholesale.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateWholeSale = async (id: string, payload: IWholesale) => {
  throw new Error(
    "without thinking ui i cannot do it properly. I know how i do it."
  );
};

const wholeSaleService = {
  addWholeSale,
  getAllWholeSale,
  updateWholeSale,
};

export default wholeSaleService;
