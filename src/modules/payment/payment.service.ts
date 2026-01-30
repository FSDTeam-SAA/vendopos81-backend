import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import AppError from "../../errors/AppError";
import {
  calculateAmounts,
  calculateTotal,
  notifySupplierAndAdmin,
  splitItemsByOwner,
  updateOrderStatus,
} from "../../lib/paymentIntent";
import { validateOrderForPayment, validateUser } from "../../lib/validators";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import Order from "../order/order.model";
import { User } from "../user/user.model";
import { SupplierSettlement } from "./../supplierSettlement/supplierSettlement.model";
import Payment from "./payment.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const createPayment = async (payload: any, userEmail: string) => {
  const { orderId } = payload;

  const user = await validateUser(userEmail);
  const order = await validateOrderForPayment(orderId, user._id);

  const { supplierMap, adminItems } = splitItemsByOwner(order.items);

  const adminTotal = calculateTotal(adminItems);
  let supplierTotal = 0;

  const supplierSettlements: any[] = [];

  for (const supplierUserId of Object.keys(supplierMap)) {
    const items = supplierMap[supplierUserId];
    const { total, adminCommission } = calculateAmounts(items);

    supplierTotal += total;

    supplierSettlements.push({
      supplierId: supplierUserId,
      total,
      adminCommission,
      payableToSupplier: total - adminCommission,
    });
  }

  const grandTotal = adminTotal + supplierTotal;
  // console.log("FRONT_END_URL =>", process.env.FRONT_END_URL);

  // 🔹 Stripe session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["klarna"],
    billing_address_collection: "required",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Order #${order.orderUniqueId}` },
          unit_amount: Math.round(grandTotal * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId: order._id.toString(),
      userId: user._id.toString(),
    },

    success_url: `${process.env.FRONT_END_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONT_END_URL}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
  });

  // 🔹 Create Payment (NO supplierId here)
  const payment = await Payment.create({
    userId: user._id,
    orderId: order._id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent as string,
    amount: grandTotal,
    status: "pending",
    // paymentTransferStatus: "pending",
    paymentDate: new Date(),
  });

  // 🔹 Create Supplier Settlements (MULTIPLE)
  const settlementDocs = supplierSettlements.map((s) => ({
    paymentId: payment._id,
    orderId: order._id,
    supplierId: s.supplierId,
    totalAmount: s.total,
    adminCommission: s.adminCommission,
    payableAmount: s.payableToSupplier,
    status: "pending",
  }));

  await SupplierSettlement.insertMany(settlementDocs);

  return {
    checkoutUrl: session.url,
  };
};

const stripeWebhookHandler = async (sig: any, payload: Buffer) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_ADMIN_SECRET as string,
    );
  } catch (err: any) {
    console.error("Webhook verification failed:", err.message);
    throw new AppError("Webhook verification failed", StatusCodes.BAD_REQUEST);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      const payment = await Payment.findOne({
        stripeCheckoutSessionId: session.id,
      });

      if (!payment) {
        return { received: true };
      }

      // Idempotency: only process if not already successful
      if (payment.status === "success") {
        return { received: true };
      }

      try {
        // 1️⃣ Update payment and order atomically
        await Promise.all([
          Payment.findByIdAndUpdate(payment._id, { status: "success" }),
          updateOrderStatus(payment.orderId, payment.userId),
        ]);

        void notifySupplierAndAdmin(payment);
        // void generateInvoice(payment.orderId);
      } catch (err) {
        console.error("❌ Error processing payment completion:", err);
        throw new AppError(
          "Payment processing failed",
          StatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      break;
    }

    case "checkout.session.expired": {
      // Optional: mark payment as failed if session expires without completion
      const session = event.data.object as Stripe.Checkout.Session;

      const payment = await Payment.findOne({
        stripeCheckoutSessionId: session.id,
      });

      if (payment && payment.status === "pending") {
        await Payment.findByIdAndUpdate(payment._id, { status: "failed" });

        void notifySupplierAndAdmin(payment);
      }

      break;
    }

    default:
      console.log("Event type not handled:", event.type);
  }

  return { received: true };
};

const getAllPayments = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (query.status) {
    filter.status = query.status;
  }

  let payments: any[] = await Payment.find(filter)
    .populate({
      path: "userId",
      select: "firstName lastName email",
    })
    .populate({
      path: "orderId",
      select: "orderUniqueId orderStatus",
    })
    .select("-__v -stripeCheckoutSessionId -stripePaymentIntentId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // JS-level orderStatus filter (because populate)
  if (query.orderStatus) {
    payments = payments.filter(
      (p) => p.orderId?.orderStatus === query.orderStatus,
    );
  }

  const total = await Payment.countDocuments(filter);

  const summary = await Payment.aggregate([
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  let totalRevenue = 0;
  let completedPayment = 0;
  let pendingPayment = 0;
  let failedPayment = 0;

  summary.forEach((item) => {
    if (item._id === "success") {
      totalRevenue = item.totalAmount;
      completedPayment = item.count;
    }
    if (item._id === "pending") {
      pendingPayment = item.count;
    }
    if (item._id === "failed") {
      failedPayment = item.count;
    }
  });

  return {
    data: payments,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    summary: {
      totalRevenue,
      completedPayment,
      pendingPayment,
      failedPayment,
    },
  };
};

const requestForPaymentTransfer = async (
  supplierEmail: string,
  paymentId: string,
) => {
  // 1️⃣ Supplier validate
  const supplier = await User.findOne({ email: supplierEmail });
  if (!supplier) {
    throw new AppError("Your account does not exist", 404);
  }

  const isSupplier = await JoinAsSupplier.findOne({ userId: supplier._id });
  if (!isSupplier) {
    throw new AppError("You are not a supplier", 400);
  }

  // 2️⃣ Check payment success (order-level)
  const payment = await Payment.findOne({
    _id: paymentId,
    status: "success",
  });

  if (!payment) {
    throw new AppError("Payment is not successful yet", 400);
  }

  // 3️⃣ Find supplier settlement
  const settlement = await SupplierSettlement.findOne({
    paymentId: payment._id,
    supplierId: supplier._id,
    status: "pending",
  });

  if (!settlement) {
    throw new AppError("No settlement available for transfer", 400);
  }

  // 4️⃣ Update settlement status (NO recalculation needed)
  const updatedSettlement = await SupplierSettlement.findByIdAndUpdate(
    settlement._id,
    {
      $set: {
        status: "requested",
      },
    },
    { new: true },
  );

  return updatedSettlement;
};

const transferPayment = async (id: string) => {
  // 1️⃣ Settlement
  const settlement = await SupplierSettlement.findById(id);
  if (!settlement) {
    throw new AppError("Settlement not found", StatusCodes.NOT_FOUND);
  }

  if (settlement.status !== "pending") {
    throw new AppError("Settlement is not pending", StatusCodes.BAD_REQUEST);
  }

  // 2️⃣ Payment
  const payment = await Payment.findById(settlement.paymentId);
  if (!payment || payment.status !== "success") {
    throw new AppError("Payment is not successful", StatusCodes.BAD_REQUEST);
  }

  // 3️⃣ Order
  const order = await Order.findById(payment.orderId);
  if (!order || order.paymentStatus !== "paid") {
    throw new AppError("Order is not paid", StatusCodes.BAD_REQUEST);
  }

  // 4️⃣ Supplier User
  const supplier = await User.findById(settlement.supplierId);
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  if (!supplier.stripeAccountId || !supplier.stripeOnboardingCompleted) {
    throw new AppError(
      "Supplier not connected with Stripe",
      StatusCodes.BAD_REQUEST,
    );
  }

  // 5️⃣ Stripe Transfer
  const transfer = await stripe.transfers.create({
    amount: Math.round(settlement.payableAmount * 100), // cents
    currency: "usd",
    destination: supplier.stripeAccountId,
    metadata: {
      orderId: order._id.toString(),
      settlementId: settlement._id.toString(),
    },
  });

  // 6️⃣ Update Settlement
  await SupplierSettlement.findByIdAndUpdate(settlement._id, {
    $set: {
      status: "completed",
      stripeTransferId: transfer.id,
    },
  });

  return {
    success: true,
    message: "Payment transferred to supplier successfully",
    transferId: transfer.id,
  };
};

const paymentService = {
  createPayment,
  stripeWebhookHandler,
  getAllPayments,
  requestForPaymentTransfer,
  transferPayment,
};

export default paymentService;
