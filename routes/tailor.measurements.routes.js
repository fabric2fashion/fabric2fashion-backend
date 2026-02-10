/**
 * ======================================================
 * TAILOR MEASUREMENT MASTER ROUTES
 * Fabric2Fashion Backend
 * ======================================================
 */

const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

/**
 * ======================================================
 * ADD GARMENT (Manual + Custom)
 * ======================================================
 * Tailor can add garments beyond system list
 */
router.post("/garments", auth, authorize("tailor"), async (req, res) => {
  try {
    const { name, gender } = req.body;

    if (!name || !gender) {
      return res.status(400).json({ message: "Name and gender required" });
    }

    const result = await pool.query(
      `
      INSERT INTO garments (name, gender, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [name.trim(), gender, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ADD GARMENT ERROR:", err);
    res.status(500).json({ error: "Failed to add garment" });
  }
});

/**
 * ======================================================
 * LIST GARMENTS (System + Tailor Created)
 * ======================================================
 */
router.get("/garments", auth, authorize("tailor"), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM garments
      WHERE is_active = true
        AND (created_by IS NULL OR created_by = $1)
      ORDER BY name
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("LIST GARMENTS ERROR:", err);
    res.status(500).json({ error: "Failed to load garments" });
  }
});

/**
 * ======================================================
 * ADD MEASUREMENT HEAD
 * ======================================================
 * Example: Chest, Waist, Sleeve Length, Neck Type, etc.
 */
router.post("/measurement-heads", auth, authorize("tailor"), async (req, res) => {
  try {
    const {
      garment_id,
      label,
      field_type,   // number | text | dropdown
      unit,         // inch | cm | null
      is_required,
      sort_order
    } = req.body;

    if (!garment_id || !label || !field_type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO measurement_heads
        (garment_id, label, field_type, unit, is_required, sort_order, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        garment_id,
        label.trim(),
        field_type,
        unit || null,
        is_required ?? false,
        sort_order ?? 0,
        req.user.id
      ]
    );

    res.status(201).json({ head: result.rows[0] });
  } catch (err) {
    console.error("ADD MEASUREMENT HEAD ERROR:", err);
    res.status(500).json({ error: "Failed to add measurement head" });
  }
});

/**
 * ======================================================
 * ADD DROPDOWN OPTION
 * ======================================================
 * Example: Collar Type → Round / Square / V
 */
router.post("/measurement-options", auth, authorize("tailor"), async (req, res) => {
  try {
    const { measurement_head_id, value } = req.body;

    if (!measurement_head_id || !value) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const result = await pool.query(
      `
      INSERT INTO measurement_options (measurement_head_id, value)
      VALUES ($1, $2)
      RETURNING *
      `,
      [measurement_head_id, value.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("ADD OPTION ERROR:", err);
    res.status(500).json({ error: "Failed to add option" });
  }
});

/**
 * ======================================================
 * GET MEASUREMENT HEADS FOR A GARMENT
 * ======================================================
 */
router.get(
  "/measurement-heads/:garmentId",
  auth,
  authorize("tailor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM measurement_heads
        WHERE garment_id = $1
        ORDER BY sort_order
        `,
        [req.params.garmentId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("FETCH MEASUREMENT HEADS ERROR:", err);
      res.status(500).json({ error: "Failed to fetch measurement heads" });
    }
  }
);

/**
 * ======================================================
 * 🚨 IMPORTANT
 * Express requires EXACTLY this export
 * ======================================================
 */
module.exports = router;
