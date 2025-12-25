import { Router } from 'express';
import { upload } from '../../middleware/multer.middleware';
import validateRequest from '../../middleware/validateRequest';
import { DriverValidation } from './joinAsDriver.validation';
import { DriverController } from './joinAsDriver.controller';

const router = Router();

router.post(
  '/register',
  upload.any(), // Changed from upload.array to allow all fields (data + documents)
  (req, res, next) => {
    // Parse the stringified 'data' field into an object for Zod
    if (req.body.data) {
      try {
        req.body = JSON.parse(req.body.data);
      } catch (error) {
        return next(new Error("Invalid JSON format in 'data' field"));
      }
    }
    next();
  },
  validateRequest(DriverValidation.createDriverValidationSchema),
  DriverController.joinAsDriver
);

export const joinAsDriverRouter = router;