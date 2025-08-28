/**
 * Notification Queue Model
 * Handles queued notifications for background processing
 */

const { v4: uuidv4 } = require('uuid');

class NotificationQueueError extends Error {
  constructor(message, code = 'QUEUE_ERROR') {
    super(message);
    this.name = 'NotificationQueueError';
    this.code = code;
  }
}

/**
 * NotificationQueue Model Class
 * Manages queued notifications for reliable background processing
 */
class NotificationQueue {
  constructor(db) {
    this.db = db;
  }

  /**
   * Add notification to queue
   * @param {Object} queueData - Queue item data
   * @param {string} queueData.userId - User ID
   * @param {string} queueData.templateKey - Template key
   * @param {string} queueData.recipientEmail - Recipient email
   * @param {string} queueData.recipientPhone - Recipient phone
   * @param {Object} queueData.templateData - Template rendering data
   * @param {Array} queueData.channels - Array of channels to send to
   * @param {number} queueData.priority - Priority (higher = more urgent)
   * @param {Date} queueData.scheduledFor - Optional scheduled delivery time
   * @param {number} queueData.maxAttempts - Maximum retry attempts
   * @returns {Promise<Object>} Created queue item
   */
  async add(queueData) {
    const {
      userId,
      templateKey,
      recipientEmail = null,
      recipientPhone = null,
      templateData = {},
      channels = ['in_app'],
      priority = 0,
      scheduledFor = null,
      maxAttempts = 3
    } = queueData;

    // Validate required fields
    if (!userId || !templateKey) {
      throw new NotificationQueueError('User ID and template key are required', 'MISSING_FIELDS');
    }

    // Validate channels
    const validChannels = ['email', 'in_app', 'sms', 'push'];
    const invalidChannels = channels.filter(channel => !validChannels.includes(channel));
    if (invalidChannels.length > 0) {
      throw new NotificationQueueError(`Invalid channels: ${invalidChannels.join(', ')}`, 'INVALID_CHANNELS');
    }

    // Validate email if email channel is requested
    if (channels.includes('email') && !recipientEmail) {
      throw new NotificationQueueError('Recipient email required for email channel', 'MISSING_EMAIL');
    }

    // Validate phone if SMS channel is requested
    if (channels.includes('sms') && !recipientPhone) {
      throw new NotificationQueueError('Recipient phone required for SMS channel', 'MISSING_PHONE');
    }

    const queueId = uuidv4();
    const nextAttemptAt = scheduledFor || new Date();

    try {
      const query = `
        INSERT INTO notification_queue (
          id, user_id, template_key, recipient_email, recipient_phone,
          template_data, channels, priority, scheduled_for, max_attempts, next_attempt_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        queueId, userId, templateKey, recipientEmail, recipientPhone,
        JSON.stringify(templateData), JSON.stringify(channels),
        priority, scheduledFor, maxAttempts, nextAttemptAt
      ];

      const result = await this.db.query(query, values);
      return this.formatQueueItem(result.rows[0]);

    } catch (error) {
      if (error.code === '23503') { // Foreign key violation
        throw new NotificationQueueError('Invalid user ID', 'INVALID_USER');
      }
      throw new NotificationQueueError(`Failed to add to queue: ${error.message}`, 'ADD_FAILED');
    }
  }

  /**
   * Get next notifications to process
   * @param {number} limit - Maximum number of items to return
   * @param {Array} excludeChannels - Channels to exclude
   * @returns {Promise<Array>} Array of queue items ready for processing
   */
  async getNextToProcess(limit = 10, excludeChannels = []) {
    if (limit < 1 || limit > 100) {
      throw new NotificationQueueError('Invalid limit. Must be between 1 and 100', 'INVALID_LIMIT');
    }

    try {
      let whereConditions = [
        'status = $1',
        'next_attempt_at <= CURRENT_TIMESTAMP',
        'deleted_at IS NULL',
        'attempts < max_attempts'
      ];

      let queryParams = ['pending'];
      let paramCount = 1;

      // Exclude specific channels if requested
      if (excludeChannels.length > 0) {
        paramCount++;
        whereConditions.push(`NOT (channels ?| array[$${paramCount}])`);
        queryParams.push(excludeChannels);
      }

      // Include scheduled notifications that are due
      whereConditions.push('(scheduled_for IS NULL OR scheduled_for <= CURRENT_TIMESTAMP)');

      const whereClause = whereConditions.join(' AND ');

      const query = `
        UPDATE notification_queue
        SET status = 'processing', updated_at = CURRENT_TIMESTAMP
        WHERE id IN (
          SELECT id
          FROM notification_queue
          WHERE ${whereClause}
          ORDER BY priority DESC, created_at ASC
          LIMIT $${paramCount + 1}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `;

      queryParams.push(limit);

      const result = await this.db.query(query, queryParams);
      return result.rows.map(row => this.formatQueueItem(row));

    } catch (error) {
      throw new NotificationQueueError(`Failed to get queue items: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Mark queue item as completed
   * @param {string} queueId - Queue item ID
   * @param {Object} result - Processing result
   * @returns {Promise<boolean>} True if updated successfully
   */
  async markCompleted(queueId, result = {}) {
    if (!queueId) {
      throw new NotificationQueueError('Queue ID is required', 'MISSING_QUEUE_ID');
    }

    try {
      const query = `
        UPDATE notification_queue
        SET status = 'completed',
            processed_at = CURRENT_TIMESTAMP,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `;

      const queryResult = await this.db.query(query, [queueId]);
      return queryResult.rows.length > 0;

    } catch (error) {
      throw new NotificationQueueError(`Failed to mark as completed: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Mark queue item as failed and schedule retry if attempts remaining
   * @param {string} queueId - Queue item ID
   * @param {string} errorMessage - Error message
   * @param {number} retryDelayMinutes - Minutes to wait before retry
   * @returns {Promise<boolean>} True if updated successfully
   */
  async markFailed(queueId, errorMessage, retryDelayMinutes = 5) {
    if (!queueId) {
      throw new NotificationQueueError('Queue ID is required', 'MISSING_QUEUE_ID');
    }

    try {
      // First, increment attempt count and check if we should retry
      const checkQuery = `
        SELECT attempts, max_attempts
        FROM notification_queue
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const checkResult = await this.db.query(checkQuery, [queueId]);

      if (checkResult.rows.length === 0) {
        return false;
      }

      const { attempts, max_attempts } = checkResult.rows[0];
      const newAttempts = attempts + 1;
      const shouldRetry = newAttempts < max_attempts;

      let query, values;

      if (shouldRetry) {
        // Schedule retry
        const nextAttempt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
        
        query = `
          UPDATE notification_queue
          SET status = 'pending',
              attempts = $2,
              error_message = $3,
              next_attempt_at = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id
        `;
        values = [queueId, newAttempts, errorMessage, nextAttempt];

      } else {
        // Mark as permanently failed
        query = `
          UPDATE notification_queue
          SET status = 'failed',
              attempts = $2,
              error_message = $3,
              processed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id
        `;
        values = [queueId, newAttempts, errorMessage];
      }

      const result = await this.db.query(query, values);
      return result.rows.length > 0;

    } catch (error) {
      throw new NotificationQueueError(`Failed to mark as failed: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Cancel queued notification
   * @param {string} queueId - Queue item ID
   * @returns {Promise<boolean>} True if cancelled successfully
   */
  async cancel(queueId) {
    if (!queueId) {
      throw new NotificationQueueError('Queue ID is required', 'MISSING_QUEUE_ID');
    }

    try {
      const query = `
        UPDATE notification_queue
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('pending', 'processing') AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await this.db.query(query, [queueId]);
      return result.rows.length > 0;

    } catch (error) {
      throw new NotificationQueueError(`Failed to cancel queue item: ${error.message}`, 'CANCEL_FAILED');
    }
  }

  /**
   * Get queue item by ID
   * @param {string} queueId - Queue item ID
   * @returns {Promise<Object|null>} Queue item or null if not found
   */
  async getById(queueId) {
    if (!queueId) {
      throw new NotificationQueueError('Queue ID is required', 'MISSING_QUEUE_ID');
    }

    try {
      const query = `
        SELECT *
        FROM notification_queue
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [queueId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatQueueItem(result.rows[0]);

    } catch (error) {
      throw new NotificationQueueError(`Failed to fetch queue item: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue statistics
   */
  async getStats() {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM notification_queue
        WHERE deleted_at IS NULL
        GROUP BY status
      `;

      const result = await this.db.query(query);
      
      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0
      };

      result.rows.forEach(row => {
        stats[row.status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      // Get additional metrics
      const metricsQuery = `
        SELECT 
          AVG(EXTRACT(EPOCH FROM (processed_at - created_at))/60) as avg_processing_time_minutes,
          COUNT(*) FILTER (WHERE status = 'failed' AND attempts >= max_attempts) as permanent_failures,
          COUNT(*) FILTER (WHERE scheduled_for > CURRENT_TIMESTAMP) as scheduled_future
        FROM notification_queue
        WHERE deleted_at IS NULL AND processed_at IS NOT NULL
      `;

      const metricsResult = await this.db.query(metricsQuery);
      const metrics = metricsResult.rows[0];

      stats.avgProcessingTimeMinutes = parseFloat(metrics.avg_processing_time_minutes) || 0;
      stats.permanentFailures = parseInt(metrics.permanent_failures) || 0;
      stats.scheduledFuture = parseInt(metrics.scheduled_future) || 0;

      return stats;

    } catch (error) {
      throw new NotificationQueueError(`Failed to get queue stats: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Clean up old completed/failed queue items
   * @param {number} retentionDays - Number of days to keep completed items
   * @returns {Promise<number>} Number of items cleaned up
   */
  async cleanup(retentionDays = 30) {
    if (retentionDays < 1) {
      throw new NotificationQueueError('Retention days must be at least 1', 'INVALID_RETENTION');
    }

    try {
      const query = `
        DELETE FROM notification_queue
        WHERE (status IN ('completed', 'failed', 'cancelled'))
          AND completed_at < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'
        RETURNING id
      `;

      const result = await this.db.query(query);
      return result.rows.length;

    } catch (error) {
      throw new NotificationQueueError(`Failed to cleanup queue: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  /**
   * Reset stuck processing items back to pending
   * @param {number} stuckTimeoutMinutes - Minutes to consider an item stuck
   * @returns {Promise<number>} Number of items reset
   */
  async resetStuckItems(stuckTimeoutMinutes = 30) {
    try {
      const query = `
        UPDATE notification_queue
        SET status = 'pending',
            next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'processing'
          AND updated_at < CURRENT_TIMESTAMP - INTERVAL '${stuckTimeoutMinutes} minutes'
          AND deleted_at IS NULL
          AND attempts < max_attempts
        RETURNING id
      `;

      const result = await this.db.query(query);
      return result.rows.length;

    } catch (error) {
      throw new NotificationQueueError(`Failed to reset stuck items: ${error.message}`, 'RESET_FAILED');
    }
  }

  /**
   * Get queue items for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Queue items with pagination
   */
  async getForUser(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      status = null,
      templateKey = null
    } = options;

    if (!userId) {
      throw new NotificationQueueError('User ID is required', 'MISSING_USER_ID');
    }

    try {
      let whereConditions = ['user_id = $1', 'deleted_at IS NULL'];
      let queryParams = [userId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        whereConditions.push(`status = $${paramCount}`);
        queryParams.push(status);
      }

      if (templateKey) {
        paramCount++;
        whereConditions.push(`template_key = $${paramCount}`);
        queryParams.push(templateKey);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM notification_queue
        WHERE ${whereClause}
      `;

      const countResult = await this.db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get queue items
      const dataQuery = `
        SELECT *
        FROM notification_queue
        WHERE ${whereClause}
        ORDER BY priority DESC, created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      const dataResult = await this.db.query(dataQuery, queryParams);
      const queueItems = dataResult.rows.map(row => this.formatQueueItem(row));

      return {
        queueItems,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      throw new NotificationQueueError(`Failed to fetch user queue items: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Format queue item data for API response
   * @param {Object} row - Database row
   * @returns {Object} Formatted queue item
   */
  formatQueueItem(row) {
    return {
      id: row.id,
      userId: row.user_id,
      templateKey: row.template_key,
      status: row.status,
      priority: row.priority,
      recipientEmail: row.recipient_email,
      recipientPhone: row.recipient_phone,
      templateData: typeof row.template_data === 'string' ? JSON.parse(row.template_data) : row.template_data,
      channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      nextAttemptAt: row.next_attempt_at,
      scheduledFor: row.scheduled_for,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = {
  NotificationQueue,
  NotificationQueueError
};