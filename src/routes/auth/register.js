/**
 * Registration Routes
 * Handles user registration, email verification, and related endpoints
 */

const express = require('express');
const validator = require('validator');
const { User, UserError } = require('../../models/User');
const { EmailService, EmailError } = require('../../services/email');
const { registrationRateLimit, sanitizeRequest } = require('../../middleware/security');
const { sanitizeString } = require('../../middleware/security');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', 
  registrationRateLimit(),
  sanitizeRequest(),
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, privacyConsent, marketingConsent } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          error: 'Email, password, first name, and last name are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      if (!privacyConsent) {
        return res.status(400).json({
          success: false,
          error: 'Privacy consent is required to create an account',
          code: 'PRIVACY_CONSENT_REQUIRED'
        });
      }

      // Additional validation
      if (!validator.isEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address',
          code: 'INVALID_EMAIL'
        });
      }

      if (!validator.isLength(firstName.trim(), { min: 1, max: 100 })) {
        return res.status(400).json({
          success: false,
          error: 'First name must be between 1 and 100 characters',
          code: 'INVALID_FIRST_NAME'
        });
      }

      if (!validator.isLength(lastName.trim(), { min: 1, max: 100 })) {
        return res.status(400).json({
          success: false,
          error: 'Last name must be between 1 and 100 characters',
          code: 'INVALID_LAST_NAME'
        });
      }

      // Validate phone if provided
      if (phone && !validator.isMobilePhone(phone, 'any', { strictMode: false })) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid phone number',
          code: 'INVALID_PHONE'
        });
      }

      // Prepare user data
      const userData = {
        email: email.trim().toLowerCase(),
        password: password,
        firstName: sanitizeString(firstName.trim()),
        lastName: sanitizeString(lastName.trim()),
        phone: phone ? sanitizeString(phone.trim()) : null,
        privacyConsent: Boolean(privacyConsent),
        marketingConsent: Boolean(marketingConsent)
      };

      // Create user
      const user = await User.create(userData);

      // Send verification email
      try {
        await EmailService.sendVerificationEmail({
          email: user.email,
          firstName: user.firstName,
          verificationToken: user.verificationToken
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email sending fails
        // User can request resend later
      }

      // Log successful registration
      console.log('User registered successfully:', {
        userId: user.id,
        email: user.email,
        timestamp: new Date()
      });

      // Return success response (without sensitive data)
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            emailVerified: user.emailVerified,
            status: user.status,
            role: user.role,
            createdAt: user.createdAt
          },
          message: 'Registration successful. Please check your email to verify your account.'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);

      // Handle specific user errors
      if (error instanceof UserError) {
        const statusCode = error.code === 'USER_EXISTS' ? 409 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.message
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Registration failed. Please try again.',
        code: 'REGISTRATION_FAILED'
      });
    }
  }
);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email address with token
 * @access Public
 */
router.post('/verify-email',
  sanitizeRequest(),
  async (req, res) => {
    try {
      const { token } = req.body;

      if (!token || !validator.isLength(token, { min: 32, max: 128 })) {
        return res.status(400).json({
          success: false,
          error: 'Valid verification token is required',
          code: 'INVALID_TOKEN'
        });
      }

      // Verify email
      const user = await User.verifyEmail(token);

      // Send welcome email
      try {
        await EmailService.sendWelcomeEmail({
          email: user.email,
          firstName: user.firstName
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail verification if welcome email fails
      }

      // Log successful verification
      console.log('Email verified successfully:', {
        userId: user.id,
        email: user.email,
        timestamp: new Date()
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            emailVerified: user.emailVerified,
            status: user.status,
            role: user.role
          },
          message: 'Email verified successfully. Welcome to LegacyLancers!'
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);

      // Handle specific user errors
      if (error instanceof UserError) {
        const statusCode = error.code === 'TOKEN_EXPIRED' ? 410 : 400;
        return res.status(statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Email verification failed. Please try again.',
        code: 'VERIFICATION_FAILED'
      });
    }
  }
);

/**
 * @route POST /api/auth/resend-verification
 * @desc Resend email verification
 * @access Public
 */
router.post('/resend-verification',
  registrationRateLimit(), // Reuse registration rate limiting
  sanitizeRequest(),
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !validator.isEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Valid email address is required',
          code: 'INVALID_EMAIL'
        });
      }

      // Generate new verification token
      const verificationToken = await User.resendEmailVerification(email.trim().toLowerCase());

      // Send verification email
      const user = await User.findByEmail(email.trim().toLowerCase());
      if (!user) {
        // Don't reveal whether email exists or not for security
        return res.json({
          success: true,
          message: 'If this email is registered, a verification email has been sent.'
        });
      }

      try {
        await EmailService.sendVerificationEmail({
          email: user.email,
          firstName: user.firstName,
          verificationToken
        });
      } catch (emailError) {
        console.error('Failed to resend verification email:', emailError);
        return res.status(500).json({
          success: false,
          error: 'Failed to send verification email. Please try again later.',
          code: 'EMAIL_SEND_FAILED'
        });
      }

      // Log resend request
      console.log('Verification email resent:', {
        email: user.email,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Verification email has been resent. Please check your inbox.'
      });

    } catch (error) {
      console.error('Resend verification error:', error);

      // Handle specific user errors
      if (error instanceof UserError) {
        let statusCode = 400;
        let message = error.message;

        if (error.code === 'USER_NOT_FOUND') {
          // Don't reveal whether email exists
          message = 'If this email is registered, a verification email has been sent.';
          statusCode = 200;
        } else if (error.code === 'EMAIL_ALREADY_VERIFIED') {
          statusCode = 409;
        }

        return res.status(statusCode).json({
          success: statusCode === 200,
          error: message,
          code: error.code
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification email. Please try again.',
        code: 'RESEND_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/auth/check-email
 * @desc Check if email is available for registration
 * @access Public
 */
router.get('/check-email',
  sanitizeRequest(),
  async (req, res) => {
    try {
      const { email } = req.query;

      if (!email || !validator.isEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Valid email address is required',
          code: 'INVALID_EMAIL'
        });
      }

      const existingUser = await User.findByEmail(email.trim().toLowerCase());
      
      res.json({
        success: true,
        data: {
          available: !existingUser,
          email: email.trim().toLowerCase()
        }
      });

    } catch (error) {
      console.error('Email check error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to check email availability',
        code: 'EMAIL_CHECK_FAILED'
      });
    }
  }
);

/**
 * @route GET /api/auth/registration-stats
 * @desc Get registration statistics (for development/testing)
 * @access Public (would be restricted in production)
 */
router.get('/registration-stats',
  async (req, res) => {
    try {
      // Only show stats in development/test mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          code: 'NOT_FOUND'
        });
      }

      const stats = await User.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Stats error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to get registration statistics',
        code: 'STATS_FAILED'
      });
    }
  }
);

/**
 * @route POST /api/auth/cleanup-tokens
 * @desc Cleanup expired verification tokens (for development/testing)
 * @access Public (would be restricted in production)
 */
router.post('/cleanup-tokens',
  async (req, res) => {
    try {
      // Only allow cleanup in development/test mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          code: 'NOT_FOUND'
        });
      }

      const cleaned = await User.cleanupExpiredTokens();

      res.json({
        success: true,
        data: {
          message: `Cleaned up ${cleaned} expired tokens`
        }
      });

    } catch (error) {
      console.error('Token cleanup error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired tokens',
        code: 'CLEANUP_FAILED'
      });
    }
  }
);

module.exports = router;