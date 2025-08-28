/**
 * Message Controller Tests
 * Tests for messaging REST API endpoints
 */

const request = require('supertest');
const { app } = require('../../src/app');
const jwt = require('../../src/auth/jwt');
const { Conversation } = require('../../src/models/Conversation');
const { Message } = require('../../src/models/Message');
const { User } = require('../../src/models/User');

describe('Message Controller', () => {
  let authToken;
  let testUserId;
  let testUser2Id;

  beforeAll(async () => {
    // Create test users
    testUserId = 'test-user-1';
    testUser2Id = 'test-user-2';
    
    // Mock User model
    User.findById = jest.fn((userId) => {
      if (userId === testUserId) {
        return Promise.resolve({
          id: testUserId,
          firstName: 'Test',
          lastName: 'User1',
          profilePhoto: null
        });
      }
      if (userId === testUser2Id) {
        return Promise.resolve({
          id: testUser2Id,
          firstName: 'Test',
          lastName: 'User2',
          profilePhoto: null
        });
      }
      return Promise.resolve(null);
    });

    // Generate auth token
    authToken = jwt.signToken({
      userId: testUserId,
      email: 'test1@example.com',
      emailVerified: true,
      role: 'user',
      kycStatus: 'verified'
    });
  });

  beforeEach(async () => {
    // Reset models before each test
    await Conversation.reset();
    await Message.reset();
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          participantId: testUser2Id,
          type: 'direct'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.conversation).toHaveProperty('id');
      expect(response.body.conversation.type).toBe('direct');
      expect(response.body.conversation.participants).toHaveLength(2);
    });

    it('should return error for same participant', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          participantId: testUserId,
          type: 'direct'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SAME_PARTICIPANT');
    });

    it('should return error for existing direct conversation', async () => {
      // Create first conversation
      await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          participantId: testUser2Id,
          type: 'direct'
        })
        .expect(201);

      // Try to create another direct conversation with same participant
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          participantId: testUser2Id,
          type: 'direct'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CONVERSATION_EXISTS');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          participantId: testUser2Id,
          type: 'direct'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/conversations', () => {
    beforeEach(async () => {
      // Create a test conversation
      await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
    });

    it('should get conversations for authenticated user', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0]).toHaveProperty('participant');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/conversations?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('offset', 0);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/conversations?limit=200')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_LIMIT');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/conversations/:id', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;
    });

    it('should get conversation by ID', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.conversation.id).toBe(conversationId);
      expect(response.body.conversation.participants).toHaveLength(2);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/conversations/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;

      // Add some test messages
      await Message.create({
        conversation_id: conversationId,
        sender_id: testUserId,
        message_type: 'text',
        content: 'Hello!'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: testUser2Id,
        message_type: 'text',
        content: 'Hi there!'
      });
    });

    it('should get messages for conversation', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toHaveProperty('sender');
      expect(response.body.messages[0]).toHaveProperty('content');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages?limit=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(1);
      expect(response.body.pagination.hasMore).toBe(true);
    });
  });

  describe('POST /api/conversations/:id/archive', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;
    });

    it('should archive conversation', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/archive`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.conversation.isArchived).toBe(true);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .post('/api/conversations/non-existent-id/archive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('POST /api/conversations/:id/unarchive', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;

      // Archive the conversation first
      await Conversation.archive(conversationId, testUserId);
    });

    it('should unarchive conversation', async () => {
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/unarchive`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.conversation.isArchived).toBe(false);
    });
  });

  describe('GET /api/conversations/:id/search', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;

      await Message.create({
        conversation_id: conversationId,
        sender_id: testUserId,
        message_type: 'text',
        content: 'Hello world, this is a test message'
      });

      await Message.create({
        conversation_id: conversationId,
        sender_id: testUser2Id,
        message_type: 'text',
        content: 'Another message without the keyword'
      });
    });

    it('should search messages in conversation', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/search?q=test`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(1);
      expect(response.body.messages[0].content).toContain('test');
      expect(response.body.query).toBe('test');
    });

    it('should return empty results for no matches', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/search?q=nonexistent`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(0);
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_QUERY');
    });
  });

  describe('GET /api/conversations/stats', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .get('/api/conversations/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ACCESS_DENIED');
    });

    it('should return stats for admin user', async () => {
      const adminToken = jwt.signToken({
        userId: 'admin-user',
        email: 'admin@example.com',
        emailVerified: true,
        role: 'admin',
        kycStatus: 'verified'
      });

      const response = await request(app)
        .get('/api/conversations/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toHaveProperty('conversations');
      expect(response.body.stats).toHaveProperty('messages');
    });
  });
});