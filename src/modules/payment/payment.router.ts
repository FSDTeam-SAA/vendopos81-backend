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

router.get("/get-all", paymentController.getAllPayments);

router.post(
  "/request-transfer/:id",
  auth(USER_ROLE.SUPPLIER),
  paymentController.requestForPaymentTransfer,
);

const paymentRouter = router;
export default paymentRouter;
