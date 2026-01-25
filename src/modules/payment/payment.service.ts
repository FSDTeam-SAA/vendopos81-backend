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
import { User } from "../user/user.model";
import { SupplierSettlement } from "./../supplierSettlement/supplierSettlement.model";
import Payment from "./payment.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const createPayment = async (payload: any, userEmail: string) => {
  const { orderId, successUrl, cancelUrl } = payload;

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
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
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

  // Filter object
  const filter: any = {};

  if (query.status) {
    filter.status = query.status; // payment status filter
  }

  // Query payments
  let payments = await Payment.find(filter)
    .populate({
      path: "userId",
      select: "name email",
    })
    .populate({
      path: "orderId",
      select: "orderUniqueId orderStatus",
    })
    .select("-__v -stripeCheckoutSessionId -stripePaymentIntentId")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Filter by orderStatus in JS if requested
  if (query.orderStatus) {
    payments = payments.filter(
      (p) => p.orderId?.orderStatus === query.orderStatus,
    );
  }

  // Total count for pagination
  const total = await Payment.countDocuments(filter);

  return {
    data: payments,
    meta: {
      page, // current page
      limit, // page size
      total, // total documents
      totalPage: Math.ceil(total / limit), // total pages
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

const paymentService = {
  createPayment,
  stripeWebhookHandler,
  getAllPayments,
  requestForPaymentTransfer,
};

export default paymentService;
