/**
 * ==========================================
 * Admin Routes
 * Fabric2Fashion
 * ==========================================
 * ❌ No SQL here
 * ❌ No business logic
 * ✅ Auth + role protected
 */

const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const AdminController = require("../controllers/admin.controller");

/**
 * ------------------------------------------
 * All admin routes are protected
 * Role: admin
 * ------------------------------------------
 */
router.use(auth, authorize("admin"));

/**
 * ==========================================
 * USER MANAGEMENT
 * ==========================================
 */

/**
 * Get users by status
 * GET /admin/users?status=pending|active|blocked
 */
router.get("/users", AdminController.listUsers);

/**
 * Approve user (pending → active)
 * POST /admin/users/:id/approve
 */
router.post("/users/:id/approve", AdminController.approveUser);

/**
 * Block user
 * POST /admin/users/:id/block
 */
router.post("/users/:id/block", AdminController.blockUser);

/**
 * ==========================================
 * REPORTS (READ-ONLY)
 * ==========================================
 */

/**
 * Admin summary reports
 * GET /admin/reports
 * (filters handled inside controller/service)
 */
router.get("/reports", AdminController.getReports);

/**
 * Export reports (CSV)
 * GET /admin/reports/export
 */
router.get("/reports/export", AdminController.exportReports);

/**
 * ==========================================
 * ORDERS (ADMIN VIEW)
 * ==========================================
 */

/**
 * View all orders
 * GET /admin/orders
 */
router.get("/orders", AdminController.listOrders);

/**
 * Update order status
 * PUT /admin/orders/:id/status
 */
router.put("/orders/:id/status", AdminController.updateOrderStatus);

module.exports = router;
