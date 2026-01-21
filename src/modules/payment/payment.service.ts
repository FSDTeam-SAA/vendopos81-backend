import Stripe from "stripe";
import {
  calculateAmounts,
  groupItemsBySupplier,
} from "../../lib/paymentIntent";
import {
  validateOrderForPayment,
  validateSupplierForPayment,
  validateUser,
} from "../../lib/validators";
import Payment from "./payment.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const createPayment = async (payload: any, userEmail: string) => {
  const { orderId, successUrl, cancelUrl } = payload;

  console.log(
    "this is createPayment",
    orderId,
    userEmail,
    successUrl,
    cancelUrl,
  );

  const user = await validateUser(userEmail);
  const order = await validateOrderForPayment(orderId, user._id);

  const grouped = groupItemsBySupplier(order.items);
  const payments: any[] = [];

  for (const supplierUserId of Object.keys(grouped)) {
    const items = grouped[supplierUserId];
    const { total, adminCommission } = calculateAmounts(items);

    // Validate Supplier
    const supplier = await validateSupplierForPayment(supplierUserId);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "klarna"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Order ${order.orderUniqueId} - Supplier ${supplier.firstName} ${supplier.lastName}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round(adminCommission * 100),
        transfer_data: { destination: supplier.stripeAccountId! },
        metadata: {
          orderId: order._id.toString(),
          userId: user._id.toString(),
          supplierId: supplier._id.toString(),
          amount: total.toString(),
        },
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    // Save Payment Record in DB
    await Payment.create({
      userId: user._id,
      orderId: order._id,
      supplierId: supplier._id,
      stripePaymentIntentId: session.payment_intent as string,
      amount: total,
      adminCommission,
      status: "pending",
    });

    payments.push({
      supplierId: supplier._id,
      sessionUrl: session.url,
      total,
      adminCommission,
    });
  }

  return payments;
};

const paymentService = {
  createPayment,
};

export default paymentService;
