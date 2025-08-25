/**
 * Authentication Controllers
 * Handles user registration, login, and authentication endpoints
 */

const { hashPassword, verifyPassword } = require('../auth/password');
const { generateTokenPair } = require('../auth/jwt');
const { User, UserError } = require('../models/User');
const validator = require('validator');

class AuthError extends Error {
  constructor(message, statusCode = 400, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Registration is now handled by /routes/auth/register.js

/**
 * Login user
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw new AuthError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Normalize email
    const normalizedEmail = validator.normalizeEmail(email);

    // Find user by email
    const user = await User.findByEmailWithPassword(normalizedEmail);

    if (!user) {
      throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AuthError('Please verify your email address to continue', 401, 'EMAIL_NOT_VERIFIED');
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus
    });

    // Remove sensitive data from response
    const { passwordHash: _, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        ...tokens
      }
    });

  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(req, res) {
  try {
    // The authentication middleware should have already validated the refresh token
    // and set req.user
    if (!req.user || req.user.tokenType !== 'refresh') {
      throw new AuthError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Generate new token pair
    const tokens = generateTokenPair({
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      emailVerified: req.user.emailVerified,
      kycStatus: req.user.kycStatus
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });

  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'Token refresh failed',
        code: 'TOKEN_REFRESH_ERROR'
      });
    }
  }
}

/**
 * Get current user profile
 */
async function getProfile(req, res) {
  try {
    // The authentication middleware should have already validated the token
    // and set req.user
    if (!req.user) {
      throw new AuthError('Authentication required', 401, 'NOT_AUTHENTICATED');
    }

    // Fetch full user profile from database
    const user = await User.findById(req.user.userId);

    if (!user) {
      throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
    }

    // User data is already sanitized by the User model (no password hash included)
    const userResponse = user;

    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      console.error('Profile fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profile',
        code: 'PROFILE_FETCH_ERROR'
      });
    }
  }
}

/**
 * Logout user (invalidate tokens)
 */
async function logout(req, res) {
  try {
    // In a stateless JWT system, logout is typically handled client-side
    // by removing tokens from storage. However, we can implement server-side
    // token blacklisting here if needed.
    
    // TODO: Add token to blacklist/revocation list if implementing server-side logout

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
}

// Helper functions are now handled by the User model

module.exports = {
  login,
  refreshToken,
  getProfile,
  logout,
  AuthError
};