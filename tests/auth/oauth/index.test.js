/**
 * OAuth Framework Test Suite
 * Comprehensive tests for the core OAuth framework
 */

const { OAuth, OAuthError, oauth } = require('../../../src/auth/oauth');
const LinkedInProvider = require('../../../src/auth/oauth/providers/linkedin');
const jwt = require('../../../src/auth/jwt');
const { User } = require('../../../src/models/User');

// Mock dependencies
jest.mock('../../../src/auth/oauth/providers/linkedin');
jest.mock('../../../src/auth/jwt');
jest.mock('../../../src/models/User');
jest.mock('../../../src/auth/oauth/state', () => ({
  createState: jest.fn(),
  validateAndConsumeState: jest.fn(),
  getStats: jest.fn(() => ({ totalStates: 5, activeStates: 3 }))
}));

describe('OAuth Framework', () => {
  let oauthFramework;
  let mockLinkedInProvider;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret-long-enough';
    
    // Clear require cache and mocks
    jest.resetModules();
    jest.clearAllMocks();
    
    // Mock oauth config
    const oauthConfig = require('../../../src/config/oauth');
    oauthConfig.getProviderConfig = jest.fn().mockReturnValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret-long-enough',
      settings: { enabled: true }
    });
    oauthConfig.getEnabledProviders = jest.fn().mockReturnValue([
      { key: 'linkedin', name: 'LinkedIn', displayName: 'LinkedIn' }
    ]);
    oauthConfig.redirects = {
      success: '/dashboard',
      error: '/login?error=oauth_failed',
      cancel: '/login?info=oauth_cancelled'
    };
    
    // Create fresh OAuth instance
    oauthFramework = new OAuth();
    
    // Create mock provider
    mockLinkedInProvider = {
      getAuthorizationURL: jest.fn(),
      handleCallback: jest.fn(),
      getProfile: jest.fn()
    };
    
    LinkedInProvider.mockImplementation(() => mockLinkedInProvider);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Provider Registration', () => {
    test('should register valid provider', () => {
      const mockProvider = {
        getAuthorizationURL: jest.fn(),
        handleCallback: jest.fn(),
        getProfile: jest.fn()
      };

      expect(() => {
        oauthFramework.registerProvider('test-provider', mockProvider);
      }).not.toThrow();

      expect(oauthFramework.providers.has('test-provider')).toBe(true);
    });

    test('should throw error for invalid provider key', () => {
      const mockProvider = {
        getAuthorizationURL: jest.fn(),
        handleCallback: jest.fn(),
        getProfile: jest.fn()
      };

      expect(() => {
        oauthFramework.registerProvider('', mockProvider);
      }).toThrow(OAuthError);
      
      expect(() => {
        oauthFramework.registerProvider(null, mockProvider);
      }).toThrow(OAuthError);
      
      expect(() => {
        oauthFramework.registerProvider(123, mockProvider);
      }).toThrow(OAuthError);
    });

    test('should throw error for invalid provider instance', () => {
      expect(() => {
        oauthFramework.registerProvider('test', null);
      }).toThrow(OAuthError);
      
      expect(() => {
        oauthFramework.registerProvider('test', 'not-an-object');
      }).toThrow(OAuthError);
    });

    test('should throw error for provider missing required methods', () => {
      const incompleteProvider = {
        getAuthorizationURL: jest.fn()
        // Missing handleCallback and getProfile
      };

      expect(() => {
        oauthFramework.registerProvider('test', incompleteProvider);
      }).toThrow(OAuthError);
      expect(() => {
        oauthFramework.registerProvider('test', incompleteProvider);
      }).toThrow('Provider must implement handleCallback method');
    });

    test('should validate all required provider methods', () => {
      const requiredMethods = ['getAuthorizationURL', 'handleCallback', 'getProfile'];
      
      requiredMethods.forEach(missingMethod => {
        const partialProvider = {};
        
        // Add all methods except the one we're testing
        requiredMethods.forEach(method => {
          if (method !== missingMethod) {
            partialProvider[method] = jest.fn();
          }
        });

        expect(() => {
          oauthFramework.registerProvider('test', partialProvider);
        }).toThrow(OAuthError);
        expect(() => {
          oauthFramework.registerProvider('test', partialProvider);
        }).toThrow(`Provider must implement ${missingMethod} method`);
      });
    });
  });

  describe('Provider Retrieval', () => {
    beforeEach(() => {
      oauthFramework.registerProvider('linkedin', mockLinkedInProvider);
    });

    test('should retrieve registered provider', () => {
      const provider = oauthFramework.getProvider('linkedin');
      
      expect(provider).toBe(mockLinkedInProvider);
    });

    test('should throw error for non-existent provider', () => {
      expect(() => {
        oauthFramework.getProvider('nonexistent');
      }).toThrow(OAuthError);
      expect(() => {
        oauthFramework.getProvider('nonexistent');
      }).toThrow('Provider nonexistent not found');
    });

    test('should get available providers', () => {
      // Mock the config to return enabled providers
      jest.doMock('../../../src/config/oauth', () => ({
        getEnabledProviders: jest.fn(() => [
          { key: 'linkedin', name: 'LinkedIn', displayName: 'LinkedIn' }
        ])
      }));

      const availableProviders = oauthFramework.getAvailableProviders();
      
      expect(Array.isArray(availableProviders)).toBe(true);
    });
  });

  describe('OAuth Flow Initiation', () => {
    beforeEach(() => {
      oauthFramework.registerProvider('linkedin', mockLinkedInProvider);
      
      // Mock state creation
      const stateManager = require('../../../src/auth/oauth/state');
      stateManager.createState.mockResolvedValue('test-state-123');
      
      // Mock provider authorization URL
      mockLinkedInProvider.getAuthorizationURL.mockResolvedValue('https://linkedin.com/auth?state=test-state-123');
    });

    test('should initiate OAuth flow successfully', async () => {
      const result = await oauthFramework.initiateOAuth('linkedin', {
        redirectURL: '/dashboard',
        userId: 'user-123'
      });

      expect(result).toBeDefined();
      expect(result.authorizationURL).toBe('https://linkedin.com/auth?state=test-state-123');
      expect(result.state).toBe('test-state-123');
      expect(result.provider).toBe('linkedin');
    });

    test('should create state with correct data', async () => {
      const stateManager = require('../../../src/auth/oauth/state');
      
      await oauthFramework.initiateOAuth('linkedin', {
        redirectURL: '/dashboard',
        userId: 'user-123'
      });

      expect(stateManager.createState).toHaveBeenCalledWith({
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: 'user-123',
        timestamp: expect.any(Number)
      });
    });

    test('should use default redirect URL when none provided', async () => {
      const stateManager = require('../../../src/auth/oauth/state');
      
      await oauthFramework.initiateOAuth('linkedin');

      expect(stateManager.createState).toHaveBeenCalledWith({
        provider: 'linkedin',
        redirectURL: '/dashboard', // Default from config
        userId: null,
        timestamp: expect.any(Number)
      });
    });

    test('should pass additional parameters to provider', async () => {
      await oauthFramework.initiateOAuth('linkedin', {
        additionalParams: { prompt: 'consent' }
      });

      expect(mockLinkedInProvider.getAuthorizationURL).toHaveBeenCalledWith(
        'test-state-123',
        { prompt: 'consent' }
      );
    });

    test('should throw error for non-existent provider', async () => {
      await expect(oauthFramework.initiateOAuth('nonexistent')).rejects.toThrow(OAuthError);
      await expect(oauthFramework.initiateOAuth('nonexistent')).rejects.toThrow('Provider nonexistent not found');
    });

    test('should handle state creation errors', async () => {
      const stateManager = require('../../../src/auth/oauth/state');
      stateManager.createState.mockRejectedValue(new Error('State creation failed'));

      await expect(oauthFramework.initiateOAuth('linkedin')).rejects.toThrow(OAuthError);
      await expect(oauthFramework.initiateOAuth('linkedin')).rejects.toThrow('Failed to initiate OAuth');
    });

    test('should handle provider authorization URL errors', async () => {
      mockLinkedInProvider.getAuthorizationURL.mockRejectedValue(new Error('URL generation failed'));

      await expect(oauthFramework.initiateOAuth('linkedin')).rejects.toThrow(OAuthError);
      await expect(oauthFramework.initiateOAuth('linkedin')).rejects.toThrow('Failed to initiate OAuth');
    });
  });

  describe('OAuth Callback Handling', () => {
    beforeEach(() => {
      oauthFramework.registerProvider('linkedin', mockLinkedInProvider);
      
      const stateManager = require('../../../src/auth/oauth/state');
      stateManager.validateAndConsumeState.mockResolvedValue({
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: null
      });
      
      mockLinkedInProvider.handleCallback.mockResolvedValue({
        accessToken: 'access-token-123',
        tokenType: 'Bearer',
        expiresIn: 3600
      });
      
      mockLinkedInProvider.getProfile.mockResolvedValue({
        id: 'linkedin-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
    });

    test('should handle callback successfully', async () => {
      const callbackParams = {
        code: 'auth-code-123',
        state: 'state-123'
      };

      const result = await oauthFramework.handleCallback('linkedin', callbackParams);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('linkedin');
      expect(result.tokens).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.stateData).toBeDefined();
      expect(result.linkedUserId).toBeNull();
    });

    test('should validate state with correct provider', async () => {
      const stateManager = require('../../../src/auth/oauth/state');
      
      const callbackParams = {
        code: 'auth-code-123',
        state: 'state-123'
      };

      await oauthFramework.handleCallback('linkedin', callbackParams);

      expect(stateManager.validateAndConsumeState).toHaveBeenCalledWith('state-123');
    });

    test('should handle OAuth error responses', async () => {
      const callbackParams = {
        error: 'access_denied',
        error_description: 'User denied access'
      };

      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow('OAuth provider returned error: access_denied');
    });

    test('should handle missing authorization code', async () => {
      const callbackParams = {
        state: 'state-123'
        // Missing code
      };

      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow('Authorization code not provided');
    });

    test('should handle missing state parameter', async () => {
      const callbackParams = {
        code: 'auth-code-123'
        // Missing state
      };

      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow('State parameter not provided');
    });

    test('should handle state provider mismatch', async () => {
      const stateManager = require('../../../src/auth/oauth/state');
      stateManager.validateAndConsumeState.mockResolvedValue({
        provider: 'different-provider',
        redirectURL: '/dashboard'
      });

      const callbackParams = {
        code: 'auth-code-123',
        state: 'state-123'
      };

      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow('State provider mismatch');
    });

    test('should handle account linking flow', async () => {
      const stateManager = require('../../../src/auth/oauth/state');
      stateManager.validateAndConsumeState.mockResolvedValue({
        provider: 'linkedin',
        redirectURL: '/dashboard',
        userId: 'user-123' // Account linking flow
      });

      const callbackParams = {
        code: 'auth-code-123',
        state: 'state-123'
      };

      const result = await oauthFramework.handleCallback('linkedin', callbackParams);

      expect(result.linkedUserId).toBe('user-123');
    });

    test('should handle token exchange errors', async () => {
      mockLinkedInProvider.handleCallback.mockRejectedValue(new Error('Token exchange failed'));

      const callbackParams = {
        code: 'auth-code-123',
        state: 'state-123'
      };

      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow('Failed to handle OAuth callback');
    });

    test('should handle profile fetch errors', async () => {
      mockLinkedInProvider.getProfile.mockRejectedValue(new Error('Profile fetch failed'));

      const callbackParams = {
        code: 'auth-code-123',
        state: 'state-123'
      };

      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.handleCallback('linkedin', callbackParams)).rejects.toThrow('Failed to handle OAuth callback');
    });
  });

  describe('Profile Linking', () => {
    beforeEach(() => {
      // Mock User model methods
      User.linkOAuthProfile = jest.fn();
      jwt.generateTokenPair = jest.fn().mockReturnValue({
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: '24h'
      });
    });

    test('should link profile to existing user', async () => {
      const profile = {
        id: 'linkedin-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      const tokens = {
        accessToken: 'access-token-123'
      };

      const mockLinkedUser = {
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'Existing',
        lastName: 'User',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending',
        oauthProfiles: [
          {
            provider: 'linkedin',
            providerId: 'linkedin-123',
            email: 'user@example.com',
            linkedAt: new Date()
          }
        ]
      };

      User.linkOAuthProfile.mockResolvedValue(mockLinkedUser);

      const result = await oauthFramework.linkProfileToUser('user-123', 'linkedin', profile, tokens);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.user.id).toBe('user-123');
      expect(result.provider).toBe('linkedin');
      expect(result.profileId).toBe('linkedin-123');
      expect(result.email).toBe('user@example.com');
      expect(result.linkedAt).toBeDefined();
      expect(result.isNewUser).toBe(false);
      expect(result.linkedAccount).toBe(true);
      expect(result.tokens).toBeDefined();

      expect(User.linkOAuthProfile).toHaveBeenCalledWith('user-123', 'linkedin', profile);
      expect(jwt.generateTokenPair).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending'
      });
    });

    test('should handle User model linking errors', async () => {
      const profile = { id: 'linkedin-123', email: 'user@example.com' };
      const tokens = { accessToken: 'token' };

      User.linkOAuthProfile.mockRejectedValue(new Error('User not found'));

      await expect(oauthFramework.linkProfileToUser('user-123', 'linkedin', profile, tokens)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.linkProfileToUser('user-123', 'linkedin', profile, tokens)).rejects.toThrow('Failed to link profile');
    });

    test('should handle missing required parameters for linking', async () => {
      const profile = { id: 'linkedin-123', email: 'user@example.com' };
      const tokens = { accessToken: 'token' };

      await expect(oauthFramework.linkProfileToUser(null, 'linkedin', profile, tokens)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.linkProfileToUser(null, 'linkedin', profile, tokens)).rejects.toThrow('User ID is required for profile linking');

      await expect(oauthFramework.linkProfileToUser('user-123', null, profile, tokens)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.linkProfileToUser('user-123', null, profile, tokens)).rejects.toThrow('Provider is required for profile linking');

      await expect(oauthFramework.linkProfileToUser('user-123', 'linkedin', null, tokens)).rejects.toThrow(OAuthError);
      await expect(oauthFramework.linkProfileToUser('user-123', 'linkedin', null, tokens)).rejects.toThrow('OAuth profile is required for linking');
    });
  });

  describe('User Creation/Update', () => {
    beforeEach(() => {
      // Mock User model methods
      User.findByOAuthProvider = jest.fn();
      User.findByEmail = jest.fn();
      User.createFromOAuth = jest.fn();
      User.updateOAuthProfile = jest.fn();
      
      jwt.generateTokenPair.mockReturnValue({
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: '24h'
      });
    });

    test('should create new user from OAuth profile', async () => {
      const profile = {
        id: 'linkedin-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profilePicture: 'https://example.com/pic.jpg'
      };

      const tokens = {
        accessToken: 'oauth-access-token'
      };

      const mockNewUser = {
        id: 'new-user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending',
        isNewUser: true
      };

      User.findByOAuthProvider.mockResolvedValue(null); // No existing OAuth user
      User.findByEmail.mockResolvedValue(null); // No existing email user
      User.createFromOAuth.mockResolvedValue(mockNewUser);

      const result = await oauthFramework.createOrUpdateUser('linkedin', profile, tokens);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.user).toBe(mockNewUser);
      expect(result.tokens).toBeDefined();
      expect(result.isNewUser).toBe(true);

      expect(User.findByOAuthProvider).toHaveBeenCalledWith('linkedin', 'linkedin-123');
      expect(User.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(User.createFromOAuth).toHaveBeenCalledWith('linkedin', profile);
    });

    test('should update existing user OAuth profile', async () => {
      const profile = {
        id: 'linkedin-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockExistingUser = {
        id: 'existing-user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        emailVerified: true,
        kycStatus: 'verified'
      };

      User.findByOAuthProvider.mockResolvedValue(mockExistingUser);
      User.updateOAuthProfile.mockResolvedValue(mockExistingUser);

      const result = await oauthFramework.createOrUpdateUser('linkedin', profile, {});

      expect(result.success).toBe(true);
      expect(result.user).toBe(mockExistingUser);
      expect(result.isNewUser).toBe(false);

      expect(User.updateOAuthProfile).toHaveBeenCalledWith(
        'existing-user-123',
        'linkedin',
        'linkedin-123',
        {
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: undefined,
          headline: undefined,
          profileURL: undefined,
          rawData: undefined
        }
      );
    });

    test('should handle email already exists error', async () => {
      const profile = {
        id: 'linkedin-123',
        email: 'existing@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      const existingEmailUser = {
        id: 'different-user-123',
        email: 'existing@example.com'
      };

      User.findByOAuthProvider.mockResolvedValue(null); // No OAuth user
      User.findByEmail.mockResolvedValue(existingEmailUser); // Email exists

      await expect(oauthFramework.createOrUpdateUser('linkedin', profile, {})).rejects.toThrow(OAuthError);
      await expect(oauthFramework.createOrUpdateUser('linkedin', profile, {})).rejects.toThrow('An account with this email already exists');
    });

    test('should generate JWT tokens for created user', async () => {
      const profile = {
        id: 'linkedin-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending'
      };

      User.findByOAuthProvider.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);
      User.createFromOAuth.mockResolvedValue(mockUser);

      await oauthFramework.createOrUpdateUser('linkedin', profile, {});

      expect(jwt.generateTokenPair).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'user@example.com',
        role: 'user',
        emailVerified: true,
        kycStatus: 'pending'
      });
    });

    test('should handle User model creation errors', async () => {
      const profile = { id: 'linkedin-123', email: 'user@example.com' };

      User.findByOAuthProvider.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);
      User.createFromOAuth.mockRejectedValue(new Error('Database error'));

      await expect(oauthFramework.createOrUpdateUser('linkedin', profile, {})).rejects.toThrow(OAuthError);
      await expect(oauthFramework.createOrUpdateUser('linkedin', profile, {})).rejects.toThrow('Failed to create/update user');
    });

    test('should handle missing required parameters for user creation', async () => {
      const profile = { id: 'linkedin-123', email: 'user@example.com' };

      await expect(oauthFramework.createOrUpdateUser(null, profile, {})).rejects.toThrow(OAuthError);
      await expect(oauthFramework.createOrUpdateUser(null, profile, {})).rejects.toThrow('Provider is required');

      await expect(oauthFramework.createOrUpdateUser('linkedin', null, {})).rejects.toThrow(OAuthError);
      await expect(oauthFramework.createOrUpdateUser('linkedin', null, {})).rejects.toThrow('OAuth profile is required');

      const profileWithoutEmail = { id: 'linkedin-123' };
      await expect(oauthFramework.createOrUpdateUser('linkedin', profileWithoutEmail, {})).rejects.toThrow(OAuthError);
      await expect(oauthFramework.createOrUpdateUser('linkedin', profileWithoutEmail, {})).rejects.toThrow('Email is required in OAuth profile');
    });
  });

  describe('Callback Request Validation', () => {
    test('should validate valid callback request', () => {
      const mockReq = {
        query: {
          code: 'auth-code-123',
          state: 'state-parameter-123'
        }
      };

      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).not.toThrow();
    });

    test('should handle missing state parameter', () => {
      const mockReq = {
        query: {
          code: 'auth-code-123'
          // Missing state
        }
      };

      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow(OAuthError);
      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow('Missing state parameter');
    });

    test('should handle OAuth error responses', () => {
      const mockReq = {
        query: {
          error: 'access_denied',
          error_description: 'User denied access'
        }
      };

      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow(OAuthError);
      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow('OAuth error: User denied access');
    });

    test('should handle OAuth error without description', () => {
      const mockReq = {
        query: {
          error: 'server_error'
        }
      };

      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow(OAuthError);
      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow('OAuth error: server_error');
    });

    test('should handle missing authorization code', () => {
      const mockReq = {
        query: {
          state: 'state-parameter-123'
          // Missing code
        }
      };

      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow(OAuthError);
      expect(() => {
        oauthFramework.validateCallbackRequest(mockReq);
      }).toThrow('Missing authorization code');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      oauthFramework.registerProvider('linkedin', mockLinkedInProvider);
    });

    test('should return OAuth statistics', () => {
      const stats = oauthFramework.getStats();

      expect(stats).toBeDefined();
      expect(Array.isArray(stats.registeredProviders)).toBe(true);
      expect(stats.registeredProviders).toContain('linkedin');
      expect(Array.isArray(stats.enabledProviders)).toBe(true);
      expect(stats.stateStats).toBeDefined();
      expect(stats.stateStats.totalStates).toBe(5);
      expect(stats.stateStats.activeStates).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('should preserve OAuth errors', async () => {
      oauthFramework.registerProvider('linkedin', mockLinkedInProvider);
      
      mockLinkedInProvider.getAuthorizationURL.mockRejectedValue(
        new OAuthError('Provider specific error', 'PROVIDER_ERROR', 'linkedin')
      );

      await expect(oauthFramework.initiateOAuth('linkedin')).rejects.toThrow(OAuthError);
      
      try {
        await oauthFramework.initiateOAuth('linkedin');
      } catch (error) {
        expect(error.code).toBe('PROVIDER_ERROR');
        expect(error.provider).toBe('linkedin');
      }
    });

    test('should wrap generic errors in OAuth errors', async () => {
      oauthFramework.registerProvider('linkedin', mockLinkedInProvider);
      
      mockLinkedInProvider.getAuthorizationURL.mockRejectedValue(new Error('Generic error'));

      await expect(oauthFramework.initiateOAuth('linkedin')).rejects.toThrow(OAuthError);
      
      try {
        await oauthFramework.initiateOAuth('linkedin');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect(error.code).toBe('INITIATION_FAILED');
      }
    });
  });

  describe('Global OAuth Instance', () => {
    test('should export singleton OAuth instance', () => {
      expect(oauth).toBeInstanceOf(OAuth);
    });

    test('should be the same instance across imports', () => {
      const { oauth: oauth2 } = require('../../../src/auth/oauth');
      expect(oauth).toBe(oauth2);
    });
  });
});