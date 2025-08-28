/**
 * LinkedIn Verification Service Tests
 * Comprehensive tests for LinkedIn verification system
 */

const { LinkedInVerificationService, LinkedInVerificationError } = require('../../../src/services/verification/linkedin');
const { Profile } = require('../../../src/models/Profile');
const { Skill } = require('../../../src/models/Skill');

// Mock LinkedIn provider
jest.mock('../../../src/auth/oauth/providers/linkedin', () => {
  return jest.fn().mockImplementation(() => ({
    getProfile: jest.fn(),
    getComprehensiveProfile: jest.fn(),
    mapPosition: jest.fn(),
    mapEducation: jest.fn(),
    mapSkill: jest.fn()
  }));
});

describe('LinkedInVerificationService', () => {
  let service;
  let mockUserId;
  let mockAccessToken;

  beforeEach(async () => {
    service = LinkedInVerificationService;
    service.reset();
    await Profile.reset();
    await Skill.reset();
    
    mockUserId = 'user-123';
    mockAccessToken = 'linkedin-token-456';
  });

  afterEach(() => {
    service.reset();
  });

  describe('startVerification', () => {
    it('should start LinkedIn verification process successfully', async () => {
      const options = {
        importProfile: true,
        importSkills: true,
        importExperience: true,
        privacyLevel: 'selective'
      };

      const result = await service.startVerification(mockUserId, mockAccessToken, options);

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.state).toBe('pending');
      expect(result.progress.totalSteps).toBe(6);
      expect(result.progress.completedSteps).toBe(0);
    });

    it('should throw error when access token is missing', async () => {
      await expect(service.startVerification(mockUserId, null))
        .rejects.toThrow(LinkedInVerificationError);
    });

    it('should throw error when user ID is missing', async () => {
      await expect(service.startVerification(null, mockAccessToken))
        .rejects.toThrow(LinkedInVerificationError);
    });

    it('should set default options when not provided', async () => {
      const result = await service.startVerification(mockUserId, mockAccessToken);

      expect(result.sessionId).toBeDefined();
      // Check that default options are applied
      const session = service.verificationSessions.get(result.sessionId);
      expect(session.options.privacyLevel).toBe('selective');
      expect(session.options.importProfile).toBe(true);
    });
  });

  describe('fetchLinkedInProfile', () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {
        userId: mockUserId,
        accessToken: mockAccessToken,
        state: 'pending',
        options: { importProfile: true, importSkills: true },
        data: {},
        progress: { steps: [] },
        errors: [],
        warnings: []
      };
    });

    it('should fetch LinkedIn profile successfully', async () => {
      const mockProfile = {
        id: 'linkedin-123',
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Developer',
        email: 'john.doe@example.com'
      };

      const mockComprehensiveData = {
        positions: [],
        education: [],
        skills: []
      };

      service.linkedInProvider.getProfile.mockResolvedValue(mockProfile);
      service.linkedInProvider.getComprehensiveProfile.mockResolvedValue(mockComprehensiveData);

      await service.fetchLinkedInProfile(mockSession);

      expect(mockSession.data.linkedInProfile).toEqual(mockProfile);
      expect(mockSession.state).toBe('in_progress');
      expect(mockSession.progress.completedSteps).toBe(1);
    });

    it('should handle LinkedIn API errors', async () => {
      const apiError = new Error('LinkedIn API error');
      service.linkedInProvider.getProfile.mockRejectedValue(apiError);

      await expect(service.fetchLinkedInProfile(mockSession))
        .rejects.toThrow(LinkedInVerificationError);
      
      expect(mockSession.errors).toHaveLength(0); // Error handling updates the session
    });
  });

  describe('mapSkillToPlatform', () => {
    beforeEach(async () => {
      // Create some test skills
      await Skill.create({
        name: 'JavaScript',
        category: 'technical',
        description: 'Programming language'
      });

      await Skill.create({
        name: 'Leadership',
        category: 'leadership',
        description: 'Leading teams'
      });
    });

    it('should map LinkedIn skill to existing platform skill', async () => {
      const linkedInSkill = {
        name: 'JavaScript',
        endorsements: 25,
        proficiencyLevel: 'advanced'
      };

      const result = await service.mapSkillToPlatform(linkedInSkill);

      expect(result.success).toBe(true);
      expect(result.skill.name).toBe('JavaScript');
      expect(result.skill.proficiencyLevel).toBe('advanced');
      expect(result.skill.endorsements).toBe(25);
    });

    it('should create new skill for unmapped LinkedIn skill', async () => {
      const linkedInSkill = {
        name: 'React Native',
        endorsements: 10,
        proficiencyLevel: 'intermediate'
      };

      const result = await service.mapSkillToPlatform(linkedInSkill);

      expect(result.success).toBe(true);
      expect(result.skill.name).toBe('React Native');
      
      // Verify skill was created in the platform
      const createdSkill = await Skill.findByName('React Native');
      expect(createdSkill).toBeDefined();
      expect(createdSkill.name).toBe('React Native');
    });

    it('should map skill using skill mappings', async () => {
      const linkedInSkill = {
        name: 'JS',
        endorsements: 15,
        proficiencyLevel: 'expert'
      };

      const result = await service.mapSkillToPlatform(linkedInSkill);

      expect(result.success).toBe(true);
      expect(result.skill.name).toBe('JavaScript'); // Mapped to canonical name
    });
  });

  describe('inferSkillCategory', () => {
    it('should infer technical category for programming skills', () => {
      expect(service.inferSkillCategory('JavaScript')).toBe('technical');
      expect(service.inferSkillCategory('Python Programming')).toBe('technical');
      expect(service.inferSkillCategory('Software Development')).toBe('technical');
    });

    it('should infer leadership category for management skills', () => {
      expect(service.inferSkillCategory('Team Leadership')).toBe('leadership');
      expect(service.inferSkillCategory('Project Management')).toBe('project-management');
      expect(service.inferSkillCategory('Executive Management')).toBe('leadership');
    });

    it('should infer communication category for communication skills', () => {
      expect(service.inferSkillCategory('Public Speaking')).toBe('communication');
      expect(service.inferSkillCategory('Written Communication')).toBe('communication');
      expect(service.inferSkillCategory('Presentation Skills')).toBe('communication');
    });

    it('should default to soft skills for unknown categories', () => {
      expect(service.inferSkillCategory('Unknown Skill')).toBe('soft');
      expect(service.inferSkillCategory('Random Ability')).toBe('soft');
    });
  });

  describe('importProfileData', () => {
    let mockSession;

    beforeEach(async () => {
      mockSession = {
        userId: mockUserId,
        state: 'in_progress',
        options: { importProfile: true, privacyLevel: 'full' },
        data: {
          linkedInProfile: {
            id: 'linkedin-123',
            firstName: 'John',
            lastName: 'Doe',
            headline: 'Senior Developer',
            email: 'john.doe@example.com',
            profilePicture: 'https://example.com/photo.jpg'
          },
          positions: [{
            title: 'Senior Developer',
            companyName: 'Tech Corp',
            isCurrent: true
          }]
        },
        progress: { steps: [] }
      };

      // Mock profile methods
      jest.spyOn(Profile, 'findByUserId').mockResolvedValue(null);
      jest.spyOn(Profile, 'create').mockResolvedValue({
        id: 'profile-123',
        userId: mockUserId,
        displayName: 'John Doe'
      });
    });

    it('should import profile data and create new profile', async () => {
      await service.importProfileData(mockSession);

      expect(Profile.create).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          displayName: 'John Doe',
          headline: 'Senior Developer',
          profilePhotoUrl: 'https://example.com/photo.jpg',
          linkedinVerified: true
        })
      );

      expect(mockSession.state).toBe('data_imported');
      expect(mockSession.data.importedProfileId).toBe('profile-123');
    });

    it('should update existing profile when user already has one', async () => {
      const existingProfile = {
        id: 'existing-profile-123',
        userId: mockUserId,
        displayName: 'Existing Name'
      };

      Profile.findByUserId.mockResolvedValue(existingProfile);
      jest.spyOn(Profile, 'update').mockResolvedValue({
        ...existingProfile,
        displayName: 'John Doe'
      });

      await service.importProfileData(mockSession);

      expect(Profile.update).toHaveBeenCalledWith(
        'existing-profile-123',
        expect.objectContaining({
          displayName: 'John Doe',
          headline: 'Senior Developer'
        })
      );
    });

    it('should skip profile import when not enabled', async () => {
      mockSession.options.importProfile = false;

      await service.importProfileData(mockSession);

      expect(Profile.create).not.toHaveBeenCalled();
      expect(Profile.update).not.toHaveBeenCalled();
      expect(mockSession.state).toBe('data_imported');
    });
  });

  describe('mapLinkedInToProfileData', () => {
    it('should map LinkedIn data with full privacy level', () => {
      const linkedInData = {
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Developer',
        profilePicture: 'https://example.com/photo.jpg',
        providerURL: 'https://linkedin.com/in/johndoe'
      };

      const session = {
        options: { privacyLevel: 'full' },
        data: {
          positions: [{
            title: 'Senior Developer',
            companyName: 'Tech Corp',
            isCurrent: true
          }]
        }
      };

      const result = service.mapLinkedInToProfileData(linkedInData, session);

      expect(result).toEqual({
        displayName: 'John Doe',
        headline: 'Senior Developer',
        profilePhotoUrl: 'https://example.com/photo.jpg',
        previousCompany: 'Tech Corp',
        previousTitle: 'Senior Developer',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        linkedinVerified: true
      });
    });

    it('should map limited data with selective privacy level', () => {
      const linkedInData = {
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Developer',
        profilePicture: 'https://example.com/photo.jpg'
      };

      const session = {
        options: { privacyLevel: 'selective' },
        data: { positions: [] }
      };

      const result = service.mapLinkedInToProfileData(linkedInData, session);

      expect(result).toEqual({
        displayName: 'John Doe',
        headline: 'Senior Developer',
        profilePhotoUrl: 'https://example.com/photo.jpg'
      });
      expect(result.linkedinUrl).toBeUndefined();
      expect(result.linkedinVerified).toBeUndefined();
    });

    it('should map minimal data with minimal privacy level', () => {
      const linkedInData = {
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Developer'
      };

      const session = {
        options: { privacyLevel: 'minimal' },
        data: { positions: [] }
      };

      const result = service.mapLinkedInToProfileData(linkedInData, session);

      expect(result).toEqual({});
    });
  });

  describe('validateImportedData', () => {
    it('should validate successful import', () => {
      const session = {
        options: { importProfile: true, importSkills: true },
        data: {
          linkedInProfile: { id: '123' },
          mappedSkills: [{ name: 'JavaScript' }],
          unmappedSkills: [],
          skills: [{ name: 'JavaScript' }, { name: 'Python' }]
        }
      };

      const results = service.validateImportedData(session);

      expect(results.hasErrors).toBe(false);
      expect(results.validations.profile.valid).toBe(true);
      expect(results.validations.skills.valid).toBe(true);
    });

    it('should detect missing profile data', () => {
      const session = {
        options: { importProfile: true },
        data: {
          linkedInProfile: null
        }
      };

      const results = service.validateImportedData(session);

      expect(results.hasErrors).toBe(true);
      expect(results.validations.profile.valid).toBe(false);
      expect(results.errors).toContain('Profile validation failed: LinkedIn profile data is missing');
    });

    it('should warn about poor skills mapping', () => {
      const session = {
        options: { importSkills: true },
        data: {
          mappedSkills: [{ name: 'JavaScript' }],
          unmappedSkills: [{ name: 'Skill1' }, { name: 'Skill2' }, { name: 'Skill3' }],
          skills: [{ name: 'JavaScript' }, { name: 'Skill1' }, { name: 'Skill2' }, { name: 'Skill3' }]
        }
      };

      const results = service.validateImportedData(session);

      expect(results.warnings).toContain('More than 50% of skills could not be mapped automatically');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return verification status for valid session', () => {
      const sessionId = 'session-123';
      const session = {
        id: sessionId,
        userId: mockUserId,
        state: 'verified',
        progress: { completedSteps: 6, totalSteps: 6 },
        data: {
          linkedInProfile: { id: '123' },
          mappedSkills: [{ name: 'JavaScript' }],
          positions: [{ title: 'Developer' }],
          education: []
        },
        errors: [],
        warnings: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      service.verificationSessions.set(sessionId, session);

      const status = service.getVerificationStatus(sessionId);

      expect(status.sessionId).toBe(sessionId);
      expect(status.userId).toBe(mockUserId);
      expect(status.state).toBe('verified');
      expect(status.progress.percentComplete).toBe(100);
      expect(status.data.profileImported).toBe(true);
      expect(status.data.skillsMapped).toBe(1);
      expect(status.data.experienceImported).toBe(1);
    });

    it('should throw error for non-existent session', () => {
      expect(() => service.getVerificationStatus('non-existent'))
        .toThrow(LinkedInVerificationError);
    });

    it('should mark expired sessions', () => {
      const sessionId = 'expired-session';
      const session = {
        id: sessionId,
        userId: mockUserId,
        state: 'pending',
        expiresAt: new Date(Date.now() - 1000) // Expired
      };

      service.verificationSessions.set(sessionId, session);

      const status = service.getVerificationStatus(sessionId);

      expect(status.state).toBe('expired');
    });
  });

  describe('cancelVerification', () => {
    it('should cancel verification successfully', async () => {
      const sessionId = 'session-123';
      const session = {
        id: sessionId,
        userId: mockUserId,
        state: 'in_progress',
        errors: []
      };

      service.verificationSessions.set(sessionId, session);

      const result = await service.cancelVerification(sessionId);

      expect(result).toBe(true);
      expect(session.state).toBe('failed');
      expect(session.errors).toHaveLength(1);
      expect(session.errors[0].type).toBe('USER_CANCELLED');
    });

    it('should return false for non-existent session', async () => {
      const result = await service.cancelVerification('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getVerificationHistory', () => {
    it('should return user verification history', () => {
      const session1 = {
        id: 'session-1',
        userId: mockUserId,
        state: 'verified',
        createdAt: new Date(Date.now() - 2000)
      };

      const session2 = {
        id: 'session-2',
        userId: mockUserId,
        state: 'failed',
        createdAt: new Date(Date.now() - 1000)
      };

      const session3 = {
        id: 'session-3',
        userId: 'other-user',
        state: 'verified',
        createdAt: new Date()
      };

      service.verificationSessions.set('session-1', session1);
      service.verificationSessions.set('session-2', session2);
      service.verificationSessions.set('session-3', session3);

      const history = service.getVerificationHistory(mockUserId);

      expect(history).toHaveLength(2);
      expect(history[0].sessionId).toBe('session-2'); // Most recent first
      expect(history[1].sessionId).toBe('session-1');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', () => {
      const now = Date.now();
      
      const activeSession = {
        id: 'active',
        expiresAt: new Date(now + 1000)
      };

      const expiredSession = {
        id: 'expired',
        expiresAt: new Date(now - 1000)
      };

      service.verificationSessions.set('active', activeSession);
      service.verificationSessions.set('expired', expiredSession);

      const cleanedCount = service.cleanupExpiredSessions();

      expect(cleanedCount).toBe(1);
      expect(service.verificationSessions.has('active')).toBe(true);
      expect(service.verificationSessions.has('expired')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full verification workflow', async () => {
      // Mock LinkedIn provider responses
      const mockProfile = {
        id: 'linkedin-123',
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Developer',
        email: 'john.doe@example.com'
      };

      const mockComprehensiveData = {
        positions: [{
          title: 'Senior Developer',
          companyName: 'Tech Corp',
          isCurrent: true
        }],
        education: [{
          school: 'University of Tech',
          degree: 'Computer Science'
        }],
        skills: [{
          name: 'JavaScript',
          endorsements: 25,
          proficiencyLevel: 'advanced'
        }]
      };

      service.linkedInProvider.getProfile.mockResolvedValue(mockProfile);
      service.linkedInProvider.getComprehensiveProfile.mockResolvedValue(mockComprehensiveData);

      // Mock Profile methods
      Profile.findByUserId.mockResolvedValue(null);
      Profile.create.mockResolvedValue({
        id: 'profile-123',
        userId: mockUserId
      });

      // Start verification
      const initialResult = await service.startVerification(mockUserId, mockAccessToken);
      expect(initialResult.state).toBe('pending');

      // Process through all steps
      const sessionId = initialResult.sessionId;
      
      // Step 1: Process verification
      await service.processVerificationStep(sessionId);
      let status = service.getVerificationStatus(sessionId);
      expect(status.state).toBe('in_progress');

      // Step 2: Continue processing
      await service.processVerificationStep(sessionId);
      status = service.getVerificationStatus(sessionId);
      expect(status.state).toBe('data_imported');

      // Step 3: Skills mapping
      await service.processVerificationStep(sessionId);
      status = service.getVerificationStatus(sessionId);
      expect(status.state).toBe('skills_mapped');

      // Step 4: Validation and completion
      await service.processVerificationStep(sessionId);
      status = service.getVerificationStatus(sessionId);
      expect(status.state).toBe('verified');
      expect(status.progress.percentComplete).toBe(100);
      expect(status.data.skillsMapped).toBe(1);
    });
  });
});