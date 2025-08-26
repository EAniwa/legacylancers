/**
 * Profile Controllers
 * Handles profile CRUD operations with privacy controls and audit logging
 */

const { Profile, ProfileError } = require('../models/Profile');

/**
 * Create a new profile
 * POST /api/profiles
 */
async function createProfile(req, res) {
  try {
    const userId = req.user.id;
    const profileData = req.body;

    // Log audit event
    console.log(`[AUDIT] Profile creation attempt by user ${userId}`, {
      userId,
      profileData: { ...profileData, userId },
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Create profile
    const profile = await Profile.create(userId, profileData);

    // Log success
    console.log(`[AUDIT] Profile created successfully`, {
      userId,
      profileId: profile.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Profile created successfully',
      data: {
        profile
      }
    });

  } catch (error) {
    console.error('Profile creation error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Profile creation failed`, {
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof ProfileError) {
      const statusCode = error.code === 'PROFILE_EXISTS' ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create profile',
      code: 'PROFILE_CREATE_FAILED'
    });
  }
}

/**
 * Get profile by ID
 * GET /api/profiles/:id
 */
async function getProfile(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Get profile
    const profile = await Profile.findById(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Determine privacy options
    const isOwner = currentUser && currentUser.id === profile.userId;
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isPublicView = !isOwner && !isAdmin;

    // Apply privacy filters
    const filteredProfile = Profile.applyPrivacyFilters(profile, {
      isOwner,
      isAdmin,
      isPublicView
    });

    // Check if profile should be visible
    if (isPublicView && (!profile.isProfilePublic || !profile.searchable)) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        profile: filteredProfile
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);

    if (error instanceof ProfileError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile',
      code: 'PROFILE_GET_FAILED'
    });
  }
}

/**
 * Get profile by slug
 * GET /api/profiles/slug/:slug
 */
async function getProfileBySlug(req, res) {
  try {
    const { slug } = req.params;
    const currentUser = req.user;

    // Get profile
    const profile = await Profile.findBySlug(slug);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Determine privacy options
    const isOwner = currentUser && currentUser.id === profile.userId;
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isPublicView = !isOwner && !isAdmin;

    // Apply privacy filters
    const filteredProfile = Profile.applyPrivacyFilters(profile, {
      isOwner,
      isAdmin,
      isPublicView
    });

    // Check if profile should be visible
    if (isPublicView && (!profile.isProfilePublic || !profile.searchable)) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        profile: filteredProfile
      }
    });

  } catch (error) {
    console.error('Get profile by slug error:', error);

    if (error instanceof ProfileError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile',
      code: 'PROFILE_GET_FAILED'
    });
  }
}

/**
 * Get current user's profile
 * GET /api/profiles/me
 */
async function getCurrentUserProfile(req, res) {
  try {
    const userId = req.user.id;

    // Get profile
    const profile = await Profile.findByUserId(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Owner always sees full profile
    const filteredProfile = Profile.applyPrivacyFilters(profile, {
      isOwner: true,
      isAdmin: false,
      isPublicView: false
    });

    res.json({
      success: true,
      data: {
        profile: filteredProfile
      }
    });

  } catch (error) {
    console.error('Get current user profile error:', error);

    if (error instanceof ProfileError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile',
      code: 'PROFILE_GET_FAILED'
    });
  }
}

/**
 * Update profile
 * PUT /api/profiles/:id
 */
async function updateProfile(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const currentUser = req.user;

    // Log audit event
    console.log(`[AUDIT] Profile update attempt`, {
      profileId: id,
      userId: currentUser.id,
      updateData,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Check if profile exists
    const existingProfile = await Profile.findById(id);
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Determine privacy options for response
    const isOwner = currentUser.id === existingProfile.userId;
    const isAdmin = currentUser.role === 'admin';

    // Update profile
    const profile = await Profile.update(id, updateData, {
      isOwner,
      isAdmin
    });

    // Log success
    console.log(`[AUDIT] Profile updated successfully`, {
      profileId: id,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Profile update failed`, {
      profileId: req.params.id,
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof ProfileError) {
      const statusCode = error.code === 'PROFILE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
}

/**
 * Partially update profile
 * PATCH /api/profiles/:id
 */
async function patchProfile(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const currentUser = req.user;

    // Log audit event
    console.log(`[AUDIT] Profile partial update attempt`, {
      profileId: id,
      userId: currentUser.id,
      updateData,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Check if profile exists
    const existingProfile = await Profile.findById(id);
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Determine privacy options for response
    const isOwner = currentUser.id === existingProfile.userId;
    const isAdmin = currentUser.role === 'admin';

    // Update profile
    const profile = await Profile.update(id, updateData, {
      isOwner,
      isAdmin
    });

    // Log success
    console.log(`[AUDIT] Profile partially updated successfully`, {
      profileId: id,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile
      }
    });

  } catch (error) {
    console.error('Profile patch error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Profile partial update failed`, {
      profileId: req.params.id,
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof ProfileError) {
      const statusCode = error.code === 'PROFILE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
}

/**
 * Delete profile (soft delete)
 * DELETE /api/profiles/:id
 */
async function deleteProfile(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Log audit event
    console.log(`[AUDIT] Profile deletion attempt`, {
      profileId: id,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Check if profile exists and get it for ownership verification
    const existingProfile = await Profile.findById(id);
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Delete profile
    await Profile.delete(id);

    // Log success
    console.log(`[AUDIT] Profile deleted successfully`, {
      profileId: id,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Profile deleted successfully'
    });

  } catch (error) {
    console.error('Profile deletion error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Profile deletion failed`, {
      profileId: req.params.id,
      userId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof ProfileError) {
      const statusCode = error.code === 'PROFILE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete profile',
      code: 'PROFILE_DELETE_FAILED'
    });
  }
}

/**
 * Search profiles
 * GET /api/profiles
 */
async function searchProfiles(req, res) {
  try {
    const currentUser = req.user;
    
    // Parse query parameters
    const {
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
      industry,
      availabilityStatus,
      engagementTypes,
      minExperience,
      maxHourlyRate,
      verified,
      searchable = 'true'
    } = req.query;

    // Build search criteria
    const criteria = {};
    
    if (industry) criteria.industry = industry;
    if (availabilityStatus) criteria.availabilityStatus = availabilityStatus;
    if (engagementTypes) {
      criteria.engagementTypes = Array.isArray(engagementTypes) 
        ? engagementTypes 
        : [engagementTypes];
    }
    if (minExperience) criteria.minExperience = parseInt(minExperience);
    if (maxHourlyRate) criteria.maxHourlyRate = parseFloat(maxHourlyRate);
    if (verified === 'true') criteria.verified = true;
    if (searchable === 'false') criteria.searchable = false;

    // Search options
    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Cap at 100
      sort,
      order,
      includePrivate: currentUser && currentUser.role === 'admin'
    };

    // Perform search
    const results = await Profile.search(criteria, options);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Profile search error:', error);

    if (error instanceof ProfileError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to search profiles',
      code: 'PROFILE_SEARCH_FAILED'
    });
  }
}

/**
 * Get profile statistics (admin only)
 * GET /api/profiles/stats
 */
async function getProfileStats(req, res) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const stats = await Profile.getStats();

    res.json({
      success: true,
      data: {
        stats
      }
    });

  } catch (error) {
    console.error('Profile stats error:', error);

    if (error instanceof ProfileError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get profile statistics',
      code: 'PROFILE_STATS_FAILED'
    });
  }
}

/**
 * Update profile verification status (admin only)
 * PATCH /api/profiles/:id/verification
 */
async function updateVerificationStatus(req, res) {
  try {
    const { id } = req.params;
    const { verificationStatus, backgroundCheckStatus, linkedinVerified } = req.body;
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Log audit event
    console.log(`[AUDIT] Profile verification status update`, {
      profileId: id,
      adminUserId: currentUser.id,
      verificationStatus,
      backgroundCheckStatus,
      linkedinVerified,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    // Build update data
    const updateData = {};
    if (verificationStatus !== undefined) updateData.verificationStatus = verificationStatus;
    if (backgroundCheckStatus !== undefined) updateData.backgroundCheckStatus = backgroundCheckStatus;
    if (linkedinVerified !== undefined) updateData.linkedinVerified = linkedinVerified;

    // Update profile
    const profile = await Profile.update(id, updateData, {
      isOwner: false,
      isAdmin: true
    });

    // Log success
    console.log(`[AUDIT] Profile verification updated successfully`, {
      profileId: id,
      adminUserId: currentUser.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Verification status updated successfully',
      data: {
        profile
      }
    });

  } catch (error) {
    console.error('Profile verification update error:', error);

    // Log audit event for failure
    console.log(`[AUDIT] Profile verification update failed`, {
      profileId: req.params.id,
      adminUserId: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });

    if (error instanceof ProfileError) {
      const statusCode = error.code === 'PROFILE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update verification status',
      code: 'VERIFICATION_UPDATE_FAILED'
    });
  }
}

module.exports = {
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
};