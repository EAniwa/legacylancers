/**
 * Profile Model
 * Handles profile database operations and business logic for retiree profiles
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const crypto = require('crypto');

class ProfileError extends Error {
  constructor(message, code = 'PROFILE_ERROR') {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
  }
}

/**
 * Profile Model Class
 * For now, using in-memory storage. In production, this would connect to PostgreSQL
 */
class Profile {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be replaced with database connection
    this.profiles = new Map();
    
    // Valid enum values
    this.AVAILABILITY_STATUSES = ['available', 'busy', 'unavailable', 'retired'];
    this.VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'];
    this.BACKGROUND_CHECK_STATUSES = ['not_required', 'pending', 'completed', 'failed'];
    this.ENGAGEMENT_TYPES = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
    this.CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  }

  /**
   * Create a new profile
   * @param {string} userId - User ID who owns the profile
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object>} Created profile object
   */
  async create(userId, profileData) {
    try {
      if (!userId) {
        throw new ProfileError('User ID is required', 'MISSING_USER_ID');
      }

      // Check if user already has a profile
      const existingProfile = await this.findByUserId(userId);
      if (existingProfile) {
        throw new ProfileError('User already has a profile', 'PROFILE_EXISTS');
      }

      // Validate and sanitize profile data
      const validatedData = await this.validateProfileData(profileData);

      // Create profile object
      const profileId = uuidv4();
      const now = new Date();

      // Generate profile slug
      const slug = this.generateSlug(validatedData.displayName || `profile-${profileId}`);

      const profile = {
        id: profileId,
        userId,
        
        // Profile Display Information
        displayName: validatedData.displayName || null,
        headline: validatedData.headline || null,
        bio: validatedData.bio || null,
        profilePhotoUrl: validatedData.profilePhotoUrl || null,
        coverPhotoUrl: validatedData.coverPhotoUrl || null,
        
        // Professional Details
        yearsOfExperience: validatedData.yearsOfExperience || null,
        industry: validatedData.industry || null,
        previousCompany: validatedData.previousCompany || null,
        previousTitle: validatedData.previousTitle || null,
        linkedinUrl: validatedData.linkedinUrl || null,
        portfolioUrl: validatedData.portfolioUrl || null,
        resumeUrl: validatedData.resumeUrl || null,
        
        // Availability & Engagement Preferences
        availabilityStatus: validatedData.availabilityStatus || 'available',
        timezone: validatedData.timezone || null,
        engagementTypes: validatedData.engagementTypes || [],
        
        // Rates and Pricing
        hourlyRateMin: validatedData.hourlyRateMin || null,
        hourlyRateMax: validatedData.hourlyRateMax || null,
        projectRateMin: validatedData.projectRateMin || null,
        projectRateMax: validatedData.projectRateMax || null,
        keynoteRate: validatedData.keynoteRate || null,
        mentoringRate: validatedData.mentoringRate || null,
        currency: validatedData.currency || 'USD',
        
        // Verification and Trust
        profileCompletenessScore: 0, // Will be calculated
        verificationStatus: 'unverified',
        linkedinVerified: false,
        backgroundCheckStatus: 'not_required',
        
        // Public Profile Settings
        isProfilePublic: validatedData.isProfilePublic || false,
        profileSlug: slug,
        showHourlyRates: validatedData.showHourlyRates !== false, // Default true
        showProjectRates: validatedData.showProjectRates !== false, // Default true
        
        // Search and Discovery
        searchable: validatedData.searchable !== false, // Default true
        featured: false, // Only admins can set this
        
        // Statistics
        totalEngagements: 0,
        totalRevenue: 0.00,
        averageRating: null,
        totalReviews: 0,
        
        // GDPR and Privacy
        dataSharingConsent: validatedData.dataSharingConsent || false,
        publicProfileConsent: validatedData.publicProfileConsent || false,
        
        // Audit fields
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };

      // Calculate completeness score
      profile.profileCompletenessScore = this.calculateCompletenessScore(profile);

      // Store profile
      this.profiles.set(profileId, profile);

      return profile;

    } catch (error) {
      if (error instanceof ProfileError) {
        throw error;
      }
      throw new ProfileError(`Failed to create profile: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Find profile by ID
   * @param {string} profileId - Profile ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Profile object or null
   */
  async findById(profileId, options = {}) {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile || profile.deletedAt) {
        return null;
      }

      return this.applyPrivacyFilters(profile, options);

    } catch (error) {
      throw new ProfileError(`Failed to find profile by ID: ${error.message}`, 'FIND_BY_ID_FAILED');
    }
  }

  /**
   * Find profile by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Profile object or null
   */
  async findByUserId(userId, options = {}) {
    try {
      for (const profile of this.profiles.values()) {
        if (profile.userId === userId && !profile.deletedAt) {
          return this.applyPrivacyFilters(profile, options);
        }
      }
      return null;

    } catch (error) {
      throw new ProfileError(`Failed to find profile by user ID: ${error.message}`, 'FIND_BY_USER_ID_FAILED');
    }
  }

  /**
   * Find profile by slug
   * @param {string} slug - Profile slug
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Profile object or null
   */
  async findBySlug(slug, options = {}) {
    try {
      for (const profile of this.profiles.values()) {
        if (profile.profileSlug === slug && !profile.deletedAt) {
          return this.applyPrivacyFilters(profile, options);
        }
      }
      return null;

    } catch (error) {
      throw new ProfileError(`Failed to find profile by slug: ${error.message}`, 'FIND_BY_SLUG_FAILED');
    }
  }

  /**
   * Update profile
   * @param {string} profileId - Profile ID
   * @param {Object} updateData - Fields to update
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated profile object
   */
  async update(profileId, updateData, options = {}) {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile || profile.deletedAt) {
        throw new ProfileError('Profile not found', 'PROFILE_NOT_FOUND');
      }

      // Validate and sanitize update data
      const validatedData = await this.validateProfileData(updateData, true);

      // Apply updates
      const updatedProfile = {
        ...profile,
        ...validatedData,
        updatedAt: new Date()
      };

      // Regenerate slug if display name changed
      if (validatedData.displayName && validatedData.displayName !== profile.displayName) {
        updatedProfile.profileSlug = this.generateSlug(validatedData.displayName, profileId);
      }

      // Recalculate completeness score
      updatedProfile.profileCompletenessScore = this.calculateCompletenessScore(updatedProfile);

      // Store updated profile
      this.profiles.set(profileId, updatedProfile);

      return this.applyPrivacyFilters(updatedProfile, options);

    } catch (error) {
      if (error instanceof ProfileError) {
        throw error;
      }
      throw new ProfileError(`Failed to update profile: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Delete profile (soft delete)
   * @param {string} profileId - Profile ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(profileId) {
    try {
      const profile = this.profiles.get(profileId);
      if (!profile || profile.deletedAt) {
        throw new ProfileError('Profile not found', 'PROFILE_NOT_FOUND');
      }

      // Soft delete
      const updatedProfile = {
        ...profile,
        deletedAt: new Date(),
        updatedAt: new Date()
      };

      this.profiles.set(profileId, updatedProfile);
      return true;

    } catch (error) {
      if (error instanceof ProfileError) {
        throw error;
      }
      throw new ProfileError(`Failed to delete profile: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Search profiles
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with pagination
   */
  async search(criteria = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'createdAt',
        order = 'desc',
        includePrivate = false
      } = options;

      let results = Array.from(this.profiles.values())
        .filter(profile => !profile.deletedAt);

      // Apply search criteria
      if (criteria.industry) {
        results = results.filter(p => 
          p.industry && p.industry.toLowerCase().includes(criteria.industry.toLowerCase())
        );
      }

      if (criteria.availabilityStatus) {
        results = results.filter(p => p.availabilityStatus === criteria.availabilityStatus);
      }

      if (criteria.engagementTypes && criteria.engagementTypes.length > 0) {
        results = results.filter(p => 
          p.engagementTypes.some(type => criteria.engagementTypes.includes(type))
        );
      }

      if (criteria.minExperience) {
        results = results.filter(p => 
          p.yearsOfExperience && p.yearsOfExperience >= criteria.minExperience
        );
      }

      if (criteria.maxHourlyRate) {
        results = results.filter(p => 
          p.hourlyRateMin && p.hourlyRateMin <= criteria.maxHourlyRate
        );
      }

      if (criteria.verified) {
        results = results.filter(p => p.verificationStatus === 'verified');
      }

      if (criteria.searchable !== false) {
        results = results.filter(p => p.searchable);
      }

      // Apply privacy filters unless explicitly including private
      if (!includePrivate) {
        results = results.filter(p => p.isProfilePublic);
      }

      // Apply sorting
      results.sort((a, b) => {
        const aVal = a[sort];
        const bVal = b[sort];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string') {
          return order === 'desc' 
            ? bVal.localeCompare(aVal)
            : aVal.localeCompare(bVal);
        }
        
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      });

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = results.slice(startIndex, endIndex);

      // Apply privacy filters to results
      const filteredResults = paginatedResults.map(profile => 
        this.applyPrivacyFilters(profile, options)
      );

      return {
        profiles: filteredResults,
        pagination: {
          page,
          limit,
          total: results.length,
          pages: Math.ceil(results.length / limit),
          hasNext: endIndex < results.length,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      throw new ProfileError(`Failed to search profiles: ${error.message}`, 'SEARCH_FAILED');
    }
  }

  /**
   * Validate profile data
   * @param {Object} data - Profile data to validate
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Promise<Object>} Validated and sanitized data
   */
  async validateProfileData(data, isUpdate = false) {
    const validated = {};

    // Display Name
    if (data.displayName !== undefined) {
      if (data.displayName !== null) {
        if (!validator.isLength(data.displayName, { min: 1, max: 150 })) {
          throw new ProfileError('Display name must be between 1 and 150 characters', 'INVALID_DISPLAY_NAME');
        }
        validated.displayName = validator.escape(validator.trim(data.displayName));
      } else {
        validated.displayName = null;
      }
    }

    // Headline
    if (data.headline !== undefined) {
      if (data.headline !== null) {
        if (!validator.isLength(data.headline, { min: 1, max: 200 })) {
          throw new ProfileError('Headline must be between 1 and 200 characters', 'INVALID_HEADLINE');
        }
        validated.headline = validator.escape(validator.trim(data.headline));
      } else {
        validated.headline = null;
      }
    }

    // Bio
    if (data.bio !== undefined) {
      if (data.bio !== null) {
        if (!validator.isLength(data.bio, { min: 1, max: 5000 })) {
          throw new ProfileError('Bio must be between 1 and 5000 characters', 'INVALID_BIO');
        }
        validated.bio = validator.escape(validator.trim(data.bio));
      } else {
        validated.bio = null;
      }
    }

    // URLs
    const urlFields = ['profilePhotoUrl', 'coverPhotoUrl', 'linkedinUrl', 'portfolioUrl', 'resumeUrl'];
    for (const field of urlFields) {
      if (data[field] !== undefined) {
        if (data[field] !== null) {
          if (!validator.isURL(data[field], { require_protocol: true, protocols: ['http', 'https'] })) {
            throw new ProfileError(`Invalid ${field} format`, `INVALID_${field.toUpperCase()}`);
          }
          validated[field] = data[field];
        } else {
          validated[field] = null;
        }
      }
    }

    // Years of Experience
    if (data.yearsOfExperience !== undefined) {
      if (data.yearsOfExperience !== null) {
        const years = parseInt(data.yearsOfExperience);
        if (isNaN(years) || years < 0 || years > 70) {
          throw new ProfileError('Years of experience must be between 0 and 70', 'INVALID_YEARS_EXPERIENCE');
        }
        validated.yearsOfExperience = years;
      } else {
        validated.yearsOfExperience = null;
      }
    }

    // Industry and Professional Fields
    const textFields = ['industry', 'previousCompany', 'previousTitle'];
    for (const field of textFields) {
      if (data[field] !== undefined) {
        if (data[field] !== null) {
          if (!validator.isLength(data[field], { min: 1, max: 200 })) {
            throw new ProfileError(`${field} must be between 1 and 200 characters`, `INVALID_${field.toUpperCase()}`);
          }
          validated[field] = validator.escape(validator.trim(data[field]));
        } else {
          validated[field] = null;
        }
      }
    }

    // Availability Status
    if (data.availabilityStatus !== undefined) {
      if (!this.AVAILABILITY_STATUSES.includes(data.availabilityStatus)) {
        throw new ProfileError(`Invalid availability status. Must be one of: ${this.AVAILABILITY_STATUSES.join(', ')}`, 'INVALID_AVAILABILITY_STATUS');
      }
      validated.availabilityStatus = data.availabilityStatus;
    }

    // Timezone
    if (data.timezone !== undefined) {
      if (data.timezone !== null) {
        if (!validator.isLength(data.timezone, { min: 1, max: 50 })) {
          throw new ProfileError('Timezone must be between 1 and 50 characters', 'INVALID_TIMEZONE');
        }
        validated.timezone = data.timezone;
      } else {
        validated.timezone = null;
      }
    }

    // Engagement Types
    if (data.engagementTypes !== undefined) {
      if (!Array.isArray(data.engagementTypes)) {
        throw new ProfileError('Engagement types must be an array', 'INVALID_ENGAGEMENT_TYPES');
      }
      
      for (const type of data.engagementTypes) {
        if (!this.ENGAGEMENT_TYPES.includes(type)) {
          throw new ProfileError(`Invalid engagement type: ${type}. Must be one of: ${this.ENGAGEMENT_TYPES.join(', ')}`, 'INVALID_ENGAGEMENT_TYPE');
        }
      }
      validated.engagementTypes = [...new Set(data.engagementTypes)]; // Remove duplicates
    }

    // Rates
    const rateFields = ['hourlyRateMin', 'hourlyRateMax', 'projectRateMin', 'projectRateMax', 'keynoteRate', 'mentoringRate'];
    for (const field of rateFields) {
      if (data[field] !== undefined) {
        if (data[field] !== null) {
          const rate = parseFloat(data[field]);
          if (isNaN(rate) || rate < 0 || rate > 999999.99) {
            throw new ProfileError(`${field} must be a valid positive number less than 999999.99`, `INVALID_${field.toUpperCase()}`);
          }
          validated[field] = parseFloat(rate.toFixed(2));
        } else {
          validated[field] = null;
        }
      }
    }

    // Validate rate ranges
    if (validated.hourlyRateMin !== undefined && validated.hourlyRateMax !== undefined) {
      if (validated.hourlyRateMin && validated.hourlyRateMax && validated.hourlyRateMin > validated.hourlyRateMax) {
        throw new ProfileError('Minimum hourly rate cannot be greater than maximum hourly rate', 'INVALID_HOURLY_RATE_RANGE');
      }
    }

    if (validated.projectRateMin !== undefined && validated.projectRateMax !== undefined) {
      if (validated.projectRateMin && validated.projectRateMax && validated.projectRateMin > validated.projectRateMax) {
        throw new ProfileError('Minimum project rate cannot be greater than maximum project rate', 'INVALID_PROJECT_RATE_RANGE');
      }
    }

    // Currency
    if (data.currency !== undefined) {
      if (!this.CURRENCIES.includes(data.currency)) {
        throw new ProfileError(`Invalid currency. Must be one of: ${this.CURRENCIES.join(', ')}`, 'INVALID_CURRENCY');
      }
      validated.currency = data.currency;
    }

    // Boolean fields
    const booleanFields = [
      'isProfilePublic', 'showHourlyRates', 'showProjectRates', 'searchable',
      'dataSharingConsent', 'publicProfileConsent', 'linkedinVerified'
    ];
    for (const field of booleanFields) {
      if (data[field] !== undefined) {
        validated[field] = Boolean(data[field]);
      }
    }

    // Verification Status (admin only update)
    if (data.verificationStatus !== undefined) {
      if (!this.VERIFICATION_STATUSES.includes(data.verificationStatus)) {
        throw new ProfileError(`Invalid verification status. Must be one of: ${this.VERIFICATION_STATUSES.join(', ')}`, 'INVALID_VERIFICATION_STATUS');
      }
      validated.verificationStatus = data.verificationStatus;
    }

    // Background Check Status (admin only update)
    if (data.backgroundCheckStatus !== undefined) {
      if (!this.BACKGROUND_CHECK_STATUSES.includes(data.backgroundCheckStatus)) {
        throw new ProfileError(`Invalid background check status. Must be one of: ${this.BACKGROUND_CHECK_STATUSES.join(', ')}`, 'INVALID_BACKGROUND_CHECK_STATUS');
      }
      validated.backgroundCheckStatus = data.backgroundCheckStatus;
    }

    return validated;
  }

  /**
   * Apply privacy filters to profile data
   * @param {Object} profile - Profile object
   * @param {Object} options - Filter options
   * @returns {Object} Filtered profile object
   */
  applyPrivacyFilters(profile, options = {}) {
    const { isOwner = false, isAdmin = false, isPublicView = false } = options;

    // If user is owner or admin, return full profile
    if (isOwner || isAdmin) {
      return { ...profile };
    }

    // For public view, apply privacy settings
    if (isPublicView || !profile.isProfilePublic) {
      // Only show limited information for private profiles
      const publicProfile = {
        id: profile.id,
        userId: profile.userId,
        displayName: profile.displayName,
        headline: profile.headline,
        profilePhotoUrl: profile.profilePhotoUrl,
        industry: profile.industry,
        yearsOfExperience: profile.yearsOfExperience,
        availabilityStatus: profile.availabilityStatus,
        engagementTypes: profile.engagementTypes,
        profileSlug: profile.profileSlug,
        verificationStatus: profile.verificationStatus,
        linkedinVerified: profile.linkedinVerified,
        profileCompletenessScore: profile.profileCompletenessScore,
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      };

      // Hide rates if not consented to show
      if (profile.showHourlyRates) {
        publicProfile.hourlyRateMin = profile.hourlyRateMin;
        publicProfile.hourlyRateMax = profile.hourlyRateMax;
      }

      if (profile.showProjectRates) {
        publicProfile.projectRateMin = profile.projectRateMin;
        publicProfile.projectRateMax = profile.projectRateMax;
      }

      return publicProfile;
    }

    // Return full profile for authenticated internal views
    return { ...profile };
  }

  /**
   * Calculate profile completeness score
   * @param {Object} profile - Profile object
   * @returns {number} Completeness score (0-100)
   */
  calculateCompletenessScore(profile) {
    let score = 0;

    // Basic information (40 points)
    if (profile.bio && profile.bio.length > 50) score += 15;
    if (profile.headline && profile.headline.length > 10) score += 10;
    if (profile.profilePhotoUrl) score += 15;

    // Professional details (30 points)
    if (profile.yearsOfExperience !== null) score += 10;
    if (profile.industry) score += 10;
    if (profile.previousCompany && profile.previousTitle) score += 10;

    // Engagement preferences (20 points)
    if (profile.engagementTypes && profile.engagementTypes.length > 0) score += 10;
    if (profile.hourlyRateMin !== null || profile.projectRateMin !== null) score += 10;

    // Verification and links (10 points)
    if (profile.linkedinUrl) score += 5;
    if (profile.linkedinVerified) score += 5;

    return Math.min(100, score);
  }

  /**
   * Generate unique profile slug
   * @param {string} displayName - Display name for slug generation
   * @param {string} excludeProfileId - Profile ID to exclude from uniqueness check
   * @returns {string} Unique slug
   */
  generateSlug(displayName, excludeProfileId = null) {
    // Create base slug from display name
    let baseSlug = displayName
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!baseSlug) {
      baseSlug = `profile-${Date.now()}`;
    }

    let finalSlug = baseSlug;
    let counter = 0;

    // Ensure uniqueness
    while (this.isSlugTaken(finalSlug, excludeProfileId)) {
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
    }

    return finalSlug;
  }

  /**
   * Check if slug is taken
   * @param {string} slug - Slug to check
   * @param {string} excludeProfileId - Profile ID to exclude
   * @returns {boolean} Whether slug is taken
   */
  isSlugTaken(slug, excludeProfileId = null) {
    for (const profile of this.profiles.values()) {
      if (profile.profileSlug === slug && 
          profile.id !== excludeProfileId && 
          !profile.deletedAt) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get profile statistics
   * @returns {Promise<Object>} Profile statistics
   */
  async getStats() {
    try {
      const stats = {
        totalProfiles: 0,
        activeProfiles: 0,
        publicProfiles: 0,
        verifiedProfiles: 0,
        deletedProfiles: 0,
        averageCompletenessScore: 0
      };

      let totalCompleteness = 0;

      for (const profile of this.profiles.values()) {
        stats.totalProfiles++;

        if (profile.deletedAt) {
          stats.deletedProfiles++;
        } else {
          stats.activeProfiles++;
          totalCompleteness += profile.profileCompletenessScore;

          if (profile.isProfilePublic) {
            stats.publicProfiles++;
          }

          if (profile.verificationStatus === 'verified') {
            stats.verifiedProfiles++;
          }
        }
      }

      if (stats.activeProfiles > 0) {
        stats.averageCompletenessScore = Math.round(totalCompleteness / stats.activeProfiles);
      }

      return stats;

    } catch (error) {
      throw new ProfileError(`Failed to get profile statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Reset all data (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    this.profiles.clear();
  }
}

// Export singleton instance
module.exports = {
  Profile: new Profile(),
  ProfileError
};