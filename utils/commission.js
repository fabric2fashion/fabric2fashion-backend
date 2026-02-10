/**
 * Commission calculator
 * Single source of truth
 */

const COMMISSION_PERCENT = 5;

function calculateCommission(amount) {
  const commission = Number(amount) * COMMISSION_PERCENT / 100;
  const payable = Number(amount) - commission;

  return {
    commission: Number(commission.toFixed(2)),
    payable: Number(payable.toFixed(2))
  };
}

module.exports = {
  COMMISSION_PERCENT,
  calculateCommission
};
