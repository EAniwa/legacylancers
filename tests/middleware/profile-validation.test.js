/**
 * Profile Validation Middleware Tests
 * Comprehensive test coverage for profile validation and sanitization
 */

const {
  validateProfileCreation,
  validateProfileUpdate,
  validateProfileSearch,
  validateProfileSlug,
  sanitizeProfileInput,
  validateProfileOwnership,
  ValidationError
} = require('../../src/middleware/profile-validation');

const { Profile } = require('../../src/models/Profile');

// Mock console.error to avoid test output pollution
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Profile Validation Middleware', () => {
  // Helper functions to create mock req/res objects
  const createMockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    user: { id: 'test-user-id', role: 'user' },
    ...overrides
  });

  const createMockRes = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  };

  const createMockNext = () => jest.fn();

  beforeEach(async () => {
    await Profile.reset();
    jest.clearAllMocks();
  });

  describe('validateProfileCreation()', () => {
    test('should pass validation with valid profile data', async () => {
      const req = createMockReq({
        body: {
          displayName: 'John Senior',
          headline: 'Technology Executive',
          bio: 'Experienced technology leader with over 25 years in the industry.',
          profilePhotoUrl: 'https://example.com/photo.jpg',
          linkedinUrl: 'https://linkedin.com/in/johnsenior',
          yearsOfExperience: 25,
          industry: 'Technology',
          availabilityStatus: 'available',
          engagementTypes: ['consulting', 'mentoring'],
          hourlyRateMin: 150,
          hourlyRateMax: 300,
          currency: 'USD',
          isProfilePublic: true,
          searchable: true
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should pass validation with minimal valid data', async () => {
      const req = createMockReq({
        body: {
          isProfilePublic: false
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject invalid display name length', async () => {
      const req = createMockReq({
        body: {
          displayName: 'a'.repeat(151) // Too long
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'displayName',
            code: 'INVALID_DISPLAY_NAME'
          })
        ])
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject invalid headline length', async () => {
      const req = createMockReq({
        body: {
          headline: 'a'.repeat(201) // Too long
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'headline',
              code: 'INVALID_HEADLINE'
            })
          ])
        })
      );
    });

    test('should reject invalid bio length', async () => {
      const req = createMockReq({
        body: {
          bio: 'a'.repeat(5001) // Too long
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'bio',
              code: 'INVALID_BIO'
            })
          ])
        })
      );
    });

    test('should reject invalid URL formats', async () => {
      const req = createMockReq({
        body: {
          profilePhotoUrl: 'not-a-url',
          linkedinUrl: 'ftp://invalid-protocol.com',
          portfolioUrl: 'missing-protocol.com'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'profilePhotoUrl' }),
            expect.objectContaining({ field: 'linkedinUrl' }),
            expect.objectContaining({ field: 'portfolioUrl' })
          ])
        })
      );
    });

    test('should reject invalid years of experience', async () => {
      const testCases = [
        { value: -1, description: 'negative value' },
        { value: 71, description: 'too high value' },
        { value: 'not-a-number', description: 'non-numeric value' }
      ];

      for (const testCase of testCases) {
        const req = createMockReq({
          body: { yearsOfExperience: testCase.value }
        });
        const res = createMockRes();
        const next = createMockNext();

        const middleware = validateProfileCreation();
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'yearsOfExperience',
                code: 'INVALID_YEARS_EXPERIENCE'
              })
            ])
          })
        );
        
        jest.clearAllMocks();
      }
    });

    test('should reject invalid availability status', async () => {
      const req = createMockReq({
        body: {
          availabilityStatus: 'invalid-status'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'availabilityStatus',
              code: 'INVALID_AVAILABILITY_STATUS'
            })
          ])
        })
      );
    });

    test('should reject invalid engagement types', async () => {
      const req = createMockReq({
        body: {
          engagementTypes: ['invalid-type', 'consulting']
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'engagementTypes',
              code: 'INVALID_ENGAGEMENT_TYPE'
            })
          ])
        })
      );
    });

    test('should reject non-array engagement types', async () => {
      const req = createMockReq({
        body: {
          engagementTypes: 'not-an-array'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'engagementTypes',
              code: 'INVALID_ENGAGEMENT_TYPES_FORMAT'
            })
          ])
        })
      );
    });

    test('should reject too many engagement types', async () => {
      const req = createMockReq({
        body: {
          engagementTypes: ['freelance', 'consulting', 'project', 'keynote', 'mentoring', 'extra']
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'engagementTypes',
              code: 'TOO_MANY_ENGAGEMENT_TYPES'
            })
          ])
        })
      );
    });

    test('should reject invalid rates', async () => {
      const req = createMockReq({
        body: {
          hourlyRateMin: -100,
          hourlyRateMax: 1000000,
          projectRateMin: 'not-a-number'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'hourlyRateMin' }),
            expect.objectContaining({ field: 'hourlyRateMax' }),
            expect.objectContaining({ field: 'projectRateMin' })
          ])
        })
      );
    });

    test('should reject invalid rate ranges', async () => {
      const req = createMockReq({
        body: {
          hourlyRateMin: 300,
          hourlyRateMax: 200, // Min > Max
          projectRateMin: 10000,
          projectRateMax: 5000 // Min > Max
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'hourlyRates',
              code: 'INVALID_HOURLY_RATE_RANGE'
            }),
            expect.objectContaining({
              field: 'projectRates',
              code: 'INVALID_PROJECT_RATE_RANGE'
            })
          ])
        })
      );
    });

    test('should reject invalid currency', async () => {
      const req = createMockReq({
        body: {
          currency: 'INVALID'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'currency',
              code: 'INVALID_CURRENCY'
            })
          ])
        })
      );
    });

    test('should reject invalid boolean types', async () => {
      const req = createMockReq({
        body: {
          isProfilePublic: 'not-a-boolean',
          showHourlyRates: 'invalid',
          searchable: 123
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'isProfilePublic' }),
            expect.objectContaining({ field: 'showHourlyRates' }),
            expect.objectContaining({ field: 'searchable' })
          ])
        })
      );
    });

    test('should handle multiple validation errors', async () => {
      const req = createMockReq({
        body: {
          displayName: 'a'.repeat(151),
          headline: 'b'.repeat(201),
          yearsOfExperience: -1,
          engagementTypes: ['invalid-type'],
          currency: 'INVALID'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'displayName' }),
            expect.objectContaining({ field: 'headline' }),
            expect.objectContaining({ field: 'yearsOfExperience' }),
            expect.objectContaining({ field: 'engagementTypes' }),
            expect.objectContaining({ field: 'currency' })
          ])
        })
      );
      expect(res.json.mock.calls[0][0].details).toHaveLength(5);
    });

    test('should handle internal errors gracefully', async () => {
      // Create a request that will cause an internal error
      const req = {
        body: null // This should cause an error when trying to iterate
      };
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    });
  });

  describe('validateProfileUpdate()', () => {
    test('should use same validation as creation', async () => {
      const req = createMockReq({
        body: {
          displayName: 'Valid Name',
          headline: 'Valid Headline'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileUpdate();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should allow partial updates', async () => {
      const req = createMockReq({
        body: {
          headline: 'Only updating headline'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileUpdate();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateProfileSearch()', () => {
    test('should pass validation with valid search parameters', async () => {
      const req = createMockReq({
        query: {
          page: '1',
          limit: '20',
          sort: 'createdAt',
          order: 'desc',
          availabilityStatus: 'available',
          engagementTypes: ['consulting', 'mentoring'],
          minExperience: '10',
          maxHourlyRate: '500',
          verified: 'true',
          searchable: 'true'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject invalid page parameter', async () => {
      const req = createMockReq({
        query: { page: '0' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'page',
              code: 'INVALID_PAGE'
            })
          ])
        })
      );
    });

    test('should reject invalid limit parameter', async () => {
      const testCases = [
        { value: '0', description: 'zero limit' },
        { value: '101', description: 'limit too high' },
        { value: 'not-a-number', description: 'non-numeric limit' }
      ];

      for (const testCase of testCases) {
        const req = createMockReq({
          query: { limit: testCase.value }
        });
        const res = createMockRes();
        const next = createMockNext();

        const middleware = validateProfileSearch();
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'limit',
                code: 'INVALID_LIMIT'
              })
            ])
          })
        );
        
        jest.clearAllMocks();
      }
    });

    test('should reject invalid sort field', async () => {
      const req = createMockReq({
        query: { sort: 'invalidField' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'sort',
              code: 'INVALID_SORT_FIELD'
            })
          ])
        })
      );
    });

    test('should reject invalid order parameter', async () => {
      const req = createMockReq({
        query: { order: 'invalid' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'order',
              code: 'INVALID_ORDER'
            })
          ])
        })
      );
    });

    test('should reject invalid availability status', async () => {
      const req = createMockReq({
        query: { availabilityStatus: 'invalid' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'availabilityStatus',
              code: 'INVALID_AVAILABILITY_STATUS'
            })
          ])
        })
      );
    });

    test('should reject invalid engagement types', async () => {
      const req = createMockReq({
        query: { engagementTypes: 'invalid-type' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'engagementTypes',
              code: 'INVALID_ENGAGEMENT_TYPE'
            })
          ])
        })
      );
    });

    test('should reject invalid numeric parameters', async () => {
      const req = createMockReq({
        query: {
          minExperience: '-1',
          maxHourlyRate: 'not-a-number'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'minExperience' }),
            expect.objectContaining({ field: 'maxHourlyRate' })
          ])
        })
      );
    });

    test('should reject invalid boolean parameters', async () => {
      const req = createMockReq({
        query: {
          verified: 'invalid',
          searchable: 'not-boolean'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSearch();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'verified' }),
            expect.objectContaining({ field: 'searchable' })
          ])
        })
      );
    });
  });

  describe('validateProfileSlug()', () => {
    test('should pass validation with valid slug', async () => {
      const req = createMockReq({
        params: { slug: 'valid-slug-123' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSlug();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject missing slug', async () => {
      const req = createMockReq({
        params: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSlug();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile slug is required',
        code: 'MISSING_SLUG'
      });
    });

    test('should reject invalid slug format', async () => {
      const invalidSlugs = [
        'Invalid_Slug!',
        'UPPERCASE-SLUG',
        'slug with spaces',
        'slug@with#special$chars'
      ];

      for (const slug of invalidSlugs) {
        const req = createMockReq({
          params: { slug }
        });
        const res = createMockRes();
        const next = createMockNext();

        const middleware = validateProfileSlug();
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid slug format. Must contain only lowercase letters, numbers, and hyphens',
          code: 'INVALID_SLUG_FORMAT'
        });
        
        jest.clearAllMocks();
      }
    });

    test('should reject slug that is too long', async () => {
      const req = createMockReq({
        params: { slug: 'a'.repeat(101) }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileSlug();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Slug must be between 1 and 100 characters',
        code: 'INVALID_SLUG_LENGTH'
      });
    });
  });

  describe('sanitizeProfileInput()', () => {
    test('should sanitize string fields', async () => {
      const req = createMockReq({
        body: {
          displayName: '  John Senior  ',
          headline: '\tTechnology Executive\n',
          bio: '  Experienced leader  ',
          industry: ' Technology ',
          timezone: '  America/New_York  '
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(req.body).toEqual({
        displayName: 'John Senior',
        headline: 'Technology Executive',
        bio: 'Experienced leader',
        industry: 'Technology',
        timezone: 'America/New_York'
      });
      expect(next).toHaveBeenCalled();
    });

    test('should convert empty strings to null', async () => {
      const req = createMockReq({
        body: {
          displayName: '',
          headline: '   ',
          bio: '',
          profilePhotoUrl: '',
          linkedinUrl: '   '
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(req.body).toEqual({
        displayName: null,
        headline: null,
        bio: null,
        profilePhotoUrl: null,
        linkedinUrl: null
      });
    });

    test('should convert string numbers to numbers', async () => {
      const req = createMockReq({
        body: {
          yearsOfExperience: '25',
          hourlyRateMin: '150.50',
          hourlyRateMax: '300',
          projectRateMin: '5000.99',
          keynoteRate: '2500'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(req.body).toEqual({
        yearsOfExperience: 25,
        hourlyRateMin: 150.5,
        hourlyRateMax: 300,
        projectRateMin: 5000.99,
        keynoteRate: 2500
      });
    });

    test('should leave invalid numbers unchanged', async () => {
      const req = createMockReq({
        body: {
          yearsOfExperience: 'not-a-number',
          hourlyRateMin: 'invalid'
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(req.body).toEqual({
        yearsOfExperience: 'not-a-number',
        hourlyRateMin: 'invalid'
      });
    });

    test('should convert string booleans to booleans', async () => {
      const req = createMockReq({
        body: {
          isProfilePublic: 'true',
          showHourlyRates: 'false',
          searchable: 'TRUE',
          dataSharingConsent: 'FALSE',
          publicProfileConsent: 1
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(req.body).toEqual({
        isProfilePublic: true,
        showHourlyRates: false,
        searchable: true,
        dataSharingConsent: false,
        publicProfileConsent: true
      });
    });

    test('should remove duplicates from engagement types', async () => {
      const req = createMockReq({
        body: {
          engagementTypes: ['consulting', 'mentoring', 'consulting', 'project']
        }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(req.body.engagementTypes).toEqual(['consulting', 'mentoring', 'project']);
    });

    test('should handle internal errors gracefully', async () => {
      // Create a request that will cause an error
      const req = {
        body: null
      };
      const res = createMockRes();
      const next = createMockNext();

      const middleware = sanitizeProfileInput();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal sanitization error',
        code: 'SANITIZATION_INTERNAL_ERROR'
      });
    });
  });

  describe('validateProfileOwnership()', () => {
    beforeEach(async () => {
      // Create a test profile for ownership validation
      const profile = await Profile.create('profile-owner-id', {
        displayName: 'Test Profile'
      });
      
      // Store the profile ID for tests
      this.testProfileId = profile.id;
    });

    test('should allow owner to access their profile', async () => {
      const req = createMockReq({
        user: { id: 'profile-owner-id', role: 'user' },
        params: { id: this.testProfileId }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should allow admin to access any profile', async () => {
      const req = createMockReq({
        user: { id: 'admin-user-id', role: 'admin' },
        params: { id: this.testProfileId }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should deny non-owner access to profile', async () => {
      const req = createMockReq({
        user: { id: 'other-user-id', role: 'user' },
        params: { id: this.testProfileId }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You can only modify your own profile',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should return 404 for non-existent profile', async () => {
      const req = createMockReq({
        user: { id: 'test-user-id', role: 'user' },
        params: { id: 'non-existent-profile-id' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    });

    test('should require authentication', async () => {
      const req = createMockReq({
        user: null,
        params: { id: this.testProfileId }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    });

    test('should validate userId in profile creation', async () => {
      const req = createMockReq({
        user: { id: 'test-user-id', role: 'user' },
        body: { userId: 'different-user-id' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You can only create profiles for yourself',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    });

    test('should work with profileId parameter', async () => {
      const req = createMockReq({
        user: { id: 'profile-owner-id', role: 'user' },
        params: { profileId: this.testProfileId }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should handle internal errors gracefully', async () => {
      // Mock Profile.findById to throw an error
      const originalFindById = Profile.findById;
      Profile.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      const req = createMockReq({
        user: { id: 'test-user-id', role: 'user' },
        params: { id: 'some-profile-id' }
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = validateProfileOwnership();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal authorization error',
        code: 'AUTHORIZATION_INTERNAL_ERROR'
      });

      // Restore original method
      Profile.findById = originalFindById;
    });
  });

  describe('ValidationError', () => {
    test('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Test message', 'testField', 'TEST_CODE');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test message');
      expect(error.field).toBe('testField');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
    });

    test('should create ValidationError with default values', () => {
      const error = new ValidationError('Test message');
      
      expect(error.field).toBeNull();
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });
});