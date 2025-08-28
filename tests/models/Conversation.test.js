/**
 * Conversation Model Tests
 * Tests for conversation data model and business logic
 */

const { Conversation, ConversationError } = require('../../src/models/Conversation');

describe('Conversation Model', () => {
  beforeEach(async () => {
    // Reset model before each test
    await Conversation.reset();
  });

  describe('create', () => {
    it('should create a new direct conversation', async () => {
      const conversationData = {
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      };

      const conversation = await Conversation.create(conversationData);

      expect(conversation).toHaveProperty('id');
      expect(conversation.participant_1_id).toBe('user-1');
      expect(conversation.participant_2_id).toBe('user-2');
      expect(conversation.conversation_type).toBe('direct');
      expect(conversation.status).toBe('active');
      expect(conversation.message_count).toBe(0);
      expect(conversation.file_sharing_enabled).toBe(true);
    });

    it('should create a booking conversation', async () => {
      const conversationData = {
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'booking',
        booking_id: 'booking-123',
        title: 'Project Discussion'
      };

      const conversation = await Conversation.create(conversationData);

      expect(conversation.conversation_type).toBe('booking');
      expect(conversation.booking_id).toBe('booking-123');
      expect(conversation.title).toBe('Project Discussion');
    });

    it('should order participants consistently for direct conversations', async () => {
      const conversationData1 = {
        participant_1_id: 'user-2',
        participant_2_id: 'user-1',
        conversation_type: 'direct'
      };

      const conversationData2 = {
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      };

      const conversation1 = await Conversation.create(conversationData1);
      await Conversation.reset(); // Reset to avoid duplicate error
      const conversation2 = await Conversation.create(conversationData2);

      // Both should have same ordering
      expect(conversation1.participant_1_id).toBe(conversation2.participant_1_id);
      expect(conversation1.participant_2_id).toBe(conversation2.participant_2_id);
    });

    it('should throw error for missing participant IDs', async () => {
      await expect(
        Conversation.create({
          participant_2_id: 'user-2',
          conversation_type: 'direct'
        })
      ).rejects.toThrow(ConversationError);

      await expect(
        Conversation.create({
          participant_1_id: 'user-1',
          conversation_type: 'direct'
        })
      ).rejects.toThrow(ConversationError);
    });

    it('should throw error for same participants', async () => {
      await expect(
        Conversation.create({
          participant_1_id: 'user-1',
          participant_2_id: 'user-1',
          conversation_type: 'direct'
        })
      ).rejects.toThrow(ConversationError);
    });

    it('should throw error for invalid conversation type', async () => {
      await expect(
        Conversation.create({
          participant_1_id: 'user-1',
          participant_2_id: 'user-2',
          conversation_type: 'invalid'
        })
      ).rejects.toThrow(ConversationError);
    });

    it('should prevent duplicate direct conversations', async () => {
      const conversationData = {
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      };

      await Conversation.create(conversationData);

      await expect(
        Conversation.create(conversationData)
      ).rejects.toThrow(ConversationError);
    });

    it('should validate title length', async () => {
      await expect(
        Conversation.create({
          participant_1_id: 'user-1',
          participant_2_id: 'user-2',
          conversation_type: 'direct',
          title: 'a'.repeat(201) // Too long
        })
      ).rejects.toThrow(ConversationError);
    });

    it('should validate description length', async () => {
      await expect(
        Conversation.create({
          participant_1_id: 'user-1',
          participant_2_id: 'user-2',
          conversation_type: 'direct',
          description: 'a'.repeat(1001) // Too long
        })
      ).rejects.toThrow(ConversationError);
    });

    it('should sanitize HTML in title and description', async () => {
      const conversation = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct',
        title: '<script>alert("xss")</script>Safe Title',
        description: '<img onerror="alert(1)" src="x">Safe Description'
      });

      expect(conversation.title).not.toContain('<script>');
      expect(conversation.description).not.toContain('<img');
      expect(conversation.title).toContain('Safe Title');
      expect(conversation.description).toContain('Safe Description');
    });
  });

  describe('findById', () => {
    it('should find conversation by ID', async () => {
      const created = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });

      const found = await Conversation.findById(created.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await Conversation.findById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should return null for deleted conversation', async () => {
      const created = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });

      await Conversation.delete(created.id);
      const found = await Conversation.findById(created.id);

      expect(found).toBeNull();
    });
  });

  describe('findByParticipants', () => {
    it('should find direct conversation between participants', async () => {
      await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });

      const found = await Conversation.findByParticipants('user-1', 'user-2');
      expect(found).not.toBeNull();

      // Should work in reverse order too
      const foundReverse = await Conversation.findByParticipants('user-2', 'user-1');
      expect(foundReverse).not.toBeNull();
      expect(found.id).toBe(foundReverse.id);
    });

    it('should return null for non-existent participant pair', async () => {
      const found = await Conversation.findByParticipants('user-1', 'user-3');
      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    beforeEach(async () => {
      // Create test conversations
      await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });

      await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-3',
        conversation_type: 'direct'
      });

      // Create one with user-1 as second participant
      await Conversation.create({
        participant_1_id: 'user-4',
        participant_2_id: 'user-1',
        conversation_type: 'direct'
      });
    });

    it('should find all conversations for user', async () => {
      const conversations = await Conversation.findByUserId('user-1');
      expect(conversations).toHaveLength(3);
    });

    it('should support pagination', async () => {
      const conversations = await Conversation.findByUserId('user-1', {
        limit: 2,
        offset: 0
      });
      expect(conversations).toHaveLength(2);

      const nextPage = await Conversation.findByUserId('user-1', {
        limit: 2,
        offset: 2
      });
      expect(nextPage).toHaveLength(1);
    });

    it('should return empty array for user with no conversations', async () => {
      const conversations = await Conversation.findByUserId('user-5');
      expect(conversations).toHaveLength(0);
    });

    it('should filter by status', async () => {
      // Archive one conversation
      const allConversations = await Conversation.findByUserId('user-1');
      await Conversation.archive(allConversations[0].id, 'user-1');

      const activeConversations = await Conversation.findByUserId('user-1', {
        status: 'active'
      });
      expect(activeConversations).toHaveLength(2);

      const archivedConversations = await Conversation.findByUserId('user-1', {
        status: 'archived'
      });
      expect(archivedConversations).toHaveLength(1);
    });
  });

  describe('update', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });
      conversationId = conversation.id;
    });

    it('should update conversation fields', async () => {
      const updated = await Conversation.update(conversationId, {
        title: 'Updated Title',
        message_count: 5
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.message_count).toBe(5);
      expect(updated.updated_at).toBeInstanceOf(Date);
    });

    it('should ignore non-allowed fields', async () => {
      const updated = await Conversation.update(conversationId, {
        title: 'Updated Title',
        id: 'new-id', // Should be ignored
        participant_1_id: 'new-user' // Should be ignored
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.id).toBe(conversationId); // Should not change
      expect(updated.participant_1_id).toBe('user-1'); // Should not change
    });

    it('should validate updated title length', async () => {
      await expect(
        Conversation.update(conversationId, {
          title: 'a'.repeat(201)
        })
      ).rejects.toThrow(ConversationError);
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(
        Conversation.update('non-existent-id', { title: 'New Title' })
      ).rejects.toThrow(ConversationError);
    });
  });

  describe('archive and unarchive', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });
      conversationId = conversation.id;
    });

    it('should archive conversation for participant 1', async () => {
      const updated = await Conversation.archive(conversationId, 'user-1');
      
      expect(updated.is_archived_by_participant_1).toBe(true);
      expect(updated.is_archived_by_participant_2).toBe(false);
    });

    it('should archive conversation for participant 2', async () => {
      const updated = await Conversation.archive(conversationId, 'user-2');
      
      expect(updated.is_archived_by_participant_1).toBe(false);
      expect(updated.is_archived_by_participant_2).toBe(true);
    });

    it('should unarchive conversation', async () => {
      await Conversation.archive(conversationId, 'user-1');
      const updated = await Conversation.unarchive(conversationId, 'user-1');
      
      expect(updated.is_archived_by_participant_1).toBe(false);
    });

    it('should throw error for non-participant', async () => {
      await expect(
        Conversation.archive(conversationId, 'user-3')
      ).rejects.toThrow(ConversationError);
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(
        Conversation.archive('non-existent-id', 'user-1')
      ).rejects.toThrow(ConversationError);
    });
  });

  describe('hasAccess', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });
      conversationId = conversation.id;
    });

    it('should return true for participants', async () => {
      const hasAccess1 = await Conversation.hasAccess(conversationId, 'user-1');
      const hasAccess2 = await Conversation.hasAccess(conversationId, 'user-2');
      
      expect(hasAccess1).toBe(true);
      expect(hasAccess2).toBe(true);
    });

    it('should return false for non-participants', async () => {
      const hasAccess = await Conversation.hasAccess(conversationId, 'user-3');
      expect(hasAccess).toBe(false);
    });

    it('should return false for non-existent conversation', async () => {
      const hasAccess = await Conversation.hasAccess('non-existent-id', 'user-1');
      expect(hasAccess).toBe(false);
    });
  });

  describe('delete', () => {
    it('should soft delete conversation', async () => {
      const conversation = await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });

      const result = await Conversation.delete(conversation.id);
      expect(result).toBe(true);

      const found = await Conversation.findById(conversation.id);
      expect(found).toBeNull();
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(
        Conversation.delete('non-existent-id')
      ).rejects.toThrow(ConversationError);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // Create test conversations with different types
      await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        conversation_type: 'direct'
      });

      await Conversation.create({
        participant_1_id: 'user-1',
        participant_2_id: 'user-3',
        conversation_type: 'booking',
        booking_id: 'booking-1'
      });

      const toDelete = await Conversation.create({
        participant_1_id: 'user-2',
        participant_2_id: 'user-3',
        conversation_type: 'direct'
      });

      await Conversation.delete(toDelete.id);
    });

    it('should return conversation statistics', async () => {
      const stats = await Conversation.getStats();

      expect(stats.totalConversations).toBe(3);
      expect(stats.activeConversations).toBe(2);
      expect(stats.deletedConversations).toBe(1);
      expect(stats.directConversations).toBe(1); // Only active direct conversations
      expect(stats.bookingConversations).toBe(1);
      expect(stats.groupConversations).toBe(0);
    });
  });
});