import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
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
import { SupplierSettlement } from "../supplierSettlement/supplierSettlement.model";
import Payment from "./payment.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const createPayment = async (payload: any, userEmail: string) => {
  const { orderId, successUrl, cancelUrl } = payload;

  // ✅ Validate user & order
  const user = await validateUser(userEmail);
  const order = await validateOrderForPayment(orderId, user._id);

  // ✅ Split items into admin and supplier
  const { supplierMap, adminItems } = splitItemsByOwner(order.items);

  /* =========================
     🧮 CALCULATE TOTALS
  ========================= */

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

  /* =========================
     💳 STRIPE CHECKOUT (ADMIN)
  ========================= */

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["klarna"], // Klarna enabled
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

  /* =========================
     🧾 SAVE PAYMENT
  ========================= */

  try {
    await Payment.create({
      userId: user._id,
      orderId: order._id,
      stripePaymentIntentId: session.payment_intent as string,
      amount: grandTotal,
      status: "pending",
      paymentType: "ADMIN_FULL",
    });
  } catch (err) {
    console.error("Payment creation error:", err);
    throw new Error("Payment record creation failed");
  }

  /* =========================
     📦 SAVE SUPPLIER SETTLEMENT
  ========================= */

  for (const settlement of supplierSettlements) {
    try {
      await SupplierSettlement.create({
        orderId: new mongoose.Types.ObjectId(order._id),
        supplierId: new mongoose.Types.ObjectId(settlement.supplierId),
        totalAmount: settlement.total,
        adminCommission: settlement.adminCommission,
        payableAmount: settlement.payableToSupplier,
        status: "pending",
      });
    } catch (err) {
      console.error("SupplierSettlement creation error:", err);
    }
  }

  /* =========================
     🔗 RETURN SESSION URL
  ========================= */
  return {
    checkoutUrl: session.url,
    grandTotal,
    adminTotal,
    supplierTotal,
  };
};

const stripeWebhookHandler = async (sig: any, payload: Buffer) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error("Stripe Webhook signature verification failed:", err.message);
    throw new AppError("Webhook verification failed", StatusCodes.BAD_REQUEST);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const payment = await handlePaymentSuccess(session);
    if (payment) {
      await notifySupplierAndAdmin(payment);
      await generateInvoice(payment.orderId);
    }
  }

  return { received: true };
};

const paymentService = {
  createPayment,
  stripeWebhookHandler,
};

export default paymentService;
