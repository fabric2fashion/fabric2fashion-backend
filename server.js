/**
 * ==========================================
 * Fabric2Fashion Backend
 * Production Server (Render Ready)
 * ==========================================
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

/**
 * ==========================================
 * ENV VALIDATION
 * ==========================================
 */

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing");
  process.exit(1);
}

/**
 * ==========================================
 * APP INIT
 * ==========================================
 */

const app = express();

/**
 * ==========================================
 * DATABASE CONFIGURATION
 * ==========================================
 */

let pool;

if (process.env.DATABASE_URL) {
  console.log("🌍 Using PRODUCTION database (Render)");

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

} else {
  console.log("💻 Using LOCAL database");

  pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "fabric2fashion",
    port: 5432
  });
}

/**
 * Test DB Connection
 */
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected");
    client.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

/**
 * ==========================================
 * GLOBAL MIDDLEWARE
 * ==========================================
 */

// Allow frontend domain
app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://fabric2fashion-frontend.onrender.com"
  ],
  credentials: true
}));

app.use(express.json({ limit: "5mb" }));

/**
 * ==========================================
 * ROUTE IMPORTS
 * ==========================================
 */

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/products.routes");
const orderRoutes = require("./routes/orders.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const profileRoutes = require("./routes/profile.routes");
const paymentRoutes = require("./routes/payments.routes");

const adminRoutes = require("./routes/admin.routes");
const adminReportsRoutes = require("./routes/admin.reports.routes");
const adminTailoringReportsRoutes =
  require("./routes/admin.tailoring.reports.routes");
const adminPayoutRoutes =
  require("./routes/admin.payouts.routes");

const tailorRoutes = require("./routes/tailor.routes");
const tailorMeasurementRoutes =
  require("./routes/tailor.measurements.routes");
const tailorTailoringRoutes =
  require("./routes/tailor.tailoring.routes");

const retailerRoutes = require("./routes/retailer.routes");
const supplierRoutes = require("./routes/supplier.routes");

const customerRoutes = require("./routes/customer.routes");
const customerTailoringRoutes =
  require("./routes/customer.tailoring.routes");

const invoiceRoutes = require("./routes/invoice.routes");

/**
 * ==========================================
 * ROUTE MOUNTING
 * ==========================================
 */

// Core
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/delivery", deliveryRoutes);

// Payments (Feature Flag)
if (process.env.PAYMENTS_ENABLED === "true") {
  console.log("💳 Payments ENABLED");
  app.use("/payments", paymentRoutes);
} else {
  console.log("💳 Payments DISABLED");
}

// Admin
app.use("/admin", adminRoutes);
app.use("/admin/reports", adminReportsRoutes);
app.use("/admin/tailoring-reports", adminTailoringReportsRoutes);
app.use("/admin/payouts", adminPayoutRoutes);

// Tailor
app.use("/tailor", tailorRoutes);
app.use("/tailor", tailorMeasurementRoutes);
app.use("/tailor", tailorTailoringRoutes);

// Retailer / Supplier
app.use("/retailer", retailerRoutes);
app.use("/supplier", supplierRoutes);

// Customer
app.use("/customer", customerRoutes);
app.use("/customer", customerTailoringRoutes);

// Invoice
app.use("/invoices", invoiceRoutes);

/**
 * ==========================================
 * ROOT CHECK
 * ==========================================
 */

app.get("/", (req, res) => {
  res.json({
    message: "Fabric2Fashion API is running 🚀",
    environment: process.env.NODE_ENV || "development"
  });
});

/**
 * ==========================================
 * HEALTH CHECK
 * ==========================================
 */

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    paymentsEnabled: process.env.PAYMENTS_ENABLED === "true"
  });
});

/**
 * ==========================================
 * 404 HANDLER
 * ==========================================
 */

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

/**
 * ==========================================
 * ERROR HANDLER
 * ==========================================
 */

app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({
    error: "Internal server error"
  });
});

/**
 * ==========================================
 * START SERVER
 * ==========================================
 */

const PORT = process.env.PORT || 10000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Fabric2Fashion API running on port ${PORT}`);
});

/**
 * ==========================================
 * GRACEFUL SHUTDOWN
 * ==========================================
 */

const shutdown = (signal) => {
  console.log(`🛑 ${signal} received. Shutting down gracefully...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED PROMISE:", err);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
  server.close(() => process.exit(1));
});
