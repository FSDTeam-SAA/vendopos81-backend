import { Router } from "express";
import auth from "../../middleware/auth";
import { upload } from "../../middleware/multer.middleware";
import { USER_ROLE } from "../user/user.constant";
import joinAsSupplierController from "./joinAsSupplier.controller";

const router = Router();

router.post(
  "/join",
  auth(USER_ROLE.CUSTOMER),
  upload.array("documents", 5),
  // validateRequest(joinAsSupplierValidationSchema.joinAsSupplierValidation),
  joinAsSupplierController.joinAsSupplier
);

router.get(
  "/my-supplier-info",
  auth(USER_ROLE.CUSTOMER),
  joinAsSupplierController.getMySupplierInfo
);

router.get(
  "/all-suppliers",
  auth(USER_ROLE.ADMIN),
  joinAsSupplierController.getAllSuppliers
);

router.get(
  "/:id",
  auth(USER_ROLE.ADMIN),
  joinAsSupplierController.getSingleSupplier
);

router.put(
  "/update-status/:id",
  auth(USER_ROLE.ADMIN),
  joinAsSupplierController.updateSupplierStatus
);

router.put(
  "/suspend/:id",
  auth(USER_ROLE.ADMIN),
  joinAsSupplierController.suspendSupplier
);

router.delete(
  "/delete-supplier/:id",
  auth(USER_ROLE.ADMIN),
  joinAsSupplierController.deleteSupplier
);

const joinAsSupplierRouter = router;
export default joinAsSupplierRouter;
