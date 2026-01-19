import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import onboardController from "./onboard.controller";

const router = Router();

router.post(
  "/create",
  auth(USER_ROLE.CUSTOMER),
  onboardController.createOnboard,
);

const onboardRouter = router;
export default onboardRouter;
