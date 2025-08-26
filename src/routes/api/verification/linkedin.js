/**
 * LinkedIn Verification API Routes
 * Handles LinkedIn profile verification, import, and skills mapping endpoints
 */

const express = require('express');
const { LinkedInVerificationService, LinkedInVerificationError } = require('../../../services/verification/linkedin');
const { requiredAuthenticate } = require('../../../middleware/auth');
const { validateRequest } = require('../../../middleware/validation');
const { rateLimiter } = require('../../../middleware/rateLimiting');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requiredAuthenticate);

/**
 * POST /api/verification/linkedin/start
 * Start LinkedIn verification process
 */
router.post('/start',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 attempts per 15 minutes
  validateRequest({
    body: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', minLength: 1 },
        options: {
          type: 'object',
          properties: {
            importProfile: { type: 'boolean' },
            importSkills: { type: 'boolean' },
            importExperience: { type: 'boolean' },
            importEducation: { type: 'boolean' },
            autoMapSkills: { type: 'boolean' },
            privacyLevel: { 
              type: 'string', 
              enum: ['full', 'selective', 'minimal'] 
            }
          },
          additionalProperties: false
        }
      },
      required: ['accessToken'],
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { accessToken, options = {} } = req.body;
      const userId = req.user.id;

      const verificationStatus = await LinkedInVerificationService.startVerification(
        userId,
        accessToken,
        options
      );

      res.json({
        success: true,
        data: verificationStatus,
        message: 'LinkedIn verification started successfully'
      });

    } catch (error) {
      console.error('LinkedIn verification start error:', error);

      if (error instanceof LinkedInVerificationError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details
        });
      }

      res.status(500).json({
        success: false,
        error: 'VERIFICATION_START_FAILED',
        message: 'Failed to start LinkedIn verification'
      });
    }
  }
);

/**
 * GET /api/verification/linkedin/status/:sessionId
 * Get LinkedIn verification status
 */
router.get('/status/:sessionId',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 30 }), // 30 requests per minute
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const verificationStatus = LinkedInVerificationService.getVerificationStatus(sessionId);

      // Ensure user can only access their own verification sessions
      if (verificationStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      res.json({
        success: true,
        data: verificationStatus
      });

    } catch (error) {
      console.error('LinkedIn verification status error:', error);

      if (error instanceof LinkedInVerificationError && error.code === 'SESSION_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'STATUS_FETCH_FAILED',
        message: 'Failed to fetch verification status'
      });
    }
  }
);

/**
 * POST /api/verification/linkedin/continue/:sessionId
 * Continue LinkedIn verification process
 */
router.post('/continue/:sessionId',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 10 }), // 10 requests per minute
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = LinkedInVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      const verificationStatus = await LinkedInVerificationService.continueVerification(sessionId);

      res.json({
        success: true,
        data: verificationStatus,
        message: 'LinkedIn verification continued'
      });

    } catch (error) {
      console.error('LinkedIn verification continue error:', error);

      if (error instanceof LinkedInVerificationError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'VERIFICATION_CONTINUE_FAILED',
        message: 'Failed to continue LinkedIn verification'
      });
    }
  }
);

/**
 * POST /api/verification/linkedin/cancel/:sessionId
 * Cancel LinkedIn verification process
 */
router.post('/cancel/:sessionId',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 20 }), // 20 requests per minute
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = LinkedInVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      const cancelled = await LinkedInVerificationService.cancelVerification(sessionId);

      if (cancelled) {
        res.json({
          success: true,
          message: 'LinkedIn verification cancelled successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'SESSION_NOT_FOUND',
          message: 'Verification session not found'
        });
      }

    } catch (error) {
      console.error('LinkedIn verification cancel error:', error);

      res.status(500).json({
        success: false,
        error: 'VERIFICATION_CANCEL_FAILED',
        message: 'Failed to cancel LinkedIn verification'
      });
    }
  }
);

/**
 * GET /api/verification/linkedin/history
 * Get LinkedIn verification history for current user
 */
router.get('/history',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 10 }), // 10 requests per minute
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { limit = 10, page = 1 } = req.query;

      const history = LinkedInVerificationService.getVerificationHistory(userId);
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedHistory = history.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          verifications: paginatedHistory,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: history.length,
            pages: Math.ceil(history.length / limit),
            hasNext: endIndex < history.length,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('LinkedIn verification history error:', error);

      res.status(500).json({
        success: false,
        error: 'HISTORY_FETCH_FAILED',
        message: 'Failed to fetch verification history'
      });
    }
  }
);

/**
 * POST /api/verification/linkedin/retry-skills-mapping/:sessionId
 * Retry skills mapping with different options
 */
router.post('/retry-skills-mapping/:sessionId',
  rateLimiter({ windowMs: 5 * 60 * 1000, max: 3 }), // 3 attempts per 5 minutes
  validateRequest({
    body: {
      type: 'object',
      properties: {
        options: {
          type: 'object',
          properties: {
            createMissingSkills: { type: 'boolean' },
            customMappings: {
              type: 'object',
              additionalProperties: { type: 'string' }
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { options = {} } = req.body;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = LinkedInVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      // This would require extending the verification service to support retry
      // For now, return a not implemented response
      res.status(501).json({
        success: false,
        error: 'NOT_IMPLEMENTED',
        message: 'Skills mapping retry functionality not yet implemented'
      });

    } catch (error) {
      console.error('LinkedIn skills mapping retry error:', error);

      res.status(500).json({
        success: false,
        error: 'SKILLS_RETRY_FAILED',
        message: 'Failed to retry skills mapping'
      });
    }
  }
);

/**
 * GET /api/verification/linkedin/skills-mapping/:sessionId
 * Get detailed skills mapping results
 */
router.get('/skills-mapping/:sessionId',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 20 }), // 20 requests per minute
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const verificationStatus = LinkedInVerificationService.getVerificationStatus(sessionId);

      // Ensure user can only access their own verification sessions
      if (verificationStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      // Get the full session data for detailed skills mapping
      const session = LinkedInVerificationService.verificationSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'SESSION_NOT_FOUND',
          message: 'Verification session not found'
        });
      }

      res.json({
        success: true,
        data: {
          linkedInSkills: session.data.skills || [],
          mappedSkills: session.data.mappedSkills || [],
          unmappedSkills: session.data.unmappedSkills || [],
          mappingStats: {
            totalSkills: (session.data.skills || []).length,
            mappedCount: (session.data.mappedSkills || []).length,
            unmappedCount: (session.data.unmappedSkills || []).length,
            mappingRate: (session.data.skills || []).length > 0 ? 
              Math.round(((session.data.mappedSkills || []).length / (session.data.skills || []).length) * 100) : 0
          }
        }
      });

    } catch (error) {
      console.error('LinkedIn skills mapping fetch error:', error);

      res.status(500).json({
        success: false,
        error: 'SKILLS_MAPPING_FETCH_FAILED',
        message: 'Failed to fetch skills mapping details'
      });
    }
  }
);

/**
 * GET /api/verification/linkedin/stats
 * Get LinkedIn verification system statistics
 */
router.get('/stats',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 10 }), // 10 requests per minute
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userHistory = LinkedInVerificationService.getVerificationHistory(userId);

      const stats = {
        totalVerifications: userHistory.length,
        successfulVerifications: userHistory.filter(v => v.state === 'verified').length,
        failedVerifications: userHistory.filter(v => v.state === 'failed').length,
        lastVerification: userHistory.length > 0 ? userHistory[0] : null,
        averageSkillsMapped: userHistory.length > 0 ? 
          Math.round(userHistory.reduce((sum, v) => sum + v.data.skillsMapped, 0) / userHistory.length) : 0
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('LinkedIn verification stats error:', error);

      res.status(500).json({
        success: false,
        error: 'STATS_FETCH_FAILED',
        message: 'Failed to fetch verification statistics'
      });
    }
  }
);

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error('LinkedIn verification API error:', error);

  if (error instanceof LinkedInVerificationError) {
    return res.status(400).json({
      success: false,
      error: error.code,
      message: error.message,
      details: error.details
    });
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An internal server error occurred'
  });
});

module.exports = router;