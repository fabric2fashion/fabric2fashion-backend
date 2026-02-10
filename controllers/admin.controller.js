/**
 * ==========================================
 * Admin Controller
 * Fabric2Fashion
 * ==========================================
 * Handles HTTP layer for admin-only actions
 *
 * ❌ No SQL
 * ❌ No DB access
 * ❌ No business rules
 */

const AdminService = require("../services/admin.service");
const OrderService = require("../services/order.service");

/**
 * ------------------------------------------
 * LIST USERS BY STATUS
 * GET /admin/users?status=pending|active|blocked
 * ------------------------------------------
 */
exports.listUsers = async (req, res) => {
  try {
    const status = req.query.status || "pending";

    const users = await AdminService.getUsersByStatus(status);

    return res.json({ users });

  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch users"
    });
  }
};

/**
 * ------------------------------------------
 * APPROVE USER
 * POST /admin/users/:id/approve
 * ------------------------------------------
 */
exports.approveUser = async (req, res) => {
  try {
    const user = await AdminService.approveUser(req.params.id);

    return res.json({
      message: "User approved successfully",
      user
    });

  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
};

/**
 * ------------------------------------------
 * BLOCK USER
 * POST /admin/users/:id/block
 * ------------------------------------------
 */
exports.blockUser = async (req, res) => {
  try {
    const user = await AdminService.blockUser(req.params.id);

    return res.json({
      message: "User blocked successfully",
      user
    });

  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
};

/**
 * ------------------------------------------
 * ADMIN REPORTS (READ ONLY)
 * GET /admin/reports
 * Filters handled in service
 * ------------------------------------------
 */
exports.getReports = async (req, res) => {
  try {
    const reports = await AdminService.getReports(req.query);

    return res.json({ reports });

  } catch (error) {
    return res.status(500).json({
      error: "Failed to generate reports"
    });
  }
};

/**
 * ------------------------------------------
 * EXPORT REPORTS (CSV)
 * GET /admin/reports/export
 * ------------------------------------------
 */
exports.exportReports = async (req, res) => {
  try {
    const rows = await AdminService.getReports(req.query);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=admin_reports.csv"
    );

    // CSV Header
    res.write(
      "Order ID,Created At,Amount,Order Status,Seller Name,Seller Role,Buyer Name,Payout Status\n"
    );

    rows.forEach(row => {
      res.write(
        `${row.order_id},${row.created_at},${row.total_amount},${row.order_status},` +
        `${row.seller_name},${row.seller_role},${row.buyer_name},${row.payout_status || ""}\n`
      );
    });

    res.end();

  } catch (error) {
    return res.status(500).json({
      error: "Failed to export reports"
    });
  }
};

/**
 * ------------------------------------------
 * LIST ALL ORDERS (ADMIN)
 * GET /admin/orders
 * ------------------------------------------
 */
exports.listOrders = async (req, res) => {
  try {
    const orders = await OrderService.getAllOrders();

    return res.json({ orders });

  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch orders"
    });
  }
};

/**
 * ------------------------------------------
 * UPDATE ORDER STATUS (ADMIN)
 * PUT /admin/orders/:id/status
 * ------------------------------------------
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "created",
      "accepted",
      "in_progress",
      "dispatched",
      "delivered",
      "cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid order status"
      });
    }

    const order = await OrderService.updateOrderStatus(
      req.params.id,
      status
    );

    return res.json({
      message: "Order status updated",
      order
    });

  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
};
