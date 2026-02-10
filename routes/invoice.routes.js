/**
 * ======================================================
 * INVOICE / RECEIPT ROUTES
 * Fabric2Fashion Backend (PRODUCTION READY)
 * ======================================================
 */

const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");
const { calculateCommission } = require("../utils/commission");

const router = express.Router();

/**
 * ======================================================
 * GENERATE INVOICE
 * Rules:
 *  - Tailoring order must be DELIVERED
 *  - Payment must be PAID
 *  - Only ONE invoice per tailoring order
 *  - CUSTOMER only
 * ======================================================
 */
router.post(
  "/generate/:tailoringOrderId",
  auth,
  authorize("customer"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { tailoringOrderId } = req.params;
      const customerId = req.user.id;

      await client.query("BEGIN");

      /* 1️⃣ Validate order + payment + delivery */
      const { rows } = await client.query(
        `
        SELECT
          o.id,
          o.price,
          o.customer_id,
          o.tailor_id,
          p.id AS payment_id
        FROM tailoring_orders o
        JOIN payments p ON p.order_id = o.id
        WHERE o.id = $1
          AND o.customer_id = $2
          AND o.status = 'DELIVERED'
          AND p.payment_status = 'paid'
        FOR UPDATE
        `,
        [tailoringOrderId, customerId]
      );

      if (!rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Order not delivered or payment not completed"
        });
      }

      /* 2️⃣ Prevent duplicate invoice (DB-safe) */
      const duplicate = await client.query(
        `SELECT id FROM invoices WHERE tailoring_order_id = $1`,
        [tailoringOrderId]
      );

      if (duplicate.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Invoice already exists for this order"
        });
      }

      const order = rows[0];

      /* 3️⃣ Generate readable + unique invoice number */
      const year = new Date().getFullYear();
      const invoiceNo = `INV-${year}-${order.id}`;

      /* 4️⃣ Insert invoice */
      const invoiceRes = await client.query(
        `
        INSERT INTO invoices
          (invoice_no, tailoring_order_id, payment_id,
           customer_id, tailor_id, amount)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        `,
        [
          invoiceNo,
          order.id,
          order.payment_id,
          order.customer_id,
          order.tailor_id,
          order.price
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Invoice generated successfully",
        invoice: invoiceRes.rows[0]
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("INVOICE GENERATION ERROR:", err);
      res.status(500).json({ error: "Failed to generate invoice" });
    } finally {
      client.release();
    }
  }
);

/**
 * ======================================================
 * DOWNLOAD INVOICE PDF
 * Access:
 *  - CUSTOMER → own invoice
 *  - TAILOR   → own invoice
 *  - SUPER_ADMIN → all
 * ======================================================
 */
router.get("/:invoiceId/pdf", auth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { id: userId, role } = req.user;

    const { rows } = await pool.query(
      `
      SELECT
        i.invoice_no,
        i.amount,
        i.created_at,
        i.customer_id,
        i.tailor_id,

        c.name AS customer_name,
        c.mobile AS customer_mobile,

        t.name AS tailor_name,
        t.mobile AS tailor_mobile,

        g.name AS garment_name
      FROM invoices i
      JOIN tailoring_orders o ON o.id = i.tailoring_order_id
      JOIN garments g ON g.id = o.garment_id
      JOIN users c ON c.id = i.customer_id
      JOIN users t ON t.id = i.tailor_id
      WHERE i.id = $1
      `,
      [invoiceId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const inv = rows[0];

    /* 🔐 Access control */
    if (
      (role === "customer" && inv.customer_id !== userId) ||
      (role === "tailor" && inv.tailor_id !== userId)
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { commission, payable } = calculateCommission(inv.amount);

    /* 🧾 PDF generation */
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${inv.invoice_no}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(22).text("Fabric2Fashion", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text("INVOICE", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text(`Invoice No: ${inv.invoice_no}`);
    doc.text(`Date: ${new Date(inv.created_at).toDateString()}`);
    doc.moveDown();

    doc.text(`Customer: ${inv.customer_name}`);
    doc.text(`Mobile: ${inv.customer_mobile}`);
    doc.moveDown();

    doc.text(`Tailor: ${inv.tailor_name}`);
    doc.text(`Tailor Mobile: ${inv.tailor_mobile}`);
    doc.moveDown();

    doc.text("Order Details", { underline: true });
    doc.moveDown(0.5);
    doc.text(`Garment: ${inv.garment_name}`);
    doc.text(`Total Amount: ₹${Number(inv.amount).toFixed(2)}`);
    doc.text(`Platform Commission (5%): ₹${commission}`);
    doc.text(`Tailor Payable: ₹${payable}`);

    doc.moveDown(2);
    doc.fontSize(10).text(
      "This is a system generated invoice. Thank you for using Fabric2Fashion.",
      { align: "center" }
    );

    doc.end();

  } catch (err) {
    console.error("INVOICE PDF ERROR:", err);
    res.status(500).json({ error: "Failed to generate invoice PDF" });
  }
});

/**
 * ======================================================
 * VIEW MY INVOICES (CUSTOMER)
 * ======================================================
 */
router.get(
  "/my",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          i.id,
          i.invoice_no,
          i.amount,
          i.created_at,
          g.name AS garment_name,
          t.name AS tailor_name
        FROM invoices i
        JOIN tailoring_orders o ON o.id = i.tailoring_order_id
        JOIN garments g ON g.id = o.garment_id
        JOIN users t ON t.id = i.tailor_id
        WHERE i.customer_id = $1
        ORDER BY i.created_at DESC
        `,
        [req.user.id]
      );

      res.json(rows);
    } catch (err) {
      console.error("FETCH INVOICES ERROR:", err);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  }
);

module.exports = router;
