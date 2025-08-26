/**
 * Skill Validation Middleware
 * Validates skill-related requests and enforces business rules
 */

const validator = require('validator');
const { Skill, SkillError } = require('../models/Skill');

class SkillValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', field = null) {
    super(message);
    this.name = 'SkillValidationError';
    this.code = code;
    this.field = field;
  }
}

/**
 * Sanitize skill input data
 */
function sanitizeSkillInput() {
  return (req, res, next) => {
    try {
      const body = req.body;

      // Sanitize string fields
      const stringFields = ['name', 'description'];
      for (const field of stringFields) {
        if (body[field] && typeof body[field] === 'string') {
          body[field] = validator.trim(body[field]);
          
          // Only escape if not empty after trim
          if (body[field].length > 0) {
            body[field] = validator.escape(body[field]);
          }
        }
      }

      // Sanitize aliases array
      if (body.aliases && Array.isArray(body.aliases)) {
        body.aliases = body.aliases
          .filter(alias => typeof alias === 'string' && alias.trim().length > 0)
          .map(alias => validator.escape(validator.trim(alias)))
          .slice(0, 10); // Limit to 10 aliases
      }

      // Sanitize related skills array
      if (body.relatedSkills && Array.isArray(body.relatedSkills)) {
        body.relatedSkills = body.relatedSkills
          .filter(skillId => typeof skillId === 'string' && skillId.trim().length > 0)
          .slice(0, 20); // Limit to 20 related skills
      }

      next();

    } catch (error) {
      console.error('Sanitization error:', error);
      res.status(400).json({
        success: false,
        error: 'Input sanitization failed',
        code: 'SANITIZATION_ERROR'
      });
    }
  };
}

/**
 * Validate skill creation request
 */
function validateSkillCreation() {
  return (req, res, next) => {
    try {
      const { name, category, description, aliases, status } = req.body;
      const errors = [];

      // Validate required fields
      if (!name || !name.trim()) {
        errors.push({
          field: 'name',
          message: 'Skill name is required',
          code: 'MISSING_REQUIRED_FIELD'
        });
      } else {
        // Validate name format and length
        if (!validator.isLength(name, { min: 1, max: 100 })) {
          errors.push({
            field: 'name',
            message: 'Skill name must be between 1 and 100 characters',
            code: 'INVALID_FIELD_LENGTH'
          });
        }

        // Check for valid characters
        if (!/^[a-zA-Z0-9\s\-\+\#\.]+$/.test(name)) {
          errors.push({
            field: 'name',
            message: 'Skill name contains invalid characters',
            code: 'INVALID_FIELD_FORMAT'
          });
        }
      }

      if (!category) {
        errors.push({
          field: 'category',
          message: 'Skill category is required',
          code: 'MISSING_REQUIRED_FIELD'
        });
      } else {
        // Validate category
        const validCategories = [
          'technical', 'soft', 'industry-specific', 'leadership',
          'creative', 'analytical', 'communication', 'project-management', 'business'
        ];
        
        if (!validCategories.includes(category)) {
          errors.push({
            field: 'category',
            message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            code: 'INVALID_FIELD_VALUE'
          });
        }
      }

      // Validate optional fields
      if (description && !validator.isLength(description, { min: 1, max: 500 })) {
        errors.push({
          field: 'description',
          message: 'Description must be between 1 and 500 characters',
          code: 'INVALID_FIELD_LENGTH'
        });
      }

      if (status) {
        const validStatuses = ['active', 'deprecated', 'pending_review', 'archived'];
        if (!validStatuses.includes(status)) {
          errors.push({
            field: 'status',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            code: 'INVALID_FIELD_VALUE'
          });
        }
      }

      if (aliases && (!Array.isArray(aliases) || aliases.length > 10)) {
        errors.push({
          field: 'aliases',
          message: 'Aliases must be an array with maximum 10 items',
          code: 'INVALID_FIELD_FORMAT'
        });
      }

      // Return errors if any
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        });
      }

      next();

    } catch (error) {
      console.error('Skill creation validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        code: 'VALIDATION_SERVICE_ERROR'
      });
    }
  };
}

/**
 * Validate skill update request
 */
function validateSkillUpdate() {
  return (req, res, next) => {
    try {
      const { name, category, description, aliases, status, verified } = req.body;
      const errors = [];

      // Validate name if provided
      if (name !== undefined) {
        if (!name || !name.trim()) {
          errors.push({
            field: 'name',
            message: 'Skill name cannot be empty',
            code: 'INVALID_FIELD_VALUE'
          });
        } else {
          // Validate name format and length
          if (!validator.isLength(name, { min: 1, max: 100 })) {
            errors.push({
              field: 'name',
              message: 'Skill name must be between 1 and 100 characters',
              code: 'INVALID_FIELD_LENGTH'
            });
          }

          // Check for valid characters
          if (!/^[a-zA-Z0-9\s\-\+\#\.]+$/.test(name)) {
            errors.push({
              field: 'name',
              message: 'Skill name contains invalid characters',
              code: 'INVALID_FIELD_FORMAT'
            });
          }
        }
      }

      // Validate category if provided
      if (category !== undefined) {
        const validCategories = [
          'technical', 'soft', 'industry-specific', 'leadership',
          'creative', 'analytical', 'communication', 'project-management', 'business'
        ];
        
        if (!validCategories.includes(category)) {
          errors.push({
            field: 'category',
            message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            code: 'INVALID_FIELD_VALUE'
          });
        }
      }

      // Validate description if provided
      if (description !== undefined && description !== null) {
        if (description && !validator.isLength(description, { min: 1, max: 500 })) {
          errors.push({
            field: 'description',
            message: 'Description must be between 1 and 500 characters',
            code: 'INVALID_FIELD_LENGTH'
          });
        }
      }

      // Validate status if provided
      if (status !== undefined) {
        const validStatuses = ['active', 'deprecated', 'pending_review', 'archived'];
        if (!validStatuses.includes(status)) {
          errors.push({
            field: 'status',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            code: 'INVALID_FIELD_VALUE'
          });
        }
      }

      // Validate aliases if provided
      if (aliases !== undefined) {
        if (!Array.isArray(aliases) || aliases.length > 10) {
          errors.push({
            field: 'aliases',
            message: 'Aliases must be an array with maximum 10 items',
            code: 'INVALID_FIELD_FORMAT'
          });
        }
      }

      // Validate verified flag if provided (admin only)
      if (verified !== undefined && req.user.role !== 'admin') {
        errors.push({
          field: 'verified',
          message: 'Only administrators can modify verification status',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Return errors if any
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        });
      }

      next();

    } catch (error) {
      console.error('Skill update validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation service error',
        code: 'VALIDATION_SERVICE_ERROR'
      });
    }
  };
}

/**
 * Validate skill search parameters
 */
function validateSkillSearch() {
  return (req, res, next) => {
    try {
      const { page, limit, sort, order, min_usage } = req.query;
      const errors = [];

      // Validate pagination parameters
      if (page && (!validator.isInt(page, { min: 1 }))) {
        errors.push({
          field: 'page',
          message: 'Page must be a positive integer',
          code: 'INVALID_QUERY_PARAMETER'
        });
      }

      if (limit && (!validator.isInt(limit, { min: 1, max: 100 }))) {
        errors.push({
          field: 'limit',
          message: 'Limit must be between 1 and 100',
          code: 'INVALID_QUERY_PARAMETER'
        });
      }

      // Validate sort parameter
      if (sort) {
        const validSortFields = [
          'name', 'category', 'usageCount', 'popularityScore', 
          'createdAt', 'updatedAt', 'verified'
        ];
        
        if (!validSortFields.includes(sort)) {
          errors.push({
            field: 'sort',
            message: `Invalid sort field. Must be one of: ${validSortFields.join(', ')}`,
            code: 'INVALID_QUERY_PARAMETER'
          });
        }
      }

      // Validate order parameter
      if (order && !['asc', 'desc'].includes(order)) {
        errors.push({
          field: 'order',
          message: 'Order must be "asc" or "desc"',
          code: 'INVALID_QUERY_PARAMETER'
        });
      }

      // Validate min_usage parameter
      if (min_usage && (!validator.isInt(min_usage, { min: 0 }))) {
        errors.push({
          field: 'min_usage',
          message: 'Minimum usage must be a non-negative integer',
          code: 'INVALID_QUERY_PARAMETER'
        });
      }

      // Return errors if any
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid search parameters',
          code: 'INVALID_QUERY_PARAMETERS',
          details: errors
        });
      }

      next();

    } catch (error) {
      console.error('Skill search validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Search validation error',
        code: 'VALIDATION_SERVICE_ERROR'
      });
    }
  };
}

/**
 * Validate skill permissions for update/delete operations
 */
function validateSkillPermissions() {
  return async (req, res, next) => {
    try {
      const { id } = req.params;

      // Get the skill to check permissions
      const skill = await Skill.findById(id);
      if (!skill) {
        return res.status(404).json({
          success: false,
          error: 'Skill not found',
          code: 'SKILL_NOT_FOUND'
        });
      }

      // Check permissions
      const isAdmin = req.user.role === 'admin';
      const isOwner = skill.createdBy === req.user.id;
      const isSystemGenerated = skill.isSystemGenerated;

      // System-generated skills can only be modified by admins
      if (isSystemGenerated && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'System-generated skills can only be modified by administrators',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Custom skills can be modified by owner or admin
      if (!isSystemGenerated && !isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only modify skills you created',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Store skill in request for controller use
      req.skill = skill;
      
      next();

    } catch (error) {
      console.error('Skill permission validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission validation error',
        code: 'PERMISSION_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Validate proficiency level
 */
function validateProficiencyLevel() {
  return (req, res, next) => {
    try {
      const { proficiency_level } = req.body;

      if (proficiency_level !== undefined) {
        const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
        
        if (!validLevels.includes(proficiency_level)) {
          return res.status(400).json({
            success: false,
            error: `Invalid proficiency level. Must be one of: ${validLevels.join(', ')}`,
            code: 'INVALID_PROFICIENCY_LEVEL'
          });
        }
      }

      next();

    } catch (error) {
      console.error('Proficiency validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Proficiency validation error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

module.exports = {
  sanitizeSkillInput,
  validateSkillCreation,
  validateSkillUpdate,
  validateSkillSearch,
  validateSkillPermissions,
  validateProficiencyLevel,
  SkillValidationError
};