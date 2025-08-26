/**
 * Skills API Routes
 * RESTful endpoints for skill operations with proper middleware
 */

const express = require('express');
const router = express.Router();

// Import controller
const skillsController = require('../../controllers/skills');

// Import authentication middleware
const {
  requiredAuthenticate,
  optionalAuthenticate,
  adminOnly,
  verifiedUserOnly
} = require('../../middleware/auth');

// Import validation middleware
const {
  validateSkillCreation,
  validateSkillUpdate,
  validateSkillSearch,
  sanitizeSkillInput,
  validateSkillPermissions
} = require('../../middleware/skill-validation');

/**
 * GET /api/skills/suggestions
 * Get skill suggestions for autocomplete
 * Public endpoint with optional authentication for better results
 */
router.get('/suggestions',
  optionalAuthenticate,
  skillsController.getSkillSuggestions
);

/**
 * GET /api/skills/popular
 * Get popular skills by category
 * Public endpoint
 */
router.get('/popular',
  skillsController.getPopularSkills
);

/**
 * GET /api/skills/categories
 * Get skill categories with counts
 * Public endpoint
 */
router.get('/categories',
  skillsController.getCategories
);

/**
 * GET /api/skills/stats
 * Get skill statistics
 * Admin only
 */
router.get('/stats',
  adminOnly,
  skillsController.getSkillStats
);

/**
 * POST /api/skills/validate
 * Validate skill data
 * Requires verified email
 */
router.post('/validate',
  verifiedUserOnly,
  sanitizeSkillInput(),
  skillsController.validateSkillData
);

/**
 * GET /api/skills
 * Search skills with optional filters
 * Public endpoint with optional authentication for better results
 */
router.get('/',
  optionalAuthenticate,
  validateSkillSearch(),
  skillsController.searchSkills
);

/**
 * POST /api/skills
 * Create a new skill
 * Requires verified email
 */
router.post('/',
  verifiedUserOnly,
  sanitizeSkillInput(),
  validateSkillCreation(),
  skillsController.createSkill
);

/**
 * GET /api/skills/:id
 * Get skill by ID
 * Public endpoint with optional authentication
 */
router.get('/:id',
  optionalAuthenticate,
  skillsController.getSkill
);

/**
 * PUT /api/skills/:id
 * Update skill
 * Requires permission validation
 */
router.put('/:id',
  requiredAuthenticate,
  validateSkillPermissions(),
  sanitizeSkillInput(),
  validateSkillUpdate(),
  skillsController.updateSkill
);

/**
 * DELETE /api/skills/:id
 * Delete skill
 * Requires permission validation
 */
router.delete('/:id',
  requiredAuthenticate,
  validateSkillPermissions(),
  skillsController.deleteSkill
);

/**
 * POST /api/skills/:id/track-usage
 * Track skill usage (when added to profile)
 * Requires authentication
 */
router.post('/:id/track-usage',
  requiredAuthenticate,
  skillsController.trackSkillUsage
);

// Error handling middleware for skill routes
router.use((error, req, res, next) => {
  console.error('Skill route error:', error);
  
  // Handle specific skill errors
  if (error.name === 'SkillError') {
    let statusCode = 400;
    
    switch (error.code) {
      case 'SKILL_NOT_FOUND':
        statusCode = 404;
        break;
      case 'SKILL_EXISTS':
        statusCode = 409;
        break;
      case 'INSUFFICIENT_PERMISSIONS':
        statusCode = 403;
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

  // Handle validation errors
  if (error.name === 'SkillValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: error.code,
      field: error.field
    });
  }

  // Pass to global error handler
  next(error);
});

module.exports = router;