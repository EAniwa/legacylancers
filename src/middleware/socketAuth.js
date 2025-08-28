/**
 * Socket.IO Authentication Middleware
 * Handles WebSocket connection authentication using JWT tokens
 */

const jwt = require('../auth/jwt');

/**
 * Socket.IO authentication middleware
 * Validates JWT token from client connection
 */
function socketAuthMiddleware(socket, next) {
  try {
    // Extract token from handshake auth or query
    const token = socket.handshake.auth?.token || 
                  socket.handshake.query?.token ||
                  socket.request.headers?.authorization?.split(' ')[1];

    if (!token) {
      const error = new Error('Authentication token required');
      error.data = { code: 'NO_TOKEN' };
      return next(error);
    }

    // Verify the JWT token
    const decoded = jwt.verifyToken(token);

    // Check if user account is active and verified
    if (!decoded.emailVerified) {
      const error = new Error('Email verification required');
      error.data = { code: 'EMAIL_NOT_VERIFIED' };
      return next(error);
    }

    // Attach user information to socket
    socket.userId = decoded.userId;
    socket.userEmail = decoded.email;
    socket.userRole = decoded.role;
    socket.kycStatus = decoded.kycStatus;

    // Log successful authentication
    console.log(`Socket authenticated: ${decoded.email} (${decoded.userId})`);

    next();

  } catch (error) {
    console.error('Socket authentication error:', error.message);

    // Create standardized error response
    const authError = new Error('Authentication failed');
    authError.data = {
      code: error.code || 'AUTH_FAILED',
      message: error.message
    };

    next(authError);
  }
}

/**
 * Middleware to check if user has access to specific conversation
 * @param {string} conversationId - Conversation ID to check access for
 * @param {Object} socket - Socket.IO socket instance
 * @returns {boolean} - True if user has access, false otherwise
 */
async function hasConversationAccess(conversationId, socket) {
  try {
    // This would typically query the database to check if the user
    // is a participant in the conversation
    // For now, we'll implement a basic check
    const { Conversation } = require('../models/Conversation');
    
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return false;
    }

    // Check if user is a participant
    const isParticipant = conversation.participant_1_id === socket.userId || 
                         conversation.participant_2_id === socket.userId;

    return isParticipant;

  } catch (error) {
    console.error('Error checking conversation access:', error);
    return false;
  }
}

/**
 * Middleware factory for conversation-specific authentication
 * @param {Function} conversationIdExtractor - Function to extract conversation ID from event data
 * @returns {Function} - Middleware function
 */
function conversationAuthMiddleware(conversationIdExtractor) {
  return async (socket, data, next) => {
    try {
      const conversationId = conversationIdExtractor(data);
      
      if (!conversationId) {
        const error = new Error('Conversation ID required');
        error.data = { code: 'NO_CONVERSATION_ID' };
        return next(error);
      }

      const hasAccess = await hasConversationAccess(conversationId, socket);
      
      if (!hasAccess) {
        const error = new Error('Access denied to conversation');
        error.data = { code: 'ACCESS_DENIED' };
        return next(error);
      }

      // Attach conversation ID to socket for this event
      socket.currentConversationId = conversationId;
      next();

    } catch (error) {
      console.error('Conversation auth error:', error);
      const authError = new Error('Access verification failed');
      authError.data = { code: 'ACCESS_VERIFICATION_FAILED' };
      next(authError);
    }
  };
}

/**
 * Rate limiting middleware for socket events
 * @param {number} maxEvents - Maximum events per time window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} - Middleware function
 */
function socketRateLimit(maxEvents = 30, windowMs = 60000) {
  const clients = new Map();

  return (socket, data, next) => {
    const clientKey = socket.userId;
    const now = Date.now();

    if (!clients.has(clientKey)) {
      clients.set(clientKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const clientData = clients.get(clientKey);

    if (now > clientData.resetTime) {
      // Reset window
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
      return next();
    }

    if (clientData.count >= maxEvents) {
      const error = new Error('Rate limit exceeded');
      error.data = { code: 'RATE_LIMIT_EXCEEDED' };
      return next(error);
    }

    clientData.count++;
    next();
  };
}

/**
 * Validation middleware for socket event data
 * @param {Object} schema - Joi-like validation schema
 * @returns {Function} - Middleware function
 */
function validateEventData(schema) {
  return (socket, data, next) => {
    try {
      // Basic validation - in a real app, you'd use Joi or similar
      if (schema.required) {
        for (const field of schema.required) {
          if (data[field] === undefined || data[field] === null) {
            const error = new Error(`Missing required field: ${field}`);
            error.data = { code: 'VALIDATION_ERROR', field };
            return next(error);
          }
        }
      }

      if (schema.fields) {
        for (const [field, rules] of Object.entries(schema.fields)) {
          const value = data[field];
          
          if (value !== undefined) {
            if (rules.type && typeof value !== rules.type) {
              const error = new Error(`Invalid type for field: ${field}`);
              error.data = { code: 'VALIDATION_ERROR', field };
              return next(error);
            }

            if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
              const error = new Error(`Field ${field} exceeds maximum length`);
              error.data = { code: 'VALIDATION_ERROR', field };
              return next(error);
            }

            if (rules.enum && !rules.enum.includes(value)) {
              const error = new Error(`Invalid value for field: ${field}`);
              error.data = { code: 'VALIDATION_ERROR', field };
              return next(error);
            }
          }
        }
      }

      next();

    } catch (error) {
      const validationError = new Error('Data validation failed');
      validationError.data = { code: 'VALIDATION_FAILED' };
      next(validationError);
    }
  };
}

/**
 * Error handler for socket middleware chain
 * @param {Error} error - The error that occurred
 * @param {Object} socket - Socket.IO socket instance
 * @param {Function} callback - Error callback function
 */
function handleSocketError(error, socket, callback) {
  console.error('Socket middleware error:', {
    error: error.message,
    code: error.data?.code,
    userId: socket.userId,
    socketId: socket.id
  });

  // Emit error to client
  socket.emit('error', {
    message: error.message,
    code: error.data?.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString()
  });

  // Call the callback with error to prevent further processing
  if (callback) {
    callback(error);
  }
}

module.exports = {
  socketAuthMiddleware,
  hasConversationAccess,
  conversationAuthMiddleware,
  socketRateLimit,
  validateEventData,
  handleSocketError
};