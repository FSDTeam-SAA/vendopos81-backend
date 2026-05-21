import { StatusCodes } from 'http-status-codes';
import Stripe from 'stripe';
import AppError from '../../errors/AppError';
import {
  calculateAmounts,
  calculateTotal,
  notifySupplierAndAdmin,
  splitItemsByOwner,
  updateOrderStatus,
} from '../../lib/paymentIntent';
import { validateOrderForPayment, validateUser } from '../../lib/validators';
import JoinAsSupplier from '../joinAsSupplier/joinAsSupplier.model';
import Order from '../order/order.model';
import { User } from '../user/user.model';
import { SupplierSettlement } from './../supplierSettlement/supplierSettlement.model';
import Payment from './payment.model';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// const createPayment = async (payload: any, userEmail: string) => {
//   const { orderId } = payload;

//   const user = await validateUser(userEmail);
//   const order = await validateOrderForPayment(orderId, user._id);

//   const { supplierMap, adminItems } = splitItemsByOwner(order.items);
//   const adminTotal = calculateTotal(adminItems);
//   let supplierTotal = 0;

//   const supplierSettlements: any[] = [];

//   for (const supplierUserId of Object.keys(supplierMap)) {
//     const items = supplierMap[supplierUserId];
//     const { total, adminCommission } = calculateAmounts(items);

//     supplierTotal += total;

//     supplierSettlements.push({
//       supplierId: supplierUserId,
//       total,
//       adminCommission,
//       payableToSupplier: total - adminCommission,
//     });
//   }

//   const grandTotal = adminTotal + supplierTotal;

//   // 🔹 Stripe session
//   const session = await stripe.checkout.sessions.create({
//     mode: 'payment',
//     payment_method_types: ['klarna'],
//     billing_address_collection: 'required',
//     shipping_address_collection: {
//       allowed_countries: ['CA'],
//     },
//     customer_email: user.email,
//     line_items: [
//       {
//         price_data: {
//           currency: 'cad',
//           product_data: { name: `Order #${order.orderUniqueId}` },
//           unit_amount: Math.round(grandTotal * 100),
//         },
//         quantity: 1,
//       },
//     ],
//     metadata: {
//       orderId: order._id.toString(),
//       userId: user._id.toString(),
//     },

//     success_url: `${process.env.FRONT_END_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${process.env.FRONT_END_URL}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
//   });

//   // Diagnostic log — session created
//   try {
//     console.log('Stripe Checkout session created:', {
//       sessionId: session.id,
//       paymentIntent: session.payment_intent,
//       customerEmail: session.customer_email,
//       amount_total: session.amount_total || Math.round(grandTotal * 100),
//       metadata: session.metadata,
//     });
//   } catch (err) {
//     console.error('Error logging session info:', err);
//   }

//   // 🔹 Create Payment (NO supplierId here)
//   const payment = await Payment.create({
//     userId: user._id,
//     orderId: order._id,
//     stripeCheckoutSessionId: session.id,
//     stripePaymentIntentId: session.payment_intent as string,
//     amount: grandTotal,
//     status: 'pending',
//     // paymentTransferStatus: "pending",
//     paymentDate: new Date(),
//   });

//   // 🔹 Create Supplier Settlements (MULTIPLE)
//   const settlementDocs = supplierSettlements.map((s) => ({
//     paymentId: payment._id,
//     orderId: order._id,
//     supplierId: s.supplierId,
//     totalAmount: s.total,
//     adminCommission: s.adminCommission,
//     payableAmount: s.payableToSupplier,
//     status: 'pending',
//   }));

//   await SupplierSettlement.insertMany(settlementDocs);

//   // Log Payment record creation (if available)
//   try {
//     console.log('Payment record created:', {
//       paymentId: payment._id?.toString(),
//       stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
//       stripePaymentIntentId: payment.stripePaymentIntentId,
//       amount: payment.amount,
//       status: payment.status,
//     });
//   } catch (err) {
//     console.error('Error logging payment creation:', err);
//   }

//   return {
//     checkoutUrl: session.url,
//   };
// };

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

  // ✅ Total admin commission
  const totalAdminCommission = supplierSettlements.reduce((sum, s) => sum + s.adminCommission, 0);

  // 🔹 Stripe session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['klarna'],
    billing_address_collection: 'required',
    shipping_address_collection: {
      allowed_countries: ['CA'],
    },
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: 'cad',
          product_data: { name: `Order #${order.orderUniqueId}` },
          unit_amount: Math.round(grandTotal * 100), // cents
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

  console.log('Stripe Checkout session created:', {
    sessionId: session.id,
    paymentIntent: session.payment_intent,
    amount_total: session.amount_total,
  });

  // 🔹 Create Payment
  const payment = await Payment.create({
    userId: user._id,
    orderId: order._id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent || null, // may be null initially
    amount: grandTotal,
    adminCommission: totalAdminCommission, // ✅ FIXED
    status: 'pending',
    paymentDate: new Date(),
  });

  // 🔹 Supplier settlements
  const settlementDocs = supplierSettlements.map((s) => ({
    paymentId: payment._id,
    orderId: order._id,
    supplierId: s.supplierId,
    totalAmount: s.total,
    adminCommission: s.adminCommission,
    payableAmount: s.payableToSupplier,
    status: 'pending',
  }));

  await SupplierSettlement.insertMany(settlementDocs);

  console.log('Payment record created:', {
    paymentId: payment._id.toString(),
    amount: payment.amount,
    adminCommission: payment.adminCommission,
  });

  return {
    checkoutUrl: session.url,
  };
};

const stripeWebhookHandler = async (sig: any, payload: Buffer) => {
  let event: Stripe.Event;

  // Log incoming webhook signature and payload size
  try {
    console.log('--- Incoming Stripe webhook ---');
    console.log('stripe-signature present:', Boolean(sig));
    console.log(
      'payload length:',
      payload && (payload as any).length ? (payload as any).length : 'unknown',
    );
  } catch (err) {
    console.error('Error logging incoming webhook info:', err);
  }

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_ADMIN_SECRET as string,
    );
    console.log('Webhook signature verified. event type:', event.type, 'event id:', event.id);
  } catch (err: any) {
    console.error('Webhook verification failed:', err.message);
    throw new AppError('Webhook verification failed', StatusCodes.BAD_REQUEST);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Handling checkout.session.completed for session:', session.id);

      const payment = await Payment.findOne({
        stripeCheckoutSessionId: session.id,
      });

      if (payment)
        console.log(
          'Found Payment for session:',
          payment._id?.toString(),
          'status:',
          payment.status,
        );
      else console.log('No Payment found for session:', session.id);

      if (!payment) {
        return { received: true };
      }

      // Idempotency: only process if not already successful
      if (payment.status === 'success') {
        return { received: true };
      }

      try {
        // 1️⃣ Update payment and order atomically
        await Promise.all([
          Payment.findByIdAndUpdate(payment._id, { status: 'success' }),
          updateOrderStatus(payment.orderId, payment.userId),
        ]);

        await Order.findByIdAndUpdate(payment.orderId, {
          paymentStatus: 'paid',
        });

        console.log('Payment status updated to success for payment:', payment._id?.toString());
        void notifySupplierAndAdmin(payment);
        // void generateInvoice(payment.orderId);
      } catch (err) {
        console.error('❌ Error processing payment completion:', err);
        throw new AppError('Payment processing failed', StatusCodes.INTERNAL_SERVER_ERROR);
      }

      break;
    }

    case 'checkout.session.expired': {
      // Optional: mark payment as failed if session expires without completion
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Handling checkout.session.expired for session:', session.id);

      const payment = await Payment.findOne({
        stripeCheckoutSessionId: session.id,
      });

      if (payment && payment.status === 'pending') {
        await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });

        console.log('Payment status set to failed for payment:', payment._id?.toString());
        void notifySupplierAndAdmin(payment);
      }

      break;
    }

    default:
      console.log(
        'Event type not handled:',
        event.type,
        'object id:',
        (event.data?.object as any)?.id,
      );
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
      path: 'userId',
      select: 'firstName lastName email',
    })
    .populate({
      path: 'orderId',
      select: 'orderUniqueId orderStatus',
    })
    .select('-__v -stripeCheckoutSessionId -stripePaymentIntentId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // JS-level orderStatus filter (because populate)
  if (query.orderStatus) {
    payments = payments.filter((p) => p.orderId?.orderStatus === query.orderStatus);
  }

  const total = await Payment.countDocuments(filter);

  const summary = await Payment.aggregate([
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  let totalRevenue = 0;
  let completedPayment = 0;
  let pendingPayment = 0;
  let failedPayment = 0;

  summary.forEach((item) => {
    if (item._id === 'success') {
      totalRevenue = item.totalAmount;
      completedPayment = item.count;
    }
    if (item._id === 'pending') {
      pendingPayment = item.count;
    }
    if (item._id === 'failed') {
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

const requestForPaymentTransfer = async (supplierEmail: string, paymentId: string) => {
  const supplier = await User.findOne({ email: supplierEmail });
  if (!supplier) {
    throw new AppError('Your account does not exist', 404);
  }

  const isSupplier = await JoinAsSupplier.findOne({ userId: supplier._id });
  if (!isSupplier) {
    throw new AppError('You are not a supplier', 400);
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    status: 'success',
  });

  if (!payment) {
    throw new AppError('Payment is not successful yet', 400);
  }

  const settlement = await SupplierSettlement.findOne({
    paymentId: payment._id,
    supplierId: isSupplier._id,
    status: 'pending',
  });

  if (!settlement) {
    throw new AppError('No settlement available for transfer', 400);
  }

  const updatedSettlement = await SupplierSettlement.findByIdAndUpdate(
    settlement._id,
    {
      $set: {
        status: 'requested',
      },
    },
    { new: true },
  );

  return updatedSettlement;
};

const transferPayment = async (id: string) => {
  const settlement = await SupplierSettlement.findById(id);
  if (!settlement) {
    throw new AppError('Settlement not found', StatusCodes.NOT_FOUND);
  }

  if (settlement.status !== 'pending') {
    throw new AppError('Settlement is not pending', StatusCodes.BAD_REQUEST);
  }

  const payment = await Payment.findById(settlement.paymentId);
  if (!payment || payment.status !== 'success') {
    throw new AppError('Payment is not successful', StatusCodes.BAD_REQUEST);
  }

  const order = await Order.findById(payment.orderId);
  if (!order || order.paymentStatus !== 'paid') {
    throw new AppError('Order is not paid', StatusCodes.BAD_REQUEST);
  }

  const supplier = await User.findById(settlement.supplierId);
  if (!supplier) {
    throw new AppError('Supplier not found', StatusCodes.NOT_FOUND);
  }

  if (!supplier.stripeAccountId || !supplier.stripeOnboardingCompleted) {
    throw new AppError('Supplier not connected with Stripe', StatusCodes.BAD_REQUEST);
  }

  const transfer = await stripe.transfers.create({
    amount: Math.round(settlement.payableAmount * 100),
    currency: 'usd',
    destination: supplier.stripeAccountId,
    metadata: {
      orderId: order._id.toString(),
      settlementId: settlement._id.toString(),
    },
  });

  await SupplierSettlement.findByIdAndUpdate(settlement._id, {
    $set: {
      status: 'completed',
      stripeTransferId: transfer.id,
    },
  });

  return {
    success: true,
    message: 'Payment transferred to supplier successfully',
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
