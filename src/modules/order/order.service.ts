/* eslint-disable prefer-const */
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import { decreaseInventory } from "../../lib/decreaseInventory";
import Cart from "../cart/cart.model";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import Product from "../product/product.model";
import { User } from "../user/user.model";
import Order from "./order.model";

const createOrder = async (payload: any, email: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // User check
    const user = await User.findOne({ email }).session(session);
    if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

    let items: any[] = [];
    let totalPrice = 0;

    // ========== ORDER FROM CART ==========
    if (payload.orderType === "addToCart") {
      const cartItems = await Cart.find({ userId: user._id })
        .populate({ path: "productId" })
        .session(session);

      if (!cartItems.length) throw new AppError("Cart is empty", 400);

      for (const item of cartItems) {
        const product = item.productId as any;
        const unitPrice = item.price;

        const orderItem = {
          productId: product._id,
          supplierId: product.supplierId,
          quantity: item.quantity,
          unitPrice,
          ...(item.variantId && { variantId: item.variantId }),
          ...(item.wholesaleId && { wholesaleId: item.wholesaleId }),
        };

        // Decrease stock
        await decreaseInventory(orderItem, session);

        items.push(orderItem);
        totalPrice += unitPrice * item.quantity;
      }
    }

    // ========== SINGLE ORDER ==========
    if (payload.orderType === "single") {
      for (const item of payload.items) {
        const product = await Product.findById(item.productId)
          // .populate("supplierId")
          .populate("wholesaleId")
          .session(session);

        if (!product) throw new AppError("Product not found", 404);

        let unitPrice = 0;

        // Variant
        if (item.variantId) {
          const variant = product.variants?.find(
            (v: any) => v._id.toString() === item.variantId.toString()
          );
          if (!variant) throw new AppError("Invalid variant", 400);
          unitPrice = variant.price;
        }

        // Wholesale
        if (item.wholesaleId) {
          const wholesale: any = product.wholesaleId?.find(
            (w: any) => w._id.toString() === item.wholesaleId.toString()
          );
          if (!wholesale) throw new AppError("Invalid wholesale", 400);

          if (wholesale.type === "case") {
            const caseItem = wholesale.caseItems.find(
              (c: any) => c.productId.toString() === product._id.toString()
            );
            if (!caseItem) throw new AppError("Invalid case item", 400);
            unitPrice = caseItem.price;
          }

          if (wholesale.type === "pallet") {
            const pallet = wholesale.palletItems[0];
            if (!pallet) throw new AppError("Invalid pallet", 400);
            unitPrice = pallet.price;
          }
        }

        if (!unitPrice) throw new AppError("Cannot calculate price", 400);

        const orderItem = {
          productId: product._id,
          supplierId: product.supplierId,
          quantity: item.quantity,
          unitPrice,
          ...(item.variantId && { variantId: item.variantId }),
          ...(item.wholesaleId && { wholesaleId: item.wholesaleId }),
        };

        await decreaseInventory(orderItem, session);

        items.push(orderItem);
        totalPrice += unitPrice * item.quantity;
      }
    }

    // ========== CREATE ORDER ==========
    const order = await Order.create(
      [
        {
          userId: user._id,
          orderType: payload.orderType,
          paymentType: payload.paymentType,
          items,
          totalPrice,
          billingInfo: payload.billingInfo,
        },
      ],
      { session }
    );

    // !Clear cart if needed____________________________
    if (payload.orderType === "addToCart") {
      await Cart.deleteMany({ userId: user._id }).session(session);
    }

    await session.commitTransaction();
    session.endSession();

    return order[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const getMyOrders = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND);
  }

  const orders = await Order.find({ userId: user._id })
    .populate({
      path: "userId",
      select: "firstName lastName email",
    })
    .populate({
      path: "items.productId",
      select: "title slug images variants",
    })
    .populate({
      path: "items.wholesaleId",
      select: "type label caseItems palletItems fastMovingItems",
    })
    .populate({
      path: "items.supplierId", // ✅ FIXED
      select: "shopName brandName logo email",
    })
    .sort({ createdAt: -1 })
    .lean();

  const formattedOrders = orders.map((order) => ({
    _id: order._id,
    orderUniqueId: order.orderUniqueId,
    userId: order.userId,
    orderType: order.orderType,
    paymentType: order.paymentType,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    totalPrice: order.totalPrice,
    billingInfo: order.billingInfo,
    purchaseDate: order.purchaseDate,

    items: order.items.map((item: any) => {
      // ======================
      // 🟢 PRODUCT (MINIMAL)
      // ======================
      const product = item.productId
        ? {
            _id: item.productId._id,
            title: item.productId.title,
            slug: item.productId.slug,
            images: item.productId.images,
          }
        : null;

      // 🟢 SUPPLIER (NOW POPULATED ✅)
      const supplier = item.supplierId
        ? {
            _id: item.supplierId._id,
            shopName: item.supplierId.shopName,
            brandName: item.supplierId.brandName,
            logo: item.supplierId.logo,
          }
        : null;
      // ======================
      // 🟢 VARIANT (ONLY IF EXISTS)
      // ======================
      let variant = null;
      if (item.variantId && item.productId?.variants) {
        const v = item.productId.variants.find(
          (x: any) => x._id.toString() === item.variantId.toString()
        );

        if (v) {
          variant = {
            _id: v._id,
            label: v.label,
            price: v.price,
            discount: v.discount || 0,
            unit: v.unit,
          };
        }
      }

      // ======================
      // 🟢 WHOLESALE (ONLY SELECTED ITEM)
      // ======================
      let wholesale = null;
      if (item.wholesaleId) {
        const w = item.wholesaleId;
        let selectedItem = null;

        if (w.type === "case") {
          selectedItem = w.caseItems?.find(
            (ci: any) =>
              ci.productId.toString() === item.productId._id.toString()
          );
        }

        if (w.type === "pallet") {
          selectedItem = w.palletItems?.[0];
        }

        wholesale = {
          _id: w._id,
          type: w.type,
          label: w.label,
          item: selectedItem
            ? {
                quantity: selectedItem.quantity,
                price: selectedItem.price,
                discount: selectedItem.discount || 0,
              }
            : null,
        };
      }

      return {
        product,
        supplier,
        variant,
        wholesale,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    }),
  }));

  return formattedOrders;
};

const getAllOrdersForAdmin = async () => {
  const orders = await Order.find()
    .populate({
      path: "userId",
      select: "firstName lastName email",
    })
    .populate({
      path: "items.productId",
      select: "title slug images variants",
    })
    .populate({
      path: "items.wholesaleId",
      select: "type label caseItems palletItems fastMovingItems",
    })
    .populate({
      path: "items.supplierId", // ✅ FIXED
      select: "shopName brandName logo email",
    })
    .sort({ createdAt: -1 })
    .lean();

  const formattedOrders = orders.map((order) => ({
    _id: order._id,
    orderUniqueId: order.orderUniqueId,
    userId: order.userId,
    orderType: order.orderType,
    paymentType: order.paymentType,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    totalPrice: order.totalPrice,
    billingInfo: order.billingInfo,
    purchaseDate: order.purchaseDate,

    items: order.items.map((item: any) => {
      // ======================
      // 🟢 PRODUCT (MINIMAL)
      // ======================
      const product = item.productId
        ? {
            _id: item.productId._id,
            title: item.productId.title,
            slug: item.productId.slug,
            images: item.productId.images,
          }
        : null;

      const supplier = item.supplierId
        ? {
            _id: item.supplierId._id,
            shopName: item.supplierId.shopName,
            brandName: item.supplierId.brandName,
            logo: item.supplierId.logo,
          }
        : null;
      // ======================
      // 🟢 VARIANT (ONLY IF EXISTS)
      // ======================
      let variant = null;
      if (item.variantId && item.productId?.variants) {
        const v = item.productId.variants.find(
          (x: any) => x._id.toString() === item.variantId.toString()
        );

        if (v) {
          variant = {
            _id: v._id,
            label: v.label,
            price: v.price,
            discount: v.discount || 0,
            unit: v.unit,
          };
        }
      }

      // ======================
      // 🟢 WHOLESALE (ONLY SELECTED ITEM)
      // ======================
      let wholesale = null;
      if (item.wholesaleId) {
        const w = item.wholesaleId;
        let selectedItem = null;

        if (w.type === "case") {
          selectedItem = w.caseItems?.find(
            (ci: any) =>
              ci.productId.toString() === item.productId._id.toString()
          );
        }

        if (w.type === "pallet") {
          selectedItem = w.palletItems?.[0];
        }

        wholesale = {
          _id: w._id,
          type: w.type,
          label: w.label,
          item: selectedItem
            ? {
                quantity: selectedItem.quantity,
                price: selectedItem.price,
                discount: selectedItem.discount || 0,
              }
            : null,
        };
      }

      return {
        product,
        supplier,
        variant,
        wholesale,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    }),
  }));

  return formattedOrders;
};

const getOrderFormSupplier = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  // 2️⃣ supplier check
  const supplier = await JoinAsSupplier.findOne({ userId: user._id });
  if (!supplier) {
    throw new AppError(
      "You are not registered as a supplier",
      StatusCodes.FORBIDDEN
    );
  }

  // 3️⃣ find orders
  const orders = await Order.find({
    "items.supplierId": supplier._id,
  })
    .populate("userId", "firstName lastName email")
    .populate("items.productId", "title slug images")
    .populate("items.supplierId", "shopName brandName logo")
    .populate("items.variantId", "label price discount unit")
    .populate("items.wholesaleId", "type label")
    .sort({ createdAt: -1 })
    .lean();

  // 4️⃣ format response
  const formattedOrders = orders.map((order) => ({
    _id: order._id,
    orderUniqueId: order.orderUniqueId,
    user: order.userId,
    orderType: order.orderType,
    paymentType: order.paymentType,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    totalPrice: order.totalPrice,
    billingInfo: order.billingInfo,
    purchaseDate: order.purchaseDate,

    items: order.items
      .filter(
        (item) =>
          item.supplierId &&
          item.supplierId._id.toString() === supplier._id.toString()
      )
      .map((item) => {
        const wholesale =
          item.wholesaleId && typeof item.wholesaleId === "object"
            ? {
                _id: (item.wholesaleId as any)._id,
                type: (item.wholesaleId as any).type,
                label: (item.wholesaleId as any).label,
              }
            : null;

        return {
          product: item.productId,
          supplier: item.supplierId,
          variant: item.variantId || null,
          wholesale,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        };
      }),
  }));

  return formattedOrders;
};

const cancelMyOrder = async (orderId: string, email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }
};

const orderService = {
  createOrder,
  getMyOrders,
  getAllOrdersForAdmin,
  getOrderFormSupplier,
  cancelMyOrder,
};

export default orderService;
