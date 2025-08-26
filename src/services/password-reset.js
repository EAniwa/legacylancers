/**
 * Password Reset Service
 * Handles secure password reset workflow with verification codes
 */

const crypto = require('crypto');
const validator = require('validator');
const { hashPassword } = require('../auth/password');
const { User, UserError } = require('../models/User');
const { EmailService, EmailError } = require('./email');

class PasswordResetError extends Error {
  constructor(message, code = 'PASSWORD_RESET_ERROR') {
    super(message);
    this.name = 'PasswordResetError';
    this.code = code;
  }
}

/**
 * Password Reset Service Class
 * Manages the complete password reset workflow
 */
class PasswordResetService {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be stored in Redis or database
    this.resetTokens = new Map();
    this.resetAttempts = new Map(); // Track reset attempts per email/IP
    
    // Configuration
    this.config = {
      // Token expires in 1 hour for security
      tokenExpirationMs: 60 * 60 * 1000,
      // Maximum reset attempts per email per hour
      maxAttemptsPerHour: 3,
      // Maximum reset attempts per IP per hour
      maxAttemptsPerIPPerHour: 10,
      // Minimum time between reset requests from same email (in minutes)
      minTimeBetweenRequests: 5,
      // Use secure random tokens
      tokenLength: 32
    };
  }

  /**
   * Initiate password reset process
   * @param {string} email - User email address
   * @param {string} clientIP - Client IP address for rate limiting
   * @returns {Promise<Object>} Reset initiation result
   */
  async initiatePasswordReset(email, clientIP) {
    try {
      // Validate email format
      if (!email || !validator.isEmail(email)) {
        throw new PasswordResetError('Valid email address is required', 'INVALID_EMAIL');
      }

      // Normalize email
      const normalizedEmail = validator.normalizeEmail(email);

      // Check rate limits
      await this.checkRateLimits(normalizedEmail, clientIP);

      // Find user by email
      const user = await User.findByEmail(normalizedEmail);
      
      // Security: Don't reveal whether email exists or not
      // Always proceed as if the email exists to prevent email enumeration
      if (!user) {
        // Log the attempt for security monitoring
        console.warn('Password reset attempted for non-existent email:', {
          email: normalizedEmail,
          ip: clientIP,
          timestamp: new Date().toISOString()
        });
        
        // Return success to prevent email enumeration
        return {
          success: true,
          message: 'If this email address exists in our system, you will receive password reset instructions.',
          emailSent: false
        };
      }

      // Check if account is active
      if (user.status !== 'active') {
        console.warn('Password reset attempted for inactive account:', {
          userId: user.id,
          email: user.email,
          status: user.status,
          ip: clientIP,
          timestamp: new Date().toISOString()
        });
        
        // Return generic message for security
        return {
          success: true,
          message: 'If this email address exists in our system, you will receive password reset instructions.',
          emailSent: false
        };
      }

      // Check if email is verified
      if (!user.emailVerified) {
        throw new PasswordResetError('Please verify your email address before resetting your password', 'EMAIL_NOT_VERIFIED');
      }

      // Generate secure reset token
      const resetToken = await this.generateResetToken(user.id, normalizedEmail);

      // Send password reset email
      const emailResult = await EmailService.sendPasswordResetEmail({
        email: user.email,
        firstName: user.firstName,
        resetToken
      });

      // Update rate limiting counters
      await this.updateRateLimits(normalizedEmail, clientIP);

      // Log successful password reset initiation
      console.info('Password reset initiated:', {
        userId: user.id,
        email: user.email,
        ip: clientIP,
        messageId: emailResult.messageId,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email address.',
        emailSent: true,
        expiresIn: this.config.tokenExpirationMs / 1000 / 60 // minutes
      };

    } catch (error) {
      if (error instanceof PasswordResetError) {
        throw error;
      }
      if (error instanceof EmailError) {
        throw new PasswordResetError(`Failed to initiate password reset: ${error.message}`, 'EMAIL_SERVICE_ERROR');
      }
      throw new PasswordResetError(`Failed to initiate password reset: ${error.message}`, 'INITIATE_FAILED');
    }
  }

  /**
   * Verify password reset token
   * @param {string} token - Reset token
   * @returns {Promise<Object>} Token verification result
   */
  async verifyResetToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        throw new PasswordResetError('Reset token is required', 'MISSING_TOKEN');
      }

      // Find token data
      const tokenData = this.resetTokens.get(token);
      if (!tokenData) {
        throw new PasswordResetError('Invalid or expired reset token', 'INVALID_TOKEN');
      }

      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        // Clean up expired token
        this.resetTokens.delete(token);
        throw new PasswordResetError('Reset token has expired. Please request a new password reset.', 'TOKEN_EXPIRED');
      }

      // Verify user still exists and is active
      const user = await User.findById(tokenData.userId);
      if (!user) {
        this.resetTokens.delete(token);
        throw new PasswordResetError('Invalid reset token', 'INVALID_TOKEN');
      }

      if (user.status !== 'active') {
        this.resetTokens.delete(token);
        throw new PasswordResetError('Account is not active', 'ACCOUNT_INACTIVE');
      }

      return {
        success: true,
        valid: true,
        userId: tokenData.userId,
        email: tokenData.email,
        expiresAt: tokenData.expiresAt
      };

    } catch (error) {
      if (error instanceof PasswordResetError) {
        throw error;
      }
      throw new PasswordResetError(`Failed to verify reset token: ${error.message}`, 'VERIFY_TOKEN_FAILED');
    }
  }

  /**
   * Complete password reset with new password
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @param {string} clientIP - Client IP address
   * @returns {Promise<Object>} Reset completion result
   */
  async completePasswordReset(token, newPassword, clientIP) {
    try {
      if (!token || typeof token !== 'string') {
        throw new PasswordResetError('Reset token is required', 'MISSING_TOKEN');
      }

      if (!newPassword || typeof newPassword !== 'string') {
        throw new PasswordResetError('New password is required', 'MISSING_PASSWORD');
      }

      // Verify the reset token
      const tokenVerification = await this.verifyResetToken(token);
      
      // Get token data
      const tokenData = this.resetTokens.get(token);
      if (!tokenData) {
        throw new PasswordResetError('Invalid reset token', 'INVALID_TOKEN');
      }

      // Hash the new password (this also validates password requirements)
      const newPasswordHash = await hashPassword(newPassword);

      // Update user's password using the dedicated method
      const user = await User.updatePasswordHash(tokenData.userId, newPasswordHash);

      // Delete the used reset token
      this.resetTokens.delete(token);

      // Clean up any other reset tokens for this user
      for (const [otherToken, otherTokenData] of this.resetTokens.entries()) {
        if (otherTokenData.userId === tokenData.userId) {
          this.resetTokens.delete(otherToken);
        }
      }

      // Log successful password reset
      console.info('Password reset completed:', {
        userId: tokenData.userId,
        email: tokenData.email,
        ip: clientIP,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
        userId: tokenData.userId
      };

    } catch (error) {
      if (error instanceof PasswordResetError) {
        throw error;
      }
      throw new PasswordResetError(`Failed to complete password reset: ${error.message}`, 'COMPLETE_RESET_FAILED');
    }
  }

  /**
   * Generate secure reset token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {Promise<string>} Generated reset token
   */
  async generateResetToken(userId, email) {
    try {
      // Clean up any existing tokens for this user
      for (const [existingToken, tokenData] of this.resetTokens.entries()) {
        if (tokenData.userId === userId) {
          this.resetTokens.delete(existingToken);
        }
      }

      // Generate cryptographically secure random token
      const tokenBuffer = crypto.randomBytes(this.config.tokenLength);
      const token = tokenBuffer.toString('hex');

      // Set expiration time
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + this.config.tokenExpirationMs);

      // Store token data
      const tokenData = {
        userId,
        email,
        type: 'password_reset',
        createdAt: new Date(),
        expiresAt,
        used: false
      };

      this.resetTokens.set(token, tokenData);

      return token;

    } catch (error) {
      throw new PasswordResetError(`Failed to generate reset token: ${error.message}`, 'TOKEN_GENERATION_FAILED');
    }
  }

  /**
   * Check rate limits for password reset requests
   * @param {string} email - Email address
   * @param {string} clientIP - Client IP address
   */
  async checkRateLimits(email, clientIP) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check email-based rate limiting
    const emailKey = `email:${email}`;
    const emailAttempts = this.resetAttempts.get(emailKey) || [];
    const recentEmailAttempts = emailAttempts.filter(timestamp => timestamp > oneHourAgo);

    if (recentEmailAttempts.length >= this.config.maxAttemptsPerHour) {
      throw new PasswordResetError('Too many password reset attempts. Please try again later.', 'RATE_LIMIT_EMAIL_EXCEEDED');
    }

    // Check for minimum time between requests from same email
    if (recentEmailAttempts.length > 0) {
      const lastAttempt = Math.max(...recentEmailAttempts.map(date => date.getTime()));
      const minWaitTime = this.config.minTimeBetweenRequests * 60 * 1000;
      
      if (now.getTime() - lastAttempt < minWaitTime) {
        const remainingWait = Math.ceil((minWaitTime - (now.getTime() - lastAttempt)) / 1000 / 60);
        throw new PasswordResetError(`Please wait ${remainingWait} minutes before requesting another password reset.`, 'RATE_LIMIT_TOO_SOON');
      }
    }

    // Check IP-based rate limiting
    const ipKey = `ip:${clientIP}`;
    const ipAttempts = this.resetAttempts.get(ipKey) || [];
    const recentIPAttempts = ipAttempts.filter(timestamp => timestamp > oneHourAgo);

    if (recentIPAttempts.length >= this.config.maxAttemptsPerIPPerHour) {
      throw new PasswordResetError('Too many password reset attempts from your location. Please try again later.', 'RATE_LIMIT_IP_EXCEEDED');
    }
  }

  /**
   * Update rate limiting counters
   * @param {string} email - Email address
   * @param {string} clientIP - Client IP address
   */
  async updateRateLimits(email, clientIP) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Update email attempts
    const emailKey = `email:${email}`;
    const emailAttempts = this.resetAttempts.get(emailKey) || [];
    const filteredEmailAttempts = emailAttempts.filter(timestamp => timestamp > oneHourAgo);
    filteredEmailAttempts.push(now);
    this.resetAttempts.set(emailKey, filteredEmailAttempts);

    // Update IP attempts
    const ipKey = `ip:${clientIP}`;
    const ipAttempts = this.resetAttempts.get(ipKey) || [];
    const filteredIPAttempts = ipAttempts.filter(timestamp => timestamp > oneHourAgo);
    filteredIPAttempts.push(now);
    this.resetAttempts.set(ipKey, filteredIPAttempts);
  }

  /**
   * Clean up expired tokens and old rate limit data
   * @returns {Promise<Object>} Cleanup statistics
   */
  async cleanup() {
    try {
      const now = new Date();
      let expiredTokens = 0;
      let expiredAttempts = 0;

      // Clean up expired tokens
      for (const [token, tokenData] of this.resetTokens.entries()) {
        if (now > tokenData.expiresAt) {
          this.resetTokens.delete(token);
          expiredTokens++;
        }
      }

      // Clean up old rate limit data (older than 24 hours)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      for (const [key, attempts] of this.resetAttempts.entries()) {
        const filteredAttempts = attempts.filter(timestamp => timestamp > oneDayAgo);
        if (filteredAttempts.length === 0) {
          this.resetAttempts.delete(key);
          expiredAttempts++;
        } else if (filteredAttempts.length !== attempts.length) {
          this.resetAttempts.set(key, filteredAttempts);
        }
      }

      return {
        expiredTokens,
        expiredAttempts,
        activeTokens: this.resetTokens.size,
        activeRateLimits: this.resetAttempts.size
      };

    } catch (error) {
      throw new PasswordResetError(`Cleanup failed: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  /**
   * Get password reset statistics (for monitoring)
   * @returns {Promise<Object>} Service statistics
   */
  async getStats() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let activeTokens = 0;
      let expiredTokens = 0;
      let recentRequests = 0;
      let todayRequests = 0;

      // Count tokens
      for (const tokenData of this.resetTokens.values()) {
        if (now > tokenData.expiresAt) {
          expiredTokens++;
        } else {
          activeTokens++;
        }
      }

      // Count requests
      for (const attempts of this.resetAttempts.values()) {
        const recentAttempts = attempts.filter(timestamp => timestamp > oneHourAgo);
        const todayAttempts = attempts.filter(timestamp => timestamp > oneDayAgo);
        recentRequests += recentAttempts.length;
        todayRequests += todayAttempts.length;
      }

      return {
        activeTokens,
        expiredTokens,
        recentRequests,
        todayRequests,
        totalRateLimitEntries: this.resetAttempts.size,
        config: {
          tokenExpirationMinutes: this.config.tokenExpirationMs / 1000 / 60,
          maxAttemptsPerHour: this.config.maxAttemptsPerHour,
          maxAttemptsPerIPPerHour: this.config.maxAttemptsPerIPPerHour,
          minTimeBetweenRequestsMinutes: this.config.minTimeBetweenRequests
        }
      };

    } catch (error) {
      throw new PasswordResetError(`Failed to get statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Reset all data (for testing)
   */
  async reset() {
    this.resetTokens.clear();
    this.resetAttempts.clear();
  }
}

// Export singleton instance
module.exports = {
  PasswordResetService: new PasswordResetService(),
  PasswordResetError
};