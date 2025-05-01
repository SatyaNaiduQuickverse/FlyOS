// services/auth/src/middleware/rbac.js

/**
 * Role-Based Access Control (RBAC) middleware
 * Checks if the authenticated user has one of the allowed roles
 * @param {Array} allowedRoles - Array of roles that are allowed to access the route
 * @returns {Function} Middleware function
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user's role is in the allowed roles
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Insufficient permissions.'
      });
    }
  };
};

/**
 * Region-Based Access Control middleware
 * Ensures users can only access data from their assigned region
 * @param {Boolean} allowMainHQ - Whether to allow Main HQ to bypass region check
 * @returns {Function} Middleware function
 */
const checkRegion = (allowMainHQ = true) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Main HQ can access all regions if allowed
    if (allowMainHQ && req.user.role === 'MAIN_HQ') {
      next();
      return;
    }

    // Get requested region from params, query or body
    const requestedRegion = req.params.regionId || req.query.regionId || req.body.regionId;
    
    // If no region specified in request, continue
    if (!requestedRegion) {
      next();
      return;
    }

    // Check if user has access to requested region
    if (req.user.regionId === requestedRegion) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have access to this region.'
      });
    }
  };
};

module.exports = { 
  checkRole,
  checkRegion
};
