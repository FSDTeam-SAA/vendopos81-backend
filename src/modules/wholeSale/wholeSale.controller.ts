import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import wholeSaleService from "./wholeSale.service";

const addInWholeSale = catchAsync(async (req, res) => {
  const result = await wholeSaleService.addWholeSale(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product added in whole sale successfully", //add it dynamically way.
    data: result,
  });
});

const wholeSaleController = {
  addInWholeSale,
};

export default wholeSaleController;
