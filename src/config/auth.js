/**
 * Authentication Configuration
 * Centralized configuration for authentication settings
 */

const config = {
  // JWT Settings
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'legacylancers',
    audience: process.env.JWT_AUDIENCE || 'legacylancers-users'
  },

  // Password Settings
  password: {
    // bcrypt salt rounds - higher is more secure but slower
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
    // Minimum password requirements
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },

  // Session Settings
  session: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5,
    inactivityTimeout: parseInt(process.env.SESSION_INACTIVITY_TIMEOUT) || 1800000, // 30 minutes
    absoluteTimeout: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT) || 86400000 // 24 hours
  },

  // Rate Limiting
  rateLimiting: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: 'Too many login attempts, please try again later'
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 registration attempts per hour
      message: 'Too many registration attempts, please try again later'
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 password reset attempts per hour
      message: 'Too many password reset attempts, please try again later'
    }
  },

  // Email Verification
  emailVerification: {
    tokenLength: 32,
    expiryHours: 24,
    maxResendAttempts: 3,
    resendCooldownMinutes: 5
  },

  // Password Reset
  passwordReset: {
    tokenLength: 32,
    expiryHours: 2,
    maxAttempts: 3
  },

  // Security Headers
  security: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'cross-origin',
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: 'no-referrer',
    xssFilter: true
  },

  // Environment checks
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test'
};

// Validation function to ensure required environment variables are set
function validateConfig() {
  const errors = [];

  if (config.isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    if (config.password.saltRounds < 10) {
      errors.push('BCRYPT_SALT_ROUNDS must be at least 10 in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Authentication configuration errors:\n${errors.join('\n')}`);
  }
}

// Validate configuration on module load
validateConfig();

module.exports = config;