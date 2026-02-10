/**
 * ==========================================
 * User Model
 * Fabric2Fashion
 * ==========================================
 * Handles ALL database operations
 * for the users table
 *
 * ❌ No HTTP logic
 * ❌ No JWT logic
 * ❌ No business rules
 */

const db = require("../db");

/**
 * ------------------------------------------
 * Find user by ID
 * ------------------------------------------
 */
async function findById(id) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM users
    WHERE id = $1
    `,
    [id]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Find user by email
 * ------------------------------------------
 */
async function findByEmail(email) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM users
    WHERE email = $1
    `,
    [email]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Find user by mobile
 * ------------------------------------------
 */
async function findByMobile(mobile) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM users
    WHERE mobile = $1
    `,
    [mobile]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Create new user
 * Default:
 * approval_status = pending
 * is_active = false
 * ------------------------------------------
 */
async function createUser({
  role,
  name,
  email,
  mobile,
  password_hash
}) {
  const { rows } = await db.query(
    `
    INSERT INTO users (
      role,
      name,
      email,
      mobile,
      password_hash,
      approval_status,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, 'pending', false)
    RETURNING *
    `,
    [role, name, email, mobile, password_hash]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Approve / Reject user (Admin)
 * ------------------------------------------
 */
async function updateApproval(userId, approvalStatus) {
  const isActive = approvalStatus === "approved";

  const { rows } = await db.query(
    `
    UPDATE users
    SET approval_status = $1,
        is_active = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *
    `,
    [approvalStatus, isActive, userId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Activate / Deactivate user
 * (Soft control without approval change)
 * ------------------------------------------
 */
async function setActive(userId, isActive) {
  const { rows } = await db.query(
    `
    UPDATE users
    SET is_active = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [isActive, userId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Set / Update Admin PIN (Super Admin only)
 * ------------------------------------------
 */
async function setAdminPin(userId, adminPin) {
  const { rows } = await db.query(
    `
    UPDATE users
    SET admin_pin = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [adminPin, userId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * List users by approval status (Admin)
 * ------------------------------------------
 */
async function listByApprovalStatus(status) {
  const { rows } = await db.query(
    `
    SELECT
      id,
      name,
      email,
      mobile,
      role,
      approval_status,
      is_active,
      created_at
    FROM users
    WHERE approval_status = $1
    ORDER BY created_at DESC
    `,
    [status]
  );

  return rows;
}

/**
 * ------------------------------------------
 * List all users (Admin / Reports)
 * ------------------------------------------
 */
async function listAll() {
  const { rows } = await db.query(
    `
    SELECT
      id,
      name,
      email,
      mobile,
      role,
      approval_status,
      is_active,
      created_at
    FROM users
    ORDER BY created_at DESC
    `
  );

  return rows;
}

module.exports = {
  findById,
  findByEmail,
  findByMobile,
  createUser,
  updateApproval,
  setActive,
  setAdminPin,
  listByApprovalStatus,
  listAll
};
