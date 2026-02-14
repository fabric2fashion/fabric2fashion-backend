/**
 * ==========================================
 * Payout Model
 * Fabric2Fashion
 * ==========================================
 * Handles ALL DB operations for payouts
 *
 * ❌ No HTTP logic
 * ❌ No Razorpay logic
 * ❌ No commission calculation
 */

const db = require("../db");

/**
 * ------------------------------------------
 * Create payout record
 * ------------------------------------------
 */
async function createPayout({
  user_id,
  order_id,
  gross_amount,
  platform_commission,
  payable_amount,
  payout_status = "pending",
  payout_mode = null,
  transaction_ref = null
}) {
  const { rows } = await db.query(
    `
    INSERT INTO payouts (
      user_id,
      order_id,
      gross_amount,
      platform_commission,
      payable_amount,
      payout_status,
      payout_mode,
      transaction_ref
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      user_id,
      order_id,
      gross_amount,
      platform_commission,
      payable_amount,
      payout_status,
      payout_mode,
      transaction_ref
    ]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Mark payout as paid
 * ------------------------------------------
 */
async function markAsPaid({
  payoutId,
  payout_mode,
  transaction_ref
}) {
  const { rows } = await db.query(
    `
    UPDATE payouts
    SET payout_status = 'paid',
        payout_mode = $1,
        transaction_ref = $2,
        paid_at = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [payout_mode, transaction_ref, payoutId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Get payouts for a user
 * ------------------------------------------
 */
async function findByUser(userId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM payouts
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return rows;
}

/**
 * ------------------------------------------
 * Get payout by order
 * ------------------------------------------
 */
async function findByOrder(orderId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM payouts
    WHERE order_id = $1
    `,
    [orderId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Admin: list all payouts
 * ------------------------------------------
 */
async function listAll() {
  const { rows } = await db.query(
    `
    SELECT *
    FROM payouts
    ORDER BY created_at DESC
    `
  );

  return rows;
}

module.exports = {
  createPayout,
  markAsPaid,
  findByUser,
  findByOrder,
  listAll
};
