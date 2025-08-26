/**
 * Email Service Tests
 * Comprehensive tests for Email service functionality
 */

const { EmailService, EmailError } = require('../../src/services/email');

describe('Email Service', () => {
  beforeEach(() => {
    // Clear sent emails and reset state before each test
    EmailService.clearSentEmails();
    EmailService.setFailureMode(false);
    EmailService.setDeliveryDelay(0);
    EmailService.resetRateLimiting();
  });

  describe('sendVerificationEmail', () => {
    const validParams = {
      email: 'test@example.com',
      firstName: 'John',
      verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
    };

    test('should send verification email successfully', async () => {
      const result = await EmailService.sendVerificationEmail(validParams);

      expect(result).toMatchObject({
        success: true,
        recipient: 'test@example.com',
        type: 'verification',
        messageId: expect.any(String),
        sentAt: expect.any(Date)
      });

      // Check that email was stored in test mode
      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]).toMatchObject({
        to: 'test@example.com',
        subject: 'Verify your LegacyLancers account',
        messageId: expect.any(String),
        status: 'delivered'
      });
    });

    test('should include verification URL in email', async () => {
      await EmailService.sendVerificationEmail(validParams);

      const sentEmails = EmailService.getSentEmails();
      const emailHtml = sentEmails[0].html;
      
      expect(emailHtml).toContain(validParams.verificationToken);
      expect(emailHtml).toContain('verify-email');
      expect(emailHtml).toContain('John');
    });

    test('should include both HTML and text versions', async () => {
      await EmailService.sendVerificationEmail(validParams);

      const sentEmails = EmailService.getSentEmails();
      const email = sentEmails[0];
      
      expect(email.html).toBeDefined();
      expect(email.text).toBeDefined();
      expect(email.html).toContain('<html>');
      expect(email.text).toContain('Welcome to LegacyLancers, John!');
    });

    test('should validate required parameters', async () => {
      await expect(EmailService.sendVerificationEmail({}))
        .rejects.toThrow('Valid email address is required');

      await expect(EmailService.sendVerificationEmail({
        email: 'invalid-email',
        firstName: 'John',
        verificationToken: validParams.verificationToken
      })).rejects.toThrow('Valid email address is required');

      await expect(EmailService.sendVerificationEmail({
        email: validParams.email,
        firstName: '',
        verificationToken: validParams.verificationToken
      })).rejects.toThrow('Valid first name is required');

      await expect(EmailService.sendVerificationEmail({
        email: validParams.email,
        firstName: validParams.firstName,
        verificationToken: 'short'
      })).rejects.toThrow('Valid verification token is required');
    });

    test('should respect rate limiting', async () => {
      // Send 3 emails (the hourly limit)
      for (let i = 0; i < 3; i++) {
        await EmailService.sendVerificationEmail(validParams);
      }

      // 4th email should be rate limited
      await expect(EmailService.sendVerificationEmail(validParams))
        .rejects.toThrow('Too many emails sent in the last hour');
    });

    test('should handle email sending failures', async () => {
      EmailService.setFailureMode(true);

      await expect(EmailService.sendVerificationEmail(validParams))
        .rejects.toThrow('Failed to send verification email');
    });

    test('should validate first name length', async () => {
      const longName = 'a'.repeat(101);
      const params = { ...validParams, firstName: longName };

      await expect(EmailService.sendVerificationEmail(params))
        .rejects.toThrow('Valid first name is required');
    });

    test('should validate token length', async () => {
      const shortToken = 'short';
      const params = { ...validParams, verificationToken: shortToken };

      await expect(EmailService.sendVerificationEmail(params))
        .rejects.toThrow('Valid verification token is required');

      const longToken = 'a'.repeat(129);
      const params2 = { ...validParams, verificationToken: longToken };

      await expect(EmailService.sendVerificationEmail(params2))
        .rejects.toThrow('Valid verification token is required');
    });
  });

  describe('sendWelcomeEmail', () => {
    const validParams = {
      email: 'test@example.com',
      firstName: 'John'
    };

    test('should send welcome email successfully', async () => {
      const result = await EmailService.sendWelcomeEmail(validParams);

      expect(result).toMatchObject({
        success: true,
        recipient: 'test@example.com',
        type: 'welcome',
        messageId: expect.any(String),
        sentAt: expect.any(Date)
      });

      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]).toMatchObject({
        to: 'test@example.com',
        subject: 'Welcome to LegacyLancers!',
        messageId: expect.any(String),
        status: 'delivered'
      });
    });

    test('should include personalized content', async () => {
      await EmailService.sendWelcomeEmail(validParams);

      const sentEmails = EmailService.getSentEmails();
      const emailHtml = sentEmails[0].html;
      const emailText = sentEmails[0].text;
      
      expect(emailHtml).toContain('John');
      expect(emailHtml).toContain('Welcome');
      expect(emailHtml).toContain('Complete Profile');
      expect(emailText).toContain('John');
    });

    test('should validate parameters', async () => {
      await expect(EmailService.sendWelcomeEmail({}))
        .rejects.toThrow('Valid email address is required');

      await expect(EmailService.sendWelcomeEmail({
        email: 'invalid-email',
        firstName: 'John'
      })).rejects.toThrow('Valid email address is required');

      await expect(EmailService.sendWelcomeEmail({
        email: validParams.email,
        firstName: ''
      })).rejects.toThrow('Valid first name is required');
    });

    test('should respect rate limiting', async () => {
      // Send 1 welcome email (the hourly limit)
      await EmailService.sendWelcomeEmail(validParams);

      // 2nd email should be rate limited
      await expect(EmailService.sendWelcomeEmail(validParams))
        .rejects.toThrow('Too many emails sent in the last hour');
    });
  });

  describe('sendPasswordResetEmail', () => {
    const validParams = {
      email: 'test@example.com',
      firstName: 'John',
      resetToken: 'reset1234567890reset1234567890reset1234567890'
    };

    test('should send password reset email successfully', async () => {
      const result = await EmailService.sendPasswordResetEmail(validParams);

      expect(result).toMatchObject({
        success: true,
        recipient: 'test@example.com',
        type: 'password_reset',
        messageId: expect.any(String),
        sentAt: expect.any(Date)
      });

      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]).toMatchObject({
        to: 'test@example.com',
        subject: 'Reset your LegacyLancers password',
        messageId: expect.any(String),
        status: 'delivered'
      });
    });

    test('should include reset URL in email', async () => {
      await EmailService.sendPasswordResetEmail(validParams);

      const sentEmails = EmailService.getSentEmails();
      const emailHtml = sentEmails[0].html;
      
      expect(emailHtml).toContain(validParams.resetToken);
      expect(emailHtml).toContain('reset-password');
      expect(emailHtml).toContain('John');
      expect(emailHtml).toContain('Security Notice');
    });

    test('should validate parameters', async () => {
      await expect(EmailService.sendPasswordResetEmail({}))
        .rejects.toThrow('Valid email address is required');

      await expect(EmailService.sendPasswordResetEmail({
        email: 'invalid-email',
        firstName: 'John',
        resetToken: validParams.resetToken
      })).rejects.toThrow('Valid email address is required');

      await expect(EmailService.sendPasswordResetEmail({
        email: validParams.email,
        firstName: '',
        resetToken: validParams.resetToken
      })).rejects.toThrow('Valid first name is required');

      await expect(EmailService.sendPasswordResetEmail({
        email: validParams.email,
        firstName: validParams.firstName,
        resetToken: 'short'
      })).rejects.toThrow('Valid reset token is required');
    });
  });

  describe('rate limiting', () => {
    test('should track separate limits per email type', async () => {
      const verificationParams = {
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      };

      const welcomeParams = {
        email: 'test@example.com',
        firstName: 'John'
      };

      // Send max verification emails
      for (let i = 0; i < 3; i++) {
        await EmailService.sendVerificationEmail(verificationParams);
      }

      // Should still be able to send welcome email (different limit)
      await expect(EmailService.sendWelcomeEmail(welcomeParams))
        .resolves.toBeDefined();

      // But not another verification email
      await expect(EmailService.sendVerificationEmail(verificationParams))
        .rejects.toThrow('Too many emails sent in the last hour');
    });

    test('should track limits per email address', async () => {
      const params1 = {
        email: 'user1@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      };

      const params2 = {
        email: 'user2@example.com',
        firstName: 'Jane',
        verificationToken: 'efgh1234567890efgh1234567890efgh1234567890'
      };

      // Send max emails for user1
      for (let i = 0; i < 3; i++) {
        await EmailService.sendVerificationEmail(params1);
      }

      // Should still be able to send to user2
      await expect(EmailService.sendVerificationEmail(params2))
        .resolves.toBeDefined();

      // But not to user1
      await expect(EmailService.sendVerificationEmail(params1))
        .rejects.toThrow('Too many emails sent in the last hour');
    });

    test('should reset rate limiting', async () => {
      const params = {
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      };

      // Fill up the rate limit
      for (let i = 0; i < 3; i++) {
        await EmailService.sendVerificationEmail(params);
      }

      // Reset rate limiting
      EmailService.resetRateLimiting();

      // Should be able to send again
      await expect(EmailService.sendVerificationEmail(params))
        .resolves.toBeDefined();
    });
  });

  describe('email templates', () => {
    test('should generate valid HTML for verification email', async () => {
      const html = EmailService.generateVerificationEmailHtml({
        firstName: 'John',
        verificationUrl: 'http://example.com/verify?token=abc123',
        supportEmail: 'support@example.com'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('John');
      expect(html).toContain('http://example.com/verify?token=abc123');
      expect(html).toContain('support@example.com');
      expect(html).toContain('LegacyLancers');
    });

    test('should generate valid text for verification email', async () => {
      const text = EmailService.generateVerificationEmailText({
        firstName: 'John',
        verificationUrl: 'http://example.com/verify?token=abc123',
        supportEmail: 'support@example.com'
      });

      expect(text).toContain('Welcome to LegacyLancers, John!');
      expect(text).toContain('http://example.com/verify?token=abc123');
      expect(text).toContain('support@example.com');
      expect(text).toContain('24 hours');
    });

    test('should generate valid HTML for welcome email', async () => {
      const html = EmailService.generateWelcomeEmailHtml({
        firstName: 'John',
        baseUrl: 'http://example.com',
        supportEmail: 'support@example.com'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Congratulations, John!');
      expect(html).toContain('http://example.com/profile/edit');
      expect(html).toContain('support@example.com');
    });

    test('should generate valid text for welcome email', async () => {
      const text = EmailService.generateWelcomeEmailText({
        firstName: 'John',
        baseUrl: 'http://example.com',
        supportEmail: 'support@example.com'
      });

      expect(text).toContain('Welcome to LegacyLancers, John!');
      expect(text).toContain('http://example.com/profile/edit');
      expect(text).toContain('support@example.com');
    });

    test('should generate valid HTML for password reset email', async () => {
      const html = EmailService.generatePasswordResetEmailHtml({
        firstName: 'John',
        resetUrl: 'http://example.com/reset?token=abc123',
        supportEmail: 'support@example.com'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Hello John');
      expect(html).toContain('http://example.com/reset?token=abc123');
      expect(html).toContain('Security Notice');
      expect(html).toContain('support@example.com');
    });

    test('should generate valid text for password reset email', async () => {
      const text = EmailService.generatePasswordResetEmailText({
        firstName: 'John',
        resetUrl: 'http://example.com/reset?token=abc123',
        supportEmail: 'support@example.com'
      });

      expect(text).toContain('Hello John');
      expect(text).toContain('http://example.com/reset?token=abc123');
      expect(text).toContain('SECURITY NOTICE');
      expect(text).toContain('support@example.com');
    });
  });

  describe('utility methods', () => {
    test('should extract verification URL from HTML', async () => {
      const html = '<a href="http://example.com/verify-email?token=abc123">Verify</a>';
      const url = EmailService.extractVerificationUrl(html);
      
      expect(url).toBe('http://example.com/verify-email?token=abc123');
    });

    test('should return null for HTML without verification URL', async () => {
      const html = '<a href="http://example.com/login">Login</a>';
      const url = EmailService.extractVerificationUrl(html);
      
      expect(url).toBeNull();
    });

    test('should clear sent emails', async () => {
      await EmailService.sendVerificationEmail({
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      });

      expect(EmailService.getSentEmails()).toHaveLength(1);
      
      EmailService.clearSentEmails();
      
      expect(EmailService.getSentEmails()).toHaveLength(0);
    });

    test('should set delivery delay', async () => {
      EmailService.setDeliveryDelay(100);

      const start = Date.now();
      await EmailService.sendVerificationEmail({
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      });
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(100);
    });

    test('should set failure mode', async () => {
      EmailService.setFailureMode(true);

      await expect(EmailService.sendVerificationEmail({
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      })).rejects.toThrow('Simulated email sending failure');
    });
  });

  describe('error handling', () => {
    test('should throw EmailError for validation failures', async () => {
      try {
        await EmailService.sendVerificationEmail({});
      } catch (error) {
        expect(error).toBeInstanceOf(EmailError);
        expect(error.code).toBe('INVALID_EMAIL');
        expect(error.name).toBe('EmailError');
      }
    });

    test('should handle internal errors gracefully', async () => {
      // Test with invalid configuration that might cause internal errors
      const originalSendEmail = EmailService.sendEmail;
      EmailService.sendEmail = jest.fn().mockRejectedValue(new Error('Network error'));

      try {
        await EmailService.sendVerificationEmail({
          email: 'test@example.com',
          firstName: 'John',
          verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
        });
      } catch (error) {
        expect(error).toBeInstanceOf(EmailError);
        expect(error.code).toBe('SEND_FAILED');
      }

      // Restore original method
      EmailService.sendEmail = originalSendEmail;
    });

    test('should handle missing parameters gracefully', async () => {
      await expect(EmailService.sendVerificationEmail(null))
        .rejects.toThrow(EmailError);

      await expect(EmailService.sendVerificationEmail(undefined))
        .rejects.toThrow(EmailError);
    });
  });

  describe('configuration', () => {
    test('should use correct from email configuration', async () => {
      await EmailService.sendVerificationEmail({
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'abcd1234567890abcd1234567890abcd1234567890'
      });

      const sentEmails = EmailService.getSentEmails();
      expect(sentEmails[0].from).toMatchObject({
        email: 'noreply@legacylancers.com',
        name: 'LegacyLancers'
      });
    });

    test('should generate correct verification URLs', async () => {
      await EmailService.sendVerificationEmail({
        email: 'test@example.com',
        firstName: 'John',
        verificationToken: 'test-token-123'
      });

      const sentEmails = EmailService.getSentEmails();
      const emailHtml = sentEmails[0].html;
      
      expect(emailHtml).toContain('http://localhost:3000/verify-email?token=test-token-123');
    });
  });
});