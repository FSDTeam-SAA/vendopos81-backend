import Stripe from "stripe";
import config from "../../config";
import { User } from "../user/user.model";

const stripe = new Stripe(config.stripe.stripeSecretKey as string);

// Fetch latest Stripe account & sync minimal required fields
const updateUserFromStripe = async (stripeAccountId: any) => {
  if (!stripeAccountId) return;

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const user = await User.findOne({ stripeAccountId });
    if (!user) return;

    // ✅ Only fields that actually matter for payment logic
    await User.updateOne(
      { stripeAccountId },
      {
        $set: {
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          stripeOnboardingCompleted:
            account.charges_enabled && account.payouts_enabled,
        },
      },
    );

    console.log(`[Stripe] Synced onboarding status for ${user.email}`);
  } catch (error) {
    console.error(`[Stripe] Account sync failed for ${stripeAccountId}`, error);
  }
};

export default {
  // Fired when supplier completes onboarding / updates info
  "account.updated": async (accountObject: any, connectedAccountId: any) => {
    await updateUserFromStripe(connectedAccountId || accountObject.id);
  },
};
