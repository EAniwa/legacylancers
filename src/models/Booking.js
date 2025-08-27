/**
 * Booking Model
 * Handles booking database operations and business logic with state machine support
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const { BookingStateMachine, BOOKING_STATES, BookingStateMachineError } = require('../utils/bookingStateMachine');

class BookingError extends Error {
  constructor(message, code = 'BOOKING_ERROR') {
    super(message);
    this.name = 'BookingError';
    this.code = code;
  }
}

/**
 * Booking Model Class
 * For now, using in-memory storage. In production, this would connect to PostgreSQL
 */
class Booking {
  constructor() {
    // In-memory storage for development/testing
    // In production, this would be replaced with database connection
    this.bookings = new Map();
    this.bookingRequirements = new Map();
    this.bookingHistory = new Map();
    this.bookingAttachments = new Map();
  }

  /**
   * Create a new booking
   * @param {Object} bookingData - Booking creation data
   * @param {string} bookingData.clientId - Client user ID
   * @param {string} bookingData.retireeId - Retiree user ID
   * @param {string} bookingData.title - Booking title
   * @param {string} bookingData.description - Booking description
   * @param {string} bookingData.engagementType - Type of engagement
   * @param {string} createdBy - User ID creating the booking
   * @returns {Promise<Object>} Created booking object
   */
  async create(bookingData, createdBy) {
    try {
      // Validate required fields
      const { clientId, retireeId, title, description } = bookingData;

      if (!clientId) {
        throw new BookingError('Client ID is required', 'MISSING_CLIENT_ID');
      }

      if (!retireeId) {
        throw new BookingError('Retiree ID is required', 'MISSING_RETIREE_ID');
      }

      if (!title || title.trim() === '') {
        throw new BookingError('Title is required', 'MISSING_TITLE');
      }

      if (!description || description.trim() === '') {
        throw new BookingError('Description is required', 'MISSING_DESCRIPTION');
      }

      if (clientId === retireeId) {
        throw new BookingError('Client and retiree cannot be the same user', 'INVALID_USER_ASSIGNMENT');
      }

      // Validate title and description length
      if (!validator.isLength(title, { min: 5, max: 200 })) {
        throw new BookingError('Title must be between 5 and 200 characters', 'INVALID_TITLE_LENGTH');
      }

      if (!validator.isLength(description, { min: 10, max: 5000 })) {
        throw new BookingError('Description must be between 10 and 5000 characters', 'INVALID_DESCRIPTION_LENGTH');
      }

      // Validate engagement type
      const validEngagementTypes = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
      const engagementType = bookingData.engagementType || 'freelance';
      
      if (!validEngagementTypes.includes(engagementType)) {
        throw new BookingError('Invalid engagement type', 'INVALID_ENGAGEMENT_TYPE');
      }

      // Create booking object
      const bookingId = uuidv4();
      const now = new Date();
      const initialState = BookingStateMachine.getInitialState();

      const booking = {
        id: bookingId,
        client_id: clientId,
        retiree_id: retireeId,
        client_profile_id: bookingData.clientProfileId || null,
        retiree_profile_id: bookingData.retireeProfileId || null,
        title: this.sanitizeText(title),
        description: this.sanitizeText(description),
        service_category: bookingData.serviceCategory || null,
        engagement_type: engagementType,
        
        // State management
        status: initialState,
        status_changed_at: now,
        status_changed_by: createdBy,
        
        // Pricing
        proposed_rate: this.validateRate(bookingData.proposedRate),
        proposed_rate_type: bookingData.proposedRateType || 'hourly',
        agreed_rate: null,
        agreed_rate_type: null,
        currency: bookingData.currency || 'USD',
        
        // Scheduling
        start_date: this.validateDate(bookingData.startDate),
        end_date: this.validateDate(bookingData.endDate),
        estimated_hours: this.validateInteger(bookingData.estimatedHours),
        flexible_timing: Boolean(bookingData.flexibleTiming),
        timezone: bookingData.timezone || 'UTC',
        
        // Delivery
        delivery_date: null,
        completion_date: null,
        
        // Messages
        client_message: this.sanitizeText(bookingData.clientMessage || ''),
        retiree_response: null,
        rejection_reason: null,
        cancellation_reason: null,
        
        // Metadata
        urgency_level: this.validateUrgencyLevel(bookingData.urgencyLevel),
        remote_work: Boolean(bookingData.remoteWork !== false), // Default true
        location: this.sanitizeText(bookingData.location || ''),
        
        // Ratings and feedback
        client_rating: null,
        retiree_rating: null,
        client_feedback: null,
        retiree_feedback: null,
        
        // Payment
        payment_status: 'pending',
        payment_reference: null,
        
        // Audit fields
        created_at: now,
        updated_at: now,
        deleted_at: null
      };

      // Validate dates if provided
      if (booking.start_date && booking.end_date) {
        if (booking.start_date > booking.end_date) {
          throw new BookingError('Start date cannot be after end date', 'INVALID_DATE_RANGE');
        }
      }

      // Store booking
      this.bookings.set(bookingId, booking);

      // Create initial history entry
      await this.addHistoryEntry(bookingId, {
        event_type: 'status_change',
        from_status: null,
        to_status: initialState,
        event_title: 'Booking created',
        event_description: 'New booking request created',
        actor_id: createdBy,
        actor_role: 'client'
      });

      // Add requirements if provided
      if (bookingData.requirements && Array.isArray(bookingData.requirements)) {
        for (const requirement of bookingData.requirements) {
          await this.addRequirement(bookingId, requirement);
        }
      }

      return booking;

    } catch (error) {
      if (error instanceof BookingError) {
        throw error;
      }
      throw new BookingError(`Failed to create booking: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Find booking by ID
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object|null>} Booking object or null if not found
   */
  async findById(bookingId) {
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking || booking.deleted_at) {
        return null;
      }

      return { ...booking };
    } catch (error) {
      throw new BookingError(`Failed to find booking: ${error.message}`, 'FIND_FAILED');
    }
  }

  /**
   * Find bookings by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Promise<Object>} Search results with bookings and pagination info
   */
  async findByCriteria(criteria = {}, options = {}) {
    try {
      let bookings = Array.from(this.bookings.values()).filter(booking => !booking.deleted_at);
      
      // Apply filters
      if (criteria.clientId) {
        bookings = bookings.filter(b => b.client_id === criteria.clientId);
      }
      
      if (criteria.retireeId) {
        bookings = bookings.filter(b => b.retiree_id === criteria.retireeId);
      }
      
      if (criteria.status) {
        const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
        bookings = bookings.filter(b => statuses.includes(b.status));
      }
      
      if (criteria.engagementType) {
        bookings = bookings.filter(b => b.engagement_type === criteria.engagementType);
      }
      
      if (criteria.serviceCategory) {
        bookings = bookings.filter(b => b.service_category === criteria.serviceCategory);
      }
      
      if (criteria.startDate) {
        bookings = bookings.filter(b => b.start_date && b.start_date >= new Date(criteria.startDate));
      }
      
      if (criteria.endDate) {
        bookings = bookings.filter(b => b.end_date && b.end_date <= new Date(criteria.endDate));
      }

      // Apply sorting
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      
      bookings.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (aVal < bVal) return -sortOrder;
        if (aVal > bVal) return sortOrder;
        return 0;
      });

      // Apply pagination
      const total = bookings.length;
      const limit = Math.max(1, Math.min(100, options.limit || 20)); // Max 100, default 20
      const offset = Math.max(0, options.offset || 0);
      
      const paginatedBookings = bookings.slice(offset, offset + limit);

      return {
        bookings: paginatedBookings,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };

    } catch (error) {
      throw new BookingError(`Failed to search bookings: ${error.message}`, 'SEARCH_FAILED');
    }
  }

  /**
   * Update booking status with state machine validation
   * @param {string} bookingId - Booking ID
   * @param {string} newStatus - New status
   * @param {string} userId - User performing the update
   * @param {Object} updateData - Additional update data
   * @returns {Promise<Object>} Updated booking object
   */
  async updateStatus(bookingId, newStatus, userId, updateData = {}) {
    try {
      const booking = await this.findById(bookingId);
      if (!booking) {
        throw new BookingError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Determine user role for this booking
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      
      if (userRole === 'unknown') {
        throw new BookingError('User not authorized for this booking', 'UNAUTHORIZED');
      }

      // Validate state transition
      const validation = BookingStateMachine.validateTransition(
        booking.status,
        newStatus,
        userRole,
        { ...booking, ...updateData }
      );

      if (!validation.success) {
        throw new BookingError(validation.error, validation.code);
      }

      // Apply updates
      const now = new Date();
      const updatedBooking = {
        ...booking,
        status: newStatus,
        status_changed_at: now,
        status_changed_by: userId,
        updated_at: now,
        ...updateData
      };

      // State-specific updates
      switch (newStatus) {
        case BOOKING_STATES.ACCEPTED:
          if (updateData.agreed_rate) {
            updatedBooking.agreed_rate = this.validateRate(updateData.agreed_rate);
          }
          if (updateData.agreed_rate_type) {
            updatedBooking.agreed_rate_type = updateData.agreed_rate_type;
          }
          break;
          
        case BOOKING_STATES.REJECTED:
          if (updateData.rejection_reason) {
            updatedBooking.rejection_reason = this.sanitizeText(updateData.rejection_reason);
          }
          break;
          
        case BOOKING_STATES.ACTIVE:
          if (!updatedBooking.start_date) {
            updatedBooking.start_date = new Date();
          }
          break;
          
        case BOOKING_STATES.DELIVERED:
          updatedBooking.delivery_date = new Date();
          break;
          
        case BOOKING_STATES.COMPLETED:
          updatedBooking.completion_date = new Date();
          break;
          
        case BOOKING_STATES.CANCELLED:
          if (updateData.cancellation_reason) {
            updatedBooking.cancellation_reason = this.sanitizeText(updateData.cancellation_reason);
          }
          break;
      }

      // Store updated booking
      this.bookings.set(bookingId, updatedBooking);

      // Add history entry
      await this.addHistoryEntry(bookingId, {
        event_type: 'status_change',
        from_status: booking.status,
        to_status: newStatus,
        event_title: `Booking ${newStatus}`,
        event_description: validation.description || `Booking status changed to ${newStatus}`,
        actor_id: userId,
        actor_role: userRole,
        metadata: updateData
      });

      return updatedBooking;

    } catch (error) {
      if (error instanceof BookingError) {
        throw error;
      }
      throw new BookingError(`Failed to update booking status: ${error.message}`, 'STATUS_UPDATE_FAILED');
    }
  }

  /**
   * Update booking data (non-status fields)
   * @param {string} bookingId - Booking ID
   * @param {Object} updateData - Fields to update
   * @param {string} userId - User performing the update
   * @returns {Promise<Object>} Updated booking object
   */
  async update(bookingId, updateData, userId) {
    try {
      const booking = await this.findById(bookingId);
      if (!booking) {
        throw new BookingError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Check if user can update this booking
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      if (userRole === 'unknown') {
        throw new BookingError('User not authorized for this booking', 'UNAUTHORIZED');
      }

      // Define allowed update fields by role
      const clientAllowedFields = ['title', 'description', 'client_message', 'proposed_rate', 'proposed_rate_type', 'start_date', 'end_date', 'estimated_hours', 'urgency_level'];
      const retireeAllowedFields = ['retiree_response', 'agreed_rate', 'agreed_rate_type'];
      const bothAllowedFields = ['location', 'remote_work', 'flexible_timing'];

      let allowedFields = [];
      if (userRole === 'client') {
        allowedFields = [...clientAllowedFields, ...bothAllowedFields];
      } else if (userRole === 'retiree') {
        allowedFields = [...retireeAllowedFields, ...bothAllowedFields];
      }

      // Filter update data to only allowed fields
      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        throw new BookingError('No valid fields to update', 'NO_VALID_UPDATES');
      }

      // Validate and sanitize updates
      const validatedUpdates = await this.validateUpdateData(filteredUpdates);

      // Apply updates
      const now = new Date();
      const updatedBooking = {
        ...booking,
        ...validatedUpdates,
        updated_at: now
      };

      // Store updated booking
      this.bookings.set(bookingId, updatedBooking);

      // Add history entry for significant changes
      const significantFields = ['proposed_rate', 'agreed_rate', 'start_date', 'end_date'];
      const hasSignificantChanges = Object.keys(validatedUpdates).some(field => significantFields.includes(field));
      
      if (hasSignificantChanges) {
        await this.addHistoryEntry(bookingId, {
          event_type: 'booking_update',
          event_title: 'Booking details updated',
          event_description: `Updated fields: ${Object.keys(validatedUpdates).join(', ')}`,
          actor_id: userId,
          actor_role: userRole,
          metadata: { updatedFields: Object.keys(validatedUpdates), changes: validatedUpdates }
        });
      }

      return updatedBooking;

    } catch (error) {
      if (error instanceof BookingError) {
        throw error;
      }
      throw new BookingError(`Failed to update booking: ${error.message}`, 'UPDATE_FAILED');
    }
  }

  /**
   * Delete booking (soft delete)
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User performing deletion
   * @returns {Promise<boolean>} Success status
   */
  async delete(bookingId, userId) {
    try {
      const booking = await this.findById(bookingId);
      if (!booking) {
        throw new BookingError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Only allow deletion of request/pending bookings by client or admin
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      const allowedStates = [BOOKING_STATES.REQUEST, BOOKING_STATES.PENDING];
      
      if (userRole !== 'admin' && (userRole !== 'client' || !allowedStates.includes(booking.status))) {
        throw new BookingError('Cannot delete booking in current state', 'DELETE_NOT_ALLOWED');
      }

      // Soft delete
      const now = new Date();
      const updatedBooking = {
        ...booking,
        deleted_at: now,
        updated_at: now
      };

      this.bookings.set(bookingId, updatedBooking);

      // Add history entry
      await this.addHistoryEntry(bookingId, {
        event_type: 'booking_deleted',
        event_title: 'Booking deleted',
        event_description: 'Booking was deleted',
        actor_id: userId,
        actor_role: userRole
      });

      return true;

    } catch (error) {
      if (error instanceof BookingError) {
        throw error;
      }
      throw new BookingError(`Failed to delete booking: ${error.message}`, 'DELETE_FAILED');
    }
  }

  /**
   * Add requirement to booking
   * @param {string} bookingId - Booking ID
   * @param {Object} requirementData - Requirement data
   * @returns {Promise<Object>} Created requirement object
   */
  async addRequirement(bookingId, requirementData) {
    try {
      const booking = await this.findById(bookingId);
      if (!booking) {
        throw new BookingError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      const requirementId = uuidv4();
      const now = new Date();

      const requirement = {
        id: requirementId,
        booking_id: bookingId,
        requirement_type: requirementData.requirement_type || 'other',
        title: this.sanitizeText(requirementData.title || ''),
        description: this.sanitizeText(requirementData.description || ''),
        is_mandatory: Boolean(requirementData.is_mandatory !== false),
        priority: this.validateInteger(requirementData.priority, 0),
        skill_id: requirementData.skill_id || null,
        required_proficiency: requirementData.required_proficiency || null,
        min_years_experience: this.validateInteger(requirementData.min_years_experience),
        deliverable_format: requirementData.deliverable_format || null,
        expected_quantity: this.validateInteger(requirementData.expected_quantity, 1),
        is_met: false,
        met_at: null,
        verified_by: null,
        verification_notes: null,
        created_at: now,
        updated_at: now,
        deleted_at: null
      };

      // Store requirement
      this.bookingRequirements.set(requirementId, requirement);

      return requirement;

    } catch (error) {
      throw new BookingError(`Failed to add requirement: ${error.message}`, 'ADD_REQUIREMENT_FAILED');
    }
  }

  /**
   * Get booking requirements
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Array>} Array of requirements
   */
  async getRequirements(bookingId) {
    try {
      const requirements = Array.from(this.bookingRequirements.values())
        .filter(req => req.booking_id === bookingId && !req.deleted_at)
        .sort((a, b) => a.priority - b.priority);

      return requirements;

    } catch (error) {
      throw new BookingError(`Failed to get requirements: ${error.message}`, 'GET_REQUIREMENTS_FAILED');
    }
  }

  /**
   * Add history entry
   * @param {string} bookingId - Booking ID
   * @param {Object} historyData - History entry data
   * @returns {Promise<Object>} Created history entry
   */
  async addHistoryEntry(bookingId, historyData) {
    try {
      const historyId = uuidv4();
      const now = new Date();

      const historyEntry = {
        id: historyId,
        booking_id: bookingId,
        event_type: historyData.event_type,
        from_status: historyData.from_status || null,
        to_status: historyData.to_status || null,
        event_title: historyData.event_title,
        event_description: historyData.event_description || '',
        actor_id: historyData.actor_id,
        actor_role: historyData.actor_role || 'unknown',
        metadata: historyData.metadata || {},
        created_at: now,
        updated_at: now
      };

      this.bookingHistory.set(historyId, historyEntry);
      return historyEntry;

    } catch (error) {
      throw new BookingError(`Failed to add history entry: ${error.message}`, 'ADD_HISTORY_FAILED');
    }
  }

  /**
   * Get booking history
   * @param {string} bookingId - Booking ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of history entries
   */
  async getHistory(bookingId, options = {}) {
    try {
      let history = Array.from(this.bookingHistory.values())
        .filter(entry => entry.booking_id === bookingId);

      // Apply sorting (newest first by default)
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      history.sort((a, b) => {
        if (a.created_at < b.created_at) return -sortOrder;
        if (a.created_at > b.created_at) return sortOrder;
        return 0;
      });

      // Apply limit if specified
      if (options.limit) {
        const limit = Math.max(1, Math.min(100, options.limit));
        history = history.slice(0, limit);
      }

      return history;

    } catch (error) {
      throw new BookingError(`Failed to get booking history: ${error.message}`, 'GET_HISTORY_FAILED');
    }
  }

  /**
   * Get booking statistics
   * @param {Object} criteria - Filter criteria
   * @returns {Promise<Object>} Statistics object
   */
  async getStats(criteria = {}) {
    try {
      let bookings = Array.from(this.bookings.values()).filter(booking => !booking.deleted_at);
      
      // Apply filters if provided
      if (criteria.clientId) {
        bookings = bookings.filter(b => b.client_id === criteria.clientId);
      }
      if (criteria.retireeId) {
        bookings = bookings.filter(b => b.retiree_id === criteria.retireeId);
      }

      const stats = {
        total: bookings.length,
        byStatus: {},
        byEngagementType: {},
        totalValue: 0,
        averageRate: 0
      };

      // Calculate statistics
      let totalRateSum = 0;
      let rateCount = 0;

      for (const booking of bookings) {
        // Count by status
        stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1;
        
        // Count by engagement type
        stats.byEngagementType[booking.engagement_type] = 
          (stats.byEngagementType[booking.engagement_type] || 0) + 1;
        
        // Calculate values
        if (booking.agreed_rate) {
          const rate = parseFloat(booking.agreed_rate);
          if (!isNaN(rate)) {
            totalRateSum += rate;
            rateCount++;
            
            // Estimate total value (simple calculation)
            if (booking.estimated_hours) {
              stats.totalValue += rate * booking.estimated_hours;
            } else {
              stats.totalValue += rate;
            }
          }
        }
      }

      stats.averageRate = rateCount > 0 ? totalRateSum / rateCount : 0;

      return stats;

    } catch (error) {
      throw new BookingError(`Failed to get booking statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  // Utility methods

  /**
   * Sanitize text input
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return validator.escape(validator.trim(text));
  }

  /**
   * Validate rate
   * @param {*} rate - Rate to validate
   * @returns {number|null} Validated rate or null
   */
  validateRate(rate) {
    if (rate === null || rate === undefined || rate === '') return null;
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate < 0) {
      throw new BookingError('Invalid rate value', 'INVALID_RATE');
    }
    return numRate;
  }

  /**
   * Validate integer
   * @param {*} value - Value to validate
   * @param {number} defaultValue - Default value if validation fails
   * @returns {number|null} Validated integer or default
   */
  validateInteger(value, defaultValue = null) {
    if (value === null || value === undefined || value === '') return defaultValue;
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return defaultValue;
    return numValue;
  }

  /**
   * Validate date
   * @param {*} date - Date to validate
   * @returns {Date|null} Validated date or null
   */
  validateDate(date) {
    if (!date) return null;
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new BookingError('Invalid date format', 'INVALID_DATE');
    }
    return dateObj;
  }

  /**
   * Validate urgency level
   * @param {string} level - Urgency level
   * @returns {string} Validated urgency level
   */
  validateUrgencyLevel(level) {
    const validLevels = ['low', 'normal', 'high', 'urgent'];
    return validLevels.includes(level) ? level : 'normal';
  }

  /**
   * Validate update data
   * @param {Object} updateData - Data to validate
   * @returns {Promise<Object>} Validated update data
   */
  async validateUpdateData(updateData) {
    const validated = {};

    for (const [key, value] of Object.entries(updateData)) {
      switch (key) {
        case 'title':
        case 'description':
        case 'client_message':
        case 'retiree_response':
        case 'location':
          validated[key] = this.sanitizeText(value);
          break;
          
        case 'proposed_rate':
        case 'agreed_rate':
          validated[key] = this.validateRate(value);
          break;
          
        case 'estimated_hours':
          validated[key] = this.validateInteger(value);
          break;
          
        case 'start_date':
        case 'end_date':
          validated[key] = this.validateDate(value);
          break;
          
        case 'urgency_level':
          validated[key] = this.validateUrgencyLevel(value);
          break;
          
        case 'remote_work':
        case 'flexible_timing':
          validated[key] = Boolean(value);
          break;
          
        default:
          validated[key] = value;
      }
    }

    return validated;
  }

  /**
   * Reset all data (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    this.bookings.clear();
    this.bookingRequirements.clear();
    this.bookingHistory.clear();
    this.bookingAttachments.clear();
  }
}

// Export singleton instance
module.exports = {
  Booking: new Booking(),
  BookingError
};