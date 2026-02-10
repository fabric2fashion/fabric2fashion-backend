const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ===============================
 * ASSIGN DELIVERY PARTNER
 * Supplier / Retailer / Tailor
 * ===============================
 */
router.put(
  "/assign/:orderId",
  auth,
  authorize(["supplier", "retailer", "tailor"]),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { delivery_partner_id } = req.body;

      if (!delivery_partner_id) {
        return res.status(400).json({
          message: "delivery_partner_id required"
        });
      }

      const result = await pool.query(
        `UPDATE orders
         SET delivery_partner_id = $1,
             delivery_status = 'ASSIGNED'
         WHERE id = $2
         RETURNING *`,
        [delivery_partner_id, orderId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Order not found"
        });
      }

      res.json({
        message: "Delivery partner assigned",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("ASSIGN DELIVERY ERROR:", err);
      res.status(500).json({ error: "Failed to assign delivery" });
    }
  }
);

/**
 * ===============================
 * VIEW ASSIGNED DELIVERIES
 * Delivery Partner ONLY
 * ===============================
 */
router.get(
  "/my",
  auth,
  authorize("delivery"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM orders
         WHERE delivery_partner_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      res.json({
        deliveries: result.rows
      });
    } catch (err) {
      console.error("FETCH DELIVERY ERROR:", err);
      res.status(500).json({ error: "Failed to fetch deliveries" });
    }
  }
);

/**
 * ===============================
 * UPDATE DELIVERY STATUS
 * Delivery Partner ONLY
 * ===============================
 */
router.put(
  "/status/:orderId",
  auth,
  authorize("delivery"),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const allowed = [
        "PICKED_UP",
        "IN_TRANSIT",
        "DELIVERED"
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: "Invalid delivery status"
        });
      }

      const result = await pool.query(
        `UPDATE orders
         SET delivery_status = $1
         WHERE id = $2
           AND delivery_partner_id = $3
         RETURNING *`,
        [status, orderId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Order not found or unauthorized"
        });
      }

      res.json({
        message: "Delivery status updated",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("UPDATE DELIVERY STATUS ERROR:", err);
      res.status(500).json({ error: "Failed to update delivery status" });
    }
  }
);

module.exports = router;
