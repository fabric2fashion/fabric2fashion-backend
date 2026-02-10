/**
 * ======================================================
 * PROFILE ROUTES (ALL ROLES)
 * Fabric2Fashion Backend – PRODUCTION SAFE
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * GET MY PROFILE
 * ======================================================
 */
router.get("/me", auth, async (req, res) => {
  try {
    const userRes = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.mobile,
        u.email,
        u.address,
        u.role,
        u.profile_photo,
        u.business_name,
        u.gst_number,
        u.is_profile_complete,
        u.status,

        b.account_name,
        b.bank_name,
        b.account_no,
        b.ifsc,
        b.upi,
        b.is_verified AS bank_verified
      FROM users u
      LEFT JOIN bank_accounts b ON b.user_id = u.id
      WHERE u.id = $1
      `,
      [req.user.id]
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(userRes.rows[0]);
  } catch (err) {
    console.error("PROFILE FETCH ERROR:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

/**
 * ======================================================
 * UPDATE BASIC PROFILE
 * (SAFE FIELDS ONLY – NO ROLE ESCALATION)
 * ======================================================
 */
router.put("/update", auth, async (req, res) => {
  try {
    const {
      name,
      email,
      address,
      profile_photo,
      business_name,
      gst_number
    } = req.body;

    await pool.query(
      `
      UPDATE users
      SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        address = COALESCE($3, address),
        profile_photo = COALESCE($4, profile_photo),
        business_name = COALESCE($5, business_name),
        gst_number = COALESCE($6, gst_number)
      WHERE id = $7
      `,
      [
        name,
        email,
        address,
        profile_photo,
        business_name,
        gst_number,
        req.user.id
      ]
    );

    await recomputeProfileCompletion(req.user.id);

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * ======================================================
 * ADD / UPDATE BANK DETAILS
 * ❌ NOT ALLOWED FOR CUSTOMER
 * ❌ VERIFIED BANK CANNOT BE MODIFIED
 * ======================================================
 */
router.post("/bank", auth, async (req, res) => {
  try {
    if (req.user.role === "customer") {
      return res.status(403).json({
        message: "Customers cannot add bank details"
      });
    }

    const {
      account_name,
      bank_name,
      account_no,
      ifsc,
      upi
    } = req.body;

    if (!account_name || !bank_name || !account_no || !ifsc) {
      return res.status(400).json({
        message: "Incomplete bank details"
      });
    }

    // Check if verified bank already exists
    const existing = await pool.query(
      `
      SELECT is_verified
      FROM bank_accounts
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    if (existing.rows.length && existing.rows[0].is_verified) {
      return res.status(403).json({
        message: "Verified bank details cannot be modified"
      });
    }

    await pool.query(
      `
      INSERT INTO bank_accounts
        (user_id, account_name, bank_name,
         account_no, ifsc, upi, is_verified)
      VALUES ($1,$2,$3,$4,$5,$6,false)
      ON CONFLICT (user_id)
      DO UPDATE SET
        account_name = EXCLUDED.account_name,
        bank_name = EXCLUDED.bank_name,
        account_no = EXCLUDED.account_no,
        ifsc = EXCLUDED.ifsc,
        upi = EXCLUDED.upi,
        is_verified = false
      `,
      [
        req.user.id,
        account_name,
        bank_name,
        account_no,
        ifsc,
        upi || null
      ]
    );

    await recomputeProfileCompletion(req.user.id);

    res.json({
      message: "Bank details saved. Pending admin verification."
    });
  } catch (err) {
    console.error("BANK SAVE ERROR:", err);
    res.status(500).json({ error: "Failed to save bank details" });
  }
});

/**
 * ======================================================
 * ADMIN – VERIFY BANK DETAILS
 * ======================================================
 */
router.patch(
  "/bank/verify/:userId",
  auth,
  authorize("super_admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `
        UPDATE bank_accounts
        SET is_verified = true
        WHERE user_id = $1
        RETURNING *
        `,
        [userId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          message: "Bank details not found"
        });
      }

      await recomputeProfileCompletion(userId);

      res.json({
        message: "Bank details verified successfully"
      });
    } catch (err) {
      console.error("BANK VERIFY ERROR:", err);
      res.status(500).json({ error: "Failed to verify bank" });
    }
  }
);

/**
 * ======================================================
 * INTERNAL: PROFILE COMPLETION CHECK
 * ======================================================
 */
async function recomputeProfileCompletion(userId) {
  const res = await pool.query(
    `
    SELECT
      u.role,
      u.name,
      u.mobile,
      b.account_no,
      b.ifsc,
      b.is_verified
    FROM users u
    LEFT JOIN bank_accounts b ON b.user_id = u.id
    WHERE u.id = $1
    `,
    [userId]
  );

  if (!res.rows.length) return;

  const u = res.rows[0];

  let complete = false;

  if (u.role === "customer") {
    complete = Boolean(u.name && u.mobile);
  } else {
    complete = Boolean(
      u.name &&
      u.mobile &&
      u.account_no &&
      u.ifsc &&
      u.is_verified
    );
  }

  await pool.query(
    `
    UPDATE users
    SET is_profile_complete = $1
    WHERE id = $2
    `,
    [complete, userId]
  );
}

module.exports = router;
