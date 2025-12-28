import { Router } from "express";
import auth from "../../middleware/auth";
import { upload } from "../../middleware/multer.middleware";
import { USER_ROLE } from "../user/user.constant";
import { joinAsDriverController } from "./joinAsDriver.controller";
import { optionalAuth } from "../../middleware/optionalAuth";

const router = Router();



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

router.delete(
  "/:id",
  auth(USER_ROLE.ADMIN),
  joinAsDriverController.deleteDriver
);



// Public route for first-time visitors and Also Checking if user is logged in
router.post(
  "/register-unified",
  optionalAuth, // Extracts user info IF token exists, else moves on
  upload.fields([{ name: "documents", maxCount: 5 }]),
  joinAsDriverController.registerDriverUnified
);


export default router;
