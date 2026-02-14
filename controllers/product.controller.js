/**
 * ==========================================
 * Product Controller
 * Fabric2Fashion
 * ==========================================
 */

const ProductService = require("../services/product.service.js");

/**
 * Create product (Supplier / Retailer)
 */
exports.create = async (req, res) => {
  try {
    const product = await ProductService.createProduct(
      req.user.id,
      req.body
    );

    res.status(201).json(product);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * Get my products
 */
exports.myProducts = async (req, res) => {
  try {
    const products = await ProductService.getMyProducts(req.user.id);
    res.json({ products });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

/**
 * Marketplace
 */
exports.marketplace = async (req, res) => {
  try {
    const products = await ProductService.getMarketplaceProducts();
    res.json({ products });

  } catch (err) {
    res.status(500).json({ error: "Failed to load marketplace" });
  }
};

/**
 * Update stock
 */
exports.updateStock = async (req, res) => {
  try {
    const product = await ProductService.updateStock(
      req.params.id,
      req.body.stock
    );

    res.json(product);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * Deactivate
 */
exports.deactivate = async (req, res) => {
  try {
    const product = await ProductService.deactivateProduct(req.params.id);
    res.json(product);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
