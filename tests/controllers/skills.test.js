/**
 * Skills Controller Tests
 * Comprehensive test coverage for skills controller operations
 */

const request = require('supertest');
const app = require('../../src/app');
const { Skill } = require('../../src/models/Skill');
const { generateToken } = require('../../src/auth/jwt');

describe('Skills Controller', () => {
  let authTokens;
  let testSkillId;

  beforeAll(() => {
    // Generate test tokens for different user types
    authTokens = {
      user: generateToken({
        userId: 'test-user-1',
        email: 'user@test.com',
        role: 'user',
        emailVerified: true,
        kycStatus: 'verified',
        type: 'access'
      }),
      admin: generateToken({
        userId: 'test-admin-1',
        email: 'admin@test.com',
        role: 'admin',
        emailVerified: true,
        kycStatus: 'verified',
        type: 'access'
      }),
      unverified: generateToken({
        userId: 'test-user-2',
        email: 'unverified@test.com',
        role: 'user',
        emailVerified: false,
        kycStatus: 'pending',
        type: 'access'
      })
    };
  });

  beforeEach(async () => {
    // Reset the skill model before each test
    await Skill.reset();

    // Create a test skill for update/delete tests
    const testSkill = await Skill.create({
      name: 'Test Skill',
      category: 'technical',
      description: 'A test skill for unit testing'
    }, {
      createdBy: 'test-user-1',
      isSystemGenerated: false
    });
    testSkillId = testSkill.id;
  });

  describe('POST /api/skills', () => {
    const validSkillData = {
      name: 'Strategic Planning',
      description: 'Long-term strategic planning and business development',
      category: 'business',
      aliases: ['Strategy', 'Business Strategy']
    };

    test('should create skill with valid data and authentication', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(validSkillData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(validSkillData.name);
      expect(response.body.data.category).toBe(validSkillData.category);
      expect(response.body.data.description).toBe(validSkillData.description);
      expect(response.body.data.aliases).toEqual(validSkillData.aliases);
      expect(response.body.data.createdAt).toBeDefined();
    });

    test('should reject skill creation without authentication', async () => {
      const response = await request(app)
        .post('/api/skills')
        .send(validSkillData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    test('should reject skill creation with unverified email', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.unverified}`)
        .send(validSkillData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    test('should reject skill creation with missing required fields', async () => {
      const invalidSkillData = {
        description: 'Missing name and category'
      };

      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(invalidSkillData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test('should reject duplicate skill names', async () => {
      // Create first skill
      await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(validSkillData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(validSkillData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SKILL_EXISTS');
    });

    test('should validate skill name format', async () => {
      const invalidSkillData = {
        name: 'Invalid@Skill#Name!',
        category: 'technical'
      };

      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(invalidSkillData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should provide validation warnings and suggestions', async () => {
      const skillData = {
        name: 'python programming', // Should be standardized
        category: 'soft', // Wrong category for programming
        description: 'Short' // Short description
      };

      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(skillData)
        .expect(201);

      expect(response.body.warnings).toBeDefined();
      expect(response.body.suggestions).toBeDefined();
    });
  });

  describe('GET /api/skills/:id', () => {
    test('should get skill by ID', async () => {
      const response = await request(app)
        .get(`/api/skills/${testSkillId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testSkillId);
      expect(response.body.data.name).toBe('Test Skill');
    });

    test('should get skill with usage stats when requested', async () => {
      // Track some usage first
      await Skill.trackUsage(testSkillId, 'user-1', 'advanced');

      const response = await request(app)
        .get(`/api/skills/${testSkillId}?include_usage_stats=true`)
        .expect(200);

      expect(response.body.data.usageStats).toBeDefined();
      expect(response.body.data.usageStats.uniqueProfiles).toBe(1);
    });

    test('should return 404 for non-existent skill', async () => {
      const response = await request(app)
        .get('/api/skills/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SKILL_NOT_FOUND');
    });
  });

  describe('GET /api/skills', () => {
    beforeEach(async () => {
      // Create test skills for search
      const testSkills = [
        { name: 'JavaScript', category: 'technical', verified: true, description: 'Programming language' },
        { name: 'Python', category: 'technical', verified: true, description: 'Data science language' },
        { name: 'Leadership', category: 'leadership', verified: false, description: 'Team leadership skills' },
        { name: 'Communication', category: 'communication', verified: true, description: 'Effective communication' }
      ];

      for (const skillData of testSkills) {
        await Skill.create(skillData, { isSystemGenerated: true });
      }
    });

    test('should search skills without authentication', async () => {
      const response = await request(app)
        .get('/api/skills')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.facets).toBeDefined();
    });

    test('should filter skills by query', async () => {
      const response = await request(app)
        .get('/api/skills?q=programming')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Should find skills with 'programming' in name or description
      const hasMatchingSkill = response.body.data.some(skill => 
        skill.name.toLowerCase().includes('programming') ||
        skill.description?.toLowerCase().includes('programming')
      );
      expect(hasMatchingSkill).toBe(true);
    });

    test('should filter skills by category', async () => {
      const response = await request(app)
        .get('/api/skills?category=technical')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      response.body.data.forEach(skill => {
        expect(skill.category).toBe('technical');
      });
    });

    test('should filter by multiple categories', async () => {
      const response = await request(app)
        .get('/api/skills?category=technical,leadership')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      response.body.data.forEach(skill => {
        expect(['technical', 'leadership']).toContain(skill.category);
      });
    });

    test('should filter by verification status', async () => {
      const response = await request(app)
        .get('/api/skills?verified=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(skill => {
        expect(skill.verified).toBe(true);
      });
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/skills?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    test('should handle sorting', async () => {
      const response = await request(app)
        .get('/api/skills?sort=name&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(1);
      
      // Check if sorted by name ascending
      const names = response.body.data.map(skill => skill.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    test('should support autocomplete mode', async () => {
      const response = await request(app)
        .get('/api/skills?q=Java&autocomplete=true&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      
      // Should find JavaScript
      const hasJavaScript = response.body.data.some(skill => 
        skill.name.toLowerCase().includes('java')
      );
      expect(hasJavaScript).toBe(true);
    });

    test('should validate search parameters', async () => {
      const response = await request(app)
        .get('/api/skills?page=invalid&limit=200')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_QUERY_PARAMETERS');
    });
  });

  describe('PUT /api/skills/:id', () => {
    test('should update skill by owner', async () => {
      const updateData = {
        description: 'Updated description with more details',
        status: 'active',
        aliases: ['Updated Alias']
      };

      const response = await request(app)
        .put(`/api/skills/${testSkillId}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.aliases).toEqual(updateData.aliases);
    });

    test('should update skill by admin', async () => {
      const updateData = {
        verified: true,
        status: 'deprecated'
      };

      const response = await request(app)
        .put(`/api/skills/${testSkillId}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.status).toBe('deprecated');
    });

    test('should reject update without authentication', async () => {
      const response = await request(app)
        .put(`/api/skills/${testSkillId}`)
        .send({ description: 'Unauthorized update' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject update by non-owner', async () => {
      // Create skill with different user
      const otherSkill = await Skill.create({
        name: 'Other User Skill',
        category: 'technical'
      }, { createdBy: 'other-user' });

      const response = await request(app)
        .put(`/api/skills/${otherSkill.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ description: 'Unauthorized update' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should reject system skill update by non-admin', async () => {
      // Create system-generated skill
      const systemSkill = await Skill.create({
        name: 'System Skill',
        category: 'technical'
      }, { isSystemGenerated: true });

      const response = await request(app)
        .put(`/api/skills/${systemSkill.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ description: 'Unauthorized update' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should validate update data', async () => {
      const invalidUpdateData = {
        name: '', // Empty name
        category: 'invalid-category'
      };

      const response = await request(app)
        .put(`/api/skills/${testSkillId}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should return 404 for non-existent skill', async () => {
      const response = await request(app)
        .put('/api/skills/non-existent-id')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ description: 'Update' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SKILL_NOT_FOUND');
    });
  });

  describe('DELETE /api/skills/:id', () => {
    test('should delete skill by owner', async () => {
      const response = await request(app)
        .delete(`/api/skills/${testSkillId}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify skill is deleted
      await request(app)
        .get(`/api/skills/${testSkillId}`)
        .expect(404);
    });

    test('should delete skill by admin', async () => {
      const response = await request(app)
        .delete(`/api/skills/${testSkillId}`)
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject delete without authentication', async () => {
      const response = await request(app)
        .delete(`/api/skills/${testSkillId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject delete by non-owner', async () => {
      const otherSkill = await Skill.create({
        name: 'Other User Skill',
        category: 'technical'
      }, { createdBy: 'other-user' });

      const response = await request(app)
        .delete(`/api/skills/${otherSkill.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should reject system skill deletion by non-admin', async () => {
      const systemSkill = await Skill.create({
        name: 'System Skill',
        category: 'technical'
      }, { isSystemGenerated: true });

      const response = await request(app)
        .delete(`/api/skills/${systemSkill.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('CANNOT_DELETE_SYSTEM_SKILL');
    });
  });

  describe('GET /api/skills/categories', () => {
    test('should get all skill categories', async () => {
      const response = await request(app)
        .get('/api/skills/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      response.body.data.forEach(category => {
        expect(category.name).toBeDefined();
        expect(category.displayName).toBeDefined();
        expect(category.count).toBeDefined();
        expect(typeof category.count).toBe('number');
      });
    });
  });

  describe('POST /api/skills/validate', () => {
    test('should validate single skill data', async () => {
      const skillData = {
        name: 'Strategic Planning',
        category: 'business',
        description: 'Long-term strategic planning'
      };

      const response = await request(app)
        .post('/api/skills/validate')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ type: 'single', data: skillData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBeDefined();
    });

    test('should validate bulk skill data', async () => {
      const skillsData = [
        { name: 'JavaScript', proficiency: 'advanced' },
        { name: 'Python', proficiency: 'intermediate' }
      ];

      const response = await request(app)
        .post('/api/skills/validate')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ type: 'bulk', data: skillsData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBeDefined();
      expect(response.body.data.invalid).toBeDefined();
    });

    test('should reject validation without authentication', async () => {
      const response = await request(app)
        .post('/api/skills/validate')
        .send({ type: 'single', data: { name: 'Test' } })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/skills/:id/track-usage', () => {
    test('should track skill usage', async () => {
      const response = await request(app)
        .post(`/api/skills/${testSkillId}/track-usage`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ proficiency_level: 'advanced' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('tracked successfully');
    });

    test('should validate proficiency level', async () => {
      const response = await request(app)
        .post(`/api/skills/${testSkillId}/track-usage`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ proficiency_level: 'invalid-level' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_PROFICIENCY_LEVEL');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/skills/${testSkillId}/track-usage`)
        .send({ proficiency_level: 'advanced' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/skills/stats', () => {
    test('should get skill statistics as admin', async () => {
      const response = await request(app)
        .get('/api/skills/stats')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalSkills).toBeDefined();
      expect(response.body.data.activeSkills).toBeDefined();
      expect(response.body.data.categoryCounts).toBeDefined();
    });

    test('should reject stats request by non-admin', async () => {
      const response = await request(app)
        .get('/api/skills/stats')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/skills/popular', () => {
    beforeEach(async () => {
      // Create and track usage for some skills
      const skill1 = await Skill.create({
        name: 'Popular Skill 1',
        category: 'technical'
      });
      
      const skill2 = await Skill.create({
        name: 'Popular Skill 2', 
        category: 'leadership'
      });

      // Track usage to make them popular
      await Skill.trackUsage(skill1.id, 'user1', 'advanced');
      await Skill.trackUsage(skill1.id, 'user2', 'expert');
      await Skill.trackUsage(skill2.id, 'user3', 'intermediate');
    });

    test('should get popular skills', async () => {
      const response = await request(app)
        .get('/api/skills/popular')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      response.body.data.forEach(skill => {
        expect(skill.id).toBeDefined();
        expect(skill.name).toBeDefined();
        expect(skill.category).toBeDefined();
        expect(skill.usageCount).toBeDefined();
        expect(skill.popularityScore).toBeDefined();
      });
    });

    test('should filter popular skills by category', async () => {
      const response = await request(app)
        .get('/api/skills/popular?category=technical')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(skill => {
        expect(skill.category).toBe('technical');
      });
    });

    test('should limit popular skills results', async () => {
      const response = await request(app)
        .get('/api/skills/popular?limit=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/skills/suggestions', () => {
    beforeEach(async () => {
      // Create some skills for autocomplete
      await Skill.create({ name: 'JavaScript', category: 'technical' });
      await Skill.create({ name: 'Java', category: 'technical' });
      await Skill.create({ name: 'Python', category: 'technical' });
    });

    test('should get skill suggestions', async () => {
      const response = await request(app)
        .get('/api/skills/suggestions?q=Java')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const hasJavaSkill = response.body.data.some(skill =>
        skill.name.toLowerCase().includes('java')
      );
      expect(hasJavaSkill).toBe(true);
    });

    test('should require minimum query length', async () => {
      const response = await request(app)
        .get('/api/skills/suggestions?q=J')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_QUERY');
    });

    test('should limit suggestions results', async () => {
      const response = await request(app)
        .get('/api/skills/suggestions?q=Java&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    test('should handle internal server errors gracefully', async () => {
      // Mock an internal error by corrupting the skill model temporarily
      const originalMethod = Skill.findById;
      Skill.findById = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/skills/${testSkillId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INTERNAL_ERROR');

      // Restore the original method
      Skill.findById = originalMethod;
    });

    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle missing route parameters', async () => {
      const response = await request(app)
        .get('/api/skills/')
        .expect(200); // This should go to the search endpoint

      expect(response.body.success).toBe(true);
    });
  });
});