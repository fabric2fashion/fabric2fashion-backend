/**
 * ==========================================
 * Admin Service
 * Fabric2Fashion
 * ==========================================
 */

const UserModel = require("../models/user.model");

/**
 * Get users by status (pending / active / blocked)
 */
async function getUsersByStatus(status) {
  return UserModel.listByStatus(status);
}

/**
 * Approve user (pending → active)
 */
async function approveUser(userId) {
  return UserModel.updateStatus(userId, "active");
}

/**
 * Block user
 */
async function blockUser(userId) {
  return UserModel.updateStatus(userId, "blocked");
}

module.exports = {
  getUsersByStatus,
  approveUser,
  blockUser
};

