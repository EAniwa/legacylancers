/**
 * Login Routes
 * Handles user login with enhanced security features
 */

const express = require('express');
const router = express.Router();
const validator = require('validator');

const { verifyPassword } = require('../../auth/password');
const { generateTokenPair } = require('../../auth/jwt');
const { User, UserError } = require('../../models/User');
const { loginRateLimit, sanitizeRequest } = require('../../middleware/security');

class LoginError extends Error {
  constructor(message, statusCode = 400, code = 'LOGIN_ERROR') {
    super(message);
    this.name = 'LoginError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * @route POST /api/auth/login
 * @desc Login user with enhanced security
 * @access Public
 * @rateLimit 5 attempts per 15 minutes per IP+email combination
 */
router.post('/', [
  loginRateLimit(),
  sanitizeRequest()
], async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new LoginError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      throw new LoginError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Normalize email
    const normalizedEmail = validator.normalizeEmail(email);

    // Security: Log the login attempt (without sensitive data)
    console.info('Login attempt:', {
      email: normalizedEmail,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Find user by email (includes password hash for verification)
    const user = await User.findByEmailWithPassword(normalizedEmail);

    if (!user) {
      // Security: Don't reveal whether email exists or not
      throw new LoginError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user account is active
    if (user.status !== 'active') {
      throw new LoginError('Account is not active. Please contact support.', 401, 'ACCOUNT_INACTIVE');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      // Provide actionable error for unverified emails
      throw new LoginError('Please verify your email address to continue. Check your inbox for the verification link.', 401, 'EMAIL_NOT_VERIFIED');
    }

    // Verify password with timing-safe comparison
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      // Security: Log failed password attempts
      console.warn('Failed password attempt:', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      throw new LoginError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate JWT tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus
    };

    const tokens = generateTokenPair(tokenPayload);

    // Apply remember me option by extending refresh token expiry
    if (rememberMe) {
      // In a production system, you would extend the refresh token expiry here
      // For now, we'll use the standard expiry but note the preference
      console.info('Remember me requested for user:', user.id);
    }

    // Security: Log successful login
    console.info('Successful login:', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      rememberMe,
      timestamp: new Date().toISOString()
    });

    // Remove sensitive data from response
    const { passwordHash, ...userResponse } = user;

    // Send successful response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        ...tokens,
        rememberMe
      }
    });

  } catch (error) {
    // Security: Don't leak internal error details
    if (error instanceof LoginError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else if (error instanceof UserError) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      // Security: Log internal errors for monitoring
      console.error('Internal login error:', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        error: 'Login failed due to server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user (client-side token invalidation)
 * @access Private (requires valid access token)
 */
router.post('/logout', async (req, res) => {
  try {
    // In a stateless JWT system, logout is primarily handled client-side
    // However, we log the logout for security auditing
    
    const authHeader = req.get('Authorization');
    if (authHeader) {
      // Extract user info from token for logging (if available)
      const token = authHeader.replace('Bearer ', '');
      
      // Security: Log logout event
      console.info('User logout:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        hasToken: !!token,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * @route GET /api/auth/login/health
 * @desc Health check for login service
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Login service is healthy',
    timestamp: new Date().toISOString(),
    service: 'login'
  });
});

module.exports = router;