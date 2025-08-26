/**
 * Skill Model Tests
 * Comprehensive test coverage for Skill model operations
 */

const { Skill, SkillError } = require('../../src/models/Skill');

describe('Skill Model', () => {
  beforeEach(async () => {
    // Reset the skill model before each test
    await Skill.reset();
  });

  describe('create()', () => {
    const validSkillData = {
      name: 'Strategic Planning',
      description: 'Long-term strategic planning and business development',
      category: 'business',
      aliases: ['Strategy', 'Business Strategy'],
      status: 'active',
      verified: false
    };

    test('should create a skill successfully with valid data', async () => {
      const skill = await Skill.create(validSkillData, {
        createdBy: 'test-user-id',
        isSystemGenerated: false
      });

      expect(skill).toBeDefined();
      expect(skill.id).toBeDefined();
      expect(skill.name).toBe(validSkillData.name);
      expect(skill.normalizedName).toBe(validSkillData.name.toLowerCase());
      expect(skill.description).toBe(validSkillData.description);
      expect(skill.category).toBe(validSkillData.category);
      expect(skill.aliases).toEqual(validSkillData.aliases);
      expect(skill.status).toBe(validSkillData.status);
      expect(skill.verified).toBe(validSkillData.verified);
      expect(skill.usageCount).toBe(0);
      expect(skill.popularityScore).toBe(0);
      expect(skill.isSystemGenerated).toBe(false);
      expect(skill.createdAt).toBeDefined();
      expect(skill.updatedAt).toBeDefined();
      expect(skill.deletedAt).toBeNull();
    });

    test('should create a system-generated skill with higher popularity score', async () => {
      const skill = await Skill.create(validSkillData, {
        isSystemGenerated: true
      });

      expect(skill.isSystemGenerated).toBe(true);
      expect(skill.popularityScore).toBeGreaterThan(0);
    });

    test('should create skill with minimal required data', async () => {
      const minimalSkillData = {
        name: 'Python',
        category: 'technical'
      };

      const skill = await Skill.create(minimalSkillData);

      expect(skill.name).toBe(minimalSkillData.name);
      expect(skill.category).toBe(minimalSkillData.category);
      expect(skill.description).toBeNull();
      expect(skill.aliases).toEqual([]);
      expect(skill.status).toBe('active');
      expect(skill.verified).toBe(false);
    });

    test('should throw error for duplicate skill names', async () => {
      await Skill.create(validSkillData);

      await expect(Skill.create(validSkillData))
        .rejects.toThrow(SkillError);
    });

    test('should throw error for missing required fields', async () => {
      await expect(Skill.create({}))
        .rejects.toThrow(SkillError);

      await expect(Skill.create({ name: 'Test' }))
        .rejects.toThrow(SkillError);

      await expect(Skill.create({ category: 'technical' }))
        .rejects.toThrow(SkillError);
    });

    test('should validate skill name length and format', async () => {
      // Test empty name
      await expect(Skill.create({ name: '', category: 'technical' }))
        .rejects.toThrow(SkillError);

      // Test name too long
      const longName = 'a'.repeat(101);
      await expect(Skill.create({ name: longName, category: 'technical' }))
        .rejects.toThrow(SkillError);
    });

    test('should validate category', async () => {
      await expect(Skill.create({ 
        name: 'Test Skill', 
        category: 'invalid-category' 
      })).rejects.toThrow(SkillError);
    });
  });

  describe('findById()', () => {
    test('should find skill by ID', async () => {
      const skillData = {
        name: 'JavaScript',
        category: 'technical',
        description: 'Programming language for web development'
      };

      const createdSkill = await Skill.create(skillData);
      const foundSkill = await Skill.findById(createdSkill.id);

      expect(foundSkill).toBeDefined();
      expect(foundSkill.id).toBe(createdSkill.id);
      expect(foundSkill.name).toBe(skillData.name);
    });

    test('should return null for non-existent skill', async () => {
      const skill = await Skill.findById('non-existent-id');
      expect(skill).toBeNull();
    });

    test('should return null for deleted skill', async () => {
      const skillData = {
        name: 'Deprecated Skill',
        category: 'technical'
      };

      const createdSkill = await Skill.create(skillData, { 
        createdBy: 'test-user' 
      });
      await Skill.delete(createdSkill.id);

      const foundSkill = await Skill.findById(createdSkill.id);
      expect(foundSkill).toBeNull();
    });

    test('should include usage stats when requested', async () => {
      const skillData = {
        name: 'Data Analysis',
        category: 'analytical'
      };

      const createdSkill = await Skill.create(skillData);
      
      // Track some usage
      await Skill.trackUsage(createdSkill.id, 'user1', 'advanced');
      await Skill.trackUsage(createdSkill.id, 'user2', 'intermediate');

      const skillWithStats = await Skill.findById(createdSkill.id, {
        includeUsageStats: true
      });

      expect(skillWithStats.usageStats).toBeDefined();
      expect(skillWithStats.usageStats.uniqueProfiles).toBe(2);
    });
  });

  describe('findByName()', () => {
    test('should find skill by exact name (case-insensitive)', async () => {
      const skillData = {
        name: 'Project Management',
        category: 'project-management'
      };

      await Skill.create(skillData);

      const skill1 = await Skill.findByName('Project Management');
      expect(skill1).toBeDefined();
      expect(skill1.name).toBe(skillData.name);

      const skill2 = await Skill.findByName('project management');
      expect(skill2).toBeDefined();
      expect(skill2.name).toBe(skillData.name);

      const skill3 = await Skill.findByName('PROJECT MANAGEMENT');
      expect(skill3).toBeDefined();
      expect(skill3.name).toBe(skillData.name);
    });

    test('should find skill by alias', async () => {
      const skillData = {
        name: 'JavaScript',
        category: 'technical',
        aliases: ['JS', 'ECMAScript']
      };

      await Skill.create(skillData);

      const skill1 = await Skill.findByName('JS');
      expect(skill1).toBeDefined();
      expect(skill1.name).toBe(skillData.name);

      const skill2 = await Skill.findByName('ECMAScript');
      expect(skill2).toBeDefined();
      expect(skill2.name).toBe(skillData.name);
    });

    test('should return null for non-existent skill', async () => {
      const skill = await Skill.findByName('Non-existent Skill');
      expect(skill).toBeNull();
    });
  });

  describe('update()', () => {
    test('should update skill successfully', async () => {
      const skillData = {
        name: 'Python',
        category: 'technical',
        description: 'Programming language'
      };

      const createdSkill = await Skill.create(skillData, {
        createdBy: 'test-user'
      });

      const updateData = {
        description: 'Programming language for data science and web development',
        status: 'active',
        verified: true
      };

      const updatedSkill = await Skill.update(createdSkill.id, updateData);

      expect(updatedSkill.description).toBe(updateData.description);
      expect(updatedSkill.status).toBe(updateData.status);
      expect(updatedSkill.verified).toBe(updateData.verified);
      expect(updatedSkill.updatedAt).not.toEqual(createdSkill.updatedAt);
    });

    test('should update normalized name when name changes', async () => {
      const skillData = {
        name: 'JS',
        category: 'technical'
      };

      const createdSkill = await Skill.create(skillData, {
        createdBy: 'test-user'
      });

      const updatedSkill = await Skill.update(createdSkill.id, {
        name: 'JavaScript'
      });

      expect(updatedSkill.name).toBe('JavaScript');
      expect(updatedSkill.normalizedName).toBe('javascript');
    });

    test('should prevent name conflicts during update', async () => {
      await Skill.create({ name: 'Skill A', category: 'technical' });
      const skillB = await Skill.create({ name: 'Skill B', category: 'technical' });

      await expect(Skill.update(skillB.id, { name: 'Skill A' }))
        .rejects.toThrow(SkillError);
    });

    test('should throw error for non-existent skill', async () => {
      await expect(Skill.update('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow(SkillError);
    });
  });

  describe('delete()', () => {
    test('should soft delete skill successfully', async () => {
      const skillData = {
        name: 'Outdated Technology',
        category: 'technical'
      };

      const createdSkill = await Skill.create(skillData, {
        createdBy: 'test-user'
      });

      const result = await Skill.delete(createdSkill.id);
      expect(result).toBe(true);

      const deletedSkill = await Skill.findById(createdSkill.id);
      expect(deletedSkill).toBeNull();
    });

    test('should prevent deletion of system-generated skills', async () => {
      const skillData = {
        name: 'Leadership',
        category: 'leadership'
      };

      const createdSkill = await Skill.create(skillData, {
        isSystemGenerated: true
      });

      await expect(Skill.delete(createdSkill.id))
        .rejects.toThrow(SkillError);
    });

    test('should throw error for non-existent skill', async () => {
      await expect(Skill.delete('non-existent-id'))
        .rejects.toThrow(SkillError);
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      // Create test skills
      const testSkills = [
        { name: 'JavaScript', category: 'technical', description: 'Programming language', verified: true },
        { name: 'Python', category: 'technical', description: 'Data science language', verified: true },
        { name: 'Leadership', category: 'leadership', description: 'Leading teams', verified: true },
        { name: 'Communication', category: 'communication', description: 'Effective communication', verified: false },
        { name: 'Project Management', category: 'project-management', description: 'Managing projects', verified: true }
      ];

      for (const skillData of testSkills) {
        await Skill.create(skillData, { isSystemGenerated: true });
      }
    });

    test('should return all active skills by default', async () => {
      const results = await Skill.search();

      expect(results.skills.length).toBeGreaterThan(0);
      expect(results.pagination).toBeDefined();
      expect(results.pagination.total).toBeGreaterThan(0);
    });

    test('should filter by query text', async () => {
      const results = await Skill.search({ query: 'programming' });

      expect(results.skills.length).toBeGreaterThan(0);
      results.skills.forEach(skill => {
        const matchesQuery = 
          skill.name.toLowerCase().includes('programming') ||
          skill.description?.toLowerCase().includes('programming');
        expect(matchesQuery).toBe(true);
      });
    });

    test('should filter by category', async () => {
      const results = await Skill.search({ category: 'technical' });

      expect(results.skills.length).toBeGreaterThan(0);
      results.skills.forEach(skill => {
        expect(skill.category).toBe('technical');
      });
    });

    test('should filter by multiple categories', async () => {
      const results = await Skill.search({ 
        category: ['technical', 'leadership'] 
      });

      expect(results.skills.length).toBeGreaterThan(0);
      results.skills.forEach(skill => {
        expect(['technical', 'leadership']).toContain(skill.category);
      });
    });

    test('should filter by verification status', async () => {
      const verifiedResults = await Skill.search({ verified: true });
      const unverifiedResults = await Skill.search({ verified: false });

      expect(verifiedResults.skills.length).toBeGreaterThan(0);
      expect(unverifiedResults.skills.length).toBeGreaterThan(0);

      verifiedResults.skills.forEach(skill => {
        expect(skill.verified).toBe(true);
      });

      unverifiedResults.skills.forEach(skill => {
        expect(skill.verified).toBe(false);
      });
    });

    test('should handle pagination', async () => {
      const page1 = await Skill.search({}, { page: 1, limit: 2 });
      const page2 = await Skill.search({}, { page: 2, limit: 2 });

      expect(page1.skills.length).toBeLessThanOrEqual(2);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.hasNext).toBeDefined();

      if (page1.pagination.hasNext) {
        expect(page2.skills.length).toBeGreaterThan(0);
        expect(page2.pagination.page).toBe(2);
      }
    });

    test('should sort skills correctly', async () => {
      const nameAsc = await Skill.search({}, { sort: 'name', order: 'asc' });
      const nameDesc = await Skill.search({}, { sort: 'name', order: 'desc' });

      expect(nameAsc.skills.length).toBeGreaterThan(1);
      expect(nameDesc.skills.length).toBeGreaterThan(1);

      // Check that first skill in nameAsc comes before first skill in nameDesc alphabetically
      expect(nameAsc.skills[0].name.localeCompare(nameDesc.skills[0].name)).toBeLessThanOrEqual(0);
    });

    test('should support autocomplete mode', async () => {
      const results = await Skill.search(
        { query: 'Java' },
        { autocomplete: true, limit: 5 }
      );

      expect(results.skills.length).toBeGreaterThan(0);
      expect(results.skills.length).toBeLessThanOrEqual(5);
      
      // Should prioritize exact matches and popular skills
      const firstSkill = results.skills[0];
      expect(firstSkill.name.toLowerCase()).toContain('java');
    });

    test('should include facets in search results', async () => {
      const results = await Skill.search();

      expect(results.facets).toBeDefined();
      expect(results.facets.categories).toBeDefined();
      expect(results.facets.statuses).toBeDefined();
      expect(results.facets.verified).toBeDefined();
    });
  });

  describe('trackUsage()', () => {
    test('should track skill usage successfully', async () => {
      const skillData = {
        name: 'Data Analysis',
        category: 'analytical'
      };

      const createdSkill = await Skill.create(skillData);
      
      await Skill.trackUsage(createdSkill.id, 'user1', 'advanced');

      const updatedSkill = await Skill.findById(createdSkill.id);
      expect(updatedSkill.usageCount).toBe(1);
      expect(updatedSkill.popularityScore).toBeGreaterThan(0);
    });

    test('should track multiple users correctly', async () => {
      const skillData = {
        name: 'SQL',
        category: 'technical'
      };

      const createdSkill = await Skill.create(skillData);
      
      await Skill.trackUsage(createdSkill.id, 'user1', 'intermediate');
      await Skill.trackUsage(createdSkill.id, 'user2', 'advanced');
      await Skill.trackUsage(createdSkill.id, 'user1', 'expert'); // Same user, different proficiency

      const updatedSkill = await Skill.findById(createdSkill.id);
      expect(updatedSkill.usageCount).toBe(2); // Only 2 unique users
    });

    test('should validate proficiency level', async () => {
      const skillData = {
        name: 'Excel',
        category: 'technical'
      };

      const createdSkill = await Skill.create(skillData);

      await expect(Skill.trackUsage(createdSkill.id, 'user1', 'invalid-level'))
        .rejects.toThrow(SkillError);
    });

    test('should throw error for non-existent skill', async () => {
      await expect(Skill.trackUsage('non-existent-id', 'user1', 'intermediate'))
        .rejects.toThrow(SkillError);
    });
  });

  describe('getCategories()', () => {
    test('should return all categories with counts', async () => {
      // Create skills in different categories
      await Skill.create({ name: 'JavaScript', category: 'technical' });
      await Skill.create({ name: 'Python', category: 'technical' });
      await Skill.create({ name: 'Leadership', category: 'leadership' });

      const categories = await Skill.getCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      categories.forEach(category => {
        expect(category.name).toBeDefined();
        expect(category.displayName).toBeDefined();
        expect(category.count).toBeDefined();
        expect(typeof category.count).toBe('number');
      });

      const technicalCategory = categories.find(cat => cat.name === 'technical');
      expect(technicalCategory).toBeDefined();
      expect(technicalCategory.count).toBe(2);

      const leadershipCategory = categories.find(cat => cat.name === 'leadership');
      expect(leadershipCategory).toBeDefined();
      expect(leadershipCategory.count).toBe(1);
    });
  });

  describe('getStats()', () => {
    test('should return comprehensive skill statistics', async () => {
      // Create test data
      await Skill.create({ 
        name: 'Active Skill', 
        category: 'technical',
        verified: true,
        status: 'active'
      }, { isSystemGenerated: true });

      await Skill.create({ 
        name: 'Custom Skill', 
        category: 'soft',
        verified: false,
        status: 'active'
      }, { createdBy: 'user1', isSystemGenerated: false });

      const deprecatedSkill = await Skill.create({ 
        name: 'Deprecated Skill', 
        category: 'technical',
        status: 'deprecated'
      });

      // Track some usage
      await Skill.trackUsage(deprecatedSkill.id, 'user1', 'intermediate');

      const stats = await Skill.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalSkills).toBeGreaterThan(0);
      expect(stats.activeSkills).toBeGreaterThan(0);
      expect(stats.verifiedSkills).toBeGreaterThan(0);
      expect(stats.systemGeneratedSkills).toBeGreaterThan(0);
      expect(stats.customSkills).toBeGreaterThan(0);
      expect(stats.averageUsageCount).toBeDefined();
      expect(stats.categoryCounts).toBeDefined();
      expect(stats.statusCounts).toBeDefined();

      expect(typeof stats.averageUsageCount).toBe('number');
      expect(stats.categoryCounts.technical).toBeGreaterThan(0);
    });
  });

  describe('initialization', () => {
    test('should initialize with common skills', async () => {
      // The reset() method calls initializeCommonSkills()
      const results = await Skill.search();
      
      expect(results.skills.length).toBeGreaterThan(0);
      
      // Check for some expected common skills
      const skillNames = results.skills.map(skill => skill.name);
      expect(skillNames).toContain('JavaScript');
      expect(skillNames).toContain('Leadership');
      expect(skillNames).toContain('Project Management');
    });
  });

  describe('edge cases', () => {
    test('should handle empty search results', async () => {
      const results = await Skill.search({ 
        query: 'non-existent-skill-xyz' 
      });

      expect(results.skills).toEqual([]);
      expect(results.pagination.total).toBe(0);
      expect(results.pagination.pages).toBe(0);
    });

    test('should handle large pagination requests', async () => {
      const results = await Skill.search({}, { 
        page: 999, 
        limit: 100 
      });

      expect(results.skills).toEqual([]);
      expect(results.pagination.page).toBe(999);
      expect(results.pagination.hasNext).toBe(false);
    });

    test('should handle concurrent skill creation', async () => {
      const skillData = {
        name: 'Concurrent Skill',
        category: 'technical'
      };

      // Try to create the same skill concurrently
      const promises = [
        Skill.create(skillData),
        Skill.create(skillData),
        Skill.create(skillData)
      ];

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(2);
    });
  });
});