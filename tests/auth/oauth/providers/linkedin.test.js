/**
 * LinkedIn OAuth Provider Test Suite
 * Comprehensive tests for LinkedIn OAuth implementation
 */

const LinkedInProvider = require('../../../../src/auth/oauth/providers/linkedin');
const { OAuthError } = require('../../../../src/auth/oauth');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockAxios = axios;

describe('LinkedIn OAuth Provider', () => {
  let linkedinProvider;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set test environment with LinkedIn config
    process.env.NODE_ENV = 'test';
    process.env.LINKEDIN_CLIENT_ID = 'test-client-id';
    process.env.LINKEDIN_CLIENT_SECRET = 'test-client-secret-long-enough';
    process.env.LINKEDIN_CALLBACK_URL = 'http://localhost:3000/callback';
    
    // Clear require cache
    jest.resetModules();
    
    // Create axios mock methods
    mockAxios.create = jest.fn(() => ({
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn()
        }
      }
    }));

    // Create provider instance
    linkedinProvider = new LinkedInProvider();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with valid configuration', () => {
      expect(linkedinProvider).toBeInstanceOf(LinkedInProvider);
      expect(linkedinProvider.config).toBeDefined();
      expect(linkedinProvider.httpClient).toBeDefined();
    });

    test('should throw error if LinkedIn not configured', () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      jest.resetModules();
      
      expect(() => {
        new LinkedInProvider();
      }).toThrow(OAuthError);
    });

    test('should configure HTTP client with proper settings', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        timeout: 10000,
        headers: {
          'User-Agent': 'LegacyLancers/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });
  });

  describe('Authorization URL Generation', () => {
    test('should generate valid authorization URL', async () => {
      const state = 'test-state-parameter';
      const authURL = await linkedinProvider.getAuthorizationURL(state);

      expect(typeof authURL).toBe('string');
      expect(authURL).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(authURL).toContain('client_id=test-client-id');
      expect(authURL).toContain('response_type=code');
      expect(authURL).toContain('scope=r_liteprofile%20r_emailaddress');
      expect(authURL).toContain('state=test-state-parameter');
      expect(authURL).toContain('redirect_uri=http%3A//localhost%3A3000/callback');
    });

    test('should include additional options in URL', async () => {
      const state = 'test-state';
      const options = { prompt: 'consent' };
      const authURL = await linkedinProvider.getAuthorizationURL(state, options);

      expect(authURL).toContain('prompt=consent');
    });

    test('should handle URL generation errors', async () => {
      // Mock a scenario where URL generation fails
      const originalClientId = linkedinProvider.config.clientId;
      linkedinProvider.config.clientId = undefined;

      await expect(linkedinProvider.getAuthorizationURL('state')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.getAuthorizationURL('state')).rejects.toThrow('Failed to build LinkedIn authorization URL');

      // Restore client ID
      linkedinProvider.config.clientId = originalClientId;
    });
  });

  describe('Token Exchange', () => {
    test('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          expires_in: 3600,
          scope: 'r_liteprofile r_emailaddress'
        }
      };

      linkedinProvider.httpClient.post.mockResolvedValueOnce(mockTokenResponse);

      const tokens = await linkedinProvider.handleCallback('test-auth-code', 'test-state');

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBe('test-access-token');
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresIn).toBe(3600);
      expect(tokens.scope).toBe('r_liteprofile r_emailaddress');
      expect(tokens.refreshToken).toBeNull();
      expect(tokens.obtainedAt).toBeDefined();
    });

    test('should make correct token exchange request', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token',
          expires_in: 3600
        }
      };

      linkedinProvider.httpClient.post.mockResolvedValueOnce(mockTokenResponse);

      await linkedinProvider.handleCallback('test-auth-code', 'test-state');

      expect(linkedinProvider.httpClient.post).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/accessToken',
        {
          grant_type: 'authorization_code',
          code: 'test-auth-code',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret-long-enough',
          redirect_uri: 'http://localhost:3000/callback'
        },
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          transformRequest: expect.any(Array)
        })
      );
    });

    test('should handle missing authorization code', async () => {
      await expect(linkedinProvider.handleCallback(null, 'state')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.handleCallback(null, 'state')).rejects.toThrow('Authorization code is required');
      
      await expect(linkedinProvider.handleCallback('', 'state')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.handleCallback(undefined, 'state')).rejects.toThrow(OAuthError);
    });

    test('should handle missing access token in response', async () => {
      const mockTokenResponse = {
        data: {
          // Missing access_token
          expires_in: 3600
        }
      };

      linkedinProvider.httpClient.post.mockResolvedValueOnce(mockTokenResponse);

      await expect(linkedinProvider.handleCallback('code', 'state')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.handleCallback('code', 'state')).rejects.toThrow('No access token received from LinkedIn');
    });

    test('should handle token exchange API errors', async () => {
      const apiError = new Error('LinkedIn API Error');
      linkedinProvider.httpClient.post.mockRejectedValueOnce(apiError);

      await expect(linkedinProvider.handleCallback('code', 'state')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.handleCallback('code', 'state')).rejects.toThrow('Failed to exchange LinkedIn authorization code');
    });

    test('should use default values for missing token properties', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'test-access-token'
          // Missing expires_in and scope
        }
      };

      linkedinProvider.httpClient.post.mockResolvedValueOnce(mockTokenResponse);

      const tokens = await linkedinProvider.handleCallback('code', 'state');

      expect(tokens.expiresIn).toBe(3600); // Default value
      expect(tokens.scope).toBe('r_liteprofile r_emailaddress'); // Default value
    });
  });

  describe('Profile Fetching', () => {
    const mockProfileData = {
      id: 'test-linkedin-id',
      localizedFirstName: 'John',
      localizedLastName: 'Doe',
      localizedHeadline: 'Software Engineer',
      profilePicture: {
        'displayImage~': {
          elements: [{
            identifiers: [{
              identifier: 'https://media.licdn.com/profile-pic.jpg'
            }]
          }]
        }
      }
    };

    const mockEmailData = {
      elements: [{
        'handle~': {
          emailAddress: 'john.doe@example.com'
        }
      }]
    };

    test('should fetch and map LinkedIn profile', async () => {
      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: mockProfileData })  // Profile request
        .mockResolvedValueOnce({ data: mockEmailData });   // Email request

      const profile = await linkedinProvider.getProfile('test-access-token');

      expect(profile).toBeDefined();
      expect(profile.id).toBe('test-linkedin-id');
      expect(profile.email).toBe('john.doe@example.com');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
      expect(profile.fullName).toBe('John Doe');
      expect(profile.headline).toBe('Software Engineer');
      expect(profile.provider).toBe('linkedin');
      expect(profile.providerId).toBe('test-linkedin-id');
      expect(profile.fetchedAt).toBeDefined();
    });

    test('should make correct profile API requests', async () => {
      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: mockProfileData })
        .mockResolvedValueOnce({ data: mockEmailData });

      await linkedinProvider.getProfile('test-access-token');

      expect(linkedinProvider.httpClient.get).toHaveBeenCalledTimes(2);
      
      // Profile request
      expect(linkedinProvider.httpClient.get).toHaveBeenNthCalledWith(1,
        'https://api.linkedin.com/v2/people/~',
        {
          headers: { 'Authorization': 'Bearer test-access-token' },
          params: {
            projection: '(id,localizedFirstName,localizedLastName,localizedHeadline,profilePicture(displayImage~:playableStreams))'
          }
        }
      );

      // Email request
      expect(linkedinProvider.httpClient.get).toHaveBeenNthCalledWith(2,
        'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
        {
          headers: { 'Authorization': 'Bearer test-access-token' }
        }
      );
    });

    test('should handle missing access token', async () => {
      await expect(linkedinProvider.getProfile()).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.getProfile()).rejects.toThrow('Access token is required');
      
      await expect(linkedinProvider.getProfile(null)).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.getProfile('')).rejects.toThrow(OAuthError);
    });

    test('should handle missing email in profile', async () => {
      const mockEmailDataNoEmail = { elements: [] };
      
      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: mockProfileData })
        .mockResolvedValueOnce({ data: mockEmailDataNoEmail });

      await expect(linkedinProvider.getProfile('token')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.getProfile('token')).rejects.toThrow('No email address found in LinkedIn profile');
    });

    test('should handle API errors during profile fetch', async () => {
      const apiError = new Error('LinkedIn API Error');
      linkedinProvider.httpClient.get.mockRejectedValueOnce(apiError);

      await expect(linkedinProvider.getProfile('token')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.getProfile('token')).rejects.toThrow('Failed to fetch LinkedIn profile');
    });

    test('should handle partial profile data', async () => {
      const partialProfileData = {
        id: 'test-id',
        localizedFirstName: 'John'
        // Missing last name and other fields
      };

      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: partialProfileData })
        .mockResolvedValueOnce({ data: mockEmailData });

      const profile = await linkedinProvider.getProfile('test-access-token');

      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('');
      expect(profile.fullName).toBe('John');
      expect(profile.headline).toBe('');
      expect(profile.profilePicture).toBeNull();
    });

    test('should extract profile picture correctly', async () => {
      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: mockProfileData })
        .mockResolvedValueOnce({ data: mockEmailData });

      const profile = await linkedinProvider.getProfile('test-access-token');

      expect(profile.profilePicture).toBe('https://media.licdn.com/profile-pic.jpg');
    });

    test('should handle missing profile picture gracefully', async () => {
      const profileDataNoPicture = {
        ...mockProfileData,
        profilePicture: undefined
      };

      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: profileDataNoPicture })
        .mockResolvedValueOnce({ data: mockEmailData });

      const profile = await linkedinProvider.getProfile('test-access-token');

      expect(profile.profilePicture).toBeNull();
    });

    test('should include raw data for debugging', async () => {
      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: mockProfileData })
        .mockResolvedValueOnce({ data: mockEmailData });

      const profile = await linkedinProvider.getProfile('test-access-token');

      expect(profile.raw).toBeDefined();
      expect(profile.raw.id).toBe('test-linkedin-id');
      expect(profile.raw.localizedFirstName).toBe('John');
      expect(profile.raw.localizedLastName).toBe('Doe');
    });

    test('should validate profile has required fields', async () => {
      const invalidProfileData = {
        // Missing id
        localizedFirstName: 'John',
        localizedLastName: 'Doe'
      };

      linkedinProvider.httpClient.get
        .mockResolvedValueOnce({ data: invalidProfileData })
        .mockResolvedValueOnce({ data: mockEmailData });

      await expect(linkedinProvider.getProfile('token')).rejects.toThrow(OAuthError);
      await expect(linkedinProvider.getProfile('token')).rejects.toThrow('LinkedIn profile ID is missing');
    });
  });

  describe('Token Validation', () => {
    test('should validate valid token', async () => {
      linkedinProvider.httpClient.get.mockResolvedValueOnce({
        data: { id: 'test-id' }
      });

      const result = await linkedinProvider.validateToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should handle missing token', async () => {
      const result = await linkedinProvider.validateToken();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Access token is required');
    });

    test('should handle invalid token', async () => {
      const apiError = new Error('Unauthorized');
      apiError.response = { status: 401 };
      linkedinProvider.httpClient.get.mockRejectedValueOnce(apiError);

      const result = await linkedinProvider.validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.expired).toBe(true);
    });

    test('should handle other API errors', async () => {
      const apiError = new Error('Server Error');
      apiError.response = { status: 500 };
      linkedinProvider.httpClient.get.mockRejectedValueOnce(apiError);

      const result = await linkedinProvider.validateToken('token');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.expired).toBe(false);
    });
  });

  describe('Additional Profile Data', () => {
    test('should handle additional profile requests', async () => {
      const additionalData = await linkedinProvider.getAdditionalProfile('token', ['skills']);

      expect(additionalData).toBeDefined();
      expect(additionalData.skills).toBeNull(); // Placeholder implementation
    });

    test('should handle empty fields array', async () => {
      const additionalData = await linkedinProvider.getAdditionalProfile('token', []);

      expect(additionalData).toBeDefined();
      expect(Object.keys(additionalData)).toHaveLength(0);
    });

    test('should handle additional profile errors', async () => {
      // Mock an error scenario
      jest.spyOn(linkedinProvider, 'getAdditionalProfile').mockRejectedValueOnce(new Error('API Error'));

      await expect(linkedinProvider.getAdditionalProfile('token', ['skills'])).rejects.toThrow(OAuthError);
    });
  });

  describe('Provider Information', () => {
    test('should return provider information', () => {
      const providerInfo = linkedinProvider.getProviderInfo();

      expect(providerInfo).toBeDefined();
      expect(providerInfo.name).toBe('linkedin');
      expect(providerInfo.displayName).toBe('LinkedIn');
      expect(providerInfo.description).toBe('Connect with your LinkedIn profile');
      expect(providerInfo.icon).toBe('linkedin');
      expect(providerInfo.color).toBe('#0077B5');
      expect(Array.isArray(providerInfo.scopes)).toBe(true);
      expect(providerInfo.scopes).toContain('r_liteprofile');
      expect(providerInfo.scopes).toContain('r_emailaddress');
      expect(typeof providerInfo.enabled).toBe('boolean');
    });
  });

  describe('Profile Picture Extraction', () => {
    test('should extract profile picture from complex structure', () => {
      const profilePicture = {
        'displayImage~': {
          elements: [
            {
              identifiers: [{
                identifier: 'https://media.licdn.com/profile-pic-large.jpg'
              }],
              data: {
                'com.linkedin.digitalmedia.mediaartifact.StillImage': {
                  storageSize: { width: 400, height: 400 }
                }
              }
            },
            {
              identifiers: [{
                identifier: 'https://media.licdn.com/profile-pic-small.jpg'
              }],
              data: {
                'com.linkedin.digitalmedia.mediaartifact.StillImage': {
                  storageSize: { width: 200, height: 200 }
                }
              }
            }
          ]
        }
      };

      const pictureUrl = linkedinProvider.extractProfilePicture(profilePicture);

      // Should return the largest image
      expect(pictureUrl).toBe('https://media.licdn.com/profile-pic-large.jpg');
    });

    test('should handle malformed profile picture data', () => {
      const malformedPicture = {
        'displayImage~': {
          elements: []
        }
      };

      const pictureUrl = linkedinProvider.extractProfilePicture(malformedPicture);

      expect(pictureUrl).toBeNull();
    });

    test('should handle missing profile picture', () => {
      const pictureUrl = linkedinProvider.extractProfilePicture(null);

      expect(pictureUrl).toBeNull();
    });

    test('should handle profile picture extraction errors gracefully', () => {
      const corruptPicture = {
        'displayImage~': {
          elements: [{ /* missing identifiers */ }]
        }
      };

      // Should not throw, just return null and log warning
      const pictureUrl = linkedinProvider.extractProfilePicture(corruptPicture);

      expect(pictureUrl).toBeNull();
    });
  });
});