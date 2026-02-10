const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");

const router = express.Router();

/**
 * ==========================
 * ORDER STATUS FLOW
 * ==========================
 */
const STATUS_FLOW = {
  requested: ["accepted", "cancelled"],
  accepted: ["in_production", "dispatched", "cancelled"],
  in_production: ["dispatched"],
  dispatched: ["delivered"],
  delivered: [],
  cancelled: []
};

/**
 * ==========================
 * ROLE PERMISSIONS
 * ==========================
 */
function canChangeStatus(role, from, to) {
  if (role === "admin" || role === "super_admin") return true;

  if (["customer", "buyer"].includes(role)) {
    return from === "requested" && to === "cancelled";
  }

  if (["supplier", "retailer", "tailor"].includes(role)) {
    if (from === "requested" && to === "accepted") return true;
    if (from === "accepted" && ["in_production", "dispatched"].includes(to)) return true;
    if (from === "in_production" && to === "dispatched") return true;
    if (from === "dispatched" && to === "delivered") return true;
  }

  return false;
}

/**
 * ==========================
 * UPDATE ORDER STATUS
 * PATCH /orders/:id/status
 * ==========================
 */
router.patch("/:id/status", auth, async (req, res) => {
  const orderId = req.params.id;
  const { status: newStatus } = req.body;
  const userRole = req.user.role;

  if (!newStatus) {
    return res.status(400).json({ message: "Status required" });
  }

  try {
    // 1️⃣ Fetch order
    const orderRes = await pool.query(
      "SELECT status FROM orders WHERE id = $1",
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = orderRes.rows[0].status;

    // 2️⃣ Validate status flow
    if (!STATUS_FLOW[currentStatus].includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid transition: ${currentStatus} → ${newStatus}`
      });
    }

    // 3️⃣ Role permission check
    if (!canChangeStatus(userRole, currentStatus, newStatus)) {
      return res.status(403).json({
        message: "You are not allowed to change this order status"
      });
    }

    // 🔒 4️⃣ PAYMENT CHECK (CRITICAL)
    const paymentRequiredStatuses = [
      "in_production",
      "dispatched",
      "delivered"
    ];

    if (paymentRequiredStatuses.includes(newStatus)) {
      const payRes = await pool.query(
        `
        SELECT 1
        FROM payments
        WHERE order_id = $1
        AND payment_status = 'paid'
        LIMIT 1
        `,
        [orderId]
      );

      if (payRes.rows.length === 0) {
        return res.status(403).json({
          message: "Payment required before proceeding"
        });
      }
    }

    // 5️⃣ Update status
    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      [newStatus, orderId]
    );

    res.json({
      message: "Order status updated",
      order_id: orderId,
      from: currentStatus,
      to: newStatus
    });

  } catch (err) {
    console.error("ORDER STATUS UPDATE ERROR:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

module.exports = router;
