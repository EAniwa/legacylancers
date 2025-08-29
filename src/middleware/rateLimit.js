/**
 * Rate Limiting Middleware Export
 * Exports the rate limiting functionality from rateLimiting.js
 */

const { rateLimiter } = require('./rateLimiting');

// Export rateLimiter as rateLimitMiddleware for compatibility
module.exports = {
  rateLimitMiddleware: rateLimiter
};