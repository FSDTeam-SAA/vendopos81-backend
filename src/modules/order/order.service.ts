import Order from "./order.model";

const createOrder = async (payload: any) => {
  const order = await Order.create(payload);
  return order;
};

const orderService = {
  createOrder,
};

export default orderService;
