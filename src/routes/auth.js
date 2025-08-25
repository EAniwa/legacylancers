/**
 * Authentication Routes
 * Defines API endpoints for authentication operations
 */

const express = require('express');
const router = express.Router();

const { 
  refreshToken, 
  getProfile 
} = require('../controllers/auth');

const { 
  requiredAuthenticate,
  requireTokenType 
} = require('../middleware/auth');

const { 
  sanitizeRequest 
} = require('../middleware/security');

// Import registration routes
const registrationRoutes = require('./auth/register');
// Import login routes
const loginRoutes = require('./auth/login');
// Import password reset routes
const passwordResetRoutes = require('./auth/password-reset');

// Apply request sanitization to all auth routes
router.use(sanitizeRequest());

// Use registration routes - this includes /register, /verify-email, /resend-verification, etc.
router.use('/', registrationRoutes);

// Use login routes - this includes /login, /logout
router.use('/', loginRoutes);

// Use password reset routes - this includes /password-reset/request, /password-reset/verify, /password-reset/complete
router.use('/password-reset', passwordResetRoutes);


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


// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;