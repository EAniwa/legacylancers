/**
 * Registration Routes Tests
 * Integration tests for registration endpoints
 */

const request = require('supertest');
const app = require('../../src/app');
const { User } = require('../../src/models/User');
const { EmailService } = require('../../src/services/email');

describe('Registration Routes', () => {
  beforeEach(async () => {
    // Reset User model and email service before each test
    await User.reset();
    EmailService.clearSentEmails();
    EmailService.setFailureMode(false);
    EmailService.resetRateLimiting();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      privacyConsent: true,
      marketingConsent: false
    };

    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            emailVerified: false,
            status: 'active',
            role: 'user',
            createdAt: expect.any(String)
          },
          message: expect.stringContaining('verification')
        }
      });

      // Should not include sensitive data
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data.user.verificationToken).toBeUndefined();
    });

    test('should send verification email after registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]).toMatchObject({
        to: 'test@example.com',
        subject: 'Verify your LegacyLancers account'
      });
    });

    test('should normalize email address', async () => {
      const data = { ...validRegistrationData, email: 'Test@EXAMPLE.COM' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(201);

      expect(response.body.data.user.email).toBe('test@example.com');
    });

    test('should sanitize name inputs', async () => {
      const data = {
        ...validRegistrationData,
        firstName: '  John <script>  ',
        lastName: '  Doe & Co  '
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(201);

      expect(response.body.data.user.firstName).toBe('John &lt;script&gt;');
      expect(response.body.data.user.lastName).toBe('Doe &amp; Co');
    });

    test('should handle optional phone number', async () => {
      const data = { ...validRegistrationData, phone: '+1-234-567-8900' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(201);

      expect(response.body.data.user.phone).toBe('+1-234-567-8900');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required'),
        code: 'MISSING_REQUIRED_FIELDS'
      });
    });

    test('should return 400 for invalid email', async () => {
      const data = { ...validRegistrationData, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('valid email'),
        code: 'INVALID_EMAIL'
      });
    });

    test('should return 400 for invalid phone', async () => {
      const data = { ...validRegistrationData, phone: 'invalid-phone' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('valid phone'),
        code: 'INVALID_PHONE'
      });
    });

    test('should return 400 for missing privacy consent', async () => {
      const data = { ...validRegistrationData, privacyConsent: false };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Privacy consent'),
        code: 'PRIVACY_CONSENT_REQUIRED'
      });
    });

    test('should return 409 for duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists'),
        code: 'USER_EXISTS'
      });
    });

    test('should validate name lengths', async () => {
      const longName = 'a'.repeat(101);
      
      const response1 = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistrationData, firstName: longName })
        .expect(400);

      expect(response1.body.code).toBe('INVALID_FIRST_NAME');

      const response2 = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistrationData, lastName: longName })
        .expect(400);

      expect(response2.body.code).toBe('INVALID_LAST_NAME');

      const response3 = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistrationData, firstName: '' })
        .expect(400);

      expect(response3.body.code).toBe('INVALID_FIRST_NAME');
    });

    test('should continue registration even if email sending fails', async () => {
      EmailService.setFailureMode(true);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);

      // User should still be created
      const user = await User.findByEmail('test@example.com');
      expect(user).toBeDefined();
    });

    test('should validate password strength', async () => {
      const data = { ...validRegistrationData, password: 'weak' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(data)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    let verificationToken;

    beforeEach(async () => {
      // Register a user to get verification token
      const user = await User.create({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });
      verificationToken = user.verificationToken;
    });

    test('should verify email successfully', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: 'test@example.com',
            emailVerified: true
          },
          message: expect.stringContaining('verified successfully')
        }
      });
    });

    test('should send welcome email after verification', async () => {
      await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]).toMatchObject({
        to: 'test@example.com',
        subject: 'Welcome to LegacyLancers!'
      });
    });

    test('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('token is required'),
        code: 'INVALID_TOKEN'
      });
    });

    test('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_TOKEN'
      });
    });

    test('should return 410 for expired token', async () => {
      // Create an expired token
      User.verificationTokens.set('expired-token', {
        userId: 'some-id',
        email: 'test@example.com',
        type: 'email_verification',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'expired-token' })
        .expect(410);

      expect(response.body).toMatchObject({
        success: false,
        code: 'TOKEN_EXPIRED'
      });
    });

    test('should handle welcome email sending failure gracefully', async () => {
      EmailService.setFailureMode(true);

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Email should still be verified
      const user = await User.findByEmail('test@example.com');
      expect(user.emailVerified).toBe(true);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    beforeEach(async () => {
      // Create user but don't verify email
      await User.create({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });
      EmailService.clearSentEmails(); // Clear registration email
    });

    test('should resend verification email', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('resent')
      });

      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]).toMatchObject({
        to: 'test@example.com',
        subject: 'Verify your LegacyLancers account'
      });
    });

    test('should not reveal if email exists', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('If this email is registered')
      });
    });

    test('should return error for already verified email', async () => {
      // Verify the email first
      const user = await User.findByEmail('test@example.com');
      await User.update(user.id, { emailVerified: true });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        code: 'EMAIL_ALREADY_VERIFIED'
      });
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_EMAIL'
      });
    });

    test('should return 500 if email sending fails', async () => {
      EmailService.setFailureMode(true);

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        code: 'EMAIL_SEND_FAILED'
      });
    });
  });

  describe('GET /api/auth/check-email', () => {
    beforeEach(async () => {
      await User.create({
        email: 'existing@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });
    });

    test('should return available for new email', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'new@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          available: true,
          email: 'new@example.com'
        }
      });
    });

    test('should return not available for existing email', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'existing@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          available: false,
          email: 'existing@example.com'
        }
      });
    });

    test('should normalize email when checking', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'EXISTING@EXAMPLE.COM' })
        .expect(200);

      expect(response.body.data.available).toBe(false);
      expect(response.body.data.email).toBe('existing@example.com');
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_EMAIL'
      });
    });

    test('should return 400 for missing email', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'INVALID_EMAIL'
      });
    });
  });

  describe('GET /api/auth/registration-stats', () => {
    test('should return registration statistics in development', async () => {
      // Create some users for stats
      await User.create({
        email: 'user1@example.com',
        password: 'SecurePass123!',
        firstName: 'User',
        lastName: 'One',
        privacyConsent: true
      });

      const user2 = await User.create({
        email: 'user2@example.com',
        password: 'SecurePass123!',
        firstName: 'User',
        lastName: 'Two',
        privacyConsent: true
      });

      // Verify one user
      await User.update(user2.id, { emailVerified: true });

      const response = await request(app)
        .get('/api/auth/registration-stats')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalUsers: 2,
          activeUsers: 2,
          verifiedUsers: 1,
          unverifiedUsers: 1,
          deletedUsers: 0,
          kycPendingUsers: 2,
          kycVerifiedUsers: 0
        }
      });
    });

    test('should return 404 in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/auth/registration-stats')
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('POST /api/auth/cleanup-tokens', () => {
    test('should cleanup expired tokens in development', async () => {
      // Create user with token
      await User.create({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });

      // Manually add expired token
      User.verificationTokens.set('expired-token', {
        userId: 'some-id',
        email: 'test@example.com',
        type: 'email_verification',
        expiresAt: new Date(Date.now() - 1000), // Expired
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/cleanup-tokens')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: expect.stringContaining('Cleaned up')
        }
      });
    });

    test('should return 404 in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/cleanup-tokens')
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('rate limiting', () => {
    test('should enforce registration rate limiting', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      // Make 3 registration attempts (the limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({ ...registrationData, email: `test${i}@example.com` })
          .expect(201);
      }

      // 4th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...registrationData, email: 'test3@example.com' })
        .expect(429);

      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should enforce resend verification rate limiting', async () => {
      // Create user
      await User.create({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });

      // Make 3 resend attempts (the limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/resend-verification')
          .send({ email: 'test@example.com' })
          .expect(200);
      }

      // 4th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(429);

      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('security', () => {
    test('should sanitize request data', async () => {
      const maliciousData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: '<script>alert("xss")</script>',
        lastName: 'Doe & Associates',
        privacyConsent: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.user.firstName).not.toContain('<script>');
      expect(response.body.data.user.lastName).toContain('&amp;');
    });

    test('should block suspicious requests', async () => {
      const suspiciousData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: '../../../etc/passwd',
        lastName: 'Doe',
        privacyConsent: true
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(suspiciousData)
        .expect(400);

      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
    });

    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/auth/check-email')
        .query({ email: 'test@example.com' });

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});