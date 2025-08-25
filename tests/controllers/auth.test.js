/**
 * Auth Controller Test Suite
 * Tests for authentication controller functions
 */

const { login, refreshToken, getProfile, logout, AuthError } = require('../../src/controllers/auth');

// Mock the auth utilities
jest.mock('../../src/auth/password');
jest.mock('../../src/auth/jwt');
jest.mock('../../src/models/User');

const { hashPassword, verifyPassword } = require('../../src/auth/password');
const { generateTokenPair } = require('../../src/auth/jwt');
const { User } = require('../../src/models/User');

describe('Auth Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    beforeEach(() => {
      verifyPassword.mockResolvedValue(true);
      generateTokenPair.mockReturnValue({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: '24h'
      });
    });

    test('should login user successfully with verified email', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      User.findByEmailWithPassword.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashed_password',
        emailVerified: true,
        kycStatus: 'pending',
        role: 'user'
      });

      await login(req, res);

      expect(User.findByEmailWithPassword).toHaveBeenCalledWith('test@example.com');
      expect(verifyPassword).toHaveBeenCalledWith('SecurePass123!', 'hashed_password');
      expect(generateTokenPair).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Login successful',
          data: expect.objectContaining({
            user: expect.objectContaining({
              email: 'test@example.com',
              firstName: 'John',
              lastName: 'Doe'
            }),
            accessToken: 'access_token',
            refreshToken: 'refresh_token'
          })
        })
      );
    });

    test('should return error for unverified email', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      User.findByEmailWithPassword.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        emailVerified: false,
        kycStatus: 'pending',
        role: 'user'
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Please verify your email address to continue',
        code: 'EMAIL_NOT_VERIFIED'
      });
    });

    test('should return error for non-existent user', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      User.findByEmailWithPassword.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    });

    test('should return error for invalid password', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'wrong_password'
      };

      User.findByEmailWithPassword.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        emailVerified: true,
        kycStatus: 'pending',
        role: 'user'
      });

      verifyPassword.mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    });

    test('should return error for missing credentials', async () => {
      req.body = {
        email: 'test@example.com'
        // Missing password
      };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    });

    test('should return error for invalid email format', async () => {
      req.body = {
        email: 'invalid-email',
        password: 'password123'
      };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      generateTokenPair.mockReturnValue({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: '24h'
      });
    });

    test('should refresh token successfully', async () => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending',
        tokenType: 'refresh'
      };

      await refreshToken(req, res);

      expect(generateTokenPair).toHaveBeenCalledWith({
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending'
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token',
          expiresIn: '24h'
        }
      });
    });

    test('should return error for invalid refresh token', async () => {
      req.user = {
        id: 'user123',
        tokenType: 'access' // Should be refresh
      };

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    });

    test('should return error for missing user', async () => {
      req.user = null;

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    });
  });

  describe('getProfile', () => {
    test('should return user profile successfully', async () => {
      req.user = {
        userId: 'user123'
      };

      User.findById.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        status: 'active',
        role: 'user',
        kycStatus: 'pending'
      });

      await getProfile(req, res);

      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: 'user123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe'
          })
        }
      });
    });

    test('should return error for non-existent user', async () => {
      req.user = {
        userId: 'non-existent-user'
      };

      User.findById.mockResolvedValue(null);

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    });

    test('should return error for missing authentication', async () => {
      req.user = null;

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      await logout(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });

  describe('error handling', () => {
    test('should handle AuthError instances', async () => {
      const authError = new AuthError('Custom error message', 418, 'CUSTOM_ERROR');

      req.body = {
        email: 'test@example.com',
        password: 'password'
      };

      User.findByEmailWithPassword.mockRejectedValue(authError);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Custom error message',
        code: 'CUSTOM_ERROR'
      });
    });

    test('should handle unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed');

      req.body = {
        email: 'test@example.com',
        password: 'password'
      };

      User.findByEmailWithPassword.mockRejectedValue(unexpectedError);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    });
  });
});