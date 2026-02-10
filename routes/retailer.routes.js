const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* =====================================================
   STEP 1 — ADD INVENTORY (MANUAL)
===================================================== */
router.post(
  "/inventory/items",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const {
        name,
        unit,
        cost_per_unit,
        stock_quantity,
        min_stock_quantity
      } = req.body;

      if (!name || !unit || !cost_per_unit || !stock_quantity) {
        return res.status(400).json({ error: "Missing fields" });
      }

      await pool.query(
        `
        INSERT INTO retailer_inventory_items
          (retailer_id, name, unit, cost_per_unit, stock_quantity, min_stock_quantity)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          req.user.id,
          name,
          unit,
          cost_per_unit,
          stock_quantity,
          min_stock_quantity || 10
        ]
      );

      res.json({ message: "Inventory item added" });
    } catch (err) {
      console.error("ADD INVENTORY ERROR:", err);
      res.status(500).json({ error: "Failed to add inventory item" });
    }
  }
);

/* =====================================================
   STEP 2 — VIEW INVENTORY
===================================================== */
router.get(
  "/inventory/items",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM retailer_inventory_items
        WHERE retailer_id = $1
        ORDER BY name
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("FETCH INVENTORY ERROR:", err);
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  }
);

/* =====================================================
   STEP 3 — CREATE ORDER + AUTO STOCK DEDUCTION
===================================================== */
router.post(
  "/orders",
  auth,
  authorize("retailer"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const retailerId = req.user.id;
      const { product_id, quantity, buyer_id } = req.body;

      if (!product_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: "Invalid order data" });
      }

      await client.query("BEGIN");

      const inventoryRes = await client.query(
        `
        SELECT id, stock_quantity
        FROM retailer_inventory_items
        WHERE retailer_id = $1
          AND product_id = $2
        FOR UPDATE
        `,
        [retailerId, product_id]
      );

      if (inventoryRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Inventory item not found" });
      }

      const item = inventoryRes.rows[0];

      if (item.stock_quantity < quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Insufficient stock",
          available: item.stock_quantity
        });
      }

      const productRes = await client.query(
        `SELECT price FROM products WHERE id = $1`,
        [product_id]
      );

      const price = productRes.rows[0].price;
      const totalAmount = price * quantity;

      const orderRes = await client.query(
        `
        INSERT INTO orders
          (buyer_id, seller_id, status, total_amount)
        VALUES ($1, $2, 'PLACED', $3)
        RETURNING *
        `,
        [buyer_id || null, retailerId, totalAmount]
      );

      await client.query(
        `
        UPDATE retailer_inventory_items
        SET stock_quantity = stock_quantity - $1
        WHERE id = $2
        `,
        [quantity, item.id]
      );

      await client.query("COMMIT");

      res.json({
        message: "Order placed successfully",
        order: orderRes.rows[0]
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("RETAILER ORDER ERROR:", err);
      res.status(500).json({ error: "Failed to place order" });
    } finally {
      client.release();
    }
  }
);

/* =====================================================
   STEP 4 — LOW STOCK ALERT
===================================================== */
router.get(
  "/inventory/low-stock",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM retailer_inventory_items
        WHERE retailer_id = $1
          AND stock_quantity <= min_stock_quantity
        ORDER BY stock_quantity ASC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("LOW STOCK ERROR:", err);
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  }
);

/* =====================================================
   STEP 8 — INVENTORY CSV UPLOAD
===================================================== */
router.post(
  "/inventory/upload-csv",
  auth,
  authorize("retailer"),
  upload.single("file"),
  async (req, res) => {
    const retailerId = req.user.id;
    const filePath = req.file.path;
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", data => rows.push(data))
      .on("end", async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          for (const r of rows) {
            const {
              name,
              unit,
              cost_per_unit,
              stock_quantity,
              min_stock_quantity
            } = r;

            const existing = await client.query(
              `
              SELECT id FROM retailer_inventory_items
              WHERE retailer_id = $1 AND name = $2
              `,
              [retailerId, name]
            );

            if (existing.rows.length > 0) {
              await client.query(
                `
                UPDATE retailer_inventory_items
                SET stock_quantity = stock_quantity + $1,
                    cost_per_unit = $2
                WHERE id = $3
                `,
                [
                  Number(stock_quantity),
                  Number(cost_per_unit),
                  existing.rows[0].id
                ]
              );
            } else {
              await client.query(
                `
                INSERT INTO retailer_inventory_items
                  (retailer_id, name, unit, cost_per_unit, stock_quantity, min_stock_quantity)
                VALUES ($1,$2,$3,$4,$5,$6)
                `,
                [
                  retailerId,
                  name,
                  unit,
                  Number(cost_per_unit),
                  Number(stock_quantity),
                  Number(min_stock_quantity) || 10
                ]
              );
            }
          }

          await client.query("COMMIT");
          res.json({ message: "CSV uploaded successfully" });

        } catch (err) {
          await client.query("ROLLBACK");
          console.error("CSV UPLOAD ERROR:", err);
          res.status(500).json({ error: "CSV upload failed" });
        } finally {
          fs.unlinkSync(filePath);
          client.release();
        }
      });
  }
);

/* =====================================================
   STEP 7 — RETAILER DASHBOARD KPIs
===================================================== */
router.get(
  "/dashboard/kpis",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const retailerId = req.user.id;
      const month = req.query.month || new Date().toISOString().slice(0, 7);

      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const ordersRes = await pool.query(
        `
        SELECT
          COUNT(*) AS total_orders,
          COUNT(*) FILTER (WHERE status = 'PLACED') AS placed,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
          COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE seller_id = $1
          AND created_at BETWEEN $2 AND $3
        `,
        [retailerId, startDate, endDate]
      );

      const stockRes = await pool.query(
        `
        SELECT COALESCE(SUM(stock_quantity * cost_per_unit),0) AS stock_value
        FROM retailer_inventory_items
        WHERE retailer_id = $1
        `,
        [retailerId]
      );

      const o = ordersRes.rows[0];

      res.json({
        month,
        orders: {
          total: Number(o.total_orders),
          placed: Number(o.placed),
          completed: Number(o.completed)
        },
        revenue: Number(o.revenue),
        stock_value: Number(stockRes.rows[0].stock_value),
        profit: Number(o.revenue) // STEP A logic
      });

    } catch (err) {
      console.error("RETAILER DASHBOARD ERROR:", err);
      res.status(500).json({ error: "Failed to load dashboard KPIs" });
    }
  }
);
/**
 * =====================================
 * RETAILER DASHBOARD SUMMARY
 * GET /retailer/dashboard/summary
 * =====================================
 */
router.get(
  "/dashboard/summary",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const retailerId = req.user.id;

      const totalOrders = await pool.query(
        `SELECT COUNT(*) FROM orders WHERE seller_id = $1`,
        [retailerId]
      );

      const pendingOrders = await pool.query(
        `SELECT COUNT(*) FROM orders WHERE seller_id = $1 AND status = 'PLACED'`,
        [retailerId]
      );

      const completedOrders = await pool.query(
        `SELECT COUNT(*) FROM orders WHERE seller_id = $1 AND status = 'COMPLETED'`,
        [retailerId]
      );

      const totalRevenue = await pool.query(
        `
        SELECT COALESCE(SUM(total_amount), 0)
        FROM orders
        WHERE seller_id = $1 AND status = 'COMPLETED'
        `,
        [retailerId]
      );

      res.json({
        totalOrders: Number(totalOrders.rows[0].count),
        pendingOrders: Number(pendingOrders.rows[0].count),
        completedOrders: Number(completedOrders.rows[0].count),
        totalRevenue: Number(totalRevenue.rows[0].coalesce)
      });
    } catch (err) {
      console.error("RETAILER DASHBOARD ERROR:", err);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  }
);

/**
 * =====================================
 * RETAILER ORDERS LIST
 * GET /retailer/orders
 * =====================================
 */
router.get(
  "/orders",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const retailerId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          o.id,
          o.created_at,
          o.total_amount,
          o.status,
          u.name AS buyer_name
        FROM orders o
        JOIN users u ON u.id = o.buyer_id
        WHERE o.seller_id = $1
        ORDER BY o.created_at DESC
        `,
        [retailerId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("RETAILER ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  }
);

/**
 * =====================================
 * RETAILER UPDATE ORDER STATUS (LIMITED)
 * PUT /retailer/orders/:orderId/status
 * =====================================
 */
router.put(
  "/orders/:orderId/status",
  auth,
  authorize("retailer"),
  async (req, res) => {
    try {
      const retailerId = req.user.id;
      const { orderId } = req.params;
      const { status } = req.body;

      const allowedStatuses = ["ACCEPTED", "REJECTED", "IN_PROGRESS"];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status update" });
      }

      const result = await pool.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2 AND seller_id = $3
        RETURNING *
        `,
        [status, orderId, retailerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Order not found or not allowed" });
      }

      res.json({
        message: "Order status updated",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("RETAILER STATUS UPDATE ERROR:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  }
);

module.exports = router;
