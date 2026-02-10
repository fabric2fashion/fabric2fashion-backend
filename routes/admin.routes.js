const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ===============================
 * VIEW ALL USERS
 * GET /admin/users?status=pending
 * ===============================
 */
router.get(
  "/users",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { status } = req.query;

      let query = `
        SELECT id, name, mobile, email, role,
               approval_status, is_active, created_at
        FROM users
      `;
      const params = [];

      if (status) {
        query += ` WHERE approval_status = $1`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error("FETCH USERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);

/**
 * ===============================
 * APPROVE / REJECT USER
 * PATCH /admin/users/:userId
 * ===============================
 */
router.patch(
  "/users/:userId",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET approval_status = $1,
            is_active = $2
        WHERE id = $3
        RETURNING *
        `,
        [status, status === "approved", userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: `User ${status}`,
        user: result.rows[0]
      });
    } catch (err) {
      console.error("UPDATE USER ERROR:", err);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);

/**
 * ===============================
 * ADMIN REPORTS (READ ONLY)
 * GET /admin/reports?fromDate=&toDate=&role=
 * ===============================
 */
router.get(
  "/reports",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { fromDate, toDate, role } = req.query;

      const conditions = [];
      const values = [];
      let i = 1;

      if (fromDate) {
        conditions.push(`o.created_at >= $${i++}`);
        values.push(fromDate);
      }

      if (toDate) {
        conditions.push(`o.created_at <= $${i++}`);
        values.push(toDate);
      }

      if (role) {
        conditions.push(`seller.role = $${i++}`);
        values.push(role);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const query = `
        SELECT
          o.id AS order_id,
          o.created_at,
          o.total_amount,
          o.status AS order_status,

          seller.id AS seller_id,
          seller.name AS seller_name,
          seller.role AS seller_role,

          buyer.name AS buyer_name,

          p.status AS payment_status
        FROM orders o
        JOIN users seller ON seller.id = o.seller_id
        JOIN users buyer ON buyer.id = o.buyer_id
        LEFT JOIN payments p ON p.order_id = o.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT 500
      `;

      const result = await pool.query(query, values);
      res.json(result.rows);
    } catch (err) {
      console.error("ADMIN REPORT ERROR:", err);
      res.status(500).json({ error: "Failed to generate report" });
    }
  }
);

/**
 * ===============================
 * VIEW ALL ORDERS (ADMIN)
 * GET /admin/orders
 * ===============================
 */
router.get(
  "/orders",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM orders ORDER BY created_at DESC`
      );
      res.json({ orders: result.rows });
    } catch (err) {
      console.error("FETCH ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  }
);

/**
 * ===============================
 * UPDATE ORDER STATUS
 * PUT /admin/orders/status/:orderId
 * ===============================
 */
router.put(
  "/orders/status/:orderId",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const allowedStatuses = [
        "PLACED",
        "ACCEPTED",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid order status" });
      }

      const result = await pool.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2
        RETURNING *
        `,
        [status, orderId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json({
        message: "Order status updated",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("UPDATE ORDER STATUS ERROR:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  }
);
/**
 * ===============================
 * EXPORT ADMIN REPORTS (CSV)
 * GET /admin/reports/export
 * ===============================
 */
router.get(
  "/reports/export",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { fromDate, toDate, role } = req.query;

      const conditions = [];
      const values = [];
      let i = 1;

      if (fromDate) {
        conditions.push(`o.created_at >= $${i++}`);
        values.push(fromDate);
      }

      if (toDate) {
        conditions.push(`o.created_at <= $${i++}`);
        values.push(toDate);
      }

      if (role) {
        conditions.push(`seller.role = $${i++}`);
        values.push(role);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const query = `
        SELECT
          o.id AS order_id,
          o.created_at,
          o.total_amount,
          o.status AS order_status,
          seller.name AS seller_name,
          seller.role AS seller_role,
          buyer.name AS buyer_name,
          p.status AS payment_status
        FROM orders o
        JOIN users seller ON seller.id = o.seller_id
        JOIN users buyer ON buyer.id = o.buyer_id
        LEFT JOIN payments p ON p.order_id = o.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT 1000
      `;

      const result = await pool.query(query, values);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=admin_reports.csv"
      );

      // CSV Header
      res.write(
        "Order ID,Created At,Amount,Order Status,Seller Name,Seller Role,Buyer Name,Payment Status\n"
      );

      result.rows.forEach(row => {
        res.write(
          `${row.order_id},${row.created_at},${row.total_amount},${row.order_status},` +
          `${row.seller_name},${row.seller_role},${row.buyer_name},${row.payment_status || ""}\n`
        );
      });

      res.end();
    } catch (err) {
      console.error("EXPORT REPORT ERROR:", err);
      res.status(500).json({ error: "Failed to export report" });
    }
  }
);

module.exports = router;
