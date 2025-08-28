/**
 * Request Validation Middleware
 * Provides validation for API request schemas
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Create AJV instance with formats
 */
const ajv = new Ajv({ 
  allErrors: true,
  removeAdditional: true,
  coerceTypes: true
});
addFormats(ajv);

/**
 * Validate request against schema
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const errors = [];

      // Validate body
      if (schema.body) {
        const bodyValidator = ajv.compile(schema.body);
        const isValidBody = bodyValidator(req.body);
        
        if (!isValidBody) {
          errors.push(...(bodyValidator.errors || []).map(err => ({
            field: `body${err.instancePath}`,
            message: err.message,
            value: err.data
          })));
        }
      }

      // Validate params
      if (schema.params) {
        const paramsValidator = ajv.compile(schema.params);
        const isValidParams = paramsValidator(req.params);
        
        if (!isValidParams) {
          errors.push(...(paramsValidator.errors || []).map(err => ({
            field: `params${err.instancePath}`,
            message: err.message,
            value: err.data
          })));
        }
      }

      // Validate query
      if (schema.query) {
        const queryValidator = ajv.compile(schema.query);
        const isValidQuery = queryValidator(req.query);
        
        if (!isValidQuery) {
          errors.push(...(queryValidator.errors || []).map(err => ({
            field: `query${err.instancePath}`,
            message: err.message,
            value: err.data
          })));
        }
      }

      // Validate headers
      if (schema.headers) {
        const headersValidator = ajv.compile(schema.headers);
        const isValidHeaders = headersValidator(req.headers);
        
        if (!isValidHeaders) {
          errors.push(...(headersValidator.errors || []).map(err => ({
            field: `headers${err.instancePath}`,
            message: err.message,
            value: err.data
          })));
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors
        });
      }

      next();

    } catch (error) {
      console.error('Validation middleware error:', error);
      
      res.status(500).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Request validation error'
      });
    }
  };
}

/**
 * Common validation schemas
 */
const commonSchemas = {
  // UUID parameter validation
  uuidParam: {
    type: 'string',
    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  },

  // Pagination query validation
  paginationQuery: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, maximum: 1000 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      sort: { type: 'string', maxLength: 50 },
      order: { type: 'string', enum: ['asc', 'desc'] }
    },
    additionalProperties: true
  },

  // Search query validation
  searchQuery: {
    type: 'object',
    properties: {
      q: { type: 'string', minLength: 1, maxLength: 200 },
      category: { type: 'string', maxLength: 50 },
      tags: { type: 'string', maxLength: 200 }
    },
    additionalProperties: true
  }
};

/**
 * Validate UUID parameter
 * @param {string} paramName - Parameter name to validate
 * @returns {Function} Express middleware
 */
function validateUuidParam(paramName = 'id') {
  return validateRequest({
    params: {
      type: 'object',
      properties: {
        [paramName]: commonSchemas.uuidParam
      },
      required: [paramName],
      additionalProperties: true
    }
  });
}

/**
 * Validate pagination query parameters
 * @returns {Function} Express middleware
 */
function validatePagination() {
  return validateRequest({
    query: commonSchemas.paginationQuery
  });
}

/**
 * Validate search query parameters
 * @returns {Function} Express middleware
 */
function validateSearchQuery() {
  return validateRequest({
    query: commonSchemas.searchQuery
  });
}

/**
 * Validate JSON body exists
 * @returns {Function} Express middleware
 */
function requireJsonBody() {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'MISSING_BODY',
        message: 'Request body is required'
      });
    }
    next();
  };
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return input;
  
  const {
    maxLength = 1000,
    allowHtml = false,
    trim = true
  } = options;

  let sanitized = input;

  if (trim) {
    sanitized = sanitized.trim();
  }

  if (!allowHtml) {
    // Basic HTML escape
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize object properties
 * @param {Object} obj - Object to sanitize
 * @param {Array} stringFields - Fields to sanitize as strings
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, stringFields = [], options = {}) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };

  for (const field of stringFields) {
    if (sanitized[field]) {
      sanitized[field] = sanitizeString(sanitized[field], options);
    }
  }

  return sanitized;
}

/**
 * Calendar validation schemas
 */
const calendarValidation = {
  getEvents: {
    query: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        userId: { type: 'string' },
        status: { type: 'string', enum: ['confirmed', 'tentative', 'cancelled', 'all'] },
        source: { type: 'string', enum: ['booking', 'availability', 'manual', 'external'] },
        visibility: { type: 'string', enum: ['public', 'private', 'internal', 'all'] },
        includeBookings: { type: 'string', enum: ['true', 'false'] },
        timeZone: { type: 'string' }
      },
      additionalProperties: false
    }
  },

  createEvent: {
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string', maxLength: 2000 },
        location: { type: 'string', maxLength: 255 },
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        timeZone: { type: 'string', default: 'UTC' },
        isAllDay: { type: 'boolean', default: false },
        isRecurring: { type: 'boolean', default: false },
        recurringPattern: { 
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
            interval: { type: 'integer', minimum: 1 },
            endDate: { type: 'string', format: 'date' },
            count: { type: 'integer', minimum: 1 }
          }
        },
        bookingId: { type: 'integer' },
        availabilityId: { type: 'integer' },
        source: { type: 'string', enum: ['booking', 'availability', 'manual', 'external'], default: 'manual' },
        visibility: { type: 'string', enum: ['public', 'private', 'internal'], default: 'private' },
        meetingUrl: { type: 'string', format: 'uri' },
        meetingId: { type: 'string' },
        meetingPassword: { type: 'string' },
        status: { type: 'string', enum: ['confirmed', 'tentative', 'cancelled'], default: 'confirmed' },
        reminderMinutes: { 
          type: 'array', 
          items: { type: 'integer', minimum: 0 }
        },
        attendees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['accepted', 'declined', 'tentative', 'pending'] },
              role: { type: 'string' }
            },
            required: ['email']
          }
        }
      },
      required: ['title', 'startTime', 'endTime'],
      additionalProperties: false
    }
  },

  getEventById: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[0-9]+$' }
      },
      required: ['id'],
      additionalProperties: false
    }
  },

  updateEvent: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[0-9]+$' }
      },
      required: ['id'],
      additionalProperties: false
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: 'string', maxLength: 2000 },
        location: { type: 'string', maxLength: 255 },
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        timeZone: { type: 'string' },
        isAllDay: { type: 'boolean' },
        meetingUrl: { type: 'string', format: 'uri' },
        meetingId: { type: 'string' },
        meetingPassword: { type: 'string' },
        status: { type: 'string', enum: ['confirmed', 'tentative', 'cancelled'] },
        reminderMinutes: { 
          type: 'array', 
          items: { type: 'integer', minimum: 0 }
        },
        attendees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              name: { type: 'string' },
              status: { type: 'string', enum: ['accepted', 'declined', 'tentative', 'pending'] },
              role: { type: 'string' }
            },
            required: ['email']
          }
        }
      },
      additionalProperties: false
    }
  },

  deleteEvent: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[0-9]+$' }
      },
      required: ['id'],
      additionalProperties: false
    }
  },

  convertTimezone: {
    body: {
      type: 'object',
      properties: {
        dateTime: { type: 'string', format: 'date-time' },
        fromTimeZone: { type: 'string' },
        toTimeZone: { type: 'string' }
      },
      required: ['dateTime', 'fromTimeZone', 'toTimeZone'],
      additionalProperties: false
    }
  },

  createEventFromBooking: {
    params: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', pattern: '^[0-9]+$' }
      },
      required: ['bookingId'],
      additionalProperties: false
    }
  },

  updateEventFromBooking: {
    params: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', pattern: '^[0-9]+$' }
      },
      required: ['bookingId'],
      additionalProperties: false
    }
  },

  cancelEventFromBooking: {
    params: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', pattern: '^[0-9]+$' }
      },
      required: ['bookingId'],
      additionalProperties: false
    }
  },

  syncExternal: {
    body: {
      type: 'object',
      properties: {
        calendarProvider: { type: 'string', enum: ['google', 'outlook', 'apple'] },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        syncDirection: { type: 'string', enum: ['import', 'export', 'bidirectional'] }
      },
      required: ['calendarProvider', 'accessToken'],
      additionalProperties: false
    }
  },

  getAvailabilityCalendar: {
    query: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        userId: { type: 'string' },
        timeZone: { type: 'string' }
      },
      additionalProperties: false
    }
  },

  blockTime: {
    body: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 255 },
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        timeZone: { type: 'string', default: 'UTC' },
        reason: { type: 'string' }
      },
      required: ['title', 'startTime', 'endTime'],
      additionalProperties: false
    }
  }
};

module.exports = {
  validateRequest,
  validateUuidParam,
  validatePagination,
  validateSearchQuery,
  requireJsonBody,
  sanitizeString,
  sanitizeObject,
  commonSchemas,
  calendarValidation,
  validationMiddleware: validateRequest, // Alias for backward compatibility
  ValidationError
};