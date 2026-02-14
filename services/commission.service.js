/**
 * Commission Service
 */

const PLATFORM_COMMISSION_PERCENT = 5;

/**
 * Calculate platform commission
 */
function calculateCommission(amount) {
  if (!amount || amount <= 0) return 0;

  return Number(
    ((amount * PLATFORM_COMMISSION_PERCENT) / 100).toFixed(2)
  );
}

module.exports = {
  calculateCommission
};
