import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import Product from "../product/product.model";
import { User } from "../user/user.model";
import Wholesale from "../wholeSale/wholeSale.model";
import Cart from "./cart.model";

interface AddToCartPayload {
  productId: string;
  variantId?: string;
  wholesaleId?: string;
  quantity: number;
}

const addToCart = async (email: string, payload: AddToCartPayload) => {
  // 1️⃣ User
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

  // 2️⃣ Product
  const product: any = await Product.findById(payload.productId)
    .populate("wholesaleId")
    .lean();

  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  let unitPrice = 0;
  let originalPrice = 0;
  let discount = 0;
  let unit = "";
  let variantLabel = "";
  let wholesaleLabel = "";

  /**
   * ================= VARIANT =================
   */
  if (payload.variantId) {
    const variant = product.variants?.find(
      (v: any) => v._id.toString() === payload.variantId!.toString()
    );

    if (!variant)
      throw new AppError("Variant not found", StatusCodes.NOT_FOUND);

    unitPrice = Number(variant.discountPrice ?? variant.price);
    originalPrice = Number(variant.price);
    discount = Number(variant.discount || 0);
    unit = variant.unit;
    variantLabel = variant.label;
  } else if (payload.wholesaleId) {

  /**
   * ================= WHOLESALE =================
   */
    const wholesale = product.wholesaleId?.find(
      (w: any) => w._id.toString() === payload.wholesaleId!.toString()
    );

    if (!wholesale)
      throw new AppError("Wholesale not found", StatusCodes.NOT_FOUND);

    wholesaleLabel = wholesale.label;

    // CASE
    if (wholesale.type === "case") {
      const caseItem = wholesale.caseItems?.find(
        (i: any) => i.productId.toString() === product._id.toString()
      );

      if (!caseItem)
        throw new AppError("Case item not found", StatusCodes.NOT_FOUND);

      originalPrice = Number(caseItem.price);
      discount = Number(caseItem.discount || 0);
      unitPrice = Number((originalPrice * (1 - discount / 100)).toFixed(2));
      unit = "case";
    }

    // PALLET
    else if (wholesale.type === "pallet") {
      const pallet = wholesale.palletItems?.find((p: any) =>
        p.items?.some(
          (i: any) => i.productId.toString() === product._id.toString()
        )
      );

      if (!pallet)
        throw new AppError("Pallet item not found", StatusCodes.NOT_FOUND);

      originalPrice = Number(pallet.price);
      unitPrice = Number(pallet.price);
      discount = 0;
      unit = "pallet";
    }
  } else {

  /**
   * ================= RETAIL =================
   */
    unitPrice = Number(product.priceFrom || 0);
    originalPrice = unitPrice;
    discount = 0;
    unit = "unit";
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0)
    throw new AppError("Invalid price calculated", StatusCodes.BAD_REQUEST);

  // 5️⃣ Total
  const totalPrice = Number((unitPrice * payload.quantity).toFixed(2));

  /**
   * ================= EXISTING CART =================
   */
  const existingCart = await Cart.findOne({
    userId: user._id,
    productId: product._id,
    ...(payload.variantId && { variantId: payload.variantId }),
    ...(payload.wholesaleId && { wholesaleId: payload.wholesaleId }),
  });

  if (existingCart) {
    existingCart.quantity += payload.quantity;
    existingCart.price = Number((existingCart.quantity * unitPrice).toFixed(2));
    await existingCart.save();
    return existingCart;
  }

  /**
   * ================= CREATE =================
   */
  const cartItem = await Cart.create({
    userId: user._id,
    productId: product._id,
    ...(payload.variantId && { variantId: payload.variantId }),
    ...(payload.wholesaleId && { wholesaleId: payload.wholesaleId }),
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


const getMyCart = async (email: string, page = 1, limit = 10) => {
  const user = await User.findOne({ email }).lean();
  if (!user) throw new Error("User not found");

  const total = await Cart.countDocuments({ userId: user._id });
  const totalPage = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const cartItems = await Cart.find({ userId: user._id })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "productId",
      select: "title slug images priceFrom variants",
    })
    .populate({
      path: "wholesaleId",
      select: `
        type label isActive
        caseItems
        palletItems
        fastMovingItems
      `,
    })
    .lean();

  const formattedCart = cartItems
    .map((item: any) => {
      if (!item.productId) return null;

      /** ---------------- VARIANT ---------------- */
      let variant = null;
      if (item.variantId && Array.isArray(item.productId.variants)) {
        variant = item.productId.variants.find(
          (v: any) => String(v._id) === String(item.variantId)
        );
      }

      /** ---------------- WHOLESALE ---------------- */
      let wholesaleData = null;

      if (item.wholesaleId) {
        const wholesale = item.wholesaleId;
        let wholesaleItem: any = null;

        if (wholesale.type === "case" && Array.isArray(wholesale.caseItems)) {
          wholesaleItem = wholesale.caseItems.find(
            (ci: any) => String(ci.productId) === String(item.productId._id)
          );
        }

        if (
          wholesale.type === "pallet" &&
          Array.isArray(wholesale.palletItems)
        ) {
          for (const pallet of wholesale.palletItems) {
            const found = pallet.items?.find(
              (pi: any) => String(pi.productId) === String(item.productId._id)
            );
            if (found) {
              wholesaleItem = {
                ...found,
                palletName: pallet.palletName,
                totalCases: pallet.totalCases,
                estimatedWeight: pallet.estimatedWeight,
                isMixed: pallet.isMixed,
              };
              break;
            }
          }
        }

        if (
          wholesale.type === "fastMoving" &&
          Array.isArray(wholesale.fastMovingItems)
        ) {
          wholesaleItem = wholesale.fastMovingItems.find(
            (fi: any) => String(fi.productId) === String(item.productId._id)
          );
        }

        wholesaleData = {
          _id: wholesale._id,
          type: wholesale.type,
          label: wholesale.label,
          isActive: wholesale.isActive,
          item: wholesaleItem
            ? {
                productId: wholesaleItem.productId,
                quantity:
                  wholesaleItem.quantity ?? wholesaleItem.caseQuantity ?? 0,
                price: wholesaleItem.price ?? 0,
                discount: wholesaleItem.discount ?? 0,
                ...(wholesale.type === "pallet" && {
                  palletName: wholesaleItem.palletName,
                  totalCases: wholesaleItem.totalCases,
                  estimatedWeight: wholesaleItem.estimatedWeight,
                  isMixed: wholesaleItem.isMixed,
                }),
              }
            : null,
        };
      }

      /** ---------------- FINAL RESPONSE ---------------- */
      return {
        _id: item._id,
        userId: item.userId,
        product: {
          _id: item.productId._id,
          title: item.productId.title,
          slug: item.productId.slug,
          images: item.productId.images,
          priceFrom: item.productId.priceFrom ?? 0,
        },
        variant: variant
          ? {
              _id: variant._id,
              label: variant.label,
              price: variant.price,
              discount: variant.discount ?? 0,
              unit: variant.unit,
            }
          : null,
        wholesale: wholesaleData,
        quantity: item.quantity,
        price: Number((item.price ?? 0).toFixed(2)),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    })
    .filter(Boolean); // remove nulls

  return {
    data: formattedCart,
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
  };
};


const increaseProductQuantity = async (
  email: string,
  increaseBy: number,
  cartId: string
) => {
  if (increaseBy <= 0) {
    throw new AppError(
      "Increase quantity must be greater than 0",
      StatusCodes.BAD_REQUEST
    );
  }

  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

  const cart = await Cart.findById(cartId);
  if (!cart) throw new AppError("Cart not found", StatusCodes.NOT_FOUND);

  // 🔐 ownership check
  if (cart.userId.toString() !== user._id.toString()) {
    throw new AppError("Unauthorized access", StatusCodes.FORBIDDEN);
  }

  const product = await Product.findById(cart.productId).populate(
    "wholesaleId"
  );
  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  let unitPrice = 0;

  /* ======================
     ✅ VARIANT PRICE
  ====================== */
  if (cart.variantId) {
    const variant = product.variants.find(
      (v: any) => v._id.toString() === cart.variantId!.toString()
    );

    if (!variant)
      throw new AppError("Variant not found", StatusCodes.NOT_FOUND);

    unitPrice =
      variant.discountPrice && variant.discountPrice > 0
        ? variant.discountPrice
        : variant.price;
  } else if (cart.wholesaleId) {
    /* ======================
     ✅ WHOLESALE PRICE
  ====================== */
    const wholesale = (product.wholesaleId as any[]).find(
      (w) => w._id.toString() === cart.wholesaleId!.toString()
    );

    if (!wholesale)
      throw new AppError("Wholesale not found", StatusCodes.NOT_FOUND);

    // 👉 CASE type
    if (wholesale.type === "case") {
      const caseItem = wholesale.caseItems.find(
        (item: any) => item.productId.toString() === product._id.toString()
      );

      if (!caseItem)
        throw new AppError("Case item not found", StatusCodes.NOT_FOUND);

      unitPrice =
        caseItem.price - (caseItem.price * (caseItem.discount || 0)) / 100;
    }

    // 👉 PALLET type
    else if (wholesale.type === "pallet") {
      const pallet = wholesale.palletItems.find((p: any) =>
        p.items.some(
          (i: any) => i.productId.toString() === product._id.toString()
        )
      );

      if (!pallet)
        throw new AppError("Pallet item not found", StatusCodes.NOT_FOUND);

      // 🔑 pallet এর total price ধরেই quantity বাড়ে
      unitPrice = pallet.price;
    } else {
      throw new AppError("Invalid wholesale type", StatusCodes.BAD_REQUEST);
    }
  } else {
    throw new AppError("Invalid cart item type", StatusCodes.BAD_REQUEST);
  }

  /* ======================
     ✅ INCREMENT QUANTITY
  ====================== */
  const newQuantity = cart.quantity + increaseBy;
  const newPrice = unitPrice * newQuantity;

  await Cart.findByIdAndUpdate(
    cartId,
    {
      $inc: { quantity: increaseBy },
      $set: { price: newPrice },
    },
    { new: true }
  );
};

const decreaseProductQuantity = async (
  email: string,
  decreaseBy: number,
  cartId: string
) => {
  if (decreaseBy <= 0) {
    throw new AppError(
      "Decrease quantity must be greater than 0",
      StatusCodes.BAD_REQUEST
    );
  }

  // 1️⃣ Find user
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

  // 2️⃣ Find cart
  const cart = await Cart.findById(cartId);
  if (!cart) throw new AppError("Cart not found", StatusCodes.NOT_FOUND);

  // 🔐 Ownership check
  if (cart.userId.toString() !== user._id.toString()) {
    throw new AppError("Unauthorized access", StatusCodes.FORBIDDEN);
  }

  // 3️⃣ Find product
  const product = await Product.findById(cart.productId);
  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  let unitPrice = 0;

  /* ======================
     ✅ VARIANT PRICE
  ====================== */
  if (cart.variantId) {
    const variant = product.variants.find(
      (v: any) => v._id.toString() === cart.variantId!.toString()
    );

    if (!variant)
      throw new AppError("Variant not found", StatusCodes.NOT_FOUND);

    unitPrice =
      variant.discountPrice && variant.discountPrice > 0
        ? variant.discountPrice
        : variant.price;
  } else if (cart.wholesaleId) {
    /* ======================
     ✅ WHOLESALE PRICE
  ====================== */
    const wholesale = await Wholesale.findById(cart.wholesaleId);
    if (!wholesale)
      throw new AppError("Wholesale not found", StatusCodes.NOT_FOUND);

    // 🟢 CASE
    if (wholesale.type === "case") {
      const caseItem = wholesale.caseItems!.find(
        (item: any) => item.productId.toString() === product._id.toString()
      );
      if (!caseItem)
        throw new AppError("Case item not found", StatusCodes.NOT_FOUND);

      unitPrice =
        caseItem.price - (caseItem.price * (caseItem.discount || 0)) / 100;
    }

    // 🟢 PALLET
    else if (wholesale.type === "pallet") {
      const pallet = wholesale.palletItems!.find((p: any) =>
        p.items.some(
          (i: any) => i.productId.toString() === product._id.toString()
        )
      );
      if (!pallet)
        throw new AppError("Pallet item not found", StatusCodes.NOT_FOUND);

      unitPrice = pallet.price; // full pallet price
    }
  } else {
    throw new AppError("Invalid cart item type", StatusCodes.BAD_REQUEST);
  }

  /* ======================
     ✅ CALCULATE NEW QTY
  ====================== */
  const newQuantity = cart.quantity - decreaseBy;

  // 🧹 Quantity <= 0 → remove cart item
  if (newQuantity <= 0) {
    await Cart.findByIdAndDelete(cartId);
    return { message: "Cart item removed successfully" };
  }

  const newPrice = unitPrice * newQuantity;

  /* ======================
     ✅ UPDATE CART
  ====================== */
  await Cart.findByIdAndUpdate(
    cartId,
    {
      $set: {
        quantity: newQuantity,
        price: newPrice,
      },
    },
    { new: true }
  );
};

const removeProductFromCart = async (email: string, cartId: string) => {
  // 1️⃣ Find user
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

  // 2️⃣ Find cart
  const cart = await Cart.findById(cartId);
  if (!cart) throw new AppError("Cart not found", StatusCodes.NOT_FOUND);

  // 🔐 Ownership check
  if (cart.userId.toString() !== user._id.toString()) {
    throw new AppError("Unauthorized access", StatusCodes.FORBIDDEN);
  }

  // 3️⃣ Delete cart item
  await Cart.findByIdAndDelete(cartId);
};

const cartService = {
  addToCart,
  getMyCart,
  increaseProductQuantity,
  decreaseProductQuantity,
  removeProductFromCart,
};

export default cartService;
