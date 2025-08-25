/**
 * OAuth Middleware
 * Additional OAuth-specific middleware for enhanced security and functionality
 */

const { optionalAuthenticate } = require('./auth');
const { OAuthError } = require('../auth/oauth');
const oauthConfig = require('../config/oauth');

/**
 * Enhanced OAuth security middleware for sensitive operations
 */
const oauthSecurityMiddleware = (req, res, next) => {
  try {
    // Validate request origin in production
    if (oauthConfig.isProduction) {
      const origin = req.get('origin');
      const referer = req.get('referer');
      
      if (origin && !isAllowedOrigin(origin)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_ORIGIN',
          message: 'Request origin not allowed'
        });
      }
    }

    // Add CSRF protection headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    next();

  } catch (error) {
    console.error('OAuth security middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'OAUTH_SECURITY_ERROR',
      message: 'OAuth security validation failed'
    });
  }
};

/**
 * Middleware to validate OAuth provider availability and status
 */
const validateProviderStatus = (req, res, next) => {
  try {
    const { provider } = req.params;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PROVIDER',
        message: 'OAuth provider parameter is required'
      });
    }

    const providerConfig = oauthConfig.getProviderConfig(provider);
    
    if (!providerConfig) {
      return res.status(400).json({
        success: false,
        error: 'PROVIDER_NOT_AVAILABLE',
        message: `OAuth provider '${provider}' is not available or disabled`
      });
    }

    // Check provider-specific requirements
    if (provider === 'linkedin' && !providerConfig.clientId) {
      return res.status(503).json({
        success: false,
        error: 'PROVIDER_MISCONFIGURED',
        message: 'LinkedIn OAuth is temporarily unavailable'
      });
    }

    // Add provider info to request
    req.oauthProvider = provider;
    req.oauthProviderConfig = providerConfig;
    
    next();

  } catch (error) {
    console.error('Provider validation error:', error);
    res.status(500).json({
      success: false,
      error: 'PROVIDER_VALIDATION_FAILED',
      message: 'Failed to validate OAuth provider'
    });
  }
};

/**
 * Middleware to handle OAuth state validation with enhanced security
 */
const enhancedStateValidation = (req, res, next) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_STATE',
        message: 'OAuth state parameter is required for security'
      });
    }

    // Validate state format and length
    if (typeof state !== 'string' || state.length !== 64) { // 32 bytes hex = 64 chars
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATE_FORMAT',
        message: 'OAuth state parameter format is invalid'
      });
    }

    // Check for potentially malicious state values
    if (!/^[a-f0-9]+$/i.test(state)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATE_CONTENT',
        message: 'OAuth state parameter contains invalid characters'
      });
    }

    next();

  } catch (error) {
    console.error('Enhanced state validation error:', error);
    res.status(500).json({
      success: false,
      error: 'STATE_VALIDATION_ERROR',
      message: 'Failed to validate OAuth state'
    });
  }
};

/**
 * Middleware to prepare OAuth linking context
 * Checks if user is authenticated and can link accounts
 */
const prepareLinkingContext = [
  optionalAuthenticate,
  (req, res, next) => {
    try {
      const isLinkingRequest = req.path.includes('/link') || req.body.linking === true;
      
      if (isLinkingRequest) {
        // For linking requests, authentication is required
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for account linking'
          });
        }

        // Check if user already has this OAuth provider linked
        // TODO: Implement check against user's linked accounts
        req.isAccountLinking = true;
        req.linkingUserId = req.user.id;
      } else {
        // For new account creation, no authentication required
        req.isAccountLinking = false;
        req.linkingUserId = null;
      }

      next();

    } catch (error) {
      console.error('Linking context preparation error:', error);
      res.status(500).json({
        success: false,
        error: 'LINKING_CONTEXT_ERROR',
        message: 'Failed to prepare account linking context'
      });
    }
  }
];

/**
 * Middleware to validate OAuth callback parameters comprehensively
 */
const validateOAuthCallback = (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth provider errors first
    if (error) {
      const errorMap = {
        'access_denied': 'User denied OAuth authorization',
        'invalid_request': 'Invalid OAuth request parameters',
        'invalid_client': 'Invalid OAuth client configuration',
        'invalid_grant': 'Invalid authorization grant',
        'unauthorized_client': 'OAuth client not authorized',
        'unsupported_grant_type': 'OAuth grant type not supported',
        'invalid_scope': 'Invalid OAuth scope requested'
      };

      const userFriendlyMessage = errorMap[error] || error_description || 'OAuth authentication failed';

      return res.status(400).json({
        success: false,
        error: 'OAUTH_PROVIDER_ERROR',
        message: userFriendlyMessage,
        details: {
          provider_error: error,
          provider_error_description: error_description
        }
      });
    }

    // Validate required success parameters
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AUTHORIZATION_CODE',
        message: 'Authorization code not provided by OAuth provider'
      });
    }

    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_STATE_PARAMETER',
        message: 'State parameter not provided for CSRF protection'
      });
    }

    // Validate authorization code format
    if (typeof code !== 'string' || code.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_AUTHORIZATION_CODE',
        message: 'Authorization code format is invalid'
      });
    }

    // Store validated parameters on request
    req.oauthCallback = {
      code,
      state,
      hasError: false
    };

    next();

  } catch (error) {
    console.error('OAuth callback validation error:', error);
    res.status(500).json({
      success: false,
      error: 'CALLBACK_VALIDATION_ERROR',
      message: 'Failed to validate OAuth callback parameters'
    });
  }
};

/**
 * Middleware to log detailed OAuth events for security monitoring
 */
const detailedOAuthLogger = (eventType) => {
  return (req, res, next) => {
    try {
      const logData = {
        event: eventType,
        timestamp: new Date().toISOString(),
        provider: req.oauthProvider,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID || null,
        userId: req.user?.id || null,
        
        // Security-relevant data
        origin: req.get('origin'),
        referer: req.get('referer'),
        
        // OAuth-specific data
        hasState: !!req.query.state,
        hasCode: !!req.query.code,
        hasError: !!req.query.error,
        isLinking: req.isAccountLinking || false,
        
        // Request metadata
        method: req.method,
        url: req.originalUrl,
        protocol: req.protocol,
        secure: req.secure
      };

      // Add event-specific data
      switch (eventType) {
        case 'oauth_initiate_attempt':
          logData.redirectUrl = req.validatedRedirectURL;
          logData.additionalParams = Object.keys(req.query);
          break;
          
        case 'oauth_callback_received':
          logData.state = req.query.state;
          logData.providerError = req.query.error;
          logData.providerErrorDescription = req.query.error_description;
          break;
          
        case 'oauth_success':
          logData.newUser = req.oauthResult?.isNewUser;
          logData.linkedAccount = req.oauthResult?.linkedAccount;
          break;
          
        case 'oauth_failure':
          logData.errorCode = req.oauthError?.code;
          logData.errorMessage = req.oauthError?.message;
          break;
      }

      // TODO: Replace with structured logging system (e.g., Winston)
      // For production, send to logging service for security monitoring
      console.log('OAuth Security Event:', JSON.stringify(logData));

      next();

    } catch (error) {
      console.error('OAuth logging error:', error);
      // Don't fail the request due to logging errors
      next();
    }
  };
};

/**
 * Check if origin is allowed for OAuth requests
 * @param {string} origin - Request origin
 * @returns {boolean} Whether origin is allowed
 */
function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    const allowedDomains = oauthConfig.oauth.security.allowedRedirectDomains;
    
    return allowedDomains.some(domain => {
      return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
    });
    
  } catch {
    return false;
  }
}

/**
 * Error handler specifically for OAuth middleware errors
 */
const oauthMiddlewareErrorHandler = (error, req, res, next) => {
  if (error instanceof OAuthError) {
    const statusCode = getOAuthErrorStatusCode(error.code);
    
    return res.status(statusCode).json({
      success: false,
      error: error.code,
      message: error.message,
      provider: error.provider || req.oauthProvider,
      timestamp: new Date().toISOString()
    });
  }

  // Pass non-OAuth errors to the next handler
  next(error);
};

/**
 * Get HTTP status code for OAuth error
 * @param {string} errorCode - OAuth error code
 * @returns {number} HTTP status code
 */
function getOAuthErrorStatusCode(errorCode) {
  const statusMap = {
    // Client errors (400)
    'MISSING_PROVIDER': 400,
    'PROVIDER_NOT_AVAILABLE': 400,
    'MISSING_STATE': 400,
    'INVALID_STATE_FORMAT': 400,
    'INVALID_STATE_CONTENT': 400,
    'MISSING_AUTHORIZATION_CODE': 400,
    'INVALID_AUTHORIZATION_CODE': 400,
    'OAUTH_PROVIDER_ERROR': 400,
    'FORBIDDEN_ORIGIN': 403,
    
    // Authentication errors (401)
    'AUTHENTICATION_REQUIRED': 401,
    
    // Server errors (500)
    'PROVIDER_MISCONFIGURED': 503,
    'OAUTH_SECURITY_ERROR': 500,
    'PROVIDER_VALIDATION_FAILED': 500,
    'STATE_VALIDATION_ERROR': 500,
    'LINKING_CONTEXT_ERROR': 500,
    'CALLBACK_VALIDATION_ERROR': 500
  };

  return statusMap[errorCode] || 500;
}

module.exports = {
  oauthSecurityMiddleware,
  validateProviderStatus,
  enhancedStateValidation,
  prepareLinkingContext,
  validateOAuthCallback,
  detailedOAuthLogger,
  oauthMiddlewareErrorHandler
};