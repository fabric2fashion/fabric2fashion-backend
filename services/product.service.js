/**
 * ==========================================
 * Product Service
 * Fabric2Fashion
 * ==========================================
 * Business logic for products
 */

const ProductModel = require("../models/product.model");

/**
 * Create product
 */
async function createProduct(ownerId, payload) {
  return ProductModel.createProduct({
    owner_id: ownerId,
    ...payload
  });
}

/**
 * Owner products
 */
async function getMyProducts(ownerId) {
  return ProductModel.findByOwner(ownerId);
}

/**
 * Marketplace products
 */
async function getMarketplaceProducts() {
  return ProductModel.findAllActive();
}

/**
 * Update stock
 */
async function updateStock(productId, stock) {
  return ProductModel.updateStock(productId, stock);
}

/**
 * Deactivate product
 */
async function deactivateProduct(productId) {
  return ProductModel.deactivateProduct(productId);
}

module.exports = {
  createProduct,
  getMyProducts,
  getMarketplaceProducts,
  updateStock,
  deactivateProduct
};
