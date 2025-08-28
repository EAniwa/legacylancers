/**
 * Spam Protection Middleware for Socket.IO
 * Implements content filtering, duplicate detection, and user reputation tracking
 */

const validator = require('validator');

// User reputation tracking
const userReputations = new Map(); // userId -> { score, violations, lastViolation }
const recentMessages = new Map(); // userId -> array of recent message hashes
const suspiciousPatterns = [
  /(.)\1{10,}/g, // Repeated characters (10+ times)
  /https?:\/\/[^\s]+/gi, // URLs (may want to restrict)
  /discord\.gg\/\w+/gi, // Discord invite links
  /telegram\.me\/\w+/gi, // Telegram links
  /\b\d{10,}\b/g, // Long numbers (phone numbers, etc.)
  /@\w+\.\w+/g // Email addresses
];

const profanityWords = [
  // Basic profanity filter - in production, use a comprehensive list
  'spam', 'scam', 'fake', 'fraud'
];

class SpamProtectionError extends Error {
  constructor(message, code = 'SPAM_DETECTED') {
    super(message);
    this.name = 'SpamProtectionError';
    this.code = code;
  }
}

/**
 * Initialize user reputation if not exists
 * @param {string} userId - User ID
 */
function initializeUserReputation(userId) {
  if (!userReputations.has(userId)) {
    userReputations.set(userId, {
      score: 100, // Start with good reputation
      violations: 0,
      lastViolation: null,
      messagesCount: 0,
      joinedAt: new Date()
    });
  }

  if (!recentMessages.has(userId)) {
    recentMessages.set(userId, []);
  }
}

/**
 * Generate simple hash for message content
 * @param {string} content - Message content
 * @returns {string} Hash
 */
function hashMessage(content) {
  if (!content) return '';
  // Simple hash for duplicate detection
  return content.toLowerCase().replace(/\s+/g, '').substring(0, 100);
}

/**
 * Check for suspicious patterns in content
 * @param {string} content - Message content
 * @returns {Array} Array of detected issues
 */
function checkSuspiciousPatterns(content) {
  const issues = [];

  if (!content || typeof content !== 'string') {
    return issues;
  }

  // Check for suspicious patterns
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      issues.push({
        type: 'suspicious_pattern',
        pattern: pattern.toString(),
        severity: 'medium'
      });
    }
  }

  // Check for profanity
  const lowerContent = content.toLowerCase();
  for (const word of profanityWords) {
    if (lowerContent.includes(word)) {
      issues.push({
        type: 'profanity',
        word: word,
        severity: 'low'
      });
    }
  }

  // Check message length
  if (content.length > 2000) {
    issues.push({
      type: 'excessive_length',
      length: content.length,
      severity: 'low'
    });
  }

  // Check for excessive caps
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (uppercaseRatio > 0.7 && content.length > 20) {
    issues.push({
      type: 'excessive_caps',
      ratio: uppercaseRatio,
      severity: 'low'
    });
  }

  return issues;
}

/**
 * Check for duplicate messages
 * @param {string} userId - User ID
 * @param {string} content - Message content
 * @returns {boolean} True if likely duplicate
 */
function checkDuplicateMessage(userId, content) {
  const userMessages = recentMessages.get(userId) || [];
  const messageHash = hashMessage(content);
  
  if (!messageHash) return false;

  // Check if this exact message was sent recently
  const duplicateCount = userMessages.filter(hash => hash === messageHash).length;
  
  if (duplicateCount >= 3) {
    return true; // Same message sent 3+ times recently
  }

  // Add to recent messages (keep last 50)
  userMessages.push(messageHash);
  if (userMessages.length > 50) {
    userMessages.shift();
  }
  recentMessages.set(userId, userMessages);

  return false;
}

/**
 * Update user reputation based on behavior
 * @param {string} userId - User ID
 * @param {string} action - Action type ('violation', 'good_message', 'warning')
 * @param {number} severity - Severity multiplier (1-3)
 */
function updateUserReputation(userId, action, severity = 1) {
  const reputation = userReputations.get(userId);
  if (!reputation) return;

  const now = new Date();

  switch (action) {
    case 'violation':
      reputation.score = Math.max(0, reputation.score - (10 * severity));
      reputation.violations += 1;
      reputation.lastViolation = now;
      break;
    
    case 'good_message':
      // Slowly improve reputation for good behavior
      reputation.score = Math.min(100, reputation.score + 0.5);
      reputation.messagesCount += 1;
      break;
    
    case 'warning':
      reputation.score = Math.max(0, reputation.score - (2 * severity));
      break;
  }

  userReputations.set(userId, reputation);
}

/**
 * Check if user should be blocked based on reputation
 * @param {string} userId - User ID
 * @returns {Object} Block status and reason
 */
function shouldBlockUser(userId) {
  const reputation = userReputations.get(userId);
  if (!reputation) return { blocked: false };

  const now = new Date();
  const timeSinceLastViolation = reputation.lastViolation ? 
    (now - reputation.lastViolation) / 1000 / 60 : Infinity; // minutes

  // Block if reputation is very low
  if (reputation.score < 20) {
    return {
      blocked: true,
      reason: 'Low reputation score',
      temporaryBlock: timeSinceLastViolation < 60, // 1 hour temporary block
      blockDuration: timeSinceLastViolation < 60 ? (60 - timeSinceLastViolation) : 0
    };
  }

  // Block if too many recent violations
  if (reputation.violations >= 5 && timeSinceLastViolation < 30) {
    return {
      blocked: true,
      reason: 'Too many recent violations',
      temporaryBlock: true,
      blockDuration: 30 - timeSinceLastViolation
    };
  }

  return { blocked: false };
}

/**
 * Spam protection middleware for message content
 * @param {Object} options - Configuration options
 * @returns {Function} - Middleware function
 */
function spamProtectionMiddleware(options = {}) {
  const {
    enableContentFiltering = true,
    enableDuplicateDetection = true,
    enableReputationSystem = true,
    strictMode = false
  } = options;

  return (socket, data, next) => {
    try {
      const userId = socket.userId;
      if (!userId) {
        return next(new SpamProtectionError('User ID required for spam protection', 'NO_USER_ID'));
      }

      initializeUserReputation(userId);

      // Check if user is blocked
      if (enableReputationSystem) {
        const blockStatus = shouldBlockUser(userId);
        if (blockStatus.blocked) {
          const error = new SpamProtectionError(
            `Account temporarily restricted: ${blockStatus.reason}`,
            'USER_BLOCKED'
          );
          error.data = { 
            code: 'USER_BLOCKED',
            blockDuration: blockStatus.blockDuration,
            temporaryBlock: blockStatus.temporaryBlock
          };
          return next(error);
        }
      }

      // Check message content if present
      if (data.content && typeof data.content === 'string') {
        const content = data.content.trim();

        // Check for suspicious patterns
        if (enableContentFiltering) {
          const suspiciousIssues = checkSuspiciousPatterns(content);
          
          if (suspiciousIssues.length > 0) {
            const highSeverityIssues = suspiciousIssues.filter(issue => 
              issue.severity === 'high' || (strictMode && issue.severity === 'medium')
            );

            if (highSeverityIssues.length > 0) {
              updateUserReputation(userId, 'violation', 2);
              return next(new SpamProtectionError('Message contains inappropriate content', 'INAPPROPRIATE_CONTENT'));
            }

            // Warn for medium severity issues in non-strict mode
            if (suspiciousIssues.some(issue => issue.severity === 'medium')) {
              updateUserReputation(userId, 'warning', 1);
              console.warn(`⚠️  Potentially suspicious message from user ${userId}:`, suspiciousIssues);
            }
          }
        }

        // Check for duplicate messages
        if (enableDuplicateDetection) {
          const isDuplicate = checkDuplicateMessage(userId, content);
          if (isDuplicate) {
            updateUserReputation(userId, 'violation', 1);
            return next(new SpamProtectionError('Duplicate message detected', 'DUPLICATE_MESSAGE'));
          }
        }

        // Update reputation for good message
        if (enableReputationSystem) {
          updateUserReputation(userId, 'good_message');
        }
      }

      next();

    } catch (error) {
      console.error('Spam protection error:', error);
      next(new SpamProtectionError('Spam protection check failed', 'PROTECTION_ERROR'));
    }
  };
}

/**
 * Get user reputation information
 * @param {string} userId - User ID
 * @returns {Object} Reputation data
 */
function getUserReputation(userId) {
  return userReputations.get(userId) || null;
}

/**
 * Reset user reputation (admin function)
 * @param {string} userId - User ID
 */
function resetUserReputation(userId) {
  userReputations.delete(userId);
  recentMessages.delete(userId);
}

/**
 * Get spam protection statistics
 * @returns {Object} Statistics
 */
function getSpamProtectionStats() {
  let totalUsers = userReputations.size;
  let blockedUsers = 0;
  let lowReputationUsers = 0;
  let totalViolations = 0;

  for (const [userId, reputation] of userReputations.entries()) {
    if (shouldBlockUser(userId).blocked) {
      blockedUsers++;
    }
    if (reputation.score < 50) {
      lowReputationUsers++;
    }
    totalViolations += reputation.violations;
  }

  return {
    totalUsers,
    blockedUsers,
    lowReputationUsers,
    totalViolations,
    activePatterns: suspiciousPatterns.length,
    profanityWords: profanityWords.length
  };
}

// Clean up old reputation data periodically
setInterval(() => {
  const now = new Date();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  for (const [userId, reputation] of userReputations.entries()) {
    if (now - reputation.joinedAt > maxAge && reputation.score > 80 && reputation.violations === 0) {
      // Clean up old good users to save memory
      if (Math.random() < 0.1) { // 10% chance to clean up each interval
        userReputations.delete(userId);
        recentMessages.delete(userId);
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = {
  spamProtectionMiddleware,
  SpamProtectionError,
  getUserReputation,
  resetUserReputation,
  getSpamProtectionStats,
  shouldBlockUser,
  updateUserReputation
};