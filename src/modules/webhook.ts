import catchAsync from "../utils/catchAsync";

const stripeWebhookHandler = catchAsync(async (req, res) => {
  res.status(200).json({ received: true });
});

export const webhookController = {
  stripeWebhookHandler,
};