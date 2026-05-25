import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import paymentController from './payment.controller';

const router = Router();

router.post('/process', auth(USER_ROLE.CUSTOMER), paymentController.createPayment);
router.get('/get-all', auth(USER_ROLE.ADMIN), paymentController.getAllPayments);

router.post(
  '/request-transfer/:id',
  auth(USER_ROLE.SUPPLIER),
  paymentController.requestForPaymentTransfer,
);

router.post('/transfer/:id', auth(USER_ROLE.ADMIN), paymentController.transferPayment);

router.get(
  '/supplier-history',
  auth(USER_ROLE.SUPPLIER),
  paymentController.getSupplierPaymentHistory,
);

const paymentRouter = router;
export default paymentRouter;
