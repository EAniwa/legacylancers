/**
 * Core Notification Service
 * Orchestrates multi-channel notification delivery with template management
 */

const { Notification, NotificationError } = require('../models/Notification');
const { NotificationTemplate } = require('../models/NotificationTemplate');
const { NotificationPreference } = require('../models/NotificationPreference');
const { NotificationQueue } = require('../models/NotificationQueue');
const { EmailNotificationService } = require('./emailNotificationService');
const validator = require('validator');

class NotificationServiceError extends Error {
  constructor(message, code = 'NOTIFICATION_SERVICE_ERROR') {
    super(message);
    this.name = 'NotificationServiceError';
    this.code = code;
  }
}

/**
 * Core Notification Service Class
 * Manages notification orchestration, template rendering, and multi-channel delivery
 */
class NotificationService {
  constructor(db) {
    this.db = db;
    this.notification = new Notification(db);
    this.template = new NotificationTemplate(db);
    this.preference = new NotificationPreference(db);
    this.queue = new NotificationQueue(db);
    
    // Initialize email notification service
    this.emailService = new EmailNotificationService(db);
    
    // Other service dependencies (to be injected)
    this.inAppService = null;
    this.smsService = null;
    this.pushService = null;
    
    // Configuration
    this.config = {
      maxBatchSize: 100,
      retryDelayMinutes: 5,
      maxRetryAttempts: 3,
      priorityWeights: {
        urgent: 100,
        high: 75,
        normal: 50,
        low: 25
      }
    };
  }

  /**
   * Set service dependencies
   * @param {Object} services - Service dependencies
   */
  setServices(services = {}) {
    if (services.emailService) this.emailService = services.emailService;
    if (services.inAppService) this.inAppService = services.inAppService;
    if (services.smsService) this.smsService = services.smsService;
    if (services.pushService) this.pushService = services.pushService;
  }

  /**
   * Get user profile data for template rendering
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(userId) {
    try {
      const query = `
        SELECT 
          u.id, u.email, u.first_name, u.last_name,
          p.public_profile_url, p.headline, p.summary
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `;
      
      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new NotificationServiceError('User not found', 'USER_NOT_FOUND');
      }
      
      const user = result.rows[0];
      return {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        fullName: `${user.first_name} ${user.last_name}`,
        profileUrl: user.public_profile_url,
        headline: user.headline,
        summary: user.summary
      };
      
    } catch (error) {
      if (error instanceof NotificationServiceError) {
        throw error;
      }
      throw new NotificationServiceError(`Failed to get user profile: ${error.message}`, 'PROFILE_FETCH_FAILED');
    }
  }

  /**
   * Send notification to user
   * @param {Object} notificationData - Notification data
   * @param {string} notificationData.userId - User ID
   * @param {string} notificationData.templateKey - Template key
   * @param {Object} notificationData.templateData - Data for template rendering
   * @param {Object} notificationData.options - Notification options
   * @returns {Promise<Object>} Notification result
   */
  async sendNotification(notificationData) {
    const {
      userId,
      templateKey,
      templateData = {},
      options = {}
    } = notificationData;

    // Validate required fields
    if (!userId || !templateKey) {
      throw new NotificationServiceError('User ID and template key are required', 'MISSING_FIELDS');
    }

    if (!validator.isUUID(userId)) {
      throw new NotificationServiceError('Invalid user ID format', 'INVALID_USER_ID');
    }

    try {
      // Get template
      const template = await this.template.getByKey(templateKey);
      if (!template) {
        throw new NotificationServiceError(`Template not found: ${templateKey}`, 'TEMPLATE_NOT_FOUND');
      }

      // Validate template variables
      const validation = await this.template.validateVariables(templateKey, templateData);
      if (!validation.isValid) {
        throw new NotificationServiceError(
          `Missing template variables: ${validation.missingVariables.join(', ')}`,
          'INVALID_TEMPLATE_DATA'
        );
      }

      // Get user preferences
      let preferences = await this.preference.getByUserId(userId);
      if (!preferences) {
        // Create default preferences if none exist
        preferences = await this.preference.createDefault(userId);
      }

      // Determine which channels to use
      const channels = await this.determineChannels(template, preferences, options);
      
      if (channels.length === 0) {
        return {
          success: true,
          message: 'No channels enabled for user',
          channels: [],
          notifications: []
        };
      }

      // Render templates for each channel
      const renderedTemplates = {};
      for (const channel of channels) {
        if (template.supportsEmail && channel === 'email') {
          renderedTemplates.emailSubject = await this.template.renderTemplate(
            templateKey, 'email_subject', templateData
          );
          renderedTemplates.emailHtml = await this.template.renderTemplate(
            templateKey, 'email_html', templateData
          );
          renderedTemplates.emailText = await this.template.renderTemplate(
            templateKey, 'email_text', templateData
          );
        }
        
        if (template.supportsInApp && channel === 'in_app') {
          renderedTemplates.inApp = await this.template.renderTemplate(
            templateKey, 'in_app', templateData
          );
        }
        
        if (template.supportsSms && channel === 'sms') {
          renderedTemplates.sms = await this.template.renderTemplate(
            templateKey, 'sms', templateData
          );
        }
      }

      // Send notifications
      const results = await this.sendToChannels({
        userId,
        templateKey,
        template,
        renderedTemplates,
        channels,
        templateData,
        options
      });

      return {
        success: true,
        templateKey,
        channels,
        results
      };

    } catch (error) {
      if (error instanceof NotificationServiceError) {
        throw error;
      }
      throw new NotificationServiceError(`Failed to send notification: ${error.message}`, 'SEND_FAILED');
    }
  }

  /**
   * Send bulk notifications
   * @param {Array} notifications - Array of notification data
   * @param {Object} options - Bulk options
   * @returns {Promise<Object>} Bulk send results
   */
  async sendBulkNotifications(notifications, options = {}) {
    const { batchSize = this.config.maxBatchSize } = options;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      throw new NotificationServiceError('Notifications array is required', 'MISSING_NOTIFICATIONS');
    }

    if (notifications.length > 1000) {
      throw new NotificationServiceError('Too many notifications. Maximum 1000 per batch', 'BATCH_TOO_LARGE');
    }

    try {
      const results = [];
      const errors = [];

      // Process in batches
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(notificationData => this.sendNotification(notificationData))
        );

        batchResults.forEach((result, index) => {
          const globalIndex = i + index;
          if (result.status === 'fulfilled') {
            results.push({
              index: globalIndex,
              ...result.value
            });
          } else {
            errors.push({
              index: globalIndex,
              error: result.reason.message,
              code: result.reason.code
            });
          }
        });
      }

      return {
        success: errors.length === 0,
        totalNotifications: notifications.length,
        successfulNotifications: results.length,
        failedNotifications: errors.length,
        results,
        errors
      };

    } catch (error) {
      throw new NotificationServiceError(`Bulk notification failed: ${error.message}`, 'BULK_FAILED');
    }
  }

  /**
   * Queue notification for background processing
   * @param {Object} notificationData - Notification data
   * @param {Object} options - Queue options
   * @returns {Promise<Object>} Queue result
   */
  async queueNotification(notificationData, options = {}) {
    const {
      userId,
      templateKey,
      templateData = {},
      recipientEmail = null,
      recipientPhone = null,
      priority = 0,
      scheduledFor = null,
      channels = ['in_app']
    } = notificationData;

    const { maxAttempts = this.config.maxRetryAttempts } = options;

    try {
      const queueItem = await this.queue.add({
        userId,
        templateKey,
        recipientEmail,
        recipientPhone,
        templateData,
        channels,
        priority,
        scheduledFor,
        maxAttempts
      });

      return {
        success: true,
        queueId: queueItem.id,
        scheduledFor: queueItem.scheduledFor || queueItem.nextAttemptAt,
        channels
      };

    } catch (error) {
      throw new NotificationServiceError(`Failed to queue notification: ${error.message}`, 'QUEUE_FAILED');
    }
  }

  /**
   * Process queued notifications
   * @param {number} batchSize - Number of items to process
   * @returns {Promise<Object>} Processing results
   */
  async processQueue(batchSize = 50) {
    if (batchSize < 1 || batchSize > 200) {
      throw new NotificationServiceError('Invalid batch size. Must be between 1 and 200', 'INVALID_BATCH_SIZE');
    }

    try {
      // Get next items to process
      const queueItems = await this.queue.getNextToProcess(batchSize);
      
      if (queueItems.length === 0) {
        return {
          success: true,
          processedCount: 0,
          successCount: 0,
          failureCount: 0,
          results: []
        };
      }

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      // Process each queue item
      for (const queueItem of queueItems) {
        try {
          // Send the notification
          const result = await this.sendNotification({
            userId: queueItem.userId,
            templateKey: queueItem.templateKey,
            templateData: queueItem.templateData,
            options: {
              channels: queueItem.channels,
              recipientEmail: queueItem.recipientEmail,
              recipientPhone: queueItem.recipientPhone
            }
          });

          // Mark as completed
          await this.queue.markCompleted(queueItem.id, result);
          
          results.push({
            queueId: queueItem.id,
            success: true,
            result
          });
          successCount++;

        } catch (error) {
          // Mark as failed and potentially retry
          await this.queue.markFailed(queueItem.id, error.message, this.config.retryDelayMinutes);
          
          results.push({
            queueId: queueItem.id,
            success: false,
            error: error.message,
            code: error.code
          });
          failureCount++;
        }
      }

      return {
        success: true,
        processedCount: queueItems.length,
        successCount,
        failureCount,
        results
      };

    } catch (error) {
      throw new NotificationServiceError(`Failed to process queue: ${error.message}`, 'PROCESS_QUEUE_FAILED');
    }
  }

  /**
   * Get user notifications with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User notifications
   */
  async getUserNotifications(userId, options = {}) {
    if (!userId) {
      throw new NotificationServiceError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      return await this.notification.getForUser(userId, options);
    } catch (error) {
      throw new NotificationServiceError(`Failed to get user notifications: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated notification
   */
  async markNotificationAsRead(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new NotificationServiceError('Notification ID and User ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const result = await this.notification.markAsRead(notificationId, userId);
      if (!result) {
        throw new NotificationServiceError('Notification not found or already read', 'NOT_FOUND');
      }
      return result;
    } catch (error) {
      if (error instanceof NotificationServiceError) {
        throw error;
      }
      throw new NotificationServiceError(`Failed to mark as read: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Get notification statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Notification statistics
   */
  async getUserNotificationStats(userId) {
    if (!userId) {
      throw new NotificationServiceError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      const [
        totalUnread,
        bookingUnread,
        messageUnread,
        systemUnread
      ] = await Promise.all([
        this.notification.getUnreadCount(userId),
        this.notification.getUnreadCount(userId, 'booking'),
        this.notification.getUnreadCount(userId, 'messaging'),
        this.notification.getUnreadCount(userId, 'system')
      ]);

      return {
        unreadCounts: {
          total: totalUnread,
          booking: bookingUnread,
          messaging: messageUnread,
          system: systemUnread,
          marketing: Math.max(0, totalUnread - bookingUnread - messageUnread - systemUnread)
        }
      };

    } catch (error) {
      throw new NotificationServiceError(`Failed to get notification stats: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Update user notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updateUserPreferences(userId, preferences) {
    if (!userId) {
      throw new NotificationServiceError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      const result = await this.preference.update(userId, preferences);
      if (!result) {
        // Create preferences if they don't exist
        return await this.preference.createDefault(userId, preferences);
      }
      return result;
    } catch (error) {
      throw new NotificationServiceError(`Failed to update preferences: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Determine which channels to use based on template, preferences, and options
   * @param {Object} template - Notification template
   * @param {Object} preferences - User preferences
   * @param {Object} options - Notification options
   * @returns {Promise<Array>} Array of channels to use
   */
  async determineChannels(template, preferences, options) {
    const channels = [];
    const { channels: optionChannels, priority = template.priority } = options;

    // If channels are explicitly specified in options, use those (with preference checking)
    if (optionChannels && Array.isArray(optionChannels)) {
      for (const channel of optionChannels) {
        const shouldSend = await this.preference.shouldReceiveNotification(
          preferences.userId, 
          channel, 
          template.category
        );
        
        if (shouldSend && this.isChannelSupported(template, channel)) {
          channels.push(channel);
        }
      }
      return channels;
    }

    // Determine channels based on template support and user preferences
    const channelChecks = [
      { channel: 'in_app', supported: template.supportsInApp },
      { channel: 'email', supported: template.supportsEmail },
      { channel: 'sms', supported: template.supportsSms }
    ];

    for (const { channel, supported } of channelChecks) {
      if (supported) {
        const shouldSend = await this.preference.shouldReceiveNotification(
          preferences.userId, 
          channel, 
          template.category
        );
        
        if (shouldSend) {
          // For urgent notifications, always include email if supported
          if (priority === 'urgent' && channel === 'email') {
            channels.push(channel);
          } else if (priority !== 'urgent' || channel !== 'email') {
            channels.push(channel);
          }
        }
      }
    }

    // Ensure at least in-app notification for urgent messages
    if (priority === 'urgent' && !channels.includes('in_app') && template.supportsInApp) {
      channels.push('in_app');
    }

    return channels;
  }

  /**
   * Check if template supports a specific channel
   * @param {Object} template - Notification template
   * @param {string} channel - Channel name
   * @returns {boolean} True if supported
   */
  isChannelSupported(template, channel) {
    switch (channel) {
      case 'email':
        return template.supportsEmail;
      case 'in_app':
        return template.supportsInApp;
      case 'sms':
        return template.supportsSms;
      default:
        return false;
    }
  }

  /**
   * Send notifications to specified channels
   * @param {Object} params - Send parameters
   * @returns {Promise<Array>} Channel results
   */
  async sendToChannels(params) {
    const {
      userId,
      templateKey,
      template,
      renderedTemplates,
      channels,
      templateData,
      options
    } = params;

    const results = [];

    for (const channel of channels) {
      try {
        let result;

        switch (channel) {
          case 'email':
            if (this.emailService && renderedTemplates.emailHtml) {
              result = await this.sendEmailNotification({
                userId,
                subject: renderedTemplates.emailSubject.content,
                htmlContent: renderedTemplates.emailHtml.content,
                textContent: renderedTemplates.emailText?.content,
                templateKey,
                recipientEmail: options.recipientEmail
              });
            } else {
              throw new Error('Email service not available or template not rendered');
            }
            break;

          case 'in_app':
            if (renderedTemplates.inApp) {
              result = await this.sendInAppNotification({
                userId,
                templateKey,
                title: this.extractTitle(renderedTemplates.inApp.content),
                message: renderedTemplates.inApp.content,
                data: templateData,
                category: template.category,
                priority: template.priority,
                actionUrl: options.actionUrl,
                relatedEntityType: options.relatedEntityType,
                relatedEntityId: options.relatedEntityId
              });
            }
            break;

          case 'sms':
            if (this.smsService && renderedTemplates.sms) {
              result = await this.sendSmsNotification({
                userId,
                message: renderedTemplates.sms.content,
                templateKey,
                recipientPhone: options.recipientPhone
              });
            } else {
              throw new Error('SMS service not available or template not rendered');
            }
            break;

          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        results.push({
          channel,
          success: true,
          result
        });

      } catch (error) {
        results.push({
          channel,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Send email notification
   * @param {Object} params - Email parameters
   * @returns {Promise<Object>} Email result
   */
  async sendEmailNotification(params) {
    if (!this.emailService) {
      throw new NotificationServiceError('Email service not configured', 'SERVICE_NOT_AVAILABLE');
    }

    const {
      userId,
      subject,
      htmlContent,
      textContent,
      templateKey,
      recipientEmail,
      category = 'system',
      priority = 'normal',
      metadata = {}
    } = params;

    try {
      // Get user profile for personalization if recipient email not provided
      let userProfile = null;
      let finalRecipientEmail = recipientEmail;
      
      if (!finalRecipientEmail || !finalRecipientEmail.includes('@')) {
        userProfile = await this.getUserProfile(userId);
        finalRecipientEmail = userProfile.email;
      }
      
      // Get user name for email
      let recipientName = 'User';
      if (userProfile) {
        recipientName = userProfile.firstName || userProfile.fullName || 'User';
      } else {
        // Try to get name from database if we have email
        try {
          const nameQuery = `SELECT first_name, last_name FROM users WHERE email = $1 LIMIT 1`;
          const nameResult = await this.db.query(nameQuery, [finalRecipientEmail]);
          if (nameResult.rows.length > 0) {
            recipientName = nameResult.rows[0].first_name || 
                          `${nameResult.rows[0].first_name} ${nameResult.rows[0].last_name}` ||
                          'User';
          }
        } catch (error) {
          // Fallback to 'User' if we can't get the name
          console.warn('Could not retrieve user name for email:', error.message);
        }
      }

      return await this.emailService.sendNotificationEmail({
        userId,
        recipientEmail: finalRecipientEmail,
        recipientName,
        templateKey,
        subject,
        htmlContent,
        textContent,
        category,
        priority,
        metadata
      });

    } catch (error) {
      throw new NotificationServiceError(`Failed to send email notification: ${error.message}`, 'EMAIL_SEND_FAILED');
    }
  }

  /**
   * Send in-app notification
   * @param {Object} params - In-app parameters
   * @returns {Promise<Object>} In-app result
   */
  async sendInAppNotification(params) {
    const {
      userId,
      templateKey,
      title,
      message,
      data = {},
      category,
      priority = 'normal',
      actionUrl = null,
      relatedEntityType = null,
      relatedEntityId = null
    } = params;

    return await this.notification.create({
      userId,
      templateKey,
      title,
      message,
      data,
      category,
      priority,
      actionUrl,
      relatedEntityType,
      relatedEntityId
    });
  }

  /**
   * Send SMS notification
   * @param {Object} params - SMS parameters
   * @returns {Promise<Object>} SMS result
   */
  async sendSmsNotification(params) {
    if (!this.smsService) {
      throw new NotificationServiceError('SMS service not configured', 'SERVICE_NOT_AVAILABLE');
    }

    // This will be implemented when we create the SMS service
    throw new NotificationServiceError('SMS notification service not yet implemented', 'NOT_IMPLEMENTED');
  }

  /**
   * Extract title from notification content
   * @param {string} content - Notification content
   * @returns {string} Extracted title
   */
  extractTitle(content) {
    if (!content) return 'Notification';
    
    // Extract first line or first 50 characters as title
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    if (firstLine.length > 50) {
      return firstLine.substring(0, 47) + '...';
    }
    
    return firstLine || 'Notification';
  }

  /**
   * Clean up expired notifications
   * @returns {Promise<number>} Number of notifications cleaned up
   */
  async cleanupExpiredNotifications() {
    try {
      return await this.notification.cleanupExpired();
    } catch (error) {
      throw new NotificationServiceError(`Failed to cleanup expired notifications: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  /**
   * Reset stuck queue items
   * @returns {Promise<number>} Number of items reset
   */
  async resetStuckQueueItems() {
    try {
      return await this.queue.resetStuckItems();
    } catch (error) {
      throw new NotificationServiceError(`Failed to reset stuck queue items: ${error.message}`, 'RESET_FAILED');
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats() {
    try {
      return await this.queue.getStats();
    } catch (error) {
      throw new NotificationServiceError(`Failed to get queue stats: ${error.message}`, 'STATS_FAILED');
    }
  }
}

module.exports = {
  NotificationService,
  NotificationServiceError
};