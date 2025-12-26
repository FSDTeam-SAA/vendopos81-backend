import { Router } from "express";
import categoryController from "./category.controller";

const router = Router();

router.post("/create", categoryController.createCategory);
router.get("/get-all", categoryController.getCategories);

const categoryRouter = router;
export default categoryRouter;
