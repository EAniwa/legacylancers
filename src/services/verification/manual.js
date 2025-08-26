/**
 * Manual Verification Service
 * Handles fallback verification methods when LinkedIn OAuth fails or is unavailable
 */

const { Profile, ProfileError } = require('../../models/Profile');
const { Skill, SkillError } = require('../../models/Skill');
const { v4: uuidv4 } = require('uuid');

class ManualVerificationError extends Error {
  constructor(message, code = 'MANUAL_VERIFICATION_ERROR', details = {}) {
    super(message);
    this.name = 'ManualVerificationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Manual Verification Service
 * Provides alternative verification methods when LinkedIn OAuth is not available
 */
class ManualVerificationService {
  constructor() {
    this.VERIFICATION_METHODS = {
      EMAIL_DOMAIN: 'email_domain',
      DOCUMENT_UPLOAD: 'document_upload', 
      REFERENCE_CHECK: 'reference_check',
      PORTFOLIO_REVIEW: 'portfolio_review',
      SKILL_ASSESSMENT: 'skill_assessment',
      ADMIN_REVIEW: 'admin_review'
    };

    this.VERIFICATION_STATES = {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress', 
      UNDER_REVIEW: 'under_review',
      VERIFIED: 'verified',
      REJECTED: 'rejected',
      EXPIRED: 'expired'
    };

    this.DOCUMENT_TYPES = {
      RESUME: 'resume',
      COVER_LETTER: 'cover_letter',
      PORTFOLIO: 'portfolio',
      CERTIFICATION: 'certification',
      REFERENCE_LETTER: 'reference_letter',
      ID_DOCUMENT: 'id_document'
    };

    // In-memory storage for verification sessions (in production would use database)
    this.verificationSessions = new Map();
    this.documentUploads = new Map();
    
    // Initialize trusted email domains
    this.trustedEmailDomains = new Set([
      'gov', 'edu', 'ac.uk', 'ac.ca', 'ac.au',
      'microsoft.com', 'google.com', 'apple.com', 'amazon.com',
      'ibm.com', 'oracle.com', 'salesforce.com', 'adobe.com'
    ]);
  }

  /**
   * Start manual verification process
   * @param {string} userId - User ID
   * @param {string} method - Verification method
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification session
   */
  async startManualVerification(userId, method, options = {}) {
    try {
      if (!this.VERIFICATION_METHODS[method.toUpperCase()]) {
        throw new ManualVerificationError(
          `Invalid verification method: ${method}`,
          'INVALID_METHOD'
        );
      }

      const sessionId = uuidv4();
      const now = new Date();

      const session = {
        id: sessionId,
        userId,
        method: method.toLowerCase(),
        state: this.VERIFICATION_STATES.PENDING,
        options: {
          ...options
        },
        progress: {
          currentStep: 'started',
          stepsCompleted: 0,
          totalSteps: this.getStepsForMethod(method),
          steps: this.initializeStepsForMethod(method)
        },
        data: {
          submittedDocuments: [],
          skillAssessments: [],
          referenceChecks: [],
          adminNotes: []
        },
        errors: [],
        warnings: [],
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      this.verificationSessions.set(sessionId, session);
      return this.getVerificationStatus(sessionId);

    } catch (error) {
      throw new ManualVerificationError(
        `Failed to start manual verification: ${error.message}`,
        'START_FAILED',
        { userId, method, error: error.message }
      );
    }
  }

  /**
   * Get steps for verification method
   * @param {string} method - Verification method
   * @returns {number} Number of steps
   */
  getStepsForMethod(method) {
    const stepCounts = {
      email_domain: 2,
      document_upload: 3,
      reference_check: 4,
      portfolio_review: 3,
      skill_assessment: 5,
      admin_review: 2
    };
    return stepCounts[method.toLowerCase()] || 3;
  }

  /**
   * Initialize steps for verification method
   * @param {string} method - Verification method
   * @returns {Array} Steps array
   */
  initializeStepsForMethod(method) {
    const stepTemplates = {
      email_domain: [
        { name: 'email_verification', message: 'Verify email domain', status: 'pending' },
        { name: 'domain_validation', message: 'Validate trusted domain', status: 'pending' }
      ],
      document_upload: [
        { name: 'document_upload', message: 'Upload verification documents', status: 'pending' },
        { name: 'document_review', message: 'Document under review', status: 'pending' },
        { name: 'verification_complete', message: 'Verification complete', status: 'pending' }
      ],
      reference_check: [
        { name: 'reference_submission', message: 'Submit reference contacts', status: 'pending' },
        { name: 'reference_contact', message: 'Contact references', status: 'pending' },
        { name: 'reference_verification', message: 'Verify reference responses', status: 'pending' },
        { name: 'verification_complete', message: 'Verification complete', status: 'pending' }
      ],
      portfolio_review: [
        { name: 'portfolio_submission', message: 'Submit portfolio for review', status: 'pending' },
        { name: 'portfolio_review', message: 'Portfolio under review', status: 'pending' },
        { name: 'verification_complete', message: 'Verification complete', status: 'pending' }
      ],
      skill_assessment: [
        { name: 'assessment_selection', message: 'Select skills to assess', status: 'pending' },
        { name: 'assessment_preparation', message: 'Prepare assessment', status: 'pending' },
        { name: 'assessment_execution', message: 'Take skill assessment', status: 'pending' },
        { name: 'assessment_review', message: 'Assessment under review', status: 'pending' },
        { name: 'verification_complete', message: 'Verification complete', status: 'pending' }
      ],
      admin_review: [
        { name: 'admin_submission', message: 'Submit for admin review', status: 'pending' },
        { name: 'admin_verification', message: 'Admin verification in progress', status: 'pending' }
      ]
    };

    return stepTemplates[method.toLowerCase()] || [
      { name: 'generic_step', message: 'Processing verification', status: 'pending' }
    ];
  }

  /**
   * Submit documents for verification
   * @param {string} sessionId - Verification session ID
   * @param {Array} documents - Array of document objects
   * @returns {Promise<Object>} Updated session
   */
  async submitDocuments(sessionId, documents) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new ManualVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    try {
      const processedDocuments = [];

      for (const doc of documents) {
        const processedDoc = await this.processDocument(doc);
        processedDocuments.push(processedDoc);
      }

      session.data.submittedDocuments.push(...processedDocuments);
      session.state = this.VERIFICATION_STATES.UNDER_REVIEW;
      this.updateStepStatus(session, 'document_upload', 'completed', 'Documents uploaded successfully');
      this.updateStepStatus(session, 'document_review', 'in_progress', 'Documents under review');
      session.updatedAt = new Date();

      this.verificationSessions.set(sessionId, session);
      return this.getVerificationStatus(sessionId);

    } catch (error) {
      session.errors.push({
        type: 'DOCUMENT_SUBMISSION_FAILED',
        message: error.message,
        timestamp: new Date()
      });
      throw new ManualVerificationError(
        `Document submission failed: ${error.message}`,
        'DOCUMENT_SUBMISSION_FAILED'
      );
    }
  }

  /**
   * Process uploaded document
   * @param {Object} document - Document data
   * @returns {Promise<Object>} Processed document
   */
  async processDocument(document) {
    const documentId = uuidv4();
    const now = new Date();

    const processedDoc = {
      id: documentId,
      originalName: document.filename || 'unknown',
      type: document.type || this.DOCUMENT_TYPES.RESUME,
      size: document.size || 0,
      mimeType: document.mimetype || 'application/octet-stream',
      uploadedAt: now,
      status: 'pending_review',
      metadata: {
        extractedText: '', // Would extract text from document
        confidence: 0.8,
        validationResults: {
          format: true,
          content: true,
          authenticity: 'unknown'
        }
      }
    };

    // Store document (in production would upload to secure storage)
    this.documentUploads.set(documentId, {
      ...processedDoc,
      fileData: document.buffer || null
    });

    return processedDoc;
  }

  /**
   * Verify email domain for trusted domain verification
   * @param {string} sessionId - Verification session ID
   * @param {string} email - Email address to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyEmailDomain(sessionId, email) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new ManualVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    try {
      const domain = email.split('@')[1];
      if (!domain) {
        throw new ManualVerificationError('Invalid email format', 'INVALID_EMAIL');
      }

      // Check if domain is in trusted domains
      const domainParts = domain.split('.');
      const topLevelDomain = domainParts[domainParts.length - 1];
      const isDomainTrusted = this.trustedEmailDomains.has(domain) || 
                             this.trustedEmailDomains.has(topLevelDomain) ||
                             this.isEducationalDomain(domain) ||
                             this.isGovernmentDomain(domain);

      if (isDomainTrusted) {
        session.state = this.VERIFICATION_STATES.VERIFIED;
        this.updateStepStatus(session, 'email_verification', 'completed', 'Email verified');
        this.updateStepStatus(session, 'domain_validation', 'completed', 'Trusted domain confirmed');
        session.progress.stepsCompleted = session.progress.totalSteps;

        session.data.emailVerification = {
          email,
          domain,
          verifiedAt: new Date(),
          trustLevel: 'high',
          domainType: this.getDomainType(domain)
        };
      } else {
        session.warnings.push({
          type: 'UNTRUSTED_DOMAIN',
          message: `Email domain ${domain} is not in trusted domains list`,
          email,
          domain
        });

        this.updateStepStatus(session, 'email_verification', 'completed', 'Email format verified');
        this.updateStepStatus(session, 'domain_validation', 'failed', 'Domain not in trusted list');
      }

      session.updatedAt = new Date();
      this.verificationSessions.set(sessionId, session);

      return this.getVerificationStatus(sessionId);

    } catch (error) {
      session.errors.push({
        type: 'EMAIL_VERIFICATION_FAILED',
        message: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Submit references for verification
   * @param {string} sessionId - Verification session ID  
   * @param {Array} references - Array of reference objects
   * @returns {Promise<Object>} Updated session
   */
  async submitReferences(sessionId, references) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new ManualVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    try {
      const processedReferences = references.map(ref => ({
        id: uuidv4(),
        name: ref.name,
        email: ref.email,
        phone: ref.phone || null,
        company: ref.company,
        position: ref.position,
        relationship: ref.relationship,
        yearsKnown: ref.yearsKnown || 0,
        submittedAt: new Date(),
        status: 'pending_contact',
        responseReceived: false
      }));

      session.data.referenceChecks = processedReferences;
      session.state = this.VERIFICATION_STATES.UNDER_REVIEW;
      
      this.updateStepStatus(session, 'reference_submission', 'completed', 
        `${references.length} references submitted`);
      this.updateStepStatus(session, 'reference_contact', 'in_progress', 
        'Contacting references...');

      session.updatedAt = new Date();
      this.verificationSessions.set(sessionId, session);

      return this.getVerificationStatus(sessionId);

    } catch (error) {
      session.errors.push({
        type: 'REFERENCE_SUBMISSION_FAILED',
        message: error.message,
        timestamp: new Date()
      });
      throw new ManualVerificationError(
        `Reference submission failed: ${error.message}`,
        'REFERENCE_SUBMISSION_FAILED'
      );
    }
  }

  /**
   * Create skill assessment for verification
   * @param {string} sessionId - Verification session ID
   * @param {Array} skillIds - Array of skill IDs to assess
   * @returns {Promise<Object>} Assessment details
   */
  async createSkillAssessment(sessionId, skillIds) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new ManualVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    try {
      const assessments = [];

      for (const skillId of skillIds) {
        const skill = await Skill.findById(skillId);
        if (!skill) {
          session.warnings.push({
            type: 'SKILL_NOT_FOUND',
            message: `Skill with ID ${skillId} not found`,
            skillId
          });
          continue;
        }

        const assessment = {
          id: uuidv4(),
          skillId: skill.id,
          skillName: skill.name,
          category: skill.category,
          assessmentType: this.getAssessmentTypeForSkill(skill),
          questions: await this.generateAssessmentQuestions(skill),
          timeLimit: 30, // minutes
          status: 'not_started',
          createdAt: new Date()
        };

        assessments.push(assessment);
      }

      session.data.skillAssessments = assessments;
      this.updateStepStatus(session, 'assessment_selection', 'completed', 
        `${assessments.length} assessments prepared`);
      this.updateStepStatus(session, 'assessment_preparation', 'completed', 
        'Assessments ready to take');

      session.updatedAt = new Date();
      this.verificationSessions.set(sessionId, session);

      return {
        sessionId,
        assessments: assessments.map(a => ({
          id: a.id,
          skillName: a.skillName,
          category: a.category,
          assessmentType: a.assessmentType,
          timeLimit: a.timeLimit,
          questionCount: a.questions.length
        }))
      };

    } catch (error) {
      throw new ManualVerificationError(
        `Failed to create skill assessment: ${error.message}`,
        'ASSESSMENT_CREATION_FAILED'
      );
    }
  }

  /**
   * Get assessment type for skill
   * @param {Object} skill - Skill object
   * @returns {string} Assessment type
   */
  getAssessmentTypeForSkill(skill) {
    const technicalCategories = ['technical', 'analytical'];
    const practicalCategories = ['project-management', 'business'];

    if (technicalCategories.includes(skill.category)) {
      return 'multiple_choice_technical';
    } else if (practicalCategories.includes(skill.category)) {
      return 'scenario_based';
    } else {
      return 'self_assessment';
    }
  }

  /**
   * Generate assessment questions for skill
   * @param {Object} skill - Skill object
   * @returns {Promise<Array>} Assessment questions
   */
  async generateAssessmentQuestions(skill) {
    // In a real implementation, this would generate or fetch actual assessment questions
    const questionTemplates = {
      'multiple_choice_technical': [
        {
          type: 'multiple_choice',
          question: `What is a key characteristic of ${skill.name}?`,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct: 0,
          points: 10
        }
      ],
      'scenario_based': [
        {
          type: 'scenario',
          question: `Describe how you would apply ${skill.name} in a real-world scenario.`,
          expectedLength: 200,
          points: 15
        }
      ],
      'self_assessment': [
        {
          type: 'rating',
          question: `Rate your proficiency in ${skill.name} from 1-10`,
          min: 1,
          max: 10,
          points: 5
        }
      ]
    };

    const assessmentType = this.getAssessmentTypeForSkill(skill);
    const templates = questionTemplates[assessmentType] || questionTemplates['self_assessment'];
    
    // Generate 3-5 questions per skill
    const questionCount = Math.min(5, Math.max(3, Math.floor(Math.random() * 3) + 3));
    const questions = [];

    for (let i = 0; i < questionCount; i++) {
      const template = templates[i % templates.length];
      questions.push({
        id: uuidv4(),
        ...template,
        order: i + 1
      });
    }

    return questions;
  }

  /**
   * Update step status in session
   * @param {Object} session - Verification session
   * @param {string} stepName - Step name
   * @param {string} status - New status
   * @param {string} message - Status message
   */
  updateStepStatus(session, stepName, status, message) {
    const step = session.progress.steps.find(s => s.name === stepName);
    if (step) {
      step.status = status;
      step.message = message;
      step.updatedAt = new Date();

      if (status === 'completed') {
        session.progress.stepsCompleted++;
      }
    }
  }

  /**
   * Check if domain is educational
   * @param {string} domain - Domain to check
   * @returns {boolean} Is educational domain
   */
  isEducationalDomain(domain) {
    const eduSuffixes = ['.edu', '.ac.', '.university', '.college'];
    return eduSuffixes.some(suffix => domain.includes(suffix));
  }

  /**
   * Check if domain is government
   * @param {string} domain - Domain to check
   * @returns {boolean} Is government domain
   */
  isGovernmentDomain(domain) {
    const govSuffixes = ['.gov', '.mil', '.state.', '.federal'];
    return govSuffixes.some(suffix => domain.includes(suffix));
  }

  /**
   * Get domain type
   * @param {string} domain - Domain to categorize
   * @returns {string} Domain type
   */
  getDomainType(domain) {
    if (this.isEducationalDomain(domain)) return 'educational';
    if (this.isGovernmentDomain(domain)) return 'government';
    if (this.trustedEmailDomains.has(domain)) return 'corporate';
    return 'unknown';
  }

  /**
   * Get verification status
   * @param {string} sessionId - Session ID
   * @returns {Object} Verification status
   */
  getVerificationStatus(sessionId) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new ManualVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      session.state = this.VERIFICATION_STATES.EXPIRED;
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      method: session.method,
      state: session.state,
      progress: {
        ...session.progress,
        percentComplete: Math.round((session.progress.stepsCompleted / session.progress.totalSteps) * 100)
      },
      data: {
        documentsSubmitted: session.data.submittedDocuments?.length || 0,
        referencesSubmitted: session.data.referenceChecks?.length || 0,
        assessmentsCreated: session.data.skillAssessments?.length || 0,
        emailVerified: !!session.data.emailVerification
      },
      errors: session.errors,
      warnings: session.warnings,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Cancel verification process
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success status
   */
  async cancelVerification(sessionId) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.state = this.VERIFICATION_STATES.REJECTED;
    session.errors.push({
      type: 'USER_CANCELLED',
      message: 'Verification cancelled by user',
      timestamp: new Date()
    });
    session.updatedAt = new Date();
    
    this.verificationSessions.set(sessionId, session);
    return true;
  }

  /**
   * Get available verification methods
   * @param {string} userId - User ID
   * @returns {Array} Available methods
   */
  getAvailableVerificationMethods(userId) {
    return [
      {
        method: this.VERIFICATION_METHODS.EMAIL_DOMAIN,
        name: 'Email Domain Verification',
        description: 'Verify using a trusted email domain (edu, gov, major corporations)',
        estimatedTime: '5 minutes',
        requirements: ['Valid email from trusted domain'],
        successRate: 85
      },
      {
        method: this.VERIFICATION_METHODS.DOCUMENT_UPLOAD,
        name: 'Document Upload',
        description: 'Upload professional documents (resume, certifications, references)',
        estimatedTime: '2-3 business days',
        requirements: ['Professional documents', 'Valid identification'],
        successRate: 95
      },
      {
        method: this.VERIFICATION_METHODS.REFERENCE_CHECK,
        name: 'Professional References',
        description: 'Verification through professional references',
        estimatedTime: '3-5 business days',
        requirements: ['2-3 professional references', 'Valid contact information'],
        successRate: 90
      },
      {
        method: this.VERIFICATION_METHODS.PORTFOLIO_REVIEW,
        name: 'Portfolio Review',
        description: 'Manual review of professional portfolio and work samples',
        estimatedTime: '1-2 business days',
        requirements: ['Professional portfolio', 'Work samples'],
        successRate: 80
      },
      {
        method: this.VERIFICATION_METHODS.SKILL_ASSESSMENT,
        name: 'Skill Assessment',
        description: 'Take assessments to verify claimed skills',
        estimatedTime: '30-60 minutes',
        requirements: ['Selected skills for assessment'],
        successRate: 75
      },
      {
        method: this.VERIFICATION_METHODS.ADMIN_REVIEW,
        name: 'Admin Manual Review',
        description: 'Direct review by platform administrators',
        estimatedTime: '5-7 business days',
        requirements: ['Complete profile information'],
        successRate: 100
      }
    ];
  }

  /**
   * Reset service state (for testing)
   */
  reset() {
    this.verificationSessions.clear();
    this.documentUploads.clear();
  }
}

// Export singleton instance
module.exports = {
  ManualVerificationService: new ManualVerificationService(),
  ManualVerificationError
};