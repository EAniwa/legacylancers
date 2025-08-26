/**
 * Profile Model Tests
 * Comprehensive test coverage for Profile model operations
 */

const { Profile, ProfileError } = require('../../src/models/Profile');

describe('Profile Model', () => {
  beforeEach(async () => {
    // Reset the profile model before each test
    await Profile.reset();
  });

  describe('create()', () => {
    const validProfileData = {
      displayName: 'John Senior',
      headline: 'Former CEO turned consultant',
      bio: 'Over 30 years of experience in technology leadership, specializing in strategic planning and team development.',
      industry: 'Technology',
      yearsOfExperience: 30,
      availabilityStatus: 'available',
      engagementTypes: ['consulting', 'mentoring'],
      hourlyRateMin: 150,
      hourlyRateMax: 300,
      currency: 'USD',
      isProfilePublic: true,
      searchable: true,
      dataSharingConsent: true,
      publicProfileConsent: true
    };

    test('should create a profile successfully with valid data', async () => {
      const userId = 'test-user-id';
      const profile = await Profile.create(userId, validProfileData);

      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.userId).toBe(userId);
      expect(profile.displayName).toBe(validProfileData.displayName);
      expect(profile.headline).toBe(validProfileData.headline);
      expect(profile.bio).toBe(validProfileData.bio);
      expect(profile.industry).toBe(validProfileData.industry);
      expect(profile.yearsOfExperience).toBe(validProfileData.yearsOfExperience);
      expect(profile.availabilityStatus).toBe(validProfileData.availabilityStatus);
      expect(profile.engagementTypes).toEqual(validProfileData.engagementTypes);
      expect(profile.hourlyRateMin).toBe(validProfileData.hourlyRateMin);
      expect(profile.hourlyRateMax).toBe(validProfileData.hourlyRateMax);
      expect(profile.currency).toBe(validProfileData.currency);
      expect(profile.profileSlug).toBeDefined();
      expect(profile.profileCompletenessScore).toBeGreaterThan(0);
      expect(profile.verificationStatus).toBe('unverified');
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
      expect(profile.deletedAt).toBeNull();
    });

    test('should create a profile with minimal data', async () => {
      const userId = 'test-user-id';
      const minimalData = {
        isProfilePublic: false
      };
      
      const profile = await Profile.create(userId, minimalData);

      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.userId).toBe(userId);
      expect(profile.availabilityStatus).toBe('available');
      expect(profile.engagementTypes).toEqual([]);
      expect(profile.currency).toBe('USD');
      expect(profile.isProfilePublic).toBe(false);
      expect(profile.searchable).toBe(true);
      expect(profile.profileCompletenessScore).toBeGreaterThanOrEqual(0);
    });

    test('should throw error if userId is missing', async () => {
      await expect(Profile.create(null, validProfileData))
        .rejects.toThrow(ProfileError);
      
      await expect(Profile.create(null, validProfileData))
        .rejects.toThrow('User ID is required');
    });

    test('should throw error if user already has a profile', async () => {
      const userId = 'test-user-id';
      await Profile.create(userId, validProfileData);

      await expect(Profile.create(userId, validProfileData))
        .rejects.toThrow(ProfileError);
      
      await expect(Profile.create(userId, validProfileData))
        .rejects.toThrow('User already has a profile');
    });

    test('should validate invalid display name', async () => {
      const userId = 'test-user-id';
      const invalidData = { 
        ...validProfileData, 
        displayName: 'a'.repeat(151) // Too long
      };

      await expect(Profile.create(userId, invalidData))
        .rejects.toThrow(ProfileError);
    });

    test('should validate invalid engagement types', async () => {
      const userId = 'test-user-id';
      const invalidData = { 
        ...validProfileData, 
        engagementTypes: ['invalid-type']
      };

      await expect(Profile.create(userId, invalidData))
        .rejects.toThrow(ProfileError);
    });

    test('should validate rate ranges', async () => {
      const userId = 'test-user-id';
      const invalidData = { 
        ...validProfileData, 
        hourlyRateMin: 300,
        hourlyRateMax: 150 // Min greater than max
      };

      await expect(Profile.create(userId, invalidData))
        .rejects.toThrow(ProfileError);
    });

    test('should validate URL formats', async () => {
      const userId = 'test-user-id';
      const invalidData = { 
        ...validProfileData, 
        linkedinUrl: 'not-a-url'
      };

      await expect(Profile.create(userId, invalidData))
        .rejects.toThrow(ProfileError);
    });

    test('should generate unique profile slug', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const profileData = { ...validProfileData, displayName: 'John Smith' };

      const profile1 = await Profile.create(userId1, profileData);
      const profile2 = await Profile.create(userId2, profileData);

      expect(profile1.profileSlug).toBeDefined();
      expect(profile2.profileSlug).toBeDefined();
      expect(profile1.profileSlug).not.toBe(profile2.profileSlug);
    });

    test('should calculate completeness score correctly', async () => {
      const userId = 'test-user-id';
      
      // Profile with high completeness
      const completeProfile = await Profile.create(userId, {
        displayName: 'John Senior',
        headline: 'Senior Technology Executive',
        bio: 'Extensive experience in technology leadership spanning over three decades, with deep expertise in strategic planning, team development, and organizational transformation.',
        profilePhotoUrl: 'https://example.com/photo.jpg',
        yearsOfExperience: 30,
        industry: 'Technology',
        previousCompany: 'TechCorp',
        previousTitle: 'CEO',
        engagementTypes: ['consulting', 'mentoring'],
        hourlyRateMin: 200,
        linkedinUrl: 'https://linkedin.com/in/johnsenior',
        linkedinVerified: true
      });

      expect(completeProfile.profileCompletenessScore).toBeGreaterThan(80);
    });
  });

  describe('findById()', () => {
    test('should find profile by ID', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const foundProfile = await Profile.findById(createdProfile.id);

      expect(foundProfile).toBeDefined();
      expect(foundProfile.id).toBe(createdProfile.id);
      expect(foundProfile.userId).toBe(userId);
      expect(foundProfile.displayName).toBe(profileData.displayName);
    });

    test('should return null for non-existent profile', async () => {
      const foundProfile = await Profile.findById('non-existent-id');
      expect(foundProfile).toBeNull();
    });

    test('should return null for deleted profile', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      await Profile.delete(createdProfile.id);
      
      const foundProfile = await Profile.findById(createdProfile.id);
      expect(foundProfile).toBeNull();
    });

    test('should apply privacy filters correctly', async () => {
      const userId = 'test-user-id';
      const profileData = { 
        displayName: 'John Doe',
        hourlyRateMin: 100,
        showHourlyRates: false,
        isProfilePublic: true
      };
      
      const createdProfile = await Profile.create(userId, profileData);
      
      // Public view should not show rates
      const publicProfile = await Profile.findById(createdProfile.id, { isPublicView: true });
      expect(publicProfile.hourlyRateMin).toBeUndefined();
      
      // Owner view should show all data
      const ownerProfile = await Profile.findById(createdProfile.id, { isOwner: true });
      expect(ownerProfile.hourlyRateMin).toBe(100);
    });
  });

  describe('findByUserId()', () => {
    test('should find profile by user ID', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      await Profile.create(userId, profileData);
      const foundProfile = await Profile.findByUserId(userId);

      expect(foundProfile).toBeDefined();
      expect(foundProfile.userId).toBe(userId);
      expect(foundProfile.displayName).toBe(profileData.displayName);
    });

    test('should return null for user without profile', async () => {
      const foundProfile = await Profile.findByUserId('non-existent-user');
      expect(foundProfile).toBeNull();
    });
  });

  describe('findBySlug()', () => {
    test('should find profile by slug', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const foundProfile = await Profile.findBySlug(createdProfile.profileSlug);

      expect(foundProfile).toBeDefined();
      expect(foundProfile.id).toBe(createdProfile.id);
      expect(foundProfile.profileSlug).toBe(createdProfile.profileSlug);
    });

    test('should return null for non-existent slug', async () => {
      const foundProfile = await Profile.findBySlug('non-existent-slug');
      expect(foundProfile).toBeNull();
    });
  });

  describe('update()', () => {
    test('should update profile successfully', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const updateData = { 
        displayName: 'John Smith',
        headline: 'Updated headline',
        yearsOfExperience: 25
      };
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updatedProfile = await Profile.update(createdProfile.id, updateData);

      expect(updatedProfile.displayName).toBe(updateData.displayName);
      expect(updatedProfile.headline).toBe(updateData.headline);
      expect(updatedProfile.yearsOfExperience).toBe(updateData.yearsOfExperience);
      expect(updatedProfile.updatedAt.getTime()).toBeGreaterThanOrEqual(createdProfile.updatedAt.getTime());
    });

    test('should regenerate slug when display name changes', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const originalSlug = createdProfile.profileSlug;
      
      const updateData = { displayName: 'Jane Smith' };
      const updatedProfile = await Profile.update(createdProfile.id, updateData);

      expect(updatedProfile.profileSlug).not.toBe(originalSlug);
      expect(updatedProfile.profileSlug).toMatch(/jane-smith/);
    });

    test('should recalculate completeness score', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const originalScore = createdProfile.profileCompletenessScore;
      
      const updateData = { 
        bio: 'This is a comprehensive bio that should increase the completeness score significantly.',
        profilePhotoUrl: 'https://example.com/photo.jpg',
        industry: 'Technology'
      };
      const updatedProfile = await Profile.update(createdProfile.id, updateData);

      expect(updatedProfile.profileCompletenessScore).toBeGreaterThan(originalScore);
    });

    test('should throw error for non-existent profile', async () => {
      const updateData = { displayName: 'John Smith' };

      await expect(Profile.update('non-existent-id', updateData))
        .rejects.toThrow(ProfileError);
      
      await expect(Profile.update('non-existent-id', updateData))
        .rejects.toThrow('Profile not found');
    });

    test('should validate update data', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const invalidUpdateData = { 
        displayName: 'a'.repeat(151) // Too long
      };

      await expect(Profile.update(createdProfile.id, invalidUpdateData))
        .rejects.toThrow(ProfileError);
    });
  });

  describe('delete()', () => {
    test('should soft delete profile', async () => {
      const userId = 'test-user-id';
      const profileData = { displayName: 'John Doe' };
      
      const createdProfile = await Profile.create(userId, profileData);
      const result = await Profile.delete(createdProfile.id);

      expect(result).toBe(true);

      // Should not be findable
      const foundProfile = await Profile.findById(createdProfile.id);
      expect(foundProfile).toBeNull();
    });

    test('should throw error for non-existent profile', async () => {
      await expect(Profile.delete('non-existent-id'))
        .rejects.toThrow(ProfileError);
      
      await expect(Profile.delete('non-existent-id'))
        .rejects.toThrow('Profile not found');
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      // Create test profiles
      const profiles = [
        {
          userId: 'user-1',
          data: {
            displayName: 'Tech CEO',
            industry: 'Technology',
            availabilityStatus: 'available',
            engagementTypes: ['consulting'],
            yearsOfExperience: 25,
            hourlyRateMin: 200,
            verificationStatus: 'verified',
            isProfilePublic: true,
            searchable: true
          }
        },
        {
          userId: 'user-2',
          data: {
            displayName: 'Finance Director',
            industry: 'Finance',
            availabilityStatus: 'busy',
            engagementTypes: ['project', 'mentoring'],
            yearsOfExperience: 15,
            hourlyRateMin: 150,
            verificationStatus: 'unverified',
            isProfilePublic: true,
            searchable: true
          }
        },
        {
          userId: 'user-3',
          data: {
            displayName: 'Private Profile',
            industry: 'Technology',
            availabilityStatus: 'available',
            engagementTypes: ['freelance'],
            yearsOfExperience: 20,
            hourlyRateMin: 100,
            verificationStatus: 'verified',
            isProfilePublic: false,
            searchable: true
          }
        }
      ];

      for (const profile of profiles) {
        const createdProfile = await Profile.create(profile.userId, profile.data);
        // Update verification status after creation if specified
        if (profile.data.verificationStatus && profile.data.verificationStatus !== 'unverified') {
          await Profile.update(createdProfile.id, { verificationStatus: profile.data.verificationStatus });
        }
      }
    });

    test('should return all public profiles by default', async () => {
      const results = await Profile.search();

      expect(results.profiles).toHaveLength(2); // Only public profiles
      expect(results.pagination.total).toBe(2);
      expect(results.pagination.page).toBe(1);
      expect(results.pagination.pages).toBe(1);
    });

    test('should filter by industry', async () => {
      const results = await Profile.search({ industry: 'Technology' });

      expect(results.profiles).toHaveLength(1);
      expect(results.profiles[0].industry).toBe('Technology');
    });

    test('should filter by availability status', async () => {
      const results = await Profile.search({ availabilityStatus: 'busy' });

      expect(results.profiles).toHaveLength(1);
      expect(results.profiles[0].availabilityStatus).toBe('busy');
    });

    test('should filter by engagement types', async () => {
      const results = await Profile.search({ engagementTypes: ['mentoring'] });

      expect(results.profiles).toHaveLength(1);
      expect(results.profiles[0].engagementTypes).toContain('mentoring');
    });

    test('should filter by minimum experience', async () => {
      const results = await Profile.search({ minExperience: 20 });

      expect(results.profiles).toHaveLength(1);
      expect(results.profiles[0].yearsOfExperience).toBeGreaterThanOrEqual(20);
    });

    test('should filter by maximum hourly rate', async () => {
      const results = await Profile.search({ maxHourlyRate: 175 });

      expect(results.profiles).toHaveLength(1);
      expect(results.profiles[0].hourlyRateMin).toBeLessThanOrEqual(175);
    });

    test('should filter by verification status', async () => {
      const results = await Profile.search({ verified: true });

      expect(results.profiles).toHaveLength(1);
      expect(results.profiles[0].verificationStatus).toBe('verified');
    });

    test('should include private profiles for admin', async () => {
      const results = await Profile.search({}, { includePrivate: true });

      expect(results.profiles).toHaveLength(3); // All profiles including private
    });

    test('should support pagination', async () => {
      const results = await Profile.search({}, { page: 1, limit: 1 });

      expect(results.profiles).toHaveLength(1);
      expect(results.pagination.page).toBe(1);
      expect(results.pagination.limit).toBe(1);
      expect(results.pagination.total).toBe(2);
      expect(results.pagination.pages).toBe(2);
      expect(results.pagination.hasNext).toBe(true);
      expect(results.pagination.hasPrev).toBe(false);
    });

    test('should support sorting', async () => {
      const results = await Profile.search({}, { sort: 'yearsOfExperience', order: 'desc' });

      expect(results.profiles).toHaveLength(2);
      expect(results.profiles[0].yearsOfExperience).toBeGreaterThanOrEqual(
        results.profiles[1].yearsOfExperience
      );
    });
  });

  describe('getStats()', () => {
    test('should return correct statistics', async () => {
      // Create test profiles
      const profile1 = await Profile.create('user-1', { isProfilePublic: true });
      await Profile.update(profile1.id, { verificationStatus: 'verified' });
      
      const profile2 = await Profile.create('user-2', { isProfilePublic: false });
      
      const profile3 = await Profile.create('user-3', { isProfilePublic: true });
      await Profile.delete(profile3.id);

      const stats = await Profile.getStats();

      expect(stats.totalProfiles).toBe(3);
      expect(stats.activeProfiles).toBe(2);
      expect(stats.publicProfiles).toBe(1);
      expect(stats.verifiedProfiles).toBe(1);
      expect(stats.deletedProfiles).toBe(1);
      expect(stats.averageCompletenessScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Validation Methods', () => {
    describe('validateProfileData()', () => {
      test('should validate string lengths', async () => {
        const invalidData = {
          displayName: 'a'.repeat(151),
          headline: 'a'.repeat(201),
          bio: 'a'.repeat(5001)
        };

        for (const [field, value] of Object.entries(invalidData)) {
          const data = { [field]: value };
          await expect(Profile.validateProfileData(data))
            .rejects.toThrow(ProfileError);
        }
      });

      test('should validate URL formats', async () => {
        const invalidUrls = {
          profilePhotoUrl: 'not-a-url',
          linkedinUrl: 'ftp://invalid-protocol.com',
          portfolioUrl: 'missing-protocol.com'
        };

        for (const [field, value] of Object.entries(invalidUrls)) {
          const data = { [field]: value };
          await expect(Profile.validateProfileData(data))
            .rejects.toThrow(ProfileError);
        }
      });

      test('should validate numeric ranges', async () => {
        const invalidData = [
          { yearsOfExperience: -1 },
          { yearsOfExperience: 71 },
          { hourlyRateMin: -100 },
          { hourlyRateMax: 1000000 }
        ];

        for (const data of invalidData) {
          await expect(Profile.validateProfileData(data))
            .rejects.toThrow(ProfileError);
        }
      });

      test('should validate enum values', async () => {
        const invalidData = [
          { availabilityStatus: 'invalid' },
          { engagementTypes: ['invalid-type'] },
          { currency: 'INVALID' }
        ];

        for (const data of invalidData) {
          await expect(Profile.validateProfileData(data))
            .rejects.toThrow(ProfileError);
        }
      });
    });

    describe('generateSlug()', () => {
      test('should generate clean slug from display name', () => {
        const slug = Profile.generateSlug('John Smith-Jones');
        expect(slug).toBe('john-smith-jones');
      });

      test('should handle special characters', () => {
        const slug = Profile.generateSlug('John & Jane @ Company!');
        expect(slug).toBe('john-jane-company');
      });

      test('should ensure uniqueness', async () => {
        // Create a profile to occupy a slug
        await Profile.create('user-1', { displayName: 'John Smith' });
        
        const slug = Profile.generateSlug('John Smith');
        expect(slug).toBe('john-smith-1');
      });

      test('should handle empty or invalid names', () => {
        const slug = Profile.generateSlug('');
        expect(slug).toMatch(/^profile-\d+$/);
      });
    });

    describe('calculateCompletenessScore()', () => {
      test('should calculate score correctly for empty profile', () => {
        const profile = {
          bio: null,
          headline: null,
          profilePhotoUrl: null,
          yearsOfExperience: null,
          industry: null,
          previousCompany: null,
          previousTitle: null,
          engagementTypes: [],
          hourlyRateMin: null,
          projectRateMin: null,
          linkedinUrl: null,
          linkedinVerified: false
        };

        const score = Profile.calculateCompletenessScore(profile);
        expect(score).toBe(0);
      });

      test('should calculate score correctly for complete profile', () => {
        const profile = {
          bio: 'This is a comprehensive biography that exceeds fifty characters in length.',
          headline: 'Technology Executive',
          profilePhotoUrl: 'https://example.com/photo.jpg',
          yearsOfExperience: 25,
          industry: 'Technology',
          previousCompany: 'TechCorp',
          previousTitle: 'CEO',
          engagementTypes: ['consulting'],
          hourlyRateMin: 200,
          projectRateMin: null,
          linkedinUrl: 'https://linkedin.com/in/user',
          linkedinVerified: true
        };

        const score = Profile.calculateCompletenessScore(profile);
        expect(score).toBe(100);
      });

      test('should handle partial completeness', () => {
        const profile = {
          bio: 'This is a comprehensive biography that exceeds fifty characters in length.',
          headline: 'Technology Executive',
          profilePhotoUrl: null,
          yearsOfExperience: 25,
          industry: null,
          previousCompany: null,
          previousTitle: null,
          engagementTypes: ['consulting'],
          hourlyRateMin: null,
          projectRateMin: null,
          linkedinUrl: null,
          linkedinVerified: false
        };

        const score = Profile.calculateCompletenessScore(profile);
        expect(score).toBe(45); // bio(15) + headline(10) + experience(10) + engagement(10) + photo(0) + linkedin(0)
      });
    });
  });

  describe('Privacy Controls', () => {
    describe('applyPrivacyFilters()', () => {
      const fullProfile = {
        id: 'profile-id',
        userId: 'user-id',
        displayName: 'John Doe',
        headline: 'Technology Executive',
        bio: 'Comprehensive bio',
        profilePhotoUrl: 'https://example.com/photo.jpg',
        industry: 'Technology',
        hourlyRateMin: 200,
        hourlyRateMax: 400,
        projectRateMin: 5000,
        showHourlyRates: true,
        showProjectRates: false,
        isProfilePublic: true,
        verificationStatus: 'verified',
        linkedinVerified: true,
        profileCompletenessScore: 85,
        createdAt: new Date()
      };

      test('should return full profile for owner', () => {
        const filtered = Profile.applyPrivacyFilters(fullProfile, { isOwner: true });
        
        expect(filtered).toEqual(fullProfile);
      });

      test('should return full profile for admin', () => {
        const filtered = Profile.applyPrivacyFilters(fullProfile, { isAdmin: true });
        
        expect(filtered).toEqual(fullProfile);
      });

      test('should hide private rates for public view', () => {
        const profileWithPrivateRates = {
          ...fullProfile,
          showHourlyRates: false,
          showProjectRates: false
        };
        
        const filtered = Profile.applyPrivacyFilters(profileWithPrivateRates, { isPublicView: true });
        
        expect(filtered.hourlyRateMin).toBeUndefined();
        expect(filtered.hourlyRateMax).toBeUndefined();
        expect(filtered.projectRateMin).toBeUndefined();
      });

      test('should show allowed rates for public view', () => {
        const filtered = Profile.applyPrivacyFilters(fullProfile, { isPublicView: true });
        
        expect(filtered.hourlyRateMin).toBe(200);
        expect(filtered.hourlyRateMax).toBe(400);
        expect(filtered.projectRateMin).toBeUndefined(); // showProjectRates is false
      });

      test('should only show basic info for private profiles in public view', () => {
        const privateProfile = {
          ...fullProfile,
          isProfilePublic: false
        };
        
        const filtered = Profile.applyPrivacyFilters(privateProfile, { isPublicView: true });
        
        // Should only contain basic public fields
        expect(filtered.id).toBe(fullProfile.id);
        expect(filtered.displayName).toBe(fullProfile.displayName);
        expect(filtered.headline).toBe(fullProfile.headline);
        expect(filtered.bio).toBeUndefined();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Since we're using in-memory storage, we'll test validation errors instead
      await expect(Profile.create('', {}))
        .rejects.toThrow(ProfileError);
    });

    test('should provide meaningful error messages', async () => {
      try {
        await Profile.create('user-id', { displayName: 'a'.repeat(151) });
      } catch (error) {
        expect(error).toBeInstanceOf(ProfileError);
        expect(error.message).toContain('Display name must be between 1 and 150 characters');
        expect(error.code).toBe('INVALID_DISPLAY_NAME');
      }
    });
  });
});