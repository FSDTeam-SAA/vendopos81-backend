import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import paymentController from "./payment.controller";

const router = Router();

router.post(
  "/process",
  auth(USER_ROLE.CUSTOMER),
  paymentController.createPayment,
);

router.post(
  "/webhook",
  // No auth middleware here as Stripe needs to access this endpoint
  paymentController.stripeWebhookHandler,
);

const paymentRouter = router;
export default paymentRouter;
