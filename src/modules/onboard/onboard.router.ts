import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import onboardController from "./onboard.controller";

const router = Router();

router.post(
  "/create",
  auth(USER_ROLE.SUPPLIER),
  onboardController.createOnboard,
);

router.get(
  "/get-stripe-link",
  auth(USER_ROLE.SUPPLIER),
  onboardController.getStripeLoginLink,
);

const onboardRouter = router;
export default onboardRouter;
