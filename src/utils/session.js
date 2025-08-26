/**
 * Session Management Utilities
 * Handles user session creation, validation, and cleanup
 */

const authConfig = require('../config/auth');

class SessionError extends Error {
  constructor(message, code = 'SESSION_ERROR') {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

/**
 * In-memory session store (for demonstration)
 * In production, this should be replaced with Redis, database, or other persistent storage
 */
class InMemorySessionStore {
  constructor() {
    this.sessions = new Map();
    this.userSessions = new Map(); // Track sessions by user ID
  }

  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {Object} sessionData - Session data
   * @returns {string} Session ID
   */
  create(userId, sessionData = {}) {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session = {
      id: sessionId,
      userId,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + authConfig.session.absoluteTimeout,
      data: { ...sessionData }
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(sessionId);

    // Enforce max concurrent sessions
    this.enforceMaxSessions(userId);

    return sessionId;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data or null if not found/expired
   */
  get(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    const now = Date.now();

    // Check if session has expired
    if (now > session.expiresAt) {
      this.delete(sessionId);
      return null;
    }

    // Check inactivity timeout
    if (now - session.lastAccessedAt > authConfig.session.inactivityTimeout) {
      this.delete(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = now;
    
    return session;
  }

  /**
   * Update session data
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Data to update
   * @returns {boolean} True if updated, false if session not found
   */
  update(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Merge updates
    session.data = { ...session.data, ...updates };
    session.lastAccessedAt = Date.now();

    return true;
  }

  /**
   * Delete session
   * @param {string} sessionId - Session ID
   * @returns {boolean} True if deleted, false if not found
   */
  delete(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Remove from user sessions tracking
    if (this.userSessions.has(session.userId)) {
      this.userSessions.get(session.userId).delete(sessionId);
      
      // Clean up empty sets
      if (this.userSessions.get(session.userId).size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove session
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of session objects
   */
  getUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId);
    
    if (!sessionIds) {
      return [];
    }

    const sessions = [];
    for (const sessionId of sessionIds) {
      const session = this.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Delete all sessions for a user
   * @param {string} userId - User ID
   * @returns {number} Number of sessions deleted
   */
  deleteUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId);
    
    if (!sessionIds) {
      return 0;
    }

    let deletedCount = 0;
    for (const sessionId of [...sessionIds]) {
      if (this.delete(sessionId)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Enforce maximum concurrent sessions for a user
   * @param {string} userId - User ID
   */
  enforceMaxSessions(userId) {
    const sessions = this.getUserSessions(userId)
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

    // Remove oldest sessions if over limit
    if (sessions.length > authConfig.session.maxConcurrentSessions) {
      const sessionsToRemove = sessions.slice(authConfig.session.maxConcurrentSessions);
      sessionsToRemove.forEach(session => this.delete(session.id));
    }
  }

  /**
   * Clean up expired sessions
   * @returns {number} Number of sessions cleaned up
   */
  cleanup() {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt || 
          now - session.lastAccessedAt > authConfig.session.inactivityTimeout) {
        this.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Generate a unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `sess_${timestamp}_${randomPart}`;
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeUsers: this.userSessions.size,
      averageSessionsPerUser: this.userSessions.size > 0 
        ? this.sessions.size / this.userSessions.size 
        : 0
    };
  }
}

// Create global session store instance
const sessionStore = new InMemorySessionStore();

// Set up periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = sessionStore.cleanup();
    if (cleaned > 0) {
      console.debug(`Cleaned up ${cleaned} expired sessions`);
    }
  }, 300000); // Clean up every 5 minutes
}

/**
 * Session middleware for Express
 * Creates and manages sessions for authenticated users
 */
function sessionMiddleware(options = {}) {
  return (req, res, next) => {
    try {
      // Skip session management for non-authenticated requests
      if (!req.user) {
        return next();
      }

      // Get session ID from headers or create new one
      let sessionId = req.headers['x-session-id'];
      let session;

      if (sessionId) {
        session = sessionStore.get(sessionId);
      }

      // Create new session if none exists or is invalid
      if (!session) {
        sessionId = sessionStore.create(req.user.id, {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          ...options.defaultData
        });
        session = sessionStore.get(sessionId);

        // Send session ID to client
        res.setHeader('X-Session-ID', sessionId);
      }

      // Attach session to request
      req.session = session;
      req.sessionId = sessionId;

      // Update session with current request info
      sessionStore.update(sessionId, {
        lastUserAgent: req.get('User-Agent'),
        lastIP: req.ip
      });

      next();

    } catch (error) {
      console.error('Session middleware error:', error);
      next(); // Continue without session
    }
  };
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session or null
 */
function getSession(sessionId) {
  return sessionStore.get(sessionId);
}

/**
 * Create new session
 * @param {string} userId - User ID
 * @param {Object} data - Initial session data
 * @returns {string} Session ID
 */
function createSession(userId, data = {}) {
  return sessionStore.create(userId, data);
}

/**
 * Delete session
 * @param {string} sessionId - Session ID
 * @returns {boolean} Success status
 */
function deleteSession(sessionId) {
  return sessionStore.delete(sessionId);
}

/**
 * Delete all sessions for a user
 * @param {string} userId - User ID
 * @returns {number} Number of deleted sessions
 */
function deleteUserSessions(userId) {
  return sessionStore.deleteUserSessions(userId);
}

/**
 * Get all sessions for a user
 * @param {string} userId - User ID
 * @returns {Array} Array of sessions
 */
function getUserSessions(userId) {
  return sessionStore.getUserSessions(userId);
}

/**
 * Get session statistics
 * @returns {Object} Statistics
 */
function getSessionStats() {
  return sessionStore.getStats();
}

module.exports = {
  sessionMiddleware,
  getSession,
  createSession,
  deleteSession,
  deleteUserSessions,
  getUserSessions,
  getSessionStats,
  SessionError,
  sessionStore // Export for testing
};