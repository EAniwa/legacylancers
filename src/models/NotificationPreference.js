/**
 * Notification Preference Model
 * Handles user preferences for notification delivery channels and timing
 */

const { v4: uuidv4 } = require('uuid');

class NotificationPreferenceError extends Error {
  constructor(message, code = 'PREFERENCE_ERROR') {
    super(message);
    this.name = 'NotificationPreferenceError';
    this.code = code;
  }
}

/**
 * NotificationPreference Model Class
 * Manages user preferences for notification channels and delivery settings
 */
class NotificationPreference {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get notification preferences for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User preferences or null if not found
   */
  async getByUserId(userId) {
    if (!userId) {
      throw new NotificationPreferenceError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      const query = `
        SELECT *
        FROM user_notification_preferences
        WHERE user_id = $1 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatPreferences(result.rows[0]);

    } catch (error) {
      throw new NotificationPreferenceError(`Failed to fetch preferences: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Create default notification preferences for a user
   * @param {string} userId - User ID
   * @param {Object} overrides - Optional preference overrides
   * @returns {Promise<Object>} Created preferences
   */
  async createDefault(userId, overrides = {}) {
    if (!userId) {
      throw new NotificationPreferenceError('User ID is required', 'MISSING_USER_ID');
    }

    const defaultPreferences = {
      emailEnabled: true,
      inAppEnabled: true,
      smsEnabled: false,
      pushEnabled: false,
      bookingNotifications: { email: true, in_app: true, sms: false },
      messageNotifications: { email: true, in_app: true, sms: false },
      systemNotifications: { email: true, in_app: true, sms: false },
      marketingNotifications: { email: false, in_app: false, sms: false },
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: null,
      emailDigestFrequency: 'daily',
      ...overrides
    };

    const preferenceId = uuidv4();

    try {
      const query = `
        INSERT INTO user_notification_preferences (
          id, user_id, email_enabled, in_app_enabled, sms_enabled, push_enabled,
          booking_notifications, message_notifications, system_notifications, 
          marketing_notifications, quiet_hours_start, quiet_hours_end, 
          timezone, email_digest_frequency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (user_id) WHERE deleted_at IS NULL 
        DO UPDATE SET 
          email_enabled = EXCLUDED.email_enabled,
          in_app_enabled = EXCLUDED.in_app_enabled,
          sms_enabled = EXCLUDED.sms_enabled,
          push_enabled = EXCLUDED.push_enabled,
          booking_notifications = EXCLUDED.booking_notifications,
          message_notifications = EXCLUDED.message_notifications,
          system_notifications = EXCLUDED.system_notifications,
          marketing_notifications = EXCLUDED.marketing_notifications,
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          timezone = EXCLUDED.timezone,
          email_digest_frequency = EXCLUDED.email_digest_frequency,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const values = [
        preferenceId, userId,
        defaultPreferences.emailEnabled,
        defaultPreferences.inAppEnabled,
        defaultPreferences.smsEnabled,
        defaultPreferences.pushEnabled,
        JSON.stringify(defaultPreferences.bookingNotifications),
        JSON.stringify(defaultPreferences.messageNotifications),
        JSON.stringify(defaultPreferences.systemNotifications),
        JSON.stringify(defaultPreferences.marketingNotifications),
        defaultPreferences.quietHoursStart,
        defaultPreferences.quietHoursEnd,
        defaultPreferences.timezone,
        defaultPreferences.emailDigestFrequency
      ];

      const result = await this.db.query(query, values);
      return this.formatPreferences(result.rows[0]);

    } catch (error) {
      if (error.code === '23503') { // Foreign key violation
        throw new NotificationPreferenceError('Invalid user ID', 'INVALID_USER');
      }
      throw new NotificationPreferenceError(`Failed to create preferences: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Update notification preferences for a user
   * @param {string} userId - User ID
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object|null>} Updated preferences or null if not found
   */
  async update(userId, updates) {
    if (!userId) {
      throw new NotificationPreferenceError('User ID is required', 'MISSING_USER_ID');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw new NotificationPreferenceError('No update data provided', 'NO_UPDATE_DATA');
    }

    const allowedFields = [
      'emailEnabled', 'inAppEnabled', 'smsEnabled', 'pushEnabled',
      'bookingNotifications', 'messageNotifications', 'systemNotifications',
      'marketingNotifications', 'quietHoursStart', 'quietHoursEnd',
      'timezone', 'emailDigestFrequency'
    ];

    // Validate updates
    const validUpdates = {};
    Object.keys(updates).forEach(field => {
      if (allowedFields.includes(field)) {
        validUpdates[field] = updates[field];
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      throw new NotificationPreferenceError('No valid fields to update', 'NO_VALID_FIELDS');
    }

    // Validate specific field values
    if (validUpdates.emailDigestFrequency) {
      const validFrequencies = ['immediate', 'hourly', 'daily', 'weekly', 'disabled'];
      if (!validFrequencies.includes(validUpdates.emailDigestFrequency)) {
        throw new NotificationPreferenceError('Invalid email digest frequency', 'INVALID_FREQUENCY');
      }
    }

    // Validate quiet hours format
    if (validUpdates.quietHoursStart || validUpdates.quietHoursEnd) {
      const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (validUpdates.quietHoursStart && !timePattern.test(validUpdates.quietHoursStart)) {
        throw new NotificationPreferenceError('Invalid quiet hours start time format', 'INVALID_TIME_FORMAT');
      }
      if (validUpdates.quietHoursEnd && !timePattern.test(validUpdates.quietHoursEnd)) {
        throw new NotificationPreferenceError('Invalid quiet hours end time format', 'INVALID_TIME_FORMAT');
      }
    }

    // Validate notification channel settings
    ['bookingNotifications', 'messageNotifications', 'systemNotifications', 'marketingNotifications'].forEach(field => {
      if (validUpdates[field]) {
        const channels = validUpdates[field];
        if (typeof channels !== 'object' || channels === null) {
          throw new NotificationPreferenceError(`Invalid ${field} format`, 'INVALID_CHANNEL_FORMAT');
        }
        
        // Ensure we have the expected channel keys
        const validChannels = ['email', 'in_app', 'sms'];
        validChannels.forEach(channel => {
          if (typeof channels[channel] !== 'boolean') {
            channels[channel] = false;
          }
        });
      }
    });

    try {
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 0;

      Object.keys(validUpdates).forEach(field => {
        paramCount++;
        updateFields.push(`${this.camelToSnake(field)} = $${paramCount}`);
        
        // Handle JSON fields
        if (field.includes('Notifications')) {
          values.push(JSON.stringify(validUpdates[field]));
        } else {
          values.push(validUpdates[field]);
        }
      });

      paramCount++;
      values.push(userId);

      const query = `
        UPDATE user_notification_preferences
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatPreferences(result.rows[0]);

    } catch (error) {
      throw new NotificationPreferenceError(`Failed to update preferences: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Check if user should receive notification based on preferences
   * @param {string} userId - User ID
   * @param {string} channel - Notification channel ('email', 'in_app', 'sms')
   * @param {string} category - Notification category ('booking', 'messaging', 'system', 'marketing')
   * @returns {Promise<boolean>} True if notification should be sent
   */
  async shouldReceiveNotification(userId, channel, category) {
    if (!userId || !channel || !category) {
      throw new NotificationPreferenceError('User ID, channel, and category are required', 'MISSING_PARAMETERS');
    }

    const preferences = await this.getByUserId(userId);
    if (!preferences) {
      // If no preferences found, create defaults and allow notification
      await this.createDefault(userId);
      return true;
    }

    // Check global channel setting
    const globalChannelKey = `${channel}Enabled`;
    if (!preferences[globalChannelKey]) {
      return false;
    }

    // Check category-specific setting
    const categoryKey = `${category}Notifications`;
    if (preferences[categoryKey] && preferences[categoryKey][channel] === false) {
      return false;
    }

    // Check quiet hours for non-urgent notifications
    if (channel === 'email' || channel === 'sms') {
      if (await this.isInQuietHours(userId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is within user's quiet hours
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if in quiet hours
   */
  async isInQuietHours(userId) {
    const preferences = await this.getByUserId(userId);
    if (!preferences || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    try {
      const now = new Date();
      const userTimezone = preferences.timezone || 'UTC';
      
      // Convert current time to user's timezone
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }).format(now);

      const [currentHour, currentMinute] = userTime.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = preferences.quietHoursStart.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;

      const [endHour, endMinute] = preferences.quietHoursEnd.split(':').map(Number);
      const endMinutes = endHour * 60 + endMinute;

      // Handle quiet hours that span midnight
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      } else {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      }

    } catch (error) {
      // If timezone calculation fails, assume not in quiet hours
      return false;
    }
  }

  /**
   * Update last digest sent timestamp
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async updateLastDigestSent(userId) {
    if (!userId) {
      throw new NotificationPreferenceError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      const query = `
        UPDATE user_notification_preferences
        SET last_digest_sent = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND deleted_at IS NULL
      `;

      await this.db.query(query, [userId]);

    } catch (error) {
      throw new NotificationPreferenceError(`Failed to update digest timestamp: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Get users who need email digests
   * @param {string} frequency - Digest frequency ('hourly', 'daily', 'weekly')
   * @returns {Promise<Array>} Array of user IDs
   */
  async getUsersForDigest(frequency) {
    if (!frequency) {
      throw new NotificationPreferenceError('Frequency is required', 'MISSING_FREQUENCY');
    }

    const validFrequencies = ['hourly', 'daily', 'weekly'];
    if (!validFrequencies.includes(frequency)) {
      throw new NotificationPreferenceError('Invalid frequency', 'INVALID_FREQUENCY');
    }

    try {
      let interval;
      switch (frequency) {
        case 'hourly':
          interval = '1 hour';
          break;
        case 'daily':
          interval = '1 day';
          break;
        case 'weekly':
          interval = '1 week';
          break;
      }

      const query = `
        SELECT user_id
        FROM user_notification_preferences
        WHERE email_digest_frequency = $1
          AND email_enabled = true
          AND deleted_at IS NULL
          AND (
            last_digest_sent IS NULL 
            OR last_digest_sent <= CURRENT_TIMESTAMP - INTERVAL '${interval}'
          )
      `;

      const result = await this.db.query(query, [frequency]);
      return result.rows.map(row => row.user_id);

    } catch (error) {
      throw new NotificationPreferenceError(`Failed to get users for digest: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Delete (soft delete) preferences for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(userId) {
    if (!userId) {
      throw new NotificationPreferenceError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      const query = `
        UPDATE user_notification_preferences
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await this.db.query(query, [userId]);
      return result.rows.length > 0;

    } catch (error) {
      throw new NotificationPreferenceError(`Failed to delete preferences: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Convert camelCase to snake_case
   * @param {string} str - camelCase string
   * @returns {string} snake_case string
   */
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Format preferences data for API response
   * @param {Object} row - Database row
   * @returns {Object} Formatted preferences
   */
  formatPreferences(row) {
    return {
      id: row.id,
      userId: row.user_id,
      emailEnabled: row.email_enabled,
      inAppEnabled: row.in_app_enabled,
      smsEnabled: row.sms_enabled,
      pushEnabled: row.push_enabled,
      bookingNotifications: typeof row.booking_notifications === 'string' 
        ? JSON.parse(row.booking_notifications) 
        : row.booking_notifications,
      messageNotifications: typeof row.message_notifications === 'string' 
        ? JSON.parse(row.message_notifications) 
        : row.message_notifications,
      systemNotifications: typeof row.system_notifications === 'string' 
        ? JSON.parse(row.system_notifications) 
        : row.system_notifications,
      marketingNotifications: typeof row.marketing_notifications === 'string' 
        ? JSON.parse(row.marketing_notifications) 
        : row.marketing_notifications,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      timezone: row.timezone,
      emailDigestFrequency: row.email_digest_frequency,
      lastDigestSent: row.last_digest_sent,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = {
  NotificationPreference,
  NotificationPreferenceError
};