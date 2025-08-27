/**
 * Rate Limiting Middleware
 * Provides rate limiting functionality for API endpoints
 */

class RateLimitError extends Error {
  constructor(message, retryAfter = null) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * In-memory rate limiting store
 * In production, this should use Redis or similar distributed cache
 */
class MemoryStore {
  constructor() {
    this.clients = new Map();
    this.resetTime = new Map();
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get current count for client
   * @param {string} key - Client key
   * @returns {Object} Count and reset time
   */
  get(key) {
    const now = Date.now();
    const resetTime = this.resetTime.get(key);
    
    // Reset if window has expired
    if (resetTime && now >= resetTime) {
      this.clients.delete(key);
      this.resetTime.delete(key);
      return { count: 0, resetTime: null };
    }
    
    return {
      count: this.clients.get(key) || 0,
      resetTime: resetTime
    };
  }

  /**
   * Increment count for client
   * @param {string} key - Client key
   * @param {number} windowMs - Window duration in milliseconds
   * @returns {Object} Updated count and reset time
   */
  increment(key, windowMs) {
    const now = Date.now();
    const current = this.get(key);
    
    let newCount = current.count + 1;
    let newResetTime = current.resetTime;
    
    // Set reset time if this is first request in window
    if (!newResetTime) {
      newResetTime = now + windowMs;
      this.resetTime.set(key, newResetTime);
    }
    
    this.clients.set(key, newCount);
    
    return {
      count: newCount,
      resetTime: newResetTime,
      remainingTime: Math.max(0, newResetTime - now)
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, resetTime] of this.resetTime.entries()) {
      if (now >= resetTime) {
        this.clients.delete(key);
        this.resetTime.delete(key);
      }
    }
  }

  /**
   * Reset all entries (for testing)
   */
  reset() {
    this.clients.clear();
    this.resetTime.clear();
  }
}

// Global store instance
const store = new MemoryStore();

/**
 * Rate limiter middleware
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
function rateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // Maximum requests per window
    message = 'Too many requests, please try again later',
    statusCode = 429,
    headers = true,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => {
      // Use user ID if authenticated, otherwise IP address
      return req.user?.id || req.ip || req.connection?.remoteAddress || 'unknown';
    },
    skip = () => false,
    onLimitReached = () => {},
    standardHeaders = true, // Send standard rate limit headers
    legacyHeaders = false // Send X-RateLimit-* headers
  } = options;

  return async (req, res, next) => {
    try {
      // Skip if conditions met
      if (skip(req, res)) {
        return next();
      }

      const key = keyGenerator(req);
      const result = store.increment(key, windowMs);

      // Set headers if enabled
      if (headers || standardHeaders) {
        res.set({
          'RateLimit-Limit': max,
          'RateLimit-Remaining': Math.max(0, max - result.count),
          'RateLimit-Reset': new Date(result.resetTime).toISOString()
        });
      }

      if (legacyHeaders) {
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - result.count),
          'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000)
        });
      }

      // Check if limit exceeded
      if (result.count > max) {
        // Set retry-after header
        const retryAfterSeconds = Math.ceil(result.remainingTime / 1000);
        res.set('Retry-After', retryAfterSeconds);

        // Call limit reached callback
        onLimitReached(req, res);

        // Log rate limit exceeded
        console.warn('Rate limit exceeded:', {
          key,
          count: result.count,
          max,
          resetTime: new Date(result.resetTime).toISOString(),
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });

        return res.status(statusCode).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: message,
          retryAfter: retryAfterSeconds
        });
      }

      // Handle response to skip counting on certain conditions
      const originalSend = res.send;
      res.send = function(body) {
        const shouldSkip = 
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (shouldSkip) {
          // Decrement counter if we should skip this request
          const current = store.get(key);
          if (current.count > 0) {
            store.clients.set(key, current.count - 1);
          }
        }

        return originalSend.call(this, body);
      };

      next();

    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue processing if rate limiting fails
      next();
    }
  };
}

/**
 * Create rate limiter with preset configurations
 */
const presets = {
  /**
   * Strict rate limiter for sensitive operations
   */
  strict: (options = {}) => rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many sensitive requests, please try again later',
    ...options
  }),

  /**
   * Moderate rate limiter for API calls
   */
  moderate: (options = {}) => rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many API requests, please try again later',
    ...options
  }),

  /**
   * Lenient rate limiter for public endpoints
   */
  lenient: (options = {}) => rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: 'Too many requests, please try again later',
    ...options
  }),

  /**
   * Per-minute rate limiter
   */
  perMinute: (max = 60, options = {}) => rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max,
    message: 'Too many requests per minute, please try again later',
    ...options
  }),

  /**
   * Per-hour rate limiter
   */
  perHour: (max = 1000, options = {}) => rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max,
    message: 'Too many requests per hour, please try again later',
    ...options
  }),

  /**
   * Booking-specific rate limiters
   */
  bookingCreation: (options = {}) => rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Max 10 booking creations per hour
    message: 'Too many booking requests, please try again later',
    skipSuccessfulRequests: false,
    skipFailedRequests: true, // Don't count failed attempts against limit
    ...options
  }),

  bookingListing: (options = {}) => rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 listing requests per 15 minutes
    message: 'Too many booking list requests, please try again later',
    ...options
  }),

  bookingDetails: (options = {}) => rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Max 200 detail requests per 15 minutes
    message: 'Too many booking detail requests, please try again later',
    ...options
  }),

  bookingUpdates: (options = {}) => rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Max 30 update requests per 15 minutes
    message: 'Too many booking updates, please try again later',
    skipFailedRequests: true, // Don't count failed attempts
    ...options
  }),

  bookingStateChanges: (options = {}) => rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Max 20 state changes per hour
    message: 'Too many booking state changes, please try again later',
    skipFailedRequests: true, // Don't count failed attempts
    ...options
  })
};

/**
 * Global rate limiter for entire application
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
function globalRateLimit(options = {}) {
  return rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Very high limit for global rate limiting
    keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
    message: 'Too many requests from this IP, please try again later',
    ...options
  });
}

/**
 * Get rate limit status for a key
 * @param {string} key - Client key
 * @param {number} windowMs - Window duration
 * @returns {Object} Rate limit status
 */
function getRateLimitStatus(key, windowMs = 15 * 60 * 1000) {
  const result = store.get(key);
  return {
    count: result.count,
    resetTime: result.resetTime,
    remainingTime: result.resetTime ? Math.max(0, result.resetTime - Date.now()) : 0
  };
}

/**
 * Reset rate limit for a key
 * @param {string} key - Client key
 * @returns {boolean} Success status
 */
function resetRateLimit(key) {
  try {
    store.clients.delete(key);
    store.resetTime.delete(key);
    return true;
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
}

module.exports = {
  rateLimiter,
  ...presets, // Spread presets to make them available at top level
  globalRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  store, // Export for testing
  RateLimitError
};