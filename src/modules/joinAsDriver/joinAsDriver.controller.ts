import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DriverService } from './joinAsDriver.service';
import { uploadToCloudinary } from '../../utils/cloudinary'; // Path to your cloudinary util

const joinAsDriver = catchAsync(async (req: Request, res: Response) => {
  const bodyData = req.body;
  const files = req.files as Express.Multer.File[];
  
  // 1. Initialize as an array of objects
  const documentObjects: { url: string }[] = [];

  if (files && files.length > 0) {
    const uploadPromises = files.map((file) => 
      uploadToCloudinary(file.path, 'drivers/documents')
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    
    // 2. Map the results into the required object format
    uploadResults.forEach((result: any) => {
      documentObjects.push({ url: result.secure_url });
    });
  }

  // 3. Save to DB
  const result = await DriverService.createDriverRequestIntoDB({
    ...bodyData,
    documents: documentObjects, // Now matches your desired format
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Driver registration submitted successfully!',
    data: result,
  });
});
export const DriverController = {
  joinAsDriver,
};