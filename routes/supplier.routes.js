const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * =====================================
 * SUPPLIER DASHBOARD SUMMARY
 * GET /supplier/dashboard/summary
 * =====================================
 */
router.get(
  "/dashboard/summary",
  auth,
  authorize("supplier"),
  async (req, res) => {
    try {
      const supplierId = req.user.id;

      const totalOrdersResult = await pool.query(
        "SELECT COUNT(*) FROM orders WHERE seller_id = $1",
        [supplierId]
      );

      const pendingOrdersResult = await pool.query(
        "SELECT COUNT(*) FROM orders WHERE seller_id = $1 AND status = 'PLACED'",
        [supplierId]
      );

      const completedOrdersResult = await pool.query(
        "SELECT COUNT(*) FROM orders WHERE seller_id = $1 AND status = 'COMPLETED'",
        [supplierId]
      );

      const revenueResult = await pool.query(
        `
        SELECT COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE seller_id = $1 AND status = 'COMPLETED'
        `,
        [supplierId]
      );

      res.json({
        totalOrders: Number(totalOrdersResult.rows[0].count),
        pendingOrders: Number(pendingOrdersResult.rows[0].count),
        completedOrders: Number(completedOrdersResult.rows[0].count),
        totalRevenue: Number(revenueResult.rows[0].revenue)
      });
    } catch (err) {
      console.error("SUPPLIER DASHBOARD ERROR:", err);
      res.status(500).json({ error: "Failed to load supplier dashboard" });
    }
  }
);

/**
 * =====================================
 * SUPPLIER ORDERS LIST
 * GET /supplier/orders
 * =====================================
 */
router.get(
  "/orders",
  auth,
  authorize("supplier"),
  async (req, res) => {
    try {
      const supplierId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          o.id,
          o.created_at,
          o.status,
          o.total_amount,
          u.name AS buyer_name
        FROM orders o
        JOIN users u ON u.id = o.buyer_id
        WHERE o.seller_id = $1
        ORDER BY o.created_at DESC
        `,
        [supplierId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("SUPPLIER ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch supplier orders" });
    }
  }
);

/**
 * =====================================
 * SUPPLIER UPDATE ORDER STATUS (LIMITED)
 * PUT /supplier/orders/:orderId/status
 * =====================================
 */
router.put(
  "/orders/:orderId/status",
  auth,
  authorize("supplier"),
  async (req, res) => {
    try {
      const supplierId = req.user.id;
      const { orderId } = req.params;
      const { status } = req.body;

      const allowedStatuses = [
        "ACCEPTED",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status update" });
      }

      const result = await pool.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2 AND seller_id = $3
        RETURNING *
        `,
        [status, orderId, supplierId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Order not found or not allowed"
        });
      }

      res.json({
        message: "Order status updated",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("SUPPLIER STATUS UPDATE ERROR:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  }
);

/**
 * ✅ CRITICAL: EXPORT ROUTER DIRECTLY
 */
module.exports = router;
