/**
 * Security Headers Middleware
 * Implements various security headers and protections
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authConfig = require('../config/auth');

/**
 * Configure Helmet security headers
 * @param {Object} options - Additional helmet options
 */
function securityHeaders(options = {}) {
  const defaultOptions = {
    contentSecurityPolicy: authConfig.security.contentSecurityPolicy,
    crossOriginEmbedderPolicy: authConfig.security.crossOriginEmbedderPolicy,
    crossOriginOpenerPolicy: authConfig.security.crossOriginOpenerPolicy,
    crossOriginResourcePolicy: authConfig.security.crossOriginResourcePolicy,
    dnsPrefetchControl: authConfig.security.dnsPrefetchControl,
    frameguard: authConfig.security.frameguard,
    hidePoweredBy: authConfig.security.hidePoweredBy,
    hsts: authConfig.security.hsts,
    ieNoOpen: authConfig.security.ieNoOpen,
    noSniff: authConfig.security.noSniff,
    originAgentCluster: authConfig.security.originAgentCluster,
    permittedCrossDomainPolicies: authConfig.security.permittedCrossDomainPolicies,
    referrerPolicy: authConfig.security.referrerPolicy,
    xssFilter: authConfig.security.xssFilter
  };

  const mergedOptions = { ...defaultOptions, ...options };
  return helmet(mergedOptions);
}

/**
 * Create rate limiter for login attempts
 */
function loginRateLimit() {
  return rateLimit({
    windowMs: authConfig.rateLimiting.login.windowMs,
    max: authConfig.rateLimiting.login.max,
    message: {
      success: false,
      error: authConfig.rateLimiting.login.message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Rate limit by IP and email if provided
      const email = req.body?.email || '';
      return `${req.ip}:${email}`;
    },
    skip: (req) => {
      // Skip rate limiting in test environment
      return process.env.NODE_ENV === 'test';
    }
  });
}

/**
 * Create rate limiter for registration attempts
 */
function registrationRateLimit() {
  return rateLimit({
    windowMs: authConfig.rateLimiting.register.windowMs,
    max: authConfig.rateLimiting.register.max,
    message: {
      success: false,
      error: authConfig.rateLimiting.register.message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Rate limit by IP and email if provided
      const email = req.body?.email || '';
      return `${req.ip}:${email}`;
    },
    skip: (req) => {
      return process.env.NODE_ENV === 'test';
    }
  });
}

/**
 * Create rate limiter for password reset attempts
 */
function passwordResetRateLimit() {
  return rateLimit({
    windowMs: authConfig.rateLimiting.passwordReset.windowMs,
    max: authConfig.rateLimiting.passwordReset.max,
    message: {
      success: false,
      error: authConfig.rateLimiting.passwordReset.message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email = req.body?.email || '';
      return `${req.ip}:${email}`;
    },
    skip: (req) => {
      return process.env.NODE_ENV === 'test';
    }
  });
}

/**
 * General API rate limiter
 * @param {Object} options - Rate limit options
 */
function generalRateLimit(options = {}) {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return process.env.NODE_ENV === 'test';
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
}

/**
 * CORS middleware with security-focused configuration
 * @param {Object} options - CORS options
 */
function corsWithSecurity(options = {}) {
  const defaultOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:3001'];

      if (authConfig.isDevelopment) {
        // In development, allow localhost origins
        if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma'
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
  };

  return require('cors')({ ...defaultOptions, ...options });
}

/**
 * Request sanitization middleware
 * Removes potentially dangerous characters from request data
 */
function sanitizeRequest() {
  return (req, res, next) => {
    try {
      // Sanitize query parameters
      if (req.query) {
        for (const key in req.query) {
          if (typeof req.query[key] === 'string') {
            req.query[key] = sanitizeString(req.query[key]);
          }
        }
      }

      // Sanitize request body (excluding password fields)
      if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body, ['password', 'newPassword', 'confirmPassword']);
      }

      next();
    } catch (error) {
      console.error('Request sanitization error:', error);
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        code: 'INVALID_REQUEST'
      });
    }
  };
}

/**
 * Sanitize string by removing/escaping dangerous characters
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=\s*[^>\s]*/gi, '') // Remove event handlers with their values
    .replace(/on\w+\s*=/gi, '') // Remove any remaining event handlers
    .trim();
}

/**
 * Recursively sanitize object properties
 * @param {Object} obj - Object to sanitize
 * @param {Array} excludeFields - Fields to exclude from sanitization
 */
function sanitizeObject(obj, excludeFields = []) {
  for (const key in obj) {
    if (excludeFields.includes(key)) {
      continue; // Skip password and similar sensitive fields
    }

    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key], excludeFields);
    }
  }
}

/**
 * Request logging middleware for security auditing
 */
function securityLogger() {
  return (req, res, next) => {
    const startTime = Date.now();

    // Log security-relevant request info
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: null,
      referer: null,
      userId: req.user?.id || null,
      sessionId: req.sessionID || null
    };

    try {
      logData.userAgent = req.get('User-Agent');
      logData.referer = req.get('Referer');
    } catch (error) {
      // Ignore header access errors
      console.debug('Header access error in security logger:', error.message);
    }

    // Log after response
    res.on('finish', () => {
      logData.statusCode = res.statusCode;
      logData.responseTime = Date.now() - startTime;

      // Log failed authentication attempts
      if (req.originalUrl.includes('/auth/') && res.statusCode === 401) {
        console.warn('Failed authentication attempt:', logData);
      }

      // Log suspicious activity
      if (res.statusCode >= 400) {
        console.info('Security event:', logData);
      }
    });

    next();
  };
}

/**
 * Middleware to detect and block suspicious requests
 */
function suspiciousActivityDetector() {
  return (req, res, next) => {
    const suspiciousPatterns = [
      /\.\.\//,           // Path traversal
      /<script/i,         // XSS attempts
      /union.*select/i,   // SQL injection
      /exec\s*\(/i,       // Command injection
      /eval\s*\(/i        // Code injection
    ];

    let requestData;
    try {
      requestData = JSON.stringify({
        query: req.query,
        body: req.body,
        params: req.params,
        url: req.originalUrl
      });
    } catch (error) {
      // Handle circular reference or other JSON.stringify errors
      requestData = `${JSON.stringify(req.query || {})} ${JSON.stringify(req.params || {})} ${req.originalUrl}`;
    }

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData)) {
        console.warn('Suspicious request detected:', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          pattern: pattern.toString()
        });

        return res.status(400).json({
          success: false,
          error: 'Request blocked for security reasons',
          code: 'SUSPICIOUS_REQUEST'
        });
      }
    }

    next();
  };
}

module.exports = {
  securityHeaders,
  loginRateLimit,
  registrationRateLimit,
  passwordResetRateLimit,
  generalRateLimit,
  corsWithSecurity,
  sanitizeRequest,
  securityLogger,
  suspiciousActivityDetector,
  sanitizeString,
  sanitizeObject
};