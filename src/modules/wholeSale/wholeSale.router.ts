import { Router } from "express";
import wholeSaleController from "./wholeSale.controller";

const router = Router();

router.post("/add", wholeSaleController.addInWholeSale);

const wholeSaleRouter = router;
export default wholeSaleRouter;
