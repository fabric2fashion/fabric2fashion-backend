const express = require("express");
const router = express.Router();

const AuthController = require("../controllers/auth.controller");

/**
 * Normal users
 */
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

/**
 * Super Admin
 */
router.post("/admin/login", AuthController.adminLogin);

module.exports = router;
