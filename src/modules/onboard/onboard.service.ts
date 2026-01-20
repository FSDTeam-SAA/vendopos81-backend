import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import AppError from "../../errors/AppError";
import { User } from "../user/user.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const createConnectedAccount = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  if (user.stripeOnboardingCompleted) {
    throw new AppError(
      "You already completed the onboarding process",
      StatusCodes.CONFLICT,
    );
  }

  //   if (user.stripeAccountId) {
  //     throw new AppError(
  //       "You already have a Stripe account",
  //       StatusCodes.CONFLICT,
  //     );
  //   }

  // Create Stripe Connected Account
  const account = await stripe.accounts.create({
    type: "express",
    country: "CA",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Update user document
  await User.updateOne(
    { email },
    {
      $set: {
        stripeAccountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        stripeOnboardingCompleted:
          account.charges_enabled && account.payouts_enabled,
      },
    },
  );

  // 3️⃣ Create onboarding link (❗ correct API)
  const onboardingLink = await stripe.accountLinks.create({
    account: account.id,
    type: "account_onboarding",
    refresh_url: `${process.env.FRONT_END_URL}/stripe/refresh`,
    return_url: `${process.env.FRONT_END_URL}/stripe/return`,
  });

  return { account, onboardingLink };
};

const refreshStripeAccountStatus = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  const account = await stripe.accounts.retrieve(
    user.stripeAccountId as string,
  );

  await User.updateOne(
    { email },
    {
      $set: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        stripeOnboardingCompleted:
          account.charges_enabled && account.payouts_enabled,
      },
    },
  );

  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    stripeOnboardingCompleted:
      account.charges_enabled && account.payouts_enabled,
  };
};

const getStripeLoginLink = async (email: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  if (!user.stripeAccountId) {
    throw new AppError(
      "You have not connected your Stripe account",
      StatusCodes.CONFLICT,
    );
  }

  const loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId);

  return {
    url: loginLink.url,
  };
};

const onboardService = {
  createConnectedAccount,
  refreshStripeAccountStatus,
  getStripeLoginLink,
};

export default onboardService;
