import { Router } from "express";
import auth from "../../middleware/auth";
import { upload } from "../../middleware/multer.middleware";
import validateRequest from "../../middleware/validateRequest";
import { USER_ROLE } from "./user.constant";
import userController from "./user.controller";
import { userValidation } from "./user.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(userValidation.userValidationSchema),
  userController.registerUser,
);

router.post(
  "/verify-email",
  auth(
    USER_ROLE.ADMIN,
    USER_ROLE.CUSTOMER,
    USER_ROLE.SUPPLIER,
    USER_ROLE.DRIVER,
  ),
  userController.verifyEmail,
);

router.post(
  "/resend-otp",
  auth(
    USER_ROLE.ADMIN,
    USER_ROLE.CUSTOMER,
    USER_ROLE.SUPPLIER,
    USER_ROLE.DRIVER,
  ),
  userController.resendOtpCode,
);

router.get("/all-users", userController.getAllUsers);
router.get("/all-supplier", userController.getAllSuppliers);

router.get(
  "/my-profile",
  auth(
    USER_ROLE.ADMIN,
    USER_ROLE.CUSTOMER,
    USER_ROLE.SUPPLIER,
    USER_ROLE.DRIVER,
  ),
  userController.getMyProfile,
);

router.put(
  "/update-profile",
  upload.single("image"),
  auth(
    USER_ROLE.ADMIN,
    USER_ROLE.CUSTOMER,
    USER_ROLE.SUPPLIER,
    USER_ROLE.DRIVER,
  ),
  userController.updateUserProfile,
);

router.get(
  "/admin_id",
  auth(
    USER_ROLE.ADMIN,
    USER_ROLE.CUSTOMER,
    USER_ROLE.SUPPLIER,
    USER_ROLE.DRIVER,
  ),
  userController.getAdminId,
);

router.get("/:id", userController.getSingleCustomer);

const userRouter = router;
export default userRouter;
