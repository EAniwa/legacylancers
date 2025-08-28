/**
 * Email Notification Service
 * Extends existing email service for notification-specific email delivery
 */

const { EmailService, EmailError } = require('./email');
const validator = require('validator');

class EmailNotificationError extends Error {
  constructor(message, code = 'EMAIL_NOTIFICATION_ERROR') {
    super(message);
    this.name = 'EmailNotificationError';
    this.code = code;
  }
}

/**
 * Email Notification Service Class
 * Handles notification-specific email delivery with template support
 */
class EmailNotificationService {
  constructor(db) {
    this.db = db;
    this.emailService = EmailService;
    
    // Notification-specific rate limits (more permissive than auth emails)
    this.notificationRateLimits = {
      booking_notification: {
        maxPerHour: 10,
        maxPerDay: 50
      },
      message_notification: {
        maxPerHour: 20,
        maxPerDay: 100
      },
      system_notification: {
        maxPerHour: 5,
        maxPerDay: 20
      },
      marketing_notification: {
        maxPerHour: 1,
        maxPerDay: 3
      }
    };

    // Rate limiting storage (in production, this would use Redis)
    this.notificationCounts = new Map();
  }

  /**
   * Send notification email
   * @param {Object} emailData - Email data
   * @param {string} emailData.userId - User ID
   * @param {string} emailData.recipientEmail - Recipient email address
   * @param {string} emailData.recipientName - Recipient name
   * @param {string} emailData.templateKey - Notification template key
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.htmlContent - HTML email content
   * @param {string} emailData.textContent - Plain text email content
   * @param {string} emailData.category - Notification category
   * @param {string} emailData.priority - Notification priority
   * @param {Object} emailData.metadata - Additional metadata
   * @returns {Promise<Object>} Email sending result
   */
  async sendNotificationEmail(emailData) {
    const {
      userId,
      recipientEmail,
      recipientName,
      templateKey,
      subject,
      htmlContent,
      textContent = null,
      category,
      priority = 'normal',
      metadata = {}
    } = emailData;

    // Validate required fields
    if (!userId || !recipientEmail || !recipientName || !templateKey || !subject || !htmlContent || !category) {
      throw new EmailNotificationError('Missing required email notification fields', 'MISSING_FIELDS');
    }

    if (!validator.isEmail(recipientEmail)) {
      throw new EmailNotificationError('Invalid recipient email address', 'INVALID_EMAIL');
    }

    if (!validator.isUUID(userId)) {
      throw new EmailNotificationError('Invalid user ID format', 'INVALID_USER_ID');
    }

    try {
      // Check notification-specific rate limits
      await this.checkNotificationRateLimit(recipientEmail, category);

      // Prepare email data for the base email service
      const emailPayload = {
        to: recipientEmail,
        from: {
          email: this.emailService.config.fromEmail,
          name: this.emailService.config.fromName
        },
        subject: subject,
        html: this.wrapNotificationHtml(htmlContent, {
          recipientName,
          templateKey,
          category,
          unsubscribeUrl: this.generateUnsubscribeUrl(userId, category),
          preferencesUrl: this.generatePreferencesUrl(userId)
        }),
        text: textContent || this.htmlToText(htmlContent)
      };

      // Add notification headers for tracking
      emailPayload.headers = {
        'X-Notification-Template': templateKey,
        'X-Notification-Category': category,
        'X-Notification-Priority': priority,
        'X-Notification-User-ID': userId
      };

      // Send email using the base email service
      const result = await this.emailService.sendEmail(emailPayload);

      // Update rate limiting
      await this.updateNotificationRateLimit(recipientEmail, category);

      // Log delivery attempt
      await this.logDeliveryAttempt({
        userId,
        templateKey,
        recipientEmail,
        messageId: result.messageId,
        category,
        priority,
        status: 'sent',
        metadata
      });

      return {
        success: true,
        messageId: result.messageId,
        recipient: recipientEmail,
        templateKey,
        category,
        priority,
        sentAt: new Date()
      };

    } catch (error) {
      // Log failed delivery
      await this.logDeliveryAttempt({
        userId,
        templateKey,
        recipientEmail,
        messageId: null,
        category,
        priority,
        status: 'failed',
        errorMessage: error.message,
        errorCode: error.code,
        metadata
      });

      if (error instanceof EmailError) {
        throw new EmailNotificationError(`Email delivery failed: ${error.message}`, error.code);
      }
      
      throw new EmailNotificationError(`Failed to send notification email: ${error.message}`, 'SEND_FAILED');
    }
  }

  /**
   * Send bulk notification emails
   * @param {Array} emailDataArray - Array of email data objects
   * @param {Object} options - Bulk sending options
   * @returns {Promise<Object>} Bulk sending results
   */
  async sendBulkNotificationEmails(emailDataArray, options = {}) {
    const { batchSize = 50, delayBetweenBatches = 1000 } = options;

    if (!Array.isArray(emailDataArray) || emailDataArray.length === 0) {
      throw new EmailNotificationError('Email data array is required', 'MISSING_EMAIL_DATA');
    }

    if (emailDataArray.length > 500) {
      throw new EmailNotificationError('Too many emails. Maximum 500 per bulk operation', 'BULK_TOO_LARGE');
    }

    try {
      const results = [];
      const errors = [];

      // Process in batches to avoid overwhelming the email service
      for (let i = 0; i < emailDataArray.length; i += batchSize) {
        const batch = emailDataArray.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (emailData, index) => {
          const globalIndex = i + index;
          try {
            const result = await this.sendNotificationEmail(emailData);
            return { index: globalIndex, success: true, result };
          } catch (error) {
            return { 
              index: globalIndex, 
              success: false, 
              error: error.message, 
              code: error.code,
              recipientEmail: emailData.recipientEmail
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              results.push(result.value);
            } else {
              errors.push(result.value);
            }
          } else {
            errors.push({
              index: i + batchResults.indexOf(result),
              success: false,
              error: result.reason.message,
              code: result.reason.code || 'UNKNOWN_ERROR'
            });
          }
        });

        // Add delay between batches if specified
        if (delayBetweenBatches > 0 && i + batchSize < emailDataArray.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      return {
        success: errors.length === 0,
        totalEmails: emailDataArray.length,
        successfulEmails: results.length,
        failedEmails: errors.length,
        results: results.map(r => r.result),
        errors
      };

    } catch (error) {
      throw new EmailNotificationError(`Bulk email sending failed: ${error.message}`, 'BULK_SEND_FAILED');
    }
  }

  /**
   * Send digest email with multiple notifications
   * @param {Object} digestData - Digest data
   * @param {string} digestData.userId - User ID
   * @param {string} digestData.recipientEmail - Recipient email
   * @param {string} digestData.recipientName - Recipient name
   * @param {Array} digestData.notifications - Array of notifications to include
   * @param {string} digestData.frequency - Digest frequency (hourly, daily, weekly)
   * @returns {Promise<Object>} Email sending result
   */
  async sendDigestEmail(digestData) {
    const {
      userId,
      recipientEmail,
      recipientName,
      notifications,
      frequency = 'daily'
    } = digestData;

    if (!userId || !recipientEmail || !recipientName || !Array.isArray(notifications)) {
      throw new EmailNotificationError('Missing required digest fields', 'MISSING_DIGEST_FIELDS');
    }

    if (notifications.length === 0) {
      return {
        success: true,
        message: 'No notifications to include in digest',
        skipped: true
      };
    }

    try {
      // Group notifications by category
      const groupedNotifications = this.groupNotificationsByCategory(notifications);
      
      // Generate digest content
      const subject = this.generateDigestSubject(frequency, notifications.length);
      const htmlContent = this.generateDigestHtml({
        recipientName,
        frequency,
        groupedNotifications,
        totalCount: notifications.length
      });
      const textContent = this.generateDigestText({
        recipientName,
        frequency,
        groupedNotifications,
        totalCount: notifications.length
      });

      return await this.sendNotificationEmail({
        userId,
        recipientEmail,
        recipientName,
        templateKey: `digest_${frequency}`,
        subject,
        htmlContent,
        textContent,
        category: 'system',
        priority: 'low',
        metadata: {
          digestFrequency: frequency,
          notificationCount: notifications.length,
          categories: Object.keys(groupedNotifications)
        }
      });

    } catch (error) {
      throw new EmailNotificationError(`Failed to send digest email: ${error.message}`, 'DIGEST_SEND_FAILED');
    }
  }

  /**
   * Check notification-specific rate limits
   * @param {string} email - Recipient email
   * @param {string} category - Notification category
   */
  async checkNotificationRateLimit(email, category) {
    const limits = this.notificationRateLimits[`${category}_notification`] || 
                  this.notificationRateLimits.system_notification;

    const key = `${email}:${category}_notification`;
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get existing counts
    const counts = this.notificationCounts.get(key) || [];
    
    // Filter to relevant time periods
    const hourCounts = counts.filter(timestamp => timestamp > hourAgo);
    const dayCounts = counts.filter(timestamp => timestamp > dayAgo);

    // Check limits
    if (hourCounts.length >= limits.maxPerHour) {
      throw new EmailNotificationError(
        `Too many ${category} notification emails sent in the last hour. Please try again later.`, 
        'RATE_LIMIT_HOUR'
      );
    }

    if (dayCounts.length >= limits.maxPerDay) {
      throw new EmailNotificationError(
        `Too many ${category} notification emails sent in the last 24 hours. Please try again later.`, 
        'RATE_LIMIT_DAY'
      );
    }
  }

  /**
   * Update notification rate limiting counters
   * @param {string} email - Recipient email
   * @param {string} category - Notification category
   */
  async updateNotificationRateLimit(email, category) {
    const key = `${email}:${category}_notification`;
    const now = new Date();
    
    // Get existing counts and add current timestamp
    const counts = this.notificationCounts.get(key) || [];
    counts.push(now);
    
    // Keep only last 24 hours
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentCounts = counts.filter(timestamp => timestamp > dayAgo);
    
    this.notificationCounts.set(key, recentCounts);
  }

  /**
   * Wrap notification HTML content with standard email template
   * @param {string} content - Notification content
   * @param {Object} context - Template context
   * @returns {string} Wrapped HTML content
   */
  wrapNotificationHtml(content, context) {
    const { recipientName, templateKey, category, unsubscribeUrl, preferencesUrl } = context;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LegacyLancers Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { color: #007bff; font-size: 24px; font-weight: bold; }
        .content { margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .unsubscribe { font-size: 11px; color: #999; margin-top: 20px; }
        .category-badge { display: inline-block; padding: 4px 8px; background-color: #e9ecef; color: #495057; border-radius: 4px; font-size: 10px; text-transform: uppercase; margin-bottom: 10px; }
        ${this.getCategoryStyles(category)}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">LegacyLancers</div>
        </div>
        
        <div class="category-badge category-${category}">${category.replace('_', ' ')}</div>
        
        <div class="content">
            ${content}
        </div>
        
        <div class="footer">
            <p><a href="${preferencesUrl}" style="color: #007bff; text-decoration: none;">Manage notification preferences</a></p>
            <p>&copy; 2025 LegacyLancers. All rights reserved.</p>
            
            <div class="unsubscribe">
                <p>You received this email because you have notifications enabled for ${category} updates.</p>
                <p><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe from ${category} notifications</a></p>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get category-specific CSS styles
   * @param {string} category - Notification category
   * @returns {string} CSS styles
   */
  getCategoryStyles(category) {
    const styles = {
      booking: '.category-booking { background-color: #d4edda; color: #155724; }',
      messaging: '.category-messaging { background-color: #d1ecf1; color: #0c5460; }',
      system: '.category-system { background-color: #fff3cd; color: #856404; }',
      marketing: '.category-marketing { background-color: #f8d7da; color: #721c24; }'
    };

    return styles[category] || '';
  }

  /**
   * Convert HTML to plain text (basic implementation)
   * @param {string} html - HTML content
   * @returns {string} Plain text content
   */
  htmlToText(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate unsubscribe URL
   * @param {string} userId - User ID
   * @param {string} category - Notification category
   * @returns {string} Unsubscribe URL
   */
  generateUnsubscribeUrl(userId, category) {
    const baseUrl = this.emailService.config.baseUrl;
    return `${baseUrl}/notifications/unsubscribe?user=${userId}&category=${category}`;
  }

  /**
   * Generate preferences URL
   * @param {string} userId - User ID
   * @returns {string} Preferences URL
   */
  generatePreferencesUrl(userId) {
    const baseUrl = this.emailService.config.baseUrl;
    return `${baseUrl}/notifications/preferences?user=${userId}`;
  }

  /**
   * Group notifications by category for digest
   * @param {Array} notifications - Array of notifications
   * @returns {Object} Grouped notifications
   */
  groupNotificationsByCategory(notifications) {
    return notifications.reduce((groups, notification) => {
      const category = notification.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(notification);
      return groups;
    }, {});
  }

  /**
   * Generate digest email subject
   * @param {string} frequency - Digest frequency
   * @param {number} count - Number of notifications
   * @returns {string} Email subject
   */
  generateDigestSubject(frequency, count) {
    const period = frequency === 'hourly' ? 'hour' : frequency === 'weekly' ? 'week' : 'day';
    return `Your ${frequency} LegacyLancers digest - ${count} new notification${count !== 1 ? 's' : ''} this ${period}`;
  }

  /**
   * Generate digest HTML content
   * @param {Object} data - Digest data
   * @returns {string} HTML content
   */
  generateDigestHtml(data) {
    const { recipientName, frequency, groupedNotifications, totalCount } = data;
    
    let content = `
    <h2>Hello ${recipientName},</h2>
    <p>Here's your ${frequency} summary of activity on LegacyLancers.</p>
    <p><strong>${totalCount} new notification${totalCount !== 1 ? 's' : ''}</strong> since your last digest.</p>
    `;

    Object.entries(groupedNotifications).forEach(([category, notifications]) => {
      content += `
      <h3 style="color: #007bff; border-bottom: 1px solid #dee2e6; padding-bottom: 5px;">
        ${category.charAt(0).toUpperCase() + category.slice(1)} Notifications (${notifications.length})
      </h3>
      <ul style="list-style-type: none; padding: 0;">
      `;
      
      notifications.slice(0, 10).forEach(notification => { // Limit to 10 per category
        content += `
        <li style="margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
          <strong style="color: #495057;">${notification.title}</strong><br>
          <span style="color: #6c757d; font-size: 14px;">${notification.message}</span>
          ${notification.actionUrl ? `<br><a href="${notification.actionUrl}" style="color: #007bff; text-decoration: none; font-size: 12px;">View details →</a>` : ''}
        </li>
        `;
      });
      
      if (notifications.length > 10) {
        content += `
        <li style="text-align: center; color: #6c757d; font-style: italic;">
          ... and ${notifications.length - 10} more ${category} notification${notifications.length - 10 !== 1 ? 's' : ''}
        </li>
        `;
      }
      
      content += '</ul>';
    });

    content += `
    <p style="margin-top: 30px;">
      <a href="${this.emailService.config.baseUrl}/notifications" class="button">View All Notifications</a>
    </p>
    `;

    return content;
  }

  /**
   * Generate digest plain text content
   * @param {Object} data - Digest data
   * @returns {string} Text content
   */
  generateDigestText(data) {
    const { recipientName, frequency, groupedNotifications, totalCount } = data;
    
    let content = `Hello ${recipientName},

Here's your ${frequency} summary of activity on LegacyLancers.

${totalCount} new notification${totalCount !== 1 ? 's' : ''} since your last digest.

`;

    Object.entries(groupedNotifications).forEach(([category, notifications]) => {
      content += `
${category.toUpperCase()} NOTIFICATIONS (${notifications.length}):
${'='.repeat(category.length + 20)}

`;
      
      notifications.slice(0, 10).forEach((notification, index) => {
        content += `${index + 1}. ${notification.title}
   ${notification.message}
   ${notification.actionUrl ? `   → ${notification.actionUrl}` : ''}

`;
      });
      
      if (notifications.length > 10) {
        content += `   ... and ${notifications.length - 10} more ${category} notification${notifications.length - 10 !== 1 ? 's' : ''}

`;
      }
    });

    content += `
View all notifications: ${this.emailService.config.baseUrl}/notifications

© 2025 LegacyLancers. All rights reserved.`;

    return content;
  }

  /**
   * Log delivery attempt to database
   * @param {Object} logData - Log data
   */
  async logDeliveryAttempt(logData) {
    const {
      userId,
      templateKey,
      recipientEmail,
      messageId,
      category,
      priority,
      status,
      errorMessage = null,
      errorCode = null,
      metadata = {}
    } = logData;

    try {
      const query = `
        INSERT INTO notification_delivery_log (
          user_id, template_key, channel, recipient, status, 
          provider, provider_message_id, provider_response,
          sent_at, error_code, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      const values = [
        userId,
        templateKey,
        'email',
        recipientEmail,
        status,
        'internal',
        messageId,
        JSON.stringify(metadata),
        status === 'sent' ? new Date() : null,
        errorCode,
        errorMessage
      ];

      await this.db.query(query, values);

    } catch (error) {
      // Don't throw error for logging failures, just log to console
      console.error('Failed to log email delivery attempt:', error.message);
    }
  }

  /**
   * Reset rate limiting counters (for testing)
   */
  resetRateLimiting() {
    this.notificationCounts.clear();
  }
}

module.exports = {
  EmailNotificationService,
  EmailNotificationError
};