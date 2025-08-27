/**
 * Notification Model
 * Handles in-app notifications with CRUD operations and state management
 */

const { v4: uuidv4 } = require('uuid');

class NotificationError extends Error {
  constructor(message, code = 'NOTIFICATION_ERROR') {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
  }
}

/**
 * Notification Model Class
 * Manages in-app notifications with read/unread states and expiration
 */
class Notification {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @param {string} notificationData.userId - User ID
   * @param {string} notificationData.templateKey - Template key reference
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.message - Notification message
   * @param {Object} notificationData.data - Additional notification data
   * @param {string} notificationData.category - Notification category
   * @param {string} notificationData.priority - Priority level
   * @param {string} notificationData.relatedEntityType - Related entity type
   * @param {string} notificationData.relatedEntityId - Related entity ID
   * @param {string} notificationData.actionUrl - Action URL
   * @param {Date} notificationData.expiresAt - Expiration date
   * @returns {Promise<Object>} Created notification
   */
  async create(notificationData) {
    const {
      userId,
      templateKey,
      title,
      message,
      data = {},
      category,
      priority = 'normal',
      relatedEntityType = null,
      relatedEntityId = null,
      actionUrl = null,
      expiresAt = null
    } = notificationData;

    // Validate required fields
    if (!userId || !templateKey || !title || !message || !category) {
      throw new NotificationError('Missing required notification fields', 'MISSING_FIELDS');
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      throw new NotificationError('Invalid priority level', 'INVALID_PRIORITY');
    }

    // Validate category
    const validCategories = ['booking', 'messaging', 'system', 'marketing'];
    if (!validCategories.includes(category)) {
      throw new NotificationError('Invalid notification category', 'INVALID_CATEGORY');
    }

    const notificationId = uuidv4();
    
    try {
      const query = `
        INSERT INTO notifications (
          id, user_id, template_key, title, message, data, category, priority,
          related_entity_type, related_entity_id, action_url, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        notificationId, userId, templateKey, title, message, 
        JSON.stringify(data), category, priority, relatedEntityType, 
        relatedEntityId, actionUrl, expiresAt
      ];

      const result = await this.db.query(query, values);
      return this.formatNotification(result.rows[0]);

    } catch (error) {
      if (error.code === '23503') { // Foreign key violation
        throw new NotificationError('Invalid user ID', 'INVALID_USER');
      }
      throw new NotificationError(`Failed to create notification: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Get notifications for a user with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of notifications to return
   * @param {number} options.offset - Number of notifications to skip
   * @param {boolean} options.unreadOnly - Only return unread notifications
   * @param {string} options.category - Filter by category
   * @param {string} options.priority - Filter by priority
   * @returns {Promise<Object>} Notifications with pagination info
   */
  async getForUser(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      unreadOnly = false,
      category = null,
      priority = null
    } = options;

    // Validate limit and offset
    if (limit < 1 || limit > 100) {
      throw new NotificationError('Invalid limit. Must be between 1 and 100', 'INVALID_LIMIT');
    }

    if (offset < 0) {
      throw new NotificationError('Invalid offset. Must be non-negative', 'INVALID_OFFSET');
    }

    try {
      let whereConditions = ['user_id = $1', 'deleted_at IS NULL'];
      let queryParams = [userId];
      let paramCount = 1;

      // Add filters
      if (unreadOnly) {
        whereConditions.push('read_at IS NULL');
      }

      if (category) {
        paramCount++;
        whereConditions.push(`category = $${paramCount}`);
        queryParams.push(category);
      }

      if (priority) {
        paramCount++;
        whereConditions.push(`priority = $${paramCount}`);
        queryParams.push(priority);
      }

      // Add expiration filter
      whereConditions.push('(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)');

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM notifications
        WHERE ${whereClause}
      `;

      const countResult = await this.db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get notifications
      const dataQuery = `
        SELECT *
        FROM notifications
        WHERE ${whereClause}
        ORDER BY 
          CASE priority 
            WHEN 'urgent' THEN 4
            WHEN 'high' THEN 3
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 1
          END DESC,
          created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      const dataResult = await this.db.query(dataQuery, queryParams);
      const notifications = dataResult.rows.map(row => this.formatNotification(row));

      return {
        notifications,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      if (error instanceof NotificationError) {
        throw error;
      }
      throw new NotificationError(`Failed to fetch notifications: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Get a single notification by ID
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Notification or null if not found
   */
  async getById(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new NotificationError('Notification ID and User ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const query = `
        SELECT *
        FROM notifications
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [notificationId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatNotification(result.rows[0]);

    } catch (error) {
      throw new NotificationError(`Failed to fetch notification: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Updated notification or null if not found
   */
  async markAsRead(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new NotificationError('Notification ID and User ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const query = `
        UPDATE notifications
        SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND read_at IS NULL
        RETURNING *
      `;

      const result = await this.db.query(query, [notificationId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatNotification(result.rows[0]);

    } catch (error) {
      throw new NotificationError(`Failed to mark notification as read: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @param {string} category - Optional category filter
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(userId, category = null) {
    if (!userId) {
      throw new NotificationError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      let query = `
        UPDATE notifications
        SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND deleted_at IS NULL AND read_at IS NULL
      `;
      let queryParams = [userId];

      if (category) {
        query += ' AND category = $2';
        queryParams.push(category);
      }

      query += ' RETURNING id';

      const result = await this.db.query(query, queryParams);
      return result.rows.length;

    } catch (error) {
      throw new NotificationError(`Failed to mark notifications as read: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Mark notification action as taken
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Updated notification or null if not found
   */
  async markActionTaken(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new NotificationError('Notification ID and User ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const query = `
        UPDATE notifications
        SET action_taken = true, action_taken_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await this.db.query(query, [notificationId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatNotification(result.rows[0]);

    } catch (error) {
      throw new NotificationError(`Failed to mark action as taken: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Dismiss (soft delete) notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} True if dismissed, false if not found
   */
  async dismiss(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new NotificationError('Notification ID and User ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const query = `
        UPDATE notifications
        SET dismissed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND dismissed_at IS NULL
        RETURNING id
      `;

      const result = await this.db.query(query, [notificationId, userId]);
      return result.rows.length > 0;

    } catch (error) {
      throw new NotificationError(`Failed to dismiss notification: ${error.message}`, 'DISMISS_FAILED');
    }
  }

  /**
   * Delete notification (hard delete)
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new NotificationError('Notification ID and User ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const query = `
        UPDATE notifications
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await this.db.query(query, [notificationId, userId]);
      return result.rows.length > 0;

    } catch (error) {
      throw new NotificationError(`Failed to delete notification: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Get unread notification count for user
   * @param {string} userId - User ID
   * @param {string} category - Optional category filter
   * @returns {Promise<number>} Count of unread notifications
   */
  async getUnreadCount(userId, category = null) {
    if (!userId) {
      throw new NotificationError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      let query = `
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL 
          AND dismissed_at IS NULL
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `;
      let queryParams = [userId];

      if (category) {
        query += ' AND category = $2';
        queryParams.push(category);
      }

      const result = await this.db.query(query, queryParams);
      return parseInt(result.rows[0].count);

    } catch (error) {
      throw new NotificationError(`Failed to get unread count: ${error.message}`, 'COUNT_FAILED');
    }
  }

  /**
   * Clean up expired notifications
   * @returns {Promise<number>} Number of notifications cleaned up
   */
  async cleanupExpired() {
    try {
      const query = `
        UPDATE notifications
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE expires_at IS NOT NULL 
          AND expires_at <= CURRENT_TIMESTAMP 
          AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await this.db.query(query);
      return result.rows.length;

    } catch (error) {
      throw new NotificationError(`Failed to cleanup expired notifications: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  /**
   * Get notifications by related entity
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of notifications
   */
  async getByRelatedEntity(entityType, entityId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    if (!entityType || !entityId) {
      throw new NotificationError('Entity type and ID are required', 'MISSING_PARAMETERS');
    }

    try {
      const query = `
        SELECT *
        FROM notifications
        WHERE related_entity_type = $1 AND related_entity_id = $2 AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await this.db.query(query, [entityType, entityId, limit, offset]);
      return result.rows.map(row => this.formatNotification(row));

    } catch (error) {
      throw new NotificationError(`Failed to fetch notifications by entity: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Format notification data for API response
   * @param {Object} row - Database row
   * @returns {Object} Formatted notification
   */
  formatNotification(row) {
    return {
      id: row.id,
      userId: row.user_id,
      templateKey: row.template_key,
      title: row.title,
      message: row.message,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      category: row.category,
      priority: row.priority,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      actionUrl: row.action_url,
      isRead: !!row.read_at,
      isDismissed: !!row.dismissed_at,
      actionTaken: row.action_taken,
      readAt: row.read_at,
      dismissedAt: row.dismissed_at,
      actionTakenAt: row.action_taken_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = {
  Notification,
  NotificationError
};