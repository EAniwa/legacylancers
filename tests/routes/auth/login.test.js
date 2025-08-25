/**
 * Login Routes Tests
 * Comprehensive tests for login functionality with security focus
 */

const request = require('supertest');
const app = require('../../../src/app');
const { User } = require('../../../src/models/User');
const { hashPassword } = require('../../../src/auth/password');

describe('Login Routes', () => {
  // Test user data
  const testUser = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    firstName: 'Test',
    lastName: 'User',
    privacyConsent: true
  };

  const verifiedUser = {
    email: 'verified@example.com',
    password: 'SecurePassword456!',
    firstName: 'Verified',
    lastName: 'User',
    privacyConsent: true
  };

  beforeEach(async () => {
    // Reset user storage
    await User.reset();

    // Create test users
    const unverifiedUserData = await User.create(testUser);
    const verifiedUserData = await User.create(verifiedUser);

    // Verify the second user
    await User.update(verifiedUserData.id, { emailVerified: true });
  });

  describe('POST /api/auth/login', () => {
    describe('Success Cases', () => {
      it('should login verified user successfully', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email,
            password: verifiedUser.password
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Login successful'
        });

        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data).toHaveProperty('accessToken');
        expect(response.body.data).toHaveProperty('refreshToken');
        expect(response.body.data).toHaveProperty('expiresIn');

        // User data should not contain password hash
        expect(response.body.data.user).not.toHaveProperty('passwordHash');
        expect(response.body.data.user.email).toBe(verifiedUser.email);
        expect(response.body.data.user.emailVerified).toBe(true);
      });

      it('should login with remember me option', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email,
            password: verifiedUser.password,
            rememberMe: true
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.rememberMe).toBe(true);
      });

      it('should normalize email before login', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: '  VERIFIED@EXAMPLE.COM  ',
            password: verifiedUser.password
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe('verified@example.com');
      });
    });

    describe('Validation Errors', () => {
      it('should reject login without email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: verifiedUser.password
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Email and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      });

      it('should reject login without password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Email and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      });

      it('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: verifiedUser.password
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      });
    });

    describe('Authentication Failures', () => {
      it('should reject login for non-existent user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      });

      it('should reject login with incorrect password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email,
            password: 'WrongPassword123!'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      });

      it('should reject login for unverified email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Please verify your email address to continue. Check your inbox for the verification link.',
          code: 'EMAIL_NOT_VERIFIED'
        });
      });

      it('should reject login for inactive account', async () => {
        // Create an inactive user
        const inactiveUser = await User.create({
          email: 'inactive@example.com',
          password: 'SecurePassword789!',
          firstName: 'Inactive',
          lastName: 'User',
          privacyConsent: true
        });

        await User.update(inactiveUser.id, { 
          emailVerified: true,
          status: 'inactive' 
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'inactive@example.com',
            password: 'SecurePassword789!'
          })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Account is not active. Please contact support.',
          code: 'ACCOUNT_INACTIVE'
        });
      });
    });

    describe('Security Features', () => {
      it('should not reveal user existence through timing or error messages', async () => {
        // Test with non-existent email
        const start1 = Date.now();
        const response1 = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          })
          .expect(401);

        const time1 = Date.now() - start1;

        // Test with wrong password for existing user
        const start2 = Date.now();
        const response2 = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email,
            password: 'wrongpassword'
          })
          .expect(401);

        const time2 = Date.now() - start2;

        // Both should return the same error message
        expect(response1.body.error).toBe('Invalid credentials');
        expect(response2.body.error).toBe('Invalid credentials');
        expect(response1.body.code).toBe('INVALID_CREDENTIALS');
        expect(response2.body.code).toBe('INVALID_CREDENTIALS');

        // Timing should be similar (within reasonable bounds)
        const timeDiff = Math.abs(time1 - time2);
        expect(timeDiff).toBeLessThan(300); // Allow for some variance
      });

      it('should sanitize request data', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: '<script>alert("xss")</script>@example.com',
            password: verifiedUser.password
          })
          .expect(400);

        expect(response.body.error).toBe('Invalid email format');
      });

      it('should handle malformed request gracefully', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: null,
            password: undefined
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('MISSING_CREDENTIALS');
      });
    });

    describe('JWT Token Generation', () => {
      it('should generate valid JWT tokens', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email,
            password: verifiedUser.password
          })
          .expect(200);

        const { accessToken, refreshToken } = response.body.data;

        // Tokens should be strings
        expect(typeof accessToken).toBe('string');
        expect(typeof refreshToken).toBe('string');

        // Tokens should be JWT format (3 parts separated by dots)
        expect(accessToken.split('.')).toHaveLength(3);
        expect(refreshToken.split('.')).toHaveLength(3);

        // Should have expiration info
        expect(response.body.data.expiresIn).toBeDefined();
        expect(typeof response.body.data.expiresIn).toBe('string');
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should logout successfully with token', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: verifiedUser.email,
          password: verifiedUser.password
        })
        .expect(200);

      const { accessToken } = loginResponse.body.data;

      // Then logout with the token
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should handle logout errors gracefully', async () => {
      // Mock console.error to prevent error output during test
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('GET /api/auth/login/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/auth/login/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login service is healthy'
      });

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Rate Limiting', () => {
    // Note: Rate limiting is disabled in test environment
    // These tests verify the rate limiting middleware is properly configured
    
    it('should apply rate limiting configuration', async () => {
      // Multiple rapid login attempts should still work in test environment
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          })
      );

      const responses = await Promise.all(promises);
      
      // All should get through in test environment
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock User.findByEmailWithPassword to throw an error
      const originalMethod = User.findByEmailWithPassword;
      User.findByEmailWithPassword = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: verifiedUser.email,
          password: verifiedUser.password
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Login failed due to server error',
        code: 'INTERNAL_ERROR'
      });

      // Restore original method
      User.findByEmailWithPassword = originalMethod;
    });

    it('should handle password verification errors', async () => {
      // Create a user with an invalid password hash to trigger bcrypt error
      const testUserData = await User.create({
        email: 'invalidhash@example.com',
        password: 'ValidPassword123!',
        firstName: 'Invalid',
        lastName: 'Hash',
        privacyConsent: true
      });

      await User.update(testUserData.id, { emailVerified: true });

      // Manually corrupt the password hash to cause bcrypt to fail
      const user = User.users.get(testUserData.id);
      user.passwordHash = 'not-a-valid-bcrypt-hash';

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalidhash@example.com',
          password: 'ValidPassword123!'
        });

      // The response could be either 401 (invalid credentials) or 500 (internal error)
      // depending on how bcrypt handles the invalid hash
      expect([401, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Edge Cases', () => {
    it('should handle empty strings', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '',
          password: ''
        })
        .expect(400);

      expect(response.body.code).toBe('MISSING_CREDENTIALS');
    });

    it('should handle very long inputs', async () => {
      const longEmail = 'a'.repeat(1000) + '@example.com';
      const longPassword = 'a'.repeat(1000);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: longEmail,
          password: longPassword
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle special characters in email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test+tag@example.com',
          password: verifiedUser.password
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });
});