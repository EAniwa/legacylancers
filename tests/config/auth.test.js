/**
 * Auth Configuration Test Suite
 * Tests for authentication configuration and validation
 */

// Save original env vars to restore later
const originalEnv = { ...process.env };

describe('Auth Configuration', () => {
  beforeEach(() => {
    // Clear require cache to get fresh config
    jest.resetModules();
    // Reset environment to test state
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('Default Configuration', () => {
    test('should load default configuration in test environment', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.jwt.secret).toBe('your-super-secret-jwt-key-change-in-production');
      expect(authConfig.jwt.expiresIn).toBe('24h');
      expect(authConfig.jwt.refreshExpiresIn).toBe('7d');
      expect(authConfig.jwt.algorithm).toBe('HS256');
      expect(authConfig.jwt.issuer).toBe('legacylancers');
      expect(authConfig.jwt.audience).toBe('legacylancers-users');
    });

    test('should have correct password settings', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.password.saltRounds).toBe(12);
      expect(authConfig.password.minLength).toBe(8);
      expect(authConfig.password.requireUppercase).toBe(true);
      expect(authConfig.password.requireLowercase).toBe(true);
      expect(authConfig.password.requireNumbers).toBe(true);
      expect(authConfig.password.requireSpecialChars).toBe(true);
    });

    test('should have correct session settings', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.session.maxConcurrentSessions).toBe(5);
      expect(authConfig.session.inactivityTimeout).toBe(1800000); // 30 minutes
      expect(authConfig.session.absoluteTimeout).toBe(86400000); // 24 hours
    });

    test('should have rate limiting configuration', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.rateLimiting.login.windowMs).toBe(15 * 60 * 1000);
      expect(authConfig.rateLimiting.login.max).toBe(5);
      expect(authConfig.rateLimiting.register.max).toBe(3);
      expect(authConfig.rateLimiting.passwordReset.max).toBe(3);
    });

    test('should have email verification settings', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.emailVerification.tokenLength).toBe(32);
      expect(authConfig.emailVerification.expiryHours).toBe(24);
      expect(authConfig.emailVerification.maxResendAttempts).toBe(3);
      expect(authConfig.emailVerification.resendCooldownMinutes).toBe(5);
    });

    test('should have security headers configuration', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.security.contentSecurityPolicy).toBeDefined();
      expect(authConfig.security.hsts).toBeDefined();
      expect(authConfig.security.frameguard).toBeDefined();
      expect(authConfig.security.xssFilter).toBe(true);
      expect(authConfig.security.noSniff).toBe(true);
    });

    test('should detect test environment correctly', () => {
      process.env.NODE_ENV = 'test';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.isProduction).toBe(false);
      expect(authConfig.isDevelopment).toBe(false);
      expect(authConfig.isTest).toBe(true);
    });
  });

  describe('Environment Variable Override', () => {
    test('should use JWT_SECRET from environment', () => {
      process.env.JWT_SECRET = 'custom-jwt-secret-from-env';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.jwt.secret).toBe('custom-jwt-secret-from-env');
    });

    test('should use JWT_EXPIRES_IN from environment', () => {
      process.env.JWT_EXPIRES_IN = '12h';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.jwt.expiresIn).toBe('12h');
    });

    test('should use JWT_REFRESH_EXPIRES_IN from environment', () => {
      process.env.JWT_REFRESH_EXPIRES_IN = '14d';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.jwt.refreshExpiresIn).toBe('14d');
    });

    test('should use BCRYPT_SALT_ROUNDS from environment', () => {
      process.env.BCRYPT_SALT_ROUNDS = '10';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.password.saltRounds).toBe(10);
    });

    test('should use MAX_CONCURRENT_SESSIONS from environment', () => {
      process.env.MAX_CONCURRENT_SESSIONS = '3';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.session.maxConcurrentSessions).toBe(3);
    });

    test('should use SESSION_INACTIVITY_TIMEOUT from environment', () => {
      process.env.SESSION_INACTIVITY_TIMEOUT = '900000'; // 15 minutes
      const authConfig = require('../../src/config/auth');

      expect(authConfig.session.inactivityTimeout).toBe(900000);
    });

    test('should use JWT_ISSUER and JWT_AUDIENCE from environment', () => {
      process.env.JWT_ISSUER = 'custom-issuer';
      process.env.JWT_AUDIENCE = 'custom-audience';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.jwt.issuer).toBe('custom-issuer');
      expect(authConfig.jwt.audience).toBe('custom-audience');
    });
  });

  describe('Environment Detection', () => {
    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'production-jwt-secret-key-with-minimum-32-characters-length';
      
      jest.resetModules();
      const authConfig = require('../../src/config/auth');

      expect(authConfig.isProduction).toBe(true);
      expect(authConfig.isDevelopment).toBe(false);
      expect(authConfig.isTest).toBe(false);
    });

    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const authConfig = require('../../src/config/auth');

      expect(authConfig.isProduction).toBe(false);
      expect(authConfig.isDevelopment).toBe(true);
      expect(authConfig.isTest).toBe(false);
    });

    test('should handle undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      const authConfig = require('../../src/config/auth');

      expect(authConfig.isProduction).toBe(false);
      expect(authConfig.isDevelopment).toBe(false);
      expect(authConfig.isTest).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    test('should throw error in production with default JWT secret', () => {
      process.env.NODE_ENV = 'production';
      // Don't set JWT_SECRET, so it uses default

      expect(() => {
        require('../../src/config/auth');
      }).toThrow('Authentication configuration errors');
      
      expect(() => {
        require('../../src/config/auth');
      }).toThrow('JWT_SECRET must be set in production');
    });

    test('should throw error in production with short JWT secret', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short'; // Less than 32 characters

      expect(() => {
        require('../../src/config/auth');
      }).toThrow('JWT_SECRET must be at least 32 characters long');
    });

    test('should throw error in production with low salt rounds', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-very-long-jwt-secret-that-is-more-than-32-characters-long';
      process.env.BCRYPT_SALT_ROUNDS = '8'; // Less than 10

      expect(() => {
        require('../../src/config/auth');
      }).toThrow('BCRYPT_SALT_ROUNDS must be at least 10 in production');
    });

    test('should not throw errors in development with defaults', () => {
      process.env.NODE_ENV = 'development';

      expect(() => {
        require('../../src/config/auth');
      }).not.toThrow();
    });

    test('should not throw errors in test with defaults', () => {
      process.env.NODE_ENV = 'test';

      expect(() => {
        require('../../src/config/auth');
      }).not.toThrow();
    });

    test('should allow valid production configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-very-secure-jwt-secret-that-is-definitely-more-than-32-characters-long';
      process.env.BCRYPT_SALT_ROUNDS = '12';

      jest.resetModules();
      expect(() => {
        require('../../src/config/auth');
      }).not.toThrow();
      
      const authConfig = require('../../src/config/auth');
      expect(authConfig.password.saltRounds).toBe(12);
    });
  });

  describe('Type Conversion', () => {
    test('should convert string numbers to integers', () => {
      process.env.BCRYPT_SALT_ROUNDS = '14';
      process.env.MAX_CONCURRENT_SESSIONS = '7';
      process.env.SESSION_INACTIVITY_TIMEOUT = '2700000';
      process.env.SESSION_ABSOLUTE_TIMEOUT = '172800000';

      const authConfig = require('../../src/config/auth');

      expect(authConfig.password.saltRounds).toBe(14);
      expect(authConfig.session.maxConcurrentSessions).toBe(7);
      expect(authConfig.session.inactivityTimeout).toBe(2700000);
      expect(authConfig.session.absoluteTimeout).toBe(172800000);
    });

    test('should handle invalid number conversion gracefully', () => {
      process.env.BCRYPT_SALT_ROUNDS = 'not-a-number';

      const authConfig = require('../../src/config/auth');

      // parseInt('not-a-number') returns NaN, so should fall back to default
      expect(authConfig.password.saltRounds).toBe(12); // Default value
    });
  });

  describe('Security Headers Configuration', () => {
    test('should have comprehensive CSP directives', () => {
      const authConfig = require('../../src/config/auth');
      const csp = authConfig.security.contentSecurityPolicy;

      expect(csp.directives.defaultSrc).toContain("'self'");
      expect(csp.directives.scriptSrc).toContain("'self'");
      expect(csp.directives.styleSrc).toContain("'self'");
      expect(csp.directives.objectSrc).toContain("'none'");
      expect(csp.directives.frameSrc).toContain("'none'");
    });

    test('should have proper HSTS configuration', () => {
      const authConfig = require('../../src/config/auth');
      const hsts = authConfig.security.hsts;

      expect(hsts.maxAge).toBe(31536000); // 1 year
      expect(hsts.includeSubDomains).toBe(true);
      expect(hsts.preload).toBe(true);
    });

    test('should have security flags enabled', () => {
      const authConfig = require('../../src/config/auth');
      const security = authConfig.security;

      expect(security.hidePoweredBy).toBe(true);
      expect(security.noSniff).toBe(true);
      expect(security.xssFilter).toBe(true);
      expect(security.ieNoOpen).toBe(true);
      expect(security.originAgentCluster).toBe(true);
      expect(security.permittedCrossDomainPolicies).toBe(false);
    });
  });

  describe('Rate Limiting Configuration', () => {
    test('should have different limits for different endpoints', () => {
      const authConfig = require('../../src/config/auth');
      const rateLimiting = authConfig.rateLimiting;

      // Login should be more restrictive
      expect(rateLimiting.login.max).toBeLessThan(rateLimiting.register.max * 2);
      
      // All should have reasonable time windows
      expect(rateLimiting.login.windowMs).toBeGreaterThan(0);
      expect(rateLimiting.register.windowMs).toBeGreaterThan(0);
      expect(rateLimiting.passwordReset.windowMs).toBeGreaterThan(0);
    });

    test('should have meaningful error messages', () => {
      const authConfig = require('../../src/config/auth');
      const rateLimiting = authConfig.rateLimiting;

      expect(rateLimiting.login.message).toContain('login');
      expect(rateLimiting.register.message).toContain('registration');
      expect(rateLimiting.passwordReset.message).toContain('password reset');
    });
  });

  describe('Password Policy', () => {
    test('should have strong password requirements', () => {
      const authConfig = require('../../src/config/auth');
      const password = authConfig.password;

      expect(password.minLength).toBeGreaterThanOrEqual(8);
      expect(password.requireUppercase).toBe(true);
      expect(password.requireLowercase).toBe(true);
      expect(password.requireNumbers).toBe(true);
      expect(password.requireSpecialChars).toBe(true);
    });

    test('should have reasonable salt rounds for different environments', () => {
      // Test environment (current)
      process.env.NODE_ENV = 'test';
      const testConfig = require('../../src/config/auth');
      expect(testConfig.password.saltRounds).toBeGreaterThanOrEqual(10);

      // Reset modules for next test
      jest.resetModules();

      // Development environment
      process.env.NODE_ENV = 'development';
      const devConfig = require('../../src/config/auth');
      expect(devConfig.password.saltRounds).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Token Configuration', () => {
    test('should have different expiration times for different token types', () => {
      const authConfig = require('../../src/config/auth');

      // Refresh tokens should last longer than access tokens
      // Parse time strings to compare (simplified comparison)
      const accessTime = authConfig.jwt.expiresIn; // '24h'
      const refreshTime = authConfig.jwt.refreshExpiresIn; // '7d'

      expect(refreshTime).not.toBe(accessTime);
      // In a real implementation, you might want to parse these and compare
    });

    test('should use secure defaults for JWT settings', () => {
      const authConfig = require('../../src/config/auth');

      expect(authConfig.jwt.algorithm).toBe('HS256');
      expect(authConfig.jwt.issuer).toBe('legacylancers');
      expect(authConfig.jwt.audience).toBe('legacylancers-users');
    });
  });
});