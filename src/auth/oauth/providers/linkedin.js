/**
 * LinkedIn OAuth Provider
 * Implements LinkedIn OAuth 2.0 flow for profile data import
 */

const axios = require('axios');
const oauthConfig = require('../../../config/oauth');
const { OAuthError } = require('../index');

class LinkedInProvider {
  constructor() {
    this.config = oauthConfig.getProviderConfig('linkedin');
    
    if (!this.config) {
      throw new OAuthError('LinkedIn provider not configured', 'PROVIDER_NOT_CONFIGURED', 'linkedin');
    }

    // Set up axios instance for LinkedIn API calls
    this.httpClient = axios.create({
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'LegacyLancers/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          // LinkedIn API returned an error response
          const { status, data } = error.response;
          throw new OAuthError(
            `LinkedIn API error: ${data.message || error.message}`,
            'LINKEDIN_API_ERROR',
            'linkedin'
          );
        } else if (error.request) {
          // Network error
          throw new OAuthError(
            'Failed to connect to LinkedIn API',
            'LINKEDIN_NETWORK_ERROR',
            'linkedin'
          );
        } else {
          throw error;
        }
      }
    );
  }

  /**
   * Get LinkedIn OAuth authorization URL
   * @param {string} state - OAuth state parameter
   * @param {Object} options - Additional OAuth options
   * @returns {string} Authorization URL
   */
  async getAuthorizationURL(state, options = {}) {
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        response_type: this.config.responseType,
        scope: this.config.scope,
        state: state,
        redirect_uri: this.config.callbackURL,
        ...options
      });

      const authURL = `${this.config.authorizationURL}?${params.toString()}`;
      
      return authURL;

    } catch (error) {
      throw new OAuthError(
        `Failed to build LinkedIn authorization URL: ${error.message}`,
        'AUTH_URL_FAILED',
        'linkedin'
      );
    }
  }

  /**
   * Handle LinkedIn OAuth callback and exchange code for tokens
   * @param {string} code - Authorization code from LinkedIn
   * @param {string} state - OAuth state parameter
   * @returns {Object} Access tokens
   */
  async handleCallback(code, state) {
    try {
      if (!code) {
        throw new OAuthError('Authorization code is required', 'MISSING_CODE', 'linkedin');
      }

      // Exchange authorization code for access token
      const tokenResponse = await this.httpClient.post(this.config.tokenURL, {
        grant_type: 'authorization_code',
        code: code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackURL
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        transformRequest: [(data) => {
          // Convert object to URL-encoded format
          return Object.keys(data)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
            .join('&');
        }]
      });

      const { access_token, expires_in, scope } = tokenResponse.data;

      if (!access_token) {
        throw new OAuthError('No access token received from LinkedIn', 'TOKEN_MISSING', 'linkedin');
      }

      return {
        accessToken: access_token,
        tokenType: 'Bearer',
        expiresIn: expires_in || 3600,
        scope: scope || this.config.scope,
        refreshToken: null, // LinkedIn doesn't provide refresh tokens in basic flow
        obtainedAt: new Date().toISOString()
      };

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      
      throw new OAuthError(
        `Failed to exchange LinkedIn authorization code: ${error.message}`,
        'TOKEN_EXCHANGE_FAILED',
        'linkedin'
      );
    }
  }

  /**
   * Get user profile from LinkedIn using access token
   * @param {string} accessToken - LinkedIn access token
   * @returns {Object} User profile data
   */
  async getProfile(accessToken) {
    try {
      if (!accessToken) {
        throw new OAuthError('Access token is required', 'MISSING_ACCESS_TOKEN', 'linkedin');
      }

      // Get basic profile information
      const profileResponse = await this.httpClient.get(this.config.profileURL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          // Request specific fields for better performance
          projection: '(id,localizedFirstName,localizedLastName,localizedHeadline,profilePicture(displayImage~:playableStreams))'
        }
      });

      const profileData = profileResponse.data;

      // Get email address (separate endpoint)
      const emailResponse = await this.httpClient.get(this.config.emailURL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const emailData = emailResponse.data;
      const primaryEmail = emailData.elements?.[0]?.['handle~']?.emailAddress;

      if (!primaryEmail) {
        throw new OAuthError('No email address found in LinkedIn profile', 'EMAIL_NOT_FOUND', 'linkedin');
      }

      // Map LinkedIn profile to our standard format
      const profile = this.mapProfile(profileData, primaryEmail);
      
      return profile;

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }

      throw new OAuthError(
        `Failed to fetch LinkedIn profile: ${error.message}`,
        'PROFILE_FETCH_FAILED',
        'linkedin'
      );
    }
  }

  /**
   * Map LinkedIn profile data to standard profile format
   * @param {Object} linkedinProfile - Raw LinkedIn profile data
   * @param {string} email - User email address
   * @returns {Object} Mapped profile data
   */
  mapProfile(linkedinProfile, email) {
    try {
      const profile = {
        // Standard fields
        id: linkedinProfile.id,
        email: email,
        firstName: linkedinProfile.localizedFirstName || '',
        lastName: linkedinProfile.localizedLastName || '',
        fullName: `${linkedinProfile.localizedFirstName || ''} ${linkedinProfile.localizedLastName || ''}`.trim(),
        
        // LinkedIn specific fields
        headline: linkedinProfile.localizedHeadline || '',
        profilePicture: this.extractProfilePicture(linkedinProfile.profilePicture),
        
        // Provider metadata
        provider: 'linkedin',
        providerId: linkedinProfile.id,
        providerURL: `https://linkedin.com/in/${linkedinProfile.id}`,
        
        // Data freshness
        fetchedAt: new Date().toISOString(),
        
        // Additional data that might be useful
        raw: {
          // Store relevant raw data for debugging/future use
          id: linkedinProfile.id,
          localizedFirstName: linkedinProfile.localizedFirstName,
          localizedLastName: linkedinProfile.localizedLastName,
          localizedHeadline: linkedinProfile.localizedHeadline
        }
      };

      // Validate required fields
      if (!profile.id) {
        throw new OAuthError('LinkedIn profile ID is missing', 'INVALID_PROFILE', 'linkedin');
      }

      if (!profile.email) {
        throw new OAuthError('LinkedIn profile email is missing', 'INVALID_PROFILE', 'linkedin');
      }

      return profile;

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }

      throw new OAuthError(
        `Failed to map LinkedIn profile: ${error.message}`,
        'PROFILE_MAPPING_FAILED',
        'linkedin'
      );
    }
  }

  /**
   * Extract profile picture URL from LinkedIn profile data
   * @param {Object} profilePicture - LinkedIn profile picture data
   * @returns {string|null} Profile picture URL or null
   */
  extractProfilePicture(profilePicture) {
    try {
      if (!profilePicture || !profilePicture['displayImage~']) {
        return null;
      }

      const displayImage = profilePicture['displayImage~'];
      
      if (!displayImage.elements || displayImage.elements.length === 0) {
        return null;
      }

      // Get the largest available image
      const images = displayImage.elements
        .filter(element => element.identifiers && element.identifiers.length > 0)
        .sort((a, b) => (b.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageSize?.width || 0) - 
                        (a.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.storageSize?.width || 0));

      if (images.length > 0 && images[0].identifiers[0]) {
        return images[0].identifiers[0].identifier;
      }

      return null;

    } catch (error) {
      // Don't fail the entire process if profile picture extraction fails
      console.warn('Failed to extract LinkedIn profile picture:', error.message);
      return null;
    }
  }

  /**
   * Validate LinkedIn access token
   * @param {string} accessToken - Access token to validate
   * @returns {Object} Token validation result
   */
  async validateToken(accessToken) {
    try {
      if (!accessToken) {
        return { valid: false, error: 'Access token is required' };
      }

      // Make a simple API call to validate the token
      await this.httpClient.get(this.config.profileURL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          projection: '(id)'
        }
      });

      return { valid: true };

    } catch (error) {
      return { 
        valid: false, 
        error: error.message,
        expired: error.response?.status === 401
      };
    }
  }

  /**
   * Get additional user information (future expansion)
   * @param {string} accessToken - LinkedIn access token
   * @param {Array} fields - Additional fields to fetch
   * @returns {Object} Additional profile data
   */
  async getAdditionalProfile(accessToken, fields = []) {
    try {
      // This method can be expanded to fetch additional LinkedIn data
      // such as skills, positions, education, etc. when needed
      
      const additionalData = {};

      // Example: Fetch skills (requires different API permissions)
      if (fields.includes('skills')) {
        // This would require additional LinkedIn API permissions
        // additionalData.skills = await this.fetchSkills(accessToken);
        additionalData.skills = null; // Placeholder
      }

      return additionalData;

    } catch (error) {
      throw new OAuthError(
        `Failed to fetch additional LinkedIn profile data: ${error.message}`,
        'ADDITIONAL_PROFILE_FAILED',
        'linkedin'
      );
    }
  }

  /**
   * Get provider information
   * @returns {Object} Provider information
   */
  getProviderInfo() {
    return {
      name: 'linkedin',
      displayName: 'LinkedIn',
      description: 'Connect with your LinkedIn profile',
      icon: 'linkedin',
      color: '#0077B5',
      features: this.config.settings.features,
      scopes: this.config.scope.split(' '),
      enabled: this.config.settings.enabled
    };
  }
}

module.exports = LinkedInProvider;