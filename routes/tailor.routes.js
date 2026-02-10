const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");
const PDFDocument = require("pdfkit");

const router = express.Router();

/* =====================================================
   EMPLOYEES
===================================================== */
router.get("/employees", auth, authorize("tailor"), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM tailor_employees
      WHERE tailor_id = $1
        AND is_active = true
      ORDER BY name
      `,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH EMPLOYEES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

/* =====================================================
   ORDERS
===================================================== */
router.get("/orders", auth, authorize("tailor"), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, status, created_at, total_amount
      FROM orders
      WHERE seller_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH ORDERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* =====================================================
   TASKS
===================================================== */
router.post("/tasks", auth, authorize("tailor"), async (req, res) => {
  try {
    const { order_id, employee_id, task_type } = req.body;
    if (!order_id || !employee_id || !task_type) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO tailor_tasks
        (tailor_id, order_id, employee_id, task_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [req.user.id, order_id, employee_id, task_type]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("CREATE TASK ERROR:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.get("/tasks/:orderId", auth, authorize("tailor"), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        t.id,
        t.task_type,
        t.status,
        e.name AS employee_name
      FROM tailor_tasks t
      JOIN tailor_employees e ON e.id = t.employee_id
      WHERE t.order_id = $1
      ORDER BY t.created_at
      `,
      [req.params.orderId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH TASKS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.patch("/tasks/:taskId", auth, authorize("tailor"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["assigned", "in_progress", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      `UPDATE tailor_tasks SET status = $1 WHERE id = $2`,
      [status, req.params.taskId]
    );

    res.json({ message: "Task updated" });
  } catch (err) {
    console.error("UPDATE TASK ERROR:", err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

/* =====================================================
   ATTENDANCE
===================================================== */
router.post("/attendance", auth, authorize("tailor"), async (req, res) => {
  try {
    const { employee_id, date, status } = req.body;
    if (!["present", "absent", "half_day"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      `
      INSERT INTO tailor_attendance
        (tailor_id, employee_id, attendance_date, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id, attendance_date)
      DO UPDATE SET status = EXCLUDED.status
      `,
      [req.user.id, employee_id, date, status]
    );

    res.json({ message: "Attendance saved" });
  } catch (err) {
    console.error("ATTENDANCE ERROR:", err);
    res.status(500).json({ error: "Failed to save attendance" });
  }
});

router.get("/attendance", auth, authorize("tailor"), async (req, res) => {
  try {
    const { date } = req.query;

    const result = await pool.query(
      `
      SELECT
        e.id AS employee_id,
        e.name,
        a.status
      FROM tailor_employees e
      LEFT JOIN tailor_attendance a
        ON a.employee_id = e.id
        AND a.attendance_date = $2
      WHERE e.tailor_id = $1
        AND e.is_active = true
      ORDER BY e.name
      `,
      [req.user.id, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH ATTENDANCE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

/* =====================================================
   LEAVES
===================================================== */
router.post("/leaves", auth, authorize("tailor"), async (req, res) => {
  try {
    const { employee_id, from_date, to_date, reason } = req.body;

    await pool.query(
      `
      INSERT INTO tailor_leaves
        (tailor_id, employee_id, from_date, to_date, reason)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [req.user.id, employee_id, from_date, to_date, reason]
    );

    res.json({ message: "Leave added" });
  } catch (err) {
    console.error("ADD LEAVE ERROR:", err);
    res.status(500).json({ error: "Failed to add leave" });
  }
});

router.get("/leaves", auth, authorize("tailor"), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        l.id,
        e.name,
        l.from_date,
        l.to_date,
        l.reason,
        l.status
      FROM tailor_leaves l
      JOIN tailor_employees e ON e.id = l.employee_id
      WHERE l.tailor_id = $1
      ORDER BY l.created_at DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH LEAVES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch leaves" });
  }
});

router.patch("/leaves/:id", auth, authorize("tailor"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await pool.query(
      `UPDATE tailor_leaves SET status = $1 WHERE id = $2`,
      [status, req.params.id]
    );

    res.json({ message: "Leave updated" });
  } catch (err) {
    console.error("UPDATE LEAVE ERROR:", err);
    res.status(500).json({ error: "Failed to update leave" });
  }
});

/* =====================================================
   SALARY
===================================================== */
router.get("/salaries", auth, authorize("tailor"), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "Month required" });

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.name,
        e.salary_type,
        e.salary_amount,
        COALESCE(SUM(
          CASE a.status
            WHEN 'present' THEN 1
            WHEN 'half_day' THEN 0.5
            ELSE 0
          END
        ), 0) AS worked_days
      FROM tailor_employees e
      LEFT JOIN tailor_attendance a
        ON a.employee_id = e.id
        AND a.attendance_date BETWEEN $2 AND $3
      WHERE e.tailor_id = $1
        AND e.is_active = true
      GROUP BY e.id
      `,
      [req.user.id, startDate, endDate]
    );

    const salaries = result.rows.map(e => ({
      employee_id: e.id,
      name: e.name,
      salary_type: e.salary_type,
      worked_days: Number(e.worked_days),
      final_salary:
        e.salary_type === "daily"
          ? Math.round(e.worked_days * e.salary_amount)
          : Math.round(e.salary_amount)
    }));

    res.json(salaries);
  } catch (err) {
    console.error("SALARY ERROR:", err);
    res.status(500).json({ error: "Failed to calculate salary" });
  }
});

/* =====================================================
   INVENTORY + PROFIT
===================================================== */
router.post("/inventory/items", auth, authorize("tailor"), async (req, res) => {
  const { name, unit, cost_per_unit } = req.body;

  await pool.query(
    `
    INSERT INTO tailor_inventory_items
      (tailor_id, name, unit, cost_per_unit)
    VALUES ($1, $2, $3, $4)
    `,
    [req.user.id, name, unit, cost_per_unit]
  );

  res.json({ message: "Inventory item added" });
});

router.get("/inventory/items", auth, authorize("tailor"), async (req, res) => {
  const result = await pool.query(
    `
    SELECT *
    FROM tailor_inventory_items
    WHERE tailor_id = $1
    ORDER BY name
    `,
    [req.user.id]
  );

  res.json(result.rows);
});

router.post("/inventory/consume", auth, authorize("tailor"), async (req, res) => {
  const { order_id, item_id, quantity_used } = req.body;

  await pool.query(
    `
    INSERT INTO tailor_inventory_consumption
      (tailor_id, order_id, item_id, quantity_used)
    VALUES ($1, $2, $3, $4)
    `,
    [req.user.id, order_id, item_id, quantity_used]
  );

  res.json({ message: "Inventory consumed" });
});

router.get("/profit/:orderId", auth, authorize("tailor"), async (req, res) => {
  const { orderId } = req.params;

  const revenue = await pool.query(
    `SELECT total_amount FROM orders WHERE id = $1`,
    [orderId]
  );

  const cost = await pool.query(
    `
    SELECT COALESCE(SUM(c.quantity_used * i.cost_per_unit),0) AS material_cost
    FROM tailor_inventory_consumption c
    JOIN tailor_inventory_items i ON i.id = c.item_id
    WHERE c.order_id = $1
    `,
    [orderId]
  );

  const totalRevenue = revenue.rows[0]?.total_amount || 0;
  const materialCost = cost.rows[0]?.material_cost || 0;

  res.json({
    order_id: orderId,
    revenue: totalRevenue,
    material_cost: materialCost,
    profit: totalRevenue - materialCost
  });
});

/* =====================================================
   EXPORTS (STEP 7)
===================================================== */
router.get("/export/invoice/:orderId", auth, authorize("tailor"), async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderRes = await pool.query(
      `SELECT id, total_amount, created_at FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const costRes = await pool.query(
      `
      SELECT COALESCE(SUM(c.quantity_used * i.cost_per_unit),0) AS material_cost
      FROM tailor_inventory_consumption c
      JOIN tailor_inventory_items i ON i.id = c.item_id
      WHERE c.order_id = $1
      `,
      [orderId]
    );

    const order = orderRes.rows[0];
    const materialCost = costRes.rows[0].material_cost || 0;
    const profit = order.total_amount - materialCost;

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_order_${orderId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(18).text("Fabric2Fashion Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Order ID: ${order.id}`);
    doc.text(`Date: ${order.created_at}`);
    doc.moveDown();
    doc.text(`Order Amount: ₹${order.total_amount}`);
    doc.text(`Material Cost: ₹${materialCost}`);
    doc.text(`Profit: ₹${profit}`);

    doc.end();
  } catch (err) {
    console.error("INVOICE EXPORT ERROR:", err);
    res.status(500).json({ error: "Failed to export invoice" });
  }
});

router.get("/export/salaries", auth, authorize("tailor"), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: "Month required" });

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const result = await pool.query(
      `
      SELECT
        e.name,
        e.salary_type,
        COALESCE(SUM(
          CASE a.status
            WHEN 'present' THEN 1
            WHEN 'half_day' THEN 0.5
            ELSE 0
          END
        ),0) AS worked_days,
        e.salary_amount
      FROM tailor_employees e
      LEFT JOIN tailor_attendance a
        ON a.employee_id = e.id
        AND a.attendance_date BETWEEN $2 AND $3
      WHERE e.tailor_id = $1
        AND e.is_active = true
      GROUP BY e.id
      `,
      [req.user.id, startDate, endDate]
    );

    let csv = "Employee,Salary Type,Worked Days,Final Salary\n";

    result.rows.forEach(r => {
      const finalSalary =
        r.salary_type === "daily"
          ? r.worked_days * r.salary_amount
          : r.salary_amount;

      csv += `${r.name},${r.salary_type},${r.worked_days},${finalSalary}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=salary_${month}.csv`
    );

    res.send(csv);
  } catch (err) {
    console.error("SALARY EXPORT ERROR:", err);
    res.status(500).json({ error: "Failed to export salary CSV" });
  }
});

/* =====================================================
   DASHBOARD KPIs (STEP 8)
   GET /tailor/dashboard/kpis?month=YYYY-MM
===================================================== */
router.get("/dashboard/kpis", auth, authorize("tailor"), async (req, res) => {
  try {
    const tailorId = req.user.id;
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const ordersRes = await pool.query(
      `
      SELECT
        COUNT(*) AS total_orders,
        COUNT(*) FILTER (WHERE status = 'PLACED') AS placed,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
        COALESCE(SUM(total_amount),0) AS revenue
      FROM orders
      WHERE seller_id = $1
        AND created_at BETWEEN $2 AND $3
      `,
      [tailorId, startDate, endDate]
    );

    const materialRes = await pool.query(
      `
      SELECT COALESCE(SUM(c.quantity_used * i.cost_per_unit),0) AS material_cost
      FROM tailor_inventory_consumption c
      JOIN tailor_inventory_items i ON i.id = c.item_id
      WHERE c.tailor_id = $1
        AND c.created_at BETWEEN $2 AND $3
      `,
      [tailorId, startDate, endDate]
    );

    const salaryRes = await pool.query(
      `
      SELECT
        e.salary_type,
        e.salary_amount,
        COALESCE(SUM(
          CASE a.status
            WHEN 'present' THEN 1
            WHEN 'half_day' THEN 0.5
            ELSE 0
          END
        ),0) AS worked_days
      FROM tailor_employees e
      LEFT JOIN tailor_attendance a
        ON a.employee_id = e.id
        AND a.attendance_date BETWEEN $2 AND $3
      WHERE e.tailor_id = $1
        AND e.is_active = true
      GROUP BY e.id
      `,
      [tailorId, startDate, endDate]
    );

    const salaryCost = salaryRes.rows.reduce((sum, e) => {
      if (e.salary_type === "daily") {
        return sum + e.worked_days * e.salary_amount;
      }
      return sum + Number(e.salary_amount);
    }, 0);

    const orders = ordersRes.rows[0];
    const materialCost = materialRes.rows[0].material_cost || 0;
    const profit = orders.revenue - materialCost - salaryCost;

    res.json({
      month,
      orders: {
        total: Number(orders.total_orders),
        placed: Number(orders.placed),
        in_progress: Number(orders.in_progress),
        completed: Number(orders.completed)
      },
      revenue: Number(orders.revenue),
      material_cost: Number(materialCost),
      salary_cost: Number(salaryCost),
      profit: Number(profit)
    });
  } catch (err) {
    console.error("DASHBOARD KPI ERROR:", err);
    res.status(500).json({ error: "Failed to load dashboard KPIs" });
  }
});
/* =====================================================
   DASHBOARD TRENDS (STEP 9)
   GET /tailor/dashboard/trends?from=YYYY-MM&to=YYYY-MM
===================================================== */
router.get(
  "/dashboard/trends",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const tailorId = req.user.id;
      const { from, to } = req.query;

      if (!from || !to) {
        return res.status(400).json({ error: "from and to months are required" });
      }

      const startDate = `${from}-01`;
      const endDate = `${to}-31`;

      /* -------- Revenue & Orders -------- */
      const ordersRes = await pool.query(
        `
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE seller_id = $1
          AND created_at BETWEEN $2 AND $3
        GROUP BY month
        ORDER BY month
        `,
        [tailorId, startDate, endDate]
      );

      /* -------- Material Cost -------- */
      const materialRes = await pool.query(
        `
        SELECT
          TO_CHAR(c.created_at, 'YYYY-MM') AS month,
          COALESCE(SUM(c.quantity_used * i.cost_per_unit),0) AS material_cost
        FROM tailor_inventory_consumption c
        JOIN tailor_inventory_items i ON i.id = c.item_id
        WHERE c.tailor_id = $1
          AND c.created_at BETWEEN $2 AND $3
        GROUP BY month
        `,
        [tailorId, startDate, endDate]
      );

      /* -------- Salary Cost -------- */
      const salaryRes = await pool.query(
        `
        SELECT
          TO_CHAR(a.attendance_date, 'YYYY-MM') AS month,
          COALESCE(SUM(
            CASE e.salary_type
              WHEN 'daily' THEN
                CASE a.status
                  WHEN 'present' THEN e.salary_amount
                  WHEN 'half_day' THEN e.salary_amount * 0.5
                  ELSE 0
                END
              ELSE e.salary_amount / 26
            END
          ),0) AS salary_cost
        FROM tailor_employees e
        LEFT JOIN tailor_attendance a ON a.employee_id = e.id
        WHERE e.tailor_id = $1
          AND a.attendance_date BETWEEN $2 AND $3
        GROUP BY month
        `,
        [tailorId, startDate, endDate]
      );

      /* -------- Merge data -------- */
      const map = {};

      ordersRes.rows.forEach(r => {
        map[r.month] = {
          month: r.month,
          orders: Number(r.orders),
          revenue: Number(r.revenue),
          material_cost: 0,
          salary_cost: 0
        };
      });

      materialRes.rows.forEach(r => {
        map[r.month] ||= { month: r.month, orders: 0, revenue: 0, material_cost: 0, salary_cost: 0 };
        map[r.month].material_cost = Number(r.material_cost);
      });

      salaryRes.rows.forEach(r => {
        map[r.month] ||= { month: r.month, orders: 0, revenue: 0, material_cost: 0, salary_cost: 0 };
        map[r.month].salary_cost = Number(r.salary_cost);
      });

      const result = Object.values(map).map(m => ({
        ...m,
        profit: m.revenue - m.material_cost - m.salary_cost
      }));

      res.json(result);
    } catch (err) {
      console.error("DASHBOARD TRENDS ERROR:", err);
      res.status(500).json({ error: "Failed to load trends" });
    }
  }
);
/* =====================================================
   AI DEMAND FORECASTING (STEP 12)
   GET /tailor/ai/forecast
===================================================== */
router.get(
  "/ai/forecast",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const tailorId = req.user.id;

      // Last 12 months data
      const history = await pool.query(
        `
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(total_amount),0) AS revenue
        FROM orders
        WHERE seller_id = $1
          AND created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month
        `,
        [tailorId]
      );

      const data = history.rows.map(r => ({
        month: r.month,
        orders: Number(r.orders),
        revenue: Number(r.revenue)
      }));

      if (data.length < 3) {
        return res.json({
          message: "Not enough data for forecasting",
          forecast: []
        });
      }

      /* -------- Simple AI Logic -------- */

      const avgOrders =
        data.reduce((s, d) => s + d.orders, 0) / data.length;

      const avgRevenue =
        data.reduce((s, d) => s + d.revenue, 0) / data.length;

      const lastMonth = data[data.length - 1].month;
      const [year, month] = lastMonth.split("-").map(Number);

      const forecast = [];

      for (let i = 1; i <= 3; i++) {
        const m = month + i;
        const forecastMonth =
          m <= 12
            ? `${year}-${String(m).padStart(2, "0")}`
            : `${year + 1}-${String(m - 12).padStart(2, "0")}`;

        forecast.push({
          month: forecastMonth,
          expected_orders: Math.round(avgOrders),
          expected_revenue: Math.round(avgRevenue),
          fabric_demand_estimate_meters: Math.round(avgOrders * 2.5) // avg fabric/order
        });
      }

      res.json({
        model: "Moving Average (12 months)",
        confidence: "Medium",
        forecast
      });
    } catch (err) {
      console.error("AI FORECAST ERROR:", err);
      res.status(500).json({ error: "Failed to generate forecast" });
    }
  }
);
/**
 * =====================================
 * TAILOR DASHBOARD SUMMARY
 * GET /tailor/dashboard/summary
 * =====================================
 */
router.get(
  "/dashboard/summary",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const tailorId = req.user.id;

      const totalAssigned = await pool.query(
        `SELECT COUNT(*) FROM orders WHERE tailor_id = $1`,
        [tailorId]
      );

      const inProgress = await pool.query(
        `SELECT COUNT(*) FROM orders WHERE tailor_id = $1 AND status = 'IN_PROGRESS'`,
        [tailorId]
      );

      const completed = await pool.query(
        `SELECT COUNT(*) FROM orders WHERE tailor_id = $1 AND status = 'COMPLETED'`,
        [tailorId]
      );

      res.json({
        totalAssigned: Number(totalAssigned.rows[0].count),
        inProgress: Number(inProgress.rows[0].count),
        completed: Number(completed.rows[0].count)
      });
    } catch (err) {
      console.error("TAILOR DASHBOARD ERROR:", err);
      res.status(500).json({ error: "Failed to load tailor dashboard" });
    }
  }
);

/**
 * =====================================
 * TAILOR ASSIGNED ORDERS
 * GET /tailor/orders
 * =====================================
 */
router.get(
  "/orders",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const tailorId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          o.id,
          o.created_at,
          o.status,
          o.total_amount,
          u.name AS buyer_name
        FROM orders o
        JOIN users u ON u.id = o.buyer_id
        WHERE o.tailor_id = $1
        ORDER BY o.created_at DESC
        `,
        [tailorId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("TAILOR ORDERS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch tailor orders" });
    }
  }
);

/**
 * =====================================
 * TAILOR UPDATE ORDER STATUS (LIMITED)
 * PUT /tailor/orders/:orderId/status
 * =====================================
 */
router.put(
  "/orders/:orderId/status",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const tailorId = req.user.id;
      const { orderId } = req.params;
      const { status } = req.body;

      const allowedStatuses = ["IN_PROGRESS", "COMPLETED"];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status update" });
      }

      const result = await pool.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2 AND tailor_id = $3
        RETURNING *
        `,
        [status, orderId, tailorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Order not found or not assigned to tailor"
        });
      }

      res.json({
        message: "Order status updated",
        order: result.rows[0]
      });
    } catch (err) {
      console.error("TAILOR STATUS UPDATE ERROR:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  }
);

module.exports = router;
