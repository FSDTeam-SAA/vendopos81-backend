import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// -------------------- Helper Functions --------------------

export const groupItemsBySupplier = (items: any[]) => {
  const map: Record<string, any[]> = {};
  for (const item of items) {
    const supplierId = item.supplierId.toString();
    if (!map[supplierId]) map[supplierId] = [];
    map[supplierId].push(item);
  }
  return map;
};

export const calculateAmounts = (items: any[]) => {
  let total = 0;
  for (const item of items) {
    total += item.unitPrice * item.quantity;
  }
  const adminCommission = Math.round(total * 0.25);
  const supplierAmount = total - adminCommission;
  return { total, adminCommission, supplierAmount };
};



//! ✅ Solution Options for Klarna with Stripe Integration [Recommended]
//! If client wants to use Klarna as currency CAD. Then use below option 1.
// Option 1: Automatic Payment Methods (Recommended)
// export const createStripePaymentIntent = async (
//   supplierStripeAccountId: string,
//   total: number,
//   adminCommission: number,
// ) => {
//   return stripe.paymentIntents.create({
//     amount: Math.round(total * 100),
//     currency: "cad",

//     // ✅ Automatic payment methods handles Klarna internally
//     automatic_payment_methods: { enabled: true },

//     transfer_data: {
//       destination: supplierStripeAccountId,
//     },

//     application_fee_amount: Math.round(adminCommission * 100),
//   });
// };

// Stripe automatically detects valid methods for CAD

// Klarna will not appear in checkout for CAD, only card/payment methods supported in CAD

// এটা clean approach এবং future-proof
