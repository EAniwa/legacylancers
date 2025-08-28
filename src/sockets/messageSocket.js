/**
 * Socket.IO Message Event Handlers
 * Handles real-time messaging events and communication
 */

const { 
  socketAuthMiddleware, 
  conversationAuthMiddleware, 
  socketRateLimit,
  validateEventData,
  handleSocketError
} = require('../middleware/socketAuth');
const { 
  spamProtectionMiddleware 
} = require('../middleware/spamProtection');
const { Conversation } = require('../models/Conversation');
const { Message } = require('../models/Message');
const { User } = require('../models/User');
const { NotificationService } = require('../services/notificationService');

// User presence tracking
const userPresence = new Map(); // userId -> { socketId, status, lastSeen, typingIn }
const socketToUser = new Map(); // socketId -> userId

// Initialize notification service (in-memory for now, will use DB later)
const notificationService = new NotificationService(null);

/**
 * Initialize Socket.IO messaging handlers
 * @param {Object} io - Socket.IO server instance
 */
function initializeMessageSocket(io) {
  
  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection event
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userEmail} (${socket.id})`);

    // Track user presence
    updateUserPresence(socket.userId, {
      socketId: socket.id,
      status: 'online',
      lastSeen: new Date()
    });
    socketToUser.set(socket.id, socket.userId);

    // Broadcast user online status
    socket.broadcast.emit('user_presence_update', {
      userId: socket.userId,
      status: 'online',
      lastSeen: new Date()
    });

    // Join user to their personal room for notifications
    socket.join(`user:${socket.userId}`);

    // =================================================================
    // CONVERSATION EVENTS
    // =================================================================

    /**
     * Join a conversation room
     * Client sends: { conversationId: string }
     */
    socket.on('join_conversation', 
      socketRateLimit(10, 60000), // 10 requests per minute
      validateEventData({
        required: ['conversationId'],
        fields: {
          conversationId: { type: 'string' }
        }
      }),
      conversationAuthMiddleware(data => data.conversationId),
      async (data, callback) => {
        try {
          const { conversationId } = data;

          // Join the conversation room
          await socket.join(`conversation:${conversationId}`);

          // Get conversation details
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            return callback({ error: 'Conversation not found' });
          }

          // Get unread message count
          const unreadCount = await Message.getUnreadCount(conversationId, socket.userId);

          console.log(`User ${socket.userId} joined conversation ${conversationId}`);

          callback({ 
            success: true,
            conversation: {
              id: conversation.id,
              title: conversation.title,
              participantIds: [conversation.participant_1_id, conversation.participant_2_id],
              lastMessageAt: conversation.last_message_at,
              messageCount: conversation.message_count,
              unreadCount
            }
          });

        } catch (error) {
          console.error('Error joining conversation:', error);
          handleSocketError(error, socket, callback);
        }
      }
    );

    /**
     * Leave a conversation room
     * Client sends: { conversationId: string }
     */
    socket.on('leave_conversation',
      socketRateLimit(10, 60000),
      validateEventData({
        required: ['conversationId'],
        fields: {
          conversationId: { type: 'string' }
        }
      }),
      async (data, callback) => {
        try {
          const { conversationId } = data;

          // Leave the conversation room
          await socket.leave(`conversation:${conversationId}`);

          // Stop typing if user was typing
          socket.to(`conversation:${conversationId}`).emit('typing_stop', {
            userId: socket.userId,
            conversationId
          });

          // Update presence - no longer typing
          const presence = userPresence.get(socket.userId);
          if (presence && presence.typingIn === conversationId) {
            presence.typingIn = null;
          }

          console.log(`User ${socket.userId} left conversation ${conversationId}`);

          if (callback) callback({ success: true });

        } catch (error) {
          console.error('Error leaving conversation:', error);
          handleSocketError(error, socket, callback);
        }
      }
    );

    // =================================================================
    // MESSAGE EVENTS
    // =================================================================

    /**
     * Send a new message
     * Client sends: { 
     *   conversationId: string, 
     *   content: string, 
     *   messageType: 'text'|'file'|'image', 
     *   replyToMessageId?: string,
     *   metadata?: object 
     * }
     */
    socket.on('send_message',
      socketRateLimit(30, 60000), // 30 messages per minute
      validateEventData({
        required: ['conversationId', 'content'],
        fields: {
          conversationId: { type: 'string' },
          content: { type: 'string', maxLength: 5000 },
          messageType: { type: 'string', enum: ['text', 'file', 'image'] },
          replyToMessageId: { type: 'string' }
        }
      }),
      spamProtectionMiddleware({ enableContentFiltering: true, enableDuplicateDetection: true }),
      conversationAuthMiddleware(data => data.conversationId),
      async (data, callback) => {
        try {
          const { 
            conversationId, 
            content, 
            messageType = 'text', 
            replyToMessageId,
            metadata = {}
          } = data;

          // Create the message
          const message = await Message.create({
            conversation_id: conversationId,
            sender_id: socket.userId,
            message_type: messageType,
            content,
            reply_to_message_id: replyToMessageId,
            metadata
          });

          // Update conversation last message
          await Conversation.update(conversationId, {
            last_message_at: message.created_at,
            last_message_id: message.id,
            message_count: await getConversationMessageCount(conversationId)
          });

          // Get sender details for the message
          const sender = await User.findById(socket.userId);

          // Prepare message data for clients
          const messageData = {
            ...message,
            sender: {
              id: sender.id,
              firstName: sender.firstName,
              lastName: sender.lastName,
              profilePhoto: sender.profilePhoto || null
            }
          };

          // Emit to all clients in the conversation room
          io.to(`conversation:${conversationId}`).emit('new_message', messageData);

          // Stop typing indicator for sender
          socket.to(`conversation:${conversationId}`).emit('typing_stop', {
            userId: socket.userId,
            conversationId
          });

          // Update user presence - no longer typing
          const presence = userPresence.get(socket.userId);
          if (presence && presence.typingIn === conversationId) {
            presence.typingIn = null;
          }

          // Send push notification to offline users
          const conversation = await Conversation.findById(conversationId);
          const recipientId = conversation.participant_1_id === socket.userId ? 
            conversation.participant_2_id : conversation.participant_1_id;

          const recipientPresence = userPresence.get(recipientId);
          if (!recipientPresence || recipientPresence.status === 'offline') {
            // Send notification to offline user
            await sendOfflineMessageNotification({
              recipientId,
              senderId: socket.userId,
              messageContent: messageContent,
              conversationId
            });
          }

          console.log(`Message sent in conversation ${conversationId} by user ${socket.userId}`);

          if (callback) callback({ 
            success: true, 
            message: messageData 
          });

        } catch (error) {
          console.error('Error sending message:', error);
          handleSocketError(error, socket, callback);
        }
      }
    );

    /**
     * Mark messages as read
     * Client sends: { conversationId: string, messageId: string }
     */
    socket.on('mark_message_read',
      socketRateLimit(50, 60000), // 50 requests per minute
      validateEventData({
        required: ['conversationId', 'messageId'],
        fields: {
          conversationId: { type: 'string' },
          messageId: { type: 'string' }
        }
      }),
      conversationAuthMiddleware(data => data.conversationId),
      async (data, callback) => {
        try {
          const { conversationId, messageId } = data;

          // Mark message as read
          const updatedMessage = await Message.markAsRead(messageId, socket.userId, conversationId);

          // Notify other participants about read receipt
          socket.to(`conversation:${conversationId}`).emit('message_read', {
            messageId: updatedMessage.id,
            readBy: socket.userId,
            readAt: new Date()
          });

          if (callback) callback({ success: true });

        } catch (error) {
          console.error('Error marking message as read:', error);
          handleSocketError(error, socket, callback);
        }
      }
    );

    /**
     * Delete a message
     * Client sends: { conversationId: string, messageId: string, deleteForEveryone?: boolean }
     */
    socket.on('delete_message',
      socketRateLimit(20, 60000), // 20 requests per minute
      validateEventData({
        required: ['conversationId', 'messageId'],
        fields: {
          conversationId: { type: 'string' },
          messageId: { type: 'string' },
          deleteForEveryone: { type: 'boolean' }
        }
      }),
      conversationAuthMiddleware(data => data.conversationId),
      async (data, callback) => {
        try {
          const { conversationId, messageId, deleteForEveryone = false } = data;

          // Delete the message
          const updatedMessage = await Message.deleteForUser(
            messageId, 
            socket.userId, 
            conversationId, 
            deleteForEveryone
          );

          if (deleteForEveryone) {
            // Notify all participants about message deletion
            io.to(`conversation:${conversationId}`).emit('message_deleted', {
              messageId: updatedMessage.id,
              deletedBy: socket.userId,
              deletedAt: new Date(),
              deleteForEveryone: true
            });
          }

          console.log(`Message ${messageId} deleted by user ${socket.userId}`);

          if (callback) callback({ success: true });

        } catch (error) {
          console.error('Error deleting message:', error);
          handleSocketError(error, socket, callback);
        }
      }
    );

    // =================================================================
    // TYPING INDICATORS
    // =================================================================

    /**
     * User started typing
     * Client sends: { conversationId: string }
     */
    socket.on('typing_start',
      socketRateLimit(60, 60000), // 60 requests per minute
      validateEventData({
        required: ['conversationId'],
        fields: {
          conversationId: { type: 'string' }
        }
      }),
      conversationAuthMiddleware(data => data.conversationId),
      async (data) => {
        try {
          const { conversationId } = data;

          // Update user presence
          const presence = userPresence.get(socket.userId);
          if (presence) {
            presence.typingIn = conversationId;
            presence.typingStartedAt = new Date();
          }

          // Notify other participants
          socket.to(`conversation:${conversationId}`).emit('typing_start', {
            userId: socket.userId,
            conversationId
          });

        } catch (error) {
          console.error('Error handling typing start:', error);
        }
      }
    );

    /**
     * User stopped typing
     * Client sends: { conversationId: string }
     */
    socket.on('typing_stop',
      socketRateLimit(60, 60000), // 60 requests per minute
      validateEventData({
        required: ['conversationId'],
        fields: {
          conversationId: { type: 'string' }
        }
      }),
      async (data) => {
        try {
          const { conversationId } = data;

          // Update user presence
          const presence = userPresence.get(socket.userId);
          if (presence && presence.typingIn === conversationId) {
            presence.typingIn = null;
            presence.typingStartedAt = null;
          }

          // Notify other participants
          socket.to(`conversation:${conversationId}`).emit('typing_stop', {
            userId: socket.userId,
            conversationId
          });

        } catch (error) {
          console.error('Error handling typing stop:', error);
        }
      }
    );

    // =================================================================
    // PRESENCE EVENTS
    // =================================================================

    /**
     * Get online status of users
     * Client sends: { userIds: string[] }
     */
    socket.on('get_user_presence',
      socketRateLimit(20, 60000), // 20 requests per minute
      validateEventData({
        required: ['userIds'],
        fields: {
          userIds: { type: 'object' } // Array
        }
      }),
      async (data, callback) => {
        try {
          const { userIds } = data;

          const presenceData = {};
          for (const userId of userIds) {
            const presence = userPresence.get(userId);
            presenceData[userId] = {
              status: presence ? presence.status : 'offline',
              lastSeen: presence ? presence.lastSeen : null,
              isTyping: presence ? !!presence.typingIn : false
            };
          }

          if (callback) callback({ success: true, presence: presenceData });

        } catch (error) {
          console.error('Error getting user presence:', error);
          handleSocketError(error, socket, callback);
        }
      }
    );

    /**
     * Update user status
     * Client sends: { status: 'online'|'away'|'busy'|'invisible' }
     */
    socket.on('update_status',
      socketRateLimit(10, 60000), // 10 requests per minute
      validateEventData({
        required: ['status'],
        fields: {
          status: { type: 'string', enum: ['online', 'away', 'busy', 'invisible'] }
        }
      }),
      async (data) => {
        try {
          const { status } = data;

          // Update user presence
          updateUserPresence(socket.userId, {
            socketId: socket.id,
            status,
            lastSeen: new Date()
          });

          // Broadcast status update
          socket.broadcast.emit('user_presence_update', {
            userId: socket.userId,
            status,
            lastSeen: new Date()
          });

        } catch (error) {
          console.error('Error updating user status:', error);
        }
      }
    );

    // =================================================================
    // DISCONNECT EVENT
    // =================================================================

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userEmail} (${socket.id})`);

      // Update user presence to offline
      updateUserPresence(socket.userId, {
        socketId: null,
        status: 'offline',
        lastSeen: new Date()
      });

      // Clean up mappings
      socketToUser.delete(socket.id);

      // Broadcast user offline status
      socket.broadcast.emit('user_presence_update', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date()
      });

      // Stop any typing indicators
      const presence = userPresence.get(socket.userId);
      if (presence && presence.typingIn) {
        socket.to(`conversation:${presence.typingIn}`).emit('typing_stop', {
          userId: socket.userId,
          conversationId: presence.typingIn
        });
      }
    });

    // =================================================================
    // ERROR HANDLING
    // =================================================================

    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
}

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Update user presence information
 * @param {string} userId - User ID
 * @param {Object} presenceData - Presence data
 */
function updateUserPresence(userId, presenceData) {
  const existing = userPresence.get(userId) || {};
  userPresence.set(userId, {
    ...existing,
    ...presenceData
  });
}

/**
 * Get message count for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<number>} Message count
 */
async function getConversationMessageCount(conversationId) {
  try {
    const messages = await Message.findByConversationId(conversationId, { limit: 10000 });
    return messages.length;
  } catch (error) {
    console.error('Error getting conversation message count:', error);
    return 0;
  }
}

/**
 * Clean up expired typing indicators
 * Runs every 30 seconds to remove stale typing indicators
 */
function cleanupTypingIndicators() {
  const now = new Date();
  const typingTimeout = 30000; // 30 seconds

  for (const [userId, presence] of userPresence.entries()) {
    if (presence.typingIn && presence.typingStartedAt) {
      const timeSinceTyping = now - new Date(presence.typingStartedAt);
      if (timeSinceTyping > typingTimeout) {
        presence.typingIn = null;
        presence.typingStartedAt = null;
        
        // TODO: Emit typing_stop event to all relevant rooms
        console.log(`Cleaned up stale typing indicator for user ${userId}`);
      }
    }
  }
}

// Start cleanup interval
setInterval(cleanupTypingIndicators, 30000);

/**
 * Get current user presence data
 * @returns {Map} Current user presence map
 */
function getUserPresence() {
  return userPresence;
}

/**
 * Get socket to user mapping
 * @returns {Map} Socket to user mapping
 */
function getSocketToUserMapping() {
  return socketToUser;
}

/**
 * Send notification to offline user for new message
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - ID of the user to notify
 * @param {string} params.senderId - ID of the message sender
 * @param {string} params.messageContent - Content of the message
 * @param {string} params.conversationId - ID of the conversation
 */
async function sendOfflineMessageNotification(params) {
  const { recipientId, senderId, messageContent, conversationId } = params;
  
  try {
    // Get sender details
    const sender = await User.findById(senderId);
    if (!sender) {
      console.error(`Sender not found for notification: ${senderId}`);
      return;
    }

    // Truncate long messages for notification
    let notificationContent = messageContent;
    if (messageContent && messageContent.length > 100) {
      notificationContent = messageContent.substring(0, 97) + '...';
    }

    // For now, create a simple in-app notification
    // In production, this would integrate with the full notification service
    const notificationData = {
      userId: recipientId,
      templateKey: 'new_message',
      templateData: {
        senderName: `${sender.firstName} ${sender.lastName}`,
        messagePreview: notificationContent || 'sent you a message',
        conversationId: conversationId
      },
      options: {
        channels: ['in_app'],
        priority: 'normal',
        actionUrl: `/conversations/${conversationId}`,
        relatedEntityType: 'message',
        relatedEntityId: conversationId
      }
    };

    // For now, just log the notification - in production this would use the full notification service
    console.log(`📬 Offline notification for user ${recipientId}:`, {
      from: `${sender.firstName} ${sender.lastName}`,
      preview: notificationContent,
      conversationId
    });

    // In production, uncomment this line:
    // await notificationService.sendNotification(notificationData);

  } catch (error) {
    console.error('Error sending offline message notification:', error);
    // Don't throw - notification failure shouldn't break message sending
  }
}

module.exports = {
  initializeMessageSocket,
  getUserPresence,
  getSocketToUserMapping,
  updateUserPresence,
  sendOfflineMessageNotification
};