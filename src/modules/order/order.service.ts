import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import { OrderItemInput } from "../../lib/globalType";
import Cart from "../cart/cart.model";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import { User } from "../user/user.model";
import { IOrder } from "./order.interface";
import Order from "./order.model";

const createOrder = async (payload: IOrder, email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  let items: OrderItemInput[] = [];
  let totalPrice = 0;

  // 🛒 ORDER FROM CART
  if (payload.orderType === "addToCart") {
    const cartItems = await Cart.find({ userId: user._id })
      .populate({
        path: "productId",
        select: "supplierId",
      })
      .lean();

    if (!cartItems.length) {
      throw new AppError("Cart is empty", StatusCodes.BAD_REQUEST);
    }

    items = cartItems.map((item: any) => ({
      productId: item.productId._id,
      supplierId: item.productId.supplierId,
      quantity: item.quantity,
      unitPrice: item.price,
      ...(item.variantId && { variantId: item.variantId }),
      ...(item.wholesaleId && { wholesaleId: item.wholesaleId }),
    }));

    totalPrice = cartItems.reduce(
      (sum: number, item: any) => sum + item.price,
      0
    );

    //! ✅ Clear cart after order
    // await Cart.deleteMany({ userId: user._id });
  }

  // ⚡ DIRECT / SINGLE ORDER
  if (payload.orderType === "single") {
    items = payload.items;
    totalPrice = payload.totalPrice;
  }

  const order = await Order.create({
    userId: user._id,
    orderType: payload.orderType,
    paymentType: payload.paymentType,
    items,
    totalPrice,
    billingInfo: payload.billingInfo,
  });

  return order;
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

const orderService = {
  createOrder,
  getMyOrders,
  getAllOrdersForAdmin,
  getOrderFormSupplier,
};

export default orderService;
