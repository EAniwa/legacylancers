/**
 * Email Service
 * Handles email sending, verification, and template management
 */

const crypto = require('crypto');
const validator = require('validator');

class EmailError extends Error {
  constructor(message, code = 'EMAIL_ERROR') {
    super(message);
    this.name = 'EmailError';
    this.code = code;
  }
}

/**
 * Email Service Class
 * For now, simulates email sending. In production, would use a service like SendGrid, Mailgun, or AWS SES
 */
class EmailService {
  constructor() {
    this.isTestMode = process.env.NODE_ENV === 'test';
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Mock email storage for testing
    this.sentEmails = [];
    this.failureMode = false; // For testing email failures
    this.deliveryDelayMs = 100; // Simulate email sending delay
    
    // Email configuration (would come from environment variables in production)
    this.config = {
      fromEmail: process.env.EMAIL_FROM || 'noreply@legacylancers.com',
      fromName: process.env.EMAIL_FROM_NAME || 'LegacyLancers',
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@legacylancers.com',
      // In production, these would be real email service credentials
      apiKey: process.env.EMAIL_API_KEY || 'test-api-key',
      apiUrl: process.env.EMAIL_API_URL || 'https://api.emailservice.com/v1',
    };

    // Rate limiting for email sending
    this.emailCounts = new Map(); // Track emails sent per recipient
    this.rateLimits = {
      verificationEmail: {
        maxPerHour: 3,
        maxPerDay: 10
      },
      welcomeEmail: {
        maxPerHour: 1,
        maxPerDay: 2
      }
    };
  }

  /**
   * Send verification email
   * @param {Object} params - Email parameters
   * @param {string} params.email - Recipient email
   * @param {string} params.firstName - Recipient first name
   * @param {string} params.verificationToken - Verification token
   * @returns {Promise<Object>} Email sending result
   */
  async sendVerificationEmail({ email, firstName, verificationToken }) {
    try {
      // Validate inputs
      if (!email || !validator.isEmail(email)) {
        throw new EmailError('Valid email address is required', 'INVALID_EMAIL');
      }

      if (!firstName || !validator.isLength(firstName, { min: 1, max: 100 })) {
        throw new EmailError('Valid first name is required', 'INVALID_FIRST_NAME');
      }

      if (!verificationToken || !validator.isLength(verificationToken, { min: 32, max: 128 })) {
        throw new EmailError('Valid verification token is required', 'INVALID_TOKEN');
      }

      // Check rate limits
      await this.checkRateLimit(email, 'verificationEmail');

      // Generate verification URL
      const verificationUrl = `${this.config.baseUrl}/verify-email?token=${verificationToken}`;

      // Create email content
      const emailData = {
        to: email,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        subject: 'Verify your LegacyLancers account',
        html: this.generateVerificationEmailHtml({
          firstName,
          verificationUrl,
          supportEmail: this.config.supportEmail
        }),
        text: this.generateVerificationEmailText({
          firstName,
          verificationUrl,
          supportEmail: this.config.supportEmail
        })
      };

      // Send email
      const result = await this.sendEmail(emailData);

      // Update rate limiting
      await this.updateRateLimit(email, 'verificationEmail');

      return {
        success: true,
        messageId: result.messageId,
        recipient: email,
        type: 'verification',
        sentAt: new Date()
      };

    } catch (error) {
      if (error instanceof EmailError) {
        throw error;
      }
      throw new EmailError(`Failed to send verification email: ${error.message}`, 'SEND_FAILED');
    }
  }

  /**
   * Send welcome email after successful verification
   * @param {Object} params - Email parameters
   * @param {string} params.email - Recipient email
   * @param {string} params.firstName - Recipient first name
   * @returns {Promise<Object>} Email sending result
   */
  async sendWelcomeEmail({ email, firstName }) {
    try {
      // Validate inputs
      if (!email || !validator.isEmail(email)) {
        throw new EmailError('Valid email address is required', 'INVALID_EMAIL');
      }

      if (!firstName || !validator.isLength(firstName, { min: 1, max: 100 })) {
        throw new EmailError('Valid first name is required', 'INVALID_FIRST_NAME');
      }

      // Check rate limits
      await this.checkRateLimit(email, 'welcomeEmail');

      // Create email content
      const emailData = {
        to: email,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        subject: 'Welcome to LegacyLancers!',
        html: this.generateWelcomeEmailHtml({
          firstName,
          baseUrl: this.config.baseUrl,
          supportEmail: this.config.supportEmail
        }),
        text: this.generateWelcomeEmailText({
          firstName,
          baseUrl: this.config.baseUrl,
          supportEmail: this.config.supportEmail
        })
      };

      // Send email
      const result = await this.sendEmail(emailData);

      // Update rate limiting
      await this.updateRateLimit(email, 'welcomeEmail');

      return {
        success: true,
        messageId: result.messageId,
        recipient: email,
        type: 'welcome',
        sentAt: new Date()
      };

    } catch (error) {
      if (error instanceof EmailError) {
        throw error;
      }
      throw new EmailError(`Failed to send welcome email: ${error.message}`, 'SEND_FAILED');
    }
  }

  /**
   * Send password reset email
   * @param {Object} params - Email parameters
   * @param {string} params.email - Recipient email
   * @param {string} params.firstName - Recipient first name
   * @param {string} params.resetToken - Password reset token
   * @returns {Promise<Object>} Email sending result
   */
  async sendPasswordResetEmail({ email, firstName, resetToken }) {
    try {
      // Validate inputs
      if (!email || !validator.isEmail(email)) {
        throw new EmailError('Valid email address is required', 'INVALID_EMAIL');
      }

      if (!firstName || !validator.isLength(firstName, { min: 1, max: 100 })) {
        throw new EmailError('Valid first name is required', 'INVALID_FIRST_NAME');
      }

      if (!resetToken || !validator.isLength(resetToken, { min: 32, max: 128 })) {
        throw new EmailError('Valid reset token is required', 'INVALID_TOKEN');
      }

      // Generate reset URL
      const resetUrl = `${this.config.baseUrl}/reset-password?token=${resetToken}`;

      // Create email content
      const emailData = {
        to: email,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        subject: 'Reset your LegacyLancers password',
        html: this.generatePasswordResetEmailHtml({
          firstName,
          resetUrl,
          supportEmail: this.config.supportEmail
        }),
        text: this.generatePasswordResetEmailText({
          firstName,
          resetUrl,
          supportEmail: this.config.supportEmail
        })
      };

      // Send email
      const result = await this.sendEmail(emailData);

      return {
        success: true,
        messageId: result.messageId,
        recipient: email,
        type: 'password_reset',
        sentAt: new Date()
      };

    } catch (error) {
      if (error instanceof EmailError) {
        throw error;
      }
      throw new EmailError(`Failed to send password reset email: ${error.message}`, 'SEND_FAILED');
    }
  }

  /**
   * Core email sending method
   * @param {Object} emailData - Email data to send
   * @returns {Promise<Object>} Sending result
   */
  async sendEmail(emailData) {
    try {
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, this.deliveryDelayMs));

      // Simulate failure mode for testing
      if (this.failureMode) {
        throw new EmailError('Simulated email sending failure', 'SIMULATED_FAILURE');
      }

      const messageId = crypto.randomBytes(16).toString('hex');

      // In test/development mode, store email instead of sending
      if (this.isTestMode || this.isDevelopment) {
        const email = {
          ...emailData,
          messageId,
          sentAt: new Date(),
          status: 'delivered'
        };

        this.sentEmails.push(email);

        if (this.isDevelopment) {
          console.log('📧 Email sent (development mode):', {
            to: emailData.to,
            subject: emailData.subject,
            messageId,
            verificationUrl: this.extractVerificationUrl(emailData.html)
          });
        }

        return { messageId };
      }

      // In production, this would use a real email service
      // Example with a generic email service API:
      /*
      const response = await fetch(this.config.apiUrl + '/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new EmailError(`Email service error: ${response.statusText}`, 'SERVICE_ERROR');
      }

      const result = await response.json();
      return { messageId: result.id };
      */

      // For now, simulate successful sending
      return { messageId };

    } catch (error) {
      if (error instanceof EmailError) {
        throw error;
      }
      throw new EmailError(`Email sending failed: ${error.message}`, 'SEND_FAILED');
    }
  }

  /**
   * Check rate limits for email sending
   * @param {string} email - Recipient email
   * @param {string} emailType - Type of email
   */
  async checkRateLimit(email, emailType) {
    const limits = this.rateLimits[emailType];
    if (!limits) return;

    const key = `${email}:${emailType}`;
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get existing counts
    const counts = this.emailCounts.get(key) || [];
    
    // Filter to relevant time periods
    const hourCounts = counts.filter(timestamp => timestamp > hourAgo);
    const dayCounts = counts.filter(timestamp => timestamp > dayAgo);

    // Check limits
    if (hourCounts.length >= limits.maxPerHour) {
      throw new EmailError('Too many emails sent in the last hour. Please try again later.', 'RATE_LIMIT_HOUR');
    }

    if (dayCounts.length >= limits.maxPerDay) {
      throw new EmailError('Too many emails sent in the last 24 hours. Please try again later.', 'RATE_LIMIT_DAY');
    }
  }

  /**
   * Update rate limiting counters
   * @param {string} email - Recipient email
   * @param {string} emailType - Type of email
   */
  async updateRateLimit(email, emailType) {
    const key = `${email}:${emailType}`;
    const now = new Date();
    
    // Get existing counts and add current timestamp
    const counts = this.emailCounts.get(key) || [];
    counts.push(now);
    
    // Keep only last 24 hours
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentCounts = counts.filter(timestamp => timestamp > dayAgo);
    
    this.emailCounts.set(key, recentCounts);
  }

  /**
   * Generate verification email HTML
   * @param {Object} params - Template parameters
   * @returns {string} HTML content
   */
  generateVerificationEmailHtml({ firstName, verificationUrl, supportEmail }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your LegacyLancers account</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { color: #007bff; font-size: 24px; font-weight: bold; }
        .button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">LegacyLancers</div>
        </div>
        
        <h2>Welcome to LegacyLancers, ${firstName}!</h2>
        
        <p>Thank you for joining LegacyLancers, the platform connecting skilled retirees with organizations that need their expertise.</p>
        
        <p>To complete your account setup and start showcasing your professional experience, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify My Email</a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <div class="warning">
            <strong>Important:</strong> This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification email.
        </div>
        
        <p>Once verified, you'll be able to:</p>
        <ul>
            <li>Create your professional profile</li>
            <li>Showcase your experience and expertise</li>
            <li>Set your availability and rates</li>
            <li>Connect with organizations seeking your skills</li>
        </ul>
        
        <p>If you didn't create an account with LegacyLancers, you can safely ignore this email.</p>
        
        <div class="footer">
            <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
            <p>&copy; 2025 LegacyLancers. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate verification email plain text
   * @param {Object} params - Template parameters
   * @returns {string} Plain text content
   */
  generateVerificationEmailText({ firstName, verificationUrl, supportEmail }) {
    return `Welcome to LegacyLancers, ${firstName}!

Thank you for joining LegacyLancers, the platform connecting skilled retirees with organizations that need their expertise.

To complete your account setup and start showcasing your professional experience, please verify your email address by clicking the link below:

${verificationUrl}

IMPORTANT: This verification link will expire in 24 hours. If you don't verify your email within this time, you'll need to request a new verification email.

Once verified, you'll be able to:
• Create your professional profile
• Showcase your experience and expertise  
• Set your availability and rates
• Connect with organizations seeking your skills

If you didn't create an account with LegacyLancers, you can safely ignore this email.

Need help? Contact us at ${supportEmail}

© 2025 LegacyLancers. All rights reserved.`;
  }

  /**
   * Generate welcome email HTML
   * @param {Object} params - Template parameters
   * @returns {string} HTML content
   */
  generateWelcomeEmailHtml({ firstName, baseUrl, supportEmail }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to LegacyLancers!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #28a745; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { color: #28a745; font-size: 24px; font-weight: bold; }
        .button { display: inline-block; padding: 12px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .step { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">LegacyLancers</div>
            <h1 style="color: #28a745;">🎉 Welcome!</h1>
        </div>
        
        <h2>Congratulations, ${firstName}!</h2>
        
        <p>Your email has been successfully verified and your LegacyLancers account is now active.</p>
        
        <p>You're now part of a community that values the wealth of experience and expertise that seasoned professionals bring to the table.</p>
        
        <h3>Next Steps to Get Started:</h3>
        
        <div class="step">
            <h4>1. Complete Your Profile</h4>
            <p>Showcase your professional background, skills, and expertise to attract the right opportunities.</p>
            <a href="${baseUrl}/profile/edit" class="button">Complete Profile</a>
        </div>
        
        <div class="step">
            <h4>2. Set Your Availability</h4>
            <p>Let organizations know when you're available and what type of engagements you prefer.</p>
            <a href="${baseUrl}/availability" class="button">Set Availability</a>
        </div>
        
        <div class="step">
            <h4>3. Explore Opportunities</h4>
            <p>Browse available projects and consulting opportunities that match your expertise.</p>
            <a href="${baseUrl}/opportunities" class="button">Browse Opportunities</a>
        </div>
        
        <p>Our platform is designed to help you leverage your years of experience in meaningful ways, whether through:</p>
        <ul>
            <li>Consulting projects</li>
            <li>Mentoring roles</li>
            <li>Keynote speaking</li>
            <li>Freelance work</li>
            <li>Project-based engagements</li>
        </ul>
        
        <p>If you have any questions or need assistance getting started, our support team is here to help.</p>
        
        <div class="footer">
            <p>Questions? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
            <p>&copy; 2025 LegacyLancers. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate welcome email plain text
   * @param {Object} params - Template parameters
   * @returns {string} Plain text content
   */
  generateWelcomeEmailText({ firstName, baseUrl, supportEmail }) {
    return `🎉 Welcome to LegacyLancers, ${firstName}!

Congratulations! Your email has been successfully verified and your LegacyLancers account is now active.

You're now part of a community that values the wealth of experience and expertise that seasoned professionals bring to the table.

NEXT STEPS TO GET STARTED:

1. Complete Your Profile
   Showcase your professional background, skills, and expertise to attract the right opportunities.
   → ${baseUrl}/profile/edit

2. Set Your Availability  
   Let organizations know when you're available and what type of engagements you prefer.
   → ${baseUrl}/availability

3. Explore Opportunities
   Browse available projects and consulting opportunities that match your expertise.
   → ${baseUrl}/opportunities

Our platform is designed to help you leverage your years of experience in meaningful ways, whether through:
• Consulting projects
• Mentoring roles
• Keynote speaking
• Freelance work
• Project-based engagements

If you have any questions or need assistance getting started, our support team is here to help.

Questions? Contact us at ${supportEmail}

© 2025 LegacyLancers. All rights reserved.`;
  }

  /**
   * Generate password reset email HTML
   * @param {Object} params - Template parameters
   * @returns {string} HTML content
   */
  generatePasswordResetEmailHtml({ firstName, resetUrl, supportEmail }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your LegacyLancers password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #ffc107; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { color: #ffc107; font-size: 24px; font-weight: bold; }
        .button { display: inline-block; padding: 12px 30px; background-color: #ffc107; color: #000; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
        .security { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">LegacyLancers</div>
            <h1 style="color: #ffc107;">🔒 Password Reset</h1>
        </div>
        
        <h2>Hello ${firstName},</h2>
        
        <p>We received a request to reset the password for your LegacyLancers account.</p>
        
        <p>If you requested this password reset, click the button below to create a new password:</p>
        
        <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;"><a href="${resetUrl}">${resetUrl}</a></p>
        
        <div class="warning">
            <strong>Important:</strong> This password reset link will expire in 1 hour for security reasons.
        </div>
        
        <div class="security">
            <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.
        </div>
        
        <p>For your security, we recommend:</p>
        <ul>
            <li>Using a strong, unique password</li>
            <li>Not sharing your password with others</li>
            <li>Enabling two-factor authentication if available</li>
        </ul>
        
        <div class="footer">
            <p>Need help? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a></p>
            <p>&copy; 2025 LegacyLancers. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate password reset email plain text
   * @param {Object} params - Template parameters
   * @returns {string} Plain text content
   */
  generatePasswordResetEmailText({ firstName, resetUrl, supportEmail }) {
    return `🔒 Password Reset - LegacyLancers

Hello ${firstName},

We received a request to reset the password for your LegacyLancers account.

If you requested this password reset, click the link below to create a new password:

${resetUrl}

IMPORTANT: This password reset link will expire in 1 hour for security reasons.

SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.

For your security, we recommend:
• Using a strong, unique password
• Not sharing your password with others
• Enabling two-factor authentication if available

Need help? Contact us at ${supportEmail}

© 2025 LegacyLancers. All rights reserved.`;
  }

  /**
   * Extract verification URL from email HTML (for testing/development)
   * @param {string} html - Email HTML content
   * @returns {string|null} Verification URL
   */
  extractVerificationUrl(html) {
    const match = html.match(/href="([^"]*verify[^"]*)"/i);
    return match ? match[1] : null;
  }

  /**
   * Get sent emails (for testing)
   * @returns {Array} Array of sent emails
   */
  getSentEmails() {
    return this.sentEmails;
  }

  /**
   * Clear sent emails (for testing)
   */
  clearSentEmails() {
    this.sentEmails = [];
  }

  /**
   * Enable/disable failure mode (for testing)
   * @param {boolean} enabled - Whether to enable failure mode
   */
  setFailureMode(enabled) {
    this.failureMode = enabled;
  }

  /**
   * Set delivery delay (for testing)
   * @param {number} delayMs - Delay in milliseconds
   */
  setDeliveryDelay(delayMs) {
    this.deliveryDelayMs = Math.max(0, delayMs);
  }

  /**
   * Reset rate limiting (for testing)
   */
  resetRateLimiting() {
    this.emailCounts.clear();
  }
}

// Export singleton instance
module.exports = {
  EmailService: new EmailService(),
  EmailError
};