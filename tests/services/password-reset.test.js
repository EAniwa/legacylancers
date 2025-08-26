/**
 * Password Reset Service Tests
 * Unit tests for the password reset service
 */

const { PasswordResetService, PasswordResetError } = require('../../src/services/password-reset');
const { User } = require('../../src/models/User');
const { EmailService } = require('../../src/services/email');
const { verifyPassword } = require('../../src/auth/password');

describe('PasswordResetService', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    firstName: 'Test',
    lastName: 'User',
    privacyConsent: true
  };

  let userId;

  beforeEach(async () => {
    // Reset all services
    await User.reset();
    await PasswordResetService.reset();
    EmailService.clearSentEmails();

    // Create and verify test user
    const userData = await User.create(testUser);
    userId = userData.id;
    await User.update(userId, { emailVerified: true });
  });

  describe('initiatePasswordReset', () => {
    it('should initiate password reset for valid user', async () => {
      const result = await PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1');

      expect(result).toMatchObject({
        success: true,
        message: 'Password reset instructions have been sent to your email address.',
        emailSent: true
      });

      expect(result.expiresIn).toBe(60); // 1 hour in minutes

      // Check email was sent
      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(testUser.email);
    });

    it('should return success for non-existent user without sending email', async () => {
      const result = await PasswordResetService.initiatePasswordReset('nonexistent@example.com', '127.0.0.1');

      expect(result).toMatchObject({
        success: true,
        message: 'If this email address exists in our system, you will receive password reset instructions.',
        emailSent: false
      });

      // No email should be sent
      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });

    it('should reject invalid email', async () => {
      await expect(
        PasswordResetService.initiatePasswordReset('invalid-email', '127.0.0.1')
      ).rejects.toThrow(PasswordResetError);
    });

    it('should reject unverified user', async () => {
      // Create unverified user
      const unverifiedUser = await User.create({
        email: 'unverified@example.com',
        password: 'Password123!',
        firstName: 'Unverified',
        lastName: 'User',
        privacyConsent: true
      });

      await expect(
        PasswordResetService.initiatePasswordReset('unverified@example.com', '127.0.0.1')
      ).rejects.toThrow('Please verify your email address before resetting your password');
    });

    it('should return success for inactive user without sending email', async () => {
      await User.update(userId, { status: 'inactive' });

      const result = await PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1');

      expect(result.emailSent).toBe(false);
      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });
  });

  describe('verifyResetToken', () => {
    let validToken;

    beforeEach(async () => {
      validToken = await PasswordResetService.generateResetToken(userId, testUser.email);
    });

    it('should verify valid token', async () => {
      const result = await PasswordResetService.verifyResetToken(validToken);

      expect(result).toMatchObject({
        success: true,
        valid: true,
        userId,
        email: testUser.email
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject invalid token', async () => {
      await expect(
        PasswordResetService.verifyResetToken('invalid-token')
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject missing token', async () => {
      await expect(
        PasswordResetService.verifyResetToken('')
      ).rejects.toThrow('Reset token is required');
    });

    it('should reject expired token and clean up', async () => {
      // Manually expire token
      const tokenData = PasswordResetService.resetTokens.get(validToken);
      tokenData.expiresAt = new Date(Date.now() - 1000);

      await expect(
        PasswordResetService.verifyResetToken(validToken)
      ).rejects.toThrow('Reset token has expired');

      // Token should be cleaned up
      expect(PasswordResetService.resetTokens.has(validToken)).toBe(false);
    });
  });

  describe('completePasswordReset', () => {
    let validToken;
    const newPassword = 'NewSecurePassword123!';

    beforeEach(async () => {
      validToken = await PasswordResetService.generateResetToken(userId, testUser.email);
    });

    it('should complete password reset successfully', async () => {
      const result = await PasswordResetService.completePasswordReset(validToken, newPassword, '127.0.0.1');

      expect(result).toMatchObject({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
        userId
      });

      // Token should be consumed
      expect(PasswordResetService.resetTokens.has(validToken)).toBe(false);

      // Verify password was changed
      const user = await User.findByEmailWithPassword(testUser.email);
      const isNewPasswordValid = await verifyPassword(newPassword, user.passwordHash);
      expect(isNewPasswordValid).toBe(true);
    });

    it('should reject invalid token', async () => {
      await expect(
        PasswordResetService.completePasswordReset('invalid-token', newPassword, '127.0.0.1')
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject weak password', async () => {
      await expect(
        PasswordResetService.completePasswordReset(validToken, 'weak', '127.0.0.1')
      ).rejects.toThrow(PasswordResetError);
    });

    it('should clean up all user tokens after reset', async () => {
      // Create additional tokens
      const token2 = await PasswordResetService.generateResetToken(userId, testUser.email);
      
      // Only the latest token should exist
      expect(PasswordResetService.resetTokens.has(token2)).toBe(true);
      expect(PasswordResetService.resetTokens.has(validToken)).toBe(false);

      // Complete reset
      await PasswordResetService.completePasswordReset(token2, newPassword, '127.0.0.1');

      // All tokens should be gone
      expect(PasswordResetService.resetTokens.has(token2)).toBe(false);
    });
  });

  describe('generateResetToken', () => {
    it('should generate valid token', async () => {
      const token = await PasswordResetService.generateResetToken(userId, testUser.email);

      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64); // 32 bytes as hex
      expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);

      // Token should be stored
      expect(PasswordResetService.resetTokens.has(token)).toBe(true);
    });

    it('should replace existing tokens for user', async () => {
      const token1 = await PasswordResetService.generateResetToken(userId, testUser.email);
      const token2 = await PasswordResetService.generateResetToken(userId, testUser.email);

      expect(token1).not.toBe(token2);
      expect(PasswordResetService.resetTokens.has(token1)).toBe(false);
      expect(PasswordResetService.resetTokens.has(token2)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce email rate limiting', async () => {
      const email = testUser.email;
      const ip = '127.0.0.1';

      // First request
      await PasswordResetService.initiatePasswordReset(email, ip);

      // Wait a bit to avoid minimum time restriction, then make more requests
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Manipulate the rate limit data to simulate 3 requests
      const emailKey = `email:${email}`;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
      
      // Set up 3 previous attempts within the hour
      PasswordResetService.resetAttempts.set(emailKey, [
        oneHourAgo,
        new Date(oneHourAgo.getTime() + 10 * 60 * 1000),
        new Date(oneHourAgo.getTime() + 20 * 60 * 1000)
      ]);

      // Next request should be rate limited
      await expect(
        PasswordResetService.initiatePasswordReset(email, ip)
      ).rejects.toThrow('Too many password reset attempts');
    });

    it('should enforce IP rate limiting', async () => {
      const ip = '127.0.0.1';

      // Create multiple users
      const users = [];
      for (let i = 0; i < 11; i++) {
        const user = await User.create({
          email: `user${i}@example.com`,
          password: 'Password123!',
          firstName: 'User',
          lastName: `${i}`,
          privacyConsent: true
        });
        await User.update(user.id, { emailVerified: true });
        users.push(user);
      }

      // Use up the IP rate limit
      for (let i = 0; i < 10; i++) {
        await PasswordResetService.initiatePasswordReset(users[i].email, ip);
      }

      // Next request should be rate limited
      await expect(
        PasswordResetService.initiatePasswordReset(users[10].email, ip)
      ).rejects.toThrow('Too many password reset attempts from your location');
    });

    it('should enforce minimum time between requests', async () => {
      const email = testUser.email;
      const ip = '127.0.0.1';

      // First request
      await PasswordResetService.initiatePasswordReset(email, ip);

      // Immediate second request should be rejected
      await expect(
        PasswordResetService.initiatePasswordReset(email, ip)
      ).rejects.toThrow('Please wait');
    });
  });

  describe('cleanup', () => {
    it('should clean up expired tokens and old rate limit data', async () => {
      // Create some tokens
      const token1 = await PasswordResetService.generateResetToken(userId, testUser.email);
      
      // Create another user and token
      const user2 = await User.create({
        email: 'user2@example.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: '2',
        privacyConsent: true
      });
      await User.update(user2.id, { emailVerified: true });
      const token2 = await PasswordResetService.generateResetToken(user2.id, 'user2@example.com');

      // Expire one token
      const tokenData = PasswordResetService.resetTokens.get(token2);
      if (tokenData) {
        tokenData.expiresAt = new Date(Date.now() - 1000);
      }

      // Add some rate limit data
      await PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1');

      const result = await PasswordResetService.cleanup();

      expect(result).toHaveProperty('expiredTokens');
      expect(result).toHaveProperty('activeTokens');
      expect(result.expiredTokens).toBe(1);
      expect(result.activeTokens).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return service statistics', async () => {
      // Create some test data
      await PasswordResetService.generateResetToken(userId, testUser.email);
      await PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1');

      const stats = await PasswordResetService.getStats();

      expect(stats).toHaveProperty('activeTokens');
      expect(stats).toHaveProperty('expiredTokens');
      expect(stats).toHaveProperty('recentRequests');
      expect(stats).toHaveProperty('todayRequests');
      expect(stats).toHaveProperty('config');

      expect(typeof stats.activeTokens).toBe('number');
      expect(stats.config).toHaveProperty('tokenExpirationMinutes');
      expect(stats.config).toHaveProperty('maxAttemptsPerHour');
    });
  });

  describe('Error Handling', () => {
    it('should handle email service errors', async () => {
      EmailService.setFailureMode(true);

      await expect(
        PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1')
      ).rejects.toThrow('Failed to initiate password reset');

      EmailService.setFailureMode(false);
    });

    it('should handle user model errors', async () => {
      // Mock User.findByEmail to throw error
      const originalMethod = User.findByEmail;
      User.findByEmail = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1')
      ).rejects.toThrow('Failed to initiate password reset');

      User.findByEmail = originalMethod;
    });
  });

  describe('Security Features', () => {
    it('should generate cryptographically secure tokens', async () => {
      const tokens = new Set();
      
      // Generate multiple tokens and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const token = await PasswordResetService.generateResetToken(userId, testUser.email);
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
    });

    it('should not leak information about user existence', async () => {
      // Ensure email service is not in failure mode
      EmailService.setFailureMode(false);
      
      const startTime = Date.now();
      const result1 = await PasswordResetService.initiatePasswordReset('nonexistent@example.com', '127.0.0.1');
      const time1 = Date.now() - startTime;

      const startTime2 = Date.now();
      const result2 = await PasswordResetService.initiatePasswordReset(testUser.email, '127.0.0.1');
      const time2 = Date.now() - startTime2;

      // Both should return success messages
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Timing should be reasonably similar (within a reasonable threshold)
      const timeDiff = Math.abs(time1 - time2);
      expect(timeDiff).toBeLessThan(200); // Allow for some variance
    });
  });
});