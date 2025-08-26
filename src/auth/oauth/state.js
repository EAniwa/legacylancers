/**
 * OAuth State Management
 * Handles secure state parameter creation, validation, and cleanup for CSRF protection
 */

const crypto = require('crypto');
const oauthConfig = require('../../config/oauth');

class StateError extends Error {
  constructor(message, code = 'STATE_ERROR') {
    super(message);
    this.name = 'StateError';
    this.code = code;
  }
}

/**
 * In-memory state store for OAuth CSRF protection
 * In production, this should be replaced with Redis or database storage
 */
class StateManager {
  constructor() {
    this.states = new Map();
    this.cleanupInterval = null;
    this.maxStates = oauthConfig.oauth.maxStateCacheSize;
    this.expiryMinutes = oauthConfig.oauth.stateExpiryMinutes;
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Create a new OAuth state parameter
   * @param {Object} stateData - Data to associate with state
   * @param {string} stateData.provider - OAuth provider
   * @param {string} stateData.redirectURL - Post-auth redirect URL
   * @param {string} stateData.userId - User ID if linking account
   * @param {number} stateData.timestamp - Creation timestamp
   * @returns {string} Generated state parameter
   */
  async createState(stateData) {
    try {
      // Validate required fields
      if (!stateData.provider) {
        throw new StateError('Provider is required for state creation', 'MISSING_PROVIDER');
      }

      if (!stateData.redirectURL) {
        throw new StateError('Redirect URL is required for state creation', 'MISSING_REDIRECT_URL');
      }

      // Clean up expired states before creating new one
      this.cleanupExpired();

      // Check if we're at capacity
      if (this.states.size >= this.maxStates) {
        // Remove oldest states to make room
        const oldestStates = Array.from(this.states.entries())
          .sort((a, b) => a[1].createdAt - b[1].createdAt)
          .slice(0, Math.floor(this.maxStates * 0.1)); // Remove 10% of oldest

        for (const [state] of oldestStates) {
          this.states.delete(state);
        }
      }

      // Generate secure state parameter
      const state = this.generateSecureState();
      
      // Create state entry
      const stateEntry = {
        ...stateData,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.expiryMinutes * 60 * 1000),
        used: false
      };

      // Store state
      this.states.set(state, stateEntry);

      return state;

    } catch (error) {
      if (error instanceof StateError) {
        throw error;
      }
      throw new StateError(`Failed to create state: ${error.message}`, 'STATE_CREATION_FAILED');
    }
  }

  /**
   * Validate and consume a state parameter
   * @param {string} state - State parameter to validate
   * @returns {Object} State data if valid
   */
  async validateAndConsumeState(state) {
    try {
      if (!state) {
        throw new StateError('State parameter is required', 'MISSING_STATE');
      }

      if (typeof state !== 'string') {
        throw new StateError('State must be a string', 'INVALID_STATE_TYPE');
      }

      // Get state data
      const stateData = this.states.get(state);
      
      if (!stateData) {
        throw new StateError('Invalid or expired state parameter', 'INVALID_STATE');
      }

      // Check if already used
      if (stateData.used) {
        throw new StateError('State parameter has already been used', 'STATE_ALREADY_USED');
      }

      // Check if expired
      if (Date.now() > stateData.expiresAt) {
        this.states.delete(state);
        throw new StateError('State parameter has expired', 'STATE_EXPIRED');
      }

      // Mark as used
      stateData.used = true;
      stateData.usedAt = Date.now();

      // Return state data (without internal fields)
      const { createdAt, expiresAt, used, usedAt, ...publicData } = stateData;
      
      return publicData;

    } catch (error) {
      if (error instanceof StateError) {
        throw error;
      }
      throw new StateError(`Failed to validate state: ${error.message}`, 'STATE_VALIDATION_FAILED');
    }
  }

  /**
   * Check if a state parameter exists and is valid (without consuming)
   * @param {string} state - State parameter to check
   * @returns {boolean} True if state exists and is valid
   */
  isValidState(state) {
    try {
      if (!state) {
        return false;
      }

      const stateData = this.states.get(state);
      
      if (!stateData) {
        return false;
      }

      if (stateData.used) {
        return false;
      }

      if (Date.now() > stateData.expiresAt) {
        return false;
      }

      return true;

    } catch {
      return false;
    }
  }

  /**
   * Manually cleanup expired or used states
   */
  cleanupExpired() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [state, stateData] of this.states) {
      // Remove if expired or used more than 1 hour ago
      if (now > stateData.expiresAt || 
          (stateData.used && stateData.usedAt && (now - stateData.usedAt) > 3600000)) {
        this.states.delete(state);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all states (for testing)
   */
  clearAll() {
    this.states.clear();
  }

  /**
   * Generate a secure state parameter
   * @returns {string} Secure random state parameter
   */
  generateSecureState() {
    return crypto.randomBytes(oauthConfig.oauth.stateLength).toString('hex');
  }

  /**
   * Get state management statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const now = Date.now();
    let activeStates = 0;
    let expiredStates = 0;
    let usedStates = 0;

    for (const [, stateData] of this.states) {
      if (stateData.used) {
        usedStates++;
      } else if (now > stateData.expiresAt) {
        expiredStates++;
      } else {
        activeStates++;
      }
    }

    return {
      totalStates: this.states.size,
      activeStates,
      expiredStates,
      usedStates,
      maxCapacity: this.maxStates,
      utilizationPercent: Math.round((this.states.size / this.maxStates) * 100),
      cleanupEnabled: !!this.cleanupInterval,
      expiryMinutes: this.expiryMinutes
    };
  }

  /**
   * Get state data for debugging (without consuming)
   * @param {string} state - State parameter
   * @returns {Object|null} State data or null
   */
  inspectState(state) {
    const stateData = this.states.get(state);
    
    if (!stateData) {
      return null;
    }

    return {
      provider: stateData.provider,
      redirectURL: stateData.redirectURL,
      userId: stateData.userId,
      createdAt: new Date(stateData.createdAt).toISOString(),
      expiresAt: new Date(stateData.expiresAt).toISOString(),
      used: stateData.used,
      usedAt: stateData.usedAt ? new Date(stateData.usedAt).toISOString() : null,
      isExpired: Date.now() > stateData.expiresAt,
      remainingMs: Math.max(0, stateData.expiresAt - Date.now())
    };
  }
}

// Create singleton instance
const stateManager = new StateManager();

// Cleanup on process exit
process.on('exit', () => {
  stateManager.stopCleanup();
});

process.on('SIGINT', () => {
  stateManager.stopCleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stateManager.stopCleanup();
  process.exit(0);
});

module.exports = stateManager;
module.exports.StateManager = StateManager;
module.exports.StateError = StateError;