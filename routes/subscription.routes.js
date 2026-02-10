/**
 * ======================================================
 * SUPPLIER PAYOUT ROUTES
 * Fabric2Fashion Backend (PRODUCTION SAFE)
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * CONFIG
 * ======================================================
 */
const PLATFORM_COMMISSION_PERCENT = 5;

/**
 * ======================================================
 * GET MY PAYOUTS (SUPPLIER)
 * GET /supplier/payouts
 * ======================================================
 */
router.get(
  "/payouts",
  auth,
  authorize("supplier"),
  async (req, res) => {
    try {
      const supplierId = req.user.id;

      const { rows } = await pool.query(
        `
        SELECT
          p.id,
          p.payout_status,
          p.invoice_amount AS gross_amount,
          p.platform_commission,
          p.payable_amount,
          p.payout_mode,
          p.transaction_ref,
          p.paid_at,

          i.invoice_no
        FROM supplier_payouts p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE p.supplier_id = $1
        ORDER BY p.paid_at DESC NULLS LAST
        `,
        [supplierId]
      );

      res.json(rows);
    } catch (err) {
      console.error("SUPPLIER PAYOUT FETCH ERROR:", err);
      res.status(500).json({
        error: "Failed to load supplier payouts"
      });
    }
  }
);

module.exports = router;
