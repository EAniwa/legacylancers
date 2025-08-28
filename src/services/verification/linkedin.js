/**
 * LinkedIn Verification Service
 * Handles LinkedIn profile import, skills mapping, and verification workflow
 */

const LinkedInProvider = require('../../auth/oauth/providers/linkedin');
const { Profile, ProfileError } = require('../../models/Profile');
const { Skill, SkillError } = require('../../models/Skill');
const { v4: uuidv4 } = require('uuid');

class LinkedInVerificationError extends Error {
  constructor(message, code = 'LINKEDIN_VERIFICATION_ERROR', details = {}) {
    super(message);
    this.name = 'LinkedInVerificationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * LinkedIn Verification Service
 * Manages verification workflow, profile import, and skills mapping
 */
class LinkedInVerificationService {
  constructor() {
    this.linkedInProvider = new LinkedInProvider();
    
    // Verification states and workflow
    this.VERIFICATION_STATES = {
      PENDING: 'pending',
      IN_PROGRESS: 'in_progress',
      DATA_IMPORTED: 'data_imported',
      SKILLS_MAPPED: 'skills_mapped',
      VERIFIED: 'verified',
      FAILED: 'failed',
      REJECTED: 'rejected',
      EXPIRED: 'expired'
    };

    this.VERIFICATION_TYPES = {
      LINKEDIN_PROFILE: 'linkedin_profile',
      LINKEDIN_SKILLS: 'linkedin_skills',
      LINKEDIN_EXPERIENCE: 'linkedin_experience',
      MANUAL_FALLBACK: 'manual_fallback'
    };

    // In-memory storage for verification sessions (in production would use Redis)
    this.verificationSessions = new Map();
    this.skillMappings = new Map();
    
    // Initialize skill mappings
    this.initializeSkillMappings();
  }

  /**
   * Initialize common LinkedIn to platform skill mappings
   */
  initializeSkillMappings() {
    const commonMappings = {
      // Technical skills
      'javascript': ['JavaScript', 'JS', 'ECMAScript'],
      'python': ['Python', 'Python Programming'],
      'java': ['Java', 'Java Programming'],
      'sql': ['SQL', 'Database Management', 'Relational Databases'],
      'react': ['React', 'React.js', 'ReactJS'],
      'node.js': ['Node.js', 'NodeJS', 'Server-side JavaScript'],
      
      // Business skills
      'project management': ['Project Management', 'PMP', 'Agile Project Management'],
      'strategic planning': ['Strategic Planning', 'Strategy', 'Business Strategy'],
      'leadership': ['Leadership', 'Team Leadership', 'People Management'],
      'marketing': ['Marketing', 'Digital Marketing', 'Marketing Strategy'],
      'sales': ['Sales', 'Sales Management', 'Business Development'],
      
      // Soft skills
      'communication': ['Communication', 'Written Communication', 'Verbal Communication'],
      'problem solving': ['Problem Solving', 'Critical Thinking', 'Analytical Thinking'],
      'teamwork': ['Teamwork', 'Collaboration', 'Team Building'],
      
      // Industry specific
      'financial analysis': ['Financial Analysis', 'Financial Modeling', 'Finance'],
      'data analysis': ['Data Analysis', 'Analytics', 'Data Science'],
      'consulting': ['Consulting', 'Business Consulting', 'Management Consulting']
    };

    for (const [key, variations] of Object.entries(commonMappings)) {
      this.skillMappings.set(key.toLowerCase(), variations);
    }
  }

  /**
   * Start LinkedIn verification process
   * @param {string} userId - User ID
   * @param {string} accessToken - LinkedIn access token
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification session
   */
  async startVerification(userId, accessToken, options = {}) {
    try {
      const sessionId = uuidv4();
      const now = new Date();

      const session = {
        id: sessionId,
        userId,
        accessToken,
        state: this.VERIFICATION_STATES.PENDING,
        type: this.VERIFICATION_TYPES.LINKEDIN_PROFILE,
        options: {
          importProfile: options.importProfile !== false,
          importSkills: options.importSkills !== false,
          importExperience: options.importExperience !== false,
          importEducation: options.importEducation !== false,
          autoMapSkills: options.autoMapSkills !== false,
          privacyLevel: options.privacyLevel || 'selective', // 'full', 'selective', 'minimal'
          ...options
        },
        progress: {
          currentStep: 'starting',
          totalSteps: 6,
          completedSteps: 0,
          steps: [
            { name: 'profile_fetch', status: 'pending', message: 'Fetching LinkedIn profile' },
            { name: 'data_import', status: 'pending', message: 'Importing profile data' },
            { name: 'skills_mapping', status: 'pending', message: 'Mapping skills to platform' },
            { name: 'experience_processing', status: 'pending', message: 'Processing work experience' },
            { name: 'validation', status: 'pending', message: 'Validating imported data' },
            { name: 'verification', status: 'pending', message: 'Completing verification' }
          ]
        },
        data: {
          linkedInProfile: null,
          positions: [],
          education: [],
          skills: [],
          mappedSkills: []
        },
        errors: [],
        warnings: [],
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours
      };

      this.verificationSessions.set(sessionId, session);

      // Start the verification process
      await this.processVerificationStep(sessionId);

      return this.getVerificationStatus(sessionId);

    } catch (error) {
      throw new LinkedInVerificationError(
        `Failed to start LinkedIn verification: ${error.message}`,
        'VERIFICATION_START_FAILED',
        { userId, error: error.message }
      );
    }
  }

  /**
   * Process verification step
   * @param {string} sessionId - Verification session ID
   * @returns {Promise<Object>} Updated session
   */
  async processVerificationStep(sessionId) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new LinkedInVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    try {
      switch (session.state) {
        case this.VERIFICATION_STATES.PENDING:
          await this.fetchLinkedInProfile(session);
          break;
        case this.VERIFICATION_STATES.IN_PROGRESS:
          await this.importProfileData(session);
          break;
        case this.VERIFICATION_STATES.DATA_IMPORTED:
          await this.mapSkillsToProfile(session);
          break;
        case this.VERIFICATION_STATES.SKILLS_MAPPED:
          await this.validateAndComplete(session);
          break;
        default:
          // Session is in final state
          break;
      }

      session.updatedAt = new Date();
      this.verificationSessions.set(sessionId, session);

      return session;

    } catch (error) {
      await this.handleVerificationError(session, error);
      throw error;
    }
  }

  /**
   * Fetch LinkedIn profile data
   * @param {Object} session - Verification session
   */
  async fetchLinkedInProfile(session) {
    try {
      this.updateStepStatus(session, 'profile_fetch', 'in_progress', 'Fetching LinkedIn profile...');
      
      // Get basic profile
      const profile = await this.linkedInProvider.getProfile(session.accessToken);
      session.data.linkedInProfile = profile;

      // Get comprehensive data
      const fields = [];
      if (session.options.importExperience) fields.push('positions');
      if (session.options.importEducation) fields.push('education');
      if (session.options.importSkills) fields.push('skills');

      const comprehensiveData = await this.linkedInProvider.getComprehensiveProfile(
        session.accessToken,
        fields
      );

      session.data.positions = comprehensiveData.positions || [];
      session.data.education = comprehensiveData.education || [];
      session.data.skills = comprehensiveData.skills || [];

      this.updateStepStatus(session, 'profile_fetch', 'completed', 'LinkedIn profile fetched successfully');
      session.state = this.VERIFICATION_STATES.IN_PROGRESS;
      session.progress.completedSteps++;

    } catch (error) {
      this.updateStepStatus(session, 'profile_fetch', 'failed', `Failed to fetch profile: ${error.message}`);
      throw new LinkedInVerificationError(
        `Failed to fetch LinkedIn profile: ${error.message}`,
        'PROFILE_FETCH_FAILED'
      );
    }
  }

  /**
   * Import profile data to platform
   * @param {Object} session - Verification session
   */
  async importProfileData(session) {
    try {
      this.updateStepStatus(session, 'data_import', 'in_progress', 'Importing profile data...');
      
      const userId = session.userId;
      const linkedInData = session.data.linkedInProfile;

      // Get or create user profile
      let userProfile = await Profile.findByUserId(userId);
      if (!userProfile && session.options.importProfile) {
        // Create new profile with LinkedIn data
        const profileData = this.mapLinkedInToProfileData(linkedInData, session);
        userProfile = await Profile.create(userId, profileData);
      } else if (userProfile && session.options.importProfile) {
        // Update existing profile with LinkedIn data
        const updateData = this.mapLinkedInToProfileData(linkedInData, session, true);
        userProfile = await Profile.update(userProfile.id, updateData);
      }

      session.data.importedProfileId = userProfile?.id;
      
      this.updateStepStatus(session, 'data_import', 'completed', 'Profile data imported successfully');
      session.state = this.VERIFICATION_STATES.DATA_IMPORTED;
      session.progress.completedSteps++;

    } catch (error) {
      this.updateStepStatus(session, 'data_import', 'failed', `Data import failed: ${error.message}`);
      throw new LinkedInVerificationError(
        `Failed to import profile data: ${error.message}`,
        'DATA_IMPORT_FAILED'
      );
    }
  }

  /**
   * Map LinkedIn skills to platform skills
   * @param {Object} session - Verification session
   */
  async mapSkillsToProfile(session) {
    try {
      this.updateStepStatus(session, 'skills_mapping', 'in_progress', 'Mapping skills to platform...');
      
      if (!session.options.importSkills || !session.data.skills.length) {
        this.updateStepStatus(session, 'skills_mapping', 'skipped', 'Skills mapping skipped');
        session.state = this.VERIFICATION_STATES.SKILLS_MAPPED;
        session.progress.completedSteps++;
        return;
      }

      const mappedSkills = [];
      const unmappedSkills = [];

      for (const linkedInSkill of session.data.skills) {
        const mappingResult = await this.mapSkillToPlatform(linkedInSkill);
        if (mappingResult.success) {
          mappedSkills.push(mappingResult.skill);
        } else {
          unmappedSkills.push(linkedInSkill);
        }
      }

      session.data.mappedSkills = mappedSkills;
      session.data.unmappedSkills = unmappedSkills;

      if (unmappedSkills.length > 0) {
        session.warnings.push({
          type: 'UNMAPPED_SKILLS',
          message: `${unmappedSkills.length} skills could not be automatically mapped`,
          skills: unmappedSkills.map(s => s.name)
        });
      }

      this.updateStepStatus(session, 'skills_mapping', 'completed', 
        `Mapped ${mappedSkills.length} skills, ${unmappedSkills.length} unmapped`);
      session.state = this.VERIFICATION_STATES.SKILLS_MAPPED;
      session.progress.completedSteps++;

    } catch (error) {
      this.updateStepStatus(session, 'skills_mapping', 'failed', `Skills mapping failed: ${error.message}`);
      throw new LinkedInVerificationError(
        `Failed to map skills: ${error.message}`,
        'SKILLS_MAPPING_FAILED'
      );
    }
  }

  /**
   * Validate and complete verification
   * @param {Object} session - Verification session
   */
  async validateAndComplete(session) {
    try {
      this.updateStepStatus(session, 'validation', 'in_progress', 'Validating imported data...');
      
      // Validate profile data
      const validationResults = this.validateImportedData(session);
      session.data.validationResults = validationResults;

      if (validationResults.hasErrors) {
        session.errors.push(...validationResults.errors);
        this.updateStepStatus(session, 'validation', 'failed', 'Data validation failed');
        session.state = this.VERIFICATION_STATES.FAILED;
        return;
      }

      this.updateStepStatus(session, 'validation', 'completed', 'Data validation passed');
      session.progress.completedSteps++;

      // Complete verification
      this.updateStepStatus(session, 'verification', 'in_progress', 'Completing verification...');
      
      await this.finalizeVerification(session);

      this.updateStepStatus(session, 'verification', 'completed', 'LinkedIn verification completed');
      session.state = this.VERIFICATION_STATES.VERIFIED;
      session.progress.completedSteps++;

    } catch (error) {
      this.updateStepStatus(session, 'validation', 'failed', `Validation failed: ${error.message}`);
      session.state = this.VERIFICATION_STATES.FAILED;
      throw new LinkedInVerificationError(
        `Failed to complete verification: ${error.message}`,
        'VERIFICATION_COMPLETION_FAILED'
      );
    }
  }

  /**
   * Map LinkedIn profile data to platform profile format
   * @param {Object} linkedInData - LinkedIn profile data
   * @param {Object} session - Verification session
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Object} Mapped profile data
   */
  mapLinkedInToProfileData(linkedInData, session, isUpdate = false) {
    const mapped = {};

    if (session.options.privacyLevel === 'full' || session.options.privacyLevel === 'selective') {
      if (linkedInData.firstName && linkedInData.lastName) {
        mapped.displayName = `${linkedInData.firstName} ${linkedInData.lastName}`.trim();
      }
      
      if (linkedInData.headline) {
        mapped.headline = linkedInData.headline;
      }
      
      if (linkedInData.profilePicture) {
        mapped.profilePhotoUrl = linkedInData.profilePicture;
      }
    }

    if (session.options.privacyLevel === 'full') {
      // Include more detailed information
      if (session.data.positions.length > 0) {
        const currentPosition = session.data.positions.find(p => p.isCurrent);
        if (currentPosition) {
          mapped.previousCompany = currentPosition.companyName;
          mapped.previousTitle = currentPosition.title;
        }
      }

      // Set LinkedIn URL and verification
      mapped.linkedinUrl = linkedInData.providerURL;
      mapped.linkedinVerified = true;
    }

    return mapped;
  }

  /**
   * Map LinkedIn skill to platform skill
   * @param {Object} linkedInSkill - LinkedIn skill data
   * @returns {Promise<Object>} Mapping result
   */
  async mapSkillToPlatform(linkedInSkill) {
    try {
      const skillName = linkedInSkill.name.toLowerCase();
      
      // Check direct mapping first
      let platformSkill = await Skill.findByName(linkedInSkill.name);
      
      if (!platformSkill) {
        // Check skill mappings
        for (const [key, variations] of this.skillMappings.entries()) {
          if (skillName.includes(key) || variations.some(v => 
            skillName.includes(v.toLowerCase()) || v.toLowerCase().includes(skillName)
          )) {
            // Find the primary skill name from variations
            const primarySkill = variations[0];
            platformSkill = await Skill.findByName(primarySkill);
            break;
          }
        }
      }

      if (!platformSkill) {
        // Create new skill if auto-creation is enabled
        const category = this.inferSkillCategory(linkedInSkill.name);
        platformSkill = await Skill.create({
          name: linkedInSkill.name,
          category: category,
          description: `Imported from LinkedIn`,
          verified: false
        });
      }

      // Track skill usage
      await Skill.trackUsage(
        platformSkill.id,
        'linkedin_import',
        linkedInSkill.proficiencyLevel
      );

      return {
        success: true,
        skill: {
          platformSkillId: platformSkill.id,
          name: platformSkill.name,
          linkedInSkill: linkedInSkill,
          proficiencyLevel: linkedInSkill.proficiencyLevel,
          endorsements: linkedInSkill.endorsements
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        linkedInSkill: linkedInSkill
      };
    }
  }

  /**
   * Infer skill category from skill name
   * @param {string} skillName - Skill name
   * @returns {string} Inferred category
   */
  inferSkillCategory(skillName) {
    const name = skillName.toLowerCase();
    
    const categoryKeywords = {
      'technical': ['javascript', 'python', 'java', 'sql', 'programming', 'software', 'development', 'coding'],
      'leadership': ['leadership', 'management', 'team', 'supervision', 'director', 'executive'],
      'communication': ['communication', 'presentation', 'speaking', 'writing', 'negotiation'],
      'analytical': ['analysis', 'analytics', 'data', 'research', 'statistics', 'modeling'],
      'project-management': ['project', 'agile', 'scrum', 'planning', 'coordination'],
      'business': ['strategy', 'business', 'marketing', 'sales', 'finance', 'accounting'],
      'creative': ['design', 'creative', 'art', 'graphics', 'video', 'photography']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'soft'; // Default category
  }

  /**
   * Validate imported data
   * @param {Object} session - Verification session
   * @returns {Object} Validation results
   */
  validateImportedData(session) {
    const results = {
      hasErrors: false,
      errors: [],
      warnings: [],
      validations: {
        profile: { valid: true, issues: [] },
        skills: { valid: true, issues: [] },
        experience: { valid: true, issues: [] }
      }
    };

    // Validate profile data
    if (session.options.importProfile && !session.data.linkedInProfile) {
      results.validations.profile.valid = false;
      results.validations.profile.issues.push('LinkedIn profile data is missing');
      results.errors.push('Profile validation failed: LinkedIn profile data is missing');
      results.hasErrors = true;
    }

    // Validate skills data
    if (session.options.importSkills) {
      if (session.data.unmappedSkills && session.data.unmappedSkills.length > session.data.skills.length / 2) {
        results.warnings.push('More than 50% of skills could not be mapped automatically');
      }
    }

    return results;
  }

  /**
   * Finalize verification process
   * @param {Object} session - Verification session
   */
  async finalizeVerification(session) {
    try {
      // Update user profile with verification status
      if (session.data.importedProfileId) {
        await Profile.update(session.data.importedProfileId, {
          linkedinVerified: true,
          verificationStatus: 'verified'
        });
      }

      // Store verification record
      session.data.verificationRecord = {
        type: 'linkedin_profile_import',
        completedAt: new Date(),
        dataImported: {
          profile: !!session.data.linkedInProfile,
          skills: session.data.mappedSkills.length,
          positions: session.data.positions.length,
          education: session.data.education.length
        },
        privacyLevel: session.options.privacyLevel
      };

    } catch (error) {
      throw new LinkedInVerificationError(
        `Failed to finalize verification: ${error.message}`,
        'FINALIZATION_FAILED'
      );
    }
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
    }
  }

  /**
   * Handle verification error
   * @param {Object} session - Verification session
   * @param {Error} error - Error that occurred
   */
  async handleVerificationError(session, error) {
    session.state = this.VERIFICATION_STATES.FAILED;
    session.errors.push({
      type: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date(),
      step: session.progress.currentStep
    });
    session.updatedAt = new Date();
    this.verificationSessions.set(session.id, session);
  }

  /**
   * Get verification status
   * @param {string} sessionId - Session ID
   * @returns {Object} Verification status
   */
  getVerificationStatus(sessionId) {
    const session = this.verificationSessions.get(sessionId);
    if (!session) {
      throw new LinkedInVerificationError('Verification session not found', 'SESSION_NOT_FOUND');
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      session.state = this.VERIFICATION_STATES.EXPIRED;
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      state: session.state,
      progress: {
        ...session.progress,
        percentComplete: Math.round((session.progress.completedSteps / session.progress.totalSteps) * 100)
      },
      data: {
        profileImported: !!session.data.linkedInProfile,
        skillsMapped: session.data.mappedSkills?.length || 0,
        experienceImported: session.data.positions?.length || 0,
        educationImported: session.data.education?.length || 0
      },
      errors: session.errors,
      warnings: session.warnings,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Continue verification process
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Updated verification status
   */
  async continueVerification(sessionId) {
    await this.processVerificationStep(sessionId);
    return this.getVerificationStatus(sessionId);
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

    session.state = this.VERIFICATION_STATES.FAILED;
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
   * Get verification history for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of verification sessions
   */
  getVerificationHistory(userId) {
    const userSessions = [];
    
    for (const session of this.verificationSessions.values()) {
      if (session.userId === userId) {
        userSessions.push(this.getVerificationStatus(session.id));
      }
    }

    return userSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Clean up expired sessions
   * @returns {number} Number of cleaned sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.verificationSessions.entries()) {
      if (now > session.expiresAt) {
        this.verificationSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Reset service state (for testing)
   */
  reset() {
    this.verificationSessions.clear();
    this.skillMappings.clear();
    this.initializeSkillMappings();
  }
}

// Export singleton instance
module.exports = {
  LinkedInVerificationService: new LinkedInVerificationService(),
  LinkedInVerificationError
};