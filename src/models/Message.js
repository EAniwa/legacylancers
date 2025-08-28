/**
 * Message Model
 * Handles message database operations and business logic
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');

class MessageError extends Error {
  constructor(message, code = 'MESSAGE_ERROR') {
    super(message);
    this.name = 'MessageError';
    this.code = code;
  }
}

/**
 * Message Model Class
 * For now, using in-memory storage. In production, this would connect to PostgreSQL
 */
class Message {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be replaced with database connection
    this.messages = new Map();
    this.messageFiles = new Map(); // messageId -> array of file objects
    this.conversationMessages = new Map(); // conversationId -> Set of messageIds
  }

  /**
   * Create a new message
   * @param {Object} messageData - Message creation data
   * @param {string} messageData.conversation_id - Conversation ID
   * @param {string} messageData.sender_id - Sender user ID
   * @param {string} messageData.message_type - Type of message ('text', 'file', 'image', 'system', 'booking_update')
   * @param {string} messageData.content - Message text content
   * @param {Object} messageData.metadata - Additional message metadata
   * @param {string} messageData.reply_to_message_id - Optional message being replied to
   * @param {Array} messageData.files - Optional array of file attachments
   * @returns {Promise<Object>} Created message object
   */
  async create(messageData) {
    try {
      const {
        conversation_id,
        sender_id,
        message_type = 'text',
        content,
        metadata = {},
        reply_to_message_id,
        files = []
      } = messageData;

      // Validate required fields
      if (!conversation_id) {
        throw new MessageError('Conversation ID is required', 'MISSING_CONVERSATION_ID');
      }

      if (!sender_id) {
        throw new MessageError('Sender ID is required', 'MISSING_SENDER_ID');
      }

      // Validate message type
      const validTypes = ['text', 'file', 'image', 'system', 'booking_update'];
      if (!validTypes.includes(message_type)) {
        throw new MessageError('Invalid message type', 'INVALID_MESSAGE_TYPE');
      }

      // Validate content for text messages
      if (message_type === 'text') {
        if (!content || content.trim() === '') {
          throw new MessageError('Content is required for text messages', 'MISSING_CONTENT');
        }

        if (content.length > 5000) {
          throw new MessageError('Message content must not exceed 5000 characters', 'CONTENT_TOO_LONG');
        }
      }

      // Validate reply_to_message_id if provided
      if (reply_to_message_id) {
        const replyToMessage = await this.findById(reply_to_message_id);
        if (!replyToMessage) {
          throw new MessageError('Reply to message not found', 'REPLY_MESSAGE_NOT_FOUND');
        }

        if (replyToMessage.conversation_id !== conversation_id) {
          throw new MessageError('Reply message must be from the same conversation', 'REPLY_MESSAGE_DIFFERENT_CONVERSATION');
        }
      }

      // Validate metadata
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new MessageError('Metadata must be an object', 'INVALID_METADATA');
      }

      // Create message object
      const messageId = uuidv4();
      const now = new Date();

      const message = {
        id: messageId,
        conversation_id,
        sender_id,
        message_type,
        content: content ? validator.escape(content.trim()) : null,
        encrypted_content: null, // For future encryption support
        metadata: metadata || {},
        reply_to_message_id,
        file_count: files.length,
        status: 'sent',
        read_by_participant_1: false,
        read_by_participant_2: false,
        read_at_participant_1: null,
        read_at_participant_2: null,
        delivered_at: now,
        edited_at: null,
        is_deleted: false,
        deleted_for_participant_1: false,
        deleted_for_participant_2: false,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };

      // Store message
      this.messages.set(messageId, message);

      // Track message in conversation
      if (!this.conversationMessages.has(conversation_id)) {
        this.conversationMessages.set(conversation_id, new Set());
      }
      this.conversationMessages.get(conversation_id).add(messageId);

      // Process file attachments
      if (files.length > 0) {
        const messageFiles = [];
        for (const file of files) {
          const messageFile = await this.addFile(messageId, file);
          messageFiles.push(messageFile);
        }
        this.messageFiles.set(messageId, messageFiles);
      }

      return message;

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
      const message = this.messages.get(messageId);
      if (!message || message.deleted_at) {
        return null;
      }

      return message;
    } catch (error) {
      throw new MessageError(`Failed to find message by ID: ${error.message}`, 'FIND_BY_ID_FAILED');
    }
  }

  /**
   * Find messages by conversation ID with pagination
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of messages to return
   * @param {number} options.offset - Number of messages to skip
   * @param {string} options.before - Get messages before this message ID (for pagination)
   * @param {string} options.after - Get messages after this message ID (for pagination)
   * @returns {Promise<Array>} Array of message objects
   */
  async findByConversationId(conversationId, options = {}) {
    try {
      const { limit = 50, offset = 0, before, after } = options;

      const messageIds = this.conversationMessages.get(conversationId);
      if (!messageIds || messageIds.size === 0) {
        return [];
      }

      const conversationMessages = [];

      for (const messageId of messageIds) {
        const message = this.messages.get(messageId);
        if (!message || message.deleted_at || message.is_deleted) continue;

        conversationMessages.push(message);
      }

      // Sort by creation time (newest first)
      conversationMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Apply cursor-based pagination if specified
      let filteredMessages = conversationMessages;

      if (before) {
        const beforeIndex = conversationMessages.findIndex(msg => msg.id === before);
        if (beforeIndex > -1) {
          filteredMessages = conversationMessages.slice(beforeIndex + 1);
        }
      }

      if (after) {
        const afterIndex = filteredMessages.findIndex(msg => msg.id === after);
        if (afterIndex > -1) {
          filteredMessages = filteredMessages.slice(0, afterIndex);
        }
      }

      // Apply offset and limit
      return filteredMessages.slice(offset, offset + limit);

    } catch (error) {
      throw new MessageError(`Failed to find messages by conversation ID: ${error.message}`, 'FIND_BY_CONVERSATION_FAILED');
    }
  }

  /**
   * Update message
   * @param {string} messageId - Message ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated message object
   */
  async update(messageId, updateData) {
    try {
      const message = this.messages.get(messageId);
      if (!message || message.deleted_at) {
        throw new MessageError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      // Validate and sanitize update data
      const allowedFields = [
        'content', 'status', 'read_by_participant_1', 'read_by_participant_2',
        'read_at_participant_1', 'read_at_participant_2', 'delivered_at',
        'is_deleted', 'deleted_for_participant_1', 'deleted_for_participant_2',
        'metadata'
      ];

      const updates = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates[key] = value;
        }
      }

      // Validate specific fields
      if (updates.content && updates.content.length > 5000) {
        throw new MessageError('Message content must not exceed 5000 characters', 'CONTENT_TOO_LONG');
      }

      if (updates.status && !['sending', 'sent', 'delivered', 'read', 'failed', 'deleted'].includes(updates.status)) {
        throw new MessageError('Invalid message status', 'INVALID_STATUS');
      }

      // Sanitize content if updated
      if (updates.content) {
        updates.content = validator.escape(updates.content.trim());
        updates.edited_at = new Date();
      }

      // Apply updates
      const updatedMessage = {
        ...message,
        ...updates,
        updated_at: new Date()
      };

      this.messages.set(messageId, updatedMessage);

      return updatedMessage;

    } catch (error) {
      if (error instanceof MessageError) {
        throw error;
      }
      throw new MessageError(`Failed to update message: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Mark message as read by a user
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} conversationId - Conversation ID (for validation)
   * @returns {Promise<Object>} Updated message object
   */
  async markAsRead(messageId, userId, conversationId) {
    try {
      const message = await this.findById(messageId);
      if (!message) {
        throw new MessageError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      if (message.conversation_id !== conversationId) {
        throw new MessageError('Message does not belong to the specified conversation', 'MESSAGE_CONVERSATION_MISMATCH');
      }

      // Don't mark own messages as read
      if (message.sender_id === userId) {
        return message;
      }

      // Import Conversation model to get participant info
      const { Conversation } = require('./Conversation');
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new MessageError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      const updates = {};
      const now = new Date();

      // Determine which participant is marking as read
      if (conversation.participant_1_id === userId) {
        updates.read_by_participant_1 = true;
        updates.read_at_participant_1 = now;
      } else if (conversation.participant_2_id === userId) {
        updates.read_by_participant_2 = true;
        updates.read_at_participant_2 = now;
      } else {
        throw new MessageError('User is not a participant in this conversation', 'NOT_PARTICIPANT');
      }

      // Update status to 'read' if both participants have read it
      if ((updates.read_by_participant_1 || message.read_by_participant_1) &&
          (updates.read_by_participant_2 || message.read_by_participant_2)) {
        updates.status = 'read';
      }

      return await this.update(messageId, updates);

    } catch (error) {
      if (error instanceof MessageError) {
        throw error;
      }
      throw new MessageError(`Failed to mark message as read: ${error.message}`, 'MARK_READ_FAILED');
    }
  }

  /**
   * Delete message for a specific user
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} conversationId - Conversation ID (for validation)
   * @param {boolean} deleteForEveryone - Whether to delete for all participants
   * @returns {Promise<Object>} Updated message object
   */
  async deleteForUser(messageId, userId, conversationId, deleteForEveryone = false) {
    try {
      const message = await this.findById(messageId);
      if (!message) {
        throw new MessageError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      if (message.conversation_id !== conversationId) {
        throw new MessageError('Message does not belong to the specified conversation', 'MESSAGE_CONVERSATION_MISMATCH');
      }

      // Import Conversation model to get participant info
      const { Conversation } = require('./Conversation');
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        throw new MessageError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      // Check if user is a participant
      const isParticipant = conversation.participant_1_id === userId || 
                           conversation.participant_2_id === userId;

      if (!isParticipant) {
        throw new MessageError('User is not a participant in this conversation', 'NOT_PARTICIPANT');
      }

      const updates = {};

      if (deleteForEveryone) {
        // Only the sender can delete for everyone (within time limit)
        if (message.sender_id !== userId) {
          throw new MessageError('Only the sender can delete message for everyone', 'NOT_MESSAGE_SENDER');
        }

        // Check time limit (e.g., 5 minutes)
        const timeLimit = 5 * 60 * 1000; // 5 minutes in milliseconds
        const messageAge = new Date() - new Date(message.created_at);
        
        if (messageAge > timeLimit) {
          throw new MessageError('Message can only be deleted for everyone within 5 minutes of sending', 'DELETE_TIME_EXPIRED');
        }

        updates.is_deleted = true;
        updates.content = 'This message was deleted';
      } else {
        // Delete for specific user only
        if (conversation.participant_1_id === userId) {
          updates.deleted_for_participant_1 = true;
        } else {
          updates.deleted_for_participant_2 = true;
        }
      }

      return await this.update(messageId, updates);

    } catch (error) {
      if (error instanceof MessageError) {
        throw error;
      }
      throw new MessageError(`Failed to delete message: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Add file attachment to message
   * @param {string} messageId - Message ID
   * @param {Object} fileData - File data
   * @returns {Promise<Object>} Created message file object
   */
  async addFile(messageId, fileData) {
    try {
      const {
        filename,
        originalFilename,
        fileSize,
        mimeType,
        filePath,
        fileUrl,
        storageType = 'local'
      } = fileData;

      // Validate required fields
      if (!filename) {
        throw new MessageError('Filename is required', 'MISSING_FILENAME');
      }

      if (!originalFilename) {
        throw new MessageError('Original filename is required', 'MISSING_ORIGINAL_FILENAME');
      }

      if (!fileSize || fileSize <= 0) {
        throw new MessageError('Valid file size is required', 'INVALID_FILE_SIZE');
      }

      if (!mimeType) {
        throw new MessageError('MIME type is required', 'MISSING_MIME_TYPE');
      }

      if (!filePath) {
        throw new MessageError('File path is required', 'MISSING_FILE_PATH');
      }

      // Create message file object
      const fileId = uuidv4();
      const now = new Date();

      const messageFile = {
        id: fileId,
        message_id: messageId,
        filename: validator.escape(filename),
        original_filename: validator.escape(originalFilename),
        file_size: fileSize,
        mime_type: mimeType,
        file_extension: originalFilename.split('.').pop()?.toLowerCase() || '',
        file_path: filePath,
        file_url: fileUrl || null,
        storage_type: storageType,
        is_processed: true,
        processing_status: 'completed',
        image_width: fileData.imageWidth || null,
        image_height: fileData.imageHeight || null,
        thumbnail_url: fileData.thumbnailUrl || null,
        is_safe: true,
        scan_status: 'completed',
        download_count: 0,
        expires_at: fileData.expiresAt || null,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };

      return messageFile;

    } catch (error) {
      if (error instanceof MessageError) {
        throw error;
      }
      throw new MessageError(`Failed to add file: ${error.message}`, 'ADD_FILE_FAILED');
    }
  }

  /**
   * Get files for a message
   * @param {string} messageId - Message ID
   * @returns {Promise<Array>} Array of message file objects
   */
  async getFiles(messageId) {
    try {
      return this.messageFiles.get(messageId) || [];
    } catch (error) {
      throw new MessageError(`Failed to get message files: ${error.message}`, 'GET_FILES_FAILED');
    }
  }

  /**
   * Get unread message count for user in conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of unread messages
   */
  async getUnreadCount(conversationId, userId) {
    try {
      const messages = await this.findByConversationId(conversationId, { limit: 1000 });
      
      // Import Conversation model to get participant info
      const { Conversation } = require('./Conversation');
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        return 0;
      }

      let unreadCount = 0;

      for (const message of messages) {
        // Skip own messages
        if (message.sender_id === userId) continue;

        // Check if message is read by this user
        let isRead = false;
        if (conversation.participant_1_id === userId) {
          isRead = message.read_by_participant_1;
        } else if (conversation.participant_2_id === userId) {
          isRead = message.read_by_participant_2;
        }

        if (!isRead) {
          unreadCount++;
        }
      }

      return unreadCount;

    } catch (error) {
      throw new MessageError(`Failed to get unread count: ${error.message}`, 'UNREAD_COUNT_FAILED');
    }
  }

  /**
   * Search messages
   * @param {string} conversationId - Conversation ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching messages
   */
  async search(conversationId, query, options = {}) {
    try {
      const { limit = 50 } = options;

      if (!query || query.trim() === '') {
        return [];
      }

      const messages = await this.findByConversationId(conversationId, { limit: 1000 });
      const searchTerm = query.toLowerCase();

      const matchingMessages = messages.filter(message => {
        if (!message.content) return false;
        return message.content.toLowerCase().includes(searchTerm);
      });

      return matchingMessages.slice(0, limit);

    } catch (error) {
      throw new MessageError(`Failed to search messages: ${error.message}`, 'SEARCH_FAILED');
    }
  }

  /**
   * Get message statistics
   * @returns {Promise<Object>} Message statistics
   */
  async getStats() {
    try {
      const stats = {
        totalMessages: 0,
        textMessages: 0,
        fileMessages: 0,
        imageMessages: 0,
        systemMessages: 0,
        deletedMessages: 0,
        readMessages: 0,
        unreadMessages: 0
      };

      for (const message of this.messages.values()) {
        stats.totalMessages++;

        if (message.deleted_at || message.is_deleted) {
          stats.deletedMessages++;
        } else {
          // Count by type
          if (message.message_type === 'text') {
            stats.textMessages++;
          } else if (message.message_type === 'file') {
            stats.fileMessages++;
          } else if (message.message_type === 'image') {
            stats.imageMessages++;
          } else if (message.message_type === 'system') {
            stats.systemMessages++;
          }

          // Count read status
          if (message.status === 'read') {
            stats.readMessages++;
          } else {
            stats.unreadMessages++;
          }
        }
      }

      return stats;

    } catch (error) {
      throw new MessageError(`Failed to get message statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Reset all data (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    this.messages.clear();
    this.messageFiles.clear();
    this.conversationMessages.clear();
  }
}

// Export singleton instance
module.exports = {
  Message: new Message(),
  MessageError
};