import Order from "../order/order.model";
import { User } from "../user/user.model";

const adminDashboardAnalytics = async () => {
  // 🟢 Total Orders
  const totalOrder = await Order.countDocuments();

  // 🟢 Total Revenue (online paid + COD delivered)
  const revenueAgg = await Order.aggregate([
    {
      $match: {
        $or: [
          {
            paymentType: "online",
            paymentStatus: "paid",
          },
          {
            paymentType: "cod",
            orderStatus: "delivered",
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalPrice" },
      },
    },
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

  // 🟢 Total Customers
  const totalCustomer = await User.countDocuments({
    role: "customer",
    isSuspended: false,
  });

  // 🟢 Total Suppliers
  const totalSupplier = await User.countDocuments({
    role: "supplier",
    isSuspended: false,
  });

  return {
    totalOrder,
    totalRevenue,
    totalCustomer,
    totalSupplier,
  };
};
const dashboardService = {
  adminDashboardAnalytics,
};

export default dashboardService;
