/**
 * OAuth State Management Test Suite
 * Comprehensive tests for OAuth state parameter handling
 */

const { StateManager, StateError } = require('../../../src/auth/oauth/state');

describe('OAuth State Management', () => {
  let stateManager;
  let originalConsoleWarn;

  beforeEach(() => {
    // Create fresh state manager instance for each test
    stateManager = new StateManager();
    
    // Mock console.warn to prevent test output noise
    originalConsoleWarn = console.warn;
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Clean up state manager
    if (stateManager) {
      stateManager.stopCleanup();
      stateManager.clearAll();
    }
    
    // Restore console.warn
    console.warn = originalConsoleWarn;
  });

  describe('State Creation', () => {
    test('should create state with valid data', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: 'user-123',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);

      expect(typeof state).toBe('string');
      expect(state.length).toBe(64); // 32 bytes hex = 64 characters
      expect(state).toMatch(/^[0-9a-f]+$/); // hex string
    });

    test('should store state data correctly', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: 'user-123',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      const inspectedState = stateManager.inspectState(state);

      expect(inspectedState).toBeDefined();
      expect(inspectedState.provider).toBe(stateData.provider);
      expect(inspectedState.redirectURL).toBe(stateData.redirectURL);
      expect(inspectedState.userId).toBe(stateData.userId);
      expect(inspectedState.used).toBe(false);
      expect(inspectedState.isExpired).toBe(false);
    });

    test('should throw error for missing provider', async () => {
      const stateData = {
        redirectURL: '/dashboard',
        userId: 'user-123'
      };

      await expect(stateManager.createState(stateData)).rejects.toThrow(StateError);
      await expect(stateManager.createState(stateData)).rejects.toThrow('Provider is required for state creation');
    });

    test('should throw error for missing redirect URL', async () => {
      const stateData = {
        provider: 'linkedin',
        userId: 'user-123'
      };

      await expect(stateManager.createState(stateData)).rejects.toThrow(StateError);
      await expect(stateManager.createState(stateData)).rejects.toThrow('Redirect URL is required for state creation');
    });

    test('should create state without userId (for new user flow)', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      const inspectedState = stateManager.inspectState(state);

      expect(inspectedState).toBeDefined();
      expect(inspectedState.userId).toBeUndefined();
    });

    test('should generate unique states', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state1 = await stateManager.createState(stateData);
      const state2 = await stateManager.createState(stateData);

      expect(state1).not.toBe(state2);
      expect(state1.length).toBe(state2.length);
    });

    test('should set expiration time correctly', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      const inspectedState = stateManager.inspectState(state);

      expect(inspectedState.expiresAt).toBeDefined();
      expect(new Date(inspectedState.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(inspectedState.remainingMs).toBeGreaterThan(0);
      expect(inspectedState.remainingMs).toBeLessThanOrEqual(10 * 60 * 1000); // 10 minutes
    });
  });

  describe('State Validation and Consumption', () => {
    test('should validate and consume valid state', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: 'user-123',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      const validatedData = await stateManager.validateAndConsumeState(state);

      expect(validatedData).toBeDefined();
      expect(validatedData.provider).toBe(stateData.provider);
      expect(validatedData.redirectURL).toBe(stateData.redirectURL);
      expect(validatedData.userId).toBe(stateData.userId);
      
      // Internal fields should not be exposed
      expect(validatedData.createdAt).toBeUndefined();
      expect(validatedData.expiresAt).toBeUndefined();
      expect(validatedData.used).toBeUndefined();
    });

    test('should mark state as used after validation', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      await stateManager.validateAndConsumeState(state);
      
      const inspectedState = stateManager.inspectState(state);
      expect(inspectedState.used).toBe(true);
      expect(inspectedState.usedAt).toBeDefined();
    });

    test('should throw error for missing state parameter', async () => {
      await expect(stateManager.validateAndConsumeState()).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState()).rejects.toThrow('State parameter is required');
      
      await expect(stateManager.validateAndConsumeState(null)).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState('')).rejects.toThrow(StateError);
    });

    test('should throw error for invalid state parameter', async () => {
      await expect(stateManager.validateAndConsumeState('invalid-state')).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState('invalid-state')).rejects.toThrow('Invalid or expired state parameter');
    });

    test('should throw error for non-string state parameter', async () => {
      await expect(stateManager.validateAndConsumeState(123)).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState(123)).rejects.toThrow('State must be a string');
      
      await expect(stateManager.validateAndConsumeState({})).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState([])).rejects.toThrow(StateError);
    });

    test('should throw error for already used state', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      await stateManager.validateAndConsumeState(state); // First use

      await expect(stateManager.validateAndConsumeState(state)).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState(state)).rejects.toThrow('State parameter has already been used');
    });

    test('should throw error for expired state', async () => {
      // Mock short expiry time
      const originalExpiryMinutes = stateManager.expiryMinutes;
      stateManager.expiryMinutes = 0.001; // Very short expiry

      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      await expect(stateManager.validateAndConsumeState(state)).rejects.toThrow(StateError);
      await expect(stateManager.validateAndConsumeState(state)).rejects.toThrow('State parameter has expired');

      // Restore original expiry time
      stateManager.expiryMinutes = originalExpiryMinutes;
    });
  });

  describe('State Validation (Non-Consuming)', () => {
    test('should validate state without consuming', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      
      expect(stateManager.isValidState(state)).toBe(true);
      
      // State should still be valid after check
      expect(stateManager.isValidState(state)).toBe(true);
      
      // Should still be able to consume
      const validatedData = await stateManager.validateAndConsumeState(state);
      expect(validatedData).toBeDefined();
    });

    test('should return false for invalid states', () => {
      expect(stateManager.isValidState('invalid-state')).toBe(false);
      expect(stateManager.isValidState('')).toBe(false);
      expect(stateManager.isValidState(null)).toBe(false);
      expect(stateManager.isValidState(undefined)).toBe(false);
    });

    test('should return false for used states', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      await stateManager.validateAndConsumeState(state);
      
      expect(stateManager.isValidState(state)).toBe(false);
    });

    test('should return false for expired states', async () => {
      // Mock short expiry time
      const originalExpiryMinutes = stateManager.expiryMinutes;
      stateManager.expiryMinutes = 0.001;

      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stateManager.isValidState(state)).toBe(false);

      // Restore original expiry time
      stateManager.expiryMinutes = originalExpiryMinutes;
    });
  });

  describe('State Cleanup', () => {
    test('should cleanup expired states', async () => {
      // Mock short expiry time
      const originalExpiryMinutes = stateManager.expiryMinutes;
      stateManager.expiryMinutes = 0.001;

      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      // Create multiple states
      const state1 = await stateManager.createState(stateData);
      const state2 = await stateManager.createState(stateData);
      
      expect(stateManager.states.size).toBe(2);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Cleanup expired states
      const cleanedCount = stateManager.cleanupExpired();
      
      expect(cleanedCount).toBe(2);
      expect(stateManager.states.size).toBe(0);

      // Restore original expiry time
      stateManager.expiryMinutes = originalExpiryMinutes;
    });

    test('should cleanup used states older than 1 hour', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      await stateManager.validateAndConsumeState(state);
      
      // Mock old usage time
      const stateEntry = stateManager.states.get(state);
      stateEntry.usedAt = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      const cleanedCount = stateManager.cleanupExpired();
      
      expect(cleanedCount).toBe(1);
      expect(stateManager.states.size).toBe(0);
    });

    test('should not cleanup active valid states', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      await stateManager.createState(stateData);
      
      const cleanedCount = stateManager.cleanupExpired();
      
      expect(cleanedCount).toBe(0);
      expect(stateManager.states.size).toBe(1);
    });

    test('should clear all states', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      await stateManager.createState(stateData);
      await stateManager.createState(stateData);
      
      expect(stateManager.states.size).toBe(2);
      
      stateManager.clearAll();
      
      expect(stateManager.states.size).toBe(0);
    });
  });

  describe('Capacity Management', () => {
    test('should remove oldest states when at capacity', async () => {
      // Mock small capacity
      const originalMaxStates = stateManager.maxStates;
      stateManager.maxStates = 3;

      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      // Create states up to capacity
      const state1 = await stateManager.createState(stateData);
      const state2 = await stateManager.createState(stateData);
      const state3 = await stateManager.createState(stateData);
      
      expect(stateManager.states.size).toBe(3);
      
      // Add slight delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Create one more state (should remove oldest)
      const state4 = await stateManager.createState(stateData);
      
      expect(stateManager.states.size).toBeLessThanOrEqual(3);
      expect(stateManager.states.has(state4)).toBe(true); // Newest should exist

      // Restore original capacity
      stateManager.maxStates = originalMaxStates;
    });
  });

  describe('State Inspection', () => {
    test('should inspect state without affecting it', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: 'user-123',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      
      const inspectedState = stateManager.inspectState(state);
      
      expect(inspectedState).toBeDefined();
      expect(inspectedState.provider).toBe(stateData.provider);
      expect(inspectedState.redirectURL).toBe(stateData.redirectURL);
      expect(inspectedState.userId).toBe(stateData.userId);
      expect(inspectedState.used).toBe(false);
      expect(inspectedState.isExpired).toBe(false);
      expect(inspectedState.createdAt).toBeDefined();
      expect(inspectedState.expiresAt).toBeDefined();
      expect(inspectedState.remainingMs).toBeGreaterThan(0);
      
      // State should still be valid
      expect(stateManager.isValidState(state)).toBe(true);
    });

    test('should return null for non-existent state', () => {
      const inspectedState = stateManager.inspectState('non-existent-state');
      
      expect(inspectedState).toBeNull();
    });

    test('should show expiration status correctly', async () => {
      // Mock short expiry time
      const originalExpiryMinutes = stateManager.expiryMinutes;
      stateManager.expiryMinutes = 0.001;

      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      const state = await stateManager.createState(stateData);
      
      // Initially not expired
      let inspectedState = stateManager.inspectState(state);
      expect(inspectedState.isExpired).toBe(false);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should show as expired
      inspectedState = stateManager.inspectState(state);
      expect(inspectedState.isExpired).toBe(true);
      expect(inspectedState.remainingMs).toBe(0);

      // Restore original expiry time
      stateManager.expiryMinutes = originalExpiryMinutes;
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', async () => {
      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      // Create various states
      const state1 = await stateManager.createState(stateData);
      const state2 = await stateManager.createState(stateData);
      await stateManager.validateAndConsumeState(state1); // Use one

      const stats = stateManager.getStats();
      
      expect(stats.totalStates).toBe(2);
      expect(stats.activeStates).toBe(1);
      expect(stats.usedStates).toBe(1);
      expect(stats.expiredStates).toBe(0);
      expect(stats.maxCapacity).toBe(1000);
      expect(stats.cleanupEnabled).toBe(true);
      expect(stats.expiryMinutes).toBe(10);
      expect(typeof stats.utilizationPercent).toBe('number');
    });

    test('should calculate utilization percentage correctly', async () => {
      // Mock small capacity for easier testing
      const originalMaxStates = stateManager.maxStates;
      stateManager.maxStates = 10;

      const stateData = {
        provider: 'linkedin',
        redirectURL: '/dashboard',
        timestamp: Date.now()
      };

      // Create 5 states (50% utilization)
      for (let i = 0; i < 5; i++) {
        await stateManager.createState(stateData);
      }

      const stats = stateManager.getStats();
      expect(stats.utilizationPercent).toBe(50);

      // Restore original capacity
      stateManager.maxStates = originalMaxStates;
    });
  });

  describe('Cleanup Interval Management', () => {
    test('should start cleanup interval by default', () => {
      expect(stateManager.cleanupInterval).not.toBeNull();
    });

    test('should stop cleanup interval', () => {
      stateManager.stopCleanup();
      expect(stateManager.cleanupInterval).toBeNull();
    });

    test('should restart cleanup interval', () => {
      stateManager.stopCleanup();
      expect(stateManager.cleanupInterval).toBeNull();
      
      stateManager.startCleanup();
      expect(stateManager.cleanupInterval).not.toBeNull();
    });
  });
});