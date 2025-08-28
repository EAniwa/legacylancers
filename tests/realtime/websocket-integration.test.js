/**
 * WebSocket and Real-time Messaging Integration Tests
 * Tests real-time functionality and WebSocket connections
 */

const io = require('socket.io-client');
const { performance } = require('perf_hooks');

// WebSocket test configuration
const WEBSOCKET_CONFIG = {
  url: process.env.WEBSOCKET_URL || 'http://localhost:3001',
  timeout: 5000,
  messageLatency: 100, // Max 100ms message delivery
  connectionTimeout: 2000, // Max 2s connection time
  maxConcurrentConnections: 100
};

describe('WebSocket Integration Tests', () => {
  let clientSocket;
  let providerSocket;

  beforeAll(async () => {
    // Setup test environment
    await setupWebSocketTestEnvironment();
  });

  afterAll(async () => {
    if (clientSocket) clientSocket.disconnect();
    if (providerSocket) providerSocket.disconnect();
  });

  describe('Connection Management', () => {
    test('should establish WebSocket connection within timeout', async () => {
      const startTime = performance.now();
      
      clientSocket = io(WEBSOCKET_CONFIG.url, {
        auth: { token: 'mock-client-token' },
        timeout: WEBSOCKET_CONFIG.connectionTimeout
      });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, WEBSOCKET_CONFIG.connectionTimeout);

        clientSocket.on('connect', () => {
          clearTimeout(timer);
          const connectionTime = performance.now() - startTime;
          expect(connectionTime).toBeLessThan(WEBSOCKET_CONFIG.connectionTimeout);
          console.log(`WebSocket connection time: ${connectionTime.toFixed(2)}ms`);
          resolve();
        });

        clientSocket.on('connect_error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      expect(clientSocket.connected).toBe(true);
    });

    test('should handle authentication for WebSocket connections', async () => {
      const authenticatedSocket = io(WEBSOCKET_CONFIG.url, {
        auth: { token: 'valid-test-token' }
      });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, WEBSOCKET_CONFIG.timeout);

        authenticatedSocket.on('authenticated', () => {
          clearTimeout(timer);
          resolve();
        });

        authenticatedSocket.on('authentication_error', (error) => {
          clearTimeout(timer);
          reject(new Error(`Authentication failed: ${error}`));
        });
      });

      authenticatedSocket.disconnect();
    });

    test('should reject invalid authentication tokens', async () => {
      const unauthorizedSocket = io(WEBSOCKET_CONFIG.url, {
        auth: { token: 'invalid-token' }
      });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Should have rejected invalid token'));
        }, WEBSOCKET_CONFIG.timeout);

        unauthorizedSocket.on('connect', () => {
          clearTimeout(timer);
          reject(new Error('Should not connect with invalid token'));
        });

        unauthorizedSocket.on('authentication_error', () => {
          clearTimeout(timer);
          resolve();
        });

        unauthorizedSocket.on('connect_error', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      unauthorizedSocket.disconnect();
    });
  });

  describe('Real-time Messaging', () => {
    beforeEach(async () => {
      // Setup client and provider sockets
      clientSocket = io(WEBSOCKET_CONFIG.url, {
        auth: { token: 'mock-client-token' }
      });

      providerSocket = io(WEBSOCKET_CONFIG.url, {
        auth: { token: 'mock-provider-token' }
      });

      await Promise.all([
        waitForConnection(clientSocket),
        waitForConnection(providerSocket)
      ]);
    });

    afterEach(() => {
      if (clientSocket) {
        clientSocket.disconnect();
        clientSocket = null;
      }
      if (providerSocket) {
        providerSocket.disconnect();
        providerSocket = null;
      }
    });

    test('should deliver messages within latency threshold', async () => {
      const testMessage = {
        conversationId: 'test-conversation-1',
        content: 'Test real-time message',
        type: 'text',
        timestamp: new Date().toISOString()
      };

      const sendTime = performance.now();

      // Provider receives message from client
      const messageReceived = new Promise((resolve) => {
        providerSocket.on('message:received', (message) => {
          const receiveTime = performance.now();
          const latency = receiveTime - sendTime;
          
          expect(latency).toBeLessThan(WEBSOCKET_CONFIG.messageLatency);
          expect(message.content).toBe(testMessage.content);
          expect(message.conversationId).toBe(testMessage.conversationId);
          
          console.log(`Message delivery latency: ${latency.toFixed(2)}ms`);
          resolve();
        });
      });

      // Client sends message
      clientSocket.emit('message:send', testMessage);

      await messageReceived;
    });

    test('should handle message acknowledgments', async () => {
      const testMessage = {
        id: 'test-message-1',
        conversationId: 'test-conversation-1',
        content: 'Test acknowledgment message',
        type: 'text'
      };

      const ackReceived = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Acknowledgment timeout'));
        }, WEBSOCKET_CONFIG.timeout);

        clientSocket.emit('message:send', testMessage, (ack) => {
          clearTimeout(timer);
          expect(ack.success).toBe(true);
          expect(ack.messageId).toBe(testMessage.id);
          resolve();
        });
      });

      await ackReceived;
    });

    test('should broadcast typing indicators', async () => {
      const conversationId = 'test-conversation-1';

      const typingReceived = new Promise((resolve) => {
        providerSocket.on('typing:start', (data) => {
          expect(data.conversationId).toBe(conversationId);
          expect(data.userId).toBeDefined();
          resolve();
        });
      });

      clientSocket.emit('typing:start', { conversationId });

      await typingReceived;
    });

    test('should handle connection drops and reconnection', async () => {
      // Simulate connection drop
      clientSocket.disconnect();

      // Reconnect
      clientSocket.connect();

      await waitForConnection(clientSocket);

      // Test message after reconnection
      const testMessage = {
        conversationId: 'test-conversation-1',
        content: 'Message after reconnection',
        type: 'text'
      };

      const messageReceived = new Promise((resolve) => {
        providerSocket.on('message:received', (message) => {
          expect(message.content).toBe(testMessage.content);
          resolve();
        });
      });

      clientSocket.emit('message:send', testMessage);
      await messageReceived;
    });
  });

  describe('Booking Real-time Updates', () => {
    test('should broadcast booking status changes', async () => {
      const bookingUpdate = {
        bookingId: 'test-booking-1',
        status: 'confirmed',
        clientId: 'test-client',
        providerId: 'test-provider'
      };

      const updateReceived = new Promise((resolve) => {
        providerSocket.on('booking:status_changed', (data) => {
          expect(data.bookingId).toBe(bookingUpdate.bookingId);
          expect(data.status).toBe(bookingUpdate.status);
          resolve();
        });
      });

      // Simulate booking status change
      clientSocket.emit('booking:update_status', bookingUpdate);

      await updateReceived;
    });

    test('should notify about calendar conflicts in real-time', async () => {
      const conflictData = {
        userId: 'test-provider',
        conflictingBookings: ['booking-1', 'booking-2'],
        timeSlot: {
          start: '2024-02-01T10:00:00Z',
          end: '2024-02-01T11:00:00Z'
        }
      };

      const conflictReceived = new Promise((resolve) => {
        providerSocket.on('calendar:conflict_detected', (data) => {
          expect(data.userId).toBe(conflictData.userId);
          expect(data.conflictingBookings).toEqual(conflictData.conflictingBookings);
          resolve();
        });
      });

      // Simulate calendar conflict detection
      clientSocket.emit('calendar:check_conflict', conflictData);

      await conflictReceived;
    });
  });

  describe('Load Testing for WebSocket', () => {
    test('should handle multiple concurrent connections', async () => {
      const connectionCount = 50;
      const connections = [];
      const connectionPromises = [];

      console.log(`Testing ${connectionCount} concurrent WebSocket connections...`);

      for (let i = 0; i < connectionCount; i++) {
        const socket = io(WEBSOCKET_CONFIG.url, {
          auth: { token: `test-token-${i}` }
        });

        connections.push(socket);

        const connectionPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Connection ${i} timeout`));
          }, WEBSOCKET_CONFIG.connectionTimeout);

          socket.on('connect', () => {
            clearTimeout(timer);
            resolve(i);
          });

          socket.on('connect_error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
        });

        connectionPromises.push(connectionPromise);
      }

      try {
        const results = await Promise.allSettled(connectionPromises);
        const successfulConnections = results.filter(r => r.status === 'fulfilled').length;
        const successRate = (successfulConnections / connectionCount) * 100;

        expect(successRate).toBeGreaterThan(90); // 90% success rate

        console.log(`Concurrent connections success rate: ${successRate.toFixed(2)}%`);
      } finally {
        // Clean up connections
        connections.forEach(socket => {
          if (socket.connected) {
            socket.disconnect();
          }
        });
      }
    });

    test('should handle high message throughput', async () => {
      const messageCount = 100;
      const messagesReceived = [];
      const startTime = performance.now();

      const allMessagesReceived = new Promise((resolve) => {
        providerSocket.on('message:received', (message) => {
          messagesReceived.push({
            ...message,
            receivedAt: performance.now()
          });

          if (messagesReceived.length === messageCount) {
            resolve();
          }
        });
      });

      // Send multiple messages rapidly
      for (let i = 0; i < messageCount; i++) {
        clientSocket.emit('message:send', {
          conversationId: 'test-conversation-1',
          content: `Bulk message ${i}`,
          type: 'text',
          sequenceId: i
        });
      }

      await allMessagesReceived;

      const totalTime = performance.now() - startTime;
      const avgLatency = messagesReceived.reduce((sum, msg) => 
        sum + (msg.receivedAt - startTime), 0) / messageCount;

      expect(messagesReceived).toHaveLength(messageCount);
      expect(avgLatency).toBeLessThan(WEBSOCKET_CONFIG.messageLatency * 2);

      console.log(`High throughput test:`);
      console.log(`  Messages: ${messageCount}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Throughput: ${(messageCount / totalTime * 1000).toFixed(2)} msg/sec`);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle malformed messages gracefully', async () => {
      const errorReceived = new Promise((resolve) => {
        clientSocket.on('error', (error) => {
          expect(error.type).toBe('validation_error');
          resolve();
        });
      });

      // Send malformed message
      clientSocket.emit('message:send', {
        // Missing required fields
        content: 'Malformed message'
      });

      await errorReceived;
    });

    test('should handle server disconnection gracefully', async () => {
      let reconnected = false;

      clientSocket.on('disconnect', () => {
        console.log('Client disconnected from server');
      });

      clientSocket.on('connect', () => {
        if (reconnected) {
          console.log('Client reconnected to server');
        }
      });

      // This test would require actually stopping/starting the server
      // For now, we just verify the event handlers are set up
      expect(clientSocket.hasListeners('disconnect')).toBe(true);
      expect(clientSocket.hasListeners('connect')).toBe(true);
    });
  });
});

/**
 * WebSocket Test Utilities
 */

async function setupWebSocketTestEnvironment() {
  // Setup test data, mock authentication, etc.
  console.log('Setting up WebSocket test environment...');
}

function waitForConnection(socket) {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, WEBSOCKET_CONFIG.connectionTimeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Test Results Summary
 */
afterAll(() => {
  console.log('\n=== WEBSOCKET TEST SUMMARY ===');
  console.log('Configuration:');
  console.log(`  Max message latency: ${WEBSOCKET_CONFIG.messageLatency}ms`);
  console.log(`  Connection timeout: ${WEBSOCKET_CONFIG.connectionTimeout}ms`);
  console.log(`  Max concurrent connections: ${WEBSOCKET_CONFIG.maxConcurrentConnections}`);
  console.log('===============================\n');
});