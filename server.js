/**
 * ==========================================
 * SERVER ENTRY POINT
 * Fabric2Fashion Backend
 * PAYMENTS ENABLED (RAZORPAY FEATURE-FLAGGED)
 * ==========================================
 */

const path = require("path");
const express = require("express");
const cors = require("cors");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

/**
 * ==========================================
 * ENV CHECK (SAFE)
 * ==========================================
 */
console.log("🔎 ENV CHECK:", {
  PORT: process.env.PORT,
  PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  dbPasswordPresent: Boolean(process.env.DB_PASSWORD),
  jwtSecretPresent: Boolean(process.env.JWT_SECRET),
  razorpayKeysPresent:
    Boolean(process.env.RAZORPAY_KEY_ID) &&
    Boolean(process.env.RAZORPAY_KEY_SECRET)
});

/**
 * ==========================================
 * SAFE ROUTE LOADER
 * ==========================================
 */
function loadRoute(mod, name) {
  if (typeof mod === "function") return mod;
  if (mod && typeof mod.router === "function") return mod.router;
  if (mod && typeof mod.default === "function") return mod.default;

  console.error(`❌ INVALID ROUTE EXPORT: ${name}`);
  throw new Error(`Route "${name}" does not export an Express router`);
}

/**
 * ==========================================
 * ROUTE IMPORTS
 * ==========================================
 */

/* Core */
const authRoutes = loadRoute(require("./routes/auth.routes"), "auth.routes");
const productRoutes = loadRoute(require("./routes/products.routes"), "products.routes");
const orderRoutes = loadRoute(require("./routes/orders.routes"), "orders.routes");
const deliveryRoutes = loadRoute(require("./routes/delivery.routes"), "delivery.routes");

/* Payments (kept, feature-flagged) */
const paymentRoutes = loadRoute(require("./routes/payments.routes"), "payments.routes");

/* Profile */
const profileRoutes = loadRoute(require("./routes/profile.routes"), "profile.routes");

/* Admin */
const adminRoutes = loadRoute(require("./routes/admin.routes"), "admin.routes");
const adminReportsRoutes = loadRoute(require("./routes/admin.reports.routes"), "admin.reports.routes");
const adminTailoringReportsRoutes = loadRoute(
  require("./routes/admin.tailoring.reports.routes"),
  "admin.tailoring.reports.routes"
);
const adminPayoutRoutes = loadRoute(
  require("./routes/admin.payouts.routes"),
  "admin.payouts.routes"
);

/* Tailor */
const tailorRoutes = loadRoute(require("./routes/tailor.routes"), "tailor.routes");
const tailorMeasurementRoutes = loadRoute(
  require("./routes/tailor.measurements.routes"),
  "tailor.measurements.routes"
);
const tailorTailoringRoutes = loadRoute(
  require("./routes/tailor.tailoring.routes"),
  "tailor.tailoring.routes"
);

/* Retailer / Supplier */
const retailerRoutes = loadRoute(require("./routes/retailer.routes"), "retailer.routes");
const supplierRoutes = loadRoute(require("./routes/supplier.routes"), "supplier.routes");

/* Customer */
const customerRoutes = loadRoute(require("./routes/customer.routes"), "customer.routes");
const customerTailoringRoutes = loadRoute(
  require("./routes/customer.tailoring.routes"),
  "customer.tailoring.routes"
);

/* Invoice */
const invoiceRoutes = loadRoute(require("./routes/invoice.routes"), "invoice.routes");

/**
 * ==========================================
 * APP INIT
 * ==========================================
 */
const app = express();

/**
 * ==========================================
 * GLOBAL MIDDLEWARE
 * ==========================================
 */
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/**
 * ==========================================
 * ROUTES
 * ==========================================
 */

/* Core */
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/delivery", deliveryRoutes);

/* Payments (SAFE WRAPPER) */
app.use("/payments", (req, res, next) => {
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return res.status(503).json({
      message: "Payments temporarily disabled. Please try again later."
    });
  }
  next();
}, paymentRoutes);

/* Admin */
app.use("/admin", adminRoutes);
app.use("/admin/reports", adminReportsRoutes);
app.use("/admin/tailoring-reports", adminTailoringReportsRoutes);
app.use("/admin/payouts", adminPayoutRoutes);

/* Tailor */
app.use("/tailor", tailorRoutes);
app.use("/tailor", tailorMeasurementRoutes);
app.use("/tailor", tailorTailoringRoutes);

/* Retailer / Supplier */
app.use("/retailer", retailerRoutes);
app.use("/supplier", supplierRoutes);

/* Customer */
app.use("/customer", customerRoutes);
app.use("/customer", customerTailoringRoutes);

/* Invoice */
app.use("/invoices", invoiceRoutes);

/**
 * ==========================================
 * HEALTH CHECK
 * ==========================================
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    paymentsEnabled: process.env.PAYMENTS_ENABLED === "true",
    uptime: process.uptime()
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
 * GLOBAL ERROR HANDLER
 * ==========================================
 */
app.use((err, req, res, next) => {
  console.error("🔥 UNHANDLED ERROR:", err);
  res.status(500).json({
    error: "Internal server error"
  });
});

/**
 * ==========================================
 * START SERVER
 * ==========================================
 */
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`✅ Fabric2Fashion API running on port ${PORT}`);
});

/**
 * ==========================================
 * GRACEFUL SHUTDOWN
 * ==========================================
 */
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Shutting down gracefully...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Shutting down gracefully...");
  server.close(() => process.exit(0));
});

process.on("unhandledRejection", reason => {
  console.error("🔥 UNHANDLED PROMISE REJECTION:", reason);
});

process.on("uncaughtException", err => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
  server.close(() => process.exit(1));
});
