/**
 * Order Service
 * Handles business logic for orders + payouts
 */

const OrderModel = require("../models/order.model.js");
const PayoutModel = require("../models/payout.model.js");
const { calculateCommission } = require("./commission.service.js");

/**
 * Place new order
 */
async function placeOrder({ buyer, seller, items }) {
  if (!items || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  let totalAmount = 0;

  items.forEach(item => {
    totalAmount += item.quantity * item.unit_price;
  });

  const order = await OrderModel.createOrder({
    buyer_id: buyer.id,
    seller_id: seller.id,
    buyer_role: buyer.role,
    seller_role: seller.role,
    total_amount: totalAmount
  });

  for (const item of items) {
    await OrderModel.addOrderItem({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    });
  }

  return order;
}

/**
 * Complete order → calculate commission → create payout
 * (called when order status becomes COMPLETED)
 */
async function completeOrder(order, seller) {
  if (!order || order.status !== "COMPLETED") {
    throw new Error("Order must be completed before payout");
  }

  const commission = calculateCommission(order.total_amount);
  const payable = order.total_amount - commission;

  await PayoutModel.createPayout({
    user_id: seller.id,
    order_id: order.id,
    gross_amount: order.total_amount,
    platform_commission: commission,
    payable_amount: payable,
    payout_status: "pending"
  });

  return {
    gross: order.total_amount,
    commission,
    payable
  };
}

/**
 * Get orders for logged-in user
 */
async function getMyOrders(user) {
  return OrderModel.findByUser(user.id);
}

/**
 * Change order status
 */
async function changeOrderStatus(orderId, status) {
  const allowed = [
    "PLACED",
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "REJECTED"
  ];

  if (!allowed.includes(status)) {
    throw new Error("Invalid order status");
  }

  const updatedOrder = await OrderModel.updateStatus(orderId, status);

  return updatedOrder;
}

module.exports = {
  placeOrder,
  completeOrder,
  getMyOrders,
  changeOrderStatus
};
