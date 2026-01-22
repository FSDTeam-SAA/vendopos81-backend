import Stripe from "stripe";
import {
  calculateAmounts,
  calculateTotal,
  splitItemsByOwner,
} from "../../lib/paymentIntent";
import {
  validateOrderForPayment,
  validateSupplierForPayment,
  validateUser,
} from "../../lib/validators";
import Payment from "./payment.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// const createPayment = async (payload: any, userEmail: string) => {
//   const { orderId, successUrl, cancelUrl } = payload;

//   console.log(
//     "this is createPayment",
//     orderId,
//     userEmail,
//     successUrl,
//     cancelUrl,
//   );

//   const user = await validateUser(userEmail);
//   const order = await validateOrderForPayment(orderId, user._id);

//   const grouped = groupItemsBySupplier(order.items);
//   const payments: any[] = [];

//   for (const supplierUserId of Object.keys(grouped)) {
//     const items = grouped[supplierUserId];
//     const { total, adminCommission } = calculateAmounts(items);

//     // Validate Supplier
//     const supplier = await validateSupplierForPayment(supplierUserId);

//     // Create Stripe Checkout Session
//     const session = await stripe.checkout.sessions.create({
//       mode: "payment",
//       payment_method_types: ["card", "klarna"],
//       line_items: [
//         {
//           price_data: {
//             currency: "cad",
//             product_data: {
//               name: `Order # ${order.orderUniqueId} - Supplier - ${supplier.firstName} ${supplier.lastName}`,
//               //! You can add more details about the order here.
//             },
//             unit_amount: Math.round(total * 100),
//           },
//           quantity: 1,
//         },
//       ],
//       payment_intent_data: {
//         application_fee_amount: Math.round(adminCommission * 100),
//         transfer_data: { destination: supplier.stripeAccountId! },
//         metadata: {
//           orderId: order._id.toString(),
//           userId: user._id.toString(),
//           supplierId: supplier._id.toString(),
//           amount: total.toString(),
//         },
//       },
//       success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: cancelUrl,
//     });

//     // Save Payment Record in DB
//     await Payment.create({
//       userId: user._id,
//       orderId: order._id,
//       supplierId: supplier._id,
//       stripePaymentIntentId: session.payment_intent as string,
//       amount: total,
//       adminCommission,
//       status: "pending",
//     });

//     payments.push({
//       supplierId: supplier._id,
//       sessionUrl: session.url,
//       total,
//       adminCommission,
//     });
//   }

//   return payments;
// };

const createPayment = async (payload: any, userEmail: string) => {
  const { orderId, successUrl, cancelUrl } = payload;

  const user = await validateUser(userEmail);
  const order = await validateOrderForPayment(orderId, user._id);

  const { supplierMap, adminItems } = splitItemsByOwner(order.items);

  const payments: any[] = [];

  /* ======================
     🟢 ADMIN PAYMENT
  ====================== */
  if (adminItems.length > 0) {
    const adminTotal = calculateTotal(adminItems);

    const adminSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "klarna"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `Order #${order.orderUniqueId} - Admin Products`,
            },
            unit_amount: Math.round(adminTotal * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId: order._id.toString(),
        userId: user._id.toString(),
        type: "ADMIN",
        amount: adminTotal.toString(),
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    await Payment.create({
      userId: user._id,
      orderId: order._id,
      amount: adminTotal,
      stripePaymentIntentId: adminSession.payment_intent as string,
      status: "pending",
      paymentType: "ADMIN",
    });

    payments.push({
      type: "ADMIN",
      sessionUrl: adminSession.url,
      amount: adminTotal,
    });
  }

  /* ======================
     🟡 SUPPLIER PAYMENTS
  ====================== */
  for (const supplierUserId of Object.keys(supplierMap)) {
    const items = supplierMap[supplierUserId];
    const { total, adminCommission } = calculateAmounts(items);

    const supplier = await validateSupplierForPayment(supplierUserId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "klarna"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `Order #${order.orderUniqueId} - Supplier ${supplier.firstName} ${supplier.lastName}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round(adminCommission * 100),
        transfer_data: {
          destination: supplier.stripeAccountId!,
        },
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

    await Payment.create({
      userId: user._id,
      orderId: order._id,
      supplierId: supplier._id,
      stripePaymentIntentId: session.payment_intent as string,
      amount: total,
      status: "pending",
      paymentType: "SUPPLIER",
    });

    payments.push({
      type: "SUPPLIER",
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
