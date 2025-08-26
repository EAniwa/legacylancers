/**
 * OAuth Middleware
 * Express middleware for OAuth authentication flows and security
 */

const rateLimit = require('express-rate-limit');
const oauthConfig = require('../../config/oauth');
const { OAuthError } = require('./index');

/**
 * Validate OAuth provider middleware
 * Ensures the requested provider is valid and enabled
 */
const validateProvider = (req, res, next) => {
  try {
    const { provider } = req.params;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PROVIDER',
        message: 'OAuth provider is required'
      });
    }

    const providerConfig = oauthConfig.getProviderConfig(provider);
    
    if (!providerConfig) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PROVIDER',
        message: `OAuth provider '${provider}' is not supported or enabled`
      });
    }

    // Add provider config to request for downstream use
    req.oauthProvider = provider;
    req.oauthConfig = providerConfig;
    
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'PROVIDER_VALIDATION_FAILED',
      message: 'Failed to validate OAuth provider'
    });
  }
};

/**
 * Validate OAuth callback middleware
 * Validates OAuth callback parameters and handles errors
 */
const validateCallback = (req, res, next) => {
  try {
    const { query } = req;
    
    // Handle OAuth error responses
    if (query.error) {
      const errorDescription = query.error_description || 'OAuth authentication failed';
      const errorCode = query.error;
      
      return res.status(400).json({
        success: false,
        error: 'OAUTH_PROVIDER_ERROR',
        message: errorDescription,
        details: {
          error: errorCode,
          error_description: errorDescription
        }
      });
    }

    // Check for required parameters
    if (!query.state) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_STATE',
        message: 'OAuth state parameter is missing'
      });
    }

    if (!query.code) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CODE',
        message: 'OAuth authorization code is missing'
      });
    }

    // Validate state format
    if (typeof query.state !== 'string' || query.state.length < 16) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATE',
        message: 'OAuth state parameter is invalid'
      });
    }

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'CALLBACK_VALIDATION_FAILED',
      message: 'Failed to validate OAuth callback'
    });
  }
};

/**
 * Security headers middleware for OAuth routes
 * Applies additional security headers for OAuth flows
 */
const oauthSecurityHeaders = (req, res, next) => {
  // Prevent caching of OAuth responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // Additional security headers for OAuth
  if (oauthConfig.oauth.security.enforceHttps && req.headers['x-forwarded-proto'] !== 'https') {
    return res.status(400).json({
      success: false,
      error: 'HTTPS_REQUIRED',
      message: 'HTTPS is required for OAuth flows'
    });
  }

  next();
};

/**
 * Rate limiting middleware for OAuth initiation
 */
const oauthInitiateRateLimit = rateLimit({
  windowMs: oauthConfig.oauth.rateLimiting.initiate.windowMs,
  max: oauthConfig.oauth.rateLimiting.initiate.max,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: oauthConfig.oauth.rateLimiting.initiate.message
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + User Agent for rate limiting
    return `${req.ip}_${req.get('User-Agent') || 'unknown'}`;
  }
});

/**
 * Rate limiting middleware for OAuth callbacks
 */
const oauthCallbackRateLimit = rateLimit({
  windowMs: oauthConfig.oauth.rateLimiting.callback.windowMs,
  max: oauthConfig.oauth.rateLimiting.callback.max,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: oauthConfig.oauth.rateLimiting.callback.message
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + State for callback rate limiting
    return `${req.ip}_${req.query.state || 'no-state'}`;
  }
});

/**
 * Validate redirect URL middleware
 * Ensures redirect URLs are allowed/safe
 */
const validateRedirectURL = (req, res, next) => {
  try {
    const { redirect_url } = req.query;
    
    if (redirect_url) {
      try {
        const url = new URL(redirect_url);
        const allowedDomains = oauthConfig.oauth.security.allowedRedirectDomains;
        
        // Check if domain is allowed
        const isAllowed = allowedDomains.some(domain => {
          return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
        });
        
        if (!isAllowed) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_REDIRECT_URL',
            message: 'Redirect URL domain is not allowed'
          });
        }
        
        // Store validated redirect URL
        req.validatedRedirectURL = redirect_url;
        
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          error: 'MALFORMED_REDIRECT_URL',
          message: 'Redirect URL is malformed'
        });
      }
    }

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'REDIRECT_VALIDATION_FAILED',
      message: 'Failed to validate redirect URL'
    });
  }
};

/**
 * OAuth error handler middleware
 * Handles OAuth-specific errors and formats responses
 */
const oauthErrorHandler = (error, req, res, next) => {
  if (error instanceof OAuthError) {
    const statusCode = getStatusCodeForOAuthError(error.code);
    
    return res.status(statusCode).json({
      success: false,
      error: error.code,
      message: error.message,
      provider: error.provider || req.oauthProvider
    });
  }

  // Pass non-OAuth errors to the next error handler
  next(error);
};

/**
 * Get appropriate HTTP status code for OAuth error codes
 * @param {string} errorCode - OAuth error code
 * @returns {number} HTTP status code
 */
function getStatusCodeForOAuthError(errorCode) {
  const errorStatusMap = {
    // Client errors (4xx)
    'MISSING_PROVIDER': 400,
    'INVALID_PROVIDER': 400,
    'PROVIDER_NOT_FOUND': 400,
    'PROVIDER_NOT_CONFIGURED': 400,
    'MISSING_STATE': 400,
    'INVALID_STATE': 400,
    'STATE_EXPIRED': 400,
    'STATE_ALREADY_USED': 400,
    'STATE_PROVIDER_MISMATCH': 400,
    'MISSING_CODE': 400,
    'MISSING_AUTHORIZATION_CODE': 400,
    'PROVIDER_ERROR': 400,
    'OAUTH_ERROR': 400,
    'MISSING_EMAIL': 400,
    'INVALID_REDIRECT_URL': 400,
    'MALFORMED_REDIRECT_URL': 400,
    'HTTPS_REQUIRED': 400,
    'MISSING_USER_ID': 400,
    'MISSING_PROFILE': 400,
    
    // Server errors (5xx)
    'INITIATION_FAILED': 500,
    'CALLBACK_FAILED': 500,
    'STATE_CREATION_FAILED': 500,
    'STATE_VALIDATION_FAILED': 500,
    'TOKEN_EXCHANGE_FAILED': 500,
    'PROFILE_FETCH_FAILED': 500,
    'USER_CREATION_FAILED': 500,
    'LINKING_FAILED': 500,
    'OAUTH_ERROR': 500
  };

  return errorStatusMap[errorCode] || 500;
}

/**
 * Log OAuth events middleware
 * Logs OAuth attempts and results for security monitoring
 */
const logOAuthEvent = (eventType) => {
  return (req, res, next) => {
    const logData = {
      event: eventType,
      provider: req.oauthProvider,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      sessionId: req.sessionID || null
    };

    // Add specific data based on event type
    if (eventType === 'oauth_initiate') {
      logData.redirectURL = req.validatedRedirectURL;
    } else if (eventType === 'oauth_callback') {
      logData.state = req.query.state;
      logData.hasError = !!req.query.error;
      logData.error = req.query.error;
    }

    // TODO: Replace with proper logging system
    console.log('OAuth Event:', logData);
    
    next();
  };
};

/**
 * Require authenticated user for account linking
 */
const requireAuthForLinking = (req, res, next) => {
  // This would typically check for a valid JWT token
  // For now, we'll check if there's a user in the request
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required for account linking'
    });
  }

  next();
};

module.exports = {
  validateProvider,
  validateCallback,
  oauthSecurityHeaders,
  oauthInitiateRateLimit,
  oauthCallbackRateLimit,
  validateRedirectURL,
  oauthErrorHandler,
  logOAuthEvent,
  requireAuthForLinking
};