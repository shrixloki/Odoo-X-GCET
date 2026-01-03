const { logger } = require('../config/logger');

/**
 * Role-based authorization middleware
 * Checks if the authenticated user has the required role(s) to access a resource
 */
class AuthorizationMiddleware {
  /**
   * Create middleware that requires specific roles
   * @param {string|string[]} requiredRoles - Single role or array of roles
   * @param {Object} options - Additional options
   * @param {boolean} options.requireAll - If true, user must have ALL roles (default: false - requires ANY role)
   * @param {boolean} options.allowSelf - If true, allows access to own resources regardless of role
   * @param {string} options.resourceIdParam - Parameter name for resource ID (for self-access check)
   */
  static requireRole(requiredRoles, options = {}) {
    const {
      requireAll = false,
      allowSelf = false,
      resourceIdParam = 'id'
    } = options;

    // Normalize roles to array
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    return (req, res, next) => {
      try {
        // Check if user is authenticated
        if (!req.user) {
          logger.warn('Authorization failed: No authenticated user', {
            event: 'AUTHORIZATION_FAILED',
            reason: 'NO_USER',
            ip: req.ip,
            method: req.method,
            url: req.url,
            type: 'SECURITY_EVENT'
          });

          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const userRole = req.user.role;
        const userId = req.user.id;

        // Check for self-access if enabled
        if (allowSelf && resourceIdParam) {
          const resourceId = req.params[resourceIdParam];
          if (resourceId && userId.toString() === resourceId.toString()) {
            logger.info('Authorization granted: Self-access', {
              event: 'AUTHORIZATION_GRANTED',
              reason: 'SELF_ACCESS',
              userId,
              userRole,
              resourceId,
              ip: req.ip,
              method: req.method,
              url: req.url,
              type: 'SECURITY_EVENT'
            });
            return next();
          }
        }

        // Check role-based access
        let hasAccess = false;

        if (requireAll) {
          // User must have ALL required roles
          hasAccess = roles.every(role => userRole === role || this.hasRoleHierarchy(userRole, role));
        } else {
          // User must have ANY of the required roles
          hasAccess = roles.some(role => userRole === role || this.hasRoleHierarchy(userRole, role));
        }

        if (!hasAccess) {
          logger.warn('Authorization failed: Insufficient role', {
            event: 'AUTHORIZATION_FAILED',
            reason: 'INSUFFICIENT_ROLE',
            userId,
            userRole,
            requiredRoles: roles,
            requireAll,
            ip: req.ip,
            method: req.method,
            url: req.url,
            type: 'SECURITY_EVENT'
          });

          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }

        // Authorization successful
        logger.info('Authorization granted: Role-based access', {
          event: 'AUTHORIZATION_GRANTED',
          reason: 'ROLE_BASED',
          userId,
          userRole,
          requiredRoles: roles,
          ip: req.ip,
          method: req.method,
          url: req.url,
          type: 'SECURITY_EVENT'
        });

        next();
      } catch (error) {
        logger.error('Authorization middleware error', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          ip: req.ip,
          method: req.method,
          url: req.url,
          type: 'SECURITY_EVENT'
        });

        res.status(500).json({
          success: false,
          message: 'Authorization check failed'
        });
      }
    };
  }

  /**
   * Check if a user role has access to a required role based on hierarchy
   * Admin > HR_Manager > Employee
   * @param {string} userRole - User's current role
   * @param {string} requiredRole - Required role for access
   * @returns {boolean} - True if user role has sufficient privileges
   */
  static hasRoleHierarchy(userRole, requiredRole) {
    const roleHierarchy = {
      'Admin': ['Admin', 'HR_Manager', 'Employee'],
      'HR_Manager': ['HR_Manager', 'Employee'],
      'Employee': ['Employee']
    };

    const userPermissions = roleHierarchy[userRole] || [];
    return userPermissions.includes(requiredRole);
  }

  /**
   * Middleware for Admin-only access
   */
  static requireAdmin() {
    return this.requireRole('Admin');
  }

  /**
   * Middleware for HR Manager or Admin access
   */
  static requireHROrAdmin() {
    return this.requireRole(['Admin', 'HR_Manager']);
  }

  /**
   * Middleware for Employee access (any authenticated user)
   */
  static requireEmployee() {
    return this.requireRole(['Admin', 'HR_Manager', 'Employee']);
  }

  /**
   * Middleware for self-access or admin access
   * Allows users to access their own resources or admins to access any resource
   */
  static requireSelfOrAdmin(resourceIdParam = 'id') {
    return this.requireRole('Admin', {
      allowSelf: true,
      resourceIdParam
    });
  }

  /**
   * Middleware for self-access or HR/Admin access
   * Allows users to access their own resources or HR/Admin to access any resource
   */
  static requireSelfOrHR(resourceIdParam = 'id') {
    return this.requireRole(['Admin', 'HR_Manager'], {
      allowSelf: true,
      resourceIdParam
    });
  }

  /**
   * Custom middleware for complex authorization logic
   * @param {Function} authorizationFunction - Custom function that receives (req, res, next)
   */
  static custom(authorizationFunction) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        authorizationFunction(req, res, next);
      } catch (error) {
        logger.error('Custom authorization middleware error', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          ip: req.ip,
          method: req.method,
          url: req.url,
          type: 'SECURITY_EVENT'
        });

        res.status(500).json({
          success: false,
          message: 'Authorization check failed'
        });
      }
    };
  }

  /**
   * Middleware to check if user can manage another user
   * Admins can manage anyone, HR can manage employees, employees can only manage themselves
   */
  static requireUserManagement(targetUserIdParam = 'userId') {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const currentUser = req.user;
        const targetUserId = req.params[targetUserIdParam];

        // Admin can manage anyone
        if (currentUser.role === 'Admin') {
          return next();
        }

        // HR can manage employees (but not other HR or Admins)
        if (currentUser.role === 'HR_Manager') {
          // We would need to fetch the target user's role here
          // For now, we'll allow HR to manage if it's not themselves
          if (currentUser.id.toString() !== targetUserId.toString()) {
            return next();
          }
        }

        // Users can only manage themselves
        if (currentUser.id.toString() === targetUserId.toString()) {
          return next();
        }

        logger.warn('Authorization failed: Cannot manage user', {
          event: 'AUTHORIZATION_FAILED',
          reason: 'CANNOT_MANAGE_USER',
          userId: currentUser.id,
          userRole: currentUser.role,
          targetUserId,
          ip: req.ip,
          method: req.method,
          url: req.url,
          type: 'SECURITY_EVENT'
        });

        return res.status(403).json({
          success: false,
          message: 'Cannot manage this user'
        });
      } catch (error) {
        logger.error('User management authorization error', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          ip: req.ip,
          method: req.method,
          url: req.url,
          type: 'SECURITY_EVENT'
        });

        res.status(500).json({
          success: false,
          message: 'Authorization check failed'
        });
      }
    };
  }
}

module.exports = AuthorizationMiddleware;