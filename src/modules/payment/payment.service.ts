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
import { User } from "../user/user.model";
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
      status: "pending",
    });
  }

  console.log("total amount is there",adminTotal + supplierTotal);

  const grandTotal = adminTotal + supplierTotal;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["klarna"],
      billing_address_collection: "required",
      customer_email: user.email,

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Order #${order.orderUniqueId}`,
            },
            unit_amount: Math.round(grandTotal * 100),
          },
          quantity: 1,
        },
      ],

      metadata: {
        orderId: order._id.toString(),
        userId: user._id.toString(),
        adminTotal: adminTotal.toString(),
        supplierTotal: supplierTotal.toString(),
        grandTotal: grandTotal.toString(),
      },

      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });
  } catch (err) {
    console.error("Stripe checkout session creation error:", err);
    throw new AppError(
      "Payment session creation failed",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  try {
    await Payment.create({
      userId: user._id,
      orderId: order._id,
      stripePaymentIntentId: session.payment_intent as string,
      stripeCheckoutSessionId: session.id,
      amount: grandTotal,
      status: "pending",
      paymentTransferStatus: "pending",
      // adminCommission: adminTotal,
      // supplierCommission: supplierTotal,
      supplierId: supplierSettlements[0]?.supplierId || null,
      paymentDate: new Date(),
    });
  } catch (err) {
    console.error("Payment creation error:", err);
    throw new AppError(
      "Payment record creation failed",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

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
  const payments = await Payment.find({});
  return payments;
};

const requestForPaymentTransfer = async (supplierEmail: string) => {
  const supplier = await User.findOne({ email: supplierEmail });
  if (!supplier) throw new AppError("Supplier not found", 404);

  //  Pending payments fetch
  const payments = await Payment.find({
    supplierId: supplier._id,
    status: "success",
    paymentTransferStatus: "pending",
  });

  if (!payments.length)
    throw new AppError("No payments available for transfer", 400);

  // Update each payment
  const updatedPayments = await Promise.all(
    payments.map(async (payment) => {
      const { total, adminCommission, supplierAmount } = calculateAmounts([
        { unitPrice: payment.supplierCommission, quantity: 1 },
      ]);

      // payment.adminCommission = adminCommission;
      // payment.supplierCommission = supplierAmount;
      // payment.paymentTransferStatus = "requested";
      // payment.paymentTransferDate = new Date();
      // await payment.save();

      await Payment.findOneAndUpdate(
        { _id: payment._id },
        {
          $set: {
            adminCommission,
            supplierCommission: supplierAmount,
            paymentTransferStatus: "requested",
            paymentTransferDate: new Date(),
          },
        },
      );

      return payment;
    }),
  );

  return updatedPayments;
};

const paymentService = {
  createPayment,
  stripeWebhookHandler,
  getAllPayments,
  requestForPaymentTransfer,
};

export default paymentService;
