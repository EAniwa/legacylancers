/**
 * Auth Routes Integration Test Suite
 * Tests for authentication API endpoints
 */

const request = require('supertest');
const app = require('../../src/app');

// Mock the auth utilities
jest.mock('../../src/auth/password');
jest.mock('../../src/auth/jwt');

const { hashPassword, verifyPassword } = require('../../src/auth/password');
const { generateTokenPair, signToken } = require('../../src/auth/jwt');

describe('Auth Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    hashPassword.mockResolvedValue('hashed_password');
    verifyPassword.mockResolvedValue(true);
    generateTokenPair.mockReturnValue({
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresIn: '24h'
    });
    signToken.mockReturnValue('mock_token');
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    test('should register new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            email: 'newuser@example.com',
            firstName: 'John',
            lastName: 'Doe',
            emailVerified: false,
            kycStatus: 'pending',
            role: 'user'
          },
          accessToken: 'mock_access_token',
          refreshToken: 'mock_refresh_token'
        }
      });

      // Sensitive data should not be included
      expect(response.body.data.user.hashedPassword).toBeUndefined();
    });

    test('should return error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // Missing password, firstName, lastName
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    });

    test('should return error for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationData,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    });

    test('should sanitize input data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationData,
          firstName: '<script>alert("xss")</script>John',
          lastName: 'Doe<script>alert("xss")</script>'
        })
        .expect(201);

      // Check that XSS attempts are sanitized
      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.lastName).not.toContain('<script>');
    });

    test('should handle password validation errors', async () => {
      hashPassword.mockRejectedValue(new Error('Password too weak'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'user@example.com',
      password: 'SecurePass123!'
    };

    test('should return error for non-existent user', async () => {
      // The mock implementation always returns null for findUserByEmail
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    });

    test('should return error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com'
          // Missing password
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    });

    test('should return error for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    });

    test('should respect rate limiting', async () => {
      // Make multiple requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send(validLoginData)
        );
      }

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited (status 429)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/auth/profile', () => {
    test('should return error when no token provided', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });

    test('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    });

    // Note: Testing with valid token would require mocking the JWT verification
    // which is complex in an integration test. This would be better handled
    // with a dedicated auth service or dependency injection.
  });

  describe('GET /api/auth/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Auth service is healthy',
        timestamp: expect.any(String)
      });
    });
  });

  describe('General API behavior', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
      });
    });

    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    test('should block suspicious requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password',
          firstName: 'John',
          lastName: 'exec("rm -rf /")'  // Suspicious pattern
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Request blocked for security reasons',
        code: 'SUSPICIOUS_REQUEST'
      });
    });
  });
});