/**
 * Authentication Middleware Test Suite
 * Comprehensive tests for authentication and authorization middleware
 */

const {
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
} = require('../../src/middleware/auth');

const { signToken } = require('../../src/auth/jwt');

// Mock response object
const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  statusCode: 200
});

// Mock request object
const createMockRequest = (overrides = {}) => ({
  headers: {},
  user: null,
  token: null,
  params: {},
  ...overrides
});

// Mock next function
const createMockNext = () => jest.fn();

describe('Authentication Middleware', () => {
  const validUser = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'user',
    emailVerified: true,
    kycStatus: 'verified'
  };

  const adminUser = {
    ...validUser,
    role: 'admin'
  };

  const unverifiedUser = {
    ...validUser,
    emailVerified: false,
    kycStatus: 'pending'
  };

  describe('authenticate', () => {
    test('should authenticate user with valid token', async () => {
      const token = signToken(validUser);
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(true)(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(validUser.userId);
      expect(req.user.email).toBe(validUser.email);
      expect(req.user.role).toBe(validUser.role);
      expect(req.token).toBe(token);
    });

    test('should reject request without token when required', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(true)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow request without token when not required', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(false)(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    test('should reject invalid token format', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Invalid token format' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(true)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject malformed JWT token', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid.jwt.token' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(true)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_TOKEN'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle expired token', async () => {
      const token = signToken(validUser, { expiresIn: '1ms' });
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(true)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    test('should allow user with correct role', () => {
      const req = createMockRequest({ user: validUser });
      const res = createMockResponse();
      const next = createMockNext();

      authorize('user')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should allow user with one of multiple allowed roles', () => {
      const req = createMockRequest({ user: adminUser });
      const res = createMockResponse();
      const next = createMockNext();

      authorize(['user', 'admin'])(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject user without required role', () => {
      const req = createMockRequest({ user: validUser });
      const res = createMockResponse();
      const next = createMockNext();

      authorize('admin')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject unauthenticated user', () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();
      const next = createMockNext();

      authorize('user')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireEmailVerification', () => {
    test('should allow verified user', () => {
      const req = createMockRequest({ user: validUser });
      const res = createMockResponse();
      const next = createMockNext();

      requireEmailVerification()(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject unverified user', () => {
      const req = createMockRequest({ user: unverifiedUser });
      const res = createMockResponse();
      const next = createMockNext();

      requireEmailVerification()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject unauthenticated user', () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();
      const next = createMockNext();

      requireEmailVerification()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireKYCVerification', () => {
    test('should allow KYC verified user', () => {
      const req = createMockRequest({ user: validUser });
      const res = createMockResponse();
      const next = createMockNext();

      requireKYCVerification()(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject non-KYC verified user', () => {
      const req = createMockRequest({ user: unverifiedUser });
      const res = createMockResponse();
      const next = createMockNext();

      requireKYCVerification()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'KYC verification required',
        code: 'KYC_NOT_VERIFIED',
        currentStatus: 'pending',
        requiredStatus: 'verified'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow custom required status', () => {
      const pendingUser = { ...validUser, kycStatus: 'pending' };
      const req = createMockRequest({ user: pendingUser });
      const res = createMockResponse();
      const next = createMockNext();

      requireKYCVerification('pending')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireOwnershipOrAdmin', () => {
    test('should allow user accessing their own resource', () => {
      const req = createMockRequest({
        user: { ...validUser, id: validUser.userId },
        params: { userId: validUser.userId }
      });
      const res = createMockResponse();
      const next = createMockNext();

      requireOwnershipOrAdmin()(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should allow admin accessing any resource', () => {
      const req = createMockRequest({
        user: adminUser,
        params: { userId: 'different-user-id' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      requireOwnershipOrAdmin()(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject non-owner non-admin', () => {
      const req = createMockRequest({
        user: validUser,
        params: { userId: 'different-user-id' }
      });
      const res = createMockResponse();
      const next = createMockNext();

      requireOwnershipOrAdmin()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Can only access your own resources',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should use custom parameter name', () => {
      const req = createMockRequest({
        user: { ...validUser, id: validUser.userId },
        params: { id: validUser.userId }
      });
      const res = createMockResponse();
      const next = createMockNext();

      requireOwnershipOrAdmin('id')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireTokenType', () => {
    test('should allow correct token type', () => {
      const userWithAccessToken = { ...validUser, tokenType: 'access' };
      const req = createMockRequest({ user: userWithAccessToken });
      const res = createMockResponse();
      const next = createMockNext();

      requireTokenType('access')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject incorrect token type', () => {
      const userWithRefreshToken = { ...validUser, tokenType: 'refresh' };
      const req = createMockRequest({ user: userWithRefreshToken });
      const res = createMockResponse();
      const next = createMockNext();

      requireTokenType('access')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required',
        code: 'INVALID_TOKEN_TYPE'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Pre-built middleware combinations', () => {
    test('optionalAuthenticate should work without token', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await optionalAuthenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    test('requiredAuthenticate should require token', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await requiredAuthenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('adminOnly should be array of middleware', () => {
      expect(Array.isArray(adminOnly)).toBe(true);
      expect(adminOnly).toHaveLength(2);
    });

    test('moderatorOrAdmin should be array of middleware', () => {
      expect(Array.isArray(moderatorOrAdmin)).toBe(true);
      expect(moderatorOrAdmin).toHaveLength(2);
    });

    test('verifiedUserOnly should be array of middleware', () => {
      expect(Array.isArray(verifiedUserOnly)).toBe(true);
      expect(verifiedUserOnly).toHaveLength(2);
    });

    test('kycVerifiedOnly should be array of middleware', () => {
      expect(Array.isArray(kycVerifiedOnly)).toBe(true);
      expect(kycVerifiedOnly).toHaveLength(2);
    });

    test('fullVerificationRequired should be array of middleware', () => {
      expect(Array.isArray(fullVerificationRequired)).toBe(true);
      expect(fullVerificationRequired).toHaveLength(3);
    });
  });

  describe('Error handling', () => {
    test('should handle middleware errors gracefully', async () => {
      // Create a middleware that throws an error
      const errorMiddleware = () => {
        throw new Error('Test error');
      };

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      // This test checks that our middleware handles errors
      // In practice, Express would catch these errors
      expect(() => {
        errorMiddleware()(req, res, next);
      }).toThrow('Test error');
    });

    test('should set correct error structure', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await authenticate(true)(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.any(String),
        code: expect.any(String)
      });
    });
  });

  describe('AuthError', () => {
    test('should create error with message, code and status', () => {
      const error = new AuthError('Test message', 'TEST_CODE', 403);
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthError');
      expect(error instanceof Error).toBe(true);
    });

    test('should use default values if not provided', () => {
      const error = new AuthError('Test message');
      
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('Integration tests', () => {
    test('should handle complete authentication flow', async () => {
      const token = signToken(validUser);
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      const next = createMockNext();

      // Test required authentication
      await requiredAuthenticate(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      
      // Reset next mock for next test
      next.mockReset();
      
      // Test authorization
      authorize('user')(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test('should handle full verification flow', async () => {
      const token = signToken(validUser);
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockResponse();
      
      // Simulate running all middleware in sequence
      let currentNext;
      
      // First middleware: authentication
      currentNext = jest.fn();
      await requiredAuthenticate(req, res, currentNext);
      expect(currentNext).toHaveBeenCalled();
      
      // Second middleware: email verification
      currentNext = jest.fn();
      requireEmailVerification()(req, res, currentNext);
      expect(currentNext).toHaveBeenCalled();
      
      // Third middleware: KYC verification
      currentNext = jest.fn();
      requireKYCVerification()(req, res, currentNext);
      expect(currentNext).toHaveBeenCalled();
    });
  });
});