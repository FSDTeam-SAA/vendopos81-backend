import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import Product from "../product/product.model";
import { User } from "../user/user.model";
import Cart from "./cart.model";

interface AddToCartPayload {
  productId: string;
  variantId?: string; 
  wholesaleId?: string; 
  quantity: number;
}

const addToCart = async (email: string, payload: AddToCartPayload) => {
  // 1️⃣ Find user
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

  // 2️⃣ Find product and populate wholesale
  const product = await Product.findById(payload.productId)
    .populate("wholesaleId") // <-- populate to get full wholesale objects
    .lean();

  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  let unitPrice = 0;
  let originalPrice = 0;
  let discount = 0;
  let unit = "";
  let variantLabel = "";
  let wholesaleLabel = "";

  // 3️⃣ If variant selected
  if (payload.variantId) {
    const variant = product.variants.find(
      (v: any) => v._id.toString() === payload.variantId
    );
    if (!variant)
      throw new AppError("Variant not found", StatusCodes.NOT_FOUND);

    unitPrice = variant.discountPrice || variant.price;
    originalPrice = variant.price;
    discount = variant.discount || 0;
    unit = variant.unit;
    variantLabel = variant.label;
  }

  // 4️⃣ If wholesale selected
  else if (payload.wholesaleId) {
    const wholesale = (product.wholesaleId as any[]).find(
      (w) => w._id.toString() === payload.wholesaleId
    );

    if (!wholesale)
      throw new AppError("Wholesale not found", StatusCodes.NOT_FOUND);

    // CASE type
    if (wholesale.type === "case") {
      const caseItem = wholesale.caseItems.find(
        (item: any) => item.productId.toString() === product._id.toString()
      );
      if (!caseItem)
        throw new AppError("Case item not found", StatusCodes.NOT_FOUND);

      unitPrice =
        caseItem.price - (caseItem.price * (caseItem.discount || 0)) / 100;
      originalPrice = caseItem.price;
      discount = caseItem.discount || 0;
      unit = "case";
      wholesaleLabel = wholesale.label;
    }

    // PALLET type
    else if (wholesale.type === "pallet") {
      const pallet = wholesale.palletItems.find((p: any) =>
        p.items.find(
          (i: any) => i.productId.toString() === product._id.toString()
        )
      );
      if (!pallet)
        throw new AppError("Pallet item not found", StatusCodes.NOT_FOUND);

      const item = pallet.items.find(
        (i: any) => i.productId.toString() === product._id.toString()
      );

      unitPrice = pallet.price / pallet.totalCases; // price per case
      originalPrice = unitPrice;
      discount = 0; // pallet discount not applied individually
      unit = "pallet";
      wholesaleLabel = wholesale.label;
    }
  } else {
    // No variant / wholesale → retail price
    unitPrice = product.priceFrom || 0;
    originalPrice = unitPrice;
    discount = 0;
    unit = "unit";
  }

  // 5️⃣ Total price
  const totalPrice = unitPrice * payload.quantity;

  // 6️⃣ Check existing cart
  const existingCart = await Cart.findOne({
    userId: user._id,
    productId: product._id,
    variantId: payload.variantId || null,
    wholesaleId: payload.wholesaleId || null,
  });

  if (existingCart) {
    existingCart.quantity += payload.quantity;
    existingCart.price = existingCart.quantity * unitPrice;
    await existingCart.save();
    return existingCart;
  }

  // 7️⃣ Create cart item
  const cartItem = await Cart.create({
    userId: user._id,
    productId: product._id,
    variantId: payload.variantId || undefined,
    wholesaleId: payload.wholesaleId || undefined,
    quantity: payload.quantity,
    price: totalPrice,
    originalPrice,
    discount,
    unit,
    variantLabel,
    wholesaleLabel,
  });

  return cartItem;
};



const getMyCart = async (email: string) => {};

const cartService = {
  addToCart,
  getMyCart,
};

export default cartService;
