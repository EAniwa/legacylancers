/**
 * Profile Validation Middleware
 * Input validation and sanitization for profile operations
 */

const validator = require('validator');
const { ProfileError } = require('../models/Profile');

class ValidationError extends Error {
  constructor(message, field = null, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    this.statusCode = 400;
  }
}

/**
 * Validate profile creation data
 */
function validateProfileCreation() {
  return async (req, res, next) => {
    try {
      const data = req.body;
      const errors = [];

      // Optional field validations since profile can be created with minimal data
      
      // Display Name
      if (data.displayName !== undefined && data.displayName !== null && data.displayName !== '') {
        if (!validator.isLength(data.displayName, { min: 1, max: 150 })) {
          errors.push({
            field: 'displayName',
            message: 'Display name must be between 1 and 150 characters',
            code: 'INVALID_DISPLAY_NAME'
          });
        }
      }

      // Headline
      if (data.headline !== undefined && data.headline !== null && data.headline !== '') {
        if (!validator.isLength(data.headline, { min: 1, max: 200 })) {
          errors.push({
            field: 'headline',
            message: 'Headline must be between 1 and 200 characters',
            code: 'INVALID_HEADLINE'
          });
        }
      }

      // Bio
      if (data.bio !== undefined && data.bio !== null && data.bio !== '') {
        if (!validator.isLength(data.bio, { min: 1, max: 5000 })) {
          errors.push({
            field: 'bio',
            message: 'Bio must be between 1 and 5000 characters',
            code: 'INVALID_BIO'
          });
        }
      }

      // URL validations
      const urlFields = [
        { field: 'profilePhotoUrl', label: 'Profile photo URL' },
        { field: 'coverPhotoUrl', label: 'Cover photo URL' },
        { field: 'linkedinUrl', label: 'LinkedIn URL' },
        { field: 'portfolioUrl', label: 'Portfolio URL' },
        { field: 'resumeUrl', label: 'Resume URL' }
      ];

      for (const { field, label } of urlFields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
          if (!validator.isURL(data[field], { require_protocol: true })) {
            errors.push({
              field,
              message: `${label} must be a valid URL with protocol (http/https)`,
              code: `INVALID_${field.toUpperCase()}`
            });
          }
        }
      }

      // Years of Experience
      if (data.yearsOfExperience !== undefined && data.yearsOfExperience !== null) {
        const years = parseInt(data.yearsOfExperience);
        if (isNaN(years) || years < 0 || years > 70) {
          errors.push({
            field: 'yearsOfExperience',
            message: 'Years of experience must be between 0 and 70',
            code: 'INVALID_YEARS_EXPERIENCE'
          });
        }
      }

      // Text field validations
      const textFields = [
        { field: 'industry', label: 'Industry', maxLength: 100 },
        { field: 'previousCompany', label: 'Previous company', maxLength: 200 },
        { field: 'previousTitle', label: 'Previous title', maxLength: 200 },
        { field: 'timezone', label: 'Timezone', maxLength: 50 }
      ];

      for (const { field, label, maxLength } of textFields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
          if (!validator.isLength(data[field], { min: 1, max: maxLength })) {
            errors.push({
              field,
              message: `${label} must be between 1 and ${maxLength} characters`,
              code: `INVALID_${field.toUpperCase()}`
            });
          }
        }
      }

      // Availability Status
      const validAvailabilityStatuses = ['available', 'busy', 'unavailable', 'retired'];
      if (data.availabilityStatus !== undefined) {
        if (!validAvailabilityStatuses.includes(data.availabilityStatus)) {
          errors.push({
            field: 'availabilityStatus',
            message: `Availability status must be one of: ${validAvailabilityStatuses.join(', ')}`,
            code: 'INVALID_AVAILABILITY_STATUS'
          });
        }
      }

      // Engagement Types
      const validEngagementTypes = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
      if (data.engagementTypes !== undefined) {
        if (!Array.isArray(data.engagementTypes)) {
          errors.push({
            field: 'engagementTypes',
            message: 'Engagement types must be an array',
            code: 'INVALID_ENGAGEMENT_TYPES_FORMAT'
          });
        } else {
          for (const type of data.engagementTypes) {
            if (!validEngagementTypes.includes(type)) {
              errors.push({
                field: 'engagementTypes',
                message: `Invalid engagement type: ${type}. Must be one of: ${validEngagementTypes.join(', ')}`,
                code: 'INVALID_ENGAGEMENT_TYPE'
              });
              break; // Only report the first invalid type
            }
          }
          
          if (data.engagementTypes.length > 5) {
            errors.push({
              field: 'engagementTypes',
              message: 'Maximum 5 engagement types allowed',
              code: 'TOO_MANY_ENGAGEMENT_TYPES'
            });
          }
        }
      }

      // Rate validations
      const rateFields = [
        'hourlyRateMin', 'hourlyRateMax', 'projectRateMin', 
        'projectRateMax', 'keynoteRate', 'mentoringRate'
      ];

      for (const field of rateFields) {
        if (data[field] !== undefined && data[field] !== null) {
          const rate = parseFloat(data[field]);
          if (isNaN(rate) || rate < 0 || rate > 999999.99) {
            errors.push({
              field,
              message: `${field} must be a valid positive number less than 999999.99`,
              code: `INVALID_${field.toUpperCase()}`
            });
          }
        }
      }

      // Rate range validations
      if (data.hourlyRateMin && data.hourlyRateMax) {
        const minRate = parseFloat(data.hourlyRateMin);
        const maxRate = parseFloat(data.hourlyRateMax);
        if (!isNaN(minRate) && !isNaN(maxRate) && minRate > maxRate) {
          errors.push({
            field: 'hourlyRates',
            message: 'Minimum hourly rate cannot be greater than maximum hourly rate',
            code: 'INVALID_HOURLY_RATE_RANGE'
          });
        }
      }

      if (data.projectRateMin && data.projectRateMax) {
        const minRate = parseFloat(data.projectRateMin);
        const maxRate = parseFloat(data.projectRateMax);
        if (!isNaN(minRate) && !isNaN(maxRate) && minRate > maxRate) {
          errors.push({
            field: 'projectRates',
            message: 'Minimum project rate cannot be greater than maximum project rate',
            code: 'INVALID_PROJECT_RATE_RANGE'
          });
        }
      }

      // Currency
      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
      if (data.currency !== undefined && !validCurrencies.includes(data.currency)) {
        errors.push({
          field: 'currency',
          message: `Currency must be one of: ${validCurrencies.join(', ')}`,
          code: 'INVALID_CURRENCY'
        });
      }

      // Boolean field validations
      const booleanFields = [
        'isProfilePublic', 'showHourlyRates', 'showProjectRates', 
        'searchable', 'dataSharingConsent', 'publicProfileConsent'
      ];

      for (const field of booleanFields) {
        if (data[field] !== undefined && typeof data[field] !== 'boolean') {
          errors.push({
            field,
            message: `${field} must be a boolean value`,
            code: `INVALID_${field.toUpperCase()}_TYPE`
          });
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: errors
        });
      }

      next();

    } catch (error) {
      console.error('Profile validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate profile update data
 * Similar to creation validation but allows partial updates
 */
function validateProfileUpdate() {
  return validateProfileCreation(); // Same validation rules apply
}

/**
 * Validate profile search parameters
 */
function validateProfileSearch() {
  return async (req, res, next) => {
    try {
      const errors = [];
      const query = req.query;

      // Page validation
      if (query.page !== undefined) {
        const page = parseInt(query.page);
        if (isNaN(page) || page < 1) {
          errors.push({
            field: 'page',
            message: 'Page must be a positive integer',
            code: 'INVALID_PAGE'
          });
        }
      }

      // Limit validation
      if (query.limit !== undefined) {
        const limit = parseInt(query.limit);
        if (isNaN(limit) || limit < 1 || limit > 100) {
          errors.push({
            field: 'limit',
            message: 'Limit must be between 1 and 100',
            code: 'INVALID_LIMIT'
          });
        }
      }

      // Sort validation
      const validSortFields = [
        'createdAt', 'updatedAt', 'profileCompletenessScore', 
        'averageRating', 'totalReviews', 'yearsOfExperience'
      ];
      if (query.sort !== undefined && !validSortFields.includes(query.sort)) {
        errors.push({
          field: 'sort',
          message: `Sort field must be one of: ${validSortFields.join(', ')}`,
          code: 'INVALID_SORT_FIELD'
        });
      }

      // Order validation
      if (query.order !== undefined && !['asc', 'desc'].includes(query.order)) {
        errors.push({
          field: 'order',
          message: 'Order must be either "asc" or "desc"',
          code: 'INVALID_ORDER'
        });
      }

      // Availability status validation
      const validAvailabilityStatuses = ['available', 'busy', 'unavailable', 'retired'];
      if (query.availabilityStatus !== undefined && !validAvailabilityStatuses.includes(query.availabilityStatus)) {
        errors.push({
          field: 'availabilityStatus',
          message: `Availability status must be one of: ${validAvailabilityStatuses.join(', ')}`,
          code: 'INVALID_AVAILABILITY_STATUS'
        });
      }

      // Engagement types validation
      if (query.engagementTypes !== undefined) {
        const types = Array.isArray(query.engagementTypes) ? query.engagementTypes : [query.engagementTypes];
        const validEngagementTypes = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
        
        for (const type of types) {
          if (!validEngagementTypes.includes(type)) {
            errors.push({
              field: 'engagementTypes',
              message: `Invalid engagement type: ${type}. Must be one of: ${validEngagementTypes.join(', ')}`,
              code: 'INVALID_ENGAGEMENT_TYPE'
            });
            break;
          }
        }
      }

      // Numeric validations
      const numericFields = ['minExperience', 'maxHourlyRate'];
      for (const field of numericFields) {
        if (query[field] !== undefined) {
          const value = parseFloat(query[field]);
          if (isNaN(value) || value < 0) {
            errors.push({
              field,
              message: `${field} must be a positive number`,
              code: `INVALID_${field.toUpperCase()}`
            });
          }
        }
      }

      // Boolean validations
      const booleanFields = ['verified', 'searchable'];
      for (const field of booleanFields) {
        if (query[field] !== undefined) {
          const value = query[field];
          if (value !== 'true' && value !== 'false' && value !== true && value !== false) {
            errors.push({
              field,
              message: `${field} must be a boolean value (true/false)`,
              code: `INVALID_${field.toUpperCase()}`
            });
          }
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Search validation failed',
          code: 'SEARCH_VALIDATION_FAILED',
          details: errors
        });
      }

      next();

    } catch (error) {
      console.error('Profile search validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate profile slug parameter
 */
function validateProfileSlug() {
  return (req, res, next) => {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json({
          success: false,
          error: 'Profile slug is required',
          code: 'MISSING_SLUG'
        });
      }

      // Basic slug format validation
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid slug format. Must contain only lowercase letters, numbers, and hyphens',
          code: 'INVALID_SLUG_FORMAT'
        });
      }

      if (slug.length < 1 || slug.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Slug must be between 1 and 100 characters',
          code: 'INVALID_SLUG_LENGTH'
        });
      }

      next();

    } catch (error) {
      console.error('Profile slug validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Sanitize profile input data
 * This middleware sanitizes input data before validation
 */
function sanitizeProfileInput() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // String fields to sanitize
      const stringFields = [
        'displayName', 'headline', 'bio', 'industry', 
        'previousCompany', 'previousTitle', 'timezone'
      ];

      for (const field of stringFields) {
        if (data[field] !== undefined && typeof data[field] === 'string') {
          // Trim whitespace and normalize
          data[field] = validator.trim(data[field]);
          
          // Convert empty strings to null
          if (data[field] === '') {
            data[field] = null;
          }
        }
      }

      // URL fields - trim and normalize
      const urlFields = [
        'profilePhotoUrl', 'coverPhotoUrl', 'linkedinUrl', 
        'portfolioUrl', 'resumeUrl'
      ];

      for (const field of urlFields) {
        if (data[field] !== undefined && typeof data[field] === 'string') {
          data[field] = validator.trim(data[field]);
          if (data[field] === '') {
            data[field] = null;
          }
        }
      }

      // Numeric fields - convert to numbers
      const numericFields = [
        'yearsOfExperience', 'hourlyRateMin', 'hourlyRateMax', 
        'projectRateMin', 'projectRateMax', 'keynoteRate', 'mentoringRate'
      ];

      for (const field of numericFields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
          const parsed = parseFloat(data[field]);
          data[field] = isNaN(parsed) ? data[field] : parsed;
        }
      }

      // Boolean fields - convert to booleans
      const booleanFields = [
        'isProfilePublic', 'showHourlyRates', 'showProjectRates', 
        'searchable', 'dataSharingConsent', 'publicProfileConsent'
      ];

      for (const field of booleanFields) {
        if (data[field] !== undefined) {
          if (typeof data[field] === 'string') {
            data[field] = data[field].toLowerCase() === 'true';
          } else {
            data[field] = Boolean(data[field]);
          }
        }
      }

      // Engagement types - ensure array and remove duplicates
      if (data.engagementTypes !== undefined) {
        if (Array.isArray(data.engagementTypes)) {
          data.engagementTypes = [...new Set(data.engagementTypes)];
        }
      }

      next();

    } catch (error) {
      console.error('Profile input sanitization error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal sanitization error',
        code: 'SANITIZATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate profile ownership
 * Ensures user can only modify their own profile unless they're admin
 */
function validateProfileOwnership() {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // Allow admins to modify any profile
      if (req.user.role === 'admin') {
        return next();
      }

      // For profile ID in params
      if (req.params.id || req.params.profileId) {
        const profileId = req.params.id || req.params.profileId;
        
        // Get profile to check ownership
        const { Profile } = require('../models/Profile');
        const profile = await Profile.findById(profileId);
        
        if (!profile) {
          return res.status(404).json({
            success: false,
            error: 'Profile not found',
            code: 'PROFILE_NOT_FOUND'
          });
        }

        if (profile.userId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'You can only modify your own profile',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
      }

      // For user ID in profile creation, ensure it matches authenticated user
      if (req.body && req.body.userId && req.body.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only create profiles for yourself',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();

    } catch (error) {
      console.error('Profile ownership validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal authorization error',
        code: 'AUTHORIZATION_INTERNAL_ERROR'
      });
    }
  };
}

module.exports = {
  validateProfileCreation,
  validateProfileUpdate,
  validateProfileSearch,
  validateProfileSlug,
  sanitizeProfileInput,
  validateProfileOwnership,
  ValidationError
};