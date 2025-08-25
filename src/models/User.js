/**
 * User Model
 * Handles user database operations and business logic
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const validator = require('validator');
const { hashPassword } = require('../auth/password');

class UserError extends Error {
  constructor(message, code = 'USER_ERROR') {
    super(message);
    this.name = 'UserError';
    this.code = code;
  }
}

/**
 * User Model Class
 * For now, using in-memory storage. In production, this would connect to PostgreSQL
 */
class User {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be replaced with database connection
    this.users = new Map();
    this.verificationTokens = new Map();
  }

  /**
   * Create a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - Plain text password
   * @param {string} userData.firstName - User first name
   * @param {string} userData.lastName - User last name
   * @param {string} userData.phone - User phone (optional)
   * @param {boolean} userData.privacyConsent - Privacy consent
   * @param {boolean} userData.marketingConsent - Marketing consent (optional)
   * @returns {Promise<Object>} Created user object
   */
  async create(userData) {
    try {
      // Validate required fields
      const { email, password, firstName, lastName, privacyConsent } = userData;

      if (!email) {
        throw new UserError('Email is required', 'MISSING_EMAIL');
      }

      if (!password) {
        throw new UserError('Password is required', 'MISSING_PASSWORD');
      }

      if (!firstName || firstName.trim() === '') {
        throw new UserError('First name is required', 'MISSING_FIRST_NAME');
      }

      if (!lastName || lastName.trim() === '') {
        throw new UserError('Last name is required', 'MISSING_LAST_NAME');
      }

      if (!privacyConsent) {
        throw new UserError('Privacy consent is required', 'PRIVACY_CONSENT_REQUIRED');
      }

      // Validate email format
      if (!validator.isEmail(email)) {
        throw new UserError('Invalid email format', 'INVALID_EMAIL');
      }

      // Normalize email
      const normalizedEmail = validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_remove_dots: false
      });

      // Check if user already exists
      const existingUser = await this.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new UserError('User with this email already exists', 'USER_EXISTS');
      }

      // Validate names
      if (!validator.isLength(firstName, { min: 1, max: 100 })) {
        throw new UserError('First name must be between 1 and 100 characters', 'INVALID_FIRST_NAME');
      }

      if (!validator.isLength(lastName, { min: 1, max: 100 })) {
        throw new UserError('Last name must be between 1 and 100 characters', 'INVALID_LAST_NAME');
      }

      // Validate phone if provided
      if (userData.phone && !validator.isMobilePhone(userData.phone, 'any', { strictMode: false })) {
        throw new UserError('Invalid phone number format', 'INVALID_PHONE');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user object
      const userId = uuidv4();
      const now = new Date();

      const user = {
        id: userId,
        email: normalizedEmail,
        emailVerified: false,
        passwordHash,
        firstName: this.sanitizeName(firstName),
        lastName: this.sanitizeName(lastName),
        phone: userData.phone ? this.sanitizePhone(userData.phone) : null,
        phoneVerified: false,
        status: 'active',
        role: 'user',
        oauthProvider: null,
        oauthId: null,
        oauthProfiles: [], // Array to store multiple OAuth profiles
        kycStatus: 'pending',
        kycVerifiedAt: null,
        privacyConsent,
        marketingConsent: userData.marketingConsent || false,
        dataRetentionConsent: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };

      // Store user
      this.users.set(userId, user);

      // Create email verification token
      const verificationToken = await this.createEmailVerificationToken(userId);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = user;
      return {
        ...userResponse,
        verificationToken
      };

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to create user: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Find user by email
   * @param {string} email - Email to search for
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findByEmail(email) {
    try {
      const normalizedEmail = validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_remove_dots: false
      });

      for (const user of this.users.values()) {
        if (user.email === normalizedEmail && !user.deletedAt) {
          const { passwordHash: _, ...userResponse } = user;
          return userResponse;
        }
      }

      return null;
    } catch (error) {
      throw new UserError(`Failed to find user by email: ${error.message}`, 'FIND_BY_EMAIL_FAILED');
    }
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID to search for
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findById(userId) {
    try {
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        return null;
      }

      const { passwordHash: _, ...userResponse } = user;
      return userResponse;
    } catch (error) {
      throw new UserError(`Failed to find user by ID: ${error.message}`, 'FIND_BY_ID_FAILED');
    }
  }

  /**
   * Find user with password hash (for authentication)
   * @param {string} email - Email to search for
   * @returns {Promise<Object|null>} User object with password hash or null
   */
  async findByEmailWithPassword(email) {
    try {
      const normalizedEmail = validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_remove_dots: false
      });

      for (const user of this.users.values()) {
        if (user.email === normalizedEmail && !user.deletedAt) {
          return user;
        }
      }

      return null;
    } catch (error) {
      throw new UserError(`Failed to find user by email with password: ${error.message}`, 'FIND_WITH_PASSWORD_FAILED');
    }
  }

  /**
   * Update user
   * @param {string} userId - User ID to update
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated user object
   */
  async update(userId, updateData) {
    try {
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Validate and sanitize update data
      const allowedFields = [
        'firstName', 'lastName', 'phone', 'phoneVerified', 
        'emailVerified', 'status', 'role', 'kycStatus',
        'kycVerifiedAt', 'marketingConsent'
      ];

      const updates = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates[key] = value;
        }
      }

      // Validate specific fields
      if (updates.firstName && !validator.isLength(updates.firstName, { min: 1, max: 100 })) {
        throw new UserError('First name must be between 1 and 100 characters', 'INVALID_FIRST_NAME');
      }

      if (updates.lastName && !validator.isLength(updates.lastName, { min: 1, max: 100 })) {
        throw new UserError('Last name must be between 1 and 100 characters', 'INVALID_LAST_NAME');
      }

      if (updates.phone && !validator.isMobilePhone(updates.phone, 'any', { strictMode: false })) {
        throw new UserError('Invalid phone number format', 'INVALID_PHONE');
      }

      // Apply updates
      const updatedUser = {
        ...user,
        ...updates,
        updatedAt: new Date()
      };

      // Sanitize names if updated
      if (updates.firstName) {
        updatedUser.firstName = this.sanitizeName(updates.firstName);
      }
      if (updates.lastName) {
        updatedUser.lastName = this.sanitizeName(updates.lastName);
      }
      if (updates.phone) {
        updatedUser.phone = this.sanitizePhone(updates.phone);
      }

      this.users.set(userId, updatedUser);

      const { passwordHash: _, ...userResponse } = updatedUser;
      return userResponse;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to update user: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Verify user email
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Updated user object
   */
  async verifyEmail(token) {
    try {
      const tokenData = this.verificationTokens.get(token);
      if (!tokenData) {
        throw new UserError('Invalid or expired verification token', 'INVALID_TOKEN');
      }

      // Check if token is expired
      if (new Date() > tokenData.expiresAt) {
        this.verificationTokens.delete(token);
        throw new UserError('Verification token has expired', 'TOKEN_EXPIRED');
      }

      // Update user email verification status
      const updatedUser = await this.update(tokenData.userId, {
        emailVerified: true
      });

      // Delete the used token
      this.verificationTokens.delete(token);

      return updatedUser;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to verify email: ${error.message}`, 'EMAIL_VERIFICATION_FAILED');
    }
  }

  /**
   * Create email verification token
   * @param {string} userId - User ID
   * @returns {Promise<string>} Verification token
   */
  async createEmailVerificationToken(userId) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiration to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Store token
      this.verificationTokens.set(token, {
        userId,
        email: user.email,
        type: 'email_verification',
        expiresAt,
        createdAt: new Date()
      });

      return token;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to create verification token: ${error.message}`, 'TOKEN_CREATION_FAILED');
    }
  }

  /**
   * Resend email verification token
   * @param {string} email - User email
   * @returns {Promise<string>} New verification token
   */
  async resendEmailVerification(email) {
    try {
      const user = await this.findByEmailWithPassword(email);
      if (!user) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      if (user.emailVerified) {
        throw new UserError('Email is already verified', 'EMAIL_ALREADY_VERIFIED');
      }

      // Clean up old tokens for this user
      for (const [token, tokenData] of this.verificationTokens.entries()) {
        if (tokenData.userId === user.id && tokenData.type === 'email_verification') {
          this.verificationTokens.delete(token);
        }
      }

      // Create new token
      return await this.createEmailVerificationToken(user.id);

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to resend verification: ${error.message}`, 'RESEND_VERIFICATION_FAILED');
    }
  }

  /**
   * Delete user (soft delete)
   * @param {string} userId - User ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async delete(userId) {
    try {
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Soft delete
      const updatedUser = {
        ...user,
        deletedAt: new Date(),
        updatedAt: new Date()
      };

      this.users.set(userId, updatedUser);

      // Clean up verification tokens
      for (const [token, tokenData] of this.verificationTokens.entries()) {
        if (tokenData.userId === userId) {
          this.verificationTokens.delete(token);
        }
      }

      return true;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to delete user: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User statistics
   */
  async getStats() {
    try {
      const stats = {
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        unverifiedUsers: 0,
        deletedUsers: 0,
        kycPendingUsers: 0,
        kycVerifiedUsers: 0
      };

      for (const user of this.users.values()) {
        stats.totalUsers++;

        if (user.deletedAt) {
          stats.deletedUsers++;
        } else {
          stats.activeUsers++;

          if (user.emailVerified) {
            stats.verifiedUsers++;
          } else {
            stats.unverifiedUsers++;
          }

          if (user.kycStatus === 'pending') {
            stats.kycPendingUsers++;
          } else if (user.kycStatus === 'verified') {
            stats.kycVerifiedUsers++;
          }
        }
      }

      return stats;

    } catch (error) {
      throw new UserError(`Failed to get user statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Clean up expired verification tokens
   * @returns {Promise<number>} Number of tokens cleaned up
   */
  async cleanupExpiredTokens() {
    try {
      let cleaned = 0;
      const now = new Date();

      for (const [token, tokenData] of this.verificationTokens.entries()) {
        if (now > tokenData.expiresAt) {
          this.verificationTokens.delete(token);
          cleaned++;
        }
      }

      return cleaned;

    } catch (error) {
      throw new UserError(`Failed to cleanup expired tokens: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  /**
   * Sanitize name input
   * @param {string} name - Name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizeName(name) {
    return validator.escape(validator.trim(name));
  }

  /**
   * Sanitize phone input
   * @param {string} phone - Phone to sanitize
   * @returns {string} Sanitized phone
   */
  sanitizePhone(phone) {
    // Remove all non-numeric characters except + and spaces
    return phone.replace(/[^\d\s+()-]/g, '').trim();
  }

  /**
   * Update user password hash (for password reset)
   * @param {string} userId - User ID
   * @param {string} newPasswordHash - New password hash
   * @returns {Promise<Object>} Updated user object
   */
  async updatePasswordHash(userId, newPasswordHash) {
    try {
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Update password hash and timestamp
      const updatedUser = {
        ...user,
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      };

      this.users.set(userId, updatedUser);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = updatedUser;
      return userResponse;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to update password: ${error.message}`, 'PASSWORD_UPDATE_FAILED');
    }
  }

  /**
   * Find user by OAuth provider and provider ID
   * @param {string} provider - OAuth provider (e.g., 'linkedin')
   * @param {string} providerId - Provider-specific user ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findByOAuthProvider(provider, providerId) {
    try {
      if (!provider) {
        throw new UserError('OAuth provider is required', 'MISSING_PROVIDER');
      }

      if (!providerId) {
        throw new UserError('OAuth provider ID is required', 'MISSING_PROVIDER_ID');
      }

      for (const user of this.users.values()) {
        if (user.deletedAt) continue;

        // Check primary OAuth provider (legacy compatibility)
        if (user.oauthProvider === provider && user.oauthId === providerId) {
          const { passwordHash: _, ...userResponse } = user;
          return userResponse;
        }

        // Check OAuth profiles array
        if (user.oauthProfiles && user.oauthProfiles.length > 0) {
          const hasProfile = user.oauthProfiles.some(profile => 
            profile.provider === provider && profile.providerId === providerId
          );
          
          if (hasProfile) {
            const { passwordHash: _, ...userResponse } = user;
            return userResponse;
          }
        }
      }

      return null;
    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to find user by OAuth provider: ${error.message}`, 'OAUTH_FIND_FAILED');
    }
  }

  /**
   * Create user from OAuth profile
   * @param {string} provider - OAuth provider
   * @param {Object} oauthProfile - OAuth profile data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Created user object
   */
  async createFromOAuth(provider, oauthProfile, options = {}) {
    try {
      if (!provider) {
        throw new UserError('OAuth provider is required', 'MISSING_PROVIDER');
      }

      if (!oauthProfile) {
        throw new UserError('OAuth profile is required', 'MISSING_OAUTH_PROFILE');
      }

      if (!oauthProfile.email) {
        throw new UserError('Email is required in OAuth profile', 'MISSING_EMAIL');
      }

      if (!oauthProfile.id) {
        throw new UserError('Provider ID is required in OAuth profile', 'MISSING_PROVIDER_ID');
      }

      // Validate email format
      if (!validator.isEmail(oauthProfile.email)) {
        throw new UserError('Invalid email format in OAuth profile', 'INVALID_EMAIL');
      }

      // Normalize email
      const normalizedEmail = validator.normalizeEmail(oauthProfile.email, {
        all_lowercase: true,
        gmail_remove_dots: false
      });

      // Check if user already exists with this email
      const existingUser = await this.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new UserError('User with this email already exists', 'USER_EXISTS');
      }

      // Check if OAuth profile is already linked
      const existingOAuthUser = await this.findByOAuthProvider(provider, oauthProfile.id);
      if (existingOAuthUser) {
        throw new UserError('OAuth profile is already linked to another account', 'OAUTH_PROFILE_EXISTS');
      }

      // Create user object
      const userId = uuidv4();
      const now = new Date();

      // Sanitize names from OAuth profile
      const firstName = oauthProfile.firstName ? this.sanitizeName(oauthProfile.firstName) : '';
      const lastName = oauthProfile.lastName ? this.sanitizeName(oauthProfile.lastName) : '';

      // Create OAuth profile object
      const oauthProfileData = {
        provider,
        providerId: oauthProfile.id,
        email: normalizedEmail,
        firstName,
        lastName,
        profilePicture: oauthProfile.profilePicture || null,
        headline: oauthProfile.headline || null,
        profileURL: oauthProfile.providerURL || null,
        rawData: oauthProfile.raw || {},
        linkedAt: now,
        lastSyncAt: now
      };

      const user = {
        id: userId,
        email: normalizedEmail,
        emailVerified: true, // OAuth emails are considered verified
        passwordHash: null, // OAuth users don't have passwords initially
        firstName,
        lastName,
        phone: null,
        phoneVerified: false,
        status: 'active',
        role: options.role || 'user',
        oauthProvider: provider, // Primary OAuth provider (legacy)
        oauthId: oauthProfile.id, // Primary OAuth ID (legacy)
        oauthProfiles: [oauthProfileData], // New OAuth profiles array
        kycStatus: 'pending',
        kycVerifiedAt: null,
        privacyConsent: true, // Assumed when using OAuth
        marketingConsent: options.marketingConsent || false,
        dataRetentionConsent: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };

      // Store user
      this.users.set(userId, user);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = user;
      return {
        ...userResponse,
        isNewUser: true
      };

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to create user from OAuth: ${error.message}`, 'OAUTH_CREATE_FAILED');
    }
  }

  /**
   * Link OAuth profile to existing user
   * @param {string} userId - User ID to link profile to
   * @param {string} provider - OAuth provider
   * @param {Object} oauthProfile - OAuth profile data
   * @returns {Promise<Object>} Updated user object
   */
  async linkOAuthProfile(userId, provider, oauthProfile) {
    try {
      if (!userId) {
        throw new UserError('User ID is required', 'MISSING_USER_ID');
      }

      if (!provider) {
        throw new UserError('OAuth provider is required', 'MISSING_PROVIDER');
      }

      if (!oauthProfile) {
        throw new UserError('OAuth profile is required', 'MISSING_OAUTH_PROFILE');
      }

      if (!oauthProfile.id) {
        throw new UserError('Provider ID is required in OAuth profile', 'MISSING_PROVIDER_ID');
      }

      // Get user
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Check if OAuth profile is already linked to this user
      const existingProfile = user.oauthProfiles?.find(profile => 
        profile.provider === provider && profile.providerId === oauthProfile.id
      );

      if (existingProfile) {
        throw new UserError('OAuth profile is already linked to this account', 'OAUTH_PROFILE_ALREADY_LINKED');
      }

      // Check if OAuth profile is linked to another user
      const existingOAuthUser = await this.findByOAuthProvider(provider, oauthProfile.id);
      if (existingOAuthUser && existingOAuthUser.id !== userId) {
        throw new UserError('OAuth profile is already linked to another account', 'OAUTH_PROFILE_EXISTS');
      }

      // Create OAuth profile object
      const now = new Date();
      const oauthProfileData = {
        provider,
        providerId: oauthProfile.id,
        email: oauthProfile.email,
        firstName: oauthProfile.firstName ? this.sanitizeName(oauthProfile.firstName) : '',
        lastName: oauthProfile.lastName ? this.sanitizeName(oauthProfile.lastName) : '',
        profilePicture: oauthProfile.profilePicture || null,
        headline: oauthProfile.headline || null,
        profileURL: oauthProfile.providerURL || null,
        rawData: oauthProfile.raw || {},
        linkedAt: now,
        lastSyncAt: now
      };

      // Initialize oauthProfiles array if it doesn't exist
      if (!user.oauthProfiles) {
        user.oauthProfiles = [];
      }

      // Add OAuth profile
      user.oauthProfiles.push(oauthProfileData);

      // Update legacy fields if this is the first OAuth profile
      if (!user.oauthProvider && !user.oauthId) {
        user.oauthProvider = provider;
        user.oauthId = oauthProfile.id;
      }

      // Update user
      const updatedUser = {
        ...user,
        updatedAt: now
      };

      this.users.set(userId, updatedUser);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = updatedUser;
      return userResponse;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to link OAuth profile: ${error.message}`, 'OAUTH_LINK_FAILED');
    }
  }

  /**
   * Unlink OAuth profile from user
   * @param {string} userId - User ID
   * @param {string} provider - OAuth provider
   * @param {string} providerId - Provider-specific user ID
   * @returns {Promise<Object>} Updated user object
   */
  async unlinkOAuthProfile(userId, provider, providerId) {
    try {
      if (!userId) {
        throw new UserError('User ID is required', 'MISSING_USER_ID');
      }

      if (!provider) {
        throw new UserError('OAuth provider is required', 'MISSING_PROVIDER');
      }

      if (!providerId) {
        throw new UserError('OAuth provider ID is required', 'MISSING_PROVIDER_ID');
      }

      // Get user
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Find and remove OAuth profile
      if (!user.oauthProfiles) {
        user.oauthProfiles = [];
      }

      const profileIndex = user.oauthProfiles.findIndex(profile => 
        profile.provider === provider && profile.providerId === providerId
      );

      if (profileIndex === -1) {
        throw new UserError('OAuth profile not found on this account', 'OAUTH_PROFILE_NOT_FOUND');
      }

      // Check if user would have no password after unlinking
      if (!user.passwordHash && user.oauthProfiles.length === 1) {
        throw new UserError('Cannot unlink last OAuth profile without setting a password', 'LAST_AUTH_METHOD');
      }

      // Remove OAuth profile
      user.oauthProfiles.splice(profileIndex, 1);

      // Update legacy fields if this was the primary OAuth provider
      if (user.oauthProvider === provider && user.oauthId === providerId) {
        if (user.oauthProfiles.length > 0) {
          // Set to first remaining OAuth profile
          user.oauthProvider = user.oauthProfiles[0].provider;
          user.oauthId = user.oauthProfiles[0].providerId;
        } else {
          // Clear legacy fields
          user.oauthProvider = null;
          user.oauthId = null;
        }
      }

      // Update user
      const now = new Date();
      const updatedUser = {
        ...user,
        updatedAt: now
      };

      this.users.set(userId, updatedUser);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = updatedUser;
      return userResponse;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to unlink OAuth profile: ${error.message}`, 'OAUTH_UNLINK_FAILED');
    }
  }

  /**
   * Get user's OAuth profiles
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of OAuth profiles
   */
  async getOAuthProfiles(userId) {
    try {
      if (!userId) {
        throw new UserError('User ID is required', 'MISSING_USER_ID');
      }

      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      return user.oauthProfiles || [];

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to get OAuth profiles: ${error.message}`, 'OAUTH_PROFILES_FAILED');
    }
  }

  /**
   * Update OAuth profile data (for syncing)
   * @param {string} userId - User ID
   * @param {string} provider - OAuth provider
   * @param {string} providerId - Provider-specific user ID
   * @param {Object} profileData - Updated profile data
   * @returns {Promise<Object>} Updated user object
   */
  async updateOAuthProfile(userId, provider, providerId, profileData) {
    try {
      if (!userId) {
        throw new UserError('User ID is required', 'MISSING_USER_ID');
      }

      if (!provider) {
        throw new UserError('OAuth provider is required', 'MISSING_PROVIDER');
      }

      if (!providerId) {
        throw new UserError('OAuth provider ID is required', 'MISSING_PROVIDER_ID');
      }

      // Get user
      const user = this.users.get(userId);
      if (!user || user.deletedAt) {
        throw new UserError('User not found', 'USER_NOT_FOUND');
      }

      // Find OAuth profile
      if (!user.oauthProfiles) {
        user.oauthProfiles = [];
      }

      const profileIndex = user.oauthProfiles.findIndex(profile => 
        profile.provider === provider && profile.providerId === providerId
      );

      if (profileIndex === -1) {
        throw new UserError('OAuth profile not found on this account', 'OAUTH_PROFILE_NOT_FOUND');
      }

      // Update profile data
      const now = new Date();
      const currentProfile = user.oauthProfiles[profileIndex];
      
      user.oauthProfiles[profileIndex] = {
        ...currentProfile,
        firstName: profileData.firstName ? this.sanitizeName(profileData.firstName) : currentProfile.firstName,
        lastName: profileData.lastName ? this.sanitizeName(profileData.lastName) : currentProfile.lastName,
        profilePicture: profileData.profilePicture || currentProfile.profilePicture,
        headline: profileData.headline || currentProfile.headline,
        profileURL: profileData.profileURL || currentProfile.profileURL,
        rawData: profileData.rawData || currentProfile.rawData,
        lastSyncAt: now
      };

      // Update user
      const updatedUser = {
        ...user,
        updatedAt: now
      };

      this.users.set(userId, updatedUser);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = updatedUser;
      return userResponse;

    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }
      throw new UserError(`Failed to update OAuth profile: ${error.message}`, 'OAUTH_UPDATE_FAILED');
    }
  }

  /**
   * Reset all data (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    this.users.clear();
    this.verificationTokens.clear();
  }
}

// Export singleton instance
module.exports = {
  User: new User(),
  UserError
};