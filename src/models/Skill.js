/**
 * Skill Model
 * Handles skill database operations and business logic for skill management
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');

class SkillError extends Error {
  constructor(message, code = 'SKILL_ERROR') {
    super(message);
    this.name = 'SkillError';
    this.code = code;
  }
}

/**
 * Skill Model Class
 * For now, using in-memory storage. In production, this would connect to PostgreSQL
 */
class Skill {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be replaced with database connection
    this.skills = new Map();
    this.skillUsage = new Map(); // Track skill usage statistics
    
    // Valid enum values
    this.CATEGORIES = [
      'technical',
      'soft',
      'industry-specific',
      'leadership',
      'creative',
      'analytical',
      'communication',
      'project-management',
      'business'
    ];
    
    this.PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
    this.STATUSES = ['active', 'deprecated', 'pending_review', 'archived'];
    
    // Initialize with common skills
    this.initializeCommonSkills();
  }

  /**
   * Initialize the system with common skills
   */
  async initializeCommonSkills() {
    const commonSkills = [
      // Technical Skills
      { name: 'JavaScript', category: 'technical', description: 'Programming language for web development', verified: true },
      { name: 'Python', category: 'technical', description: 'Programming language for data science and web development', verified: true },
      { name: 'SQL', category: 'technical', description: 'Database query language', verified: true },
      { name: 'Project Management', category: 'project-management', description: 'Planning and executing projects', verified: true },
      { name: 'Data Analysis', category: 'analytical', description: 'Analyzing data to extract insights', verified: true },
      { name: 'Excel', category: 'technical', description: 'Microsoft Excel spreadsheet software', verified: true },
      
      // Soft Skills
      { name: 'Leadership', category: 'leadership', description: 'Leading teams and organizations', verified: true },
      { name: 'Communication', category: 'communication', description: 'Effective verbal and written communication', verified: true },
      { name: 'Problem Solving', category: 'analytical', description: 'Identifying and solving complex problems', verified: true },
      { name: 'Strategic Thinking', category: 'business', description: 'Long-term strategic planning and thinking', verified: true },
      { name: 'Team Management', category: 'leadership', description: 'Managing and developing teams', verified: true },
      { name: 'Public Speaking', category: 'communication', description: 'Speaking effectively to audiences', verified: true },
      
      // Industry Specific
      { name: 'Financial Analysis', category: 'industry-specific', description: 'Financial modeling and analysis', verified: true },
      { name: 'Marketing Strategy', category: 'business', description: 'Developing marketing strategies', verified: true },
      { name: 'Sales Management', category: 'business', description: 'Managing sales teams and processes', verified: true },
      { name: 'Operations Management', category: 'business', description: 'Managing business operations', verified: true }
    ];

    for (const skillData of commonSkills) {
      try {
        await this.create(skillData, { isSystemGenerated: true });
      } catch (error) {
        console.warn(`Failed to initialize skill ${skillData.name}:`, error.message);
      }
    }
  }

  /**
   * Create a new skill
   * @param {Object} skillData - Skill data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Created skill object
   */
  async create(skillData, options = {}) {
    try {
      // Validate and sanitize skill data
      const validatedData = await this.validateSkillData(skillData);

      // Check if skill already exists (case-insensitive)
      const existingSkill = await this.findByName(validatedData.name);
      if (existingSkill) {
        throw new SkillError('Skill with this name already exists', 'SKILL_EXISTS');
      }

      // Create skill object
      const skillId = uuidv4();
      const now = new Date();

      const skill = {
        id: skillId,
        name: validatedData.name,
        normalizedName: validatedData.name.toLowerCase(),
        description: validatedData.description || null,
        category: validatedData.category,
        
        // Verification and Quality
        verified: validatedData.verified || false,
        status: validatedData.status || 'active',
        
        // Usage Statistics
        usageCount: 0,
        popularityScore: 0,
        
        // Validation and Standardization
        aliases: validatedData.aliases || [],
        relatedSkills: validatedData.relatedSkills || [],
        
        // System fields
        isSystemGenerated: options.isSystemGenerated || false,
        createdBy: options.createdBy || null,
        
        // Audit fields
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      };

      // Store skill
      this.skills.set(skillId, skill);

      // Initialize usage tracking
      this.skillUsage.set(skillId, {
        skillId,
        usageHistory: [],
        lastUsed: null,
        usedByProfiles: new Set()
      });

      return skill;

    } catch (error) {
      if (error instanceof SkillError) {
        throw error;
      }
      throw new SkillError(`Failed to create skill: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Find skill by ID
   * @param {string} skillId - Skill ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Skill object or null
   */
  async findById(skillId, options = {}) {
    try {
      const skill = this.skills.get(skillId);
      if (!skill || skill.deletedAt) {
        return null;
      }

      return this.enrichSkillData(skill, options);

    } catch (error) {
      throw new SkillError(`Failed to find skill by ID: ${error.message}`, 'FIND_BY_ID_FAILED');
    }
  }

  /**
   * Find skill by name (case-insensitive)
   * @param {string} skillName - Skill name
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Skill object or null
   */
  async findByName(skillName, options = {}) {
    try {
      const normalizedName = skillName.toLowerCase();
      
      for (const skill of this.skills.values()) {
        if ((skill.normalizedName === normalizedName || 
             skill.aliases.some(alias => alias.toLowerCase() === normalizedName)) &&
            !skill.deletedAt) {
          return this.enrichSkillData(skill, options);
        }
      }
      return null;

    } catch (error) {
      throw new SkillError(`Failed to find skill by name: ${error.message}`, 'FIND_BY_NAME_FAILED');
    }
  }

  /**
   * Update skill
   * @param {string} skillId - Skill ID
   * @param {Object} updateData - Fields to update
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated skill object
   */
  async update(skillId, updateData, options = {}) {
    try {
      const skill = this.skills.get(skillId);
      if (!skill || skill.deletedAt) {
        throw new SkillError('Skill not found', 'SKILL_NOT_FOUND');
      }

      // Validate and sanitize update data
      const validatedData = await this.validateSkillData(updateData, true);

      // Check name uniqueness if name is being updated
      if (validatedData.name && validatedData.name !== skill.name) {
        const existingSkill = await this.findByName(validatedData.name);
        if (existingSkill && existingSkill.id !== skillId) {
          throw new SkillError('Skill with this name already exists', 'SKILL_EXISTS');
        }
      }

      // Apply updates
      const updatedSkill = {
        ...skill,
        ...validatedData,
        updatedAt: new Date()
      };

      // Update normalized name if name changed
      if (validatedData.name) {
        updatedSkill.normalizedName = validatedData.name.toLowerCase();
      }

      // Store updated skill
      this.skills.set(skillId, updatedSkill);

      return this.enrichSkillData(updatedSkill, options);

    } catch (error) {
      if (error instanceof SkillError) {
        throw error;
      }
      throw new SkillError(`Failed to update skill: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Delete skill (soft delete)
   * @param {string} skillId - Skill ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(skillId) {
    try {
      const skill = this.skills.get(skillId);
      if (!skill || skill.deletedAt) {
        throw new SkillError('Skill not found', 'SKILL_NOT_FOUND');
      }

      // Prevent deletion of system-generated skills
      if (skill.isSystemGenerated) {
        throw new SkillError('Cannot delete system-generated skills', 'CANNOT_DELETE_SYSTEM_SKILL');
      }

      // Soft delete
      const updatedSkill = {
        ...skill,
        deletedAt: new Date(),
        updatedAt: new Date(),
        status: 'archived'
      };

      this.skills.set(skillId, updatedSkill);
      return true;

    } catch (error) {
      if (error instanceof SkillError) {
        throw error;
      }
      throw new SkillError(`Failed to delete skill: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Search skills with advanced filtering and autocomplete
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results with pagination
   */
  async search(criteria = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'popularityScore',
        order = 'desc',
        includeDeleted = false,
        autocomplete = false
      } = options;

      let results = Array.from(this.skills.values());

      // Filter out deleted skills unless specifically requested
      if (!includeDeleted) {
        results = results.filter(skill => !skill.deletedAt);
      }

      // Apply search criteria
      if (criteria.query) {
        const query = criteria.query.toLowerCase();
        results = results.filter(skill => 
          skill.normalizedName.includes(query) ||
          skill.aliases.some(alias => alias.toLowerCase().includes(query)) ||
          (skill.description && skill.description.toLowerCase().includes(query))
        );
      }

      if (criteria.category) {
        if (Array.isArray(criteria.category)) {
          results = results.filter(skill => criteria.category.includes(skill.category));
        } else {
          results = results.filter(skill => skill.category === criteria.category);
        }
      }

      if (criteria.verified !== undefined) {
        results = results.filter(skill => skill.verified === criteria.verified);
      }

      if (criteria.status) {
        if (Array.isArray(criteria.status)) {
          results = results.filter(skill => criteria.status.includes(skill.status));
        } else {
          results = results.filter(skill => skill.status === criteria.status);
        }
      }

      if (criteria.minUsage) {
        results = results.filter(skill => skill.usageCount >= criteria.minUsage);
      }

      if (criteria.isSystemGenerated !== undefined) {
        results = results.filter(skill => skill.isSystemGenerated === criteria.isSystemGenerated);
      }

      // For autocomplete, prioritize exact matches and popular skills
      if (autocomplete && criteria.query) {
        const query = criteria.query.toLowerCase();
        results.sort((a, b) => {
          // Exact name matches first
          if (a.normalizedName === query) return -1;
          if (b.normalizedName === query) return 1;
          
          // Names starting with query
          if (a.normalizedName.startsWith(query) && !b.normalizedName.startsWith(query)) return -1;
          if (!a.normalizedName.startsWith(query) && b.normalizedName.startsWith(query)) return 1;
          
          // Then by popularity
          return b.popularityScore - a.popularityScore;
        });
      } else {
        // Apply sorting
        results.sort((a, b) => {
          const aVal = a[sort];
          const bVal = b[sort];
          
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          
          if (typeof aVal === 'string') {
            return order === 'desc' 
              ? bVal.localeCompare(aVal)
              : aVal.localeCompare(bVal);
          }
          
          return order === 'desc' ? bVal - aVal : aVal - bVal;
        });
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = results.slice(startIndex, endIndex);

      // Enrich results with usage data
      const enrichedResults = paginatedResults.map(skill => 
        this.enrichSkillData(skill, options)
      );

      return {
        skills: enrichedResults,
        pagination: {
          page,
          limit,
          total: results.length,
          pages: Math.ceil(results.length / limit),
          hasNext: endIndex < results.length,
          hasPrev: page > 1
        },
        facets: this.generateSearchFacets(results)
      };

    } catch (error) {
      throw new SkillError(`Failed to search skills: ${error.message}`, 'SEARCH_FAILED');
    }
  }

  /**
   * Get skill categories
   * @returns {Promise<Array>} Available categories with counts
   */
  async getCategories() {
    try {
      const categoryCounts = {};
      
      for (const category of this.CATEGORIES) {
        categoryCounts[category] = 0;
      }

      for (const skill of this.skills.values()) {
        if (!skill.deletedAt && skill.status === 'active') {
          categoryCounts[skill.category]++;
        }
      }

      return this.CATEGORIES.map(category => ({
        name: category,
        displayName: category.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        count: categoryCounts[category]
      }));

    } catch (error) {
      throw new SkillError(`Failed to get categories: ${error.message}`, 'CATEGORIES_FAILED');
    }
  }

  /**
   * Validate skill data
   * @param {Object} data - Skill data to validate
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Promise<Object>} Validated and sanitized data
   */
  async validateSkillData(data, isUpdate = false) {
    const validated = {};

    // Name (required for creation)
    if (!isUpdate && !data.name) {
      throw new SkillError('Skill name is required', 'MISSING_SKILL_NAME');
    }

    if (data.name !== undefined) {
      if (data.name !== null) {
        if (!validator.isLength(data.name, { min: 1, max: 100 })) {
          throw new SkillError('Skill name must be between 1 and 100 characters', 'INVALID_SKILL_NAME');
        }
        validated.name = validator.escape(validator.trim(data.name));
      } else {
        throw new SkillError('Skill name cannot be null', 'INVALID_SKILL_NAME');
      }
    }

    // Description
    if (data.description !== undefined) {
      if (data.description !== null) {
        if (!validator.isLength(data.description, { min: 1, max: 500 })) {
          throw new SkillError('Description must be between 1 and 500 characters', 'INVALID_DESCRIPTION');
        }
        validated.description = validator.escape(validator.trim(data.description));
      } else {
        validated.description = null;
      }
    }

    // Category (required for creation)
    if (!isUpdate && !data.category) {
      throw new SkillError('Skill category is required', 'MISSING_CATEGORY');
    }

    if (data.category !== undefined) {
      if (!this.CATEGORIES.includes(data.category)) {
        throw new SkillError(`Invalid category. Must be one of: ${this.CATEGORIES.join(', ')}`, 'INVALID_CATEGORY');
      }
      validated.category = data.category;
    }

    // Status
    if (data.status !== undefined) {
      if (!this.STATUSES.includes(data.status)) {
        throw new SkillError(`Invalid status. Must be one of: ${this.STATUSES.join(', ')}`, 'INVALID_STATUS');
      }
      validated.status = data.status;
    }

    // Boolean fields
    const booleanFields = ['verified'];
    for (const field of booleanFields) {
      if (data[field] !== undefined) {
        validated[field] = Boolean(data[field]);
      }
    }

    // Arrays
    if (data.aliases !== undefined) {
      if (!Array.isArray(data.aliases)) {
        throw new SkillError('Aliases must be an array', 'INVALID_ALIASES');
      }
      
      validated.aliases = data.aliases
        .map(alias => validator.escape(validator.trim(alias)))
        .filter(alias => alias.length > 0 && alias.length <= 100)
        .slice(0, 10); // Limit to 10 aliases
      
      // Remove duplicates (case-insensitive)
      const seen = new Set();
      validated.aliases = validated.aliases.filter(alias => {
        const lower = alias.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
    }

    if (data.relatedSkills !== undefined) {
      if (!Array.isArray(data.relatedSkills)) {
        throw new SkillError('Related skills must be an array', 'INVALID_RELATED_SKILLS');
      }
      
      validated.relatedSkills = data.relatedSkills
        .filter(skillId => typeof skillId === 'string' && skillId.length > 0)
        .slice(0, 20); // Limit to 20 related skills
      
      // Remove duplicates
      validated.relatedSkills = [...new Set(validated.relatedSkills)];
    }

    return validated;
  }

  /**
   * Track skill usage
   * @param {string} skillId - Skill ID
   * @param {string} profileId - Profile ID using the skill
   * @param {string} proficiencyLevel - Proficiency level
   * @returns {Promise<void>}
   */
  async trackUsage(skillId, profileId, proficiencyLevel) {
    try {
      if (!this.PROFICIENCY_LEVELS.includes(proficiencyLevel)) {
        throw new SkillError(`Invalid proficiency level. Must be one of: ${this.PROFICIENCY_LEVELS.join(', ')}`, 'INVALID_PROFICIENCY_LEVEL');
      }

      const skill = this.skills.get(skillId);
      if (!skill || skill.deletedAt) {
        throw new SkillError('Skill not found', 'SKILL_NOT_FOUND');
      }

      const usage = this.skillUsage.get(skillId);
      if (!usage) {
        throw new SkillError('Skill usage tracking not initialized', 'USAGE_TRACKING_ERROR');
      }

      // Update usage statistics
      if (!usage.usedByProfiles.has(profileId)) {
        usage.usedByProfiles.add(profileId);
        skill.usageCount++;
      }

      usage.lastUsed = new Date();
      usage.usageHistory.push({
        profileId,
        proficiencyLevel,
        timestamp: new Date()
      });

      // Keep only last 1000 usage records for performance
      if (usage.usageHistory.length > 1000) {
        usage.usageHistory = usage.usageHistory.slice(-1000);
      }

      // Recalculate popularity score
      skill.popularityScore = this.calculatePopularityScore(skill, usage);
      skill.updatedAt = new Date();

      this.skills.set(skillId, skill);
      this.skillUsage.set(skillId, usage);

    } catch (error) {
      if (error instanceof SkillError) {
        throw error;
      }
      throw new SkillError(`Failed to track skill usage: ${error.message}`, 'USAGE_TRACKING_FAILED');
    }
  }

  /**
   * Calculate popularity score based on usage patterns
   * @param {Object} skill - Skill object
   * @param {Object} usage - Usage tracking data
   * @returns {number} Popularity score
   */
  calculatePopularityScore(skill, usage) {
    let score = 0;

    // Base score from usage count
    score += skill.usageCount * 10;

    // Bonus for recent usage
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentUsage = usage.usageHistory.filter(h => h.timestamp > monthAgo);
    score += recentUsage.length * 5;

    // Bonus for verified skills
    if (skill.verified) {
      score += 50;
    }

    // Bonus for system-generated skills
    if (skill.isSystemGenerated) {
      score += 25;
    }

    // Penalty for deprecated skills
    if (skill.status === 'deprecated') {
      score -= 100;
    }

    return Math.max(0, score);
  }

  /**
   * Enrich skill data with usage statistics
   * @param {Object} skill - Base skill object
   * @param {Object} options - Enrichment options
   * @returns {Object} Enriched skill object
   */
  enrichSkillData(skill, options = {}) {
    const { includeUsageStats = false } = options;
    
    const enriched = { ...skill };

    if (includeUsageStats) {
      const usage = this.skillUsage.get(skill.id);
      if (usage) {
        enriched.usageStats = {
          uniqueProfiles: usage.usedByProfiles.size,
          lastUsed: usage.lastUsed,
          recentUsageCount: usage.usageHistory
            .filter(h => h.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            .length
        };
      }
    }

    return enriched;
  }

  /**
   * Generate search facets for filtering
   * @param {Array} skills - Skills to analyze
   * @returns {Object} Facets object
   */
  generateSearchFacets(skills) {
    const facets = {
      categories: {},
      statuses: {},
      verified: { true: 0, false: 0 },
      systemGenerated: { true: 0, false: 0 }
    };

    for (const skill of skills) {
      // Categories
      facets.categories[skill.category] = (facets.categories[skill.category] || 0) + 1;
      
      // Statuses
      facets.statuses[skill.status] = (facets.statuses[skill.status] || 0) + 1;
      
      // Verified
      facets.verified[skill.verified] = facets.verified[skill.verified] + 1;
      
      // System generated
      facets.systemGenerated[skill.isSystemGenerated] = facets.systemGenerated[skill.isSystemGenerated] + 1;
    }

    return facets;
  }

  /**
   * Get skill statistics
   * @returns {Promise<Object>} Skill statistics
   */
  async getStats() {
    try {
      const stats = {
        totalSkills: 0,
        activeSkills: 0,
        verifiedSkills: 0,
        systemGeneratedSkills: 0,
        customSkills: 0,
        deletedSkills: 0,
        averageUsageCount: 0,
        categoryCounts: {},
        statusCounts: {}
      };

      let totalUsage = 0;

      // Initialize category counts
      for (const category of this.CATEGORIES) {
        stats.categoryCounts[category] = 0;
      }

      // Initialize status counts
      for (const status of this.STATUSES) {
        stats.statusCounts[status] = 0;
      }

      for (const skill of this.skills.values()) {
        stats.totalSkills++;
        totalUsage += skill.usageCount;

        if (skill.deletedAt) {
          stats.deletedSkills++;
        } else {
          if (skill.status === 'active') {
            stats.activeSkills++;
          }

          if (skill.verified) {
            stats.verifiedSkills++;
          }

          if (skill.isSystemGenerated) {
            stats.systemGeneratedSkills++;
          } else {
            stats.customSkills++;
          }

          stats.categoryCounts[skill.category]++;
        }

        stats.statusCounts[skill.status]++;
      }

      if (stats.totalSkills > 0) {
        stats.averageUsageCount = Math.round(totalUsage / stats.totalSkills);
      }

      return stats;

    } catch (error) {
      throw new SkillError(`Failed to get skill statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  /**
   * Reset all data (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    this.skills.clear();
    this.skillUsage.clear();
    await this.initializeCommonSkills();
  }
}

// Export singleton instance
module.exports = {
  Skill: new Skill(),
  SkillError
};