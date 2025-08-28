/**
 * Booking Model with PostgreSQL Database Integration
 * Handles booking database operations and business logic with state machine support
 */

const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const { BookingStateMachine, BOOKING_STATES, BookingStateMachineError } = require('../utils/bookingStateMachine');
const { getDatabase } = require('../config/database');

class BookingError extends Error {
  constructor(message, code = 'BOOKING_ERROR') {
    super(message);
    this.name = 'BookingError';
    this.code = code;
  }
}

/**
 * PostgreSQL-backed Booking Model Class
 */
class BookingDB {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    this.db = getDatabase();
    if (!this.db) {
      throw new BookingError('Database not initialized', 'DB_NOT_INITIALIZED');
    }
  }

  /**
   * Create a new booking
   * @param {Object} bookingData - Booking creation data
   * @param {string} createdBy - User ID creating the booking
   * @returns {Promise<Object>} Created booking object
   */
  async create(bookingData, createdBy) {
    try {
      if (!this.db) await this.init();

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

      // Prepare booking data for database
      const bookingId = uuidv4();
      const initialState = BookingStateMachine.getInitialState();

      const insertQuery = `
        INSERT INTO bookings (
          id, client_id, retiree_id, client_profile_id, retiree_profile_id,
          title, description, service_category, engagement_type,
          status, status_changed_by, proposed_rate, proposed_rate_type,
          currency, start_date, end_date, estimated_hours, flexible_timing,
          timezone, client_message, urgency_level, remote_work, location
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        )
        RETURNING *
      `;

      const values = [
        bookingId,
        clientId,
        retireeId,
        bookingData.clientProfileId || null,
        bookingData.retireeProfileId || null,
        this.sanitizeText(title),
        this.sanitizeText(description),
        bookingData.serviceCategory || null,
        engagementType,
        initialState,
        createdBy,
        this.validateRate(bookingData.proposedRate),
        bookingData.proposedRateType || 'hourly',
        bookingData.currency || 'USD',
        this.validateDate(bookingData.startDate),
        this.validateDate(bookingData.endDate),
        this.validateInteger(bookingData.estimatedHours),
        Boolean(bookingData.flexibleTiming),
        bookingData.timezone || 'UTC',
        this.sanitizeText(bookingData.clientMessage || ''),
        this.validateUrgencyLevel(bookingData.urgencyLevel),
        Boolean(bookingData.remoteWork !== false),
        this.sanitizeText(bookingData.location || '')
      ];

      // Validate dates if provided
      if (values[15] && values[16]) { // start_date and end_date
        if (values[15] > values[16]) {
          throw new BookingError('Start date cannot be after end date', 'INVALID_DATE_RANGE');
        }
      }

      const result = await this.db.query(insertQuery, values);
      const booking = result.rows[0];

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
      if (!this.db) await this.init();

      const query = `
        SELECT * FROM bookings 
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await this.db.query(query, [bookingId]);
      return result.rows.length > 0 ? result.rows[0] : null;

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
      if (!this.db) await this.init();

      let whereConditions = ['deleted_at IS NULL'];
      let queryParams = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (criteria.clientId) {
        whereConditions.push(`client_id = $${paramIndex}`);
        queryParams.push(criteria.clientId);
        paramIndex++;
      }

      if (criteria.retireeId) {
        whereConditions.push(`retiree_id = $${paramIndex}`);
        queryParams.push(criteria.retireeId);
        paramIndex++;
      }

      if (criteria.status) {
        const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
        const statusPlaceholders = statuses.map(() => `$${paramIndex++}`).join(',');
        whereConditions.push(`status IN (${statusPlaceholders})`);
        queryParams.push(...statuses);
      }

      if (criteria.engagementType) {
        whereConditions.push(`engagement_type = $${paramIndex}`);
        queryParams.push(criteria.engagementType);
        paramIndex++;
      }

      if (criteria.serviceCategory) {
        whereConditions.push(`service_category = $${paramIndex}`);
        queryParams.push(criteria.serviceCategory);
        paramIndex++;
      }

      if (criteria.startDate) {
        whereConditions.push(`start_date >= $${paramIndex}`);
        queryParams.push(criteria.startDate);
        paramIndex++;
      }

      if (criteria.endDate) {
        whereConditions.push(`end_date <= $${paramIndex}`);
        queryParams.push(criteria.endDate);
        paramIndex++;
      }

      // Build ORDER BY
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;

      // Pagination
      const limit = Math.max(1, Math.min(100, options.limit || 20));
      const offset = Math.max(0, options.offset || 0);

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM bookings
        WHERE ${whereConditions.join(' AND ')}
      `;

      // Data query
      const dataQuery = `
        SELECT *
        FROM bookings
        WHERE ${whereConditions.join(' AND ')}
        ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);

      // Execute both queries
      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, queryParams.slice(0, -2)),
        this.db.query(dataQuery, queryParams)
      ]);

      const total = parseInt(countResult.rows[0].total);

      return {
        bookings: dataResult.rows,
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
      if (!this.db) await this.init();

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

      // Prepare update fields
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(newStatus);
      
      updateFields.push(`status_changed_at = CURRENT_TIMESTAMP`);
      updateFields.push(`status_changed_by = $${paramIndex++}`);
      updateValues.push(userId);
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // State-specific updates
      switch (newStatus) {
        case BOOKING_STATES.ACCEPTED:
          if (updateData.agreed_rate) {
            updateFields.push(`agreed_rate = $${paramIndex++}`);
            updateValues.push(this.validateRate(updateData.agreed_rate));
          }
          if (updateData.agreed_rate_type) {
            updateFields.push(`agreed_rate_type = $${paramIndex++}`);
            updateValues.push(updateData.agreed_rate_type);
          }
          break;
          
        case BOOKING_STATES.REJECTED:
          if (updateData.rejection_reason) {
            updateFields.push(`rejection_reason = $${paramIndex++}`);
            updateValues.push(this.sanitizeText(updateData.rejection_reason));
          }
          break;
          
        case BOOKING_STATES.ACTIVE:
          if (!booking.start_date) {
            updateFields.push(`start_date = CURRENT_DATE`);
          }
          break;
          
        case BOOKING_STATES.DELIVERED:
          updateFields.push(`delivery_date = CURRENT_DATE`);
          break;
          
        case BOOKING_STATES.COMPLETED:
          updateFields.push(`completion_date = CURRENT_DATE`);
          break;
          
        case BOOKING_STATES.CANCELLED:
          if (updateData.cancellation_reason) {
            updateFields.push(`cancellation_reason = $${paramIndex++}`);
            updateValues.push(this.sanitizeText(updateData.cancellation_reason));
          }
          break;
      }

      // Update query
      const updateQuery = `
        UPDATE bookings 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      updateValues.push(bookingId);

      const result = await this.db.query(updateQuery, updateValues);
      const updatedBooking = result.rows[0];

      // Add history entry (the trigger will handle automatic status change history)
      if (validation.description) {
        await this.addHistoryEntry(bookingId, {
          event_type: 'status_change',
          from_status: booking.status,
          to_status: newStatus,
          event_title: `Booking ${newStatus}`,
          event_description: validation.description,
          actor_id: userId,
          actor_role: userRole,
          metadata: updateData
        });
      }

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
      if (!this.db) await this.init();

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

      // Build update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [field, value] of Object.entries(validatedUpdates)) {
        updateFields.push(`${field} = $${paramIndex++}`);
        updateValues.push(value);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      const updateQuery = `
        UPDATE bookings 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      updateValues.push(bookingId);

      const result = await this.db.query(updateQuery, updateValues);
      const updatedBooking = result.rows[0];

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
      if (!this.db) await this.init();

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

      const deleteQuery = `
        UPDATE bookings 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      await this.db.query(deleteQuery, [bookingId]);

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
      if (!this.db) await this.init();

      const booking = await this.findById(bookingId);
      if (!booking) {
        throw new BookingError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      const requirementId = uuidv4();

      const insertQuery = `
        INSERT INTO booking_requirements (
          id, booking_id, requirement_type, title, description, is_mandatory,
          priority, skill_id, required_proficiency, min_years_experience,
          deliverable_format, expected_quantity
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING *
      `;

      const values = [
        requirementId,
        bookingId,
        requirementData.requirement_type || 'other',
        this.sanitizeText(requirementData.title || ''),
        this.sanitizeText(requirementData.description || ''),
        Boolean(requirementData.is_mandatory !== false),
        this.validateInteger(requirementData.priority, 0),
        requirementData.skill_id || null,
        requirementData.required_proficiency || null,
        this.validateInteger(requirementData.min_years_experience),
        requirementData.deliverable_format || null,
        this.validateInteger(requirementData.expected_quantity, 1)
      ];

      const result = await this.db.query(insertQuery, values);
      return result.rows[0];

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
      if (!this.db) await this.init();

      const query = `
        SELECT * FROM booking_requirements
        WHERE booking_id = $1 AND deleted_at IS NULL
        ORDER BY priority ASC
      `;

      const result = await this.db.query(query, [bookingId]);
      return result.rows;

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
      if (!this.db) await this.init();

      const historyId = uuidv4();

      const insertQuery = `
        INSERT INTO booking_history (
          id, booking_id, event_type, from_status, to_status,
          event_title, event_description, actor_id, actor_role, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        RETURNING *
      `;

      const values = [
        historyId,
        bookingId,
        historyData.event_type,
        historyData.from_status || null,
        historyData.to_status || null,
        historyData.event_title,
        historyData.event_description || '',
        historyData.actor_id,
        historyData.actor_role || 'unknown',
        JSON.stringify(historyData.metadata || {})
      ];

      const result = await this.db.query(insertQuery, values);
      return result.rows[0];

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
      if (!this.db) await this.init();

      const sortOrder = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
      const limit = options.limit ? Math.max(1, Math.min(100, options.limit)) : null;

      let query = `
        SELECT * FROM booking_history
        WHERE booking_id = $1
        ORDER BY created_at ${sortOrder}
      `;

      const queryParams = [bookingId];

      if (limit) {
        query += ` LIMIT $2`;
        queryParams.push(limit);
      }

      const result = await this.db.query(query, queryParams);
      return result.rows;

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
      if (!this.db) await this.init();

      let whereConditions = ['deleted_at IS NULL'];
      let queryParams = [];
      let paramIndex = 1;

      // Apply filters if provided
      if (criteria.clientId) {
        whereConditions.push(`client_id = $${paramIndex++}`);
        queryParams.push(criteria.clientId);
      }
      if (criteria.retireeId) {
        whereConditions.push(`retiree_id = $${paramIndex++}`);
        queryParams.push(criteria.retireeId);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get basic stats
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'request' THEN 1 END) as request_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
        FROM bookings
        WHERE ${whereClause}
      `;

      // Get engagement type stats
      const engagementStatsQuery = `
        SELECT 
          engagement_type,
          COUNT(*) as count
        FROM bookings
        WHERE ${whereClause}
        GROUP BY engagement_type
      `;

      // Get rate stats
      const rateStatsQuery = `
        SELECT 
          AVG(agreed_rate) as average_rate,
          SUM(CASE 
            WHEN agreed_rate IS NOT NULL AND estimated_hours IS NOT NULL 
            THEN agreed_rate * estimated_hours 
            ELSE agreed_rate 
          END) as total_value
        FROM bookings
        WHERE ${whereClause} AND agreed_rate IS NOT NULL
      `;

      const [basicStats, engagementStats, rateStats] = await Promise.all([
        this.db.query(basicStatsQuery, queryParams),
        this.db.query(engagementStatsQuery, queryParams),
        this.db.query(rateStatsQuery, queryParams)
      ]);

      const basic = basicStats.rows[0];
      const engagement = engagementStats.rows;
      const rates = rateStats.rows[0];

      return {
        total: parseInt(basic.total),
        byStatus: {
          request: parseInt(basic.request_count),
          pending: parseInt(basic.pending_count),
          accepted: parseInt(basic.accepted_count),
          rejected: parseInt(basic.rejected_count),
          active: parseInt(basic.active_count),
          delivered: parseInt(basic.delivered_count),
          completed: parseInt(basic.completed_count),
          cancelled: parseInt(basic.cancelled_count)
        },
        byEngagementType: engagement.reduce((acc, row) => {
          acc[row.engagement_type] = parseInt(row.count);
          return acc;
        }, {}),
        totalValue: parseFloat(rates.total_value) || 0,
        averageRate: parseFloat(rates.average_rate) || 0
      };

    } catch (error) {
      throw new BookingError(`Failed to get booking statistics: ${error.message}`, 'STATS_FAILED');
    }
  }

  // Utility methods (same as original)

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
}

// Export singleton instance
module.exports = {
  BookingDB: new BookingDB(),
  BookingError
};