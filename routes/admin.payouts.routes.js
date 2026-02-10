/**
 * ======================================================
 * ADMIN – PAYOUT & SETTLEMENT ROUTES
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

const PLATFORM_COMMISSION_PERCENT = 5;

/**
 * ======================================================
 * GET ALL PENDING PAYOUTS
 * ======================================================
 */
router.get(
  "/payouts/pending",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          i.id AS invoice_id,
          i.invoice_no,
          i.amount AS gross_amount,
          u.id AS user_id,
          u.role AS user_role,
          u.name AS user_name,

          ROUND(i.amount * ${PLATFORM_COMMISSION_PERCENT} / 100, 2) AS platform_commission,
          ROUND(i.amount - (i.amount * ${PLATFORM_COMMISSION_PERCENT} / 100), 2) AS payable_amount

        FROM invoices i
        JOIN users u ON u.id = i.seller_id
        LEFT JOIN platform_payouts p ON p.invoice_id = i.id
        WHERE p.id IS NULL
        ORDER BY i.created_at ASC
      `);

      res.json(rows);
    } catch (err) {
      console.error("FETCH PENDING PAYOUTS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch pending payouts" });
    }
  }
);

/**
 * ======================================================
 * MARK PAYOUT AS PAID
 * ======================================================
 */
router.post(
  "/payouts/pay",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { invoice_id, payout_mode, transaction_ref } = req.body;

      await client.query("BEGIN");

      const inv = await client.query(
        `SELECT id, seller_id, total_amount FROM invoices WHERE id = $1`,
        [invoice_id]
      );

      if (!inv.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Invoice not found" });
      }

      const invoice = inv.rows[0];
      const commission = (invoice.total_amount * PLATFORM_COMMISSION_PERCENT) / 100;
      const payable = invoice.total_amount - commission;

      await client.query(
        `
        INSERT INTO platform_payouts
          (invoice_id, user_id, user_role, gross_amount,
           platform_commission, payable_amount,
           payout_status, payout_mode, transaction_ref, paid_at)
        VALUES ($1,$2,'supplier',$3,$4,$5,'PAID',$6,$7,NOW())
        `,
        [
          invoice.id,
          invoice.seller_id,
          invoice.total_amount,
          commission,
          payable,
          payout_mode || "manual",
          transaction_ref || null
        ]
      );

      await client.query("COMMIT");

      res.json({ message: "Payout marked as PAID" });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PAYOUT ERROR:", err);
      res.status(500).json({ error: "Failed to process payout" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
