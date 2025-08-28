/**
 * Notification Controllers
 * Handles notification CRUD operations with authorization and audit logging
 */

const { NotificationService, NotificationServiceError } = require('../services/notificationService');
const { NotificationPreference, NotificationPreferenceError } = require('../models/NotificationPreference');
const { initializeDatabase } = require('../config/database');
const validator = require('validator');

// Initialize database connection and services
let db, notificationService, notificationPreference;

(async () => {
  try {
    db = await initializeDatabase();
    notificationService = new NotificationService(db);
    notificationPreference = new NotificationPreference(db);
  } catch (error) {
    console.error('Failed to initialize notification controller dependencies:', error);
  }
})();

/**
 * Get user notifications with pagination and filtering
 * GET /api/notifications
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    
    // Parse query parameters
    const {
      page = 1,
      limit = 20,
      category = null,
      priority = null,
      unreadOnly = false
    } = req.query;

    // Validate pagination parameters
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    if (pageInt < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page must be a positive integer',
        code: 'INVALID_PAGE'
      });
    }

    if (limitInt < 1 || limitInt > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT'
      });
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['booking', 'messaging', 'system', 'marketing'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category. Must be one of: booking, messaging, system, marketing',
          code: 'INVALID_CATEGORY'
        });
      }
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority. Must be one of: low, normal, high, urgent',
          code: 'INVALID_PRIORITY'
        });
      }
    }

    const options = {
      limit: limitInt,
      offset: (pageInt - 1) * limitInt,
      category,
      priority,
      unreadOnly: unreadOnly === 'true'
    };

    // Log audit event
    console.log(`[AUDIT] User notifications fetch`, {
      userId,
      options,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Get notifications
    const result = await notificationService.getUserNotifications(userId, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get notifications error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] User notifications fetch failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof NotificationServiceError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
      code: 'NOTIFICATIONS_GET_FAILED'
    });
  }
}

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate notification ID
    if (!validator.isUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID format',
        code: 'INVALID_NOTIFICATION_ID'
      });
    }

    // Log audit event
    console.log(`[AUDIT] Mark notification as read`, {
      notificationId: id,
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Mark as read
    const result = await notificationService.markNotificationAsRead(id, userId);

    // Log success
    console.log(`[AUDIT] Notification marked as read successfully`, {
      notificationId: id,
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification: result
      }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Mark notification as read failed`, {
      notificationId: req.params.id,
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof NotificationServiceError) {
      const statusCode = error.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      code: 'MARK_READ_FAILED'
    });
  }
}

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
async function markAllNotificationsAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { category } = req.query;

    // Validate category if provided
    if (category) {
      const validCategories = ['booking', 'messaging', 'system', 'marketing'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category. Must be one of: booking, messaging, system, marketing',
          code: 'INVALID_CATEGORY'
        });
      }
    }

    // Log audit event
    console.log(`[AUDIT] Mark all notifications as read`, {
      userId,
      category,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Use the notification model directly for this operation
    const { Notification } = require('../models/Notification');
    const notification = new Notification(db);
    const count = await notification.markAllAsRead(userId, category);

    // Log success
    console.log(`[AUDIT] All notifications marked as read successfully`, {
      userId,
      category,
      count,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: {
        markedCount: count
      }
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Mark all notifications as read failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error.name === 'NotificationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
      code: 'MARK_ALL_READ_FAILED'
    });
  }
}

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate notification ID
    if (!validator.isUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification ID format',
        code: 'INVALID_NOTIFICATION_ID'
      });
    }

    // Log audit event
    console.log(`[AUDIT] Delete notification`, {
      notificationId: id,
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Use the notification model directly for this operation
    const { Notification } = require('../models/Notification');
    const notification = new Notification(db);
    const deleted = await notification.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
        code: 'NOTIFICATION_NOT_FOUND'
      });
    }

    // Log success
    console.log(`[AUDIT] Notification deleted successfully`, {
      notificationId: id,
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Delete notification failed`, {
      notificationId: req.params.id,
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error.name === 'NotificationError') {
      const statusCode = error.code === 'NOTIFICATION_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
      code: 'DELETE_FAILED'
    });
  }
}

/**
 * Get user notification preferences
 * GET /api/notification-preferences
 */
async function getNotificationPreferences(req, res) {
  try {
    const userId = req.user.id;

    // Log audit event
    console.log(`[AUDIT] Get notification preferences`, {
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Get preferences
    let preferences = await notificationPreference.getByUserId(userId);
    
    if (!preferences) {
      // Create default preferences if none exist
      preferences = await notificationPreference.createDefault(userId);
    }

    res.json({
      success: true,
      data: {
        preferences
      }
    });

  } catch (error) {
    console.error('Get notification preferences error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Get notification preferences failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof NotificationPreferenceError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification preferences',
      code: 'PREFERENCES_GET_FAILED'
    });
  }
}

/**
 * Update user notification preferences
 * PUT /api/notification-preferences
 */
async function updateNotificationPreferences(req, res) {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Validate updates object
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Update data is required',
        code: 'NO_UPDATE_DATA'
      });
    }

    // Log audit event
    console.log(`[AUDIT] Update notification preferences`, {
      userId,
      updates,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Update preferences
    const result = await notificationService.updateUserPreferences(userId, updates);

    // Log success
    console.log(`[AUDIT] Notification preferences updated successfully`, {
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        preferences: result
      }
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Update notification preferences failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof NotificationServiceError || error instanceof NotificationPreferenceError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences',
      code: 'PREFERENCES_UPDATE_FAILED'
    });
  }
}

/**
 * Send test notification (development/testing only)
 * POST /api/notifications/test
 */
async function sendTestNotification(req, res) {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test notifications not allowed in production',
        code: 'NOT_ALLOWED_IN_PRODUCTION'
      });
    }

    const userId = req.user.id;
    const {
      templateKey = 'test_notification',
      title = 'Test Notification',
      message = 'This is a test notification',
      category = 'system',
      priority = 'normal',
      channels = ['in_app']
    } = req.body;

    // Validate channels
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Channels must be a non-empty array',
        code: 'INVALID_CHANNELS'
      });
    }

    const validChannels = ['in_app', 'email', 'sms'];
    const invalidChannels = channels.filter(channel => !validChannels.includes(channel));
    if (invalidChannels.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid channels: ${invalidChannels.join(', ')}. Must be one of: ${validChannels.join(', ')}`,
        code: 'INVALID_CHANNELS'
      });
    }

    // Log audit event
    console.log(`[AUDIT] Send test notification`, {
      userId,
      templateKey,
      channels,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // For test notifications, we'll create an in-app notification directly
    if (channels.includes('in_app')) {
      const { Notification } = require('../models/Notification');
      const notification = new Notification(db);
      
      const testNotification = await notification.create({
        userId,
        templateKey,
        title,
        message,
        category,
        priority,
        data: {
          test: true,
          createdBy: 'test-api',
          timestamp: new Date().toISOString()
        }
      });

      // Log success
      console.log(`[AUDIT] Test notification sent successfully`, {
        userId,
        notificationId: testNotification.id,
        timestamp: new Date().toISOString(),
        ip: req.ip
      });

      return res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          notification: testNotification,
          channels: ['in_app']
        }
      });
    }

    // For other channels, we'd use the notification service
    // This is simplified for now
    res.json({
      success: true,
      message: 'Test notification feature not fully implemented for non-in-app channels',
      data: {
        requested: { templateKey, title, message, category, priority, channels }
      }
    });

  } catch (error) {
    console.error('Send test notification error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Send test notification failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error.name === 'NotificationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      code: 'TEST_NOTIFICATION_FAILED'
    });
  }
}

/**
 * Get notification statistics for the current user
 * GET /api/notifications/stats
 */
async function getNotificationStats(req, res) {
  try {
    const userId = req.user.id;

    // Log audit event
    console.log(`[AUDIT] Get notification stats`, {
      userId,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Get stats
    const stats = await notificationService.getUserNotificationStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get notification stats error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Get notification stats failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof NotificationServiceError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification statistics',
      code: 'STATS_GET_FAILED'
    });
  }
}

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
  getNotificationStats
};