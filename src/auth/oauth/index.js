/**
 * OAuth 2.0 Core Utilities
 * Main OAuth framework with extensible provider support
 */

const crypto = require('crypto');
const oauthConfig = require('../../config/oauth');
const jwt = require('../jwt');
const stateManager = require('./state');
const { User } = require('../../models/User');

class OAuthError extends Error {
  constructor(message, code = 'OAUTH_ERROR', provider = null) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
    this.provider = provider;
  }
}

/**
 * OAuth Framework Core Class
 */
class OAuth {
  constructor() {
    this.providers = new Map();
    this.stateManager = stateManager;
  }

  /**
   * Register an OAuth provider
   * @param {string} providerKey - Provider identifier (e.g., 'linkedin')
   * @param {Object} providerInstance - Provider implementation
   */
  registerProvider(providerKey, providerInstance) {
    if (!providerKey || typeof providerKey !== 'string') {
      throw new OAuthError('Provider key must be a non-empty string', 'INVALID_PROVIDER_KEY');
    }

    if (!providerInstance || typeof providerInstance !== 'object') {
      throw new OAuthError('Provider instance must be an object', 'INVALID_PROVIDER_INSTANCE');
    }

    // Validate provider interface
    const requiredMethods = ['getAuthorizationURL', 'handleCallback', 'getProfile'];
    for (const method of requiredMethods) {
      if (typeof providerInstance[method] !== 'function') {
        throw new OAuthError(
          `Provider must implement ${method} method`,
          'INVALID_PROVIDER_INTERFACE',
          providerKey
        );
      }
    }

    this.providers.set(providerKey, providerInstance);
  }

  /**
   * Get registered provider
   * @param {string} providerKey - Provider identifier
   * @returns {Object} Provider instance
   */
  getProvider(providerKey) {
    const provider = this.providers.get(providerKey);
    if (!provider) {
      throw new OAuthError(`Provider ${providerKey} not found`, 'PROVIDER_NOT_FOUND', providerKey);
    }
    return provider;
  }

  /**
   * Get list of available providers
   * @returns {Array} Array of provider information
   */
  getAvailableProviders() {
    return oauthConfig.getEnabledProviders().filter(provider => 
      this.providers.has(provider.key)
    );
  }

  /**
   * Initiate OAuth flow for a provider
   * @param {string} providerKey - Provider identifier
   * @param {Object} options - OAuth options
   * @param {string} options.redirectURL - Post-auth redirect URL
   * @param {string} options.userId - User ID if linking account
   * @param {Object} options.additionalParams - Additional OAuth parameters
   * @returns {Object} Authorization URL and state
   */
  async initiateOAuth(providerKey, options = {}) {
    try {
      const provider = this.getProvider(providerKey);
      const providerConfig = oauthConfig.getProviderConfig(providerKey);
      
      if (!providerConfig) {
        throw new OAuthError(
          `Provider ${providerKey} is not configured or enabled`,
          'PROVIDER_NOT_CONFIGURED',
          providerKey
        );
      }

      // Generate and store state
      const state = await this.stateManager.createState({
        provider: providerKey,
        redirectURL: options.redirectURL || oauthConfig.redirects.success,
        userId: options.userId || null,
        timestamp: Date.now()
      });

      // Get authorization URL from provider
      const authorizationURL = await provider.getAuthorizationURL(state, {
        ...options.additionalParams
      });

      return {
        authorizationURL,
        state,
        provider: providerKey
      };

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to initiate OAuth: ${error.message}`,
        'INITIATION_FAILED',
        providerKey
      );
    }
  }

  /**
   * Handle OAuth callback
   * @param {string} providerKey - Provider identifier
   * @param {Object} callbackParams - OAuth callback parameters
   * @param {string} callbackParams.code - Authorization code
   * @param {string} callbackParams.state - OAuth state
   * @param {string} callbackParams.error - OAuth error (if any)
   * @returns {Object} OAuth result with tokens and profile
   */
  async handleCallback(providerKey, callbackParams) {
    try {
      const { code, state, error } = callbackParams;

      // Handle OAuth error responses
      if (error) {
        throw new OAuthError(
          `OAuth provider returned error: ${error}`,
          'PROVIDER_ERROR',
          providerKey
        );
      }

      if (!code) {
        throw new OAuthError(
          'Authorization code not provided',
          'MISSING_AUTHORIZATION_CODE',
          providerKey
        );
      }

      if (!state) {
        throw new OAuthError(
          'State parameter not provided',
          'MISSING_STATE',
          providerKey
        );
      }

      // Validate and consume state
      const stateData = await this.stateManager.validateAndConsumeState(state);
      
      if (stateData.provider !== providerKey) {
        throw new OAuthError(
          'State provider mismatch',
          'STATE_PROVIDER_MISMATCH',
          providerKey
        );
      }

      // Get provider and handle callback
      const provider = this.getProvider(providerKey);
      const tokens = await provider.handleCallback(code, state);
      
      // Get user profile
      const profile = await provider.getProfile(tokens.accessToken);

      return {
        success: true,
        provider: providerKey,
        tokens,
        profile,
        stateData,
        linkedUserId: stateData.userId
      };

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to handle OAuth callback: ${error.message}`,
        'CALLBACK_FAILED',
        providerKey
      );
    }
  }

  /**
   * Link OAuth profile to existing user account
   * @param {string} userId - User ID to link profile to
   * @param {string} provider - OAuth provider
   * @param {Object} oauthProfile - OAuth profile data
   * @param {Object} tokens - OAuth tokens
   * @returns {Object} Linking result
   */
  async linkProfileToUser(userId, provider, oauthProfile, tokens) {
    try {
      if (!userId) {
        throw new OAuthError('User ID is required for profile linking', 'MISSING_USER_ID');
      }

      if (!provider) {
        throw new OAuthError('Provider is required for profile linking', 'MISSING_PROVIDER');
      }

      if (!oauthProfile) {
        throw new OAuthError('OAuth profile is required for linking', 'MISSING_PROFILE');
      }

      // Link OAuth profile to user using User model
      const linkedUser = await User.linkOAuthProfile(userId, provider, oauthProfile);

      // Generate JWT tokens for the linked user
      const jwtTokens = jwt.generateTokenPair({
        userId: linkedUser.id,
        email: linkedUser.email,
        role: linkedUser.role,
        emailVerified: linkedUser.emailVerified,
        kycStatus: linkedUser.kycStatus
      });

      return {
        success: true,
        user: linkedUser,
        tokens: jwtTokens,
        provider,
        profileId: oauthProfile.id,
        email: oauthProfile.email,
        linkedAt: new Date().toISOString(),
        isNewUser: false,
        linkedAccount: true
      };

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to link profile: ${error.message}`,
        'LINKING_FAILED'
      );
    }
  }

  /**
   * Create or update user from OAuth profile
   * @param {string} provider - OAuth provider
   * @param {Object} oauthProfile - OAuth profile data
   * @param {Object} tokens - OAuth tokens
   * @returns {Object} User creation/update result
   */
  async createOrUpdateUser(provider, oauthProfile, tokens) {
    try {
      if (!provider) {
        throw new OAuthError('Provider is required', 'MISSING_PROVIDER');
      }

      if (!oauthProfile) {
        throw new OAuthError('OAuth profile is required', 'MISSING_PROFILE');
      }

      if (!oauthProfile.email) {
        throw new OAuthError('Email is required in OAuth profile', 'MISSING_EMAIL');
      }

      // Check if user already exists with this OAuth profile
      let existingUser = await User.findByOAuthProvider(provider, oauthProfile.id);
      
      if (existingUser) {
        // User exists - update OAuth profile data and return user
        const updatedUser = await User.updateOAuthProfile(
          existingUser.id, 
          provider, 
          oauthProfile.id, 
          {
            firstName: oauthProfile.firstName,
            lastName: oauthProfile.lastName,
            profilePicture: oauthProfile.profilePicture,
            headline: oauthProfile.headline,
            profileURL: oauthProfile.providerURL,
            rawData: oauthProfile.raw
          }
        );

        // Generate JWT tokens for existing user
        const jwtTokens = jwt.generateTokenPair({
          userId: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          emailVerified: updatedUser.emailVerified,
          kycStatus: updatedUser.kycStatus
        });

        return {
          success: true,
          user: updatedUser,
          tokens: jwtTokens,
          isNewUser: false
        };
      }

      // Check if user exists with same email (for potential linking)
      existingUser = await User.findByEmail(oauthProfile.email);
      
      if (existingUser) {
        // User with same email exists - this is a potential account linking scenario
        // For security, we don't automatically link accounts with same email
        // Instead, we require explicit linking through authenticated flow
        throw new OAuthError(
          'An account with this email already exists. Please login to your existing account and link your OAuth profile.',
          'EMAIL_ALREADY_EXISTS',
          provider
        );
      }

      // Create new user from OAuth profile
      const newUser = await User.createFromOAuth(provider, oauthProfile);

      // Generate JWT tokens for new user
      const jwtTokens = jwt.generateTokenPair({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        emailVerified: newUser.emailVerified,
        kycStatus: newUser.kycStatus
      });

      return {
        success: true,
        user: newUser,
        tokens: jwtTokens,
        isNewUser: true
      };

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to create/update user: ${error.message}`,
        'USER_CREATION_FAILED'
      );
    }
  }

  /**
   * Validate OAuth callback request
   * @param {Object} req - Express request object
   * @returns {boolean} Validation result
   */
  validateCallbackRequest(req) {
    const { query } = req;
    
    // Handle OAuth errors first (before checking other parameters)
    if (query.error) {
      const errorMsg = query.error_description || query.error;
      throw new OAuthError(`OAuth error: ${errorMsg}`, 'OAUTH_ERROR');
    }

    // Check for required parameters
    if (!query.state) {
      throw new OAuthError('Missing state parameter', 'MISSING_STATE');
    }

    // Check for authorization code
    if (!query.code) {
      throw new OAuthError('Missing authorization code', 'MISSING_CODE');
    }

    return true;
  }

  /**
   * Get OAuth statistics and health information
   * @returns {Object} OAuth statistics
   */
  getStats() {
    return {
      registeredProviders: Array.from(this.providers.keys()),
      enabledProviders: this.getAvailableProviders().map(p => p.key),
      stateStats: this.stateManager.getStats()
    };
  }
}

// Create singleton instance
const oauth = new OAuth();

module.exports = {
  oauth,
  OAuth,
  OAuthError
};