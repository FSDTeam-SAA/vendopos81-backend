/* eslint-disable prefer-const */
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import { decreaseInventory } from "../../lib/decreaseInventory";
import { getOrderOwnership } from "../../lib/validators";
import Cart from "../cart/cart.model";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import Product from "../product/product.model";
import { User } from "../user/user.model";
import Wholesale from "../wholeSale/wholeSale.model";
import Order from "./order.model";

const createOrder = async (payload: any, email: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findOne({ email }).session(session);
    if (!user)
      throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

    if (!user.isVerified) {
      throw new AppError(
        "Please verify your account to place an order",
        StatusCodes.FORBIDDEN,
      );
    }

    if (user.isSuspended) {
      throw new AppError(
        "Account has been suspended. Contact support for help",
        StatusCodes.FORBIDDEN,
      );
    }

    let items: any[] = [];
    let totalPrice = 0;

    /* ================== ORDER FROM CART ================== */
    if (payload.orderType === "addToCart") {
      const cartItems = await Cart.find({ userId: user._id })
        .populate("productId")
        .session(session);

      if (!cartItems.length) {
        throw new AppError("Cart is empty", 400);
      }

      for (const item of cartItems) {
        const product: any = item.productId;
        const unitPrice = item.price;

        const orderItem = {
          productId: product._id,
          quantity: item.quantity,
          unitPrice,
          ...(item.variantId && { variantId: item.variantId }),
          ...(item.wholesaleId && { wholesaleId: item.wholesaleId }),
          ...getOrderOwnership(product),
        };

        await decreaseInventory(orderItem, session);

        items.push(orderItem);
        totalPrice += unitPrice * item.quantity;
      }
    }

    /* ================== SINGLE ORDER ================== */
    if (payload.orderType === "single") {
      for (const item of payload.items) {
        const product: any = await Product.findById(item.productId)
          .populate("wholesaleId")
          .session(session);

        if (!product) throw new AppError("Product not found", 404);

        let unitPrice = 0;

        // Variant price
        if (item.variantId) {
          const variant = product.variants?.find(
            (v: any) => v._id.toString() === item.variantId.toString(),
          );
          if (!variant) throw new AppError("Invalid variant", 400);
          unitPrice = variant.price;
        }

        // Wholesale price
        if (item.wholesaleId) {
          const wholesale: any = product.wholesaleId?.find(
            (w: any) => w._id.toString() === item.wholesaleId.toString(),
          );
          if (!wholesale) throw new AppError("Invalid wholesale", 400);

          if (wholesale.type === "case") {
            const caseItem = wholesale.caseItems.find(
              (c: any) => c.productId.toString() === product._id.toString(),
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
          quantity: item.quantity,
          unitPrice,
          ...(item.variantId && { variantId: item.variantId }),
          ...(item.wholesaleId && { wholesaleId: item.wholesaleId }),
          ...getOrderOwnership(product),
        };

        await decreaseInventory(orderItem, session);

        items.push(orderItem);
        totalPrice += unitPrice * item.quantity;
      }
    }

    /* ================== CREATE ORDER ================== */
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
      { session },
    );

    if (payload.orderType === "addToCart") {
      await Cart.deleteMany({ userId: user._id }).session(session);
    }

    await session.commitTransaction();
    session.endSession();

    return order[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getMyOrders = async (
  email: string,
  query: { page?: any; limit?: any; orderStatus?: any },
) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND);
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = { userId: user._id };

  if (query.orderStatus) {
    filter.orderStatus = query.orderStatus; // pending | delivered | cancelled
  }

  const orders = await Order.find(filter)
    .populate({ path: "userId", select: "firstName lastName email" })
    .populate({
      path: "items.productId",
      select: "title slug images variants",
    })
    .populate({
      path: "items.wholesaleId",
      select: "type label caseItems palletItems fastMovingItems",
    })
    .populate({
      path: "items.supplierId",
      select: "shopName brandName logo email",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Order.countDocuments(filter);

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

      const variant =
        item.variantId && item.productId?.variants
          ? (() => {
              const v = item.productId.variants.find(
                (x: any) => x._id.toString() === item.variantId.toString(),
              );
              return v
                ? {
                    _id: v._id,
                    label: v.label,
                    price: v.price,
                    discount: v.discount || 0,
                    unit: v.unit,
                  }
                : null;
            })()
          : null;

      const wholesale =
        item.wholesaleId && typeof item.wholesaleId === "object"
          ? {
              _id: item.wholesaleId._id,
              type: (item.wholesaleId as any).type,
              label: (item.wholesaleId as any).label,
            }
          : null;

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

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: formattedOrders,
  };
};

const getAllOrdersForAdmin = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (query.orderStatus) {
    filter.orderStatus = query.orderStatus;
  }

  if (query.paymentType) {
    filter.paymentType = query.paymentType;
  }

  const orders = await Order.find(filter)
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
      path: "items.supplierId",
      select: "shopName brandName logo email",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Format orders

  const formattedOrders = orders.map((order: any) => ({
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

      return {
        product,
        supplier,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
    }),
  }));

  const total = await Order.countDocuments(filter);

  const analytics = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalOrder: { $sum: 1 },

        totalPendingOrder: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] },
        },

        totalDeliveredOrder: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] },
        },

        totalCancelledOrder: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
        },

        totalPaidOrder: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
        },
      },
    },
  ]);

  const summary = analytics[0] || {
    totalOrder: 0,
    totalPendingOrder: 0,
    totalDeliveredOrder: 0,
    totalCancelledOrder: 0,
    totalPaidOrder: 0,
  };

  return {
    data: formattedOrders,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    analytics: summary,
  };
};

const getOrderFormSupplier = async (email: string, query: any) => {
  // 1️⃣ USER CHECK
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  // 2️⃣ SUPPLIER CHECK
  const supplier = await JoinAsSupplier.findOne({ userId: user._id });
  if (!supplier) {
    throw new AppError(
      "You are not registered as a supplier",
      StatusCodes.FORBIDDEN,
    );
  }

  // =========================
  // 🟢 PAGINATION
  // =========================
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  // =========================
  // 🟢 FILTER
  // =========================
  const filter: any = {
    "items.supplierId": supplier._id,
  };

  if (query.orderStatus) filter.orderStatus = query.orderStatus; // pending | delivered | cancelled
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus; // paid | unpaid
  if (query.paymentType) filter.paymentType = query.paymentType; // cod | online

  // =========================
  // 🟢 SORT
  // =========================
  const sort: any =
    query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

  // =========================
  // 🟢 QUERY
  // =========================
  const orders = await Order.find(filter)
    .populate("userId", "firstName lastName email")
    .populate("items.productId", "title slug images")
    .populate("items.supplierId", "shopName brandName logo")
    .populate("items.variantId", "label price discount unit")
    .populate("items.wholesaleId") // populate wholesale object
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Order.countDocuments(filter);

  // =========================
  // 🟢 FORMAT RESPONSE
  // =========================
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
          item.supplierId._id.toString() === supplier._id.toString(),
      )
      .map((item: any) => {
        // ✅ Type Assertion for wholesaleId
        const wholesaleObj = item.wholesaleId as any; // now TS treat as object
        const wholesale =
          wholesaleObj && typeof wholesaleObj === "object"
            ? {
                _id: wholesaleObj._id,
                type: wholesaleObj.type,
                label: wholesaleObj.label,
              }
            : null;

        return {
          product: item.productId,
          supplier: item.supplierId,
          variant: item.variantId || null,
          wholesale,
          status: item.status,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          _id: item._id,
        };
      }),
  }));

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: formattedOrders,
  };
};

const cancelMyOrder = async (orderId: string, email: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ User check
    const user = await User.findOne({ email }).session(session);
    if (!user) {
      throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
    }

    // 2️⃣ Fetch order
    const order: any = await Order.findById(orderId)
      .populate("items.productId")
      .session(session);

    if (!order) {
      throw new AppError("Your order does not exist", StatusCodes.NOT_FOUND);
    }

    // 3️⃣ Validation
    if (order.paymentType !== "cod") {
      throw new AppError(
        "Only COD orders can be cancelled",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (order.orderStatus !== "pending") {
      throw new AppError(
        "Only pending orders can be cancelled",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (order.userId.toString() !== user._id.toString()) {
      throw new AppError(
        "You can only cancel your own orders",
        StatusCodes.FORBIDDEN,
      );
    }

    // 4️⃣ Restore stock for each order item
    for (const item of order.items) {
      const productId = new mongoose.Types.ObjectId(item.productId);

      // 🔹 Variant product
      if (item.variantId) {
        await Product.updateOne(
          {
            _id: productId,
            "variants._id": new mongoose.Types.ObjectId(item.variantId),
          },
          { $inc: { "variants.$.stock": item.quantity } },
          { session },
        );
      }

      // 🔹 Wholesale product
      else if (item.wholesaleId) {
        const wholesaleId = new mongoose.Types.ObjectId(item.wholesaleId);

        const wholesale: any = await Wholesale.findById(wholesaleId)
          .select("type caseItems palletItems")
          .session(session);

        if (!wholesale) continue;

        // Case type wholesale
        if (wholesale.type === "case") {
          await Wholesale.updateOne(
            { _id: wholesaleId, "caseItems.productId": productId },
            { $inc: { "caseItems.$.quantity": item.quantity } },
            { session },
          );
        }

        // Pallet type wholesale
        else if (wholesale.type === "pallet") {
          // Only increase totalCases
          await Wholesale.updateOne(
            { _id: wholesaleId, "palletItems.items.productId": productId },
            { $inc: { "palletItems.$[].totalCases": item.quantity } },
            { session },
          );
        }
      }
    }

    // 5️⃣ Update order status
    await Order.updateOne(
      { _id: order._id },
      { $set: { orderStatus: "cancelled" } },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: "Order cancelled and stock restored successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const updateOrderStatus = async (
  orderId: string,
  payload: any,
  email: string,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status, itemId } = payload;

    // 1️⃣ Supplier validation
    const user = await User.findOne({ email }).session(session);
    if (!user) throw new AppError("Your account does not exist", 404);

    const supplier = await JoinAsSupplier.findOne({ userId: user._id }).session(
      session,
    );
    if (!supplier) throw new AppError("Supplier not found", 404);

    // 2️⃣ Fetch order
    const order: any = await Order.findById(orderId).session(session);
    if (!order) throw new AppError("Order not found", 404);

    // 3️⃣ Find supplier's item
    const item = order.items.find(
      (i: any) =>
        i._id.toString() === itemId &&
        i.supplierId.toString() === supplier._id.toString(),
    );
    if (!item)
      throw new AppError("This item does not belong to your supplier", 403);

    // 4️⃣ Online payment cannot cancel
    if (status === "cancelled" && order.paymentType === "online") {
      throw new AppError("Cannot cancel online paid order", 400);
    }

    // 5️⃣ Update item status
    item.status = status;

    // Optional: add deliveredAt timestamp
    if (status === "delivered") item.deliveredAt = new Date();

    // 6️⃣ Auto-update orderStatus based on all items
    const statuses = order.items.map((i: any) => i.status);

    if (statuses.every((s: any) => s === "ready_to_ship"))
      order.orderStatus = "ready_to_ship";
    else if (statuses.every((s: any) => s === "shipped"))
      order.orderStatus = "shipped";
    else if (statuses.every((s: any) => s === "delivered"))
      order.orderStatus = "delivered";
    else if (statuses.every((s: any) => s === "cancelled"))
      order.orderStatus = "cancelled";
    else order.orderStatus = "partially_shipped";

    // 7️⃣ Save and commit
    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: `Item status updated to ${status} successfully`,
      orderStatus: order.orderStatus,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getSingleOrder = async (id: string) => {
  const order: any = await Order.findById(id)
    .populate({
      path: "userId",
      select: "firstName lastName email image phone createdAt",
    })
    .select("-items -purchaseDate -paymentType -orderType");

  if (!order) {
    throw new AppError("Order not found", 404);
  }
  const userId = order.userId._id;
  const userStats = await Order.aggregate([
    {
      $match: { userId: userId },
    },
    {
      $group: {
        _id: null,
        totalOrder: { $sum: 1 },
        totalValue: { $sum: "$totalPrice" },
        avgValue: { $avg: "$totalPrice" },
      },
    },
    {
      $project: { _id: 0 },
    },
  ]);

  const analytics = userStats[0] || {
    totalOrder: 0,
    totalValue: 0,
    avgValue: 0,
  };

  const recentOrders = await Order.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("orderUniqueId totalPrice paymentStatus orderStatus createdAt");

  return {
    order,
    userSummary: {
      userId,
      totalOrder: analytics.totalOrder,
      totalValue: analytics.totalValue,
      averageOrderValue: Number(analytics.avgValue.toFixed(2)),
    },
    recentOrders,
  };
};

const orderService = {
  createOrder,
  getMyOrders,
  getAllOrdersForAdmin,
  getOrderFormSupplier,
  getSingleOrder,
  cancelMyOrder,
  updateOrderStatus,
};

export default orderService;
