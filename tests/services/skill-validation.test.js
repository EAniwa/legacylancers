/**
 * Skill Validation Service Tests
 * Comprehensive test coverage for skill validation and standardization
 */

const skillValidationService = require('../../src/services/skill-validation');
const { Skill } = require('../../src/models/Skill');

describe('Skill Validation Service', () => {
  beforeEach(async () => {
    // Reset the skill model before each test
    await Skill.reset();
  });

  describe('validateSkillCreation()', () => {
    test('should validate valid skill creation data', async () => {
      const skillData = {
        name: 'Strategic Planning',
        description: 'Long-term business strategy and planning',
        category: 'business',
        aliases: ['Strategy', 'Business Planning']
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedData).toBeDefined();
      expect(result.sanitizedData.name).toBe('Strategic Planning');
      expect(result.sanitizedData.category).toBe('business');
      expect(result.sanitizedData.description).toBeDefined();
    });

    test('should reject skill creation with missing required fields', async () => {
      const skillData = {
        description: 'Missing name and category'
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const nameError = result.errors.find(e => e.field === 'name');
      const categoryError = result.errors.find(e => e.field === 'category');
      
      expect(nameError).toBeDefined();
      expect(categoryError).toBeDefined();
    });

    test('should detect existing skills', async () => {
      // Create a skill first
      await Skill.create({
        name: 'JavaScript',
        category: 'technical'
      });

      const skillData = {
        name: 'JavaScript',
        category: 'technical'
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].code).toBe('SKILL_EXISTS');
    });

    test('should standardize skill names', async () => {
      const skillData = {
        name: 'project management',
        category: 'project-management'
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.name).toBe('Project Management');
    });

    test('should infer and suggest categories', async () => {
      const skillData = {
        name: 'Python Programming',
        category: 'soft' // Wrong category
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const categoryWarning = result.warnings.find(w => w.code === 'CATEGORY_SUGGESTION');
      expect(categoryWarning).toBeDefined();
      expect(categoryWarning.suggestedValue).toBe('technical');
    });

    test('should validate description length', async () => {
      const skillData = {
        name: 'Test Skill',
        category: 'technical',
        description: 'a'.repeat(501) // Too long
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(false);
      const descError = result.errors.find(e => e.field === 'description');
      expect(descError).toBeDefined();
      expect(descError.code).toBe('DESCRIPTION_TOO_LONG');
    });

    test('should warn about short descriptions', async () => {
      const skillData = {
        name: 'Test Skill',
        category: 'technical',
        description: 'Short' // Too short for good clarity
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const descWarning = result.warnings.find(w => w.code === 'SHORT_DESCRIPTION');
      expect(descWarning).toBeDefined();
    });

    test('should generate skill aliases', async () => {
      const skillData = {
        name: 'JavaScript',
        category: 'technical'
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.aliases).toBeDefined();
      expect(result.sanitizedData.aliases.length).toBeGreaterThan(0);
      
      const suggestions = result.suggestions.find(s => s.type === 'aliases');
      expect(suggestions).toBeDefined();
    });

    test('should find related skills', async () => {
      // Create some related skills first
      await Skill.create({ name: 'Python', category: 'technical' });
      await Skill.create({ name: 'Java', category: 'technical' });
      await Skill.create({ name: 'C++', category: 'technical' });

      const skillData = {
        name: 'JavaScript',
        category: 'technical'
      };

      const result = await skillValidationService.validateSkillCreation(skillData);

      expect(result.isValid).toBe(true);
      const relatedSuggestion = result.suggestions.find(s => s.type === 'related_skills');
      expect(relatedSuggestion).toBeDefined();
      expect(relatedSuggestion.data.length).toBeGreaterThan(0);
    });
  });

  describe('validateSkillUpdate()', () => {
    let existingSkillId;

    beforeEach(async () => {
      const skill = await Skill.create({
        name: 'Existing Skill',
        category: 'technical',
        description: 'Original description'
      }, { createdBy: 'user1' });
      existingSkillId = skill.id;
    });

    test('should validate valid skill update data', async () => {
      const updateData = {
        description: 'Updated description with more detail',
        status: 'active'
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedData.description).toBe(updateData.description);
      expect(result.sanitizedData.status).toBe(updateData.status);
    });

    test('should validate name changes without conflicts', async () => {
      const updateData = {
        name: 'Updated Skill Name'
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.name).toBe('Updated Skill Name');
    });

    test('should detect name conflicts during update', async () => {
      // Create another skill
      await Skill.create({
        name: 'Conflict Skill',
        category: 'technical'
      });

      const updateData = {
        name: 'Conflict Skill' // Name already exists
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('SKILL_EXISTS');
    });

    test('should reject update for non-existent skill', async () => {
      const updateData = {
        name: 'New Name'
      };

      const result = await skillValidationService.validateSkillUpdate('non-existent-id', updateData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('SKILL_NOT_FOUND');
    });

    test('should validate empty name', async () => {
      const updateData = {
        name: ''
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(false);
      const nameError = result.errors.find(e => e.field === 'name');
      expect(nameError).toBeDefined();
    });

    test('should validate status values', async () => {
      const updateData = {
        status: 'invalid-status'
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(false);
      const statusError = result.errors.find(e => e.field === 'status');
      expect(statusError).toBeDefined();
    });

    test('should validate aliases format', async () => {
      const updateData = {
        aliases: 'not-an-array'
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(false);
      const aliasError = result.errors.find(e => e.field === 'aliases');
      expect(aliasError).toBeDefined();
    });

    test('should clean up aliases array', async () => {
      const updateData = {
        aliases: ['  Valid Alias  ', '', 'Another Alias', 'Valid Alias'] // Duplicates and empty
      };

      const result = await skillValidationService.validateSkillUpdate(existingSkillId, updateData);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.aliases).toHaveLength(2);
      expect(result.sanitizedData.aliases).toContain('Valid Alias');
      expect(result.sanitizedData.aliases).toContain('Another Alias');
    });
  });

  describe('validateBulkSkills()', () => {
    test('should validate array of valid skills', async () => {
      const skillsData = [
        { name: 'JavaScript', proficiency: 'advanced' },
        { name: 'Python', proficiency: 'intermediate' },
        { name: 'Project Management', proficiency: 'expert' }
      ];

      const result = await skillValidationService.validateBulkSkills(skillsData);

      expect(result.valid.length).toBe(3);
      expect(result.invalid.length).toBe(0);
      expect(result.suggestions.standardizations.length).toBe(0); // Names already standardized
    });

    test('should identify invalid skills in bulk validation', async () => {
      const skillsData = [
        { name: 'Valid Skill', proficiency: 'advanced' },
        { name: '', proficiency: 'intermediate' }, // Invalid: empty name
        { name: 'Another Skill', proficiency: 'invalid-level' } // Invalid: bad proficiency
      ];

      const result = await skillValidationService.validateBulkSkills(skillsData);

      expect(result.valid.length).toBe(1);
      expect(result.invalid.length).toBe(2);
      
      const invalidSkill1 = result.invalid.find(item => item.index === 1);
      const invalidSkill2 = result.invalid.find(item => item.index === 2);
      
      expect(invalidSkill1.errors[0].field).toBe('name');
      expect(invalidSkill2.errors[0].field).toBe('proficiency');
    });

    test('should suggest standardizations in bulk validation', async () => {
      const skillsData = [
        { name: 'javascript', proficiency: 'advanced' }, // Should be standardized
        { name: 'project management', proficiency: 'expert' } // Should be standardized
      ];

      const result = await skillValidationService.validateBulkSkills(skillsData);

      expect(result.valid.length).toBe(2);
      expect(result.suggestions.standardizations.length).toBe(2);
      
      const jsStandardization = result.suggestions.standardizations.find(s => s.original === 'javascript');
      expect(jsStandardization.standardized).toBe('JavaScript');
    });

    test('should identify existing vs new skills', async () => {
      // Create an existing skill
      await Skill.create({
        name: 'JavaScript',
        category: 'technical'
      });

      const skillsData = [
        { name: 'JavaScript', proficiency: 'advanced' }, // Exists
        { name: 'Python', proficiency: 'intermediate' }, // New
        { name: 'Ruby', proficiency: 'beginner' } // New
      ];

      const result = await skillValidationService.validateBulkSkills(skillsData);

      expect(result.valid.length).toBe(3);
      expect(result.suggestions.newSkills.length).toBe(2); // Python and Ruby are new
      
      const existingSkill = result.valid.find(item => item.standardizedName === 'JavaScript');
      expect(existingSkill.existingSkill).toBeDefined();
    });

    test('should reject non-array input', async () => {
      await expect(skillValidationService.validateBulkSkills('not-an-array'))
        .rejects.toThrow('Skills data must be an array');
    });
  });

  describe('standardizeSkillName()', () => {
    test('should standardize common skill names', async () => {
      expect(skillValidationService.standardizeSkillName('javascript')).toBe('JavaScript');
      expect(skillValidationService.standardizeSkillName('js')).toBe('JavaScript');
      expect(skillValidationService.standardizeSkillName('project management')).toBe('Project Management');
      expect(skillValidationService.standardizeSkillName('pm')).toBe('Project Management');
    });

    test('should clean up skill names', async () => {
      expect(skillValidationService.standardizeSkillName('  web   development  ')).toBe('Web Development');
      expect(skillValidationService.standardizeSkillName('data-analysis')).toBe('Data-analysis');
      expect(skillValidationService.standardizeSkillName('c++')).toBe('C++');
    });

    test('should handle edge cases', async () => {
      expect(skillValidationService.standardizeSkillName('')).toBe('profile-' + expect.any(String));
      expect(skillValidationService.standardizeSkillName('   ')).toBe('profile-' + expect.any(String));
      expect(skillValidationService.standardizeSkillName('a')).toBe('A');
    });
  });

  describe('inferSkillCategory()', () => {
    test('should infer technical category', async () => {
      expect(skillValidationService.inferSkillCategory('JavaScript Programming')).toBe('technical');
      expect(skillValidationService.inferSkillCategory('Database Management')).toBe('technical');
      expect(skillValidationService.inferSkillCategory('Software Development')).toBe('technical');
      expect(skillValidationService.inferSkillCategory('Cloud Computing')).toBe('technical');
    });

    test('should infer communication category', async () => {
      expect(skillValidationService.inferSkillCategory('Public Speaking')).toBe('communication');
      expect(skillValidationService.inferSkillCategory('Customer Service')).toBe('communication');
      expect(skillValidationService.inferSkillCategory('Negotiation Skills')).toBe('communication');
    });

    test('should infer leadership category', async () => {
      expect(skillValidationService.inferSkillCategory('Team Leadership')).toBe('leadership');
      expect(skillValidationService.inferSkillCategory('Management Experience')).toBe('leadership');
      expect(skillValidationService.inferSkillCategory('Executive Coaching')).toBe('leadership');
    });

    test('should infer project-management category', async () => {
      expect(skillValidationService.inferSkillCategory('Project Planning')).toBe('project-management');
      expect(skillValidationService.inferSkillCategory('Scrum Master')).toBe('project-management');
      expect(skillValidationService.inferSkillCategory('Agile Development')).toBe('project-management');
    });

    test('should infer analytical category', async () => {
      expect(skillValidationService.inferSkillCategory('Data Analysis')).toBe('analytical');
      expect(skillValidationService.inferSkillCategory('Statistical Modeling')).toBe('analytical');
      expect(skillValidationService.inferSkillCategory('Business Intelligence')).toBe('analytical');
    });

    test('should infer business category', async () => {
      expect(skillValidationService.inferSkillCategory('Strategic Planning')).toBe('business');
      expect(skillValidationService.inferSkillCategory('Sales Management')).toBe('business');
      expect(skillValidationService.inferSkillCategory('Marketing Strategy')).toBe('business');
    });

    test('should default to soft skills', async () => {
      expect(skillValidationService.inferSkillCategory('Random Skill')).toBe('soft');
      expect(skillValidationService.inferSkillCategory('Unnamed Ability')).toBe('soft');
    });
  });

  describe('validateProficiencyLevel()', () => {
    test('should validate valid proficiency levels', async () => {
      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

      validLevels.forEach(level => {
        const result = skillValidationService.validateProficiencyLevel(level);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(level);
        expect(result.error).toBeNull();
      });
    });

    test('should reject invalid proficiency levels', async () => {
      const invalidLevels = ['novice', 'master', 'guru', 'invalid'];

      invalidLevels.forEach(level => {
        const result = skillValidationService.validateProficiencyLevel(level);
        expect(result.isValid).toBe(false);
        expect(result.sanitized).toBeNull();
        expect(result.error).toBeDefined();
        expect(result.error.code).toBe('INVALID_PROFICIENCY_LEVEL');
      });
    });
  });

  describe('generateSkillAliases()', () => {
    test('should generate aliases for common skills', async () => {
      const aliases1 = skillValidationService.generateSkillAliases('JavaScript');
      expect(aliases1).toContain('JS');

      const aliases2 = skillValidationService.generateSkillAliases('Project Management');
      expect(aliases2).toContain('PM');
    });

    test('should generate abbreviations for multi-word skills', async () => {
      const aliases = skillValidationService.generateSkillAliases('Business Intelligence');
      expect(aliases).toContain('BI');
    });

    test('should not generate aliases for the original name', async () => {
      const aliases = skillValidationService.generateSkillAliases('JavaScript');
      expect(aliases).not.toContain('JavaScript');
      expect(aliases).not.toContain('javascript');
    });

    test('should limit number of aliases', async () => {
      const aliases = skillValidationService.generateSkillAliases('Very Long Skill Name With Many Words');
      expect(aliases.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getValidationRules()', () => {
    test('should return validation rules object', async () => {
      const rules = skillValidationService.getValidationRules();

      expect(rules).toBeDefined();
      expect(rules.skillName).toBeDefined();
      expect(rules.description).toBeDefined();
      expect(rules.category).toBeDefined();
      expect(rules.proficiency).toBeDefined();
      expect(rules.aliases).toBeDefined();

      expect(rules.skillName.required).toBe(true);
      expect(rules.skillName.minLength).toBe(1);
      expect(rules.skillName.maxLength).toBe(100);

      expect(rules.category.validValues).toContain('technical');
      expect(rules.category.validValues).toContain('leadership');

      expect(rules.proficiency.validValues).toContain('beginner');
      expect(rules.proficiency.validValues).toContain('expert');
    });
  });

  describe('error handling', () => {
    test('should handle validation service errors gracefully', async () => {
      // Mock a validation error
      const originalMethod = Skill.findByName;
      Skill.findByName = jest.fn().mockRejectedValue(new Error('Database error'));

      try {
        await expect(skillValidationService.validateSkillCreation({
          name: 'Test Skill',
          category: 'technical'
        })).rejects.toThrow('Validation failed');
      } finally {
        // Restore original method
        Skill.findByName = originalMethod;
      }
    });

    test('should handle edge cases in bulk validation', async () => {
      const skillsData = [
        null,
        undefined,
        { name: 'Valid Skill' },
        { proficiency: 'advanced' }, // Missing name
        { name: 123, proficiency: 'intermediate' } // Wrong type
      ];

      const result = await skillValidationService.validateBulkSkills(skillsData);

      expect(result.valid.length).toBe(1); // Only the valid skill
      expect(result.invalid.length).toBe(4);
    });
  });
});