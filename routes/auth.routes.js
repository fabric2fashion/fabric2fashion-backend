/**
 * ==========================================
 * Auth Routes
 * Fabric2Fashion
 * ==========================================
 */

const express = require("express");
const router = express.Router();

const AuthController = require("../controllers/auth.controller");

/**
 * REGISTER
 * Roles: supplier, retailer, tailor, customer
 * Status: pending (admin approval)
 */
router.post("/register", AuthController.register);

/**
 * LOGIN
 * Email + password based
 */
router.post("/login", AuthController.login);

module.exports = router;
