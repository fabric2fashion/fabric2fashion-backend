/**
 * ======================================================
 * CUSTOMER – TAILORING ORDERS
 * REVIEW → CONFIRM → DELIVERY CONFIRMATION
 * Fabric2Fashion Backend
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * GET CUSTOMER TAILORING ORDERS
 * ======================================================
 */
router.get(
  "/tailoring-orders",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          o.id,
          o.status,
          o.price,
          o.delivery_date,
          o.created_at,
          o.completed_at,
          o.delivered_at,

          g.name AS garment_name,

          t.name AS tailor_name,
          t.mobile AS tailor_mobile
        FROM tailoring_orders o
        JOIN garments g ON g.id = o.garment_id
        JOIN users t ON t.id = o.tailor_id
        WHERE o.customer_id = $1
        ORDER BY o.created_at DESC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("CUSTOMER FETCH TAILORING ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  }
);

/**
 * ======================================================
 * CONFIRM TAILOR QUOTE
 * Status flow: QUOTED → CONFIRMED
 * ======================================================
 */
router.patch(
  "/tailoring-orders/:orderId/confirm",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const result = await pool.query(
        `
        UPDATE tailoring_orders
        SET status = 'CONFIRMED'
        WHERE id = $1
          AND customer_id = $2
          AND status = 'QUOTED'
        RETURNING *
        `,
        [orderId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          message: "Order not found or not in QUOTED state"
        });
      }

      res.json({
        message: "Order confirmed successfully",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("CONFIRM ORDER ERROR:", err);
      res.status(500).json({ error: "Failed to confirm order" });
    }
  }
);

/**
 * ======================================================
 * CONFIRM DELIVERY
 * Status flow: COMPLETED → DELIVERED
 * ======================================================
 */
router.patch(
  "/tailoring-orders/:orderId/confirm-delivery",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE tailoring_orders
        SET status = 'DELIVERED',
            delivered_at = NOW()
        WHERE id = $1
          AND customer_id = $2
          AND status = 'COMPLETED'
        RETURNING *
        `,
        [req.params.orderId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          message: "Order not completed or not yours"
        });
      }

      res.json({
        message: "Delivery confirmed successfully",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("CONFIRM DELIVERY ERROR:", err);
      res.status(500).json({ error: "Failed to confirm delivery" });
    }
  }
);

module.exports = router;
