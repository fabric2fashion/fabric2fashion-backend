const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

/**
 * REGISTER
 */
router.post("/register", async (req, res) => {
  try {
    const { name, mobile, role } = req.body;

    if (!name || !mobile || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const exists = await pool.query(
      "SELECT id FROM users WHERE mobile = $1",
      [mobile]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "User already exists" });
    }

    await pool.query(
      `INSERT INTO users (name, mobile, role, approval_status, is_active)
       VALUES ($1,$2,$3,'approved',true)`,
      [name, mobile, role]
    );

    res.json({ message: "Registration successful" });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * LOGIN  ✅ (SINGLE, CLEAN, CORRECT)
 */
router.post("/login", async (req, res) => {
  try {
    console.log("LOGIN HEADERS:", req.headers);
    console.log("LOGIN BODY:", req.body);

    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile required" });
    }

    const result = await pool.query(
      `SELECT id, role, approval_status, is_active
       FROM users
       WHERE mobile = $1`,
      [mobile]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid mobile" });
    }

    const user = result.rows[0];

    if (user.approval_status !== "approved") {
      return res.status(403).json({ message: "User not approved" });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "User inactive" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        role: user.role
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR FULL:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
