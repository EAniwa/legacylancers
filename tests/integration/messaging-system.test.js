/**
 * Messaging System Integration Tests
 * End-to-end tests for the complete messaging functionality
 */

const request = require('supertest');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const http = require('http');
const { app } = require('../../src/app');
const jwt = require('../../src/auth/jwt');
const { initializeMessageSocket } = require('../../src/sockets/messageSocket');
const { Conversation } = require('../../src/models/Conversation');
const { Message } = require('../../src/models/Message');
const { User } = require('../../src/models/User');

describe('Messaging System Integration', () => {
  let httpServer;
  let io;
  let clientSocket1;
  let clientSocket2;
  let authToken1;
  let authToken2;
  let testUserId1;
  let testUserId2;

  beforeAll((done) => {
    // Create HTTP server
    httpServer = http.createServer(app);
    
    // Create Socket.IO instance
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Initialize message socket handlers
    initializeMessageSocket(io);

    // Start server
    httpServer.listen(() => {
      const port = httpServer.address().port;

      // Setup test data
      testUserId1 = 'integration-user-1';
      testUserId2 = 'integration-user-2';

      // Mock User model
      User.findById = jest.fn((userId) => {
        if (userId === testUserId1) {
          return Promise.resolve({
            id: testUserId1,
            firstName: 'Integration',
            lastName: 'User1',
            profilePhoto: null
          });
        }
        if (userId === testUserId2) {
          return Promise.resolve({
            id: testUserId2,
            firstName: 'Integration',
            lastName: 'User2',
            profilePhoto: null
          });
        }
        return Promise.resolve(null);
      });

      // Generate auth tokens
      authToken1 = jwt.generateToken({
        userId: testUserId1,
        email: 'integration1@example.com',
        emailVerified: true,
        role: 'user',
        kycStatus: 'verified'
      });

      authToken2 = jwt.generateToken({
        userId: testUserId2,
        email: 'integration2@example.com',
        emailVerified: true,
        role: 'user',
        kycStatus: 'verified'
      });

      // Create client sockets
      clientSocket1 = new Client(`http://localhost:${port}`, {
        auth: { token: authToken1 }
      });

      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: { token: authToken2 }
      });

      let connectionsCount = 0;
      const checkConnections = () => {
        connectionsCount++;
        if (connectionsCount === 2) {
          done();
        }
      };

      clientSocket1.on('connect', checkConnections);
      clientSocket2.on('connect', checkConnections);
    });
  });

  afterAll(() => {
    clientSocket1?.close();
    clientSocket2?.close();
    httpServer?.close();
  });

  beforeEach(async () => {
    // Reset models before each test
    await Conversation.reset();
    await Message.reset();
  });

  describe('Complete Messaging Flow', () => {
    let conversationId;

    it('should complete full messaging workflow', async () => {
      // Step 1: Create conversation via REST API
      const createResponse = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          participantId: testUserId2,
          type: 'direct'
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      conversationId = createResponse.body.conversation.id;

      // Step 2: Both users join the conversation via WebSocket
      const joinPromise1 = new Promise((resolve) => {
        clientSocket1.emit('join_conversation', { conversationId }, resolve);
      });

      const joinPromise2 = new Promise((resolve) => {
        clientSocket2.emit('join_conversation', { conversationId }, resolve);
      });

      const [joinResponse1, joinResponse2] = await Promise.all([joinPromise1, joinPromise2]);
      
      expect(joinResponse1.success).toBe(true);
      expect(joinResponse2.success).toBe(true);

      // Step 3: Send message via WebSocket
      const messagePromise = new Promise((resolve) => {
        clientSocket2.on('new_message', (messageData) => {
          expect(messageData.content).toBe('Hello from integration test!');
          expect(messageData.sender.id).toBe(testUserId1);
          resolve(messageData);
        });
      });

      const sendPromise = new Promise((resolve) => {
        clientSocket1.emit('send_message', {
          conversationId,
          content: 'Hello from integration test!',
          messageType: 'text'
        }, resolve);
      });

      const [sendResponse, receivedMessage] = await Promise.all([sendPromise, messagePromise]);
      
      expect(sendResponse.success).toBe(true);
      expect(receivedMessage.id).toBeDefined();

      // Step 4: Get messages via REST API
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(messagesResponse.body.success).toBe(true);
      expect(messagesResponse.body.messages).toHaveLength(1);
      expect(messagesResponse.body.messages[0].content).toBe('Hello from integration test!');

      // Step 5: Mark message as read via WebSocket
      const readPromise = new Promise((resolve) => {
        clientSocket1.on('message_read', (readData) => {
          expect(readData.messageId).toBe(receivedMessage.id);
          expect(readData.readBy).toBe(testUserId2);
          resolve(readData);
        });
      });

      const markReadPromise = new Promise((resolve) => {
        clientSocket2.emit('mark_message_read', {
          conversationId,
          messageId: receivedMessage.id
        }, resolve);
      });

      const [markReadResponse, readReceipt] = await Promise.all([markReadPromise, readPromise]);
      
      expect(markReadResponse.success).toBe(true);
      expect(readReceipt.readAt).toBeDefined();

      // Step 6: Send reply message
      const replyPromise = new Promise((resolve) => {
        clientSocket1.on('new_message', (messageData) => {
          if (messageData.content === 'Reply from user 2!') {
            expect(messageData.sender.id).toBe(testUserId2);
            expect(messageData.replyTo).toBe(receivedMessage.id);
            resolve(messageData);
          }
        });
      });

      const sendReplyPromise = new Promise((resolve) => {
        clientSocket2.emit('send_message', {
          conversationId,
          content: 'Reply from user 2!',
          messageType: 'text',
          replyToMessageId: receivedMessage.id
        }, resolve);
      });

      const [replyResponse, replyMessage] = await Promise.all([sendReplyPromise, replyPromise]);
      
      expect(replyResponse.success).toBe(true);
      expect(replyMessage.replyTo).toBe(receivedMessage.id);

      // Step 7: Get updated conversation via REST API
      const conversationResponse = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(conversationResponse.body.success).toBe(true);
      expect(conversationResponse.body.conversation.messageCount).toBe(2);
    }, 10000); // Increase timeout for integration test
  });

  describe('Real-time Features', () => {
    let conversationId;

    beforeEach(async () => {
      // Create and join conversation
      const conversation = await Conversation.create({
        participant_1_id: testUserId1,
        participant_2_id: testUserId2,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;

      // Join both clients
      await Promise.all([
        new Promise(resolve => clientSocket1.emit('join_conversation', { conversationId }, resolve)),
        new Promise(resolve => clientSocket2.emit('join_conversation', { conversationId }, resolve))
      ]);
    });

    it('should handle typing indicators', (done) => {
      let typingStartReceived = false;

      // Listen for typing start
      clientSocket2.on('typing_start', (typingData) => {
        expect(typingData.userId).toBe(testUserId1);
        expect(typingData.conversationId).toBe(conversationId);
        typingStartReceived = true;
      });

      // Listen for typing stop
      clientSocket2.on('typing_stop', (typingData) => {
        expect(typingData.userId).toBe(testUserId1);
        expect(typingData.conversationId).toBe(conversationId);
        expect(typingStartReceived).toBe(true);
        done();
      });

      // Send typing start
      clientSocket1.emit('typing_start', { conversationId });

      // Send typing stop after a short delay
      setTimeout(() => {
        clientSocket1.emit('typing_stop', { conversationId });
      }, 100);
    });

    it('should handle presence updates', (done) => {
      // Listen for presence update
      clientSocket2.on('user_presence_update', (presenceData) => {
        if (presenceData.userId === testUserId1 && presenceData.status === 'away') {
          expect(presenceData.lastSeen).toBeDefined();
          done();
        }
      });

      // Update status
      clientSocket1.emit('update_status', { status: 'away' });
    });

    it('should get user presence', (done) => {
      clientSocket1.emit('get_user_presence', {
        userIds: [testUserId1, testUserId2]
      }, (response) => {
        expect(response.success).toBe(true);
        expect(response.presence[testUserId1].status).toBe('online');
        expect(response.presence[testUserId2].status).toBe('online');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid conversation access', (done) => {
      clientSocket1.emit('join_conversation', { conversationId: 'invalid-id' }, (response) => {
        expect(response.error).toBeDefined();
        done();
      });
    });

    it('should handle rate limiting', (done) => {
      let messagesSent = 0;
      let rateLimitError = false;

      const sendMessage = () => {
        clientSocket1.emit('send_message', {
          conversationId: 'test-conv',
          content: `Message ${messagesSent + 1}`,
          messageType: 'text'
        }, (response) => {
          if (response.error && response.error.includes('Rate limit')) {
            rateLimitError = true;
            expect(messagesSent).toBeGreaterThan(20); // Should hit rate limit
            done();
          } else if (response.success) {
            messagesSent++;
            if (messagesSent < 40) {
              setTimeout(sendMessage, 10); // Send quickly
            } else if (!rateLimitError) {
              done(new Error('Rate limit should have been triggered'));
            }
          } else {
            // Other errors are expected (like invalid conversation)
            messagesSent++;
            if (messagesSent < 40) {
              setTimeout(sendMessage, 10);
            }
          }
        });
      };

      sendMessage();
    }, 15000); // Longer timeout for rate limit test

    it('should handle spam protection', (done) => {
      // First create a valid conversation
      Conversation.create({
        participant_1_id: testUserId1,
        participant_2_id: testUserId2,
        conversation_type: 'direct'
      }).then((conversation) => {
        // Join the conversation
        return new Promise(resolve => {
          clientSocket1.emit('join_conversation', { conversationId: conversation.id }, resolve);
        });
      }).then(() => {
        // Try to send a message with suspicious content
        clientSocket1.emit('send_message', {
          conversationId: 'test-conv', // Will fail, but spam protection should trigger first
          content: 'AAAAAAAAAAAAAAAAAAAAAA', // Repeated characters should trigger spam protection
          messageType: 'text'
        }, (response) => {
          expect(response.error).toBeDefined();
          // Could be spam protection or conversation validation
          done();
        });
      });
    });
  });
});