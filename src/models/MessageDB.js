/**
 * Message Model with PostgreSQL Database Integration
 * Handles messaging database operations and real-time communication data
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const { getDatabase } = require('../config/database');

class MessageError extends Error {
  constructor(message, code = 'MESSAGE_ERROR') {
    super(message);
    this.name = 'MessageError';
    this.code = code;
  }
}

/**
 * PostgreSQL-backed Message Model Class
 */
class MessageDB {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    this.db = getDatabase();
    if (!this.db) {
      throw new MessageError('Database not initialized', 'DB_NOT_INITIALIZED');
    }
  }

  /**
   * Create a new message
   * @param {Object} messageData - Message creation data
   * @returns {Promise<Object>} Created message object
   */
  async create(messageData) {
    try {
      if (!this.db) await this.init();

      const {
        conversationId,
        senderId,
        content,
        messageType = 'text',
        replyToMessageId = null,
        metadata = {}
      } = messageData;

      // Validate required fields
      if (!conversationId) {
        throw new MessageError('Conversation ID is required', 'MISSING_CONVERSATION_ID');
      }
      if (!senderId) {
        throw new MessageError('Sender ID is required', 'MISSING_SENDER_ID');
      }
      if (!content && messageType === 'text') {
        throw new MessageError('Content is required for text messages', 'MISSING_CONTENT');
      }

      // Validate UUIDs
      if (!validator.isUUID(conversationId)) {
        throw new MessageError('Invalid conversation ID format', 'INVALID_CONVERSATION_ID');
      }
      if (!validator.isUUID(senderId)) {
        throw new MessageError('Invalid sender ID format', 'INVALID_SENDER_ID');
      }
      if (replyToMessageId && !validator.isUUID(replyToMessageId)) {
        throw new MessageError('Invalid reply message ID format', 'INVALID_REPLY_MESSAGE_ID');
      }

      // Validate message type
      const validMessageTypes = ['text', 'file', 'image', 'system', 'booking_update'];
      if (!validMessageTypes.includes(messageType)) {
        throw new MessageError('Invalid message type', 'INVALID_MESSAGE_TYPE');
      }

      // Sanitize content for text messages
      let sanitizedContent = content;
      if (messageType === 'text' && content) {
        sanitizedContent = validator.escape(validator.trim(content));
        
        // Validate content length
        if (!validator.isLength(sanitizedContent, { min: 1, max: 5000 })) {
          throw new MessageError('Message content must be between 1 and 5000 characters', 'INVALID_CONTENT_LENGTH');
        }
      }

      const messageId = uuidv4();

      const insertQuery = `
        INSERT INTO messages (
          id, conversation_id, sender_id, message_type, content, 
          metadata, reply_to_message_id, status, file_count
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING *
      `;

      const values = [
        messageId,
        conversationId,
        senderId,
        messageType,
        sanitizedContent,
        JSON.stringify(metadata),
        replyToMessageId,
        'sent', // Initial status
        messageData.fileCount || 0
      ];

      const result = await this.db.query(insertQuery, values);
      const message = result.rows[0];

      // Update conversation last message
      await this.updateConversationLastMessage(conversationId, messageId);

      return this.enrichMessageData(message);

    } catch (error) {
      if (error instanceof MessageError) {
        throw error;
      }
      throw new MessageError(`Failed to create message: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Find message by ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object|null>} Message object or null if not found
   */
  async findById(messageId) {
    try {
      if (!this.db) await this.init();

      const query = `
        SELECT * FROM messages 
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [messageId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.enrichMessageData(result.rows[0]);

    } catch (error) {
      throw new MessageError(`Failed to find message: ${error.message}`, 'FIND_FAILED');
    }
  }

  /**
   * Get messages for a conversation with pagination
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Promise<Object>} Messages with pagination info
   */
  async getConversationMessages(conversationId, options = {}) {
    try {
      if (!this.db) await this.init();

      const limit = Math.max(1, Math.min(100, options.limit || 50));
      const offset = Math.max(0, options.offset || 0);
      const sortOrder = options.sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Count total messages
      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages
        WHERE conversation_id = $1 AND deleted_at IS NULL
      `;

      // Get messages with pagination
      const messagesQuery = `
        SELECT m.*, u.first_name, u.last_name, u.email
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ${sortOrder}
        LIMIT $2 OFFSET $3
      `;

      const [countResult, messagesResult] = await Promise.all([
        this.db.query(countQuery, [conversationId]),
        this.db.query(messagesQuery, [conversationId, limit, offset])
      ]);

      const total = parseInt(countResult.rows[0].total);
      const messages = messagesResult.rows.map(row => this.enrichMessageData(row));

      return {
        messages,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      throw new MessageError(`Failed to get conversation messages: ${error.message}`, 'GET_MESSAGES_FAILED');
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Conversation object
   */
  async getConversation(conversationId) {
    try {
      if (!this.db) await this.init();

      const query = `
        SELECT * FROM conversations 
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [conversationId]);
      return result.rows.length > 0 ? result.rows[0] : null;

    } catch (error) {
      throw new MessageError(`Failed to get conversation: ${error.message}`, 'GET_CONVERSATION_FAILED');
    }
  }

  /**
   * Update conversation last message
   * @param {string} conversationId - Conversation ID
   * @param {string} messageId - Message ID
   * @returns {Promise<void>}
   */
  async updateConversationLastMessage(conversationId, messageId) {
    try {
      if (!this.db) await this.init();

      const updateQuery = `
        UPDATE conversations 
        SET last_message_id = $1, last_message_at = CURRENT_TIMESTAMP, 
            message_count = message_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

      await this.db.query(updateQuery, [messageId, conversationId]);

    } catch (error) {
      console.error('Failed to update conversation last message:', error);
      // Don't throw error as this is not critical for message creation
    }
  }

  /**
   * Enrich message data with additional information
   * @param {Object} message - Raw message object
   * @returns {Object} Enriched message object
   */
  enrichMessageData(message) {
    const enriched = {
      ...message,
      metadata: typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {})
    };

    // Add sender information if available
    if (message.first_name) {
      enriched.sender = {
        firstName: message.first_name,
        lastName: message.last_name,
        email: message.email
      };
      
      // Remove redundant fields
      delete enriched.first_name;
      delete enriched.last_name;
      delete enriched.email;
    }

    return enriched;
  }
}

// Export singleton instance
module.exports = {
  MessageDB: new MessageDB(),
  MessageError
};