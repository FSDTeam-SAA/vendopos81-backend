import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import {
  getNotificationByAdminId,
  //   getAllNotifications,
  getNotificationByCustomerId,
  getNotificationBySupplierId,
  markAllAsRead,
} from './notification.controller';

const router = Router();

router.get(
  '/customer/:userId',
  auth(USER_ROLE.CUSTOMER, USER_ROLE.ADMIN),
  getNotificationByCustomerId,
);

router.get(
  '/supplier/:userId',
  auth(USER_ROLE.SUPPLIER, USER_ROLE.ADMIN),
  getNotificationBySupplierId,
);

router.get('/admin/:userId', getNotificationByAdminId);
router.patch('/read/all', markAllAsRead);

const notificationRouter = router;
export default notificationRouter;
