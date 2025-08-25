/**
 * Password Reset Routes
 * Handles secure password reset workflow
 */

const express = require('express');
const router = express.Router();
const validator = require('validator');

const { PasswordResetService, PasswordResetError } = require('../../services/password-reset');
const { passwordResetRateLimit, sanitizeRequest } = require('../../middleware/security');

class PasswordResetRouteError extends Error {
  constructor(message, statusCode = 400, code = 'PASSWORD_RESET_ROUTE_ERROR') {
    super(message);
    this.name = 'PasswordResetRouteError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * @route POST /api/auth/password-reset/request
 * @desc Request password reset
 * @access Public
 * @rateLimit 3 attempts per hour per email, 10 attempts per hour per IP
 */
router.post('/request', [
  passwordResetRateLimit(),
  sanitizeRequest()
], async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      throw new PasswordResetRouteError('Email address is required', 400, 'MISSING_EMAIL');
    }

    if (!validator.isEmail(email)) {
      throw new PasswordResetRouteError('Please provide a valid email address', 400, 'INVALID_EMAIL');
    }

    // Get client IP for rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;

    // Security: Log password reset request
    console.info('Password reset requested:', {
      email: validator.normalizeEmail(email),
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Initiate password reset
    const result = await PasswordResetService.initiatePasswordReset(email, clientIP);

    res.json({
      success: true,
      message: result.message,
      data: {
        emailSent: result.emailSent,
        expiresIn: result.expiresIn
      }
    });

  } catch (error) {
    if (error instanceof PasswordResetError) {
      // Map service errors to appropriate HTTP status codes
      let statusCode = 400;
      if (error.code === 'RATE_LIMIT_EMAIL_EXCEEDED' || 
          error.code === 'RATE_LIMIT_IP_EXCEEDED' || 
          error.code === 'RATE_LIMIT_TOO_SOON') {
        statusCode = 429;
      } else if (error.code === 'EMAIL_NOT_VERIFIED') {
        statusCode = 403;
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else if (error instanceof PasswordResetRouteError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('Password reset request error:', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * @route GET /api/auth/password-reset/verify/:token
 * @desc Verify password reset token
 * @access Public
 */
router.get('/verify/:token', [
  sanitizeRequest()
], async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw new PasswordResetRouteError('Reset token is required', 400, 'MISSING_TOKEN');
    }

    // Validate token format (should be hex string)
    if (!validator.isHexadecimal(token) || token.length !== 64) {
      throw new PasswordResetRouteError('Invalid token format', 400, 'INVALID_TOKEN_FORMAT');
    }

    // Security: Log token verification attempt
    console.info('Password reset token verification:', {
      tokenPrefix: token.substring(0, 8) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Verify the token
    const result = await PasswordResetService.verifyResetToken(token);

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: result.valid,
        email: result.email,
        expiresAt: result.expiresAt
      }
    });

  } catch (error) {
    if (error instanceof PasswordResetError) {
      let statusCode = 400;
      if (error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_TOKEN') {
        statusCode = 410; // Gone - token is no longer valid
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else if (error instanceof PasswordResetRouteError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('Password reset token verification error:', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: 'Failed to verify reset token',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * @route POST /api/auth/password-reset/complete
 * @desc Complete password reset with new password
 * @access Public
 */
router.post('/complete', [
  sanitizeRequest()
], async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!token) {
      throw new PasswordResetRouteError('Reset token is required', 400, 'MISSING_TOKEN');
    }

    if (!newPassword) {
      throw new PasswordResetRouteError('New password is required', 400, 'MISSING_NEW_PASSWORD');
    }

    if (!confirmPassword) {
      throw new PasswordResetRouteError('Password confirmation is required', 400, 'MISSING_CONFIRM_PASSWORD');
    }

    // Validate token format
    if (!validator.isHexadecimal(token) || token.length !== 64) {
      throw new PasswordResetRouteError('Invalid token format', 400, 'INVALID_TOKEN_FORMAT');
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      throw new PasswordResetRouteError('New password and confirmation do not match', 400, 'PASSWORD_MISMATCH');
    }

    // Get client IP for logging
    const clientIP = req.ip || req.connection.remoteAddress;

    // Security: Log password reset completion attempt
    console.info('Password reset completion attempt:', {
      tokenPrefix: token.substring(0, 8) + '...',
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Complete the password reset
    const result = await PasswordResetService.completePasswordReset(token, newPassword, clientIP);

    res.json({
      success: true,
      message: result.message,
      data: {
        userId: result.userId
      }
    });

  } catch (error) {
    if (error instanceof PasswordResetError) {
      let statusCode = 400;
      if (error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_TOKEN') {
        statusCode = 410; // Gone - token is no longer valid
      } else if (error.code === 'ACCOUNT_INACTIVE') {
        statusCode = 403; // Forbidden
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else if (error instanceof PasswordResetRouteError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('Password reset completion error:', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: 'Failed to complete password reset',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * @route GET /api/auth/password-reset/health
 * @desc Health check for password reset service
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await PasswordResetService.getStats();
    
    res.json({
      success: true,
      message: 'Password reset service is healthy',
      timestamp: new Date().toISOString(),
      service: 'password-reset',
      stats: {
        activeTokens: stats.activeTokens,
        recentRequests: stats.recentRequests,
        config: stats.config
      }
    });
  } catch (error) {
    console.error('Password reset health check error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

/**
 * @route POST /api/auth/password-reset/cleanup
 * @desc Clean up expired tokens (admin endpoint - would require auth in production)
 * @access Public (should be Private/Admin in production)
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleanupResult = await PasswordResetService.cleanup();
    
    console.info('Password reset cleanup performed:', cleanupResult);
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      data: cleanupResult
    });
  } catch (error) {
    console.error('Password reset cleanup error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      code: 'CLEANUP_ERROR'
    });
  }
});

module.exports = router;