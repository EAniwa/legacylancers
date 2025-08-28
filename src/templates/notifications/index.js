/**
 * Notification Templates Index
 * Central registry for all notification templates
 */

// Import all notification templates
const bookingNewRequest = require('./booking/new-request');
const bookingStatusUpdate = require('./booking/status-update');
const messagingNewMessage = require('./messaging/new-message');
const systemWelcome = require('./system/welcome');
const systemSecurityAlert = require('./system/security-alert');

/**
 * Template registry mapping template keys to template definitions
 */
const templateRegistry = {
  // Booking templates
  [bookingNewRequest.templateKey]: bookingNewRequest,
  [bookingStatusUpdate.templateKey]: bookingStatusUpdate,
  
  // Messaging templates
  [messagingNewMessage.templateKey]: messagingNewMessage,
  
  // System templates
  [systemWelcome.templateKey]: systemWelcome,
  [systemSecurityAlert.templateKey]: systemSecurityAlert
};

/**
 * Get template by key
 * @param {string} templateKey - Template key
 * @returns {Object|null} Template definition or null if not found
 */
function getTemplate(templateKey) {
  return templateRegistry[templateKey] || null;
}

/**
 * Get all templates
 * @returns {Object} All templates indexed by key
 */
function getAllTemplates() {
  return templateRegistry;
}

/**
 * Get templates by category
 * @param {string} category - Template category
 * @returns {Array} Array of templates in the category
 */
function getTemplatesByCategory(category) {
  return Object.values(templateRegistry).filter(template => template.category === category);
}

/**
 * Get available template keys
 * @returns {Array} Array of all template keys
 */
function getTemplateKeys() {
  return Object.keys(templateRegistry);
}

/**
 * Validate template definition
 * @param {Object} template - Template to validate
 * @returns {Object} Validation result
 */
function validateTemplate(template) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  const requiredFields = ['templateKey', 'name', 'category', 'inAppTemplate'];
  requiredFields.forEach(field => {
    if (!template[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Valid categories
  const validCategories = ['booking', 'messaging', 'system', 'marketing'];
  if (template.category && !validCategories.includes(template.category)) {
    errors.push(`Invalid category: ${template.category}. Must be one of: ${validCategories.join(', ')}`);
  }
  
  // Valid priorities
  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  if (template.priority && !validPriorities.includes(template.priority)) {
    errors.push(`Invalid priority: ${template.priority}. Must be one of: ${validPriorities.join(', ')}`);
  }
  
  // Email template consistency
  if (template.supportsEmail) {
    if (!template.emailSubject) {
      errors.push('Email templates require emailSubject');
    }
    if (!template.emailHtmlTemplate && !template.emailTextTemplate) {
      errors.push('Email templates require at least emailHtmlTemplate or emailTextTemplate');
    }
  }
  
  // SMS template length check
  if (template.supportsSms && template.smsTemplate) {
    // Check base template length (before variable substitution)
    const baseLength = template.smsTemplate.replace(/\{\{[^}]+\}\}/g, '').length;
    if (baseLength > 100) {
      warnings.push('SMS template may exceed length limits after variable substitution');
    }
  }
  
  // Template variable validation
  if (template.templateVariables && Array.isArray(template.templateVariables)) {
    const allTemplates = [
      template.emailSubject,
      template.emailHtmlTemplate,
      template.emailTextTemplate,
      template.inAppTemplate,
      template.smsTemplate
    ].filter(Boolean).join(' ');
    
    // Check for variables used in templates but not declared
    const usedVariables = [...allTemplates.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
    const undeclaredVariables = [...new Set(usedVariables)].filter(variable => 
      !template.templateVariables.includes(variable)
    );
    
    if (undeclaredVariables.length > 0) {
      warnings.push(`Undeclared template variables: ${undeclaredVariables.join(', ')}`);
    }
    
    // Check for declared variables not used in templates
    const unusedVariables = template.templateVariables.filter(variable => 
      !usedVariables.includes(variable)
    );
    
    if (unusedVariables.length > 0) {
      warnings.push(`Unused template variables: ${unusedVariables.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Initialize and validate all templates
 * @returns {Object} Initialization result
 */
function initializeTemplates() {
  const results = {
    totalTemplates: 0,
    validTemplates: 0,
    invalidTemplates: 0,
    errors: [],
    warnings: []
  };
  
  Object.entries(templateRegistry).forEach(([key, template]) => {
    results.totalTemplates++;
    
    const validation = validateTemplate(template);
    
    if (validation.isValid) {
      results.validTemplates++;
    } else {
      results.invalidTemplates++;
      results.errors.push({
        templateKey: key,
        errors: validation.errors
      });
    }
    
    if (validation.warnings.length > 0) {
      results.warnings.push({
        templateKey: key,
        warnings: validation.warnings
      });
    }
  });
  
  return results;
}

/**
 * Template utility functions
 */
const templateUtils = {
  /**
   * Get template metadata
   * @param {string} templateKey - Template key
   * @returns {Object} Template metadata
   */
  getMetadata(templateKey) {
    const template = getTemplate(templateKey);
    if (!template) return null;
    
    return {
      templateKey: template.templateKey,
      name: template.name,
      description: template.description,
      category: template.category,
      priority: template.priority,
      supportsEmail: template.supportsEmail,
      supportsInApp: template.supportsInApp,
      supportsSms: template.supportsSms,
      templateVariables: template.templateVariables || []
    };
  },
  
  /**
   * Check if template supports a specific channel
   * @param {string} templateKey - Template key
   * @param {string} channel - Channel ('email', 'in_app', 'sms')
   * @returns {boolean} True if supported
   */
  supportsChannel(templateKey, channel) {
    const template = getTemplate(templateKey);
    if (!template) return false;
    
    switch (channel) {
      case 'email':
        return template.supportsEmail;
      case 'in_app':
        return template.supportsInApp;
      case 'sms':
        return template.supportsSms;
      default:
        return false;
    }
  },
  
  /**
   * Get template content for a specific channel
   * @param {string} templateKey - Template key
   * @param {string} channel - Channel ('email_subject', 'email_html', 'email_text', 'in_app', 'sms')
   * @returns {string|null} Template content or null if not available
   */
  getContentForChannel(templateKey, channel) {
    const template = getTemplate(templateKey);
    if (!template) return null;
    
    switch (channel) {
      case 'email_subject':
        return template.emailSubject || null;
      case 'email_html':
        return template.emailHtmlTemplate || null;
      case 'email_text':
        return template.emailTextTemplate || null;
      case 'in_app':
        return template.inAppTemplate || null;
      case 'sms':
        return template.smsTemplate || null;
      default:
        return null;
    }
  }
};

module.exports = {
  templateRegistry,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateKeys,
  validateTemplate,
  initializeTemplates,
  templateUtils
};