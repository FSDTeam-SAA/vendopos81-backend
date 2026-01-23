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

const paymentRouter = router;
export default paymentRouter;
