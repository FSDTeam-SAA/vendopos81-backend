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

const getDashboardCharts = async (type: "revenue" | "order", year?: any) => {
  const selectedYear = year || new Date().getFullYear();

  const startDate = new Date(`${selectedYear}-01-01`);
  const endDate = new Date(`${selectedYear}-12-31`);

  let aggregationPipeline: any[] = [];

  // ===============================
  // 🟢 REVENUE CHART
  // ===============================
  if (type === "revenue") {
    aggregationPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          $or: [
            { paymentType: "online", paymentStatus: "paid" },
            { paymentType: "cod", orderStatus: "delivered" },
          ],
        },
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          value: { $sum: "$totalPrice" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ];
  }

  // ===============================
  // 🟢 ORDER COUNT CHART
  // ===============================
  if (type === "order") {
    aggregationPipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          value: { $sum: 1 }, // 🟢 order count
        },
      },
      { $sort: { "_id.month": 1 } },
    ];
  }

  const result = await Order.aggregate(aggregationPipeline);

  // ===============================
  // 🟢 FIXED 12 MONTH RESPONSE
  // ===============================
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const chartData = months.map((month, index) => {
    const found = result.find((r) => r._id.month === index + 1);
    return {
      month,
      value: found ? found.value : 0,
    };
  });

  return {
    type,
    year: selectedYear,
    chartData,
  };
};

const getRegionalSales = async () => {
  const result = await Order.aggregate([
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $lookup: {
        from: "categories",
        localField: "product.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    {
      $group: {
        _id: "$category.region",
        totalOrders: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        regions: { $push: "$$ROOT" },
        grandTotal: { $sum: "$totalOrders" },
      },
    },
    {
      $project: {
        _id: 0,
        regions: {
          $map: {
            input: "$regions",
            as: "r",
            in: {
              region: "$$r._id",
              totalOrders: "$$r.totalOrders",
              percentage: {
                $ceil: {
                  $multiply: [
                    { $divide: ["$$r.totalOrders", "$grandTotal"] },
                    100,
                  ],
                },
              },
            },
          },
        },
      },
    },
  ]);

  return result[0]?.regions || [];
};

const dashboardService = {
  adminDashboardAnalytics,
  getDashboardCharts,
  getRegionalSales,
};

export default dashboardService;
