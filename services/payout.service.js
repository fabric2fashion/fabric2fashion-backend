/**
 * Payout Service
 * Handles payout creation & settlement lifecycle
 */

const PayoutModel = require("../models/payout.model");
const { calculateCommission } = require("./commission.service");

/**
 * Create payout for an order
 */
async function createPayoutForOrder({
  user_id,
  order_id,
  order_amount
}) {
  const {
    gross_amount,
    commission,
    payable_amount
  } = calculateCommission(order_amount);

  const payout = await PayoutModel.createPayout({
    user_id,
    order_id,
    gross_amount,
    commission,
    payable_amount,
    payout_status: "pending"
  });

  return payout;
}

/**
 * Mark payout as paid (used later with Razorpay)
 */
async function markPayoutPaid(payoutId, transactionRef) {
  return PayoutModel.markAsPaid(payoutId, transactionRef);
}

module.exports = {
  createPayoutForOrder,
  markPayoutPaid
};
