/**
 * Skill Validation Service
 * Provides validation, standardization, and categorization services for skills
 */

const validator = require('validator');
const { Skill, SkillError } = require('../models/Skill');

class SkillValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', field = null) {
    super(message);
    this.name = 'SkillValidationError';
    this.code = code;
    this.field = field;
  }
}

/**
 * Skill Validation Service
 */
class SkillValidationService {
  constructor() {
    // Common skill variations and their standardized forms
    this.skillNormalizations = new Map([
      // Programming languages
      ['js', 'JavaScript'],
      ['javascript', 'JavaScript'],
      ['python', 'Python'],
      ['sql', 'SQL'],
      ['java', 'Java'],
      ['c++', 'C++'],
      ['c#', 'C#'],
      
      // Technologies
      ['react', 'React'],
      ['reactjs', 'React'],
      ['angular', 'Angular'],
      ['vue', 'Vue.js'],
      ['vuejs', 'Vue.js'],
      ['nodejs', 'Node.js'],
      ['node', 'Node.js'],
      
      // Business skills
      ['pm', 'Project Management'],
      ['project mgmt', 'Project Management'],
      ['proj mgmt', 'Project Management'],
      ['pmp', 'Project Management'],
      
      // Communication
      ['public speaking', 'Public Speaking'],
      ['presentation', 'Public Speaking'],
      ['presentations', 'Public Speaking'],
    ]);

    // Category inference rules
    this.categoryRules = [
      {
        category: 'technical',
        keywords: ['programming', 'software', 'database', 'code', 'development', 'technical', 'system', 'server', 'cloud', 'api', 'framework', 'language']
      },
      {
        category: 'communication',
        keywords: ['communication', 'speaking', 'presentation', 'writing', 'negotiation', 'customer service', 'client relations']
      },
      {
        category: 'leadership',
        keywords: ['leadership', 'management', 'team', 'supervision', 'coaching', 'mentoring', 'director', 'executive']
      },
      {
        category: 'project-management',
        keywords: ['project', 'scrum', 'agile', 'kanban', 'planning', 'coordination', 'pmp', 'scheduling']
      },
      {
        category: 'analytical',
        keywords: ['analysis', 'data', 'research', 'statistics', 'modeling', 'forecasting', 'business intelligence', 'analytics']
      },
      {
        category: 'creative',
        keywords: ['design', 'creative', 'artistic', 'graphic', 'visual', 'marketing', 'branding', 'content']
      },
      {
        category: 'business',
        keywords: ['business', 'strategy', 'sales', 'marketing', 'finance', 'operations', 'consulting', 'entrepreneurship']
      }
    ];

    // Proficiency validation rules
    this.proficiencyLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
    
    // Common skill aliases for better matching
    this.skillAliases = new Map([
      ['javascript', ['js', 'ecmascript', 'node.js backend', 'frontend js']],
      ['python', ['py', 'python3', 'django', 'flask framework']],
      ['project management', ['pm', 'project planning', 'pmp', 'program management']],
      ['leadership', ['team leadership', 'people management', 'team lead']],
      ['communication', ['verbal communication', 'written communication', 'interpersonal skills']],
    ]);
  }

  /**
   * Validate skill creation data
   * @param {Object} skillData - Skill data to validate
   * @returns {Object} Validation result with sanitized data
   */
  async validateSkillCreation(skillData) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        sanitizedData: {},
        suggestions: []
      };

      // Validate required fields
      if (!skillData.name || !skillData.name.trim()) {
        validation.errors.push({
          field: 'name',
          message: 'Skill name is required',
          code: 'MISSING_REQUIRED_FIELD'
        });
        validation.isValid = false;
      }

      if (!skillData.category) {
        validation.errors.push({
          field: 'category',
          message: 'Skill category is required',
          code: 'MISSING_REQUIRED_FIELD'
        });
        validation.isValid = false;
      }

      if (!validation.isValid) {
        return validation;
      }

      // Standardize skill name
      const standardizedName = this.standardizeSkillName(skillData.name.trim());
      validation.sanitizedData.name = standardizedName;

      // Check for existing skill
      const existingSkill = await Skill.findByName(standardizedName);
      if (existingSkill) {
        validation.errors.push({
          field: 'name',
          message: 'A skill with this name already exists',
          code: 'SKILL_EXISTS',
          existingSkill: existingSkill
        });
        validation.isValid = false;
        return validation;
      }

      // Validate and infer category
      const categoryResult = this.validateAndInferCategory(standardizedName, skillData.category);
      validation.sanitizedData.category = categoryResult.category;
      
      if (categoryResult.suggested && categoryResult.suggested !== skillData.category) {
        validation.warnings.push({
          field: 'category',
          message: `Suggested category: ${categoryResult.suggested}`,
          code: 'CATEGORY_SUGGESTION',
          suggestedValue: categoryResult.suggested
        });
      }

      // Validate description
      if (skillData.description) {
        if (skillData.description.length < 10) {
          validation.warnings.push({
            field: 'description',
            message: 'Description should be at least 10 characters for better clarity',
            code: 'SHORT_DESCRIPTION'
          });
        }
        
        if (skillData.description.length > 500) {
          validation.errors.push({
            field: 'description',
            message: 'Description must be less than 500 characters',
            code: 'DESCRIPTION_TOO_LONG'
          });
          validation.isValid = false;
        } else {
          validation.sanitizedData.description = validator.escape(skillData.description.trim());
        }
      }

      // Generate aliases and related skills suggestions
      const aliases = this.generateSkillAliases(standardizedName);
      if (aliases.length > 0) {
        validation.sanitizedData.aliases = aliases;
        validation.suggestions.push({
          type: 'aliases',
          message: 'Generated common aliases for this skill',
          data: aliases
        });
      }

      // Find related skills
      const relatedSkills = await this.findRelatedSkills(standardizedName, categoryResult.category);
      if (relatedSkills.length > 0) {
        validation.suggestions.push({
          type: 'related_skills',
          message: 'Found potentially related skills',
          data: relatedSkills.map(skill => ({ id: skill.id, name: skill.name }))
        });
      }

      return validation;

    } catch (error) {
      throw new SkillValidationError(`Validation failed: ${error.message}`, 'VALIDATION_FAILED');
    }
  }

  /**
   * Validate skill update data
   * @param {string} skillId - ID of skill being updated
   * @param {Object} updateData - Update data to validate
   * @returns {Object} Validation result with sanitized data
   */
  async validateSkillUpdate(skillId, updateData) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        sanitizedData: {},
        suggestions: []
      };

      // Get existing skill
      const existingSkill = await Skill.findById(skillId);
      if (!existingSkill) {
        validation.errors.push({
          field: 'id',
          message: 'Skill not found',
          code: 'SKILL_NOT_FOUND'
        });
        validation.isValid = false;
        return validation;
      }

      // Validate name if provided
      if (updateData.name !== undefined) {
        if (!updateData.name || !updateData.name.trim()) {
          validation.errors.push({
            field: 'name',
            message: 'Skill name cannot be empty',
            code: 'INVALID_FIELD_VALUE'
          });
          validation.isValid = false;
        } else {
          const standardizedName = this.standardizeSkillName(updateData.name.trim());
          validation.sanitizedData.name = standardizedName;

          // Check for name conflicts
          if (standardizedName !== existingSkill.name) {
            const conflictingSkill = await Skill.findByName(standardizedName);
            if (conflictingSkill && conflictingSkill.id !== skillId) {
              validation.errors.push({
                field: 'name',
                message: 'A skill with this name already exists',
                code: 'SKILL_EXISTS',
                existingSkill: conflictingSkill
              });
              validation.isValid = false;
            }
          }
        }
      }

      // Validate category if provided
      if (updateData.category !== undefined) {
        const categoryResult = this.validateAndInferCategory(
          validation.sanitizedData.name || existingSkill.name,
          updateData.category
        );
        validation.sanitizedData.category = categoryResult.category;

        if (categoryResult.suggested && categoryResult.suggested !== updateData.category) {
          validation.warnings.push({
            field: 'category',
            message: `Suggested category: ${categoryResult.suggested}`,
            code: 'CATEGORY_SUGGESTION',
            suggestedValue: categoryResult.suggested
          });
        }
      }

      // Validate description if provided
      if (updateData.description !== undefined) {
        if (updateData.description && updateData.description.length > 500) {
          validation.errors.push({
            field: 'description',
            message: 'Description must be less than 500 characters',
            code: 'DESCRIPTION_TOO_LONG'
          });
          validation.isValid = false;
        } else if (updateData.description) {
          validation.sanitizedData.description = validator.escape(updateData.description.trim());
        } else {
          validation.sanitizedData.description = null;
        }
      }

      // Validate aliases if provided
      if (updateData.aliases !== undefined) {
        if (Array.isArray(updateData.aliases)) {
          const validAliases = [];
          for (const alias of updateData.aliases) {
            if (typeof alias === 'string' && alias.trim().length > 0) {
              const cleanAlias = validator.escape(alias.trim());
              if (cleanAlias.length <= 100) {
                validAliases.push(cleanAlias);
              }
            }
          }
          validation.sanitizedData.aliases = [...new Set(validAliases)]; // Remove duplicates
        } else {
          validation.errors.push({
            field: 'aliases',
            message: 'Aliases must be an array',
            code: 'INVALID_FIELD_TYPE'
          });
          validation.isValid = false;
        }
      }

      // Validate status if provided
      if (updateData.status !== undefined) {
        const validStatuses = ['active', 'deprecated', 'pending_review', 'archived'];
        if (!validStatuses.includes(updateData.status)) {
          validation.errors.push({
            field: 'status',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            code: 'INVALID_FIELD_VALUE'
          });
          validation.isValid = false;
        } else {
          validation.sanitizedData.status = updateData.status;
        }
      }

      // Validate verified flag if provided
      if (updateData.verified !== undefined) {
        validation.sanitizedData.verified = Boolean(updateData.verified);
      }

      return validation;

    } catch (error) {
      throw new SkillValidationError(`Update validation failed: ${error.message}`, 'VALIDATION_FAILED');
    }
  }

  /**
   * Validate bulk skill data (e.g., from profile skills)
   * @param {Array} skillsData - Array of skill data objects
   * @returns {Object} Bulk validation result
   */
  async validateBulkSkills(skillsData) {
    try {
      const results = {
        valid: [],
        invalid: [],
        warnings: [],
        suggestions: {
          newSkills: [],
          standardizations: []
        }
      };

      if (!Array.isArray(skillsData)) {
        throw new SkillValidationError('Skills data must be an array', 'INVALID_INPUT_TYPE');
      }

      for (let i = 0; i < skillsData.length; i++) {
        const skillData = skillsData[i];
        const itemResult = {
          index: i,
          originalData: skillData,
          errors: [],
          warnings: []
        };

        try {
          // Validate skill name
          if (!skillData.name || typeof skillData.name !== 'string') {
            itemResult.errors.push({
              field: 'name',
              message: 'Skill name is required and must be a string',
              code: 'MISSING_REQUIRED_FIELD'
            });
          } else {
            const standardizedName = this.standardizeSkillName(skillData.name.trim());
            itemResult.standardizedName = standardizedName;

            // Check if skill exists
            const existingSkill = await Skill.findByName(standardizedName);
            if (existingSkill) {
              itemResult.existingSkill = existingSkill;
            } else {
              // Suggest creating new skill
              const suggestedCategory = this.inferSkillCategory(standardizedName);
              results.suggestions.newSkills.push({
                name: standardizedName,
                suggestedCategory,
                originalName: skillData.name
              });
            }

            // Check for standardization
            if (standardizedName !== skillData.name.trim()) {
              results.suggestions.standardizations.push({
                original: skillData.name,
                standardized: standardizedName
              });
            }

            // Validate proficiency level if provided
            if (skillData.proficiency !== undefined) {
              if (!this.proficiencyLevels.includes(skillData.proficiency)) {
                itemResult.errors.push({
                  field: 'proficiency',
                  message: `Invalid proficiency level. Must be one of: ${this.proficiencyLevels.join(', ')}`,
                  code: 'INVALID_PROFICIENCY_LEVEL'
                });
              } else {
                itemResult.proficiency = skillData.proficiency;
              }
            }
          }

          if (itemResult.errors.length === 0) {
            results.valid.push(itemResult);
          } else {
            results.invalid.push(itemResult);
          }

        } catch (error) {
          itemResult.errors.push({
            field: 'general',
            message: error.message,
            code: 'VALIDATION_ERROR'
          });
          results.invalid.push(itemResult);
        }
      }

      return results;

    } catch (error) {
      throw new SkillValidationError(`Bulk validation failed: ${error.message}`, 'BULK_VALIDATION_FAILED');
    }
  }

  /**
   * Standardize skill name
   * @param {string} skillName - Original skill name
   * @returns {string} Standardized skill name
   */
  standardizeSkillName(skillName) {
    const normalized = skillName.toLowerCase().trim();
    
    // Check for exact normalization match
    if (this.skillNormalizations.has(normalized)) {
      return this.skillNormalizations.get(normalized);
    }

    // Clean up the name
    let standardized = skillName.trim()
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .replace(/[^\w\s\-\+\#\.]/g, '') // Remove special chars except common ones
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return standardized;
  }

  /**
   * Validate and infer skill category
   * @param {string} skillName - Skill name
   * @param {string} providedCategory - User-provided category
   * @returns {Object} Category validation result
   */
  validateAndInferCategory(skillName, providedCategory) {
    const validCategories = [
      'technical', 'soft', 'industry-specific', 'leadership',
      'creative', 'analytical', 'communication', 'project-management', 'business'
    ];

    const result = {
      category: providedCategory,
      isValid: validCategories.includes(providedCategory),
      suggested: null
    };

    if (!result.isValid) {
      result.suggested = this.inferSkillCategory(skillName);
      result.category = result.suggested;
    } else {
      // Check if provided category matches inference
      const inferred = this.inferSkillCategory(skillName);
      if (inferred !== providedCategory) {
        result.suggested = inferred;
      }
    }

    return result;
  }

  /**
   * Infer skill category from skill name
   * @param {string} skillName - Skill name
   * @returns {string} Inferred category
   */
  inferSkillCategory(skillName) {
    const nameWords = skillName.toLowerCase().split(/\s+/);
    
    for (const rule of this.categoryRules) {
      const matchCount = rule.keywords.reduce((count, keyword) => {
        return count + nameWords.filter(word => 
          word.includes(keyword) || keyword.includes(word)
        ).length;
      }, 0);

      if (matchCount > 0) {
        return rule.category;
      }
    }

    // Default to 'soft' for unmatched skills
    return 'soft';
  }

  /**
   * Generate common aliases for a skill
   * @param {string} skillName - Skill name
   * @returns {Array} Array of aliases
   */
  generateSkillAliases(skillName) {
    const normalized = skillName.toLowerCase();
    const aliases = [];

    // Check if this skill has predefined aliases
    if (this.skillAliases.has(normalized)) {
      aliases.push(...this.skillAliases.get(normalized));
    }

    // Generate common variations
    if (skillName.includes(' ')) {
      // Add version without spaces
      aliases.push(skillName.replace(/\s+/g, ''));
    }

    // Add common abbreviations
    const words = skillName.split(' ');
    if (words.length > 1) {
      const abbreviation = words.map(word => word.charAt(0).toUpperCase()).join('');
      if (abbreviation.length >= 2 && abbreviation.length <= 5) {
        aliases.push(abbreviation);
      }
    }

    // Remove duplicates and the original name
    return [...new Set(aliases)]
      .filter(alias => alias.toLowerCase() !== normalized)
      .slice(0, 10); // Limit to 10 aliases
  }

  /**
   * Find related skills based on name and category
   * @param {string} skillName - Skill name
   * @param {string} category - Skill category
   * @returns {Array} Array of related skills
   */
  async findRelatedSkills(skillName, category) {
    try {
      const searchResult = await Skill.search({
        category: category
      }, { 
        limit: 20,
        sort: 'popularityScore',
        order: 'desc'
      });

      const nameWords = new Set(skillName.toLowerCase().split(/\s+/));
      const relatedSkills = [];

      for (const skill of searchResult.skills) {
        if (skill.name === skillName) continue;

        const skillWords = new Set(skill.name.toLowerCase().split(/\s+/));
        const commonWords = [...nameWords].filter(word => skillWords.has(word));
        
        if (commonWords.length > 0) {
          relatedSkills.push({
            ...skill,
            similarity: commonWords.length / Math.max(nameWords.size, skillWords.size)
          });
        }
      }

      // Sort by similarity and return top 5
      return relatedSkills
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

    } catch (error) {
      console.warn('Failed to find related skills:', error);
      return [];
    }
  }

  /**
   * Validate proficiency level
   * @param {string} proficiencyLevel - Proficiency level to validate
   * @returns {Object} Validation result
   */
  validateProficiencyLevel(proficiencyLevel) {
    const isValid = this.proficiencyLevels.includes(proficiencyLevel);
    
    return {
      isValid,
      sanitized: isValid ? proficiencyLevel : null,
      error: isValid ? null : {
        message: `Invalid proficiency level. Must be one of: ${this.proficiencyLevels.join(', ')}`,
        code: 'INVALID_PROFICIENCY_LEVEL'
      }
    };
  }

  /**
   * Get validation rules and constraints
   * @returns {Object} Validation rules
   */
  getValidationRules() {
    return {
      skillName: {
        required: true,
        minLength: 1,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-\+\#\.]+$/
      },
      description: {
        required: false,
        minLength: 10,
        maxLength: 500
      },
      category: {
        required: true,
        validValues: [
          'technical', 'soft', 'industry-specific', 'leadership',
          'creative', 'analytical', 'communication', 'project-management', 'business'
        ]
      },
      proficiency: {
        required: false,
        validValues: this.proficiencyLevels
      },
      aliases: {
        required: false,
        type: 'array',
        maxItems: 10,
        itemMaxLength: 100
      }
    };
  }
}

// Export singleton instance
module.exports = new SkillValidationService();