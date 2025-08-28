/**
 * Notification Template Model
 * Handles notification templates for different event types and channels
 */

const { v4: uuidv4 } = require('uuid');

class NotificationTemplateError extends Error {
  constructor(message, code = 'TEMPLATE_ERROR') {
    super(message);
    this.name = 'NotificationTemplateError';
    this.code = code;
  }
}

/**
 * NotificationTemplate Model Class
 * Manages reusable notification templates for different channels
 */
class NotificationTemplate {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get template by key
   * @param {string} templateKey - Template key
   * @returns {Promise<Object|null>} Template or null if not found
   */
  async getByKey(templateKey) {
    if (!templateKey) {
      throw new NotificationTemplateError('Template key is required', 'MISSING_KEY');
    }

    try {
      const query = `
        SELECT *
        FROM notification_templates
        WHERE template_key = $1 AND is_active = true AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [templateKey]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatTemplate(result.rows[0]);

    } catch (error) {
      throw new NotificationTemplateError(`Failed to fetch template: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Get templates by category
   * @param {string} category - Template category
   * @returns {Promise<Array>} Array of templates
   */
  async getByCategory(category) {
    if (!category) {
      throw new NotificationTemplateError('Category is required', 'MISSING_CATEGORY');
    }

    try {
      const query = `
        SELECT *
        FROM notification_templates
        WHERE category = $1 AND is_active = true AND deleted_at IS NULL
        ORDER BY name
      `;

      const result = await this.db.query(query, [category]);
      return result.rows.map(row => this.formatTemplate(row));

    } catch (error) {
      throw new NotificationTemplateError(`Failed to fetch templates by category: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Get all templates with pagination
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of templates to return
   * @param {number} options.offset - Number of templates to skip
   * @param {string} options.category - Filter by category
   * @param {boolean} options.activeOnly - Only return active templates
   * @returns {Promise<Object>} Templates with pagination info
   */
  async getAll(options = {}) {
    const {
      limit = 50,
      offset = 0,
      category = null,
      activeOnly = true
    } = options;

    try {
      let whereConditions = ['deleted_at IS NULL'];
      let queryParams = [];
      let paramCount = 0;

      if (activeOnly) {
        whereConditions.push('is_active = true');
      }

      if (category) {
        paramCount++;
        whereConditions.push(`category = $${paramCount}`);
        queryParams.push(category);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM notification_templates
        WHERE ${whereClause}
      `;

      const countResult = await this.db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get templates
      const dataQuery = `
        SELECT *
        FROM notification_templates
        WHERE ${whereClause}
        ORDER BY category, name
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      const dataResult = await this.db.query(dataQuery, queryParams);
      const templates = dataResult.rows.map(row => this.formatTemplate(row));

      return {
        templates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      throw new NotificationTemplateError(`Failed to fetch templates: ${error.message}`, 'FETCH_FAILED');
    }
  }

  /**
   * Create a new template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  async create(templateData) {
    const {
      templateKey,
      name,
      description,
      category,
      priority = 'normal',
      emailSubject,
      emailHtmlTemplate,
      emailTextTemplate,
      inAppTemplate,
      smsTemplate,
      templateVariables = [],
      supportsEmail = true,
      supportsInApp = true,
      supportsSms = false,
      createdBy
    } = templateData;

    // Validate required fields
    if (!templateKey || !name || !category || !inAppTemplate) {
      throw new NotificationTemplateError('Missing required template fields', 'MISSING_FIELDS');
    }

    // Validate category
    const validCategories = ['booking', 'messaging', 'system', 'marketing'];
    if (!validCategories.includes(category)) {
      throw new NotificationTemplateError('Invalid template category', 'INVALID_CATEGORY');
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      throw new NotificationTemplateError('Invalid priority level', 'INVALID_PRIORITY');
    }

    const templateId = uuidv4();
    
    try {
      const query = `
        INSERT INTO notification_templates (
          id, template_key, name, description, category, priority,
          email_subject, email_html_template, email_text_template, 
          in_app_template, sms_template, template_variables,
          supports_email, supports_in_app, supports_sms, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const values = [
        templateId, templateKey, name, description, category, priority,
        emailSubject, emailHtmlTemplate, emailTextTemplate,
        inAppTemplate, smsTemplate, JSON.stringify(templateVariables),
        supportsEmail, supportsInApp, supportsSms, createdBy
      ];

      const result = await this.db.query(query, values);
      return this.formatTemplate(result.rows[0]);

    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new NotificationTemplateError('Template key already exists', 'DUPLICATE_KEY');
      }
      throw new NotificationTemplateError(`Failed to create template: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Update a template
   * @param {string} templateKey - Template key
   * @param {Object} updateData - Data to update
   * @param {string} updatedBy - User ID who is updating
   * @returns {Promise<Object|null>} Updated template or null if not found
   */
  async update(templateKey, updateData, updatedBy) {
    if (!templateKey) {
      throw new NotificationTemplateError('Template key is required', 'MISSING_KEY');
    }

    const allowedFields = [
      'name', 'description', 'category', 'priority',
      'emailSubject', 'emailHtmlTemplate', 'emailTextTemplate',
      'inAppTemplate', 'smsTemplate', 'templateVariables',
      'supportsEmail', 'supportsInApp', 'supportsSms', 'isActive'
    ];

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.keys(updateData).forEach(field => {
      if (allowedFields.includes(field)) {
        paramCount++;
        updateFields.push(`${this.camelToSnake(field)} = $${paramCount}`);
        
        // Handle JSON fields
        if (field === 'templateVariables') {
          values.push(JSON.stringify(updateData[field]));
        } else {
          values.push(updateData[field]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new NotificationTemplateError('No valid fields to update', 'NO_UPDATE_FIELDS');
    }

    // Add updated_by and template_key
    paramCount++;
    updateFields.push(`updated_by = $${paramCount}`);
    values.push(updatedBy);

    paramCount++;
    values.push(templateKey);

    try {
      const query = `
        UPDATE notification_templates
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE template_key = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatTemplate(result.rows[0]);

    } catch (error) {
      throw new NotificationTemplateError(`Failed to update template: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Delete (soft delete) a template
   * @param {string} templateKey - Template key
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(templateKey) {
    if (!templateKey) {
      throw new NotificationTemplateError('Template key is required', 'MISSING_KEY');
    }

    try {
      const query = `
        UPDATE notification_templates
        SET deleted_at = CURRENT_TIMESTAMP, is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE template_key = $1 AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await this.db.query(query, [templateKey]);
      return result.rows.length > 0;

    } catch (error) {
      throw new NotificationTemplateError(`Failed to delete template: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Render template with variables
   * @param {string} templateKey - Template key
   * @param {string} channel - Channel to render for ('email_html', 'email_text', 'in_app', 'sms')
   * @param {Object} variables - Variables to substitute
   * @returns {Promise<Object>} Rendered template content
   */
  async renderTemplate(templateKey, channel, variables = {}) {
    if (!templateKey || !channel) {
      throw new NotificationTemplateError('Template key and channel are required', 'MISSING_PARAMETERS');
    }

    const template = await this.getByKey(templateKey);
    if (!template) {
      throw new NotificationTemplateError('Template not found', 'TEMPLATE_NOT_FOUND');
    }

    const validChannels = ['email_html', 'email_text', 'email_subject', 'in_app', 'sms'];
    if (!validChannels.includes(channel)) {
      throw new NotificationTemplateError('Invalid channel', 'INVALID_CHANNEL');
    }

    try {
      let content = '';
      
      switch (channel) {
        case 'email_html':
          content = template.emailHtmlTemplate || '';
          break;
        case 'email_text':
          content = template.emailTextTemplate || '';
          break;
        case 'email_subject':
          content = template.emailSubject || '';
          break;
        case 'in_app':
          content = template.inAppTemplate || '';
          break;
        case 'sms':
          content = template.smsTemplate || '';
          break;
      }

      // Simple template variable substitution
      const rendered = this.substituteVariables(content, variables);

      return {
        templateKey,
        channel,
        content: rendered,
        variables: template.templateVariables || [],
        renderedAt: new Date()
      };

    } catch (error) {
      throw new NotificationTemplateError(`Failed to render template: ${error.message}`, 'RENDER_FAILED');
    }
  }

  /**
   * Validate template variables
   * @param {string} templateKey - Template key
   * @param {Object} variables - Variables to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateVariables(templateKey, variables = {}) {
    const template = await this.getByKey(templateKey);
    if (!template) {
      throw new NotificationTemplateError('Template not found', 'TEMPLATE_NOT_FOUND');
    }

    const requiredVariables = template.templateVariables || [];
    const providedVariables = Object.keys(variables);
    
    const missing = requiredVariables.filter(variable => !providedVariables.includes(variable));
    const extra = providedVariables.filter(variable => !requiredVariables.includes(variable));

    return {
      isValid: missing.length === 0,
      requiredVariables,
      providedVariables,
      missingVariables: missing,
      extraVariables: extra
    };
  }

  /**
   * Simple variable substitution in template content
   * @param {string} content - Template content
   * @param {Object} variables - Variables to substitute
   * @returns {string} Content with variables substituted
   */
  substituteVariables(content, variables) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    let result = content;
    
    // Replace {{variable}} patterns
    Object.keys(variables).forEach(key => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = variables[key] || '';
      result = result.replace(pattern, value);
    });

    return result;
  }

  /**
   * Convert camelCase to snake_case
   * @param {string} str - camelCase string
   * @returns {string} snake_case string
   */
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Format template data for API response
   * @param {Object} row - Database row
   * @returns {Object} Formatted template
   */
  formatTemplate(row) {
    return {
      id: row.id,
      templateKey: row.template_key,
      name: row.name,
      description: row.description,
      category: row.category,
      priority: row.priority,
      emailSubject: row.email_subject,
      emailHtmlTemplate: row.email_html_template,
      emailTextTemplate: row.email_text_template,
      inAppTemplate: row.in_app_template,
      smsTemplate: row.sms_template,
      templateVariables: typeof row.template_variables === 'string' 
        ? JSON.parse(row.template_variables) 
        : row.template_variables,
      supportsEmail: row.supports_email,
      supportsInApp: row.supports_in_app,
      supportsSms: row.supports_sms,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }
}

module.exports = {
  NotificationTemplate,
  NotificationTemplateError
};