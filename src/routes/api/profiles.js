/**
 * Profile API Routes
 * RESTful endpoints for profile operations with proper middleware
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  createProfile,
  getProfile,
  getProfileBySlug,
  getCurrentUserProfile,
  updateProfile,
  patchProfile,
  deleteProfile,
  searchProfiles,
  getProfileStats,
  updateVerificationStatus
} = require('../../controllers/profiles');

// Import authentication middleware
const {
  requiredAuthenticate,
  optionalAuthenticate,
  adminOnly,
  verifiedUserOnly
} = require('../../middleware/auth');

// Import profile validation middleware
const {
  validateProfileCreation,
  validateProfileUpdate,
  validateProfileSearch,
  validateProfileSlug,
  sanitizeProfileInput,
  validateProfileOwnership
} = require('../../middleware/profile-validation');

/**
 * GET /api/profiles
 * Search profiles with optional filters
 * Public endpoint with optional authentication for better results
 */
router.get('/',
  optionalAuthenticate,
  validateProfileSearch(),
  searchProfiles
);

/**
 * POST /api/profiles
 * Create a new profile
 * Requires verified email
 */
router.post('/',
  verifiedUserOnly,
  sanitizeProfileInput(),
  validateProfileCreation(),
  createProfile
);

/**
 * GET /api/profiles/me
 * Get current user's profile
 * Requires authentication
 */
router.get('/me',
  requiredAuthenticate,
  getCurrentUserProfile
);

/**
 * GET /api/profiles/stats
 * Get profile statistics
 * Admin only
 */
router.get('/stats',
  adminOnly,
  getProfileStats
);

/**
 * GET /api/profiles/slug/:slug
 * Get profile by slug (public profile page)
 * Public endpoint with optional authentication
 */
router.get('/slug/:slug',
  optionalAuthenticate,
  validateProfileSlug(),
  getProfileBySlug
);

/**
 * GET /api/profiles/:id
 * Get profile by ID
 * Public endpoint with optional authentication for privacy controls
 */
router.get('/:id',
  optionalAuthenticate,
  getProfile
);

/**
 * PUT /api/profiles/:id
 * Update entire profile
 * Requires ownership or admin access
 */
router.put('/:id',
  requiredAuthenticate,
  validateProfileOwnership(),
  sanitizeProfileInput(),
  validateProfileUpdate(),
  updateProfile
);

/**
 * PATCH /api/profiles/:id
 * Partially update profile
 * Requires ownership or admin access
 */
router.patch('/:id',
  requiredAuthenticate,
  validateProfileOwnership(),
  sanitizeProfileInput(),
  validateProfileUpdate(),
  patchProfile
);

/**
 * DELETE /api/profiles/:id
 * Delete profile (soft delete)
 * Requires ownership or admin access
 */
router.delete('/:id',
  requiredAuthenticate,
  validateProfileOwnership(),
  deleteProfile
);

/**
 * PATCH /api/profiles/:id/verification
 * Update profile verification status
 * Admin only
 */
router.patch('/:id/verification',
  adminOnly,
  updateVerificationStatus
);

// Error handling middleware for profile routes
router.use((error, req, res, next) => {
  console.error('Profile route error:', error);
  
  // Handle specific profile errors
  if (error.name === 'ProfileError') {
    let statusCode = 400;
    
    switch (error.code) {
      case 'PROFILE_NOT_FOUND':
        statusCode = 404;
        break;
      case 'PROFILE_EXISTS':
        statusCode = 409;
        break;
      case 'INSUFFICIENT_PERMISSIONS':
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
  if (error.name === 'ValidationError') {
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