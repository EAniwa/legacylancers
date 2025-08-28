/**
 * Manual Verification Service Tests
 * Tests for manual verification fallback methods
 */

const { ManualVerificationService, ManualVerificationError } = require('../../../src/services/verification/manual');
const { Skill } = require('../../../src/models/Skill');

describe('ManualVerificationService', () => {
  let service;
  let mockUserId;

  beforeEach(async () => {
    service = ManualVerificationService;
    service.reset();
    await Skill.reset();
    
    mockUserId = 'user-123';
  });

  afterEach(() => {
    service.reset();
  });

  describe('startManualVerification', () => {
    it('should start email domain verification', async () => {
      const result = await service.startManualVerification(
        mockUserId, 
        'EMAIL_DOMAIN', 
        { email: 'john.doe@university.edu' }
      );

      expect(result.sessionId).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.method).toBe('email_domain');
      expect(result.state).toBe('pending');
      expect(result.progress.totalSteps).toBe(2);
    });

    it('should start document upload verification', async () => {
      const result = await service.startManualVerification(
        mockUserId, 
        'DOCUMENT_UPLOAD'
      );

      expect(result.method).toBe('document_upload');
      expect(result.progress.totalSteps).toBe(3);
      expect(result.progress.steps).toHaveLength(3);
      expect(result.progress.steps[0].name).toBe('document_upload');
    });

    it('should start reference check verification', async () => {
      const result = await service.startManualVerification(
        mockUserId, 
        'REFERENCE_CHECK'
      );

      expect(result.method).toBe('reference_check');
      expect(result.progress.totalSteps).toBe(4);
    });

    it('should start skill assessment verification', async () => {
      const result = await service.startManualVerification(
        mockUserId, 
        'SKILL_ASSESSMENT'
      );

      expect(result.method).toBe('skill_assessment');
      expect(result.progress.totalSteps).toBe(5);
    });

    it('should throw error for invalid verification method', async () => {
      await expect(service.startManualVerification(mockUserId, 'INVALID_METHOD'))
        .rejects.toThrow(ManualVerificationError);
    });

    it('should set expiration date correctly', async () => {
      const result = await service.startManualVerification(mockUserId, 'EMAIL_DOMAIN');
      
      const now = new Date();
      const expiryDate = new Date(result.expiresAt);
      const diffInDays = (expiryDate - now) / (1000 * 60 * 60 * 24);
      
      expect(diffInDays).toBeCloseTo(7, 0); // Should expire in about 7 days
    });
  });

  describe('verifyEmailDomain', () => {
    let sessionId;

    beforeEach(async () => {
      const result = await service.startManualVerification(mockUserId, 'EMAIL_DOMAIN');
      sessionId = result.sessionId;
    });

    it('should verify educational domain successfully', async () => {
      const result = await service.verifyEmailDomain(sessionId, 'professor@stanford.edu');

      expect(result.state).toBe('verified');
      const session = service.verificationSessions.get(sessionId);
      expect(session.data.emailVerification.domain).toBe('stanford.edu');
      expect(session.data.emailVerification.trustLevel).toBe('high');
      expect(session.data.emailVerification.domainType).toBe('educational');
    });

    it('should verify government domain successfully', async () => {
      const result = await service.verifyEmailDomain(sessionId, 'employee@agency.gov');

      expect(result.state).toBe('verified');
      const session = service.verificationSessions.get(sessionId);
      expect(session.data.emailVerification.domainType).toBe('government');
    });

    it('should verify trusted corporate domain successfully', async () => {
      const result = await service.verifyEmailDomain(sessionId, 'developer@microsoft.com');

      expect(result.state).toBe('verified');
      const session = service.verificationSessions.get(sessionId);
      expect(session.data.emailVerification.domainType).toBe('corporate');
    });

    it('should add warning for untrusted domain', async () => {
      const result = await service.verifyEmailDomain(sessionId, 'user@unknown-company.com');

      expect(result.state).toBe('pending');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('UNTRUSTED_DOMAIN');
    });

    it('should throw error for invalid email format', async () => {
      await expect(service.verifyEmailDomain(sessionId, 'invalid-email'))
        .rejects.toThrow(ManualVerificationError);
    });

    it('should throw error for non-existent session', async () => {
      await expect(service.verifyEmailDomain('fake-session', 'test@example.com'))
        .rejects.toThrow(ManualVerificationError);
    });
  });

  describe('submitDocuments', () => {
    let sessionId;

    beforeEach(async () => {
      const result = await service.startManualVerification(mockUserId, 'DOCUMENT_UPLOAD');
      sessionId = result.sessionId;
    });

    it('should submit documents successfully', async () => {
      const documents = [
        {
          filename: 'resume.pdf',
          type: 'resume',
          size: 1024,
          mimetype: 'application/pdf',
          buffer: Buffer.from('fake pdf content')
        },
        {
          filename: 'certificate.jpg',
          type: 'certification',
          size: 2048,
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake image content')
        }
      ];

      const result = await service.submitDocuments(sessionId, documents);

      expect(result.state).toBe('under_review');
      expect(result.data.documentsSubmitted).toBe(2);

      const session = service.verificationSessions.get(sessionId);
      expect(session.data.submittedDocuments).toHaveLength(2);
      expect(session.data.submittedDocuments[0].originalName).toBe('resume.pdf');
      expect(session.data.submittedDocuments[0].type).toBe('resume');
      expect(session.data.submittedDocuments[1].originalName).toBe('certificate.jpg');
    });

    it('should process document metadata correctly', async () => {
      const documents = [{
        filename: 'portfolio.pdf',
        type: 'portfolio',
        size: 5120,
        mimetype: 'application/pdf'
      }];

      await service.submitDocuments(sessionId, documents);

      const session = service.verificationSessions.get(sessionId);
      const doc = session.data.submittedDocuments[0];

      expect(doc.id).toBeDefined();
      expect(doc.status).toBe('pending_review');
      expect(doc.uploadedAt).toBeDefined();
      expect(doc.metadata.validationResults.format).toBe(true);
      expect(doc.metadata.validationResults.content).toBe(true);
    });

    it('should store documents separately', async () => {
      const documents = [{
        filename: 'test.pdf',
        buffer: Buffer.from('test content')
      }];

      await service.submitDocuments(sessionId, documents);

      const session = service.verificationSessions.get(sessionId);
      const docId = session.data.submittedDocuments[0].id;
      const storedDoc = service.documentUploads.get(docId);

      expect(storedDoc).toBeDefined();
      expect(storedDoc.fileData).toEqual(Buffer.from('test content'));
    });

    it('should handle empty document list', async () => {
      const result = await service.submitDocuments(sessionId, []);

      expect(result.data.documentsSubmitted).toBe(0);
      const session = service.verificationSessions.get(sessionId);
      expect(session.data.submittedDocuments).toHaveLength(0);
    });
  });

  describe('submitReferences', () => {
    let sessionId;

    beforeEach(async () => {
      const result = await service.startManualVerification(mockUserId, 'REFERENCE_CHECK');
      sessionId = result.sessionId;
    });

    it('should submit references successfully', async () => {
      const references = [
        {
          name: 'John Manager',
          email: 'john.manager@company.com',
          phone: '+1-555-0123',
          company: 'Tech Corp',
          position: 'Engineering Manager',
          relationship: 'Direct Supervisor',
          yearsKnown: 3
        },
        {
          name: 'Jane Colleague',
          email: 'jane@colleague.com',
          company: 'Another Corp',
          position: 'Senior Developer',
          relationship: 'Peer',
          yearsKnown: 2
        }
      ];

      const result = await service.submitReferences(sessionId, references);

      expect(result.state).toBe('under_review');
      expect(result.data.referencesSubmitted).toBe(2);

      const session = service.verificationSessions.get(sessionId);
      expect(session.data.referenceChecks).toHaveLength(2);
      expect(session.data.referenceChecks[0].name).toBe('John Manager');
      expect(session.data.referenceChecks[0].status).toBe('pending_contact');
      expect(session.data.referenceChecks[0].responseReceived).toBe(false);
      expect(session.data.referenceChecks[1].name).toBe('Jane Colleague');
    });

    it('should generate unique IDs for references', async () => {
      const references = [
        { name: 'Ref 1', email: 'ref1@example.com', company: 'Co1', position: 'Pos1', relationship: 'Supervisor' },
        { name: 'Ref 2', email: 'ref2@example.com', company: 'Co2', position: 'Pos2', relationship: 'Peer' }
      ];

      await service.submitReferences(sessionId, references);

      const session = service.verificationSessions.get(sessionId);
      const ids = session.data.referenceChecks.map(ref => ref.id);

      expect(ids[0]).toBeDefined();
      expect(ids[1]).toBeDefined();
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('should handle optional fields', async () => {
      const references = [{
        name: 'Minimal Ref',
        email: 'minimal@example.com',
        company: 'Company',
        position: 'Position',
        relationship: 'Colleague'
        // Missing phone and yearsKnown
      }];

      await service.submitReferences(sessionId, references);

      const session = service.verificationSessions.get(sessionId);
      const ref = session.data.referenceChecks[0];

      expect(ref.phone).toBeNull();
      expect(ref.yearsKnown).toBe(0);
    });
  });

  describe('createSkillAssessment', () => {
    let sessionId;
    let skillId;

    beforeEach(async () => {
      const result = await service.startManualVerification(mockUserId, 'SKILL_ASSESSMENT');
      sessionId = result.sessionId;

      // Create test skills
      const skill = await Skill.create({
        name: 'JavaScript',
        category: 'technical',
        description: 'Programming language'
      });
      skillId = skill.id;
    });

    it('should create skill assessments successfully', async () => {
      const result = await service.createSkillAssessment(sessionId, [skillId]);

      expect(result.sessionId).toBe(sessionId);
      expect(result.assessments).toHaveLength(1);
      expect(result.assessments[0].skillName).toBe('JavaScript');
      expect(result.assessments[0].category).toBe('technical');
      expect(result.assessments[0].assessmentType).toBe('multiple_choice_technical');
      expect(result.assessments[0].timeLimit).toBe(30);

      const session = service.verificationSessions.get(sessionId);
      expect(session.data.skillAssessments).toHaveLength(1);
      expect(session.data.skillAssessments[0].questions).toBeDefined();
      expect(session.data.skillAssessments[0].questions.length).toBeGreaterThan(0);
    });

    it('should determine correct assessment type for different skill categories', async () => {
      const analyticalSkill = await Skill.create({
        name: 'Data Analysis',
        category: 'analytical',
        description: 'Analyzing data'
      });

      const businessSkill = await Skill.create({
        name: 'Project Management',
        category: 'business',
        description: 'Managing projects'
      });

      const softSkill = await Skill.create({
        name: 'Communication',
        category: 'soft',
        description: 'Communication skills'
      });

      const result = await service.createSkillAssessment(sessionId, [
        analyticalSkill.id,
        businessSkill.id,
        softSkill.id
      ]);

      const assessments = result.assessments;
      expect(assessments[0].assessmentType).toBe('multiple_choice_technical'); // analytical
      expect(assessments[1].assessmentType).toBe('scenario_based'); // business
      expect(assessments[2].assessmentType).toBe('self_assessment'); // soft
    });

    it('should handle non-existent skills gracefully', async () => {
      const fakeSkillId = 'non-existent-skill-id';
      
      const result = await service.createSkillAssessment(sessionId, [skillId, fakeSkillId]);

      expect(result.assessments).toHaveLength(1); // Only valid skill included
      expect(result.assessments[0].skillName).toBe('JavaScript');

      const session = service.verificationSessions.get(sessionId);
      expect(session.warnings).toHaveLength(1);
      expect(session.warnings[0].type).toBe('SKILL_NOT_FOUND');
    });

    it('should generate different question types', async () => {
      const result = await service.createSkillAssessment(sessionId, [skillId]);

      const session = service.verificationSessions.get(sessionId);
      const questions = session.data.skillAssessments[0].questions;

      expect(questions.length).toBeGreaterThanOrEqual(3);
      expect(questions.length).toBeLessThanOrEqual(5);

      questions.forEach((question, index) => {
        expect(question.id).toBeDefined();
        expect(question.type).toBe('multiple_choice');
        expect(question.question).toContain('JavaScript');
        expect(question.order).toBe(index + 1);
        expect(question.points).toBeGreaterThan(0);
      });
    });
  });

  describe('Domain Classification', () => {
    it('should identify educational domains', () => {
      expect(service.isEducationalDomain('stanford.edu')).toBe(true);
      expect(service.isEducationalDomain('university.ac.uk')).toBe(true);
      expect(service.isEducationalDomain('college.university.edu')).toBe(true);
      expect(service.isEducationalDomain('example.com')).toBe(false);
    });

    it('should identify government domains', () => {
      expect(service.isGovernmentDomain('agency.gov')).toBe(true);
      expect(service.isGovernmentDomain('military.mil')).toBe(true);
      expect(service.isGovernmentDomain('state.state.us')).toBe(true);
      expect(service.isGovernmentDomain('example.com')).toBe(false);
    });

    it('should categorize domain types correctly', () => {
      expect(service.getDomainType('stanford.edu')).toBe('educational');
      expect(service.getDomainType('agency.gov')).toBe('government');
      expect(service.getDomainType('microsoft.com')).toBe('corporate');
      expect(service.getDomainType('unknown-domain.com')).toBe('unknown');
    });
  });

  describe('getAvailableVerificationMethods', () => {
    it('should return all available verification methods', () => {
      const methods = service.getAvailableVerificationMethods(mockUserId);

      expect(methods).toHaveLength(6);
      
      const methodNames = methods.map(m => m.method);
      expect(methodNames).toContain('email_domain');
      expect(methodNames).toContain('document_upload');
      expect(methodNames).toContain('reference_check');
      expect(methodNames).toContain('portfolio_review');
      expect(methodNames).toContain('skill_assessment');
      expect(methodNames).toContain('admin_review');
    });

    it('should include required information for each method', () => {
      const methods = service.getAvailableVerificationMethods(mockUserId);

      methods.forEach(method => {
        expect(method.method).toBeDefined();
        expect(method.name).toBeDefined();
        expect(method.description).toBeDefined();
        expect(method.estimatedTime).toBeDefined();
        expect(method.requirements).toBeDefined();
        expect(method.successRate).toBeDefined();
        expect(Array.isArray(method.requirements)).toBe(true);
        expect(typeof method.successRate).toBe('number');
      });
    });

    it('should have realistic success rates', () => {
      const methods = service.getAvailableVerificationMethods(mockUserId);

      methods.forEach(method => {
        expect(method.successRate).toBeGreaterThan(0);
        expect(method.successRate).toBeLessThanOrEqual(100);
      });

      // Admin review should have 100% success rate
      const adminMethod = methods.find(m => m.method === 'admin_review');
      expect(adminMethod.successRate).toBe(100);
    });
  });

  describe('getVerificationStatus', () => {
    it('should return status for valid session', async () => {
      const result = await service.startManualVerification(mockUserId, 'EMAIL_DOMAIN');
      const status = service.getVerificationStatus(result.sessionId);

      expect(status.sessionId).toBe(result.sessionId);
      expect(status.userId).toBe(mockUserId);
      expect(status.method).toBe('email_domain');
      expect(status.state).toBe('pending');
      expect(status.progress.percentComplete).toBe(0);
    });

    it('should calculate progress percentage correctly', async () => {
      const result = await service.startManualVerification(mockUserId, 'EMAIL_DOMAIN');
      const sessionId = result.sessionId;

      // Verify an email to complete one step
      await service.verifyEmailDomain(sessionId, 'test@stanford.edu');

      const status = service.getVerificationStatus(sessionId);
      expect(status.progress.percentComplete).toBe(100); // 2/2 steps completed
    });

    it('should mark expired sessions', async () => {
      const result = await service.startManualVerification(mockUserId, 'EMAIL_DOMAIN');
      const session = service.verificationSessions.get(result.sessionId);
      
      // Manually expire the session
      session.expiresAt = new Date(Date.now() - 1000);

      const status = service.getVerificationStatus(result.sessionId);
      expect(status.state).toBe('expired');
    });
  });

  describe('cancelVerification', () => {
    it('should cancel verification successfully', async () => {
      const result = await service.startManualVerification(mockUserId, 'EMAIL_DOMAIN');
      
      const cancelled = await service.cancelVerification(result.sessionId);
      
      expect(cancelled).toBe(true);
      
      const session = service.verificationSessions.get(result.sessionId);
      expect(session.state).toBe('rejected');
      expect(session.errors).toHaveLength(1);
      expect(session.errors[0].type).toBe('USER_CANCELLED');
    });

    it('should return false for non-existent session', async () => {
      const cancelled = await service.cancelVerification('fake-session');
      expect(cancelled).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should complete email domain verification workflow', async () => {
      // Start verification
      const startResult = await service.startManualVerification(
        mockUserId, 
        'EMAIL_DOMAIN'
      );

      expect(startResult.state).toBe('pending');
      expect(startResult.progress.completedSteps).toBe(0);

      // Verify email domain
      const verifyResult = await service.verifyEmailDomain(
        startResult.sessionId, 
        'professor@mit.edu'
      );

      expect(verifyResult.state).toBe('verified');
      expect(verifyResult.progress.percentComplete).toBe(100);
      expect(verifyResult.data.emailVerified).toBe(true);

      const finalStatus = service.getVerificationStatus(startResult.sessionId);
      expect(finalStatus.state).toBe('verified');
    });

    it('should handle document upload workflow', async () => {
      // Start verification
      const startResult = await service.startManualVerification(
        mockUserId, 
        'DOCUMENT_UPLOAD'
      );

      expect(startResult.state).toBe('pending');

      // Submit documents
      const documents = [
        {
          filename: 'resume.pdf',
          type: 'resume',
          size: 1024,
          mimetype: 'application/pdf'
        }
      ];

      const submitResult = await service.submitDocuments(
        startResult.sessionId, 
        documents
      );

      expect(submitResult.state).toBe('under_review');
      expect(submitResult.data.documentsSubmitted).toBe(1);

      const finalStatus = service.getVerificationStatus(startResult.sessionId);
      expect(finalStatus.progress.completedSteps).toBeGreaterThan(0);
    });

    it('should handle skill assessment workflow', async () => {
      // Create test skills
      const skill1 = await Skill.create({
        name: 'Python',
        category: 'technical',
        description: 'Programming language'
      });

      const skill2 = await Skill.create({
        name: 'Leadership',
        category: 'leadership',
        description: 'Leading teams'
      });

      // Start verification
      const startResult = await service.startManualVerification(
        mockUserId, 
        'SKILL_ASSESSMENT'
      );

      // Create assessments
      const assessmentResult = await service.createSkillAssessment(
        startResult.sessionId, 
        [skill1.id, skill2.id]
      );

      expect(assessmentResult.assessments).toHaveLength(2);
      expect(assessmentResult.assessments[0].skillName).toBe('Python');
      expect(assessmentResult.assessments[1].skillName).toBe('Leadership');

      const finalStatus = service.getVerificationStatus(startResult.sessionId);
      expect(finalStatus.data.assessmentsCreated).toBe(2);
      expect(finalStatus.progress.completedSteps).toBeGreaterThan(0);
    });
  });
});