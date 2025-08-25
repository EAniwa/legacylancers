/**
 * Authentication Controllers
 * Handles user registration, login, and authentication endpoints
 */

const { hashPassword, verifyPassword } = require('../auth/password');
const { generateTokenPair } = require('../auth/jwt');
const validator = require('validator');

class AuthError extends Error {
  constructor(message, statusCode = 400, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Register a new user
 */
async function register(req, res) {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      throw new AuthError('All fields are required', 400, 'MISSING_FIELDS');
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
    }

    // Normalize email
    const normalizedEmail = validator.normalizeEmail(email);

    // Check if user already exists (this would typically check the database)
    // For now, we'll simulate this check
    // TODO: Implement database check when database layer is available

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user object (this would typically save to database)
    const user = {
      id: generateUserId(),
      email: normalizedEmail,
      firstName: validator.escape(firstName.trim()),
      lastName: validator.escape(lastName.trim()),
      hashedPassword,
      emailVerified: false,
      kycStatus: 'pending',
      role: 'user',
      createdAt: new Date().toISOString()
    };

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus
    });

    // Remove sensitive data from response
    const { hashedPassword: _, ...userResponse } = user;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
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
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
}

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

    // Find user by email (this would typically query the database)
    // For now, we'll simulate this
    // TODO: Implement database query when database layer is available
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.hashedPassword);

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
    const { hashedPassword: _, ...userResponse } = user;

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
    // TODO: Implement database query when database layer is available
    const user = await findUserById(req.user.id);

    if (!user) {
      throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Remove sensitive data from response
    const { hashedPassword: _, ...userResponse } = user;

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

// Helper functions (would be moved to a service layer in a real application)

/**
 * Generate a unique user ID
 * TODO: Replace with proper ID generation (UUID, etc.)
 */
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Mock function to find user by email
 * TODO: Replace with actual database query
 */
async function findUserByEmail(email) {
  // This would typically query the database
  // For now, returning null to simulate user not found
  return null;
}

/**
 * Mock function to find user by ID
 * TODO: Replace with actual database query
 */
async function findUserById(id) {
  // This would typically query the database
  // For now, returning a mock user
  return {
    id,
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    hashedPassword: 'hashed_password_here',
    emailVerified: false,
    kycStatus: 'pending',
    role: 'user',
    createdAt: '2023-01-01T00:00:00Z'
  };
}

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  logout,
  AuthError
};