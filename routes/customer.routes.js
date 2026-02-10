const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * =====================================
 * CUSTOMER DASHBOARD SUMMARY
 * GET /customer/dashboard/summary
 * =====================================
 */
router.get(
  "/dashboard/summary",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const customerId = req.user.id;

      const totalOrdersResult = await pool.query(
        "SELECT COUNT(*) FROM orders WHERE buyer_id = $1",
        [customerId]
      );

      const activeOrdersResult = await pool.query(
        `
        SELECT COUNT(*) FROM orders
        WHERE buyer_id = $1
        AND status NOT IN ('COMPLETED', 'CANCELLED')
        `,
        [customerId]
      );

      const completedOrdersResult = await pool.query(
        `
        SELECT COUNT(*) FROM orders
        WHERE buyer_id = $1 AND status = 'COMPLETED'
        `,
        [customerId]
      );

      res.json({
        totalOrders: Number(totalOrdersResult.rows[0].count),
        activeOrders: Number(activeOrdersResult.rows[0].count),
        completedOrders: Number(completedOrdersResult.rows[0].count)
      });
    } catch (err) {
      console.error("CUSTOMER DASHBOARD ERROR:", err);
      res.status(500).json({ error: "Failed to load customer dashboard" });
    }
  }
);

/**
 * =====================================
 * CUSTOMER ORDERS LIST
 * GET /customer/orders
 * =====================================
 */
router.get(
  "/orders",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const customerId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          o.id,
          o.created_at,
          o.status,
          o.total_amount,
          u.name AS seller_name
        FROM orders o
        JOIN users u ON u.id = o.seller_id
        WHERE o.buyer_id = $1
        ORDER BY o.created_at DESC
        `,
        [customerId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("CUSTOMER ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch customer orders" });
    }
  }
);

/**
 * =====================================
 * CUSTOMER CANCEL ORDER
 * PUT /customer/orders/:orderId/cancel
 * =====================================
 */
router.put(
  "/orders/:orderId/cancel",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const { orderId } = req.params;

      const result = await pool.query(
        `
        UPDATE orders
        SET status = 'CANCELLED'
        WHERE id = $1
          AND buyer_id = $2
          AND status = 'PLACED'
        RETURNING *
        `,
        [orderId, customerId]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          message: "Order cannot be cancelled"
        });
      }

      res.json({
        message: "Order cancelled successfully",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("CUSTOMER CANCEL ERROR:", err);
      res.status(500).json({ error: "Failed to cancel order" });
    }
  }
);

/**
 * ✅ CRITICAL LINE
 * MUST export router directly
 */
module.exports = router;
