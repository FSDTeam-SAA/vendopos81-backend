/* eslint-disable no-case-declarations */
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import checkProductsExist from "../../lib/checkProductExist";
import { IWholesale } from "./wholeSale.interface";
import Wholesale from "./wholeSale.model";

const addWholeSale = async (payload: IWholesale) => {
  if (!payload.type) throw new AppError("Wholesale type is required", 400);

  switch (payload.type) {
    case "case":
      if (!payload.caseItems || payload.caseItems.length === 0) {
        throw new AppError("You must provide at least one case item", 400);
      }

      const caseProductIds = [
        ...new Set(payload.caseItems.map((i) => i.productId.toString())),
      ].map((id) => new Types.ObjectId(id));

      await checkProductsExist(caseProductIds);

      payload.caseItems = payload.caseItems.map((item) => ({
        ...item,
        productId: new Types.ObjectId(item.productId),
      }));
      break;

    case "pallet":
      if (!payload.palletItems || payload.palletItems.length === 0) {
        throw new AppError("You must provide at least one pallet", 400);
      }

      const palletProductIds = [
        ...new Set(
          payload.palletItems.flatMap((p) =>
            p.items.map((i) => i.productId.toString())
          )
        ),
      ].map((id) => new Types.ObjectId(id));

      await checkProductsExist(palletProductIds);

      payload.palletItems = payload.palletItems.map((pallet) => ({
        ...pallet,
        items: pallet.items.map((item) => ({
          ...item,
          productId: new Types.ObjectId(item.productId),
        })),
      }));
      break;

    case "fastMoving":
      if (!payload.fastMovingItems || payload.fastMovingItems.length === 0) {
        throw new AppError(
          "You must provide at least one fast moving item",
          400
        );
      }

      const fastProductIds = [
        ...new Set(payload.fastMovingItems.map((i) => i.productId.toString())),
      ].map((id) => new Types.ObjectId(id));

      await checkProductsExist(fastProductIds);

      payload.fastMovingItems = payload.fastMovingItems.map((item) => ({
        ...item,
        productId: new Types.ObjectId(item.productId),
      }));
      break;

    default:
      throw new AppError("Invalid wholesale type", 400);
  }

  // Create wholesale record
  const result = await Wholesale.create(payload);

  return result;
};

const wholeSaleService = {
  addWholeSale,
};

export default wholeSaleService;
