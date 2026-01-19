// handlers/connectedAccountWebhookHandler.ts
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import AppError from "../errors/AppError.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import stripeAccountHandlers from "./onboard/onboardingHandler.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const connectedAccountWebhookHandler = catchAsync(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_CONNECTED as string;

  if (!sig) {
    console.error("❌ Missing stripe-signature header");
    throw new AppError(
      "Missing stripe-signature header",
      StatusCodes.BAD_REQUEST,
    );
  }

  let event: Stripe.Event;

  try {
    // ⚠️ req.body must be raw Buffer for webhook verification
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      endpointSecret,
    );
    console.log("✅ Webhook signature verified:", event.type);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    throw new AppError(
      `Webhook Error: ${err.message}`,
      StatusCodes.BAD_REQUEST,
    );
  }

  const { type, data, account: connectedAccountId } = event;

  try {
    // 1️⃣ Connected account events (supplier onboarding / update)
    if (
      connectedAccountId &&
      stripeAccountHandlers[type as keyof typeof stripeAccountHandlers]
    ) {
      await stripeAccountHandlers[type as keyof typeof stripeAccountHandlers](
        data.object,
        connectedAccountId,
      );
      console.log(`[Stripe] Handled connected account event: ${type}`);
    }
    // 2️⃣ Platform payment events
    // else if (
    //   !connectedAccountId &&
    //   stripeWebhookHandlers[type as keyof typeof stripeWebhookHandlers]
    // ) {
    //   await stripeWebhookHandlers[type as keyof typeof stripeWebhookHandlers](
    //     data.object,
    //   );
    //   console.log(`[Stripe] Handled platform event: ${type}`);
    // }
    else {
      console.log(`[Stripe] No handler for event type: ${type}`);
    }

    // 3️⃣ Acknowledge receipt
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Webhook event handled successfully",
    });
  } catch (error: any) {
    console.error("❌ Error handling webhook event:", error);
    throw new AppError(
      `Webhook Error: ${error.message}`,
      StatusCodes.BAD_REQUEST,
    );
  }
});
