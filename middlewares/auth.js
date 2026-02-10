const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

/**
 * =====================================
 * LOGIN (SUPER ADMIN ONLY – PIN BASED)
 * POST /auth/login
 * Body: { mobile, admin_pin }
 * =====================================
 */
router.post("/login", async (req, res) => {
  try {
    const { mobile, admin_pin } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile number required" });
    }

    // Fetch user by mobile
    const result = await pool.query(
      `
      SELECT id, name, mobile, role, approval_status, is_active, admin_pin
      FROM users
      WHERE mobile = $1
      `,
      [mobile]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Block inactive or unapproved users
    if (!user.is_active || user.approval_status !== "approved") {
      return res.status(403).json({ message: "Account not approved or inactive" });
    }

    /**
     * SUPER ADMIN LOGIN (PIN REQUIRED)
     */
    if (user.role === "super_admin") {
      if (!admin_pin) {
        return res.status(400).json({ message: "Admin PIN required" });
      }

      if (user.admin_pin !== admin_pin) {
        return res.status(401).json({ message: "Invalid admin PIN" });
      }
    } else {
      // For now, block all non-admin logins (safe default)
      return res.status(403).json({
        message: "Only Super Admin login enabled currently"
      });
    }

    /**
     * ISSUE JWT
     */
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        mobile: user.mobile
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
