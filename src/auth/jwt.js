/**
 * JWT Token Management Utilities
 * Handles JWT token creation, verification, and decoding
 */

const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');

class JWTError extends Error {
  constructor(message, code = 'JWT_ERROR') {
    super(message);
    this.name = 'JWTError';
    this.code = code;
  }
}

/**
 * Generate a JWT token for a user
 * @param {Object} payload - User payload to encode in token
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {string} payload.role - User role
 * @param {Object} options - Token options
 * @param {string} options.expiresIn - Token expiration time
 * @param {string} options.type - Token type ('access' or 'refresh')
 * @returns {string} JWT token
 */
function signToken(payload, options = {}) {
  try {
    const {
      userId,
      email,
      role,
      emailVerified = false,
      kycStatus = 'pending'
    } = payload;

    if (!userId) {
      throw new JWTError('User ID is required for token generation', 'MISSING_USER_ID');
    }

    if (!email) {
      throw new JWTError('Email is required for token generation', 'MISSING_EMAIL');
    }

    if (!role) {
      throw new JWTError('Role is required for token generation', 'MISSING_ROLE');
    }

    const tokenPayload = {
      userId,
      email,
      role,
      emailVerified,
      kycStatus,
      type: options.type || 'access',
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtOptions = {
      algorithm: authConfig.jwt.algorithm,
      expiresIn: options.expiresIn || (options.type === 'refresh' ? authConfig.jwt.refreshExpiresIn : authConfig.jwt.expiresIn),
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience
    };

    return jwt.sign(tokenPayload, authConfig.jwt.secret, jwtOptions);

  } catch (error) {
    if (error instanceof JWTError) {
      throw error;
    }
    throw new JWTError(`Token generation failed: ${error.message}`, 'SIGN_FAILED');
  }
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @param {Object} options - Verification options
 * @returns {Object} Decoded token payload
 */
function verifyToken(token, options = {}) {
  try {
    if (!token) {
      throw new JWTError('Token is required for verification', 'MISSING_TOKEN');
    }

    const jwtOptions = {
      algorithms: [authConfig.jwt.algorithm],
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      ...options
    };

    const decoded = jwt.verify(token, authConfig.jwt.secret, jwtOptions);

    // Additional validation
    if (!decoded.userId) {
      throw new JWTError('Invalid token: missing user ID', 'INVALID_TOKEN');
    }

    if (!decoded.email) {
      throw new JWTError('Invalid token: missing email', 'INVALID_TOKEN');
    }

    if (!decoded.role) {
      throw new JWTError('Invalid token: missing role', 'INVALID_TOKEN');
    }

    return decoded;

  } catch (error) {
    if (error instanceof JWTError) {
      throw error;
    }

    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      throw new JWTError('Token has expired', 'TOKEN_EXPIRED');
    }

    if (error.name === 'JsonWebTokenError') {
      throw new JWTError('Invalid token', 'INVALID_TOKEN');
    }

    if (error.name === 'NotBeforeError') {
      throw new JWTError('Token not active yet', 'TOKEN_NOT_ACTIVE');
    }

    throw new JWTError(`Token verification failed: ${error.message}`, 'VERIFY_FAILED');
  }
}

/**
 * Decode a JWT token without verification (for debugging/inspection)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
function decodeToken(token) {
  try {
    if (!token) {
      throw new JWTError('Token is required for decoding', 'MISSING_TOKEN');
    }

    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      throw new JWTError('Failed to decode token', 'DECODE_FAILED');
    }

    return {
      header: decoded.header,
      payload: decoded.payload,
      signature: decoded.signature
    };

  } catch (error) {
    if (error instanceof JWTError) {
      throw error;
    }
    throw new JWTError(`Token decoding failed: ${error.message}`, 'DECODE_FAILED');
  }
}

/**
 * Generate both access and refresh tokens for a user
 * @param {Object} payload - User payload
 * @returns {Object} Object containing both tokens
 */
function generateTokenPair(payload) {
  try {
    const accessToken = signToken(payload, { type: 'access' });
    const refreshToken = signToken(payload, { type: 'refresh' });

    return {
      accessToken,
      refreshToken,
      expiresIn: authConfig.jwt.expiresIn
    };

  } catch (error) {
    throw new JWTError(`Failed to generate token pair: ${error.message}`, 'TOKEN_PAIR_FAILED');
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if a token is expired (without verification)
 * @param {string} token - JWT token
 * @returns {boolean} True if expired, false otherwise
 */
function isTokenExpired(token) {
  try {
    const decoded = decodeToken(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.payload.exp < currentTime;
  } catch {
    return true; // Consider invalid tokens as expired
  }
}

/**
 * Get remaining time until token expires
 * @param {string} token - JWT token
 * @returns {number} Remaining seconds until expiration
 */
function getTokenRemainingTime(token) {
  try {
    const decoded = decodeToken(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.payload.exp - currentTime);
  } catch {
    return 0;
  }
}

module.exports = {
  signToken,
  verifyToken,
  decodeToken,
  generateTokenPair,
  extractTokenFromHeader,
  isTokenExpired,
  getTokenRemainingTime,
  JWTError
};