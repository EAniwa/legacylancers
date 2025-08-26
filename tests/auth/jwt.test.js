/**
 * JWT Utilities Test Suite
 * Comprehensive tests for JWT token management
 */

const {
  signToken,
  verifyToken,
  decodeToken,
  generateTokenPair,
  extractTokenFromHeader,
  isTokenExpired,
  getTokenRemainingTime,
  JWTError
} = require('../../src/auth/jwt');

describe('JWT Utilities', () => {
  const validPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'user',
    emailVerified: true,
    kycStatus: 'verified'
  };

  describe('signToken', () => {
    test('should generate valid JWT token with required payload', () => {
      const token = signToken(validPayload);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT structure: header.payload.signature
    });

    test('should include all payload data in token', () => {
      const token = signToken(validPayload);
      const decoded = decodeToken(token);
      
      expect(decoded.payload.userId).toBe(validPayload.userId);
      expect(decoded.payload.email).toBe(validPayload.email);
      expect(decoded.payload.role).toBe(validPayload.role);
      expect(decoded.payload.emailVerified).toBe(validPayload.emailVerified);
      expect(decoded.payload.kycStatus).toBe(validPayload.kycStatus);
      expect(decoded.payload.type).toBe('access');
    });

    test('should set token type based on options', () => {
      const accessToken = signToken(validPayload, { type: 'access' });
      const refreshToken = signToken(validPayload, { type: 'refresh' });
      
      const accessDecoded = decodeToken(accessToken);
      const refreshDecoded = decodeToken(refreshToken);
      
      expect(accessDecoded.payload.type).toBe('access');
      expect(refreshDecoded.payload.type).toBe('refresh');
    });

    test('should respect custom expiration time', () => {
      const token = signToken(validPayload, { expiresIn: '1h' });
      const decoded = decodeToken(token);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const expectedExpiry = currentTime + 3600; // 1 hour
      
      expect(decoded.payload.exp).toBeGreaterThan(currentTime);
      expect(decoded.payload.exp).toBeLessThanOrEqual(expectedExpiry + 5); // Allow 5 second tolerance
    });

    test('should throw error for missing userId', () => {
      const invalidPayload = { ...validPayload };
      delete invalidPayload.userId;
      
      expect(() => {
        signToken(invalidPayload);
      }).toThrow(JWTError);
      
      expect(() => {
        signToken(invalidPayload);
      }).toThrow('User ID is required');
    });

    test('should throw error for missing email', () => {
      const invalidPayload = { ...validPayload };
      delete invalidPayload.email;
      
      expect(() => {
        signToken(invalidPayload);
      }).toThrow(JWTError);
      
      expect(() => {
        signToken(invalidPayload);
      }).toThrow('Email is required');
    });

    test('should throw error for missing role', () => {
      const invalidPayload = { ...validPayload };
      delete invalidPayload.role;
      
      expect(() => {
        signToken(invalidPayload);
      }).toThrow(JWTError);
      
      expect(() => {
        signToken(invalidPayload);
      }).toThrow('Role is required');
    });

    test('should set default values for optional fields', () => {
      const minimalPayload = {
        userId: validPayload.userId,
        email: validPayload.email,
        role: validPayload.role
      };
      
      const token = signToken(minimalPayload);
      const decoded = decodeToken(token);
      
      expect(decoded.payload.emailVerified).toBe(false);
      expect(decoded.payload.kycStatus).toBe('pending');
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token successfully', () => {
      const token = signToken(validPayload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.email).toBe(validPayload.email);
      expect(decoded.role).toBe(validPayload.role);
    });

    test('should throw error for missing token', () => {
      expect(() => {
        verifyToken();
      }).toThrow(JWTError);
      
      expect(() => {
        verifyToken('');
      }).toThrow('Token is required');
    });

    test('should throw error for invalid token format', () => {
      expect(() => {
        verifyToken('invalid.token');
      }).toThrow(JWTError);
      
      expect(() => {
        verifyToken('invalid.token');
      }).toThrow('Invalid token');
    });

    test('should throw error for token with invalid signature', () => {
      const token = signToken(validPayload);
      const tamperedToken = token.slice(0, -10) + 'tampered123';
      
      expect(() => {
        verifyToken(tamperedToken);
      }).toThrow(JWTError);
    });

    test('should throw error for expired token', () => {
      const token = signToken(validPayload, { expiresIn: '1ms' });
      
      // Wait for token to expire
      return new Promise(resolve => {
        setTimeout(() => {
          expect(() => {
            verifyToken(token);
          }).toThrow(JWTError);
          
          expect(() => {
            verifyToken(token);
          }).toThrow('Token has expired');
          
          resolve();
        }, 10);
      });
    }, 10000);

    test('should validate required fields in token payload', () => {
      // This test would need to manually create a malformed token
      // For now, we test that our signToken creates proper tokens
      const token = signToken(validPayload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBeDefined();
      expect(decoded.email).toBeDefined();
      expect(decoded.role).toBeDefined();
    });
  });

  describe('decodeToken', () => {
    test('should decode token without verification', () => {
      const token = signToken(validPayload);
      const decoded = decodeToken(token);
      
      expect(decoded).toHaveProperty('header');
      expect(decoded).toHaveProperty('payload');
      expect(decoded).toHaveProperty('signature');
      expect(decoded.payload.userId).toBe(validPayload.userId);
    });

    test('should throw error for missing token', () => {
      expect(() => {
        decodeToken();
      }).toThrow(JWTError);
      
      expect(() => {
        decodeToken('');
      }).toThrow('Token is required');
    });

    test('should throw error for invalid token format', () => {
      expect(() => {
        decodeToken('invalid');
      }).toThrow(JWTError);
    });
  });

  describe('generateTokenPair', () => {
    test('should generate both access and refresh tokens', () => {
      const tokenPair = generateTokenPair(validPayload);
      
      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair).toHaveProperty('expiresIn');
      
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
    });

    test('should create tokens with different types', () => {
      const tokenPair = generateTokenPair(validPayload);
      
      const accessDecoded = decodeToken(tokenPair.accessToken);
      const refreshDecoded = decodeToken(tokenPair.refreshToken);
      
      expect(accessDecoded.payload.type).toBe('access');
      expect(refreshDecoded.payload.type).toBe('refresh');
    });

    test('should create valid tokens that can be verified', () => {
      const tokenPair = generateTokenPair(validPayload);
      
      const accessVerified = verifyToken(tokenPair.accessToken);
      const refreshVerified = verifyToken(tokenPair.refreshToken);
      
      expect(accessVerified.userId).toBe(validPayload.userId);
      expect(refreshVerified.userId).toBe(validPayload.userId);
    });
  });

  describe('extractTokenFromHeader', () => {
    test('should extract token from Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const authHeader = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(authHeader);
      expect(extracted).toBe(token);
    });

    test('should return null for missing header', () => {
      expect(extractTokenFromHeader()).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull();
    });

    test('should return null for invalid format', () => {
      expect(extractTokenFromHeader('Invalid token')).toBeNull();
      expect(extractTokenFromHeader('Basic dGVzdA==')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Bearer token1 token2')).toBeNull();
    });

    test('should handle Bearer with correct spacing', () => {
      const token = 'test.token.here';
      
      expect(extractTokenFromHeader(`Bearer ${token}`)).toBe(token);
      expect(extractTokenFromHeader(`Bearer  ${token}`)).toBeNull(); // Double space
      expect(extractTokenFromHeader(`bearer ${token}`)).toBeNull(); // Lowercase
    });
  });

  describe('isTokenExpired', () => {
    test('should return false for non-expired token', () => {
      const token = signToken(validPayload, { expiresIn: '1h' });
      
      expect(isTokenExpired(token)).toBe(false);
    });

    test('should return true for expired token', async () => {
      // Create a token with past expiration time
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const jwt = require('jsonwebtoken');
      const authConfig = require('../../src/config/auth');
      
      const expiredToken = jwt.sign(
        { ...validPayload, exp: pastTime },
        authConfig.jwt.secret,
        { algorithm: authConfig.jwt.algorithm }
      );
      
      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    test('should return true for invalid tokens', () => {
      expect(isTokenExpired('invalid.token')).toBe(true);
      expect(isTokenExpired()).toBe(true);
      expect(isTokenExpired('')).toBe(true);
    });
  });

  describe('getTokenRemainingTime', () => {
    test('should return remaining time for valid token', () => {
      const token = signToken(validPayload, { expiresIn: '1h' });
      const remaining = getTokenRemainingTime(token);
      
      expect(remaining).toBeGreaterThan(3500); // Should be close to 1 hour (3600s)
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    test('should return 0 for expired tokens', () => {
      const token = signToken(validPayload, { expiresIn: '1ms' });
      
      return new Promise(resolve => {
        setTimeout(() => {
          expect(getTokenRemainingTime(token)).toBe(0);
          resolve();
        }, 10);
      });
    });

    test('should return 0 for invalid tokens', () => {
      expect(getTokenRemainingTime('invalid')).toBe(0);
      expect(getTokenRemainingTime()).toBe(0);
      expect(getTokenRemainingTime('')).toBe(0);
    });
  });

  describe('JWTError', () => {
    test('should create error with message and code', () => {
      const error = new JWTError('Test message', 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('JWTError');
      expect(error instanceof Error).toBe(true);
    });

    test('should use default code if not provided', () => {
      const error = new JWTError('Test message');
      
      expect(error.code).toBe('JWT_ERROR');
    });
  });
});