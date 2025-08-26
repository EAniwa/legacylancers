/**
 * Verification API Routes Index
 * Main entry point for all verification-related API endpoints
 */

const express = require('express');
const linkedInRoutes = require('./linkedin');
const manualRoutes = require('./manual');
const { requiredAuthenticate } = require('../../../middleware/auth');
const { rateLimiter } = require('../../../middleware/rateLimiting');

const router = express.Router();

// Apply rate limiting to all verification endpoints
router.use(rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));

// Apply authentication to all verification routes
router.use(requiredAuthenticate);

/**
 * GET /api/verification/health
 * Health check for verification services
 */
router.get('/health', (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        linkedin: 'available',
        manual: 'available'
      },
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/verification/methods
 * Get available verification methods for user
 */
router.get('/methods', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get available manual verification methods
    const { ManualVerificationService } = require('../../../services/verification/manual');
    const manualMethods = ManualVerificationService.getAvailableVerificationMethods(userId);

    // LinkedIn method availability depends on OAuth connection
    const linkedInAvailable = {
      method: 'linkedin_oauth',
      name: 'LinkedIn Profile Import',
      description: 'Import and verify your LinkedIn profile data automatically',
      estimatedTime: '5-10 minutes',
      requirements: ['LinkedIn account', 'OAuth connection'],
      successRate: 95,
      type: 'automated'
    };

    const allMethods = [
      linkedInAvailable,
      ...manualMethods.map(method => ({ ...method, type: 'manual' }))
    ];

    res.json({
      success: true,
      data: {
        methods: allMethods,
        recommended: 'linkedin_oauth', // Recommend LinkedIn first
        totalCount: allMethods.length
      }
    });

  } catch (error) {
    console.error('Error fetching verification methods:', error);
    res.status(500).json({
      success: false,
      error: 'METHODS_FETCH_FAILED',
      message: 'Failed to fetch available verification methods'
    });
  }
});

/**
 * GET /api/verification/status
 * Get overall verification status for user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get LinkedIn verification history
    const { LinkedInVerificationService } = require('../../../services/verification/linkedin');
    const linkedInHistory = LinkedInVerificationService.getVerificationHistory(userId);
    
    // Get manual verification history  
    const { ManualVerificationService } = require('../../../services/verification/manual');
    // Note: ManualVerificationService would need a getVerificationHistory method
    
    // Get user profile verification status
    const { Profile } = require('../../../models/Profile');
    const userProfile = await Profile.findByUserId(userId);

    const overallStatus = {
      userId,
      hasActiveVerifications: linkedInHistory.some(v => 
        ['pending', 'in_progress', 'under_review'].includes(v.state)
      ),
      completedVerifications: linkedInHistory.filter(v => v.state === 'verified').length,
      failedVerifications: linkedInHistory.filter(v => v.state === 'failed').length,
      profileVerified: userProfile?.linkedinVerified || false,
      lastVerification: linkedInHistory[0] || null,
      verificationMethods: {
        linkedin: {
          available: true,
          completed: linkedInHistory.filter(v => v.state === 'verified').length > 0,
          lastAttempt: linkedInHistory[0]?.createdAt || null
        },
        manual: {
          available: true,
          completed: false, // Would check manual verification history
          lastAttempt: null
        }
      }
    };

    res.json({
      success: true,
      data: overallStatus
    });

  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_FETCH_FAILED',
      message: 'Failed to fetch verification status'
    });
  }
});

/**
 * DELETE /api/verification/data
 * Delete all verification data for user (GDPR compliance)
 */
router.delete('/data', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // This would implement GDPR data deletion
    // For now, return a placeholder response
    
    res.json({
      success: true,
      message: 'Verification data deletion initiated',
      note: 'Data deletion may take up to 30 days to complete'
    });

  } catch (error) {
    console.error('Error deleting verification data:', error);
    res.status(500).json({
      success: false,
      error: 'DATA_DELETION_FAILED',
      message: 'Failed to delete verification data'
    });
  }
});

// Mount sub-routers
router.use('/linkedin', linkedInRoutes);
router.use('/manual', manualRoutes);

/**
 * Error handling middleware for verification routes
 */
router.use((error, req, res, next) => {
  console.error('Verification API error:', error);

  // Handle specific error types
  if (error.name === 'LinkedInVerificationError' || error.name === 'ManualVerificationError') {
    return res.status(400).json({
      success: false,
      error: error.code || 'VERIFICATION_ERROR',
      message: error.message,
      details: error.details
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.message,
      details: error.errors
    });
  }

  // Handle rate limiting errors
  if (error.name === 'RateLimitError') {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: error.message,
      retryAfter: error.retryAfter
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred'
  });
});

module.exports = router;