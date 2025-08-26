/**
 * Profile Routes Tests
 * Comprehensive test coverage for profile API routes
 */

const request = require('supertest');
const app = require('../../../src/app');
const { Profile } = require('../../../src/models/Profile');
const { User } = require('../../../src/models/User');
const { signToken } = require('../../../src/auth/jwt');

// Mock console output to avoid test pollution
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

describe('Profile API Routes', () => {
  // Helper function to create test user and get auth token
  const createTestUser = async (userData = {}) => {
    const defaultUserData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe',
      privacyConsent: true,
      emailVerified: true,
      ...userData
    };

    const user = await User.create(defaultUserData);
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus,
      type: 'access'
    });

    return { user, token };
  };

  // Helper function to create admin user and get auth token
  const createAdminUser = async () => {
    const adminData = {
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      privacyConsent: true,
      emailVerified: true,
      role: 'admin'
    };

    const admin = await User.create(adminData);
    await User.update(admin.id, { role: 'admin' }); // Ensure admin role is set

    const token = signToken({
      userId: admin.id,
      email: admin.email,
      role: 'admin',
      emailVerified: admin.emailVerified,
      kycStatus: admin.kycStatus,
      type: 'access'
    });

    return { admin, token };
  };

  beforeEach(async () => {
    // Reset models before each test
    await Profile.reset();
    await User.reset();
    jest.clearAllMocks();
  });

  describe('POST /api/profiles', () => {
    test('should create profile with valid data and authentication', async () => {
      const { user, token } = await createTestUser();

      const profileData = {
        displayName: 'John Senior',
        headline: 'Technology Executive',
        bio: 'Experienced technology leader with 25+ years of experience',
        industry: 'Technology',
        yearsOfExperience: 25,
        availabilityStatus: 'available',
        engagementTypes: ['consulting', 'mentoring'],
        hourlyRateMin: 200,
        hourlyRateMax: 400,
        isProfilePublic: true,
        searchable: true,
        dataSharingConsent: true,
        publicProfileConsent: true
      };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .send(profileData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Profile created successfully',
        data: {
          profile: expect.objectContaining({
            id: expect.any(String),
            userId: user.id,
            displayName: profileData.displayName,
            headline: profileData.headline,
            bio: profileData.bio,
            industry: profileData.industry,
            yearsOfExperience: profileData.yearsOfExperience,
            availabilityStatus: profileData.availabilityStatus,
            engagementTypes: profileData.engagementTypes,
            hourlyRateMin: profileData.hourlyRateMin,
            hourlyRateMax: profileData.hourlyRateMax,
            profileSlug: expect.any(String),
            profileCompletenessScore: expect.any(Number),
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          })
        }
      });
    });

    test('should require authentication', async () => {
      const profileData = { displayName: 'Test Profile' };

      const response = await request(app)
        .post('/api/profiles')
        .send(profileData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });

    test('should require email verification', async () => {
      const { user, token } = await createTestUser({ emailVerified: false });

      const profileData = { displayName: 'Test Profile' };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .send(profileData)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED'
      });
    });

    test('should validate profile data', async () => {
      const { user, token } = await createTestUser();

      const invalidProfileData = {
        displayName: 'a'.repeat(151), // Too long
        headline: 'b'.repeat(201), // Too long
        engagementTypes: ['invalid-type']
      };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidProfileData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'displayName',
            code: 'INVALID_DISPLAY_NAME'
          }),
          expect.objectContaining({
            field: 'headline',
            code: 'INVALID_HEADLINE'
          }),
          expect.objectContaining({
            field: 'engagementTypes',
            code: 'INVALID_ENGAGEMENT_TYPE'
          })
        ])
      });
    });

    test('should prevent duplicate profiles for same user', async () => {
      const { user, token } = await createTestUser();

      // Create first profile
      await Profile.create(user.id, { displayName: 'First Profile' });

      const profileData = { displayName: 'Second Profile' };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .send(profileData)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: 'User already has a profile',
        code: 'PROFILE_EXISTS'
      });
    });

    test('should sanitize input data', async () => {
      const { user, token } = await createTestUser();

      const profileData = {
        displayName: '  John Senior  ', // Whitespace
        headline: '  Technology Executive  ',
        yearsOfExperience: '25', // String number
        hourlyRateMin: '200.50', // String decimal
        isProfilePublic: 'true' // String boolean
      };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .send(profileData)
        .expect(201);

      expect(response.body.data.profile).toEqual(
        expect.objectContaining({
          displayName: 'John Senior', // Trimmed
          headline: 'Technology Executive', // Trimmed
          yearsOfExperience: 25, // Converted to number
          hourlyRateMin: 200.5, // Converted to number
          isProfilePublic: true // Converted to boolean
        })
      );
    });
  });

  describe('GET /api/profiles', () => {
    beforeEach(async () => {
      // Create test profiles for search
      const { user: user1 } = await createTestUser({ email: 'user1@example.com' });
      const { user: user2 } = await createTestUser({ email: 'user2@example.com' });
      const { user: user3 } = await createTestUser({ email: 'user3@example.com' });

      await Profile.create(user1.id, {
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

      await Profile.create(user2.id, {
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

      await Profile.create(user3.id, {
        displayName: 'Private Profile',
        industry: 'Technology',
        isProfilePublic: false,
        searchable: true
      });
    });

    test('should return public profiles without authentication', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .expect(200);

      expect(response.body).toEqual({
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

      expect(response.body.data.profiles).toHaveLength(2);
    });

    test('should filter by industry', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ industry: 'Technology' })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.profiles[0].industry).toBe('Technology');
    });

    test('should filter by availability status', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ availabilityStatus: 'busy' })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.profiles[0].availabilityStatus).toBe('busy');
    });

    test('should filter by engagement types', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ engagementTypes: 'mentoring' })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.profiles[0].engagementTypes).toContain('mentoring');
    });

    test('should filter by minimum experience', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ minExperience: 20 })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.profiles[0].yearsOfExperience).toBeGreaterThanOrEqual(20);
    });

    test('should filter by maximum hourly rate', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ maxHourlyRate: 175 })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.profiles[0].hourlyRateMin).toBeLessThanOrEqual(175);
    });

    test('should filter verified profiles', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ verified: 'true' })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.profiles[0].verificationStatus).toBe('verified');
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(1);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2,
        hasNext: true,
        hasPrev: false
      });
    });

    test('should support sorting', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({ sort: 'yearsOfExperience', order: 'desc' })
        .expect(200);

      const profiles = response.body.data.profiles;
      expect(profiles[0].yearsOfExperience).toBeGreaterThanOrEqual(
        profiles[1].yearsOfExperience
      );
    });

    test('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .query({
          page: 0, // Invalid
          limit: 150, // Too high
          sort: 'invalid_field', // Invalid
          order: 'invalid_order', // Invalid
          availabilityStatus: 'invalid_status', // Invalid
          engagementTypes: 'invalid_type' // Invalid
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Search validation failed',
        code: 'SEARCH_VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'page' }),
          expect.objectContaining({ field: 'limit' }),
          expect.objectContaining({ field: 'sort' }),
          expect.objectContaining({ field: 'order' }),
          expect.objectContaining({ field: 'availabilityStatus' }),
          expect.objectContaining({ field: 'engagementTypes' })
        ])
      });
    });

    test('should include private profiles for admin', async () => {
      const { admin, token } = await createAdminUser();

      const response = await request(app)
        .get('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.profiles).toHaveLength(3); // Should include private profile
      expect(response.body.data.pagination.total).toBe(3);
    });
  });

  describe('GET /api/profiles/me', () => {
    test('should return current user profile', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'My Profile',
        hourlyRateMin: 100,
        showHourlyRates: false
      });

      const response = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            userId: user.id,
            displayName: 'My Profile',
            hourlyRateMin: 100 // Should show private data for owner
          })
        }
      });
    });

    test('should return 404 when user has no profile', async () => {
      const { user, token } = await createTestUser();

      const response = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/profiles/me')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });
  });

  describe('GET /api/profiles/stats', () => {
    test('should return profile statistics for admin', async () => {
      const { admin, token } = await createAdminUser();
      const { user: user1 } = await createTestUser({ email: 'user1@example.com' });
      const { user: user2 } = await createTestUser({ email: 'user2@example.com' });

      await Profile.create(user1.id, { isProfilePublic: true, verificationStatus: 'verified' });
      const profile2 = await Profile.create(user2.id, { isProfilePublic: false });
      await Profile.delete(profile2.id);

      const response = await request(app)
        .get('/api/profiles/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          stats: expect.objectContaining({
            totalProfiles: 2,
            activeProfiles: 1,
            publicProfiles: 1,
            verifiedProfiles: 1,
            deletedProfiles: 1,
            averageCompletenessScore: expect.any(Number)
          })
        }
      });
    });

    test('should deny access for non-admin users', async () => {
      const { user, token } = await createTestUser();

      const response = await request(app)
        .get('/api/profiles/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/profiles/stats')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });
  });

  describe('GET /api/profiles/slug/:slug', () => {
    test('should return profile by slug', async () => {
      const { user } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        isProfilePublic: true,
        searchable: true
      });

      const response = await request(app)
        .get(`/api/profiles/slug/${profile.profileSlug}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            profileSlug: profile.profileSlug,
            displayName: 'John Doe'
          })
        }
      });
    });

    test('should return 404 for non-existent slug', async () => {
      const response = await request(app)
        .get('/api/profiles/slug/non-existent-slug')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should validate slug format', async () => {
      const response = await request(app)
        .get('/api/profiles/slug/Invalid_Slug!')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid slug format. Must contain only lowercase letters, numbers, and hyphens',
        code: 'INVALID_SLUG_FORMAT'
      });
    });

    test('should return 404 for private profile when not owner', async () => {
      const { user } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        isProfilePublic: false,
        searchable: false
      });

      const response = await request(app)
        .get(`/api/profiles/slug/${profile.profileSlug}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });
  });

  describe('GET /api/profiles/:id', () => {
    test('should return profile by ID', async () => {
      const { user } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        isProfilePublic: true,
        searchable: true
      });

      const response = await request(app)
        .get(`/api/profiles/${profile.id}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Doe'
          })
        }
      });
    });

    test('should return full profile for owner', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        hourlyRateMin: 100,
        showHourlyRates: false,
        isProfilePublic: true
      });

      const response = await request(app)
        .get(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.profile).toEqual(
        expect.objectContaining({
          id: profile.id,
          hourlyRateMin: 100 // Should show private data for owner
        })
      );
    });

    test('should hide private rates for non-owner', async () => {
      const { user: profileOwner } = await createTestUser({ email: 'owner@example.com' });
      const { user: otherUser, token } = await createTestUser({ email: 'other@example.com' });

      const profile = await Profile.create(profileOwner.id, {
        displayName: 'John Doe',
        hourlyRateMin: 100,
        showHourlyRates: false,
        isProfilePublic: true,
        searchable: true
      });

      const response = await request(app)
        .get(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Should not include private rate information
      expect(response.body.data.profile.hourlyRateMin).toBeUndefined();
    });

    test('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .get('/api/profiles/non-existent-id')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });
  });

  describe('PUT /api/profiles/:id', () => {
    test('should update profile for owner', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        headline: 'Old headline'
      });

      const updateData = {
        displayName: 'John Smith',
        headline: 'New headline',
        bio: 'Updated bio'
      };

      const response = await request(app)
        .put(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Smith',
            headline: 'New headline',
            bio: 'Updated bio'
          })
        }
      });
    });

    test('should allow admin to update any profile', async () => {
      const { user } = await createTestUser();
      const { admin, token: adminToken } = await createAdminUser();
      
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe'
      });

      const updateData = {
        displayName: 'Updated by Admin'
      };

      const response = await request(app)
        .put(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.profile.displayName).toBe('Updated by Admin');
    });

    test('should prevent non-owner from updating profile', async () => {
      const { user: profileOwner } = await createTestUser({ email: 'owner@example.com' });
      const { user: otherUser, token } = await createTestUser({ email: 'other@example.com' });

      const profile = await Profile.create(profileOwner.id, {
        displayName: 'John Doe'
      });

      const updateData = { displayName: 'Unauthorized Update' };

      const response = await request(app)
        .put(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'You can only modify your own profile',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/profiles/some-id')
        .send({ displayName: 'Test' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });

    test('should validate update data', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, { displayName: 'John Doe' });

      const invalidUpdateData = {
        displayName: 'a'.repeat(151), // Too long
        engagementTypes: ['invalid-type']
      };

      const response = await request(app)
        .put(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'displayName',
            code: 'INVALID_DISPLAY_NAME'
          }),
          expect.objectContaining({
            field: 'engagementTypes',
            code: 'INVALID_ENGAGEMENT_TYPE'
          })
        ])
      });
    });

    test('should return 404 for non-existent profile', async () => {
      const { user, token } = await createTestUser();

      const response = await request(app)
        .put('/api/profiles/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Test' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });
  });

  describe('PATCH /api/profiles/:id', () => {
    test('should partially update profile', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        headline: 'Original headline',
        bio: 'Original bio'
      });

      const updateData = {
        headline: 'Updated headline only'
      };

      const response = await request(app)
        .patch(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: expect.objectContaining({
            id: profile.id,
            displayName: 'John Doe', // Should remain unchanged
            headline: 'Updated headline only',
            bio: 'Original bio' // Should remain unchanged
          })
        }
      });
    });

    test('should sanitize partial update data', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, { displayName: 'John Doe' });

      const updateData = {
        headline: '  Updated headline  ', // Whitespace
        yearsOfExperience: '30' // String number
      };

      const response = await request(app)
        .patch(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.profile).toEqual(
        expect.objectContaining({
          headline: 'Updated headline', // Trimmed
          yearsOfExperience: 30 // Converted to number
        })
      );
    });
  });

  describe('DELETE /api/profiles/:id', () => {
    test('should delete profile for owner', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe'
      });

      const response = await request(app)
        .delete(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Profile deleted successfully'
      });

      // Verify profile is actually deleted
      const deletedProfile = await Profile.findById(profile.id);
      expect(deletedProfile).toBeNull();
    });

    test('should allow admin to delete any profile', async () => {
      const { user } = await createTestUser();
      const { admin, token: adminToken } = await createAdminUser();
      
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe'
      });

      const response = await request(app)
        .delete(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Profile deleted successfully'
      });
    });

    test('should prevent non-owner from deleting profile', async () => {
      const { user: profileOwner } = await createTestUser({ email: 'owner@example.com' });
      const { user: otherUser, token } = await createTestUser({ email: 'other@example.com' });

      const profile = await Profile.create(profileOwner.id, {
        displayName: 'John Doe'
      });

      const response = await request(app)
        .delete(`/api/profiles/${profile.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'You can only modify your own profile',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should return 404 for non-existent profile', async () => {
      const { user, token } = await createTestUser();

      const response = await request(app)
        .delete('/api/profiles/non-existent-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/profiles/some-id')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });
  });

  describe('PATCH /api/profiles/:id/verification', () => {
    test('should update verification status for admin', async () => {
      const { user } = await createTestUser();
      const { admin, token } = await createAdminUser();
      
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe',
        verificationStatus: 'unverified'
      });

      const updateData = {
        verificationStatus: 'verified',
        linkedinVerified: true,
        backgroundCheckStatus: 'completed'
      };

      const response = await request(app)
        .patch(`/api/profiles/${profile.id}/verification`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
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
    });

    test('should deny access for non-admin users', async () => {
      const { user, token } = await createTestUser();
      const profile = await Profile.create(user.id, {
        displayName: 'John Doe'
      });

      const response = await request(app)
        .patch(`/api/profiles/${profile.id}/verification`)
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationStatus: 'verified' })
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/profiles/some-id/verification')
        .send({ verificationStatus: 'verified' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    });

    test('should return 404 for non-existent profile', async () => {
      const { admin, token } = await createAdminUser();

      const response = await request(app)
        .patch('/api/profiles/non-existent-id/verification')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationStatus: 'verified' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/profiles/unknown/route')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
      });
    });

    test('should handle invalid JSON in request body', async () => {
      const { user, token } = await createTestUser();

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle large request bodies', async () => {
      const { user, token } = await createTestUser();

      const largeData = {
        displayName: 'Test',
        bio: 'a'.repeat(10000) // Very large bio
      };

      const response = await request(app)
        .post('/api/profiles')
        .set('Authorization', `Bearer ${token}`)
        .send(largeData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'bio',
            code: 'INVALID_BIO'
          })
        ])
      });
    });
  });
});