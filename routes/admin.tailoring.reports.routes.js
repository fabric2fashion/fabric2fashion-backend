/**
 * ======================================================
 * ADMIN – TAILORING REVENUE REPORTS
 * Fabric2Fashion Backend (SAFE + FINAL)
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * CONFIG (SAFE TO CHANGE)
 * ======================================================
 */
const PLATFORM_COMMISSION_PERCENT = 10; // example: 10%

/**
 * ======================================================
 * ADMIN – DETAILED TAILORING REVENUE REPORT
 * GET /admin/reports/tailoring-revenue
 * ======================================================
 */
router.get(
  "/tailoring-revenue",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { from, to, tailor_id } = req.query;

      const conditions = [];
      const values = [];
      let idx = 1;

      if (from) {
        conditions.push(`i.created_at >= $${idx++}`);
        values.push(from);
      }

      if (to) {
        conditions.push(`i.created_at <= $${idx++}`);
        values.push(to);
      }

      if (tailor_id) {
        conditions.push(`i.tailor_id = $${idx++}`);
        values.push(tailor_id);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows } = await pool.query(
        `
        SELECT
          i.invoice_no,
          i.amount,
          i.created_at AS invoice_date,

          o.id AS tailoring_order_id,

          g.name AS garment_name,

          t.id AS tailor_id,
          t.name AS tailor_name,

          c.name AS customer_name,
          c.mobile AS customer_mobile
        FROM invoices i
        JOIN tailoring_orders o ON o.id = i.tailoring_order_id
        JOIN garments g ON g.id = o.garment_id
        JOIN users t ON t.id = i.tailor_id
        JOIN users c ON c.id = i.customer_id
        ${whereClause}
        ORDER BY i.created_at DESC
        `,
        values
      );

      const enriched = rows.map(r => {
        const commission =
          (Number(r.amount) * PLATFORM_COMMISSION_PERCENT) / 100;

        return {
          ...r,
          platform_commission: commission.toFixed(2),
          tailor_payable: (r.amount - commission).toFixed(2)
        };
      });

      res.json({
        total_records: enriched.length,
        total_revenue: enriched.reduce(
          (sum, r) => sum + Number(r.amount),
          0
        ),
        records: enriched
      });
    } catch (err) {
      console.error("ADMIN TAILORING REVENUE ERROR:", err);
      res.status(500).json({
        error: "Failed to generate tailoring revenue report"
      });
    }
  }
);

/**
 * ======================================================
 * ADMIN – TAILOR-WISE SUMMARY
 * GET /admin/reports/tailoring-revenue/summary/tailor
 * ======================================================
 */
router.get(
  "/tailoring-revenue/summary/tailor",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          t.id AS tailor_id,
          t.name AS tailor_name,
          COUNT(i.id) AS total_orders,
          SUM(i.amount) AS total_revenue
        FROM invoices i
        JOIN users t ON t.id = i.tailor_id
        GROUP BY t.id, t.name
        ORDER BY total_revenue DESC
        `
      );

      res.json(rows);
    } catch (err) {
      console.error("TAILOR SUMMARY ERROR:", err);
      res.status(500).json({
        error: "Failed to fetch tailor summary"
      });
    }
  }
);

/**
 * ======================================================
 * ADMIN – GARMENT-WISE SUMMARY
 * GET /admin/reports/tailoring-revenue/summary/garment
 * ======================================================
 */
router.get(
  "/tailoring-revenue/summary/garment",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          g.name AS garment_name,
          COUNT(i.id) AS total_orders,
          SUM(i.amount) AS total_revenue
        FROM invoices i
        JOIN tailoring_orders o ON o.id = i.tailoring_order_id
        JOIN garments g ON g.id = o.garment_id
        GROUP BY g.name
        ORDER BY total_revenue DESC
        `
      );

      res.json(rows);
    } catch (err) {
      console.error("GARMENT SUMMARY ERROR:", err);
      res.status(500).json({
        error: "Failed to fetch garment summary"
      });
    }
  }
);

/**
 * ======================================================
 * ADMIN – CSV EXPORT (EXCEL SAFE)
 * GET /admin/reports/tailoring-revenue/export
 * ======================================================
 */
router.get(
  "/tailoring-revenue/export",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { from, to, tailor_id } = req.query;

      const conditions = [];
      const values = [];
      let idx = 1;

      if (from) {
        conditions.push(`i.created_at >= $${idx++}`);
        values.push(from);
      }

      if (to) {
        conditions.push(`i.created_at <= $${idx++}`);
        values.push(to);
      }

      if (tailor_id) {
        conditions.push(`i.tailor_id = $${idx++}`);
        values.push(tailor_id);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const { rows } = await pool.query(
        `
        SELECT
          i.invoice_no,
          i.created_at AS invoice_date,
          t.name AS tailor_name,
          c.name AS customer_name,
          g.name AS garment_name,
          i.amount
        FROM invoices i
        JOIN tailoring_orders o ON o.id = i.tailoring_order_id
        JOIN garments g ON g.id = o.garment_id
        JOIN users t ON t.id = i.tailor_id
        JOIN users c ON c.id = i.customer_id
        ${whereClause}
        ORDER BY i.created_at DESC
        `,
        values
      );

      let csv =
        "Invoice No,Invoice Date,Tailor,Customer,Garment,Amount,Commission,Payable\n";

      rows.forEach(r => {
        const commission =
          (Number(r.amount) * PLATFORM_COMMISSION_PERCENT) / 100;
        const payable = r.amount - commission;

        csv +=
          `"${r.invoice_no}",` +
          `"${new Date(r.invoice_date).toISOString()}",` +
          `"${r.tailor_name}",` +
          `"${r.customer_name}",` +
          `"${r.garment_name}",` +
          `"${r.amount}",` +
          `"${commission.toFixed(2)}",` +
          `"${payable.toFixed(2)}"\n`;
      });

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=tailoring-revenue-report.csv"
      );
      res.setHeader("Content-Type", "text/csv");

      res.send(csv);
    } catch (err) {
      console.error("CSV EXPORT ERROR:", err);
      res.status(500).json({
        error: "Failed to export tailoring revenue CSV"
      });
    }
  }
);

module.exports = router;
