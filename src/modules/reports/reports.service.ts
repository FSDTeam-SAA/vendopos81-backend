import mongoose from "mongoose";
import { User } from "../user/user.model";

const getTopBuyers = async () => {
  const topBuyers = await User.aggregate([
    // Step 1: Only customers
    { $match: { role: "customer" } },

    // Step 2: Join with orders
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },

    // Step 3: Calculate totalOrder and totalSpent
    {
      $addFields: {
        totalOrder: { $size: "$orders" },
        totalSpent: { $sum: "$orders.totalPrice" },
      },
    },

    // Step 4: Only include required fields
    {
      $project: {
        firstName: 1,
        lastName: 1,
        totalOrder: 1,
        totalSpent: 1,
      },
    },

    // Step 5: Sort by totalSpent descending
    { $sort: { totalSpent: -1 } },

    // Step 6: Limit to top 5
    { $limit: 5 },
  ]);

  return topBuyers;
};

const getSingleTopRatedBuyer = async (userId: string) => {
  const buyer = await User.aggregate([
    // Step 1: Match the specific user
    { $match: { _id: new mongoose.Types.ObjectId(userId), role: "customer" } },

    // Step 2: Join with orders
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },

    // Step 3: Analytics fields
    {
      $addFields: {
        totalOrder: { $size: "$orders" },
        totalSpent: { $sum: "$orders.totalPrice" },
      },
    },

    // Step 4: Sort orders by purchaseDate descending
    {
      $addFields: {
        recentOrders: {
          $slice: [
            {
              $map: {
                input: { $reverseArray: "$orders" }, // latest orders first
                as: "o",
                in: {
                  orderUniqueId: "$$o.orderUniqueId",
                  totalPrice: "$$o.totalPrice",
                  paymentStatus: "$$o.paymentStatus",
                  orderStatus: "$$o.orderStatus",
                  purchaseDate: "$$o.purchaseDate",
                },
              },
            },
            5, // Show only 5 recent orders
          ],
        },
      },
    },

    // Step 5: Select only required fields
    {
      $project: {
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        createdAt: 1,
        totalOrder: 1,
        totalSpent: 1,
        recentOrders: 1,
      },
    },
  ]);

  if (!buyer || buyer.length === 0) {
    throw new Error("Customer not found");
  }

  return buyer[0];
};

const reportsService = {
  getTopBuyers,
  getSingleTopRatedBuyer,
};

export default reportsService;
