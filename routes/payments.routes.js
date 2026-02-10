/**
 * ======================================================
 * PAYMENTS ROUTES
 * Fabric2Fashion Backend
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");

const router = express.Router();

/**
 * ======================================================
 * 1️⃣ CREATE PAYMENT – NORMAL ORDER (PRODUCT FLOW)
 * ======================================================
 * Body: { order_id, amount, payment_mode }
 * payer_id & payer_role derived from JWT
 */
router.post("/", auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { order_id, amount, payment_mode } = req.body;
    const payer_id = req.user.id;
    const payer_role = req.user.role;

    if (!order_id || !amount || !payment_mode) {
      return res.status(400).json({ message: "Missing payment fields" });
    }

    await client.query("BEGIN");

    // 🔎 Check order exists
    const orderRes = await client.query(
      `SELECT id, status FROM orders WHERE id = $1`,
      [order_id]
    );

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Order not found" });
    }

    // 💾 Insert payment
    const paymentRes = await client.query(
      `
      INSERT INTO payments
        (order_id, payer_id, payer_role, amount, payment_mode, payment_status)
      VALUES ($1, $2, $3, $4, $5, 'paid')
      RETURNING *
      `,
      [order_id, payer_id, payer_role, amount, payment_mode]
    );

    // ✅ Update order status
    await client.query(
      `
      UPDATE orders
      SET status = 'accepted'
      WHERE id = $1
      `,
      [order_id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Payment successful",
      payment: paymentRes.rows[0]
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PAYMENT ERROR (ORDER):", err);
    res.status(500).json({ error: "Payment failed" });
  } finally {
    client.release();
  }
});

/**
 * ======================================================
 * 2️⃣ CREATE PAYMENT – TAILORING ORDER
 * ======================================================
 * Status flow: CONFIRMED → PAID
 */
router.post("/tailoring/:orderId/pay", auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const { orderId } = req.params;
    const { payment_mode } = req.body;
    const payer_id = req.user.id;

    await client.query("BEGIN");

    // 🔎 Fetch tailoring order
    const orderRes = await client.query(
      `
      SELECT id, price, status
      FROM tailoring_orders
      WHERE id = $1 AND customer_id = $2
      `,
      [orderId, payer_id]
    );

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Tailoring order not found" });
    }

    const order = orderRes.rows[0];

    if (order.status !== "CONFIRMED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Order must be CONFIRMED before payment"
      });
    }

    // 💾 Insert payment
    const paymentRes = await client.query(
      `
      INSERT INTO payments
        (order_id, payer_id, payer_role, amount, payment_mode, payment_status)
      VALUES ($1, $2, 'customer', $3, $4, 'paid')
      RETURNING *
      `,
      [orderId, payer_id, order.price, payment_mode || "MANUAL"]
    );

    // ✅ Update tailoring order status
    await client.query(
      `
      UPDATE tailoring_orders
      SET status = 'PAID'
      WHERE id = $1
      `,
      [orderId]
    );

    await client.query("COMMIT");

    res.json({
      message: "Tailoring payment successful",
      payment: paymentRes.rows[0]
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PAYMENT ERROR (TAILORING):", err);
    res.status(500).json({ error: "Tailoring payment failed" });
  } finally {
    client.release();
  }
});

/**
 * ======================================================
 * 3️⃣ VIEW MY PAYMENTS (CUSTOMER / ANY USER)
 * ======================================================
 */
router.get("/my", auth, async (req, res) => {
  try {
    const payer_id = req.user.id;

    const result = await pool.query(
      `
      SELECT
        id,
        order_id,
        amount,
        payment_mode,
        payment_status,
        created_at
      FROM payments
      WHERE payer_id = $1
      ORDER BY created_at DESC
      `,
      [payer_id]
    );

    res.json({ payments: result.rows });

  } catch (err) {
    console.error("FETCH MY PAYMENTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

/**
 * ======================================================
 * 4️⃣ SUPPLIER / TAILOR – VIEW RECEIVED PAYMENTS
 * ======================================================
 */
router.get("/received", auth, async (req, res) => {
  try {
    if (!["supplier", "tailor"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.order_id,
        p.amount,
        p.payment_mode,
        p.created_at
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.seller_id = $1
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );

    res.json({ payments: result.rows });

  } catch (err) {
    console.error("FETCH RECEIVED PAYMENTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch received payments" });
  }
});

module.exports = router;
