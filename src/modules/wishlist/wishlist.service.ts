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

const getMyWishlist = async (email: string, page = 1, limit = 10) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  const skip = (page - 1) * limit;

  const [wishlists, total] = await Promise.all([
    Wishlist.find({ userId: user._id })
      .populate({
        path: "productId",
        populate: {
          path: "wholesaleId",
        },
      })
      .skip(skip)
      .limit(limit)
      .lean(),
    Wishlist.countDocuments({ userId: user._id }),
  ]);

  const formattedProducts = wishlists.map((wishlist: any) => {
    const product = wishlist.productId;
    const productId = product._id.toString();

    const wholesales = (product.wholesaleId || [])
      .map((wh: any) => {
        if (wh.type === "case") {
          const caseItems = wh.caseItems.filter(
            (item: any) => item.productId.toString() === productId,
          );
          if (caseItems.length === 0) return null;
          return { ...wh, caseItems };
        }

        if (wh.type === "pallet") {
          const palletItems = wh.palletItems
            .map((pallet: any) => {
              const items = pallet.items.filter(
                (item: any) => item.productId.toString() === productId,
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

    const { variants, priceFrom, ...restProduct } = product;

    return {
      _id: wishlist._id,
      product: {
        ...restProduct,
        wholesaleId: wholesales,
      },
    };
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: formattedProducts,
  };
};

const deletedFromWishlist = async (email: string, id: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  const isWishlistExist = await Wishlist.findOne({ _id: id, userId: user._id });
  if (!isWishlistExist) {
    throw new AppError("Wishlist not found", StatusCodes.NOT_FOUND);
  }

  await Wishlist.findByIdAndDelete(id);
};

const wishlistService = {
  addToWishlist,
  getMyWishlist,
  deletedFromWishlist,
};

export default wishlistService;