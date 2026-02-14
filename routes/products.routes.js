const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");
const ProductController = require("../controllers/product.controller");

/**
 * Marketplace
 */
router.get("/", ProductController.marketplace);

/**
 * Owner routes
 */
router.post(
  "/",
  auth,
  authorize("supplier", "retailer"),
  ProductController.create
);

router.get(
  "/mine",
  auth,
  authorize("supplier", "retailer"),
  ProductController.myProducts
);

router.put(
  "/:id/stock",
  auth,
  authorize("supplier", "retailer"),
  ProductController.updateStock
);

router.delete(
  "/:id",
  auth,
  authorize("supplier", "retailer"),
  ProductController.deactivate
);

module.exports = router;
