/**
 * Notification API Routes
 * RESTful endpoints for notification management with proper middleware
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
  getNotificationStats
} = require('../../controllers/notificationController');

// Import authentication middleware
const {
  requiredAuthenticate,
  optionalAuthenticate,
  adminOnly
} = require('../../middleware/auth');

// Import notification-specific middleware
const {
  requireNotificationOwnership,
  validateNotificationId,
  validateNotificationRequest,
  validatePreferencesRequest,
  sanitizeNotificationInput
} = require('../../middleware/notificationAuth');

// Import rate limiting middleware
const { globalRateLimit } = require('../../middleware/rateLimiting');

/**
 * GET /api/notifications
 * Get user's notifications with pagination and filtering
 * Requires authentication
 */
router.get('/',
  requiredAuthenticate,
  globalRateLimit(),
  getNotifications
);

/**
 * GET /api/notifications/stats
 * Get user's notification statistics
 * Requires authentication
 */
router.get('/stats',
  requiredAuthenticate,
  globalRateLimit(),
  getNotificationStats
);

/**
 * PUT /api/notifications/read-all
 * Mark all user's notifications as read
 * Requires authentication
 */
router.put('/read-all',
  requiredAuthenticate,
  globalRateLimit(),
  markAllNotificationsAsRead
);

/**
 * POST /api/notifications/test
 * Send test notification (development only)
 * Requires authentication
 * Note: Only available in non-production environments
 */
router.post('/test',
  requiredAuthenticate,
  globalRateLimit(),
  sanitizeNotificationInput(),
  validateNotificationRequest(),
  sendTestNotification
);

/**
 * PUT /api/notifications/:id/read
 * Mark specific notification as read
 * Requires authentication and notification ownership
 */
router.put('/:id/read',
  requiredAuthenticate,
  validateNotificationId(),
  requireNotificationOwnership(),
  globalRateLimit(),
  markNotificationAsRead
);

/**
 * DELETE /api/notifications/:id
 * Delete specific notification
 * Requires authentication and notification ownership
 */
router.delete('/:id',
  requiredAuthenticate,
  validateNotificationId(),
  requireNotificationOwnership(),
  globalRateLimit(),
  deleteNotification
);

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 * Requires authentication
 */
router.get('/preferences',
  requiredAuthenticate,
  globalRateLimit(),
  getNotificationPreferences
);

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 * Requires authentication
 */
router.put('/preferences',
  requiredAuthenticate,
  validatePreferencesRequest(),
  globalRateLimit(),
  updateNotificationPreferences
);

// Error handling middleware for notification routes
router.use((error, req, res, next) => {
  console.error('Notification route error:', error);
  
  // Handle specific notification errors
  if (error.name === 'NotificationError' || error.name === 'NotificationServiceError') {
    let statusCode = 400;
    
    switch (error.code) {
      case 'NOTIFICATION_NOT_FOUND':
      case 'NOT_FOUND':
        statusCode = 404;
        break;
      case 'INSUFFICIENT_PERMISSIONS':
        statusCode = 403;
        break;
      case 'NOT_AUTHENTICATED':
        statusCode = 401;
        break;
      case 'INVALID_USER_ID':
      case 'INVALID_NOTIFICATION_ID':
      case 'MISSING_FIELDS':
      case 'INVALID_CATEGORY':
      case 'INVALID_PRIORITY':
      case 'INVALID_CHANNELS':
        statusCode = 400;
        break;
      case 'CREATE_FAILED':
      case 'UPDATE_FAILED':
      case 'DELETE_FAILED':
      case 'FETCH_FAILED':
        statusCode = 500;
        break;
      default:
        statusCode = 400;
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  // Handle notification preference errors
  if (error.name === 'NotificationPreferenceError') {
    let statusCode = 400;
    
    switch (error.code) {
      case 'PREFERENCE_NOT_FOUND':
        statusCode = 404;
        break;
      case 'INVALID_USER':
      case 'INVALID_FREQUENCY':
      case 'INVALID_TIME_FORMAT':
      case 'INVALID_CHANNEL_FORMAT':
        statusCode = 400;
        break;
      case 'CREATE_FAILED':
      case 'UPDATE_FAILED':
      case 'DELETE_FAILED':
      case 'FETCH_FAILED':
        statusCode = 500;
        break;
      default:
        statusCode = 400;
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  // Handle notification auth errors
  if (error.name === 'NotificationAuthError') {
    return res.status(error.statusCode || 403).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: error.code,
      field: error.field
    });
  }

  // Handle rate limiting errors
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: error.retryAfter
    });
  }

  // Handle database connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }

  // Pass to global error handler
  next(error);
});

module.exports = router;