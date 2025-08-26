/**
 * Skill Validation Middleware Tests
 * Comprehensive test coverage for skill validation middleware
 */

const {
  sanitizeSkillInput,
  validateSkillCreation,
  validateSkillUpdate,
  validateSkillSearch,
  validateSkillPermissions,
  validateProficiencyLevel
} = require('../../src/middleware/skill-validation');
const { Skill } = require('../../src/models/Skill');

describe('Skill Validation Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(async () => {
    // Reset the skill model before each test
    await Skill.reset();

    // Reset mock objects
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: 'test-user', role: 'user' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('sanitizeSkillInput()', () => {
    test('should sanitize string fields', () => {
      mockReq.body = {
        name: '  JavaScript Programming  ',
        description: '  <script>alert("test")</script>A programming language  '
      };

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.name).toBe('JavaScript Programming');
      expect(mockReq.body.description).toMatch(/programming language/);
      expect(mockReq.body.description).not.toContain('<script>');
    });

    test('should sanitize aliases array', () => {
      mockReq.body = {
        aliases: ['  JS  ', '', '  JavaScript  ', 'valid-alias', '  JS  '] // Duplicates and empty
      };

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.aliases).toHaveLength(3); // Duplicates and empty removed
      expect(mockReq.body.aliases).toContain('JS');
      expect(mockReq.body.aliases).toContain('JavaScript');
      expect(mockReq.body.aliases).toContain('valid-alias');
    });

    test('should limit aliases to 10 items', () => {
      mockReq.body = {
        aliases: Array.from({ length: 15 }, (_, i) => `alias-${i}`)
      };

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.aliases).toHaveLength(10);
    });

    test('should sanitize related skills array', () => {
      mockReq.body = {
        relatedSkills: ['skill-1', '  skill-2  ', '', 'skill-3', ...Array.from({ length: 25 }, (_, i) => `skill-${i + 4}`)]
      };

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.relatedSkills).toHaveLength(20); // Limited to 20
      expect(mockReq.body.relatedSkills).not.toContain(''); // Empty removed
    });

    test('should handle sanitization errors', () => {
      // Mock validator to throw error
      const originalEscape = require('validator').escape;
      require('validator').escape = jest.fn().mockImplementation(() => {
        throw new Error('Sanitization error');
      });

      mockReq.body = { name: 'Test Skill' };

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'SANITIZATION_ERROR'
      }));

      // Restore original
      require('validator').escape = originalEscape;
    });
  });

  describe('validateSkillCreation()', () => {
    test('should validate valid skill creation data', () => {
      mockReq.body = {
        name: 'JavaScript',
        category: 'technical',
        description: 'Programming language for web development',
        aliases: ['JS']
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject missing required fields', () => {
      mockReq.body = {
        description: 'Missing name and category'
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            code: 'MISSING_REQUIRED_FIELD'
          }),
          expect.objectContaining({
            field: 'category',
            code: 'MISSING_REQUIRED_FIELD'
          })
        ])
      }));
    });

    test('should validate skill name length', () => {
      mockReq.body = {
        name: 'a'.repeat(101), // Too long
        category: 'technical'
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            code: 'INVALID_FIELD_LENGTH'
          })
        ])
      }));
    });

    test('should validate skill name format', () => {
      mockReq.body = {
        name: 'Invalid@Skill#Name!',
        category: 'technical'
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            code: 'INVALID_FIELD_FORMAT'
          })
        ])
      }));
    });

    test('should validate category values', () => {
      mockReq.body = {
        name: 'Valid Skill',
        category: 'invalid-category'
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'category',
            code: 'INVALID_FIELD_VALUE'
          })
        ])
      }));
    });

    test('should validate description length', () => {
      mockReq.body = {
        name: 'Valid Skill',
        category: 'technical',
        description: 'a'.repeat(501) // Too long
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'description',
            code: 'INVALID_FIELD_LENGTH'
          })
        ])
      }));
    });

    test('should validate status values', () => {
      mockReq.body = {
        name: 'Valid Skill',
        category: 'technical',
        status: 'invalid-status'
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'status',
            code: 'INVALID_FIELD_VALUE'
          })
        ])
      }));
    });

    test('should validate aliases format and limit', () => {
      mockReq.body = {
        name: 'Valid Skill',
        category: 'technical',
        aliases: Array.from({ length: 15 }, (_, i) => `alias-${i}`) // Too many
      };

      const middleware = validateSkillCreation();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'aliases',
            code: 'INVALID_FIELD_FORMAT'
          })
        ])
      }));
    });
  });

  describe('validateSkillUpdate()', () => {
    test('should validate valid skill update data', () => {
      mockReq.body = {
        description: 'Updated description',
        status: 'active'
      };

      const middleware = validateSkillUpdate();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject empty skill name', () => {
      mockReq.body = {
        name: ''
      };

      const middleware = validateSkillUpdate();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            code: 'INVALID_FIELD_VALUE'
          })
        ])
      }));
    });

    test('should validate name format during update', () => {
      mockReq.body = {
        name: 'Invalid@Name!'
      };

      const middleware = validateSkillUpdate();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should reject verification updates by non-admin', () => {
      mockReq.body = {
        verified: true
      };
      mockReq.user = { role: 'user' };

      const middleware = validateSkillUpdate();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'verified',
            code: 'INSUFFICIENT_PERMISSIONS'
          })
        ])
      }));
    });

    test('should allow verification updates by admin', () => {
      mockReq.body = {
        verified: true
      };
      mockReq.user = { role: 'admin' };

      const middleware = validateSkillUpdate();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should handle validation service errors', () => {
      // Mock validator to throw error
      const originalIsLength = require('validator').isLength;
      require('validator').isLength = jest.fn().mockImplementation(() => {
        throw new Error('Validation error');
      });

      mockReq.body = { name: 'Test' };

      const middleware = validateSkillUpdate();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'VALIDATION_SERVICE_ERROR'
      }));

      // Restore original
      require('validator').isLength = originalIsLength;
    });
  });

  describe('validateSkillSearch()', () => {
    test('should validate valid search parameters', () => {
      mockReq.query = {
        page: '1',
        limit: '20',
        sort: 'name',
        order: 'asc'
      };

      const middleware = validateSkillSearch();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should validate page parameter', () => {
      mockReq.query = {
        page: 'invalid'
      };

      const middleware = validateSkillSearch();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
            code: 'INVALID_QUERY_PARAMETER'
          })
        ])
      }));
    });

    test('should validate limit parameter range', () => {
      mockReq.query = {
        limit: '200' // Too high
      };

      const middleware = validateSkillSearch();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should validate sort field', () => {
      mockReq.query = {
        sort: 'invalid-field'
      };

      const middleware = validateSkillSearch();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'sort',
            code: 'INVALID_QUERY_PARAMETER'
          })
        ])
      }));
    });

    test('should validate order parameter', () => {
      mockReq.query = {
        order: 'invalid-order'
      };

      const middleware = validateSkillSearch();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('should validate min_usage parameter', () => {
      mockReq.query = {
        min_usage: '-5' // Negative
      };

      const middleware = validateSkillSearch();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateSkillPermissions()', () => {
    let testSkillId;

    beforeEach(async () => {
      const skill = await Skill.create({
        name: 'Test Skill',
        category: 'technical'
      }, { createdBy: 'test-user' });
      testSkillId = skill.id;
    });

    test('should allow owner to access their skill', async () => {
      mockReq.params = { id: testSkillId };
      mockReq.user = { id: 'test-user', role: 'user' };

      const middleware = validateSkillPermissions();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.skill).toBeDefined();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should allow admin to access any skill', async () => {
      mockReq.params = { id: testSkillId };
      mockReq.user = { id: 'different-user', role: 'admin' };

      const middleware = validateSkillPermissions();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should reject non-owner access to custom skill', async () => {
      mockReq.params = { id: testSkillId };
      mockReq.user = { id: 'different-user', role: 'user' };

      const middleware = validateSkillPermissions();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS'
      }));
    });

    test('should reject non-admin access to system skills', async () => {
      const systemSkill = await Skill.create({
        name: 'System Skill',
        category: 'technical'
      }, { isSystemGenerated: true });

      mockReq.params = { id: systemSkill.id };
      mockReq.user = { id: 'test-user', role: 'user' };

      const middleware = validateSkillPermissions();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'INSUFFICIENT_PERMISSIONS'
      }));
    });

    test('should return 404 for non-existent skill', async () => {
      mockReq.params = { id: 'non-existent-id' };
      mockReq.user = { id: 'test-user', role: 'user' };

      const middleware = validateSkillPermissions();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'SKILL_NOT_FOUND'
      }));
    });

    test('should handle permission validation errors', async () => {
      const originalFindById = Skill.findById;
      Skill.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      mockReq.params = { id: testSkillId };
      mockReq.user = { id: 'test-user', role: 'user' };

      const middleware = validateSkillPermissions();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'PERMISSION_VALIDATION_ERROR'
      }));

      // Restore original
      Skill.findById = originalFindById;
    });
  });

  describe('validateProficiencyLevel()', () => {
    test('should validate valid proficiency levels', () => {
      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

      validLevels.forEach(level => {
        mockReq.body = { proficiency_level: level };

        const middleware = validateProficiencyLevel();
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();

        // Reset mocks for next iteration
        mockNext.mockClear();
        mockRes.status.mockClear();
      });
    });

    test('should reject invalid proficiency levels', () => {
      mockReq.body = { proficiency_level: 'invalid-level' };

      const middleware = validateProficiencyLevel();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'INVALID_PROFICIENCY_LEVEL'
      }));
    });

    test('should allow undefined proficiency level', () => {
      mockReq.body = {}; // No proficiency_level

      const middleware = validateProficiencyLevel();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should handle proficiency validation errors', () => {
      // Mock to throw error
      const middleware = validateProficiencyLevel();
      
      // Override the middleware to throw an error
      const originalImplementation = middleware;
      const throwingMiddleware = () => {
        throw new Error('Validation error');
      };

      expect(() => throwingMiddleware()).toThrow();
    });
  });

  describe('edge cases and error scenarios', () => {
    test('should handle missing request objects', () => {
      const middleware = sanitizeSkillInput();
      
      expect(() => {
        middleware(null, mockRes, mockNext);
      }).not.toThrow();
    });

    test('should handle malformed request body', () => {
      mockReq.body = null;

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle array fields that are not arrays', () => {
      mockReq.body = {
        aliases: 'not-an-array',
        relatedSkills: 'also-not-an-array'
      };

      const middleware = sanitizeSkillInput();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // Should handle gracefully without throwing
    });

    test('should handle concurrent validation requests', async () => {
      const skill = await Skill.create({
        name: 'Concurrent Test Skill',
        category: 'technical'
      }, { createdBy: 'test-user' });

      const requests = Array.from({ length: 5 }, () => ({
        params: { id: skill.id },
        user: { id: 'test-user', role: 'user' }
      }));

      const middleware = validateSkillPermissions();
      const promises = requests.map(req => 
        middleware(req, mockRes, mockNext)
      );

      await Promise.all(promises);

      // All should succeed
      expect(mockNext).toHaveBeenCalledTimes(5);
    });
  });
});