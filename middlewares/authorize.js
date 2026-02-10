/**
 * ROLE-BASED AUTHORIZATION MIDDLEWARE
 *
 * Usage:
 *   authorize("supplier")
 *   authorize(["supplier", "retailer", "tailor"])
 */

module.exports = function authorize(requiredRoles) {
  return function (req, res, next) {
    // Auth middleware must run before this
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: "User not authenticated"
      });
    }

    const userRole = req.user.role;

    // Normalize roles to array
    const allowedRoles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "Access denied: insufficient permissions"
      });
    }

    next();
  };
};
