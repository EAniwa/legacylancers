/**
 * Skills Controller
 * Handles CRUD operations and business logic for skills
 */

const { Skill, SkillError } = require('../models/Skill');
const skillValidationService = require('../services/skill-validation');

class SkillsController {
  /**
   * Create a new skill
   * POST /api/skills
   */
  async createSkill(req, res) {
    try {
      const { name, description, category, aliases, status, verified } = req.body;

      // Validate input using skill validation service
      const validationResult = await skillValidationService.validateSkillCreation({
        name,
        description,
        category,
        aliases,
        status,
        verified
      });

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.errors
        });
      }

      // Create skill with validated data
      const skill = await Skill.create(validationResult.sanitizedData, {
        createdBy: req.user.id,
        isSystemGenerated: false
      });

      res.status(201).json({
        success: true,
        data: skill,
        warnings: validationResult.warnings,
        suggestions: validationResult.suggestions
      });

    } catch (error) {
      console.error('Create skill error:', error);

      if (error instanceof SkillError) {
        let statusCode = 400;
        
        switch (error.code) {
          case 'SKILL_EXISTS':
            statusCode = 409;
            break;
          case 'MISSING_SKILL_NAME':
          case 'MISSING_CATEGORY':
            statusCode = 400;
            break;
          default:
            statusCode = 400;
        }

        return res.status(statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create skill',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get skill by ID
   * GET /api/skills/:id
   */
  async getSkill(req, res) {
    try {
      const { id } = req.params;
      const { include_usage_stats } = req.query;

      const skill = await Skill.findById(id, {
        includeUsageStats: include_usage_stats === 'true'
      });

      if (!skill) {
        return res.status(404).json({
          success: false,
          error: 'Skill not found',
          code: 'SKILL_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: skill
      });

    } catch (error) {
      console.error('Get skill error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve skill',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Search and list skills with filtering
   * GET /api/skills
   */
  async searchSkills(req, res) {
    try {
      const {
        q: query,
        category,
        status,
        verified,
        is_system_generated,
        min_usage,
        page = 1,
        limit = 20,
        sort = 'popularityScore',
        order = 'desc',
        autocomplete = 'false'
      } = req.query;

      // Build search criteria
      const criteria = {};
      if (query) criteria.query = query;
      if (category) {
        criteria.category = category.includes(',') ? category.split(',') : category;
      }
      if (status) {
        criteria.status = status.includes(',') ? status.split(',') : status;
      }
      if (verified !== undefined) criteria.verified = verified === 'true';
      if (is_system_generated !== undefined) criteria.isSystemGenerated = is_system_generated === 'true';
      if (min_usage) criteria.minUsage = parseInt(min_usage);

      // Build options
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Cap at 100
        sort,
        order,
        autocomplete: autocomplete === 'true',
        includeUsageStats: req.query.include_usage_stats === 'true'
      };

      const results = await Skill.search(criteria, options);

      res.json({
        success: true,
        data: results.skills,
        pagination: results.pagination,
        facets: results.facets,
        query: {
          criteria,
          options: {
            page: options.page,
            limit: options.limit,
            sort: options.sort,
            order: options.order
          }
        }
      });

    } catch (error) {
      console.error('Search skills error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to search skills',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update skill
   * PUT /api/skills/:id
   */
  async updateSkill(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if skill exists
      const existingSkill = await Skill.findById(id);
      if (!existingSkill) {
        return res.status(404).json({
          success: false,
          error: 'Skill not found',
          code: 'SKILL_NOT_FOUND'
        });
      }

      // Check permissions - only admins can update system-generated skills
      if (existingSkill.isSystemGenerated && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Cannot modify system-generated skills',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Only skill creator or admin can update custom skills
      if (!existingSkill.isSystemGenerated && 
          existingSkill.createdBy !== req.user.id && 
          req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Can only update skills you created',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Validate update data
      const validationResult = await skillValidationService.validateSkillUpdate(id, updateData);

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.errors
        });
      }

      // Update skill
      const updatedSkill = await Skill.update(id, validationResult.sanitizedData);

      res.json({
        success: true,
        data: updatedSkill,
        warnings: validationResult.warnings,
        suggestions: validationResult.suggestions
      });

    } catch (error) {
      console.error('Update skill error:', error);

      if (error instanceof SkillError) {
        let statusCode = 400;
        
        switch (error.code) {
          case 'SKILL_NOT_FOUND':
            statusCode = 404;
            break;
          case 'SKILL_EXISTS':
            statusCode = 409;
            break;
          default:
            statusCode = 400;
        }

        return res.status(statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update skill',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Delete skill
   * DELETE /api/skills/:id
   */
  async deleteSkill(req, res) {
    try {
      const { id } = req.params;

      // Check if skill exists
      const existingSkill = await Skill.findById(id);
      if (!existingSkill) {
        return res.status(404).json({
          success: false,
          error: 'Skill not found',
          code: 'SKILL_NOT_FOUND'
        });
      }

      // Check permissions - only admins can delete system-generated skills
      if (existingSkill.isSystemGenerated && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Cannot delete system-generated skills',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Only skill creator or admin can delete custom skills
      if (!existingSkill.isSystemGenerated && 
          existingSkill.createdBy !== req.user.id && 
          req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Can only delete skills you created',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      await Skill.delete(id);

      res.json({
        success: true,
        message: 'Skill deleted successfully'
      });

    } catch (error) {
      console.error('Delete skill error:', error);

      if (error instanceof SkillError) {
        let statusCode = 400;
        
        switch (error.code) {
          case 'SKILL_NOT_FOUND':
            statusCode = 404;
            break;
          case 'CANNOT_DELETE_SYSTEM_SKILL':
            statusCode = 403;
            break;
          default:
            statusCode = 400;
        }

        return res.status(statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete skill',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get skill categories
   * GET /api/skills/categories
   */
  async getCategories(req, res) {
    try {
      const categories = await Skill.getCategories();

      res.json({
        success: true,
        data: categories
      });

    } catch (error) {
      console.error('Get categories error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve categories',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Validate skill data
   * POST /api/skills/validate
   */
  async validateSkillData(req, res) {
    try {
      const { type = 'single', data } = req.body;

      let validationResult;

      if (type === 'single') {
        // Validate single skill
        validationResult = await skillValidationService.validateSkillCreation(data);
      } else if (type === 'bulk') {
        // Validate multiple skills (e.g., from profile import)
        validationResult = await skillValidationService.validateBulkSkills(data);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid validation type. Must be "single" or "bulk"',
          code: 'INVALID_VALIDATION_TYPE'
        });
      }

      res.json({
        success: true,
        data: validationResult
      });

    } catch (error) {
      console.error('Validate skill data error:', error);

      res.status(500).json({
        success: false,
        error: 'Validation service error',
        code: 'VALIDATION_SERVICE_ERROR'
      });
    }
  }

  /**
   * Track skill usage (called when skill is added to profile)
   * POST /api/skills/:id/track-usage
   */
  async trackSkillUsage(req, res) {
    try {
      const { id } = req.params;
      const { proficiency_level = 'intermediate' } = req.body;

      await Skill.trackUsage(id, req.user.id, proficiency_level);

      res.json({
        success: true,
        message: 'Skill usage tracked successfully'
      });

    } catch (error) {
      console.error('Track skill usage error:', error);

      if (error instanceof SkillError) {
        let statusCode = 400;
        
        switch (error.code) {
          case 'SKILL_NOT_FOUND':
            statusCode = 404;
            break;
          case 'INVALID_PROFICIENCY_LEVEL':
            statusCode = 400;
            break;
          default:
            statusCode = 400;
        }

        return res.status(statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to track skill usage',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get skill statistics (admin only)
   * GET /api/skills/stats
   */
  async getSkillStats(req, res) {
    try {
      const stats = await Skill.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Get skill stats error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve skill statistics',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get popular skills
   * GET /api/skills/popular
   */
  async getPopularSkills(req, res) {
    try {
      const { category, limit = 10 } = req.query;

      const criteria = {
        status: 'active'
      };
      
      if (category) {
        criteria.category = category;
      }

      const results = await Skill.search(criteria, {
        limit: Math.min(parseInt(limit), 50),
        sort: 'popularityScore',
        order: 'desc'
      });

      res.json({
        success: true,
        data: results.skills.map(skill => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          usageCount: skill.usageCount,
          popularityScore: skill.popularityScore,
          verified: skill.verified
        }))
      });

    } catch (error) {
      console.error('Get popular skills error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve popular skills',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get skill suggestions based on partial name
   * GET /api/skills/suggestions
   */
  async getSkillSuggestions(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query must be at least 2 characters',
          code: 'INVALID_QUERY'
        });
      }

      const results = await Skill.search(
        { 
          query: query.trim(),
          status: 'active'
        },
        {
          limit: Math.min(parseInt(limit), 20),
          autocomplete: true
        }
      );

      res.json({
        success: true,
        data: results.skills.map(skill => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
          verified: skill.verified,
          usageCount: skill.usageCount
        }))
      });

    } catch (error) {
      console.error('Get skill suggestions error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to get skill suggestions',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

module.exports = new SkillsController();