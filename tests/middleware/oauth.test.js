/**
 * OAuth Middleware Test Suite
 * Tests for OAuth-specific middleware functions
 */

const {
  oauthSecurityMiddleware,
  validateProviderStatus,
  enhancedStateValidation,
  prepareLinkingContext,
  validateOAuthCallback,
  detailedOAuthLogger,
  oauthMiddlewareErrorHandler
} = require('../../src/middleware/oauth');

// Mock dependencies
jest.mock('../../src/config/oauth', () => ({
  isProduction: false,
  oauth: {
    security: {
      allowedRedirectDomains: ['localhost', 'legacylancers.com']
    }
  },
  getProviderConfig: jest.fn()
}));

jest.mock('../../src/middleware/auth', () => ({
  optionalAuthenticate: jest.fn()
}));

const oauthConfig = require('../../src/config/oauth');
const { optionalAuthenticate } = require('../../src/middleware/auth');

describe('OAuth Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      get: jest.fn(),
      params: {},
      query: {},
      body: {},
      path: '/oauth/linkedin',
      originalUrl: '/api/auth/oauth/linkedin',
      method: 'GET',
      protocol: 'http',
      secure: false,
      user: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('oauthSecurityMiddleware', () => {
    test('should apply security headers and pass to next middleware', () => {
      oauthSecurityMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      expect(mockNext).toHaveBeenCalled();
    });

    test('should validate origin in production mode', () => {
      oauthConfig.isProduction = true;
      mockReq.get.mockReturnValue('https://evil.com');

      oauthSecurityMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'FORBIDDEN_ORIGIN',
        message: 'Request origin not allowed'
      });

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should allow valid origins in production', () => {
      oauthConfig.isProduction = true;
      mockReq.get.mockReturnValue('https://legacylancers.com');

      oauthSecurityMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle security validation errors', () => {
      mockReq.get.mockImplementation(() => {
        throw new Error('Header error');
      });

      oauthSecurityMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'OAUTH_SECURITY_ERROR',
        message: 'OAuth security validation failed'
      });
    });
  });

  describe('validateProviderStatus', () => {
    test('should validate and add provider info to request', () => {
      mockReq.params.provider = 'linkedin';
      const mockProviderConfig = {
        clientId: 'test-client-id',
        settings: { enabled: true }
      };

      oauthConfig.getProviderConfig.mockReturnValue(mockProviderConfig);

      validateProviderStatus(mockReq, mockRes, mockNext);

      expect(mockReq.oauthProvider).toBe('linkedin');
      expect(mockReq.oauthProviderConfig).toBe(mockProviderConfig);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle missing provider parameter', () => {
      // mockReq.params.provider is undefined

      validateProviderStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_PROVIDER',
        message: 'OAuth provider parameter is required'
      });
    });

    test('should handle unavailable provider', () => {
      mockReq.params.provider = 'nonexistent';
      oauthConfig.getProviderConfig.mockReturnValue(null);

      validateProviderStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'PROVIDER_NOT_AVAILABLE',
        message: "OAuth provider 'nonexistent' is not available or disabled"
      });
    });

    test('should handle misconfigured LinkedIn provider', () => {
      mockReq.params.provider = 'linkedin';
      const mockProviderConfig = {
        clientId: null, // Misconfigured
        settings: { enabled: true }
      };

      oauthConfig.getProviderConfig.mockReturnValue(mockProviderConfig);

      validateProviderStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'PROVIDER_MISCONFIGURED',
        message: 'LinkedIn OAuth is temporarily unavailable'
      });
    });
  });

  describe('enhancedStateValidation', () => {
    test('should validate correct state format', () => {
      mockReq.query.state = 'a'.repeat(64); // 64 hex characters

      enhancedStateValidation(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle missing state parameter', () => {
      // mockReq.query.state is undefined

      enhancedStateValidation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_STATE',
        message: 'OAuth state parameter is required for security'
      });
    });

    test('should handle invalid state length', () => {
      mockReq.query.state = 'short';

      enhancedStateValidation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_STATE_FORMAT',
        message: 'OAuth state parameter format is invalid'
      });
    });

    test('should handle non-hex characters in state', () => {
      mockReq.query.state = 'g'.repeat(64); // Invalid hex characters

      enhancedStateValidation(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_STATE_CONTENT',
        message: 'OAuth state parameter contains invalid characters'
      });
    });
  });

  describe('prepareLinkingContext', () => {
    test('should prepare context for account linking with authenticated user', () => {
      mockReq.path = '/api/auth/oauth/linkedin/link';
      mockReq.user = { id: 'user-123' };

      // Mock optionalAuthenticate middleware to set user
      optionalAuthenticate.mockImplementation((req, res, next) => {
        req.user = { id: 'user-123' };
        next();
      });

      // Get the second middleware function from the array
      const linkingMiddleware = prepareLinkingContext[1];

      linkingMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.isAccountLinking).toBe(true);
      expect(mockReq.linkingUserId).toBe('user-123');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should require authentication for linking requests', () => {
      mockReq.path = '/api/auth/oauth/linkedin/link';
      mockReq.user = null; // Not authenticated

      const linkingMiddleware = prepareLinkingContext[1];

      linkingMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for account linking'
      });

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should prepare context for new account creation', () => {
      mockReq.path = '/api/auth/oauth/linkedin';
      mockReq.user = null;

      const linkingMiddleware = prepareLinkingContext[1];

      linkingMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.isAccountLinking).toBe(false);
      expect(mockReq.linkingUserId).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateOAuthCallback', () => {
    test('should validate successful OAuth callback', () => {
      mockReq.query = {
        code: 'authorization-code-123',
        state: 'state-parameter-456'
      };

      validateOAuthCallback(mockReq, mockRes, mockNext);

      expect(mockReq.oauthCallback).toEqual({
        code: 'authorization-code-123',
        state: 'state-parameter-456',
        hasError: false
      });

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle OAuth provider errors', () => {
      mockReq.query = {
        error: 'access_denied',
        error_description: 'User denied authorization'
      };

      validateOAuthCallback(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'OAUTH_PROVIDER_ERROR',
        message: 'User denied OAuth authorization',
        details: {
          provider_error: 'access_denied',
          provider_error_description: 'User denied authorization'
        }
      });
    });

    test('should handle unknown OAuth errors', () => {
      mockReq.query = {
        error: 'unknown_error'
      };

      validateOAuthCallback(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'OAUTH_PROVIDER_ERROR',
          message: 'OAuth authentication failed'
        })
      );
    });

    test('should handle missing authorization code', () => {
      mockReq.query = {
        state: 'state-123'
        // Missing code
      };

      validateOAuthCallback(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_AUTHORIZATION_CODE',
        message: 'Authorization code not provided by OAuth provider'
      });
    });

    test('should handle missing state parameter', () => {
      mockReq.query = {
        code: 'auth-code-123'
        // Missing state
      };

      validateOAuthCallback(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_STATE_PARAMETER',
        message: 'State parameter not provided for CSRF protection'
      });
    });

    test('should handle invalid authorization code format', () => {
      mockReq.query = {
        code: 'short',
        state: 'state-123'
      };

      validateOAuthCallback(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'INVALID_AUTHORIZATION_CODE',
        message: 'Authorization code format is invalid'
      });
    });
  });

  describe('detailedOAuthLogger', () => {
    test('should log OAuth initiation attempt', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockReq.oauthProvider = 'linkedin';
      mockReq.validatedRedirectURL = '/dashboard';
      mockReq.query = { prompt: 'consent' };

      const logger = detailedOAuthLogger('oauth_initiate_attempt');
      logger(mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'OAuth Security Event:',
        expect.stringContaining('oauth_initiate_attempt')
      );

      expect(mockNext).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    test('should log OAuth callback events', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockReq.oauthProvider = 'linkedin';
      mockReq.query = {
        state: 'state-123',
        code: 'code-123'
      };

      const logger = detailedOAuthLogger('oauth_callback_received');
      logger(mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'OAuth Security Event:',
        expect.stringContaining('oauth_callback_received')
      );

      expect(mockNext).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    test('should handle logging errors gracefully', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        throw new Error('Logging failed');
      });

      mockReq.oauthProvider = 'linkedin';

      const logger = detailedOAuthLogger('oauth_success');
      logger(mockReq, mockRes, mockNext);

      // Should still call next even if logging fails
      expect(mockNext).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });

  describe('oauthMiddlewareErrorHandler', () => {
    test('should handle OAuth errors with proper status codes', () => {
      const { OAuthError } = require('../../src/auth/oauth');
      const oauthError = new OAuthError('Test error', 'MISSING_PROVIDER', 'linkedin');
      mockReq.oauthProvider = 'linkedin';

      oauthMiddlewareErrorHandler(oauthError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'MISSING_PROVIDER',
        message: 'Test error',
        provider: 'linkedin',
        timestamp: expect.any(String)
      });

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should pass non-OAuth errors to next handler', () => {
      const genericError = new Error('Generic error');

      oauthMiddlewareErrorHandler(genericError, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(genericError);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should handle server errors with 500 status', () => {
      const { OAuthError } = require('../../src/auth/oauth');
      const serverError = new OAuthError('Server error', 'PROVIDER_VALIDATION_FAILED');

      oauthMiddlewareErrorHandler(serverError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});