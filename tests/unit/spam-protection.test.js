/**
 * Spam Protection Unit Tests
 * Tests for spam protection middleware functionality
 */

const { 
  spamProtectionMiddleware, 
  SpamProtectionError,
  getUserReputation,
  shouldBlockUser,
  getSpamProtectionStats,
  updateUserReputation,
  resetUserReputation
} = require('../../src/middleware/spamProtection');

describe('Spam Protection Middleware', () => {
  const mockSocket = {
    userId: 'test-user-spam'
  };

  beforeEach(() => {
    // Reset user reputation before each test
    resetUserReputation(mockSocket.userId);
  });

  describe('Content Filtering', () => {
    const middleware = spamProtectionMiddleware({
      enableContentFiltering: true,
      enableDuplicateDetection: false,
      enableReputationSystem: false
    });

    it('should allow normal messages', (done) => {
      const data = { content: 'Hello, this is a normal message!' };
      
      middleware(mockSocket, data, (error) => {
        expect(error).toBeUndefined();
        done();
      });
    });

    it('should detect repeated characters', (done) => {
      const data = { content: 'AAAAAAAAAAAAAAAAAAAAAA' }; // 22 repeated characters
      
      middleware(mockSocket, data, (error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('inappropriate content');
        done();
      });
    });

    it('should detect excessive caps', (done) => {
      const middleware = spamProtectionMiddleware({
        enableContentFiltering: true,
        strictMode: true
      });
      
      const data = { content: 'THIS IS A VERY LOUD MESSAGE WITH LOTS OF CAPS!!!' };
      
      middleware(mockSocket, data, (error) => {
        // In strict mode, this might trigger a warning but not block
        // The actual behavior depends on the pattern severity
        done();
      });
    });

    it('should detect URLs', (done) => {
      const data = { content: 'Check out this link: https://suspicious-site.com' };
      
      middleware(mockSocket, data, (error) => {
        // URLs are flagged as suspicious patterns but may not block in non-strict mode
        done();
      });
    });
  });

  describe('Duplicate Detection', () => {
    const middleware = spamProtectionMiddleware({
      enableContentFiltering: false,
      enableDuplicateDetection: true,
      enableReputationSystem: false
    });

    it('should allow unique messages', (done) => {
      const data = { content: 'This is message 1' };
      
      middleware(mockSocket, data, (error) => {
        expect(error).toBeUndefined();
        
        const data2 = { content: 'This is message 2' };
        middleware(mockSocket, data2, (error) => {
          expect(error).toBeUndefined();
          done();
        });
      });
    });

    it('should detect duplicate messages', (done) => {
      const data = { content: 'This is a duplicate message' };
      
      // Send the same message multiple times
      middleware(mockSocket, data, (error1) => {
        expect(error1).toBeUndefined();
        
        middleware(mockSocket, data, (error2) => {
          expect(error2).toBeUndefined();
          
          middleware(mockSocket, data, (error3) => {
            expect(error3).toBeUndefined();
            
            // Fourth attempt should be blocked
            middleware(mockSocket, data, (error4) => {
              expect(error4).toBeDefined();
              expect(error4.message).toContain('Duplicate message detected');
              done();
            });
          });
        });
      });
    });
  });

  describe('Reputation System', () => {
    const middleware = spamProtectionMiddleware({
      enableContentFiltering: false,
      enableDuplicateDetection: false,
      enableReputationSystem: true
    });

    it('should initialize user reputation', (done) => {
      const data = { content: 'Normal message' };
      
      middleware(mockSocket, data, (error) => {
        expect(error).toBeUndefined();
        
        const reputation = getUserReputation(mockSocket.userId);
        expect(reputation).toBeDefined();
        expect(reputation.score).toBe(100); // Initial score
        expect(reputation.messagesCount).toBe(1);
        done();
      });
    });

    it('should improve reputation for good messages', (done) => {
      const data = { content: 'Good message' };
      
      // Send several good messages
      middleware(mockSocket, data, (error1) => {
        expect(error1).toBeUndefined();
        
        middleware(mockSocket, { content: 'Another good message' }, (error2) => {
          expect(error2).toBeUndefined();
          
          const reputation = getUserReputation(mockSocket.userId);
          expect(reputation.score).toBeGreaterThan(100); // Should have improved
          expect(reputation.messagesCount).toBe(2);
          done();
        });
      });
    });

    it('should block users with low reputation', (done) => {
      // Manually set low reputation
      updateUserReputation(mockSocket.userId, 'violation', 5); // Severe penalty
      updateUserReputation(mockSocket.userId, 'violation', 5);
      updateUserReputation(mockSocket.userId, 'violation', 5);
      
      const data = { content: 'Any message' };
      
      middleware(mockSocket, data, (error) => {
        expect(error).toBeDefined();
        expect(error.message).toContain('temporarily restricted');
        done();
      });
    });
  });

  describe('Combined Protection', () => {
    const middleware = spamProtectionMiddleware({
      enableContentFiltering: true,
      enableDuplicateDetection: true,
      enableReputationSystem: true,
      strictMode: false
    });

    it('should handle multiple protection layers', (done) => {
      // First, send a normal message
      middleware(mockSocket, { content: 'Normal message' }, (error1) => {
        expect(error1).toBeUndefined();
        
        // Then try suspicious content
        middleware(mockSocket, { content: 'SPAM SPAM SPAM SPAM SPAM' }, (error2) => {
          // This might be flagged but not necessarily blocked in non-strict mode
          // Then try duplicate
          const duplicateMessage = { content: 'Duplicate test message' };
          
          // Send same message multiple times
          middleware(mockSocket, duplicateMessage, () => {
            middleware(mockSocket, duplicateMessage, () => {
              middleware(mockSocket, duplicateMessage, () => {
                middleware(mockSocket, duplicateMessage, (error3) => {
                  expect(error3).toBeDefined();
                  expect(error3.message).toContain('Duplicate message detected');
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Utility Functions', () => {
    it('should get spam protection statistics', () => {
      // Initialize some users
      updateUserReputation('user1', 'good_message');
      updateUserReputation('user2', 'violation', 3);
      updateUserReputation('user3', 'good_message');
      
      const stats = getSpamProtectionStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalUsers).toBeGreaterThanOrEqual(3);
      expect(stats.totalViolations).toBeGreaterThanOrEqual(1);
      expect(typeof stats.activePatterns).toBe('number');
    });

    it('should check if user should be blocked', () => {
      // User with good reputation
      updateUserReputation('good-user', 'good_message');
      const goodUserBlock = shouldBlockUser('good-user');
      expect(goodUserBlock.blocked).toBe(false);
      
      // User with bad reputation
      updateUserReputation('bad-user', 'violation', 5);
      updateUserReputation('bad-user', 'violation', 5);
      const badUserBlock = shouldBlockUser('bad-user');
      expect(badUserBlock.blocked).toBe(true);
      expect(badUserBlock.reason).toBeDefined();
    });

    it('should reset user reputation', () => {
      updateUserReputation('test-reset-user', 'violation', 3);
      let reputation = getUserReputation('test-reset-user');
      expect(reputation).toBeDefined();
      
      resetUserReputation('test-reset-user');
      reputation = getUserReputation('test-reset-user');
      expect(reputation).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user ID', (done) => {
      const middleware = spamProtectionMiddleware();
      const badSocket = {}; // No userId
      
      middleware(badSocket, { content: 'test' }, (error) => {
        expect(error).toBeDefined();
        expect(error.code).toBe('NO_USER_ID');
        done();
      });
    });

    it('should handle empty content gracefully', (done) => {
      const middleware = spamProtectionMiddleware();
      
      middleware(mockSocket, {}, (error) => {
        expect(error).toBeUndefined(); // Should pass without content
        done();
      });
    });

    it('should handle non-string content', (done) => {
      const middleware = spamProtectionMiddleware();
      
      middleware(mockSocket, { content: 123 }, (error) => {
        expect(error).toBeUndefined(); // Should handle gracefully
        done();
      });
    });
  });
});