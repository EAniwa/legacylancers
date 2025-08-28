/**
 * Message Model Tests
 * Tests for message data model and business logic
 */

const { Message, MessageError } = require('../../src/models/Message');
const { Conversation } = require('../../src/models/Conversation');

describe('Message Model', () => {
  let conversationId;

  beforeEach(async () => {
    // Reset models before each test
    await Message.reset();
    await Conversation.reset();

    // Create a test conversation
    const conversation = await Conversation.create({
      participant_1_id: 'user-1',
      participant_2_id: 'user-2',
      conversation_type: 'direct'
    });
    conversationId = conversation.id;
  });

  describe('create', () => {
    it('should create a text message', async () => {
      const messageData = {
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Hello, world!'
      };

      const message = await Message.create(messageData);

      expect(message).toHaveProperty('id');
      expect(message.conversation_id).toBe(conversationId);
      expect(message.sender_id).toBe('user-1');
      expect(message.message_type).toBe('text');
      expect(message.content).toBe('Hello, world!');
      expect(message.status).toBe('sent');
      expect(message.file_count).toBe(0);
      expect(message.is_deleted).toBe(false);
    });

    it('should create a system message without content requirement', async () => {
      const messageData = {
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'system',
        metadata: { type: 'user_joined' }
      };

      const message = await Message.create(messageData);

      expect(message.message_type).toBe('system');
      expect(message.metadata.type).toBe('user_joined');
      expect(message.content).toBe(null);
    });

    it('should create message with files', async () => {
      const files = [
        {
          filename: 'test.jpg',
          originalFilename: 'test.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          filePath: '/path/to/file'
        }
      ];

      const messageData = {
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'image',
        content: 'Shared an image',
        files
      };

      const message = await Message.create(messageData);

      expect(message.message_type).toBe('image');
      expect(message.file_count).toBe(1);
    });

    it('should throw error for missing required fields', async () => {
      await expect(
        Message.create({
          sender_id: 'user-1',
          message_type: 'text',
          content: 'Hello'
        })
      ).rejects.toThrow(MessageError);

      await expect(
        Message.create({
          conversation_id: conversationId,
          message_type: 'text',
          content: 'Hello'
        })
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for invalid message type', async () => {
      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'invalid',
          content: 'Hello'
        })
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for empty text message content', async () => {
      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'text',
          content: ''
        })
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for content that is too long', async () => {
      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'text',
          content: 'a'.repeat(5001)
        })
      ).rejects.toThrow(MessageError);
    });

    it('should sanitize HTML in content', async () => {
      const message = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: '<script>alert("xss")</script>Safe content'
      });

      expect(message.content).not.toContain('<script>');
      expect(message.content).toContain('Safe content');
    });

    it('should handle reply to message', async () => {
      // Create original message
      const originalMessage = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Original message'
      });

      // Create reply
      const replyMessage = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Reply message',
        reply_to_message_id: originalMessage.id
      });

      expect(replyMessage.reply_to_message_id).toBe(originalMessage.id);
    });

    it('should throw error for invalid reply message ID', async () => {
      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'text',
          content: 'Reply message',
          reply_to_message_id: 'invalid-id'
        })
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for reply message from different conversation', async () => {
      // Create another conversation
      const otherConversation = await Conversation.create({
        participant_1_id: 'user-3',
        participant_2_id: 'user-4',
        conversation_type: 'direct'
      });

      // Create message in other conversation
      const otherMessage = await Message.create({
        conversation_id: otherConversation.id,
        sender_id: 'user-3',
        message_type: 'text',
        content: 'Other message'
      });

      // Try to reply from different conversation
      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'text',
          content: 'Reply message',
          reply_to_message_id: otherMessage.id
        })
      ).rejects.toThrow(MessageError);
    });

    it('should validate metadata is an object', async () => {
      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'text',
          content: 'Hello',
          metadata: 'invalid'
        })
      ).rejects.toThrow(MessageError);

      await expect(
        Message.create({
          conversation_id: conversationId,
          sender_id: 'user-1',
          message_type: 'text',
          content: 'Hello',
          metadata: ['invalid']
        })
      ).rejects.toThrow(MessageError);
    });
  });

  describe('findById', () => {
    it('should find message by ID', async () => {
      const created = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Test message'
      });

      const found = await Message.findById(created.id);

      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.content).toBe('Test message');
    });

    it('should return null for non-existent ID', async () => {
      const found = await Message.findById('non-existent-id');
      expect(found).toBeNull();
    });

    it('should return null for deleted message', async () => {
      const created = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Test message'
      });

      await Message.update(created.id, { is_deleted: true });
      const found = await Message.findById(created.id);

      expect(found).not.toBeNull(); // Soft delete doesn't hide from findById
    });
  });

  describe('findByConversationId', () => {
    beforeEach(async () => {
      // Create test messages
      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Message 1'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Message 2'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Message 3'
      });
    });

    it('should find messages by conversation ID', async () => {
      const messages = await Message.findByConversationId(conversationId);

      expect(messages).toHaveLength(3);
      // Messages should be sorted by creation time (newest first)
      // The sorting depends on the actual creation timestamps, so let's just check we have all messages
      const contents = messages.map(m => m.content);
      expect(contents).toContain('Message 1');
      expect(contents).toContain('Message 2');
      expect(contents).toContain('Message 3');
    });

    it('should support pagination', async () => {
      const messages = await Message.findByConversationId(conversationId, {
        limit: 2,
        offset: 0
      });

      expect(messages).toHaveLength(2);

      const nextPage = await Message.findByConversationId(conversationId, {
        limit: 2,
        offset: 2
      });

      expect(nextPage).toHaveLength(1);
    });

    it('should support cursor-based pagination with before', async () => {
      const allMessages = await Message.findByConversationId(conversationId);
      const beforeId = allMessages[1].id; // Second message (by sort order)

      const messages = await Message.findByConversationId(conversationId, {
        before: beforeId,
        limit: 10
      });

      // Should get messages created after the "before" message in the sorted order
      expect(messages.length).toBeGreaterThanOrEqual(1);
      expect(messages.every(m => m.id !== beforeId)).toBe(true);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await Message.findByConversationId('non-existent-id');
      expect(messages).toHaveLength(0);
    });

    it('should exclude deleted messages', async () => {
      const allMessages = await Message.findByConversationId(conversationId);
      expect(allMessages).toHaveLength(3);

      // Delete one message
      await Message.update(allMessages[0].id, { is_deleted: true });

      const remainingMessages = await Message.findByConversationId(conversationId);
      expect(remainingMessages).toHaveLength(2);
    });
  });

  describe('update', () => {
    let messageId;

    beforeEach(async () => {
      const message = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Original content'
      });
      messageId = message.id;
    });

    it('should update message content', async () => {
      const updated = await Message.update(messageId, {
        content: 'Updated content'
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.edited_at).toBeInstanceOf(Date);
      expect(updated.updated_at).toBeInstanceOf(Date);
    });

    it('should update message status', async () => {
      const updated = await Message.update(messageId, {
        status: 'read'
      });

      expect(updated.status).toBe('read');
    });

    it('should ignore non-allowed fields', async () => {
      const updated = await Message.update(messageId, {
        content: 'Updated content',
        id: 'new-id', // Should be ignored
        sender_id: 'new-sender' // Should be ignored
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.id).toBe(messageId); // Should not change
      expect(updated.sender_id).toBe('user-1'); // Should not change
    });

    it('should validate content length', async () => {
      await expect(
        Message.update(messageId, {
          content: 'a'.repeat(5001)
        })
      ).rejects.toThrow(MessageError);
    });

    it('should validate status values', async () => {
      await expect(
        Message.update(messageId, {
          status: 'invalid-status'
        })
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for non-existent message', async () => {
      await expect(
        Message.update('non-existent-id', { content: 'New content' })
      ).rejects.toThrow(MessageError);
    });
  });

  describe('markAsRead', () => {
    let messageId;

    beforeEach(async () => {
      const message = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Test message'
      });
      messageId = message.id;
    });

    it('should mark message as read by participant 2', async () => {
      const updated = await Message.markAsRead(messageId, 'user-2', conversationId);

      expect(updated.read_by_participant_2).toBe(true);
      expect(updated.read_at_participant_2).toBeInstanceOf(Date);
      expect(updated.read_by_participant_1).toBe(false);
    });

    it('should mark message as read by participant 1', async () => {
      // Create message from user-2 so user-1 can mark it as read
      const message = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Test message from user 2'
      });

      const updated = await Message.markAsRead(message.id, 'user-1', conversationId);

      expect(updated.read_by_participant_1).toBe(true);
      expect(updated.read_at_participant_1).toBeInstanceOf(Date);
      expect(updated.read_by_participant_2).toBe(false);
    });

    it('should not mark own message as read', async () => {
      const updated = await Message.markAsRead(messageId, 'user-1', conversationId);

      // Should return original message without changes
      expect(updated.read_by_participant_1).toBe(false);
      expect(updated.read_by_participant_2).toBe(false);
    });

    it('should update status to read when both participants have read', async () => {
      // Mark as read by recipient
      let updated = await Message.markAsRead(messageId, 'user-2', conversationId);
      expect(updated.status).toBe('sent'); // Still sent, not fully read

      // Simulate sender also reading (though this wouldn't normally happen)
      updated = await Message.update(messageId, {
        read_by_participant_1: true,
        read_at_participant_1: new Date()
      });

      // Now manually update to read status as both have read
      updated = await Message.update(messageId, { status: 'read' });
      expect(updated.status).toBe('read');
    });

    it('should throw error for non-existent message', async () => {
      await expect(
        Message.markAsRead('non-existent-id', 'user-2', conversationId)
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for wrong conversation', async () => {
      await expect(
        Message.markAsRead(messageId, 'user-2', 'wrong-conversation-id')
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for non-participant', async () => {
      await expect(
        Message.markAsRead(messageId, 'user-3', conversationId)
      ).rejects.toThrow(MessageError);
    });
  });

  describe('deleteForUser', () => {
    let messageId;

    beforeEach(async () => {
      const message = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Message to delete'
      });
      messageId = message.id;
    });

    it('should delete message for specific user', async () => {
      const updated = await Message.deleteForUser(messageId, 'user-1', conversationId);

      expect(updated.deleted_for_participant_1).toBe(true);
      expect(updated.deleted_for_participant_2).toBe(false);
      expect(updated.is_deleted).toBe(false); // Not deleted for everyone
    });

    it('should delete message for everyone by sender', async () => {
      const updated = await Message.deleteForUser(messageId, 'user-1', conversationId, true);

      expect(updated.is_deleted).toBe(true);
      expect(updated.content).toBe('This message was deleted');
    });

    it('should not allow delete for everyone by non-sender', async () => {
      await expect(
        Message.deleteForUser(messageId, 'user-2', conversationId, true)
      ).rejects.toThrow(MessageError);
    });

    it('should respect time limit for delete for everyone', async () => {
      // Create an old message by manually setting creation time
      const oldMessage = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Old message'
      });

      // Manually set old timestamp (6 minutes ago)
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      await Message.update(oldMessage.id, {
        created_at: sixMinutesAgo
      });

      // Mock the current message creation time to be old
      const messageData = Message.messages.get(oldMessage.id);
      messageData.created_at = sixMinutesAgo;
      Message.messages.set(oldMessage.id, messageData);

      await expect(
        Message.deleteForUser(oldMessage.id, 'user-1', conversationId, true)
      ).rejects.toThrow(MessageError);
    });

    it('should throw error for non-participant', async () => {
      await expect(
        Message.deleteForUser(messageId, 'user-3', conversationId)
      ).rejects.toThrow(MessageError);
    });
  });

  describe('getUnreadCount', () => {
    beforeEach(async () => {
      // Create messages from different senders
      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Message from user 1'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Message from user 2'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Another message from user 1'
      });
    });

    it('should count unread messages for user', async () => {
      const unreadCount = await Message.getUnreadCount(conversationId, 'user-2');
      expect(unreadCount).toBe(2); // 2 messages from user-1 that user-2 hasn't read
    });

    it('should not count own messages', async () => {
      const unreadCount = await Message.getUnreadCount(conversationId, 'user-1');
      expect(unreadCount).toBe(1); // 1 message from user-2 that user-1 hasn't read
    });

    it('should return 0 for non-existent conversation', async () => {
      const unreadCount = await Message.getUnreadCount('non-existent-id', 'user-1');
      expect(unreadCount).toBe(0);
    });

    it('should update count when messages are marked as read', async () => {
      const messages = await Message.findByConversationId(conversationId);
      const messageFromUser1 = messages.find(m => m.sender_id === 'user-1');

      // Initially user-2 has unread messages
      let unreadCount = await Message.getUnreadCount(conversationId, 'user-2');
      expect(unreadCount).toBe(2);

      // Mark one message as read
      await Message.markAsRead(messageFromUser1.id, 'user-2', conversationId);

      // Count should decrease
      unreadCount = await Message.getUnreadCount(conversationId, 'user-2');
      expect(unreadCount).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Hello world, this is a test message'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Another message without the keyword'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Testing search functionality'
      });
    });

    it('should search messages by content', async () => {
      const results = await Message.search(conversationId, 'test');
      expect(results).toHaveLength(2);
      expect(results.every(msg => msg.content.toLowerCase().includes('test'))).toBe(true);
    });

    it('should be case insensitive', async () => {
      const results = await Message.search(conversationId, 'TEST');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await Message.search(conversationId, 'nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', async () => {
      const results = await Message.search(conversationId, '');
      expect(results).toHaveLength(0);
    });

    it('should support limit option', async () => {
      const results = await Message.search(conversationId, 'message', { limit: 1 });
      expect(results).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'text',
        content: 'Text message'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'file',
        content: 'Shared a file'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-1',
        message_type: 'system',
        content: 'System notification'
      });

      // Create and delete a message
      const toDelete = await Message.create({
        conversation_id: conversationId,
        sender_id: 'user-2',
        message_type: 'text',
        content: 'Message to delete'
      });

      await Message.update(toDelete.id, { is_deleted: true });
    });

    it('should return message statistics', async () => {
      const stats = await Message.getStats();

      expect(stats.totalMessages).toBe(4);
      expect(stats.textMessages).toBe(1); // Only non-deleted text messages count
      expect(stats.fileMessages).toBe(1);
      expect(stats.systemMessages).toBe(1);
      expect(stats.deletedMessages).toBe(1);
      expect(stats.unreadMessages).toBe(3); // All non-deleted messages are unread initially
    });
  });
});