/**
 * ======================================================
 * PAYOUT STATUS ROUTES (TAILOR / RETAILER / SUPPLIER)
 * Fabric2Fashion Backend — FINAL & UNIFIED
 * ======================================================
 *
 * Rules:
 * - Applies ONLY to tailor / retailer / supplier
 * - 5% platform commission (already calculated & stored)
 * - Users can ONLY view their own payouts
 * - Admin handles settlement separately
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");

const router = express.Router();

/**
 * ======================================================
 * GET MY PAYOUTS
 * GET /payouts/my
 * ======================================================
 */
router.get("/my", auth, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    // ✅ Allow only payout-capable roles
    if (!["tailor", "retailer", "supplier"].includes(role)) {
      return res.status(403).json({
        message: "Payouts not applicable for this role"
      });
    }

    /**
     * NOTE:
     * - NO invoice join assumption
     * - Works for tailoring, retailer orders, supplier sales
     * - reference_type + reference_id tells the source
     */
    const { rows } = await pool.query(
      `
      SELECT
        reference_type,
        reference_id,
        gross_amount,
        platform_commission,
        payable_amount,
        payout_status,
        payout_mode,
        transaction_ref,
        paid_at,
        created_at
      FROM platform_payouts
      WHERE user_id = $1
        AND role = $2
      ORDER BY paid_at DESC NULLS LAST, created_at DESC
      `,
      [userId, role]
    );

    res.json(rows);

  } catch (err) {
    console.error("MY PAYOUTS ERROR:", err);
    res.status(500).json({
      error: "Failed to load payouts"
    });
  }
});

module.exports = router;
