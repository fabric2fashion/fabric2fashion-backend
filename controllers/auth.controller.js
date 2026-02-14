/**
 * ==========================================
 * Auth Controller
 * Fabric2Fashion
 * ==========================================
 * Responsibility:
 * - Handle HTTP request/response only
 * - Delegate logic to AuthService
 *
 * ❌ No SQL
 * ❌ No JWT logic
 * ❌ No password hashing
 */

const AuthService = require("../services/auth.service");

/**
 * ------------------------------------------
 * REGISTER (All non-admin users)
 * Roles: supplier | retailer | tailor | customer
 * Status: pending (admin approval required)
 * ------------------------------------------
 */
exports.register = async (req, res) => {
  try {
    const { role, name, email, mobile, password } = req.body;

    if (!role || !name || !email || !password) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    const user = await AuthService.registerUser({
      role,
      name,
      email,
      mobile,
      password
    });

    return res.status(201).json({
      message: "Registration successful. Awaiting admin approval.",
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
 * LOGIN (Normal users)
 * Email + password
 * Requires status = active
 * ------------------------------------------
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    const result = await AuthService.loginUser({
      email,
      password
    });

    return res.status(200).json(result);

  } catch (error) {
    return res.status(401).json({
      error: error.message
    });
  }
};

/**
 * ------------------------------------------
 * SUPER ADMIN LOGIN
 * Mobile + Admin PIN
 * ------------------------------------------
 */
exports.adminLogin = async (req, res) => {
  try {
    const { mobile, admin_pin } = req.body;

    if (!mobile || !admin_pin) {
      return res.status(400).json({
        error: "Mobile and admin PIN are required"
      });
    }

    const result = await AuthService.loginSuperAdmin({
      mobile,
      admin_pin
    });

    return res.status(200).json({
      message: "Admin login successful",
      token: result.token
    });

  } catch (error) {
    return res.status(401).json({
      error: error.message
    });
  }
};
