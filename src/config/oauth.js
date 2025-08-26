/**
 * OAuth 2.0 Configuration
 * Centralized configuration for OAuth providers and settings
 */

const crypto = require('crypto');

const config = {
  // General OAuth Settings
  oauth: {
    // State parameter settings for CSRF protection
    stateLength: 32,
    stateExpiryMinutes: 10,
    maxStateCacheSize: 1000,
    
    // OAuth flow settings
    callbackTimeout: 300000, // 5 minutes
    maxRedirectAttempts: 3,
    
    // Rate limiting for OAuth endpoints
    rateLimiting: {
      initiate: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 OAuth initiations per window
        message: 'Too many OAuth attempts, please try again later'
      },
      callback: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // 20 callback attempts per window
        message: 'Too many OAuth callbacks, please try again later'
      }
    },

    // Security settings
    security: {
      enforceHttps: process.env.NODE_ENV === 'production',
      validateState: true,
      validateNonce: false, // LinkedIn doesn't typically use nonce
      maxProfileDataSize: 10 * 1024, // 10KB max profile data
      allowedRedirectDomains: process.env.OAUTH_ALLOWED_DOMAINS ? 
        process.env.OAUTH_ALLOWED_DOMAINS.split(',') : 
        ['localhost', '127.0.0.1']
    }
  },

  // Provider-specific configurations
  providers: {
    linkedin: {
      // Basic OAuth settings
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      
      // OAuth URLs
      authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
      
      // API endpoints
      profileURL: 'https://api.linkedin.com/v2/people/~',
      emailURL: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
      positionsURL: 'https://api.linkedin.com/v2/positions',
      educationURL: 'https://api.linkedin.com/v2/educations',
      skillsURL: 'https://api.linkedin.com/v2/skills',
      
      // OAuth scopes - extended for comprehensive profile import and verification
      scope: 'r_liteprofile r_emailaddress r_basicprofile',
      
      // Response type for authorization code flow
      responseType: 'code',
      
      // Profile field mapping
      profileMapping: {
        id: 'id',
        firstName: 'localizedFirstName',
        lastName: 'localizedLastName',
        profilePicture: 'profilePicture.displayImage~.elements[0].identifiers[0].identifier',
        headline: 'localizedHeadline',
        industry: 'industryV2.localizedName'
      },

      // Callback URL configuration
      callbackURL: process.env.LINKEDIN_CALLBACK_URL || 
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/oauth/linkedin/callback`,

      // Provider-specific settings
      settings: {
        enabled: process.env.LINKEDIN_OAUTH_ENABLED === 'true' || process.env.NODE_ENV !== 'production',
        name: 'LinkedIn',
        displayName: 'LinkedIn',
        icon: 'linkedin',
        color: '#0077B5',
        description: 'Connect with your LinkedIn profile',
        
        // Feature flags - enhanced for verification system
        features: {
          profileImport: true,
          emailVerification: true,
          skillsImport: true, // Now implemented for verification
          positionsImport: true, // Work experience import
          educationImport: true, // Education history import
          verificationWorkflow: true, // LinkedIn verification workflow
          connectionsImport: false // Future feature
        }
      }
    }
  },

  // Default redirect URLs
  redirects: {
    success: process.env.OAUTH_SUCCESS_REDIRECT || '/dashboard',
    error: process.env.OAUTH_ERROR_REDIRECT || '/login?error=oauth_failed',
    cancel: process.env.OAUTH_CANCEL_REDIRECT || '/login?info=oauth_cancelled'
  },

  // Environment checks
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test'
};

/**
 * Validation function to ensure required OAuth configuration is set
 */
function validateOAuthConfig() {
  const errors = [];

  // Validate LinkedIn configuration if enabled
  if (config.providers.linkedin.settings.enabled) {
    if (!config.providers.linkedin.clientId) {
      errors.push('LINKEDIN_CLIENT_ID is required when LinkedIn OAuth is enabled');
    }

    if (!config.providers.linkedin.clientSecret) {
      errors.push('LINKEDIN_CLIENT_SECRET is required when LinkedIn OAuth is enabled');
    }

    if (config.isProduction && !config.providers.linkedin.callbackURL.startsWith('https://')) {
      errors.push('LinkedIn callback URL must use HTTPS in production');
    }

    // Validate client secret length
    if (config.providers.linkedin.clientSecret && 
        config.providers.linkedin.clientSecret.length < 16) {
      errors.push('LINKEDIN_CLIENT_SECRET should be at least 16 characters long');
    }
  }

  // Validate base URL in production
  if (config.isProduction && !process.env.BASE_URL) {
    errors.push('BASE_URL is required in production for OAuth callbacks');
  }

  if (errors.length > 0) {
    throw new Error(`OAuth configuration errors:\n${errors.join('\n')}`);
  }
}

/**
 * Get enabled OAuth providers
 * @returns {Array} Array of enabled provider configurations
 */
function getEnabledProviders() {
  return Object.entries(config.providers)
    .filter(([key, provider]) => provider.settings.enabled)
    .map(([key, provider]) => ({
      key,
      name: provider.settings.name,
      displayName: provider.settings.displayName,
      icon: provider.settings.icon,
      color: provider.settings.color,
      description: provider.settings.description
    }));
}

/**
 * Get provider configuration by key
 * @param {string} providerKey - Provider key (e.g., 'linkedin')
 * @returns {Object|null} Provider configuration or null if not found/enabled
 */
function getProviderConfig(providerKey) {
  const provider = config.providers[providerKey];
  if (!provider || !provider.settings.enabled) {
    return null;
  }
  return provider;
}

/**
 * Generate secure random string for OAuth state/nonce
 * @param {number} length - Length of random string
 * @returns {string} Random string
 */
function generateSecureRandom(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Build authorization URL for a provider
 * @param {string} providerKey - Provider key
 * @param {string} state - OAuth state parameter
 * @param {Object} options - Additional options
 * @returns {string} Authorization URL
 */
function buildAuthorizationURL(providerKey, state, options = {}) {
  const provider = getProviderConfig(providerKey);
  if (!provider) {
    throw new Error(`Provider ${providerKey} not found or not enabled`);
  }

  const params = new URLSearchParams({
    client_id: provider.clientId,
    response_type: provider.responseType,
    scope: provider.scope,
    state: state,
    redirect_uri: provider.callbackURL,
    ...options
  });

  return `${provider.authorizationURL}?${params.toString()}`;
}

// Validate configuration on module load (except in test environment)
if (!config.isTest) {
  validateOAuthConfig();
}

module.exports = {
  ...config,
  validateOAuthConfig,
  getEnabledProviders,
  getProviderConfig,
  generateSecureRandom,
  buildAuthorizationURL
};