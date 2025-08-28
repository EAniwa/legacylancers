/**
 * Manual Verification API Routes
 * Handles manual verification methods (email domain, document upload, etc.)
 */

const express = require('express');
const { ManualVerificationService, ManualVerificationError } = require('../../../services/verification/manual');
const { validateRequest } = require('../../../middleware/validation');
const { rateLimiter } = require('../../../middleware/rateLimiting');

const router = express.Router();

/**
 * GET /api/verification/manual/methods
 * Get available manual verification methods
 */
router.get('/methods',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 20 }), // 20 requests per minute
  async (req, res) => {
    try {
      const userId = req.user.id;
      const methods = ManualVerificationService.getAvailableVerificationMethods(userId);

      res.json({
        success: true,
        data: {
          methods,
          count: methods.length
        }
      });

    } catch (error) {
      console.error('Manual verification methods error:', error);
      res.status(500).json({
        success: false,
        error: 'METHODS_FETCH_FAILED',
        message: 'Failed to fetch manual verification methods'
      });
    }
  }
);

/**
 * POST /api/verification/manual/start
 * Start manual verification process
 */
router.post('/start',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 attempts per 15 minutes
  validateRequest({
    body: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['EMAIL_DOMAIN', 'DOCUMENT_UPLOAD', 'REFERENCE_CHECK', 'PORTFOLIO_REVIEW', 'SKILL_ASSESSMENT', 'ADMIN_REVIEW']
        },
        options: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            skillIds: { type: 'array', items: { type: 'string' } },
            portfolioUrl: { type: 'string', format: 'uri' }
          },
          additionalProperties: false
        }
      },
      required: ['method'],
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { method, options = {} } = req.body;
      const userId = req.user.id;

      const verificationStatus = await ManualVerificationService.startManualVerification(
        userId,
        method,
        options
      );

      res.json({
        success: true,
        data: verificationStatus,
        message: `Manual verification started: ${method.toLowerCase()}`
      });

    } catch (error) {
      console.error('Manual verification start error:', error);

      if (error instanceof ManualVerificationError) {
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
        message: 'Failed to start manual verification'
      });
    }
  }
);

/**
 * GET /api/verification/manual/status/:sessionId
 * Get manual verification status
 */
router.get('/status/:sessionId',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 30 }), // 30 requests per minute
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      const verificationStatus = ManualVerificationService.getVerificationStatus(sessionId);

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
      console.error('Manual verification status error:', error);

      if (error instanceof ManualVerificationError && error.code === 'SESSION_NOT_FOUND') {
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
 * POST /api/verification/manual/email-domain/:sessionId
 * Submit email for domain verification
 */
router.post('/email-domain/:sessionId',
  rateLimiter({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 attempts per 5 minutes
  validateRequest({
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' }
      },
      required: ['email'],
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { email } = req.body;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = ManualVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      const result = await ManualVerificationService.verifyEmailDomain(sessionId, email);

      res.json({
        success: true,
        data: result,
        message: result.state === 'verified' ? 'Email domain verified successfully' : 'Email verification processed'
      });

    } catch (error) {
      console.error('Email domain verification error:', error);

      if (error instanceof ManualVerificationError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'EMAIL_VERIFICATION_FAILED',
        message: 'Failed to verify email domain'
      });
    }
  }
);

/**
 * POST /api/verification/manual/documents/:sessionId
 * Submit documents for verification
 */
router.post('/documents/:sessionId',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 3 }), // 3 uploads per 15 minutes
  // Note: In a real implementation, you'd add file upload middleware here
  // const { fileUpload } = require('../../../middleware/file-upload');
  // fileUpload.array('documents', 10), // Max 10 files
  validateRequest({
    body: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string', minLength: 1 },
              type: { 
                type: 'string', 
                enum: ['resume', 'cover_letter', 'portfolio', 'certification', 'reference_letter', 'id_document'] 
              },
              size: { type: 'number', minimum: 0, maximum: 10 * 1024 * 1024 }, // 10MB max
              mimetype: { type: 'string' }
            },
            required: ['filename', 'type'],
            additionalProperties: false
          },
          maxItems: 10
        }
      },
      required: ['documents'],
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { documents } = req.body;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = ManualVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      // In a real implementation, documents would come from file upload middleware
      // For now, we'll simulate the document structure
      const processedDocuments = documents.map(doc => ({
        ...doc,
        buffer: Buffer.from(`Simulated content for ${doc.filename}`) // Placeholder
      }));

      const result = await ManualVerificationService.submitDocuments(sessionId, processedDocuments);

      res.json({
        success: true,
        data: result,
        message: `${documents.length} documents submitted for review`
      });

    } catch (error) {
      console.error('Document submission error:', error);

      if (error instanceof ManualVerificationError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'DOCUMENT_SUBMISSION_FAILED',
        message: 'Failed to submit documents'
      });
    }
  }
);

/**
 * POST /api/verification/manual/references/:sessionId
 * Submit professional references
 */
router.post('/references/:sessionId',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 submissions per 15 minutes
  validateRequest({
    body: {
      type: 'object',
      properties: {
        references: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              email: { type: 'string', format: 'email' },
              phone: { type: 'string', maxLength: 20 },
              company: { type: 'string', minLength: 1, maxLength: 100 },
              position: { type: 'string', minLength: 1, maxLength: 100 },
              relationship: { 
                type: 'string', 
                enum: ['Direct Supervisor', 'Manager', 'Peer', 'Colleague', 'Client', 'Mentor', 'Other'] 
              },
              yearsKnown: { type: 'number', minimum: 0, maximum: 50 }
            },
            required: ['name', 'email', 'company', 'position', 'relationship'],
            additionalProperties: false
          },
          minItems: 1,
          maxItems: 5
        }
      },
      required: ['references'],
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { references } = req.body;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = ManualVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      const result = await ManualVerificationService.submitReferences(sessionId, references);

      res.json({
        success: true,
        data: result,
        message: `${references.length} references submitted for verification`
      });

    } catch (error) {
      console.error('Reference submission error:', error);

      if (error instanceof ManualVerificationError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'REFERENCE_SUBMISSION_FAILED',
        message: 'Failed to submit references'
      });
    }
  }
);

/**
 * POST /api/verification/manual/skill-assessment/:sessionId
 * Create skill assessments
 */
router.post('/skill-assessment/:sessionId',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 assessments per 15 minutes
  validateRequest({
    body: {
      type: 'object',
      properties: {
        skillIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 10
        }
      },
      required: ['skillIds'],
      additionalProperties: false
    }
  }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { skillIds } = req.body;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = ManualVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      const result = await ManualVerificationService.createSkillAssessment(sessionId, skillIds);

      res.json({
        success: true,
        data: result,
        message: `${result.assessments.length} skill assessments created`
      });

    } catch (error) {
      console.error('Skill assessment creation error:', error);

      if (error instanceof ManualVerificationError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'ASSESSMENT_CREATION_FAILED',
        message: 'Failed to create skill assessments'
      });
    }
  }
);

/**
 * POST /api/verification/manual/cancel/:sessionId
 * Cancel manual verification process
 */
router.post('/cancel/:sessionId',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 20 }), // 20 requests per minute
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;

      // Verify session ownership
      const currentStatus = ManualVerificationService.getVerificationStatus(sessionId);
      if (currentStatus.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'ACCESS_DENIED',
          message: 'Access denied to verification session'
        });
      }

      const cancelled = await ManualVerificationService.cancelVerification(sessionId);

      if (cancelled) {
        res.json({
          success: true,
          message: 'Manual verification cancelled successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'SESSION_NOT_FOUND',
          message: 'Verification session not found'
        });
      }

    } catch (error) {
      console.error('Manual verification cancel error:', error);

      res.status(500).json({
        success: false,
        error: 'VERIFICATION_CANCEL_FAILED',
        message: 'Failed to cancel manual verification'
      });
    }
  }
);

module.exports = router;