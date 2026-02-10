const express = require("express");
const pool = require("../db");
const auth = require("../middlewares/auth");

const router = express.Router();

/**
 * GET ALL PRODUCTS
 * Visible to: supplier, retailer, tailor, customer
 */
router.get("/", auth, async (req, res) => {
  try {
    const { role } = req.user;

    let query = `
      SELECT
        p.*,
        u.name AS seller_name,
        u.role AS seller_role
      FROM products p
      JOIN users u ON u.id = p.seller_id
    `;

    // Customers can only see approved sellers
    if (role === "customer") {
      query += ` WHERE u.is_active = true `;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query);

    res.json({
      user: req.user,
      products: result.rows
    });
  } catch (err) {
    console.error("FETCH PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/**
 * ADD PRODUCT
 * Allowed roles: supplier, retailer, tailor
 * seller_id & seller_role derived from JWT
 */
router.post("/", auth, async (req, res) => {
  try {
    const { id: seller_id, role: seller_role } = req.user;

    if (!["supplier", "retailer", "tailor"].includes(seller_role)) {
      return res.status(403).json({
        message: "You are not allowed to add products"
      });
    }

    const {
      name,
      category,
      price,
      moq,
      bulk_discount_percent,
      delivery_charge,
      description,
      quality_grade,
      product_type,
      available_quantity
    } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO products
      (
        name,
        category,
        price,
        moq,
        bulk_discount_percent,
        delivery_charge,
        description,
        quality_grade,
        product_type,
        available_quantity,
        seller_id,
        seller_role
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        name,
        category,
        price,
        moq || 1,
        bulk_discount_percent || 0,
        delivery_charge || 0,
        description || null,
        quality_grade || null,
        product_type || null,
        available_quantity || 0,
        seller_id,
        seller_role
      ]
    );

    res.json({
      message: "Product added successfully",
      product: result.rows[0]
    });
  } catch (err) {
    console.error("ADD PRODUCT ERROR:", err);
    res.status(500).json({ error: "Failed to add product" });
  }
});

/**
 * GET MY PRODUCTS
 * Seller sees only their own products
 */
router.get("/mine", auth, async (req, res) => {
  try {
    const { id: seller_id } = req.user;

    const result = await pool.query(
      `
      SELECT *
      FROM products
      WHERE seller_id = $1
      ORDER BY created_at DESC
      `,
      [seller_id]
    );

    res.json({
      user: req.user,
      products: result.rows
    });
  } catch (err) {
    console.error("FETCH MY PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch your products" });
  }
});

module.exports = router;
