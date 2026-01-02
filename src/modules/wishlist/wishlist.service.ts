import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import Product from "../product/product.model";
import { User } from "../user/user.model";
import Wishlist from "./wishlist.model";

const addToWishlist = async (email: string, productId: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  const isProductExist = await Product.findById(productId);
  if (!isProductExist) {
    throw new AppError("Product not found", StatusCodes.NOT_FOUND);
  }

  const result = await Wishlist.create({ userId: user._id, productId });
  return result;
};


const getMyWishlist = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  const wishlists = await Wishlist.find({ userId: user._id })
    .populate({
      path: "productId",
      populate: {
        path: "wholesaleId",
      },
    })
    .lean();

  const formattedProducts = wishlists.map((wishlist: any) => {
    const product = wishlist.productId;
    const productId = product._id.toString();

    const wholesales = (product.wholesaleId || [])
      .map((wh: any) => {
        if (wh.type === "case") {
          const caseItems = wh.caseItems.filter(
            (item: any) => item.productId.toString() === productId
          );
          if (caseItems.length === 0) return null;
          return { ...wh, caseItems };
        }

        if (wh.type === "pallet") {
          const palletItems = wh.palletItems
            .map((pallet: any) => {
              const items = pallet.items.filter(
                (item: any) => item.productId.toString() === productId
              );
              if (items.length === 0) return null;
              return { ...pallet, items };
            })
            .filter(Boolean);

          if (palletItems.length === 0) return null;

          return { ...wh, palletItems };
        }

        return null;
      })
      .filter(Boolean);

    
    if (wholesales.length > 0) {
      const { variants, priceFrom, ...restProduct } = product;
      return {
        ...restProduct,
        wholesaleId: wholesales,
      };
    }

    return { ...product, wholesaleId: [] };
  });

  return formattedProducts;
};

const wishlistService = {
  addToWishlist,
  getMyWishlist,
};

export default wishlistService;
