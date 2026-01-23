import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import AppError from "../../errors/AppError";
import {
  calculateAmounts,
  calculateTotal,
  generateInvoice,
  notifySupplierAndAdmin,
  splitItemsByOwner,
} from "../../lib/paymentIntent";
import { validateOrderForPayment, validateUser } from "../../lib/validators";
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
    throw new Error("Payment session creation failed");
  }

  try {
    await Payment.create({
      userId: user._id,
      orderId: order._id,
      stripePaymentIntentId: session.payment_intent as string,
      amount: grandTotal,
      status: "pending",
      paymentTransferStatus: "pending",
      adminCommission: adminTotal,
      supplierCommission: supplierTotal,
      supplierId: supplierSettlements[0]?.supplierId || null,
    });
  } catch (err) {
    console.error("Payment creation error:", err);
    throw new Error("Payment record creation failed");
  }

  // for (const settlement of supplierSettlements) {
  //   try {
  //     await SupplierSettlement.create({
  //       orderId: new mongoose.Types.ObjectId(order._id),
  //       supplierId: new mongoose.Types.ObjectId(settlement.supplierId),
  //       paymentId: paymentDoc._id,
  //       totalAmount: settlement.total,
  //       adminCommission: settlement.adminCommission,

  //       payableAmount: settlement.payableToSupplier,
  //       status: "pending",
  //     });
  //   } catch (err) {
  //     console.error("SupplierSettlement creation error:", err);
  //   }
  // }

  return {
    checkoutUrl: session.url,
  };
};

const stripeWebhookHandler = async (sig: any, payload: Buffer) => {
  console.log("🚀 Stripe webhook received!");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_ADMIN_SECRET as string,
    );
    console.log("✅ Stripe webhook signature verified successfully");
  } catch (err: any) {
    console.error(
      "❌ Stripe Webhook signature verification failed:",
      err.message,
    );
    throw new AppError("Webhook verification failed", StatusCodes.BAD_REQUEST);
  }

  //! Handle different event types
  switch (event.type) {
    case "checkout.session.completed": {
      console.log("💳 Checkout session completed event received");

      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Session ID:", session.id);
      console.log("Session metadata:", session.metadata);

      // Payment lookup by stripeSessionId (safer for Klarna/other methods)
      const payment = await Payment.findOne({ stripeSessionId: session.id });

      if (payment) {
        await Payment.findByIdAndUpdate(payment._id, { status: "success" });
        console.log("💰 Payment record updated successfully");

        await notifySupplierAndAdmin(payment);
        await generateInvoice(payment.orderId);

        console.log("✅ Post-payment logic executed");
      } else {
        console.log("⚠️ Payment record not found for this session");
      }
      break;
    }

    case "payment_intent.succeeded": {
      console.log("💸 PaymentIntent succeeded");

      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntent.id,
      });

      if (payment) {
        await Payment.findByIdAndUpdate(payment._id, { status: "success" });
        console.log("💰 Payment status updated to success for PaymentIntent");

        await notifySupplierAndAdmin(payment);
        await generateInvoice(payment.orderId);
      } else {
        console.log("⚠️ Payment record not found for this PaymentIntent");
      }
      break;
    }

    case "payment_intent.payment_failed": {
      console.log("❌ PaymentIntent failed");

      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        { status: "failed" },
      );

      console.log("⚠️ Payment status updated to failed for PaymentIntent");
      break;
    }

    case "charge.succeeded": {
      console.log("💳 Charge succeeded");

      const charge = event.data.object as Stripe.Charge;
      // Optionally update payment if linked via charge.payment_intent
      const payment = await Payment.findOne({
        stripePaymentIntentId: charge.payment_intent as string,
      });

      if (payment) {
        await Payment.findByIdAndUpdate(payment._id, { status: "success" });
        console.log("💰 Payment record updated for charge.succeeded");
      }
      break;
    }

    case "charge.failed": {
      console.log("❌ Charge failed");

      const charge = event.data.object as Stripe.Charge;
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: charge.payment_intent as string },
        { status: "failed" },
      );

      console.log("⚠️ Payment status updated to failed for charge.failed");
      break;
    }

    case "payout.paid": {
      console.log("💵 Payout paid to supplier/admin");
      // Optionally update SupplierSettlement status
      break;
    }

    case "payout.failed": {
      console.log("⚠️ Payout failed to supplier/admin");
      break;
    }

    default:
      console.log("ℹ️ Event type not handled:", event.type);
  }

  return { received: true };
};

const paymentService = {
  createPayment,
  stripeWebhookHandler,
};

export default paymentService;
