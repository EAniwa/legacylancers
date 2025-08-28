/**
 * Booking Validation Middleware
 * Handles validation for booking-related API requests
 */

const validator = require('validator');
const { BookingStateMachine, BOOKING_STATES } = require('../utils/bookingStateMachine');

class BookingValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', field = null) {
    super(message);
    this.name = 'BookingValidationError';
    this.code = code;
    this.field = field;
  }
}

/**
 * Validation helper functions
 */
const validationHelpers = {
  /**
   * Validate required field
   */
  isRequired(value, fieldName) {
    if (value === null || value === undefined || 
        (typeof value === 'string' && value.trim() === '')) {
      throw new BookingValidationError(`${fieldName} is required`, 'REQUIRED_FIELD', fieldName.toLowerCase().replace(' ', '_'));
    }
    return true;
  },

  /**
   * Validate string length
   */
  isValidLength(value, min, max, fieldName) {
    if (value && typeof value === 'string') {
      if (!validator.isLength(value, { min, max })) {
        throw new BookingValidationError(
          `${fieldName} must be between ${min} and ${max} characters`,
          'INVALID_LENGTH',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
    }
    return true;
  },

  /**
   * Validate UUID format
   */
  isValidUUID(value, fieldName) {
    if (value && !validator.isUUID(value)) {
      throw new BookingValidationError(
        `${fieldName} must be a valid UUID`,
        'INVALID_UUID',
        fieldName.toLowerCase().replace(' ', '_')
      );
    }
    return true;
  },

  /**
   * Validate email format
   */
  isValidEmail(value, fieldName) {
    if (value && !validator.isEmail(value)) {
      throw new BookingValidationError(
        `${fieldName} must be a valid email`,
        'INVALID_EMAIL',
        fieldName.toLowerCase().replace(' ', '_')
      );
    }
    return true;
  },

  /**
   * Validate numeric value
   */
  isValidNumber(value, min = null, max = null, fieldName) {
    if (value !== null && value !== undefined) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        throw new BookingValidationError(
          `${fieldName} must be a valid number`,
          'INVALID_NUMBER',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
      if (min !== null && numValue < min) {
        throw new BookingValidationError(
          `${fieldName} must be at least ${min}`,
          'VALUE_TOO_LOW',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
      if (max !== null && numValue > max) {
        throw new BookingValidationError(
          `${fieldName} must be at most ${max}`,
          'VALUE_TOO_HIGH',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
    }
    return true;
  },

  /**
   * Validate integer value
   */
  isValidInteger(value, min = null, max = null, fieldName) {
    if (value !== null && value !== undefined) {
      const intValue = parseInt(value, 10);
      if (isNaN(intValue) || intValue.toString() !== value.toString()) {
        throw new BookingValidationError(
          `${fieldName} must be a valid integer`,
          'INVALID_INTEGER',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
      if (min !== null && intValue < min) {
        throw new BookingValidationError(
          `${fieldName} must be at least ${min}`,
          'VALUE_TOO_LOW',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
      if (max !== null && intValue > max) {
        throw new BookingValidationError(
          `${fieldName} must be at most ${max}`,
          'VALUE_TOO_HIGH',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
    }
    return true;
  },

  /**
   * Validate date format
   */
  isValidDate(value, fieldName, allowFuture = true, allowPast = true) {
    if (value) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new BookingValidationError(
          `${fieldName} must be a valid date`,
          'INVALID_DATE',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
      
      const now = new Date();
      if (!allowFuture && date > now) {
        throw new BookingValidationError(
          `${fieldName} cannot be in the future`,
          'DATE_IN_FUTURE',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
      
      if (!allowPast && date < now) {
        throw new BookingValidationError(
          `${fieldName} cannot be in the past`,
          'DATE_IN_PAST',
          fieldName.toLowerCase().replace(' ', '_')
        );
      }
    }
    return true;
  },

  /**
   * Validate enum value
   */
  isValidEnum(value, validValues, fieldName) {
    if (value && !validValues.includes(value)) {
      throw new BookingValidationError(
        `${fieldName} must be one of: ${validValues.join(', ')}`,
        'INVALID_ENUM_VALUE',
        fieldName.toLowerCase().replace(' ', '_')
      );
    }
    return true;
  }
};

/**
 * Validate booking creation data
 */
function validateCreateBooking() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // Required fields
      validationHelpers.isRequired(data.clientId, 'Client ID');
      validationHelpers.isRequired(data.retireeId, 'Retiree ID');
      validationHelpers.isRequired(data.title, 'Title');
      validationHelpers.isRequired(data.description, 'Description');

      // UUID validation
      validationHelpers.isValidUUID(data.clientId, 'Client ID');
      validationHelpers.isValidUUID(data.retireeId, 'Retiree ID');
      
      if (data.clientProfileId) {
        validationHelpers.isValidUUID(data.clientProfileId, 'Client Profile ID');
      }
      if (data.retireeProfileId) {
        validationHelpers.isValidUUID(data.retireeProfileId, 'Retiree Profile ID');
      }

      // String length validation
      validationHelpers.isValidLength(data.title, 5, 200, 'Title');
      validationHelpers.isValidLength(data.description, 10, 5000, 'Description');
      
      if (data.serviceCategory) {
        validationHelpers.isValidLength(data.serviceCategory, 1, 100, 'Service Category');
      }
      if (data.clientMessage) {
        validationHelpers.isValidLength(data.clientMessage, 1, 1000, 'Client Message');
      }
      if (data.location) {
        validationHelpers.isValidLength(data.location, 1, 200, 'Location');
      }

      // Enum validation
      const validEngagementTypes = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
      const validRateTypes = ['hourly', 'project', 'daily', 'weekly'];
      const validUrgencyLevels = ['low', 'normal', 'high', 'urgent'];
      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

      if (data.engagementType) {
        validationHelpers.isValidEnum(data.engagementType, validEngagementTypes, 'Engagement Type');
      }
      if (data.proposedRateType) {
        validationHelpers.isValidEnum(data.proposedRateType, validRateTypes, 'Proposed Rate Type');
      }
      if (data.urgencyLevel) {
        validationHelpers.isValidEnum(data.urgencyLevel, validUrgencyLevels, 'Urgency Level');
      }
      if (data.currency) {
        validationHelpers.isValidEnum(data.currency, validCurrencies, 'Currency');
      }

      // Numeric validation
      if (data.proposedRate) {
        validationHelpers.isValidNumber(data.proposedRate, 0, 10000, 'Proposed Rate');
      }
      if (data.estimatedHours) {
        validationHelpers.isValidInteger(data.estimatedHours, 1, 2000, 'Estimated Hours');
      }

      // Date validation
      if (data.startDate) {
        validationHelpers.isValidDate(data.startDate, 'Start Date', true, false);
      }
      if (data.endDate) {
        validationHelpers.isValidDate(data.endDate, 'End Date', true, false);
      }

      // Cross-field validation
      if (data.clientId === data.retireeId) {
        throw new BookingValidationError('Client and retiree cannot be the same user', 'SAME_USER');
      }

      if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        if (startDate >= endDate) {
          throw new BookingValidationError('Start date must be before end date', 'INVALID_DATE_RANGE');
        }
      }

      // Validate requirements array if provided
      if (data.requirements && Array.isArray(data.requirements)) {
        data.requirements.forEach((req, index) => {
          if (!req.title || req.title.trim() === '') {
            throw new BookingValidationError(`Requirement ${index + 1} title is required`, 'MISSING_REQUIREMENT_TITLE');
          }
          validationHelpers.isValidLength(req.title, 1, 200, `Requirement ${index + 1} title`);
          
          const validReqTypes = ['skill', 'experience', 'certification', 'tool', 'deliverable', 'other'];
          if (req.requirement_type) {
            validationHelpers.isValidEnum(req.requirement_type, validReqTypes, `Requirement ${index + 1} type`);
          }
        });
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate booking status update
 */
function validateStatusUpdate() {
  return (req, res, next) => {
    try {
      const { status } = req.body;
      const data = req.body;

      // Required status
      validationHelpers.isRequired(status, 'Status');

      // Validate status is a valid booking state
      if (!BookingStateMachine.isValidState(status)) {
        throw new BookingValidationError(
          'Invalid booking status',
          'INVALID_STATUS'
        );
      }

      // Validate state-specific required fields
      switch (status) {
        case BOOKING_STATES.ACCEPTED:
          if (data.agreed_rate) {
            validationHelpers.isValidNumber(data.agreed_rate, 0, 10000, 'Agreed Rate');
          }
          if (data.agreed_rate_type) {
            const validRateTypes = ['hourly', 'project', 'daily', 'weekly'];
            validationHelpers.isValidEnum(data.agreed_rate_type, validRateTypes, 'Agreed Rate Type');
          }
          break;

        case BOOKING_STATES.REJECTED:
          validationHelpers.isRequired(data.rejection_reason, 'Rejection Reason');
          validationHelpers.isValidLength(data.rejection_reason, 10, 1000, 'Rejection Reason');
          break;

        case BOOKING_STATES.CANCELLED:
          validationHelpers.isRequired(data.cancellation_reason, 'Cancellation Reason');
          validationHelpers.isValidLength(data.cancellation_reason, 10, 1000, 'Cancellation Reason');
          break;

        case BOOKING_STATES.DELIVERED:
          if (data.delivery_notes) {
            validationHelpers.isValidLength(data.delivery_notes, 1, 2000, 'Delivery Notes');
          }
          break;

        case BOOKING_STATES.COMPLETED:
          // Optional rating and feedback validation
          if (data.client_rating) {
            validationHelpers.isValidInteger(data.client_rating, 1, 5, 'Client Rating');
          }
          if (data.retiree_rating) {
            validationHelpers.isValidInteger(data.retiree_rating, 1, 5, 'Retiree Rating');
          }
          if (data.client_feedback) {
            validationHelpers.isValidLength(data.client_feedback, 1, 2000, 'Client Feedback');
          }
          if (data.retiree_feedback) {
            validationHelpers.isValidLength(data.retiree_feedback, 1, 2000, 'Retiree Feedback');
          }
          break;
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate booking update data
 */
function validateUpdateBooking() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // At least one field must be provided
      if (!data || Object.keys(data).length === 0) {
        throw new BookingValidationError('At least one field must be provided for update', 'NO_UPDATE_FIELDS');
      }

      // Validate individual fields if provided
      if (data.title) {
        validationHelpers.isValidLength(data.title, 5, 200, 'Title');
      }
      if (data.description) {
        validationHelpers.isValidLength(data.description, 10, 5000, 'Description');
      }
      if (data.client_message) {
        validationHelpers.isValidLength(data.client_message, 1, 1000, 'Client Message');
      }
      if (data.retiree_response) {
        validationHelpers.isValidLength(data.retiree_response, 1, 1000, 'Retiree Response');
      }
      if (data.location) {
        validationHelpers.isValidLength(data.location, 1, 200, 'Location');
      }

      // Numeric validation
      if (data.proposed_rate) {
        validationHelpers.isValidNumber(data.proposed_rate, 0, 10000, 'Proposed Rate');
      }
      if (data.agreed_rate) {
        validationHelpers.isValidNumber(data.agreed_rate, 0, 10000, 'Agreed Rate');
      }
      if (data.estimated_hours) {
        validationHelpers.isValidInteger(data.estimated_hours, 1, 2000, 'Estimated Hours');
      }

      // Date validation
      if (data.start_date) {
        validationHelpers.isValidDate(data.start_date, 'Start Date', true, false);
      }
      if (data.end_date) {
        validationHelpers.isValidDate(data.end_date, 'End Date', true, false);
      }

      // Enum validation
      const validRateTypes = ['hourly', 'project', 'daily', 'weekly'];
      const validUrgencyLevels = ['low', 'normal', 'high', 'urgent'];

      if (data.proposed_rate_type) {
        validationHelpers.isValidEnum(data.proposed_rate_type, validRateTypes, 'Proposed Rate Type');
      }
      if (data.agreed_rate_type) {
        validationHelpers.isValidEnum(data.agreed_rate_type, validRateTypes, 'Agreed Rate Type');
      }
      if (data.urgency_level) {
        validationHelpers.isValidEnum(data.urgency_level, validUrgencyLevels, 'Urgency Level');
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate search/filter parameters
 */
function validateBookingSearch() {
  return (req, res, next) => {
    try {
      const {
        client_id,
        retiree_id,
        status,
        engagement_type,
        service_category,
        start_date,
        end_date,
        limit,
        offset,
        sort_by,
        sort_order
      } = req.query;

      // UUID validation
      if (client_id) {
        validationHelpers.isValidUUID(client_id, 'Client ID');
      }
      if (retiree_id) {
        validationHelpers.isValidUUID(retiree_id, 'Retiree ID');
      }

      // Status validation (can be single or multiple)
      if (status) {
        const statuses = status.split(',');
        statuses.forEach(s => {
          if (!BookingStateMachine.isValidState(s.trim())) {
            throw new BookingValidationError(`Invalid status: ${s}`, 'INVALID_STATUS_FILTER');
          }
        });
      }

      // Engagement type validation
      if (engagement_type) {
        const validEngagementTypes = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
        validationHelpers.isValidEnum(engagement_type, validEngagementTypes, 'Engagement Type');
      }

      // Date validation
      if (start_date) {
        validationHelpers.isValidDate(start_date, 'Start Date');
      }
      if (end_date) {
        validationHelpers.isValidDate(end_date, 'End Date');
      }

      // Pagination validation
      if (limit) {
        validationHelpers.isValidInteger(limit, 1, 100, 'Limit');
      }
      if (offset) {
        validationHelpers.isValidInteger(offset, 0, null, 'Offset');
      }

      // Sorting validation
      if (sort_by) {
        const validSortFields = [
          'created_at', 'updated_at', 'status_changed_at', 'start_date', 'end_date',
          'proposed_rate', 'agreed_rate', 'title', 'urgency_level'
        ];
        validationHelpers.isValidEnum(sort_by, validSortFields, 'Sort By');
      }
      if (sort_order) {
        validationHelpers.isValidEnum(sort_order, ['asc', 'desc'], 'Sort Order');
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate booking ID parameter
 */
function validateBookingId() {
  return (req, res, next) => {
    try {
      const { bookingId } = req.params;
      
      validationHelpers.isRequired(bookingId, 'Booking ID');
      validationHelpers.isValidUUID(bookingId, 'Booking ID');
      
      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate requirement creation data
 */
function validateCreateRequirement() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // Required fields
      validationHelpers.isRequired(data.title, 'Title');
      
      // String validation
      validationHelpers.isValidLength(data.title, 1, 200, 'Title');
      if (data.description) {
        validationHelpers.isValidLength(data.description, 1, 1000, 'Description');
      }

      // Enum validation
      const validReqTypes = ['skill', 'experience', 'certification', 'tool', 'deliverable', 'other'];
      const validProficiencies = ['beginner', 'intermediate', 'advanced', 'expert'];

      if (data.requirement_type) {
        validationHelpers.isValidEnum(data.requirement_type, validReqTypes, 'Requirement Type');
      }
      if (data.required_proficiency) {
        validationHelpers.isValidEnum(data.required_proficiency, validProficiencies, 'Required Proficiency');
      }

      // Numeric validation
      if (data.priority) {
        validationHelpers.isValidInteger(data.priority, 0, 100, 'Priority');
      }
      if (data.min_years_experience) {
        validationHelpers.isValidInteger(data.min_years_experience, 0, 50, 'Minimum Years Experience');
      }
      if (data.expected_quantity) {
        validationHelpers.isValidInteger(data.expected_quantity, 1, 1000, 'Expected Quantity');
      }

      // UUID validation
      if (data.skill_id) {
        validationHelpers.isValidUUID(data.skill_id, 'Skill ID');
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Additional validation functions for specific endpoints
 */

/**
 * Validate booking acceptance data
 */
function validateBookingAcceptance() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // Optional fields validation
      if (data.response) {
        validationHelpers.isValidLength(data.response, 1, 1000, 'Response');
      }
      if (data.agreed_rate) {
        validationHelpers.isValidNumber(data.agreed_rate, 0, 10000, 'Agreed Rate');
      }
      if (data.agreed_rate_type) {
        const validRateTypes = ['hourly', 'project', 'daily', 'weekly'];
        validationHelpers.isValidEnum(data.agreed_rate_type, validRateTypes, 'Agreed Rate Type');
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate rejection reason
 */
function validateRejectionReason() {
  return (req, res, next) => {
    try {
      const { reason } = req.body;
      
      validationHelpers.isRequired(reason, 'Reason');
      validationHelpers.isValidLength(reason, 10, 1000, 'Reason');
      
      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate cancellation reason
 */
function validateCancellationReason() {
  return (req, res, next) => {
    try {
      const { reason } = req.body;
      
      validationHelpers.isRequired(reason, 'Reason');
      validationHelpers.isValidLength(reason, 10, 1000, 'Reason');
      
      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate booking delivery data
 */
function validateBookingDelivery() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // Optional fields validation
      if (data.notes) {
        validationHelpers.isValidLength(data.notes, 1, 2000, 'Notes');
      }
      if (data.next_steps) {
        validationHelpers.isValidLength(data.next_steps, 1, 1000, 'Next Steps');
      }
      if (data.deliverables && Array.isArray(data.deliverables)) {
        data.deliverables.forEach((deliverable, index) => {
          if (typeof deliverable === 'string') {
            validationHelpers.isValidLength(deliverable, 1, 500, `Deliverable ${index + 1}`);
          }
        });
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate booking completion data
 */
function validateBookingCompletion() {
  return (req, res, next) => {
    try {
      const data = req.body;

      // Rating validation
      if (data.client_rating) {
        validationHelpers.isValidInteger(data.client_rating, 1, 5, 'Client Rating');
      }
      if (data.retiree_rating) {
        validationHelpers.isValidInteger(data.retiree_rating, 1, 5, 'Retiree Rating');
      }

      // Feedback validation
      if (data.client_feedback) {
        validationHelpers.isValidLength(data.client_feedback, 1, 2000, 'Client Feedback');
      }
      if (data.retiree_feedback) {
        validationHelpers.isValidLength(data.retiree_feedback, 1, 2000, 'Retiree Feedback');
      }
      if (data.final_notes) {
        validationHelpers.isValidLength(data.final_notes, 1, 1000, 'Final Notes');
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Validate history query parameters
 */
function validateHistoryQuery() {
  return (req, res, next) => {
    try {
      const { limit, sort_order } = req.query;

      if (limit) {
        validationHelpers.isValidInteger(limit, 1, 100, 'Limit');
      }
      if (sort_order) {
        validationHelpers.isValidEnum(sort_order, ['asc', 'desc'], 'Sort Order');
      }

      next();
    } catch (error) {
      if (error instanceof BookingValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          field: error.field
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

module.exports = {
  // Main validation functions
  validateBookingCreation: validateCreateBooking,
  validateBookingQuery: validateBookingSearch,
  validateBookingUpdate: validateUpdateBooking,
  validateBookingId,
  validateRequirementCreation: validateCreateRequirement,
  
  // State-specific validations
  validateBookingAcceptance,
  validateRejectionReason,
  validateCancellationReason,
  validateBookingDelivery,
  validateBookingCompletion,
  validateHistoryQuery,
  
  // Legacy aliases for compatibility
  validateCreateBooking,
  validateStatusUpdate,
  validateUpdateBooking,
  validateBookingSearch,
  validateCreateRequirement,
  
  // Utility exports
  BookingValidationError,
  validationHelpers
};