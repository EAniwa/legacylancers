/**
 * Profile Controllers Tests
 * Comprehensive test coverage for profile controller operations
 */

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
} = require('../../src/controllers/profiles');

const { Profile, ProfileError } = require('../../src/models/Profile');

// Mock console.log and console.error to avoid test output pollution
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('Profile Controllers', () => {
  // Mock request and response objects
  const createMockReq = (overrides = {}) => ({
    user: { id: 'test-user-id', role: 'user' },
    body: {},
    params: {},
    query: {},
    ip: '127.0.0.1',
    ...overrides
  });

  const createMockRes = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };

  beforeEach(async () => {
    // Reset the profile model before each test
    await Profile.reset();
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createProfile()', () => {
    test('should create profile successfully', async () => {
      const req = createMockReq({
        body: {
          displayName: 'John Senior',
          headline: 'Technology Executive',
          bio: 'Experienced technology leader',
          isProfilePublic: true
        }
      });
      const res = createMockRes();

      await createProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile created successfully',
        data: {
          profile: expect.objectContaining({
            id: expect.any(String),
            userId: 'test-user-id',
            displayName: 'John Senior',
            headline: 'Technology Executive',
            bio: 'Experienced technology leader',
            isProfilePublic: true
          })
        }
      });

      // Verify audit logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile creation attempt'),
        expect.any(Object)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile created successfully'),
        expect.any(Object)
      );
    });

    test('should handle profile creation error when user already has profile', async () => {
      // Create first profile
      await Profile.create('test-user-id', { displayName: 'Existing Profile' });

      const req = createMockReq({
        body: { displayName: 'New Profile' }
      });
      const res = createMockRes();

      await createProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User already has a profile',
        code: 'PROFILE_EXISTS'
      });

      // Verify audit logging for failure
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile creation failed'),
        expect.any(Object)
      );
    });

    test('should handle validation errors', async () => {
      const req = createMockReq({
        body: {
          displayName: 'a'.repeat(151) // Too long
        }
      });
      const res = createMockRes();

      await createProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Display name must be between 1 and 150 characters'),
        code: 'INVALID_DISPLAY_NAME'
      });
    });

    test('should handle internal server errors', async () => {
      // Mock Profile.create to throw an unexpected error
      const originalCreate = Profile.create;
      Profile.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const req = createMockReq({
        body: { displayName: 'John Doe' }
      });
      const res = createMockRes();

      await createProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create profile',
        code: 'PROFILE_CREATE_FAILED'
      });

      // Restore original method
      Profile.create = originalCreate;
    });
  });

  describe('getProfile()', () => {
    test('should get profile by ID for owner', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe',
        isProfilePublic: true
      });

      const req = createMockReq({
        params: { id: profile.id },
        user: { id: 'test-user-id', role: 'user' }
      });
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Doe'
          })
        }
      });
    });

    test('should get profile by ID for public view', async () => {
      const profile = await Profile.create('profile-owner-id', {
        displayName: 'John Doe',
        hourlyRateMin: 100,
        showHourlyRates: false,
        isProfilePublic: true,
        searchable: true
      });

      const req = createMockReq({
        params: { id: profile.id },
        user: { id: 'different-user-id', role: 'user' }
      });
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Doe'
          })
        }
      });

      // Should not include private rate information
      const responseProfile = res.json.mock.calls[0][0].data.profile;
      expect(responseProfile.hourlyRateMin).toBeUndefined();
    });

    test('should return 404 for non-existent profile', async () => {
      const req = createMockReq({
        params: { id: 'non-existent-id' }
      });
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should return 404 for private profile when not owner', async () => {
      const profile = await Profile.create('profile-owner-id', {
        displayName: 'John Doe',
        isProfilePublic: false,
        searchable: false
      });

      const req = createMockReq({
        params: { id: profile.id },
        user: { id: 'different-user-id', role: 'user' }
      });
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should allow admin to see private profiles', async () => {
      const profile = await Profile.create('profile-owner-id', {
        displayName: 'John Doe',
        isProfilePublic: false
      });

      const req = createMockReq({
        params: { id: profile.id },
        user: { id: 'admin-user-id', role: 'admin' }
      });
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Doe'
          })
        }
      });
    });
  });

  describe('getProfileBySlug()', () => {
    test('should get profile by slug', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe',
        isProfilePublic: true,
        searchable: true
      });

      const req = createMockReq({
        params: { slug: profile.profileSlug }
      });
      const res = createMockRes();

      await getProfileBySlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            profileSlug: profile.profileSlug
          })
        }
      });
    });

    test('should return 404 for non-existent slug', async () => {
      const req = createMockReq({
        params: { slug: 'non-existent-slug' }
      });
      const res = createMockRes();

      await getProfileBySlug(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });
  });

  describe('getCurrentUserProfile()', () => {
    test('should get current user profile', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe'
      });

      const req = createMockReq();
      const res = createMockRes();

      await getCurrentUserProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            userId: 'test-user-id',
            displayName: 'John Doe'
          })
        }
      });
    });

    test('should return 404 when user has no profile', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await getCurrentUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });
  });

  describe('updateProfile()', () => {
    test('should update profile successfully', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe'
      });

      const req = createMockReq({
        params: { id: profile.id },
        body: {
          displayName: 'John Smith',
          headline: 'Updated headline'
        }
      });
      const res = createMockRes();

      await updateProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Smith',
            headline: 'Updated headline'
          })
        }
      });

      // Verify audit logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile update attempt'),
        expect.any(Object)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile updated successfully'),
        expect.any(Object)
      );
    });

    test('should return 404 for non-existent profile', async () => {
      const req = createMockReq({
        params: { id: 'non-existent-id' },
        body: { displayName: 'Updated Name' }
      });
      const res = createMockRes();

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should handle validation errors', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe'
      });

      const req = createMockReq({
        params: { id: profile.id },
        body: {
          displayName: 'a'.repeat(151) // Too long
        }
      });
      const res = createMockRes();

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Display name must be between 1 and 150 characters'),
        code: 'INVALID_DISPLAY_NAME'
      });

      // Verify audit logging for failure
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile update failed'),
        expect.any(Object)
      );
    });
  });

  describe('patchProfile()', () => {
    test('should partially update profile successfully', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe',
        headline: 'Original headline'
      });

      const req = createMockReq({
        params: { id: profile.id },
        body: {
          headline: 'Updated headline only'
        }
      });
      const res = createMockRes();

      await patchProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Doe', // Should remain unchanged
            headline: 'Updated headline only'
          })
        }
      });

      // Verify audit logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile partial update attempt'),
        expect.any(Object)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile partially updated successfully'),
        expect.any(Object)
      );
    });
  });

  describe('deleteProfile()', () => {
    test('should delete profile successfully', async () => {
      const profile = await Profile.create('test-user-id', {
        displayName: 'John Doe'
      });

      const req = createMockReq({
        params: { id: profile.id }
      });
      const res = createMockRes();

      await deleteProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Profile deleted successfully'
      });

      // Verify the profile is actually deleted
      const deletedProfile = await Profile.findById(profile.id);
      expect(deletedProfile).toBeNull();

      // Verify audit logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile deletion attempt'),
        expect.any(Object)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile deleted successfully'),
        expect.any(Object)
      );
    });

    test('should return 404 for non-existent profile', async () => {
      const req = createMockReq({
        params: { id: 'non-existent-id' }
      });
      const res = createMockRes();

      await deleteProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });

      // Verify audit logging for failure
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile deletion failed'),
        expect.any(Object)
      );
    });
  });

  describe('searchProfiles()', () => {
    beforeEach(async () => {
      // Create test profiles for search
      await Profile.create('user-1', {
        displayName: 'Tech CEO',
        industry: 'Technology',
        availabilityStatus: 'available',
        engagementTypes: ['consulting'],
        yearsOfExperience: 25,
        hourlyRateMin: 200,
        verificationStatus: 'verified',
        isProfilePublic: true,
        searchable: true
      });

      await Profile.create('user-2', {
        displayName: 'Finance Director',
        industry: 'Finance',
        availabilityStatus: 'busy',
        engagementTypes: ['project', 'mentoring'],
        yearsOfExperience: 15,
        hourlyRateMin: 150,
        verificationStatus: 'unverified',
        isProfilePublic: true,
        searchable: true
      });

      await Profile.create('user-3', {
        displayName: 'Private Profile',
        industry: 'Technology',
        isProfilePublic: false
      });
    });

    test('should search profiles with default parameters', async () => {
      const req = createMockReq({
        query: {}
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ displayName: 'Tech CEO' }),
            expect.objectContaining({ displayName: 'Finance Director' })
          ]),
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            pages: 1,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    });

    test('should filter profiles by industry', async () => {
      const req = createMockReq({
        query: { industry: 'Technology' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ industry: 'Technology' })
          ]),
          pagination: expect.objectContaining({
            total: 1
          })
        }
      });
    });

    test('should filter profiles by availability status', async () => {
      const req = createMockReq({
        query: { availabilityStatus: 'busy' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ availabilityStatus: 'busy' })
          ]),
          pagination: expect.objectContaining({
            total: 1
          })
        }
      });
    });

    test('should filter profiles by engagement types', async () => {
      const req = createMockReq({
        query: { engagementTypes: ['mentoring'] }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ 
              engagementTypes: expect.arrayContaining(['mentoring'])
            })
          ]),
          pagination: expect.objectContaining({
            total: 1
          })
        }
      });
    });

    test('should filter profiles by minimum experience', async () => {
      const req = createMockReq({
        query: { minExperience: '20' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ yearsOfExperience: 25 })
          ]),
          pagination: expect.objectContaining({
            total: 1
          })
        }
      });
    });

    test('should filter profiles by maximum hourly rate', async () => {
      const req = createMockReq({
        query: { maxHourlyRate: '175' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ hourlyRateMin: 150 })
          ]),
          pagination: expect.objectContaining({
            total: 1
          })
        }
      });
    });

    test('should filter verified profiles', async () => {
      const req = createMockReq({
        query: { verified: 'true' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.arrayContaining([
            expect.objectContaining({ verificationStatus: 'verified' })
          ]),
          pagination: expect.objectContaining({
            total: 1
          })
        }
      });
    });

    test('should support pagination', async () => {
      const req = createMockReq({
        query: { page: '1', limit: '1' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          profiles: expect.any(Array),
          pagination: {
            page: 1,
            limit: 1,
            total: 2,
            pages: 2,
            hasNext: true,
            hasPrev: false
          }
        }
      });

      expect(res.json.mock.calls[0][0].data.profiles).toHaveLength(1);
    });

    test('should support sorting', async () => {
      const req = createMockReq({
        query: { sort: 'yearsOfExperience', order: 'desc' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      const profiles = res.json.mock.calls[0][0].data.profiles;
      expect(profiles[0].yearsOfExperience).toBeGreaterThanOrEqual(
        profiles[1].yearsOfExperience
      );
    });

    test('should cap limit at 100', async () => {
      const req = createMockReq({
        query: { limit: '150' }
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            limit: 100
          })
        })
      });
    });

    test('should include private profiles for admin', async () => {
      const req = createMockReq({
        user: { id: 'admin-user', role: 'admin' },
        query: {}
      });
      const res = createMockRes();

      await searchProfiles(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pagination: expect.objectContaining({
            total: 3 // Should include private profile
          })
        })
      });
    });
  });

  describe('getProfileStats()', () => {
    test('should return profile statistics for admin', async () => {
      // Create test profiles
      await Profile.create('user-1', { isProfilePublic: true, verificationStatus: 'verified' });
      await Profile.create('user-2', { isProfilePublic: false });
      
      const profile3 = await Profile.create('user-3', { isProfilePublic: true });
      await Profile.delete(profile3.id);

      const req = createMockReq({
        user: { id: 'admin-user', role: 'admin' }
      });
      const res = createMockRes();

      await getProfileStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          stats: expect.objectContaining({
            totalProfiles: 3,
            activeProfiles: 2,
            publicProfiles: 1,
            verifiedProfiles: 1,
            deletedProfiles: 1,
            averageCompletenessScore: expect.any(Number)
          })
        }
      });
    });

    test('should deny access for non-admin users', async () => {
      const req = createMockReq({
        user: { id: 'regular-user', role: 'user' }
      });
      const res = createMockRes();

      await getProfileStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should deny access for unauthenticated users', async () => {
      const req = createMockReq({
        user: null
      });
      const res = createMockRes();

      await getProfileStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });
  });

  describe('updateVerificationStatus()', () => {
    test('should update verification status for admin', async () => {
      const profile = await Profile.create('user-1', {
        displayName: 'John Doe',
        verificationStatus: 'unverified'
      });

      const req = createMockReq({
        user: { id: 'admin-user', role: 'admin' },
        params: { id: profile.id },
        body: {
          verificationStatus: 'verified',
          linkedinVerified: true,
          backgroundCheckStatus: 'completed'
        }
      });
      const res = createMockRes();

      await updateVerificationStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Verification status updated successfully',
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            verificationStatus: 'verified',
            linkedinVerified: true,
            backgroundCheckStatus: 'completed'
          })
        }
      });

      // Verify audit logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile verification status update'),
        expect.any(Object)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile verification updated successfully'),
        expect.any(Object)
      );
    });

    test('should deny access for non-admin users', async () => {
      const profile = await Profile.create('user-1', {
        displayName: 'John Doe'
      });

      const req = createMockReq({
        user: { id: 'regular-user', role: 'user' },
        params: { id: profile.id },
        body: { verificationStatus: 'verified' }
      });
      const res = createMockRes();

      await updateVerificationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should return 404 for non-existent profile', async () => {
      const req = createMockReq({
        user: { id: 'admin-user', role: 'admin' },
        params: { id: 'non-existent-id' },
        body: { verificationStatus: 'verified' }
      });
      const res = createMockRes();

      await updateVerificationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });

      // Verify audit logging for failure
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT] Profile verification update failed'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle ProfileError with appropriate status codes', async () => {
      // Test different ProfileError codes
      const testCases = [
        { code: 'PROFILE_NOT_FOUND', expectedStatus: 404 },
        { code: 'PROFILE_EXISTS', expectedStatus: 409 },
        { code: 'INSUFFICIENT_PERMISSIONS', expectedStatus: 403 },
        { code: 'INVALID_DATA', expectedStatus: 400 }
      ];

      for (const testCase of testCases) {
        const error = new ProfileError('Test error', testCase.code);
        
        // Mock Profile method to throw specific error
        Profile.findById = jest.fn().mockRejectedValue(error);

        const req = createMockReq({
          params: { id: 'test-id' }
        });
        const res = createMockRes();

        await getProfile(req, res);

        expect(res.status).toHaveBeenCalledWith(testCase.expectedStatus);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Test error',
          code: testCase.code
        });
      }
    });

    test('should handle unexpected errors with 500 status', async () => {
      // Mock Profile method to throw unexpected error
      Profile.findById = jest.fn().mockRejectedValue(new Error('Unexpected error'));

      const req = createMockReq({
        params: { id: 'test-id' }
      });
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve profile',
        code: 'PROFILE_GET_FAILED'
      });

      expect(console.error).toHaveBeenCalledWith(
        'Get profile error:',
        expect.any(Error)
      );
    });
  });
});