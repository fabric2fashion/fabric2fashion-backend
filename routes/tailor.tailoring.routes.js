/**
 * ======================================================
 * TAILOR – TAILORING ORDERS WORKFLOW
 * QUOTE → PAID → IN_PROGRESS → COMPLETED
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * GET ALL TAILORING ORDERS (TAILOR)
 * ======================================================
 */
router.get(
  "/tailoring-orders",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          o.id,
          o.status,
          o.price,
          o.delivery_date,
          o.work_started_at,
          o.completed_at,
          o.created_at,

          g.name AS garment_name,

          u.name AS customer_name,
          u.mobile AS customer_mobile
        FROM tailoring_orders o
        JOIN garments g ON g.id = o.garment_id
        JOIN users u ON u.id = o.customer_id
        WHERE o.tailor_id = $1
        ORDER BY o.created_at DESC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("TAILOR FETCH ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch tailoring orders" });
    }
  }
);

/**
 * ======================================================
 * SET PRICE & DELIVERY DATE (QUOTE)
 * PLACED → QUOTED
 * ======================================================
 */
router.patch(
  "/tailoring-orders/:orderId/quote",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { price, delivery_date } = req.body;

      if (!price || !delivery_date) {
        return res.status(400).json({
          message: "Price and delivery date required"
        });
      }

      const result = await pool.query(
        `
        UPDATE tailoring_orders
        SET price = $1,
            delivery_date = $2,
            status = 'QUOTED'
        WHERE id = $3
          AND tailor_id = $4
          AND status = 'PLACED'
        RETURNING *
        `,
        [price, delivery_date, orderId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          message: "Invalid order or state"
        });
      }

      res.json({
        message: "Quote submitted",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("QUOTE ERROR:", err);
      res.status(500).json({ error: "Failed to submit quote" });
    }
  }
);

/**
 * ======================================================
 * START WORK
 * PAID → IN_PROGRESS
 * ======================================================
 */
router.patch(
  "/tailoring-orders/:orderId/start-work",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE tailoring_orders
        SET status = 'IN_PROGRESS',
            work_started_at = NOW()
        WHERE id = $1
          AND tailor_id = $2
          AND status = 'PAID'
        RETURNING *
        `,
        [req.params.orderId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          message: "Order not in PAID state or not yours"
        });
      }

      res.json({
        message: "Work started",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("START WORK ERROR:", err);
      res.status(500).json({ error: "Failed to start work" });
    }
  }
);

/**
 * ======================================================
 * COMPLETE WORK
 * IN_PROGRESS → COMPLETED
 * ======================================================
 */
router.patch(
  "/tailoring-orders/:orderId/complete",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        UPDATE tailoring_orders
        SET status = 'COMPLETED',
            completed_at = NOW()
        WHERE id = $1
          AND tailor_id = $2
          AND status = 'IN_PROGRESS'
        RETURNING *
        `,
        [req.params.orderId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          message: "Order not in progress or not yours"
        });
      }

      res.json({
        message: "Work marked as completed",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("COMPLETE WORK ERROR:", err);
      res.status(500).json({ error: "Failed to complete work" });
    }
  }
);

module.exports = router;
