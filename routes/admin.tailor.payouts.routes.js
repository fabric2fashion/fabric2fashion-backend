/**
 * ======================================================
 * ADMIN – TAILOR PAYOUT & SETTLEMENT
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * GET UNPAID INVOICES FOR TAILOR
 * ======================================================
 */
router.get(
  "/payouts/unpaid/:tailorId",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { tailorId } = req.params;

      const { rows } = await pool.query(
        `
        SELECT
          i.id AS invoice_id,
          i.invoice_no,
          i.amount,
          i.created_at,
          (i.amount * 0.90) AS payable -- 10% commission
        FROM invoices i
        LEFT JOIN invoice_payouts ip ON ip.invoice_id = i.id
        WHERE i.tailor_id = $1
          AND ip.invoice_id IS NULL
        ORDER BY i.created_at
        `,
        [tailorId]
      );

      res.json(rows);
    } catch (err) {
      console.error("FETCH UNPAID INVOICES ERROR:", err);
      res.status(500).json({ error: "Failed to load unpaid invoices" });
    }
  }
);

/**
 * ======================================================
 * CREATE PAYOUT (ADMIN)
 * ======================================================
 */
router.post(
  "/payouts",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        tailor_id,
        invoice_ids,
        payout_mode,
        reference_no,
        notes
      } = req.body;

      if (!tailor_id || !invoice_ids?.length) {
        return res.status(400).json({
          message: "Tailor and invoice list required"
        });
      }

      await client.query("BEGIN");

      // 1️⃣ Calculate payable
      const invoiceRes = await client.query(
        `
        SELECT id, amount
        FROM invoices
        WHERE id = ANY($1)
        `,
        [invoice_ids]
      );

      const total = invoiceRes.rows.reduce(
        (sum, i) => sum + Number(i.amount) * 0.9,
        0
      );

      // 2️⃣ Create payout
      const payoutRes = await client.query(
        `
        INSERT INTO tailor_payouts
          (tailor_id, amount, payout_mode, reference_no, notes, paid_by)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        `,
        [
          tailor_id,
          total.toFixed(2),
          payout_mode || "manual",
          reference_no || null,
          notes || null,
          req.user.id
        ]
      );

      // 3️⃣ Lock invoices
      for (const inv of invoice_ids) {
        await client.query(
          `
          INSERT INTO invoice_payouts (invoice_id, payout_id)
          VALUES ($1,$2)
          `,
          [inv, payoutRes.rows[0].id]
        );
      }

      await client.query("COMMIT");

      res.json({
        message: "Tailor payout completed",
        payout: payoutRes.rows[0]
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("TAILOR PAYOUT ERROR:", err);
      res.status(500).json({ error: "Failed to process payout" });
    } finally {
      client.release();
    }
  }
);

/**
 * ======================================================
 * VIEW PAYOUT HISTORY (ADMIN)
 * ======================================================
 */
router.get(
  "/payouts",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          p.id,
          p.amount,
          p.paid_at,
          p.payout_mode,
          p.reference_no,
          u.name AS tailor_name
        FROM tailor_payouts p
        JOIN users u ON u.id = p.tailor_id
        ORDER BY p.paid_at DESC
        `
      );

      res.json(rows);
    } catch (err) {
      console.error("PAYOUT HISTORY ERROR:", err);
      res.status(500).json({ error: "Failed to fetch payouts" });
    }
  }
);

module.exports = router;
