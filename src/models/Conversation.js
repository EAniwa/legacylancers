/**
 * Conversation Model
 * Handles conversation database operations and business logic
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');

class ConversationError extends Error {
  constructor(message, code = 'CONVERSATION_ERROR') {
    super(message);
    this.name = 'ConversationError';
    this.code = code;
  }
}

/**
 * Conversation Model Class
 * For now, using in-memory storage. In production, this would connect to PostgreSQL
 */
class Conversation {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be replaced with database connection
    this.conversations = new Map();
    this.participants = new Map(); // conversationId -> Set of userIds
  }

  /**
   * Create a new conversation
   * @param {Object} conversationData - Conversation creation data
   * @param {string} conversationData.participant_1_id - First participant ID
   * @param {string} conversationData.participant_2_id - Second participant ID
   * @param {string} conversationData.conversation_type - Type of conversation ('direct', 'booking', 'group')
   * @param {string} conversationData.title - Optional conversation title
   * @param {string} conversationData.description - Optional conversation description
   * @param {string} conversationData.booking_id - Optional booking ID
   * @returns {Promise<Object>} Created conversation object
   */
  async create(conversationData) {
    try {
      const { 
        participant_1_id, 
        participant_2_id, 
        conversation_type = 'direct',
        title,
        description,
        booking_id
      } = conversationData;

      // Validate required fields
      if (!participant_1_id) {
        throw new ConversationError('First participant ID is required', 'MISSING_PARTICIPANT_1');
      }

      if (!participant_2_id) {
        throw new ConversationError('Second participant ID is required', 'MISSING_PARTICIPANT_2');
      }

      if (participant_1_id === participant_2_id) {
        throw new ConversationError('Participants must be different users', 'SAME_PARTICIPANTS');
      }

      // Validate conversation type
      const validTypes = ['direct', 'booking', 'group'];
      if (!validTypes.includes(conversation_type)) {
        throw new ConversationError('Invalid conversation type', 'INVALID_TYPE');
      }

      // For direct conversations, check if one already exists
      if (conversation_type === 'direct') {
        const existingConversation = await this.findByParticipants(participant_1_id, participant_2_id);
        if (existingConversation) {
          throw new ConversationError('Direct conversation already exists between these participants', 'CONVERSATION_EXISTS');
        }
      }

      // Validate title if provided
      if (title && !validator.isLength(title, { min: 1, max: 200 })) {
        throw new ConversationError('Title must be between 1 and 200 characters', 'INVALID_TITLE');
      }

      // Validate description if provided
      if (description && description.length > 1000) {
        throw new ConversationError('Description must not exceed 1000 characters', 'INVALID_DESCRIPTION');
      }

      // Create conversation object
      const conversationId = uuidv4();
      const now = new Date();

      // Ensure consistent ordering of participants for direct conversations
      const orderedParticipants = conversation_type === 'direct' ? 
        [participant_1_id, participant_2_id].sort() : 
        [participant_1_id, participant_2_id];

      const conversation = {
        id: conversationId,
        participant_1_id: orderedParticipants[0],
        participant_2_id: orderedParticipants[1],
        conversation_type,
        title: title ? validator.escape(title.trim()) : null,
        description: description ? validator.escape(description.trim()) : null,
        booking_id,
        status: 'active',
        is_archived_by_participant_1: false,
        is_archived_by_participant_2: false,
        last_message_at: null,
        last_message_id: null,
        message_count: 0,
        encryption_enabled: false,
        file_sharing_enabled: true,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };

      // Store conversation
      this.conversations.set(conversationId, conversation);

      // Track participants
      this.participants.set(conversationId, new Set([orderedParticipants[0], orderedParticipants[1]]));

      return conversation;

    } catch (error) {
      if (error instanceof ConversationError) {
        throw error;
      }
      throw new ConversationError(`Failed to create conversation: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Find conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Conversation object or null if not found
   */
  async findById(conversationId) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation || conversation.deleted_at) {
        return null;
      }

      return conversation;
    } catch (error) {
      throw new ConversationError(`Failed to find conversation by ID: ${error.message}`, 'FIND_BY_ID_FAILED');
    }
  }

  /**
   * Find direct conversation between two participants
   * @param {string} participant1Id - First participant ID
   * @param {string} participant2Id - Second participant ID
   * @returns {Promise<Object|null>} Conversation object or null if not found
   */
  async findByParticipants(participant1Id, participant2Id) {
    try {
      // Ensure consistent ordering
      const orderedParticipants = [participant1Id, participant2Id].sort();

      for (const conversation of this.conversations.values()) {
        if (conversation.deleted_at) continue;
        
        if (conversation.conversation_type === 'direct' &&
            conversation.participant_1_id === orderedParticipants[0] &&
            conversation.participant_2_id === orderedParticipants[1]) {
          return conversation;
        }
      }

      return null;
    } catch (error) {
      throw new ConversationError(`Failed to find conversation by participants: ${error.message}`, 'FIND_BY_PARTICIPANTS_FAILED');
    }
  }

  /**
   * Find all conversations for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of conversations to return
   * @param {number} options.offset - Number of conversations to skip
   * @param {string} options.status - Filter by status ('active', 'archived', 'deleted')
   * @returns {Promise<Array>} Array of conversation objects
   */
  async findByUserId(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, status = 'active' } = options;

      const userConversations = [];

      for (const conversation of this.conversations.values()) {
        if (conversation.deleted_at && status !== 'deleted') continue;
        
        // Check if user is a participant
        const isParticipant = conversation.participant_1_id === userId || 
                             conversation.participant_2_id === userId;

        if (!isParticipant) continue;

        // Apply status filter
        if (status === 'archived') {
          const isArchivedForUser = 
            (conversation.participant_1_id === userId && conversation.is_archived_by_participant_1) ||
            (conversation.participant_2_id === userId && conversation.is_archived_by_participant_2);
          
          if (!isArchivedForUser) continue;
        } else if (status === 'active') {
          if (conversation.status !== 'active') continue;
          
          const isArchivedForUser = 
            (conversation.participant_1_id === userId && conversation.is_archived_by_participant_1) ||
            (conversation.participant_2_id === userId && conversation.is_archived_by_participant_2);
          
          if (isArchivedForUser) continue;
        }

        userConversations.push(conversation);
      }

      // Sort by last message time (most recent first)
      userConversations.sort((a, b) => {
        if (!a.last_message_at && !b.last_message_at) return 0;
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return new Date(b.last_message_at) - new Date(a.last_message_at);
      });

      // Apply pagination
      return userConversations.slice(offset, offset + limit);

    } catch (error) {
      throw new ConversationError(`Failed to find conversations by user ID: ${error.message}`, 'FIND_BY_USER_FAILED');
    }
  }

  /**
   * Update conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated conversation object
   */
  async update(conversationId, updateData) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation || conversation.deleted_at) {
        throw new ConversationError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      // Validate and sanitize update data
      const allowedFields = [
        'title', 'description', 'status', 'is_archived_by_participant_1', 
        'is_archived_by_participant_2', 'last_message_at', 'last_message_id',
        'message_count', 'encryption_enabled', 'file_sharing_enabled'
      ];

      const updates = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates[key] = value;
        }
      }

      // Validate specific fields
      if (updates.title && !validator.isLength(updates.title, { min: 1, max: 200 })) {
        throw new ConversationError('Title must be between 1 and 200 characters', 'INVALID_TITLE');
      }

      if (updates.description && updates.description.length > 1000) {
        throw new ConversationError('Description must not exceed 1000 characters', 'INVALID_DESCRIPTION');
      }

      if (updates.status && !['active', 'archived', 'deleted'].includes(updates.status)) {
        throw new ConversationError('Invalid status', 'INVALID_STATUS');
      }

      // Sanitize text fields
      if (updates.title) {
        updates.title = validator.escape(updates.title.trim());
      }
      if (updates.description) {
        updates.description = validator.escape(updates.description.trim());
      }

      // Apply updates
      const updatedConversation = {
        ...conversation,
        ...updates,
        updated_at: new Date()
      };

      this.conversations.set(conversationId, updatedConversation);

      return updatedConversation;

    } catch (error) {
      if (error instanceof ConversationError) {
        throw error;
      }
      throw new ConversationError(`Failed to update conversation: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Archive conversation for a specific user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID who is archiving
   * @returns {Promise<Object>} Updated conversation object
   */
  async archive(conversationId, userId) {
    try {
      const conversation = await this.findById(conversationId);
      if (!conversation) {
        throw new ConversationError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      // Check if user is a participant
      const isParticipant = conversation.participant_1_id === userId || 
                           conversation.participant_2_id === userId;

      if (!isParticipant) {
        throw new ConversationError('User is not a participant in this conversation', 'NOT_PARTICIPANT');
      }

      // Set archive flag for the specific user
      const updates = {};
      if (conversation.participant_1_id === userId) {
        updates.is_archived_by_participant_1 = true;
      } else {
        updates.is_archived_by_participant_2 = true;
      }

      return await this.update(conversationId, updates);

    } catch (error) {
      if (error instanceof ConversationError) {
        throw error;
      }
      throw new ConversationError(`Failed to archive conversation: ${error.message}`, 'ARCHIVE_FAILED');
    }
  }

  /**
   * Unarchive conversation for a specific user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID who is unarchiving
   * @returns {Promise<Object>} Updated conversation object
   */
  async unarchive(conversationId, userId) {
    try {
      const conversation = await this.findById(conversationId);
      if (!conversation) {
        throw new ConversationError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      // Check if user is a participant
      const isParticipant = conversation.participant_1_id === userId || 
                           conversation.participant_2_id === userId;

      if (!isParticipant) {
        throw new ConversationError('User is not a participant in this conversation', 'NOT_PARTICIPANT');
      }

      // Remove archive flag for the specific user
      const updates = {};
      if (conversation.participant_1_id === userId) {
        updates.is_archived_by_participant_1 = false;
      } else {
        updates.is_archived_by_participant_2 = false;
      }

      return await this.update(conversationId, updates);

    } catch (error) {
      if (error instanceof ConversationError) {
        throw error;
      }
      throw new ConversationError(`Failed to unarchive conversation: ${error.message}`, 'UNARCHIVE_FAILED');
    }
  }

  /**
   * Delete conversation (soft delete)
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(conversationId) {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation || conversation.deleted_at) {
        throw new ConversationError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      // Soft delete
      const updatedConversation = {
        ...conversation,
        deleted_at: new Date(),
        updated_at: new Date()
      };

      this.conversations.set(conversationId, updatedConversation);

      // Clean up participants tracking
      this.participants.delete(conversationId);

      return true;

    } catch (error) {
      if (error instanceof ConversationError) {
        throw error;
      }
      throw new ConversationError(`Failed to delete conversation: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Check if user has access to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Access status
   */
  async hasAccess(conversationId, userId) {
    try {
      const conversation = await this.findById(conversationId);
      if (!conversation) {
        return false;
      }

      return conversation.participant_1_id === userId || 
             conversation.participant_2_id === userId;

    } catch (error) {
      console.error('Error checking conversation access:', error);
      return false;
    }
  }

  /**
   * Get conversation statistics
   * @returns {Promise<Object>} Conversation statistics
   */
  async getStats() {
    try {
      const stats = {
        totalConversations: 0,
        activeConversations: 0,
        archivedConversations: 0,
        deletedConversations: 0,
        directConversations: 0,
        bookingConversations: 0,
        groupConversations: 0
      };

      for (const conversation of this.conversations.values()) {
        stats.totalConversations++;

        if (conversation.deleted_at) {
          stats.deletedConversations++;
        } else {
          if (conversation.status === 'active') {
            stats.activeConversations++;
          } else if (conversation.status === 'archived') {
            stats.archivedConversations++;
          }

          // Count by type
          if (conversation.conversation_type === 'direct') {
            stats.directConversations++;
          } else if (conversation.conversation_type === 'booking') {
            stats.bookingConversations++;
          } else if (conversation.conversation_type === 'group') {
            stats.groupConversations++;
          }
        }
      }

      return stats;

    } catch (error) {
      throw new ConversationError(`Failed to get conversation statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Reset all data (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    this.conversations.clear();
    this.participants.clear();
  }
}

// Export singleton instance
module.exports = {
  Conversation: new Conversation(),
  ConversationError
};