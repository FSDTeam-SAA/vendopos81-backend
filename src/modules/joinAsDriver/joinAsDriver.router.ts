import { Router } from "express";
import auth from "../../middleware/auth";
import { upload } from "../../middleware/multer.middleware";
import { USER_ROLE } from "../user/user.constant";
import { joinAsDriverController } from "./joinAsDriver.controller";

const router = Router();

router.post(
  "/register",
  auth(USER_ROLE.CUSTOMER),
  upload.fields([
    { name: "documents", maxCount: 5 },
    { name: "data", maxCount: 1 },
  ]),
  joinAsDriverController.joinAsDriver
);
router.get(
  "/my-info",
  auth(USER_ROLE.CUSTOMER, USER_ROLE.DRIVER),
  joinAsDriverController.getMyDriverInfo
);

// Admin Routes
router.put(
  "/update-status/:id",
  auth(USER_ROLE.ADMIN),
  joinAsDriverController.updateDriverStatus
);
router.put(
  "/suspend/:id",
  auth(USER_ROLE.ADMIN),
  joinAsDriverController.suspendDriver
);

router.get(
  "/all-drivers",
  auth(USER_ROLE.ADMIN),
  joinAsDriverController.getAllDrivers
);

router.get(
  "/:id",
  auth(USER_ROLE.ADMIN),
  joinAsDriverController.getSingleDriver
);

export default router;
