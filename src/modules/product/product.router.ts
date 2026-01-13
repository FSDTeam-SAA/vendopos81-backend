import { Router } from "express";
import auth from "../../middleware/auth";
import { upload } from "../../middleware/multer.middleware";
import { USER_ROLE } from "../user/user.constant";
import productController from "./product.controller";

const router = Router();

router.post(
  "/create-product",
  upload.array("images", 5),
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPPLIER),
  productController.createProduct
);

router.get(
  "/my-added",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPPLIER),
  productController.getMyAddedProducts
);

router.get("/all", productController.getAllProducts);

router.get(
  "/all-admin",
  // auth(USER_ROLE.ADMIN),
  productController.getAllProductForAdmin
);

router.get("/all-wholesale", productController.getAllWholeSaleProductForAdmin);
router.get("/all-fast-moving", productController.getFastMovingProducts);

router.get("/filter", productController.getFilterCategories);
router.get("/featured", productController.getFeaturedProducts);

router.get("/top-rated", productController.getTopRatedProducts);

router.get(
  "/:id",
  //   auth(USER_ROLE.ADMIN, USER_ROLE.SUPPLIER),
  productController.getSingleProduct
);

router.put(
  "/update-status/:id",
  auth(USER_ROLE.ADMIN),
  productController.updateProductStatus
);

router.put(
  "/update-product/:id",
  upload.array("images", 5),
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPPLIER),
  productController.updateProduct
);

const productRouter = router;
export default productRouter;
