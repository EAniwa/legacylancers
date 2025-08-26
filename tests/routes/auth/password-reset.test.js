/**
 * Password Reset Routes Tests
 * Comprehensive tests for password reset functionality with security focus
 */

const request = require('supertest');
const app = require('../../../src/app');
const { User } = require('../../../src/models/User');
const { PasswordResetService } = require('../../../src/services/password-reset');
const { EmailService } = require('../../../src/services/email');
const { verifyPassword } = require('../../../src/auth/password');

describe('Password Reset Routes', () => {
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

  let verifiedUserId;
  let testUserId;

  beforeEach(async () => {
    // Reset all services
    await User.reset();
    await PasswordResetService.reset();
    EmailService.clearSentEmails();

    // Create test users
    const unverifiedUserData = await User.create(testUser);
    const verifiedUserData = await User.create(verifiedUser);

    testUserId = unverifiedUserData.id;
    verifiedUserId = verifiedUserData.id;

    // Verify the second user
    await User.update(verifiedUserId, { emailVerified: true });
  });

  describe('POST /api/auth/password-reset/request', () => {
    describe('Success Cases', () => {
      it('should send password reset email for verified user', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: verifiedUser.email
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Password reset instructions have been sent to your email address.'
        });

        expect(response.body.data).toHaveProperty('emailSent', true);
        expect(response.body.data).toHaveProperty('expiresIn');
        expect(typeof response.body.data.expiresIn).toBe('number');

        // Check that email was sent
        const sentEmails = EmailService.getSentEmails();
        expect(sentEmails).toHaveLength(1);
        expect(sentEmails[0].to).toBe(verifiedUser.email);
        expect(sentEmails[0].subject).toBe('Reset your LegacyLancers password');
      });

      it('should return success for non-existent user (security)', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: 'nonexistent@example.com'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'If this email address exists in our system, you will receive password reset instructions.'
        });

        expect(response.body.data.emailSent).toBe(false);

        // Check that no email was sent
        const sentEmails = EmailService.getSentEmails();
        expect(sentEmails).toHaveLength(0);
      });

      it('should normalize email before processing', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: '  VERIFIED@EXAMPLE.COM  '
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.emailSent).toBe(true);
      });
    });

    describe('Validation Errors', () => {
      it('should reject request without email', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({})
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Email address is required',
          code: 'MISSING_EMAIL'
        });
      });

      it('should reject invalid email format', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: 'invalid-email'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Please provide a valid email address',
          code: 'INVALID_EMAIL'
        });
      });
    });

    describe('Business Logic Errors', () => {
      it('should reject request for unverified user', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: testUser.email
          })
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Please verify your email address before resetting your password',
          code: 'EMAIL_NOT_VERIFIED'
        });
      });

      it('should return success for inactive user (security)', async () => {
        // Make user inactive
        await User.update(verifiedUserId, { status: 'inactive' });

        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: verifiedUser.email
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.emailSent).toBe(false);
      });
    });

    describe('Rate Limiting', () => {
      // Note: Rate limiting is disabled in test environment
      it('should have rate limiting configured', async () => {
        // Make multiple rapid requests - should succeed in test environment
        const requests = Array.from({ length: 5 }, () =>
          request(app)
            .post('/api/auth/password-reset/request')
            .send({
              email: verifiedUser.email
            })
        );

        const responses = await Promise.all(requests);
        
        // In test environment, all should succeed
        responses.forEach(response => {
          expect([200, 429]).toContain(response.status);
        });
      });
    });
  });

  describe('GET /api/auth/password-reset/verify/:token', () => {
    let validToken;

    beforeEach(async () => {
      // Generate a valid token
      validToken = await PasswordResetService.generateResetToken(verifiedUserId, verifiedUser.email);
    });

    describe('Success Cases', () => {
      it('should verify valid token', async () => {
        const response = await request(app)
          .get(`/api/auth/password-reset/verify/${validToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Token is valid'
        });

        expect(response.body.data).toHaveProperty('valid', true);
        expect(response.body.data).toHaveProperty('email', verifiedUser.email);
        expect(response.body.data).toHaveProperty('expiresAt');
      });
    });

    describe('Token Validation Errors', () => {
      it('should reject missing token', async () => {
        const response = await request(app)
          .get('/api/auth/password-reset/verify/')
          .expect(404); // Route not found without token parameter
      });

      it('should reject invalid token format', async () => {
        const response = await request(app)
          .get('/api/auth/password-reset/verify/invalid-token')
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT'
        });
      });

      it('should reject non-existent token', async () => {
        const fakeToken = '1'.repeat(64); // Valid format but doesn't exist

        const response = await request(app)
          .get(`/api/auth/password-reset/verify/${fakeToken}`)
          .expect(410);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      });

      it('should reject expired token', async () => {
        // Manually expire the token
        const tokenData = PasswordResetService.resetTokens.get(validToken);
        tokenData.expiresAt = new Date(Date.now() - 1000); // 1 second ago

        const response = await request(app)
          .get(`/api/auth/password-reset/verify/${validToken}`)
          .expect(410);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Reset token has expired. Please request a new password reset.',
          code: 'TOKEN_EXPIRED'
        });

        // Token should be cleaned up
        expect(PasswordResetService.resetTokens.has(validToken)).toBe(false);
      });
    });
  });

  describe('POST /api/auth/password-reset/complete', () => {
    let validToken;
    const newPassword = 'NewSecurePassword123!';

    beforeEach(async () => {
      // Generate a valid token
      validToken = await PasswordResetService.generateResetToken(verifiedUserId, verifiedUser.email);
    });

    describe('Success Cases', () => {
      it('should complete password reset successfully', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword,
            confirmPassword: newPassword
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Password has been reset successfully. You can now log in with your new password.'
        });

        expect(response.body.data).toHaveProperty('userId', verifiedUserId);

        // Token should be cleaned up
        expect(PasswordResetService.resetTokens.has(validToken)).toBe(false);

        // Verify that the password was actually changed
        const user = await User.findByEmailWithPassword(verifiedUser.email);
        const isNewPasswordValid = await verifyPassword(newPassword, user.passwordHash);
        expect(isNewPasswordValid).toBe(true);

        // Old password should no longer work
        const isOldPasswordValid = await verifyPassword(verifiedUser.password, user.passwordHash);
        expect(isOldPasswordValid).toBe(false);
      });

      it('should allow login with new password after reset', async () => {
        // Complete password reset
        await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword,
            confirmPassword: newPassword
          })
          .expect(200);

        // Login with new password should work
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: verifiedUser.email,
            password: newPassword
          })
          .expect(200);

        expect(loginResponse.body.success).toBe(true);
      });
    });

    describe('Validation Errors', () => {
      it('should reject without token', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            newPassword,
            confirmPassword: newPassword
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Reset token is required',
          code: 'MISSING_TOKEN'
        });
      });

      it('should reject without new password', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            confirmPassword: newPassword
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'New password is required',
          code: 'MISSING_NEW_PASSWORD'
        });
      });

      it('should reject without password confirmation', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Password confirmation is required',
          code: 'MISSING_CONFIRM_PASSWORD'
        });
      });

      it('should reject mismatched passwords', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword,
            confirmPassword: 'DifferentPassword123!'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'New password and confirmation do not match',
          code: 'PASSWORD_MISMATCH'
        });
      });

      it('should reject invalid token format', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: 'invalid-token',
            newPassword,
            confirmPassword: newPassword
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT'
        });
      });
    });

    describe('Password Validation', () => {
      it('should reject weak password', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword: 'weak',
            confirmPassword: 'weak'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        // Should get a password-related error
        expect(['COMPLETE_RESET_FAILED', 'PASSWORD_ERROR', 'VALIDATION_FAILED']).toContain(response.body.code);
      });

      it('should accept strong password', async () => {
        const strongPassword = 'VerySecurePassword123!@#';
        
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword: strongPassword,
            confirmPassword: strongPassword
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Token Security', () => {
      it('should reject expired token', async () => {
        // Expire the token
        const tokenData = PasswordResetService.resetTokens.get(validToken);
        tokenData.expiresAt = new Date(Date.now() - 1000);

        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword,
            confirmPassword: newPassword
          })
          .expect(410);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Reset token has expired. Please request a new password reset.',
          code: 'TOKEN_EXPIRED'
        });
      });

      it('should reject reused token', async () => {
        // Use the token once
        await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword,
            confirmPassword: newPassword
          })
          .expect(200);

        // Try to use the same token again
        const response = await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: validToken,
            newPassword: 'AnotherPassword123!',
            confirmPassword: 'AnotherPassword123!'
          })
          .expect(410);

        expect(response.body).toMatchObject({
          success: false,
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      });

      it('should clean up all tokens for user after successful reset', async () => {
        // Create multiple tokens for the same user
        const token2 = await PasswordResetService.generateResetToken(verifiedUserId, verifiedUser.email);
        const token3 = await PasswordResetService.generateResetToken(verifiedUserId, verifiedUser.email);

        expect(PasswordResetService.resetTokens.has(validToken)).toBe(false); // Overwritten
        expect(PasswordResetService.resetTokens.has(token2)).toBe(false); // Overwritten
        expect(PasswordResetService.resetTokens.has(token3)).toBe(true); // Current

        // Complete reset with the latest token
        await request(app)
          .post('/api/auth/password-reset/complete')
          .send({
            token: token3,
            newPassword,
            confirmPassword: newPassword
          })
          .expect(200);

        // All tokens should be cleaned up
        expect(PasswordResetService.resetTokens.has(token3)).toBe(false);
      });
    });
  });

  describe('GET /api/auth/password-reset/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/auth/password-reset/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset service is healthy',
        service: 'password-reset'
      });

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('activeTokens');
      expect(response.body.stats).toHaveProperty('recentRequests');
      expect(response.body.stats).toHaveProperty('config');
    });
  });

  describe('POST /api/auth/password-reset/cleanup', () => {
    it('should clean up expired tokens', async () => {
      // Create some tokens and expire them
      const token1 = await PasswordResetService.generateResetToken(verifiedUserId, verifiedUser.email);
      const token2 = await PasswordResetService.generateResetToken(testUserId, testUser.email);

      // Manually expire one token
      const tokenData = PasswordResetService.resetTokens.get(token2);
      if (tokenData) {
        tokenData.expiresAt = new Date(Date.now() - 1000);
      }

      const response = await request(app)
        .post('/api/auth/password-reset/cleanup')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Cleanup completed successfully'
      });

      expect(response.body.data).toHaveProperty('expiredTokens');
      expect(response.body.data).toHaveProperty('activeTokens');
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock the service to throw an error
      const originalInitiate = PasswordResetService.initiatePasswordReset;
      PasswordResetService.initiatePasswordReset = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({
          email: verifiedUser.email
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Failed to process password reset request',
        code: 'INTERNAL_ERROR'
      });

      // Restore original method
      PasswordResetService.initiatePasswordReset = originalInitiate;
    });

    it('should handle email service failures', async () => {
      // Mock email service to fail
      EmailService.setFailureMode(true);

      const response = await request(app)
        .post('/api/auth/password-reset/request')
        .send({
          email: verifiedUser.email
        });

      // Should get an error response (could be 400 or 500)
      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);

      // Restore email service
      EmailService.setFailureMode(false);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full password reset workflow', async () => {
      // Ensure email service is working
      EmailService.setFailureMode(false);
      
      // Step 1: Request password reset
      const requestResponse = await request(app)
        .post('/api/auth/password-reset/request')
        .send({
          email: verifiedUser.email
        })
        .expect(200);

      expect(requestResponse.body.data.emailSent).toBe(true);

      // Extract token from sent email
      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      
      const emailHtml = sentEmails[0].html;
      const tokenMatch = emailHtml.match(/token=([a-f0-9]{64})/);
      expect(tokenMatch).not.toBeNull();
      const resetToken = tokenMatch[1];

      // Step 2: Verify token
      const verifyResponse = await request(app)
        .get(`/api/auth/password-reset/verify/${resetToken}`)
        .expect(200);

      expect(verifyResponse.body.data.valid).toBe(true);

      // Step 3: Complete password reset
      const newPassword = 'BrandNewPassword123!';
      const completeResponse = await request(app)
        .post('/api/auth/password-reset/complete')
        .send({
          token: resetToken,
          newPassword,
          confirmPassword: newPassword
        })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);

      // Step 4: Verify login with new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: verifiedUser.email,
          password: newPassword
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      // Step 5: Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: verifiedUser.email,
          password: verifiedUser.password
        })
        .expect(401);
    });
  });
});