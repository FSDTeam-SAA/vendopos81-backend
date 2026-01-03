import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import Product from "../product/product.model";
import { User } from "../user/user.model";
import Cart from "./cart.model";
import Wholesale from "../wholeSale/wholeSale.model";

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
        p.items.some(
          (i: any) => i.productId.toString() === product._id.toString()
        )
      );

      if (!pallet)
        throw new AppError("Pallet item not found", StatusCodes.NOT_FOUND);

      // ✅ FIXED LOGIC
      unitPrice = pallet.price; // 🔥 FULL PALLET PRICE
      originalPrice = pallet.price;
      discount = 0;
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

const getMyCart = async (email: string, page = 1, limit = 10) => {
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

  const skip = (page - 1) * limit;

  // ✅ total count
  const total = await Cart.countDocuments({ userId: user._id });

  const cartItems = await Cart.find({ userId: user._id })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "productId",
      select: "title slug images priceFrom variants",
    })
    .populate({
      path: "wholesaleId",
      select: "label type",
    })
    .sort({ createdAt: -1 })
    .lean();

  const formattedCart = cartItems.map((item: any) => {
    let variant = null;

    // ✅ manual variant resolve
    if (item.variantId && item.productId?.variants) {
      variant = item.productId.variants.find(
        (v: any) => v._id.toString() === item.variantId.toString()
      );
    }

    return {
      _id: item._id,
      userId: item.userId,

      productId: {
        _id: item.productId._id,
        title: item.productId.title,
        slug: item.productId.slug,
        images: item.productId.images,
        priceFrom: item.productId.priceFrom,
      },

      variantId: item.variantId || null,
      variant: variant
        ? {
            _id: variant._id,
            label: variant.label,
            price: variant.price,
            discount: variant.discount || 0,
            unit: variant.unit,
          }
        : null,

      wholesaleId: item.wholesaleId || null,

      quantity: item.quantity,
      price: item.price,

      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: formattedCart,
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
  if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

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

  const updatedCart = await Cart.findByIdAndUpdate(
    cartId,
    {
      $inc: { quantity: increaseBy },
      $set: { price: newPrice },
    },
    { new: true }
  );

  return updatedCart;
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
  const updatedCart = await Cart.findByIdAndUpdate(
    cartId,
    {
      $set: {
        quantity: newQuantity,
        price: newPrice,
      },
    },
    { new: true }
  );

  return updatedCart;
};



const cartService = {
  addToCart,
  getMyCart,
  increaseProductQuantity,
  decreaseProductQuantity,
};

export default cartService;
