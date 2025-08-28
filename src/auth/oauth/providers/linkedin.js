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
   * Get comprehensive LinkedIn profile data including work experience, education, and skills
   * @param {string} accessToken - LinkedIn access token
   * @param {Array} fields - Additional fields to fetch
   * @returns {Object} Comprehensive profile data
   */
  async getComprehensiveProfile(accessToken, fields = []) {
    try {
      if (!accessToken) {
        throw new OAuthError('Access token is required', 'MISSING_ACCESS_TOKEN', 'linkedin');
      }

      const comprehensiveData = {};

      // Fetch work positions
      if (fields.includes('positions') && this.config.settings.features.positionsImport) {
        comprehensiveData.positions = await this.fetchPositions(accessToken);
      }

      // Fetch education
      if (fields.includes('education') && this.config.settings.features.educationImport) {
        comprehensiveData.education = await this.fetchEducation(accessToken);
      }

      // Fetch skills
      if (fields.includes('skills') && this.config.settings.features.skillsImport) {
        comprehensiveData.skills = await this.fetchSkills(accessToken);
      }

      return comprehensiveData;

    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        `Failed to fetch comprehensive LinkedIn profile data: ${error.message}`,
        'COMPREHENSIVE_PROFILE_FAILED',
        'linkedin'
      );
    }
  }

  /**
   * Fetch work positions from LinkedIn
   * @param {string} accessToken - LinkedIn access token
   * @returns {Array} Array of position objects
   */
  async fetchPositions(accessToken) {
    try {
      const response = await this.httpClient.get(`${this.config.profileURL}?projection=(positions)`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const positions = response.data.positions?.elements || [];
      return positions.map(position => this.mapPosition(position));

    } catch (error) {
      console.warn('Failed to fetch LinkedIn positions:', error.message);
      return []; // Return empty array on failure
    }
  }

  /**
   * Fetch education from LinkedIn
   * @param {string} accessToken - LinkedIn access token
   * @returns {Array} Array of education objects
   */
  async fetchEducation(accessToken) {
    try {
      const response = await this.httpClient.get(`${this.config.profileURL}?projection=(educations)`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const education = response.data.educations?.elements || [];
      return education.map(edu => this.mapEducation(edu));

    } catch (error) {
      console.warn('Failed to fetch LinkedIn education:', error.message);
      return []; // Return empty array on failure
    }
  }

  /**
   * Fetch skills from LinkedIn
   * @param {string} accessToken - LinkedIn access token
   * @returns {Array} Array of skill objects
   */
  async fetchSkills(accessToken) {
    try {
      const response = await this.httpClient.get(`${this.config.profileURL}?projection=(skills)`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const skills = response.data.skills?.elements || [];
      return skills.map(skill => this.mapSkill(skill));

    } catch (error) {
      console.warn('Failed to fetch LinkedIn skills:', error.message);
      return []; // Return empty array on failure
    }
  }

  /**
   * Map LinkedIn position data to our format
   * @param {Object} position - LinkedIn position data
   * @returns {Object} Mapped position object
   */
  mapPosition(position) {
    return {
      id: position.id || null,
      title: position.title || '',
      companyName: position.companyName || '',
      companyId: position.company || null,
      description: position.description || '',
      startDate: this.mapLinkedInDate(position.startDate),
      endDate: this.mapLinkedInDate(position.endDate),
      isCurrent: !position.endDate,
      location: position.location?.localizedName || '',
      skills: position.skills || [],
      raw: position // Store raw data for future use
    };
  }

  /**
   * Map LinkedIn education data to our format
   * @param {Object} education - LinkedIn education data
   * @returns {Object} Mapped education object
   */
  mapEducation(education) {
    return {
      id: education.id || null,
      school: education.schoolName || '',
      degree: education.degreeName || '',
      fieldOfStudy: education.fieldOfStudy || '',
      description: education.description || '',
      startDate: this.mapLinkedInDate(education.startDate),
      endDate: this.mapLinkedInDate(education.endDate),
      activities: education.activities || '',
      raw: education // Store raw data for future use
    };
  }

  /**
   * Map LinkedIn skill data to our format
   * @param {Object} skill - LinkedIn skill data
   * @returns {Object} Mapped skill object
   */
  mapSkill(skill) {
    return {
      id: skill.id || null,
      name: skill.localizedSkillDisplayName || skill.name || '',
      endorsements: skill.endorsements?.paging?.total || 0,
      proficiencyLevel: this.mapSkillProficiency(skill.endorsements?.paging?.total),
      raw: skill // Store raw data for future use
    };
  }

  /**
   * Map LinkedIn date format to ISO date string
   * @param {Object} linkedInDate - LinkedIn date object
   * @returns {string|null} ISO date string or null
   */
  mapLinkedInDate(linkedInDate) {
    if (!linkedInDate) return null;
    
    try {
      const year = linkedInDate.year;
      const month = linkedInDate.month || 1;
      const day = linkedInDate.day || 1;
      
      if (!year) return null;
      
      return new Date(year, month - 1, day).toISOString();
    } catch (error) {
      console.warn('Failed to map LinkedIn date:', error.message);
      return null;
    }
  }

  /**
   * Map skill endorsement count to proficiency level
   * @param {number} endorsements - Number of endorsements
   * @returns {string} Proficiency level
   */
  mapSkillProficiency(endorsements = 0) {
    if (endorsements >= 50) return 'expert';
    if (endorsements >= 20) return 'advanced';
    if (endorsements >= 5) return 'intermediate';
    return 'beginner';
  }

  /**
   * Get additional user information (maintained for backward compatibility)
   * @param {string} accessToken - LinkedIn access token
   * @param {Array} fields - Additional fields to fetch
   * @returns {Object} Additional profile data
   */
  async getAdditionalProfile(accessToken, fields = []) {
    return await this.getComprehensiveProfile(accessToken, fields);
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