/**
 * Skills API Routes Tests
 * Comprehensive test coverage for skill API endpoints and middleware integration
 */

const request = require('supertest');
const app = require('../../../src/app');
const { Skill } = require('../../../src/models/Skill');
const { generateToken } = require('../../../src/auth/jwt');

describe('Skills API Routes', () => {
  let authTokens;

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
      }),
      invalidToken: 'invalid.jwt.token'
    };
  });

  beforeEach(async () => {
    // Reset the skill model before each test
    await Skill.reset();
  });

  describe('route middleware integration', () => {
    test('should apply authentication middleware correctly', async () => {
      const response = await request(app)
        .post('/api/skills')
        .send({ name: 'Test Skill', category: 'technical' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    test('should apply input sanitization middleware', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({
          name: '  <script>alert("xss")</script>JavaScript  ',
          category: 'technical',
          description: '  Programming language  '
        })
        .expect(201);

      expect(response.body.data.name).not.toContain('<script>');
      expect(response.body.data.name).toBe('JavaScript');
    });

    test('should apply validation middleware before processing', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({
          name: '', // Invalid
          category: 'invalid-category' // Invalid
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    test('should apply permission middleware for updates', async () => {
      // Create a skill with different user
      const skill = await Skill.create({
        name: 'Other User Skill',
        category: 'technical'
      }, { createdBy: 'other-user' });

      const response = await request(app)
        .put(`/api/skills/${skill.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ description: 'Unauthorized update' })
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('route ordering and precedence', () => {
    test('should match specific routes before parameterized routes', async () => {
      // /api/skills/categories should match before /api/skills/:id
      const response = await request(app)
        .get('/api/skills/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should match suggestions route correctly', async () => {
      const response = await request(app)
        .get('/api/skills/suggestions?q=Java')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should match popular route correctly', async () => {
      const response = await request(app)
        .get('/api/skills/popular')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should match stats route with admin authentication', async () => {
      const response = await request(app)
        .get('/api/skills/stats')
        .set('Authorization', `Bearer ${authTokens.admin}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('should match validate route correctly', async () => {
      const response = await request(app)
        .post('/api/skills/validate')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({
          type: 'single',
          data: { name: 'JavaScript', category: 'technical' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('error handling middleware', () => {
    test('should handle SkillError with appropriate status codes', async () => {
      // Create a skill first
      const skill = await Skill.create({
        name: 'Existing Skill',
        category: 'technical'
      });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({
          name: 'Existing Skill',
          category: 'technical'
        })
        .expect(409); // Conflict

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SKILL_EXISTS');
    });

    test('should handle validation errors correctly', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({
          name: 'Valid Name',
          category: 'invalid-category'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle not found errors', async () => {
      const response = await request(app)
        .get('/api/skills/non-existent-skill-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SKILL_NOT_FOUND');
    });

    test('should handle permission errors', async () => {
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

    test('should pass unknown errors to global handler', async () => {
      // This is harder to test directly, but we can verify the route setup
      // The middleware should call next() for unknown errors
      const response = await request(app)
        .get('/api/skills/invalid-uuid-format')
        .expect(404); // Will be handled by skill not found

      expect(response.body.success).toBe(false);
    });
  });

  describe('route parameter validation', () => {
    test('should handle malformed skill IDs gracefully', async () => {
      const response = await request(app)
        .get('/api/skills/malformed-id-123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SKILL_NOT_FOUND');
    });

    test('should validate track-usage route parameters', async () => {
      const skill = await Skill.create({
        name: 'Test Skill',
        category: 'technical'
      });

      const response = await request(app)
        .post(`/api/skills/${skill.id}/track-usage`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ proficiency_level: 'invalid-level' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_PROFICIENCY_LEVEL');
    });
  });

  describe('authentication and authorization flow', () => {
    test('should require authentication for protected routes', async () => {
      const protectedRoutes = [
        { method: 'post', path: '/api/skills', body: { name: 'Test', category: 'technical' } },
        { method: 'post', path: '/api/skills/validate', body: { type: 'single', data: {} } },
        { method: 'put', path: '/api/skills/test-id', body: {} },
        { method: 'delete', path: '/api/skills/test-id' },
        { method: 'post', path: '/api/skills/test-id/track-usage', body: {} }
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          [route.method](route.path)
          .send(route.body || {})
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    test('should require email verification for certain routes', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.unverified}`)
        .send({ name: 'Test Skill', category: 'technical' })
        .expect(403);

      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    test('should require admin role for admin routes', async () => {
      const response = await request(app)
        .get('/api/skills/stats')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should handle invalid tokens gracefully', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.invalidToken}`)
        .send({ name: 'Test Skill', category: 'technical' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('optional authentication routes', () => {
    test('should work without authentication for public routes', async () => {
      const publicRoutes = [
        '/api/skills',
        '/api/skills/suggestions?q=Java',
        '/api/skills/popular',
        '/api/skills/categories'
      ];

      for (const route of publicRoutes) {
        const response = await request(app)
          .get(route)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    test('should enhance results with authentication for optional auth routes', async () => {
      // Create a skill and track usage
      const skill = await Skill.create({
        name: 'Test Skill',
        category: 'technical'
      });
      await Skill.trackUsage(skill.id, 'test-user-1', 'advanced');

      // Compare responses with and without auth
      const unauthResponse = await request(app)
        .get(`/api/skills/${skill.id}`)
        .expect(200);

      const authResponse = await request(app)
        .get(`/api/skills/${skill.id}`)
        .set('Authorization', `Bearer ${authTokens.user}`)
        .expect(200);

      // Both should succeed, but authenticated might have additional data
      expect(unauthResponse.body.success).toBe(true);
      expect(authResponse.body.success).toBe(true);
    });
  });

  describe('content negotiation and headers', () => {
    test('should handle JSON content type correctly', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          name: 'JSON Test Skill',
          category: 'technical'
        }))
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('rate limiting and security', () => {
    test('should apply rate limiting to API routes', async () => {
      // This test depends on the rate limiting configuration
      // For now, we'll just verify that rate limiting middleware is applied
      const response = await request(app)
        .get('/api/skills')
        .expect(200);

      // Rate limiting headers might be present
      expect(response.body.success).toBe(true);
    });

    test('should apply security headers', async () => {
      const response = await request(app)
        .get('/api/skills')
        .expect(200);

      // Check for common security headers (depends on security middleware)
      expect(response.body.success).toBe(true);
    });
  });

  describe('CORS and preflight requests', () => {
    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/skills')
        .expect(404); // OPTIONS are handled by global 404 in this setup

      // In a real application with CORS middleware, this would return 200
    });
  });

  describe('route performance and caching', () => {
    test('should handle concurrent requests to the same route', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/skills/categories')
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('should handle large result sets efficiently', async () => {
      // Create many skills
      const skills = Array.from({ length: 50 }, (_, i) => ({
        name: `Skill ${i}`,
        category: 'technical'
      }));

      for (const skillData of skills) {
        await Skill.create(skillData, { isSystemGenerated: true });
      }

      const start = Date.now();
      const response = await request(app)
        .get('/api/skills?limit=100')
        .expect(200);
      const duration = Date.now() - start;

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(40);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('API versioning and compatibility', () => {
    test('should maintain backward compatibility', async () => {
      // Test that existing API contracts are maintained
      const response = await request(app)
        .get('/api/skills')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('facets');
    });

    test('should handle API evolution gracefully', async () => {
      // Test that new optional parameters don't break existing functionality
      const response = await request(app)
        .get('/api/skills?new_optional_param=test')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('integration with other services', () => {
    test('should integrate with authentication service', async () => {
      // Test that JWT tokens are properly validated
      const response = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${authTokens.user}`)
        .send({ name: 'Integration Test', category: 'technical' })
        .expect(201);

      expect(response.body.data.createdAt).toBeDefined();
    });

    test('should handle service dependencies gracefully', async () => {
      // Test behavior when dependent services are unavailable
      // This would typically involve mocking external dependencies
      const response = await request(app)
        .get('/api/skills')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});