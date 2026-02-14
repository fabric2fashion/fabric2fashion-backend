/**
 * ==========================================
 * Order Model
 * Fabric2Fashion
 * ==========================================
 * Handles ALL DB operations for orders
 *
 * ❌ No HTTP logic
 * ❌ No payment logic
 * ❌ No commission logic
 */

const db = require("../db");

/**
 * ------------------------------------------
 * Create Order
 * ------------------------------------------
 */
async function createOrder({
  buyer_id,
  seller_id,
  buyer_role,
  seller_role,
  total_amount
}) {
  const { rows } = await db.query(
    `
    INSERT INTO orders (
      buyer_id,
      seller_id,
      buyer_role,
      seller_role,
      total_amount,
      status
    )
    VALUES ($1, $2, $3, $4, $5, 'PLACED')
    RETURNING *
    `,
    [buyer_id, seller_id, buyer_role, seller_role, total_amount]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Add item to order
 * ------------------------------------------
 */
async function addOrderItem({
  order_id,
  product_id,
  quantity,
  unit_price
}) {
  await db.query(
    `
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price
    )
    VALUES ($1, $2, $3, $4)
    `,
    [order_id, product_id, quantity, unit_price]
  );
}

/**
 * ------------------------------------------
 * Get order by ID
 * ------------------------------------------
 */
async function findById(orderId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM orders
    WHERE id = $1
    `,
    [orderId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Get orders for a user (buyer or seller)
 * ------------------------------------------
 */
async function findByUser(userId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM orders
    WHERE buyer_id = $1
       OR seller_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
}

/**
 * ------------------------------------------
 * Update order status
 * ------------------------------------------
 */
async function updateStatus(orderId, status) {
  const { rows } = await db.query(
    `
    UPDATE orders
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [status, orderId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Mark order as paid
 * ------------------------------------------
 */
async function markAsPaid(orderId, paymentRef) {
  const { rows } = await db.query(
    `
    UPDATE orders
    SET payment_status = 'paid',
        payment_reference = $1,
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [paymentRef, orderId]
  );

  return rows[0];
}

module.exports = {
  createOrder,
  addOrderItem,
  findById,
  findByUser,
  updateStatus,
  markAsPaid
};
