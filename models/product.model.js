/**
 * ==========================================
 * Product Model
 * Fabric2Fashion
 * ==========================================
 * Handles ALL database operations
 * related to products
 *
 * ❌ No HTTP logic
 * ❌ No business rules
 * ❌ No role checks
 */

const db = require("../db");

/**
 * ------------------------------------------
 * Create new product
 * ------------------------------------------
 */
async function createProduct({
  seller_id,
  seller_role,          // supplier | retailer
  name,
  category,
  description = null,
  price,
  available_quantity
}) {
  const { rows } = await db.query(
    `
    INSERT INTO products (
      seller_id,
      seller_role,
      name,
      category,
      description,
      price,
      available_quantity,
      is_active
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,true)
    RETURNING *
    `,
    [
      seller_id,
      seller_role,
      name,
      category,
      description,
      price,
      available_quantity
    ]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Get product by ID
 * ------------------------------------------
 */
async function findById(productId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM products
    WHERE id = $1 AND is_active = true
    `,
    [productId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * List products (public / buyer)
 * ------------------------------------------
 */
async function listAll() {
  const { rows } = await db.query(
    `
    SELECT *
    FROM products
    WHERE is_active = true
    ORDER BY created_at DESC
    `
  );

  return rows;
}

/**
 * ------------------------------------------
 * List products by seller
 * ------------------------------------------
 */
async function listBySeller(sellerId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM products
    WHERE seller_id = $1
    ORDER BY created_at DESC
    `,
    [sellerId]
  );

  return rows;
}

/**
 * ------------------------------------------
 * Update product details
 * ------------------------------------------
 */
async function updateProduct(productId, updates) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const key in updates) {
    fields.push(`${key} = $${index++}`);
    values.push(updates[key]);
  }

  if (!fields.length) return null;

  const { rows } = await db.query(
    `
    UPDATE products
    SET ${fields.join(", ")},
        updated_at = NOW()
    WHERE id = $${index}
    RETURNING *
    `,
    [...values, productId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Reduce inventory (on order placement)
 * ------------------------------------------
 */
async function reduceInventory(productId, quantity) {
  const { rows } = await db.query(
    `
    UPDATE products
    SET available_quantity = available_quantity - $1
    WHERE id = $2
      AND available_quantity >= $1
    RETURNING *
    `,
    [quantity, productId]
  );

  return rows[0];
}

/**
 * ------------------------------------------
 * Soft delete product
 * ------------------------------------------
 */
async function deactivateProduct(productId) {
  const { rows } = await db.query(
    `
    UPDATE products
    SET is_active = false,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [productId]
  );

  return rows[0];
}

module.exports = {
  createProduct,
  findById,
  listAll,
  listBySeller,
  updateProduct,
  reduceInventory,
  deactivateProduct
};
