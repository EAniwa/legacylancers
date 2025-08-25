/**
 * Authentication Routes
 * Defines API endpoints for authentication operations
 */

const express = require('express');
const router = express.Router();

const { 
  register, 
  login, 
  refreshToken, 
  getProfile, 
  logout 
} = require('../controllers/auth');

const { 
  requiredAuthenticate,
  requireTokenType 
} = require('../middleware/auth');

const { 
  loginRateLimit, 
  registrationRateLimit,
  sanitizeRequest 
} = require('../middleware/security');

// Apply request sanitization to all auth routes
router.use(sanitizeRequest());

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', registrationRateLimit(), register);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', loginRateLimit(), login);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Private (requires refresh token)
 */
router.post('/refresh', [
  requiredAuthenticate,
  requireTokenType('refresh')
], refreshToken);

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private (requires access token)
 */
router.get('/profile', [
  requiredAuthenticate,
  requireTokenType('access')
], getProfile);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private (requires access token)
 */
router.post('/logout', [
  requiredAuthenticate,
  requireTokenType('access')
], logout);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;