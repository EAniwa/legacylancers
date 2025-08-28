/**
 * Socket.IO Message Tests
 * Tests for real-time messaging functionality
 */

const { Server } = require('socket.io');
const Client = require('socket.io-client');
const http = require('http');
const jwt = require('../../src/auth/jwt');
const { initializeMessageSocket } = require('../../src/sockets/messageSocket');
const { Conversation } = require('../../src/models/Conversation');
const { Message } = require('../../src/models/Message');
const { User } = require('../../src/models/User');

describe('Socket.IO Message Events', () => {
  let server;
  let io;
  let clientSocket;
  let clientSocket2;
  let serverSocket;
  let testUserId;
  let testUser2Id;
  let authToken;
  let authToken2;

  beforeAll((done) => {
    // Create HTTP server and Socket.IO instance
    server = http.createServer();
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Initialize message socket handlers
    initializeMessageSocket(io);

    server.listen(() => {
      const port = server.address().port;

      // Setup test data
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

      // Generate auth tokens
      authToken = jwt.signToken({
        userId: testUserId,
        email: 'test1@example.com',
        emailVerified: true,
        role: 'user',
        kycStatus: 'verified'
      });

      authToken2 = jwt.signToken({
        userId: testUser2Id,
        email: 'test2@example.com',
        emailVerified: true,
        role: 'user',
        kycStatus: 'verified'
      });

      // Create client sockets
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: authToken
        }
      });

      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: {
          token: authToken2
        }
      });

      clientSocket.on('connect', () => {
        clientSocket2.on('connect', () => {
          done();
        });
      });
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.close();
    clientSocket2.close();
  });

  beforeEach(async () => {
    // Reset models before each test
    await Conversation.reset();
    await Message.reset();
  });

  describe('Connection and Authentication', () => {
    it('should authenticate valid JWT token', (done) => {
      const testClient = new Client(`http://localhost:${server.address().port}`, {
        auth: {
          token: authToken
        }
      });

      testClient.on('connect', () => {
        expect(testClient.connected).toBe(true);
        testClient.close();
        done();
      });

      testClient.on('connect_error', (error) => {
        testClient.close();
        done(error);
      });
    });

    it('should reject invalid JWT token', (done) => {
      const testClient = new Client(`http://localhost:${server.address().port}`, {
        auth: {
          token: 'invalid-token'
        }
      });

      testClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        testClient.close();
        done();
      });

      testClient.on('connect', () => {
        testClient.close();
        done(new Error('Should not connect with invalid token'));
      });
    });

    it('should reject connection without token', (done) => {
      const testClient = new Client(`http://localhost:${server.address().port}`);

      testClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        testClient.close();
        done();
      });

      testClient.on('connect', () => {
        testClient.close();
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Conversation Events', () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = await Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      });
      conversationId = conversation.id;
    });

    describe('join_conversation', () => {
      it('should join conversation room', (done) => {
        clientSocket.emit('join_conversation', { conversationId }, (response) => {
          expect(response.success).toBe(true);
          expect(response.conversation.id).toBe(conversationId);
          expect(response.conversation.participantIds).toContain(testUserId);
          expect(response.conversation.participantIds).toContain(testUser2Id);
          done();
        });
      });

      it('should reject invalid conversation ID', (done) => {
        clientSocket.emit('join_conversation', { conversationId: 'invalid-id' }, (response) => {
          expect(response.error).toBeDefined();
          done();
        });
      });

      it('should reject missing conversation ID', (done) => {
        clientSocket.emit('join_conversation', {}, (response) => {
          expect(response.error).toBeDefined();
          done();
        });
      });

      it('should reject unauthorized access', (done) => {
        // Create conversation with different users
        Conversation.create({
          participant_1_id: 'other-user-1',
          participant_2_id: 'other-user-2',
          conversation_type: 'direct'
        }).then((otherConversation) => {
          clientSocket.emit('join_conversation', { conversationId: otherConversation.id }, (response) => {
            expect(response.error).toBeDefined();
            done();
          });
        });
      });
    });

    describe('leave_conversation', () => {
      beforeEach((done) => {
        // Join conversation first
        clientSocket.emit('join_conversation', { conversationId }, (response) => {
          expect(response.success).toBe(true);
          done();
        });
      });

      it('should leave conversation room', (done) => {
        clientSocket.emit('leave_conversation', { conversationId }, (response) => {
          expect(response.success).toBe(true);
          done();
        });
      });
    });
  });

  describe('Message Events', () => {
    let conversationId;

    beforeEach((done) => {
      Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      }).then((conversation) => {
        conversationId = conversation.id;

        // Join both clients to the conversation
        clientSocket.emit('join_conversation', { conversationId }, (response1) => {
          expect(response1.success).toBe(true);
          
          clientSocket2.emit('join_conversation', { conversationId }, (response2) => {
            expect(response2.success).toBe(true);
            done();
          });
        });
      });
    });

    describe('send_message', () => {
      it('should send and receive text message', (done) => {
        const messageContent = 'Hello, this is a test message!';

        // Listen for new message on client 2
        clientSocket2.on('new_message', (messageData) => {
          expect(messageData.content).toBe(messageContent);
          expect(messageData.sender.id).toBe(testUserId);
          expect(messageData.type).toBe('text');
          done();
        });

        // Send message from client 1
        clientSocket.emit('send_message', {
          conversationId,
          content: messageContent,
          messageType: 'text'
        }, (response) => {
          expect(response.success).toBe(true);
          expect(response.message.content).toBe(messageContent);
        });
      });

      it('should reject empty message', (done) => {
        clientSocket.emit('send_message', {
          conversationId,
          content: '',
          messageType: 'text'
        }, (response) => {
          expect(response.error).toBeDefined();
          done();
        });
      });

      it('should reject message that is too long', (done) => {
        const longMessage = 'a'.repeat(5001);

        clientSocket.emit('send_message', {
          conversationId,
          content: longMessage,
          messageType: 'text'
        }, (response) => {
          expect(response.error).toBeDefined();
          done();
        });
      });

      it('should handle message with reply', (done) => {
        // First send a message
        clientSocket.emit('send_message', {
          conversationId,
          content: 'Original message',
          messageType: 'text'
        }, (originalResponse) => {
          expect(originalResponse.success).toBe(true);

          // Then reply to it
          clientSocket2.emit('send_message', {
            conversationId,
            content: 'Reply message',
            messageType: 'text',
            replyToMessageId: originalResponse.message.id
          }, (replyResponse) => {
            expect(replyResponse.success).toBe(true);
            expect(replyResponse.message.replyTo).toBe(originalResponse.message.id);
            done();
          });
        });
      });
    });

    describe('mark_message_read', () => {
      let messageId;

      beforeEach((done) => {
        // Send a message first
        clientSocket.emit('send_message', {
          conversationId,
          content: 'Test message for reading',
          messageType: 'text'
        }, (response) => {
          messageId = response.message.id;
          done();
        });
      });

      it('should mark message as read', (done) => {
        // Listen for read receipt on sender's client
        clientSocket.on('message_read', (readData) => {
          expect(readData.messageId).toBe(messageId);
          expect(readData.readBy).toBe(testUser2Id);
          done();
        });

        // Mark as read from recipient's client
        clientSocket2.emit('mark_message_read', {
          conversationId,
          messageId
        }, (response) => {
          expect(response.success).toBe(true);
        });
      });
    });

    describe('delete_message', () => {
      let messageId;

      beforeEach((done) => {
        // Send a message first
        clientSocket.emit('send_message', {
          conversationId,
          content: 'Message to be deleted',
          messageType: 'text'
        }, (response) => {
          messageId = response.message.id;
          done();
        });
      });

      it('should delete message for everyone', (done) => {
        // Listen for message deletion
        clientSocket2.on('message_deleted', (deleteData) => {
          expect(deleteData.messageId).toBe(messageId);
          expect(deleteData.deleteForEveryone).toBe(true);
          done();
        });

        // Delete message from sender's client
        clientSocket.emit('delete_message', {
          conversationId,
          messageId,
          deleteForEveryone: true
        }, (response) => {
          expect(response.success).toBe(true);
        });
      });

      it('should reject delete for everyone from non-sender', (done) => {
        // Try to delete from recipient's client
        clientSocket2.emit('delete_message', {
          conversationId,
          messageId,
          deleteForEveryone: true
        }, (response) => {
          expect(response.error).toBeDefined();
          done();
        });
      });
    });
  });

  describe('Typing Indicators', () => {
    let conversationId;

    beforeEach((done) => {
      Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      }).then((conversation) => {
        conversationId = conversation.id;

        // Join both clients to the conversation
        clientSocket.emit('join_conversation', { conversationId }, () => {
          clientSocket2.emit('join_conversation', { conversationId }, () => {
            done();
          });
        });
      });
    });

    it('should send typing start indicator', (done) => {
      clientSocket2.on('typing_start', (typingData) => {
        expect(typingData.userId).toBe(testUserId);
        expect(typingData.conversationId).toBe(conversationId);
        done();
      });

      clientSocket.emit('typing_start', { conversationId });
    });

    it('should send typing stop indicator', (done) => {
      // First start typing
      clientSocket.emit('typing_start', { conversationId });

      clientSocket2.on('typing_stop', (typingData) => {
        expect(typingData.userId).toBe(testUserId);
        expect(typingData.conversationId).toBe(conversationId);
        done();
      });

      // Then stop typing
      setTimeout(() => {
        clientSocket.emit('typing_stop', { conversationId });
      }, 100);
    });
  });

  describe('Presence Events', () => {
    it('should get user presence', (done) => {
      clientSocket.emit('get_user_presence', {
        userIds: [testUserId, testUser2Id]
      }, (response) => {
        expect(response.success).toBe(true);
        expect(response.presence).toHaveProperty(testUserId);
        expect(response.presence).toHaveProperty(testUser2Id);
        expect(response.presence[testUserId].status).toBe('online');
        expect(response.presence[testUser2Id].status).toBe('online');
        done();
      });
    });

    it('should update user status', (done) => {
      clientSocket2.on('user_presence_update', (presenceData) => {
        expect(presenceData.userId).toBe(testUserId);
        expect(presenceData.status).toBe('away');
        done();
      });

      clientSocket.emit('update_status', { status: 'away' });
    });
  });

  describe('Rate Limiting', () => {
    let conversationId;

    beforeEach((done) => {
      Conversation.create({
        participant_1_id: testUserId,
        participant_2_id: testUser2Id,
        conversation_type: 'direct'
      }).then((conversation) => {
        conversationId = conversation.id;
        
        clientSocket.emit('join_conversation', { conversationId }, () => {
          done();
        });
      });
    });

    it('should rate limit message sending', (done) => {
      let messagesSent = 0;
      let rateLimitError = false;

      const sendMessage = () => {
        clientSocket.emit('send_message', {
          conversationId,
          content: `Message ${messagesSent + 1}`,
          messageType: 'text'
        }, (response) => {
          if (response.error && response.error.includes('Rate limit')) {
            rateLimitError = true;
            expect(messagesSent).toBeGreaterThan(20); // Should hit rate limit after many messages
            done();
          } else if (response.success) {
            messagesSent++;
            if (messagesSent < 40) { // Try to send many messages quickly
              setTimeout(sendMessage, 10); // Send very quickly
            } else if (!rateLimitError) {
              done(new Error('Rate limit should have been triggered'));
            }
          }
        });
      };

      sendMessage();
    }, 10000); // Increase timeout for rate limiting test
  });
});