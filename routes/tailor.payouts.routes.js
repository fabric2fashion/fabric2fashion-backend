const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * =========================================
 * TAILOR – VIEW MY PAYOUTS
 * =========================================
 */
router.get(
  "/payouts",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          p.id,
          i.invoice_no,
          p.gross_amount,
          p.commission,
          p.payable_amount,
          p.payout_reference,
          p.payout_status,
          p.paid_at
        FROM tailor_payouts p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE p.tailor_id = $1
        ORDER BY p.paid_at DESC
        `,
        [req.user.id]
      );

      res.json(rows);
    } catch (err) {
      console.error("TAILOR PAYOUT FETCH ERROR:", err);
      res.status(500).json({ error: "Failed to fetch payouts" });
    }
  }
);

module.exports = router;
