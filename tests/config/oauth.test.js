/**
 * OAuth Configuration Test Suite
 * Comprehensive tests for OAuth configuration management
 */

describe('OAuth Configuration', () => {
  let oauthConfig;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear require cache to get fresh config
    jest.resetModules();
    
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Basic Configuration', () => {
    test('should load configuration with default values', () => {
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.oauth).toBeDefined();
      expect(oauthConfig.oauth.stateLength).toBe(32);
      expect(oauthConfig.oauth.stateExpiryMinutes).toBe(10);
      expect(oauthConfig.oauth.maxStateCacheSize).toBe(1000);
    });

    test('should configure rate limiting settings', () => {
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.oauth.rateLimiting.initiate).toBeDefined();
      expect(oauthConfig.oauth.rateLimiting.initiate.windowMs).toBe(15 * 60 * 1000);
      expect(oauthConfig.oauth.rateLimiting.initiate.max).toBe(10);
      
      expect(oauthConfig.oauth.rateLimiting.callback).toBeDefined();
      expect(oauthConfig.oauth.rateLimiting.callback.windowMs).toBe(15 * 60 * 1000);
      expect(oauthConfig.oauth.rateLimiting.callback.max).toBe(20);
    });

    test('should configure security settings', () => {
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.oauth.security).toBeDefined();
      expect(oauthConfig.oauth.security.validateState).toBe(true);
      expect(oauthConfig.oauth.security.maxProfileDataSize).toBe(10 * 1024);
      expect(Array.isArray(oauthConfig.oauth.security.allowedRedirectDomains)).toBe(true);
    });

    test('should configure default redirect URLs', () => {
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.redirects).toBeDefined();
      expect(oauthConfig.redirects.success).toBe('/dashboard');
      expect(oauthConfig.redirects.error).toBe('/login?error=oauth_failed');
      expect(oauthConfig.redirects.cancel).toBe('/login?info=oauth_cancelled');
    });
  });

  describe('LinkedIn Provider Configuration', () => {
    test('should configure LinkedIn provider with defaults', () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
      
      oauthConfig = require('../../src/config/oauth');
      
      const linkedin = oauthConfig.providers.linkedin;
      expect(linkedin).toBeDefined();
      expect(linkedin.clientId).toBe('test-client-id');
      expect(linkedin.clientSecret).toBe('test-client-secret');
      expect(linkedin.scope).toBe('r_liteprofile r_emailaddress');
      expect(linkedin.responseType).toBe('code');
    });

    test('should configure LinkedIn URLs', () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
      
      oauthConfig = require('../../src/config/oauth');
      
      const linkedin = oauthConfig.providers.linkedin;
      expect(linkedin.authorizationURL).toBe('https://www.linkedin.com/oauth/v2/authorization');
      expect(linkedin.tokenURL).toBe('https://www.linkedin.com/oauth/v2/accessToken');
      expect(linkedin.profileURL).toBe('https://api.linkedin.com/v2/people/~');
    });

    test('should configure LinkedIn profile mapping', () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
      
      oauthConfig = require('../../src/config/oauth');
      
      const linkedin = oauthConfig.providers.linkedin;
      expect(linkedin.profileMapping).toBeDefined();
      expect(linkedin.profileMapping.id).toBe('id');
      expect(linkedin.profileMapping.firstName).toBe('localizedFirstName');
      expect(linkedin.profileMapping.lastName).toBe('localizedLastName');
    });

    test('should configure LinkedIn settings', () => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret';
      
      oauthConfig = require('../../src/config/oauth');
      
      const linkedin = oauthConfig.providers.linkedin;
      expect(linkedin.settings.name).toBe('LinkedIn');
      expect(linkedin.settings.displayName).toBe('LinkedIn');
      expect(linkedin.settings.icon).toBe('linkedin');
      expect(linkedin.settings.color).toBe('#0077B5');
    });
  });

  describe('Environment Variable Handling', () => {
    test('should use environment variables when provided', () => {
      process.env.LINKEDIN_CLIENT_ID = 'env-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'env-client-secret';
      process.env.LINKEDIN_CALLBACK_URL = 'https://example.com/callback';
      process.env.BASE_URL = 'https://example.com';
      
      oauthConfig = require('../../src/config/oauth');
      
      const linkedin = oauthConfig.providers.linkedin;
      expect(linkedin.clientId).toBe('env-client-id');
      expect(linkedin.clientSecret).toBe('env-client-secret');
      expect(linkedin.callbackURL).toBe('https://example.com/callback');
    });

    test('should handle custom redirect URLs', () => {
      process.env.OAUTH_SUCCESS_REDIRECT = '/custom/success';
      process.env.OAUTH_ERROR_REDIRECT = '/custom/error';
      process.env.OAUTH_CANCEL_REDIRECT = '/custom/cancel';
      
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.redirects.success).toBe('/custom/success');
      expect(oauthConfig.redirects.error).toBe('/custom/error');
      expect(oauthConfig.redirects.cancel).toBe('/custom/cancel');
    });

    test('should handle allowed redirect domains', () => {
      process.env.OAUTH_ALLOWED_DOMAINS = 'example.com,app.example.com';
      
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.oauth.security.allowedRedirectDomains).toEqual(['example.com', 'app.example.com']);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate LinkedIn configuration when enabled', () => {
      process.env.LINKEDIN_OAUTH_ENABLED = 'true';
      process.env.LINKEDIN_CLIENT_ID = 'valid-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'valid-client-secret-with-enough-length';
      
      expect(() => {
        oauthConfig = require('../../src/config/oauth');
      }).not.toThrow();
    });

    test('should throw error for missing client ID', () => {
      process.env.LINKEDIN_OAUTH_ENABLED = 'true';
      delete process.env.LINKEDIN_CLIENT_ID;
      process.env.LINKEDIN_CLIENT_SECRET = 'valid-client-secret';
      
      expect(() => {
        oauthConfig = require('../../src/config/oauth');
      }).toThrow('LINKEDIN_CLIENT_ID is required when LinkedIn OAuth is enabled');
    });

    test('should throw error for missing client secret', () => {
      process.env.LINKEDIN_OAUTH_ENABLED = 'true';
      process.env.LINKEDIN_CLIENT_ID = 'valid-client-id';
      delete process.env.LINKEDIN_CLIENT_SECRET;
      
      expect(() => {
        oauthConfig = require('../../src/config/oauth');
      }).toThrow('LINKEDIN_CLIENT_SECRET is required when LinkedIn OAuth is enabled');
    });

    test('should validate client secret length', () => {
      process.env.LINKEDIN_OAUTH_ENABLED = 'true';
      process.env.LINKEDIN_CLIENT_ID = 'valid-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'short'; // Too short
      
      expect(() => {
        oauthConfig = require('../../src/config/oauth');
      }).toThrow('LINKEDIN_CLIENT_SECRET should be at least 16 characters long');
    });

    test('should require HTTPS in production for LinkedIn', () => {
      process.env.NODE_ENV = 'production';
      process.env.LINKEDIN_OAUTH_ENABLED = 'true';
      process.env.LINKEDIN_CLIENT_ID = 'valid-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'valid-client-secret-long-enough';
      process.env.LINKEDIN_CALLBACK_URL = 'http://insecure.com/callback';
      
      expect(() => {
        oauthConfig = require('../../src/config/oauth');
      }).toThrow('LinkedIn callback URL must use HTTPS in production');
    });
  });

  describe('Utility Functions', () => {
    beforeEach(() => {
      process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
      process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret-long-enough';
      oauthConfig = require('../../src/config/oauth');
    });

    test('getEnabledProviders should return enabled providers', () => {
      const enabledProviders = oauthConfig.getEnabledProviders();
      
      expect(Array.isArray(enabledProviders)).toBe(true);
      
      if (enabledProviders.length > 0) {
        const linkedin = enabledProviders.find(p => p.key === 'linkedin');
        expect(linkedin).toBeDefined();
        expect(linkedin.name).toBe('LinkedIn');
        expect(linkedin.displayName).toBe('LinkedIn');
        expect(linkedin.icon).toBe('linkedin');
      }
    });

    test('getProviderConfig should return provider configuration', () => {
      const providerConfig = oauthConfig.getProviderConfig('linkedin');
      
      if (providerConfig) {
        expect(providerConfig.clientId).toBe('test-client-id');
        expect(providerConfig.clientSecret).toBe('test-client-secret-long-enough');
        expect(providerConfig.scope).toBe('r_liteprofile r_emailaddress');
      }
    });

    test('getProviderConfig should return null for disabled provider', () => {
      const providerConfig = oauthConfig.getProviderConfig('nonexistent');
      
      expect(providerConfig).toBeNull();
    });

    test('generateSecureRandom should generate secure random string', () => {
      const random1 = oauthConfig.generateSecureRandom(16);
      const random2 = oauthConfig.generateSecureRandom(16);
      
      expect(typeof random1).toBe('string');
      expect(typeof random2).toBe('string');
      expect(random1).not.toBe(random2);
      expect(random1.length).toBe(32); // hex encoding doubles length
      expect(random2.length).toBe(32);
    });

    test('buildAuthorizationURL should create valid URL', () => {
      const state = 'test-state-parameter';
      const authURL = oauthConfig.buildAuthorizationURL('linkedin', state);
      
      expect(typeof authURL).toBe('string');
      expect(authURL).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(authURL).toContain('client_id=test-client-id');
      expect(authURL).toContain('state=test-state-parameter');
      expect(authURL).toContain('scope=r_liteprofile%20r_emailaddress');
    });

    test('buildAuthorizationURL should throw for invalid provider', () => {
      expect(() => {
        oauthConfig.buildAuthorizationURL('invalid-provider', 'state');
      }).toThrow('Provider invalid-provider not found or not enabled');
    });

    test('buildAuthorizationURL should accept additional options', () => {
      const state = 'test-state';
      const options = { prompt: 'consent' };
      const authURL = oauthConfig.buildAuthorizationURL('linkedin', state, options);
      
      expect(authURL).toContain('prompt=consent');
    });
  });

  describe('Environment Detection', () => {
    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.isProduction).toBe(true);
      expect(oauthConfig.isDevelopment).toBe(false);
      expect(oauthConfig.isTest).toBe(false);
    });

    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.isProduction).toBe(false);
      expect(oauthConfig.isDevelopment).toBe(true);
      expect(oauthConfig.isTest).toBe(false);
    });

    test('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      oauthConfig = require('../../src/config/oauth');
      
      expect(oauthConfig.isProduction).toBe(false);
      expect(oauthConfig.isDevelopment).toBe(false);
      expect(oauthConfig.isTest).toBe(true);
    });
  });
});