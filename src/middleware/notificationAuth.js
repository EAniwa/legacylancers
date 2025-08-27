/**
 * Notification Authorization Middleware
 * Handles authorization for notification access with user ownership validation
 */

const validator = require('validator');

class NotificationAuthError extends Error {
  constructor(message, code = 'NOTIFICATION_AUTH_ERROR', statusCode = 403) {
    super(message);
    this.name = 'NotificationAuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Middleware to ensure user can only access their own notifications
 * Validates notification ownership by checking if notification belongs to authenticated user
 */
function requireNotificationOwnership() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const { id } = req.params;
      const userId = req.user.id;

      // Validate notification ID format
      if (!id || !validator.isUUID(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notification ID format',
          code: 'INVALID_NOTIFICATION_ID'
        });
      }

      // For methods that don't need ownership check (like POST endpoints without ID)
      if (!id) {
        return next();
      }

      // Import notification model to check ownership
      const { initializeDatabase } = require('../config/database');
      const { Notification } = require('../models/Notification');

      const db = await initializeDatabase();
      const notification = new Notification(db);

      // Check if notification exists and belongs to user
      const existingNotification = await notification.getById(id, userId);

      if (!existingNotification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found or access denied',
          code: 'NOTIFICATION_NOT_FOUND'
        });
      }

      // Add notification to request for potential use in controller
      req.notification = existingNotification;

      next();

    } catch (error) {
      console.error('Notification ownership middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authorization error',
        code: 'AUTH_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to validate notification ID parameter
 */
function validateNotificationId() {
  return (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Notification ID is required',
          code: 'MISSING_NOTIFICATION_ID'
        });
      }

      if (!validator.isUUID(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notification ID format',
          code: 'INVALID_NOTIFICATION_ID'
        });
      }

      next();

    } catch (error) {
      console.error('Notification ID validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to validate notification request data
 */
function validateNotificationRequest() {
  return (req, res, next) => {
    try {
      // For GET and DELETE requests, no body validation needed
      if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
      }

      // For PUT/POST requests, validate required fields
      const requiredFields = [];
      const optionalFields = [
        'title', 'message', 'category', 'priority', 'templateKey',
        'channels', 'actionUrl', 'relatedEntityType', 'relatedEntityId',
        'scheduledFor', 'expiresAt'
      ];

      // Validate that request has a body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Request body is required',
          code: 'MISSING_BODY'
        });
      }

      // Validate required fields
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            success: false,
            error: `${field} is required`,
            code: 'MISSING_REQUIRED_FIELD',
            field
          });
        }
      }

      // Validate field formats
      if (req.body.category) {
        const validCategories = ['booking', 'messaging', 'system', 'marketing'];
        if (!validCategories.includes(req.body.category)) {
          return res.status(400).json({
            success: false,
            error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            code: 'INVALID_CATEGORY'
          });
        }
      }

      if (req.body.priority) {
        const validPriorities = ['low', 'normal', 'high', 'urgent'];
        if (!validPriorities.includes(req.body.priority)) {
          return res.status(400).json({
            success: false,
            error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
            code: 'INVALID_PRIORITY'
          });
        }
      }

      if (req.body.channels) {
        if (!Array.isArray(req.body.channels)) {
          return res.status(400).json({
            success: false,
            error: 'Channels must be an array',
            code: 'INVALID_CHANNELS_FORMAT'
          });
        }

        const validChannels = ['in_app', 'email', 'sms'];
        const invalidChannels = req.body.channels.filter(channel => !validChannels.includes(channel));
        
        if (invalidChannels.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Invalid channels: ${invalidChannels.join(', ')}. Must be one of: ${validChannels.join(', ')}`,
            code: 'INVALID_CHANNELS'
          });
        }
      }

      // Validate URLs if provided
      if (req.body.actionUrl && !validator.isURL(req.body.actionUrl)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid action URL format',
          code: 'INVALID_ACTION_URL'
        });
      }

      // Validate dates if provided
      if (req.body.scheduledFor && !validator.isISO8601(req.body.scheduledFor)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid scheduledFor date format. Must be ISO 8601',
          code: 'INVALID_SCHEDULED_DATE'
        });
      }

      if (req.body.expiresAt && !validator.isISO8601(req.body.expiresAt)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiresAt date format. Must be ISO 8601',
          code: 'INVALID_EXPIRY_DATE'
        });
      }

      // Validate entity IDs if provided
      if (req.body.relatedEntityId && !validator.isUUID(req.body.relatedEntityId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid related entity ID format',
          code: 'INVALID_ENTITY_ID'
        });
      }

      next();

    } catch (error) {
      console.error('Notification request validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to validate notification preferences request data
 */
function validatePreferencesRequest() {
  return (req, res, next) => {
    try {
      // For GET requests, no body validation needed
      if (req.method === 'GET') {
        return next();
      }

      // Validate that request has a body
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Request body with preference updates is required',
          code: 'MISSING_BODY'
        });
      }

      const allowedFields = [
        'emailEnabled', 'inAppEnabled', 'smsEnabled', 'pushEnabled',
        'bookingNotifications', 'messageNotifications', 'systemNotifications',
        'marketingNotifications', 'quietHoursStart', 'quietHoursEnd',
        'timezone', 'emailDigestFrequency'
      ];

      // Validate that only allowed fields are present
      const invalidFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`,
          code: 'INVALID_FIELDS'
        });
      }

      // Validate boolean fields
      const booleanFields = ['emailEnabled', 'inAppEnabled', 'smsEnabled', 'pushEnabled'];
      for (const field of booleanFields) {
        if (req.body[field] !== undefined && typeof req.body[field] !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: `${field} must be a boolean`,
            code: 'INVALID_BOOLEAN_VALUE',
            field
          });
        }
      }

      // Validate notification channel objects
      const channelFields = ['bookingNotifications', 'messageNotifications', 'systemNotifications', 'marketingNotifications'];
      for (const field of channelFields) {
        if (req.body[field]) {
          if (typeof req.body[field] !== 'object' || req.body[field] === null) {
            return res.status(400).json({
              success: false,
              error: `${field} must be an object`,
              code: 'INVALID_CHANNEL_FORMAT',
              field
            });
          }

          const validChannels = ['email', 'in_app', 'sms'];
          for (const channel of validChannels) {
            if (req.body[field][channel] !== undefined && typeof req.body[field][channel] !== 'boolean') {
              return res.status(400).json({
                success: false,
                error: `${field}.${channel} must be a boolean`,
                code: 'INVALID_CHANNEL_VALUE',
                field: `${field}.${channel}`
              });
            }
          }
        }
      }

      // Validate time format for quiet hours
      const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (req.body.quietHoursStart && !timePattern.test(req.body.quietHoursStart)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quiet hours start time format. Must be HH:MM (24-hour format)',
          code: 'INVALID_TIME_FORMAT',
          field: 'quietHoursStart'
        });
      }

      if (req.body.quietHoursEnd && !timePattern.test(req.body.quietHoursEnd)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quiet hours end time format. Must be HH:MM (24-hour format)',
          code: 'INVALID_TIME_FORMAT',
          field: 'quietHoursEnd'
        });
      }

      // Validate email digest frequency
      if (req.body.emailDigestFrequency) {
        const validFrequencies = ['immediate', 'hourly', 'daily', 'weekly', 'disabled'];
        if (!validFrequencies.includes(req.body.emailDigestFrequency)) {
          return res.status(400).json({
            success: false,
            error: `Invalid email digest frequency. Must be one of: ${validFrequencies.join(', ')}`,
            code: 'INVALID_FREQUENCY'
          });
        }
      }

      next();

    } catch (error) {
      console.error('Notification preferences validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware to sanitize notification input data
 */
function sanitizeNotificationInput() {
  return (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Sanitize string fields
      const stringFields = ['title', 'message', 'templateKey', 'actionUrl', 'relatedEntityType'];
      
      for (const field of stringFields) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          // Trim whitespace
          req.body[field] = req.body[field].trim();
          
          // Escape HTML for title and message to prevent XSS
          if (field === 'title' || field === 'message') {
            req.body[field] = validator.escape(req.body[field]);
          }
        }
      }

      // Sanitize and validate arrays
      if (req.body.channels && Array.isArray(req.body.channels)) {
        req.body.channels = req.body.channels
          .map(channel => typeof channel === 'string' ? channel.trim().toLowerCase() : channel)
          .filter(channel => channel && typeof channel === 'string');
      }

      next();

    } catch (error) {
      console.error('Notification input sanitization middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal sanitization error',
        code: 'SANITIZATION_INTERNAL_ERROR'
      });
    }
  };
}

module.exports = {
  requireNotificationOwnership,
  validateNotificationId,
  validateNotificationRequest,
  validatePreferencesRequest,
  sanitizeNotificationInput,
  NotificationAuthError
};