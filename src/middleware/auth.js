/**
 * Authentication Middleware
 * Core middleware for handling authentication and authorization
 */

const { verifyToken, extractTokenFromHeader, JWTError } = require('../auth/jwt');
const authConfig = require('../config/auth');

class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Main authentication middleware
 * Verifies JWT token and sets req.user
 * @param {boolean} required - Whether authentication is required (default: true)
 */
function authenticate(required = true) {
  return async (req, res, next) => {
    try {
      const token = extractTokenFromHeader(req.headers.authorization);

      if (!token) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'NO_TOKEN'
          });
        }
        req.user = null;
        return next();
      }

      try {
        const decoded = verifyToken(token);
        
        // Set user information on request object
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          emailVerified: decoded.emailVerified,
          kycStatus: decoded.kycStatus,
          tokenType: decoded.type,
          iat: decoded.iat,
          exp: decoded.exp
        };

        // Set token on request for potential refresh operations
        req.token = token;

        next();

      } catch (jwtError) {
        if (required) {
          let statusCode = 401;
          let message = 'Invalid token';
          
          switch (jwtError.code) {
            case 'TOKEN_EXPIRED':
              statusCode = 401;
              message = 'Token has expired';
              break;
            case 'INVALID_TOKEN':
              statusCode = 401;
              message = 'Invalid token';
              break;
            case 'TOKEN_NOT_ACTIVE':
              statusCode = 401;
              message = 'Token not yet active';
              break;
            default:
              statusCode = 401;
              message = 'Authentication failed';
          }

          return res.status(statusCode).json({
            success: false,
            error: message,
            code: jwtError.code
          });
        }

        req.user = null;
        next();
      }

    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authentication error',
        code: 'AUTH_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Authorization middleware for role-based access control
 * @param {string|Array<string>} allowedRoles - Role(s) that can access the resource
 */
function authorize(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();

    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authorization error',
        code: 'AUTH_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to require email verification
 */
function requireEmailVerification() {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (!req.user.emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Email verification required',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }

      next();

    } catch (error) {
      console.error('Email verification middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal verification error',
        code: 'VERIFICATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to require KYC verification
 * @param {string} requiredStatus - Required KYC status (default: 'verified')
 */
function requireKYCVerification(requiredStatus = 'verified') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (req.user.kycStatus !== requiredStatus) {
        return res.status(403).json({
          success: false,
          error: 'KYC verification required',
          code: 'KYC_NOT_VERIFIED',
          currentStatus: req.user.kycStatus,
          requiredStatus
        });
      }

      next();

    } catch (error) {
      console.error('KYC verification middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal verification error',
        code: 'VERIFICATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to check if user can access their own resources or if admin
 * @param {string} userIdParam - Parameter name containing user ID (default: 'userId')
 */
function requireOwnershipOrAdmin(userIdParam = 'userId') {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const targetUserId = req.params[userIdParam];
      const isOwner = req.user.id === targetUserId;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Can only access your own resources',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();

    } catch (error) {
      console.error('Ownership middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authorization error',
        code: 'AUTH_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to validate token type (access vs refresh)
 * @param {string} expectedType - Expected token type ('access' or 'refresh')
 */
function requireTokenType(expectedType) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (req.user.tokenType !== expectedType) {
        return res.status(401).json({
          success: false,
          error: `${expectedType.charAt(0).toUpperCase() + expectedType.slice(1)} token required`,
          code: 'INVALID_TOKEN_TYPE'
        });
      }

      next();

    } catch (error) {
      console.error('Token type middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authentication error',
        code: 'AUTH_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Optional authentication middleware (sets req.user if token present but doesn't require it)
 */
const optionalAuthenticate = authenticate(false);

/**
 * Required authentication middleware (requires valid token)
 */
const requiredAuthenticate = authenticate(true);

/**
 * Admin only access
 */
const adminOnly = [requiredAuthenticate, authorize('admin')];

/**
 * Moderator or admin access
 */
const moderatorOrAdmin = [requiredAuthenticate, authorize(['moderator', 'admin'])];

/**
 * Verified user access (email verified)
 */
const verifiedUserOnly = [requiredAuthenticate, requireEmailVerification()];

/**
 * KYC verified user access
 */
const kycVerifiedOnly = [requiredAuthenticate, requireKYCVerification()];

/**
 * Full verification required (email + KYC)
 */
const fullVerificationRequired = [
  requiredAuthenticate,
  requireEmailVerification(),
  requireKYCVerification()
];

module.exports = {
  authenticate,
  authorize,
  requireEmailVerification,
  requireKYCVerification,
  requireOwnershipOrAdmin,
  requireTokenType,
  optionalAuthenticate,
  requiredAuthenticate,
  adminOnly,
  moderatorOrAdmin,
  verifiedUserOnly,
  kycVerifiedOnly,
  fullVerificationRequired,
  AuthError
};