import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import AppError from "../../errors/AppError";
import {
  calculateAmounts,
  calculateTotal,
  generateInvoice,
  handlePaymentSuccess,
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
  console.log("🚀 Stripe webhook received!"); // Webhook hit

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

  if (event.type === "checkout.session.completed") {
    console.log("💳 Checkout session completed event received");

    const session = event.data.object as Stripe.Checkout.Session;
    console.log("Session ID:", session.id);
    console.log("Session metadata:", session.metadata);

    const payment = await handlePaymentSuccess(session);
    if (payment) {
      console.log("💰 Payment record updated successfully");
      await notifySupplierAndAdmin(payment);
      console.log("📤 Supplier and admin notified");
      await generateInvoice(payment.orderId);
      console.log("🧾 Invoice generated");
      console.log("🎉 Webhook processing completed successfully");
    } else {
      console.log("⚠️ Payment record not found for this session");
    }
  } else {
    console.log("ℹ️ Event type not handled:", event.type);
  }

  return { received: true };
};

const paymentService = {
  createPayment,
  stripeWebhookHandler,
};

export default paymentService;
