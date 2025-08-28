/**
 * Availability Controller
 * Handles CRUD operations and business logic for availability management
 */

const { Availability, AvailabilityValidationError } = require('../models/Availability');
const { calendarService } = require('../services/calendar');
const { getDatabase } = require('../config/database');

/**
 * Controller Error Class
 */
class AvailabilityControllerError extends Error {
  constructor(message, statusCode = 500, code = 'CONTROLLER_ERROR') {
    super(message);
    this.name = 'AvailabilityControllerError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Save availability to database
 * @param {Availability} availability - Availability object to save
 * @returns {Promise<Object>} Saved availability with ID
 */
async function saveAvailability(availability) {
  const db = getDatabase();
  const query = `
    INSERT INTO availability (
      user_id, title, description, category, start_time, end_time, date,
      time_zone, is_recurring, recurring_pattern, max_bookings, 
      current_bookings, hourly_rate, currency, tags, status, 
      advance_notice_hours, buffer_minutes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *
  `;
  
  const result = await db.query(query, [
    availability.userId, availability.title, availability.description,
    availability.category, availability.startTime, availability.endTime,
    availability.date, availability.timeZone, availability.isRecurring,
    availability.recurringPattern, availability.maxBookings,
    availability.currentBookings, availability.hourlyRate, availability.currency,
    availability.tags, availability.status, availability.advanceNoticeHours,
    availability.bufferMinutes, availability.createdBy
  ]);
  
  return result.rows[0];
}

/**
 * Convert database row to Availability object
 * @param {Object} row - Database row
 * @returns {Availability} Availability object
 */
function dbRowToAvailability(row) {
  return new Availability({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    startTime: row.start_time,
    endTime: row.end_time,
    date: row.date,
    timeZone: row.time_zone,
    isRecurring: row.is_recurring,
    recurringPattern: row.recurring_pattern,
    maxBookings: row.max_bookings,
    currentBookings: row.current_bookings,
    hourlyRate: row.hourly_rate,
    currency: row.currency,
    tags: row.tags,
    status: row.status,
    advanceNoticeHours: row.advance_notice_hours,
    bufferMinutes: row.buffer_minutes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

/**
 * Get availabilities from database with filters
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of availability objects
 */
async function getAvailabilitiesFromDb(filters) {
  const db = getDatabase();
  
  let query = `
    SELECT * FROM availability 
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  // User filter
  if (filters.userId) {
    paramCount++;
    query += ` AND user_id = $${paramCount}`;
    params.push(filters.userId);
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    params.push(filters.status);
  }

  // Category filter
  if (filters.category) {
    paramCount++;
    query += ` AND category = $${paramCount}`;
    params.push(filters.category);
  }

  // Date range filter
  if (filters.startDate && filters.endDate) {
    paramCount++;
    query += ` AND (date IS NULL OR date BETWEEN $${paramCount} AND $${paramCount + 1})`;
    params.push(filters.startDate, filters.endDate);
    paramCount++;
  }

  // Tags filter (PostgreSQL array contains)
  if (filters.tags && filters.tags.length > 0) {
    paramCount++;
    query += ` AND tags && $${paramCount}::text[]`;
    params.push(filters.tags);
  }

  // Sorting
  const validSortFields = ['start_time', 'end_time', 'date', 'created_at'];
  const sortBy = validSortFields.includes(filters.sortBy) ? filters.sortBy : 'start_time';
  const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
  query += ` ORDER BY ${sortBy} ${sortOrder}`;

  // Pagination
  if (filters.limit) {
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(filters.limit);

    if (filters.offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
    }
  }

  const result = await db.query(query, params);
  return result.rows.map(dbRowToAvailability);
}

/**
 * Create new availability slot
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createAvailability(req, res) {
  try {
    const availabilityData = {
      ...req.body,
      userId: req.user.id, // Set from authenticated user
      createdBy: req.user.id
    };

    // Create and validate availability
    const availability = new Availability(availabilityData);
    availability.validate();

    // Check for conflicts with existing availability
    const conflicts = await checkConflicts(availability);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Availability conflicts with existing slots',
        code: 'AVAILABILITY_CONFLICT',
        conflicts: conflicts.map(c => ({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          date: c.date
        }))
      });
    }

    // Save to database
    const savedAvailability = await saveAvailability(availability);
    
    // Convert database result back to Availability object for response
    const responseAvailability = new Availability({
      id: savedAvailability.id,
      userId: savedAvailability.user_id,
      title: savedAvailability.title,
      description: savedAvailability.description,
      category: savedAvailability.category,
      startTime: savedAvailability.start_time,
      endTime: savedAvailability.end_time,
      date: savedAvailability.date,
      timeZone: savedAvailability.time_zone,
      isRecurring: savedAvailability.is_recurring,
      recurringPattern: savedAvailability.recurring_pattern,
      maxBookings: savedAvailability.max_bookings,
      currentBookings: savedAvailability.current_bookings,
      hourlyRate: savedAvailability.hourly_rate,
      currency: savedAvailability.currency,
      tags: savedAvailability.tags,
      status: savedAvailability.status,
      advanceNoticeHours: savedAvailability.advance_notice_hours,
      bufferMinutes: savedAvailability.buffer_minutes,
      createdBy: savedAvailability.created_by,
      createdAt: savedAvailability.created_at,
      updatedAt: savedAvailability.updated_at
    });

    res.status(201).json({
      success: true,
      message: 'Availability created successfully',
      data: responseAvailability.toJSON()
    });

  } catch (error) {
    if (error instanceof AvailabilityValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        field: error.field
      });
    }

    console.error('Create availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create availability',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get availability slots with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAvailabilities(req, res) {
  try {
    const {
      userId,
      startDate,
      endDate,
      category,
      status = 'active',
      tags,
      timeZone,
      includeInstances = 'false',
      page = 1,
      limit = 20,
      sortBy = 'startTime',
      sortOrder = 'asc'
    } = req.query;

    // Convert query parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const includeRecurringInstances = includeInstances === 'true';
    const offset = (pageNum - 1) * limitNum;

    // Build filters for database query
    const filters = {
      status,
      category,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      limit: limitNum,
      offset
    };

    // User filter (own slots or admin can see all)
    if (req.user.role !== 'admin') {
      filters.userId = req.user.id;
    } else if (userId) {
      filters.userId = userId;
    }

    // Tags filter
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    }

    // Get availabilities from database
    const availabilities = await getAvailabilitiesFromDb(filters);

    // Generate recurring instances if requested
    let results = [];
    if (includeRecurringInstances && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (const availability of availabilities) {
        if (availability.isRecurring) {
          const instances = availability.generateInstances(start, end);
          results.push(...instances);
        } else {
          // Check if single availability falls within date range
          if (availability.date) {
            const availDate = new Date(availability.date);
            if (availDate >= start && availDate <= end) {
              results.push(availability.toJSON());
            }
          } else {
            // No specific date means it's available any time
            results.push(availability.toJSON());
          }
        }
      }
      
      // Sort instances
      results.sort((a, b) => {
        const dateA = a.date || '9999-12-31';
        const dateB = b.date || '9999-12-31';
        
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        
        return a.startTime.localeCompare(b.startTime);
      });

    } else {
      results = availabilities.map(a => a.toJSON());
    }

    // For paginated results, get total count
    const totalCountQuery = await getAvailabilitiesFromDb({ 
      ...filters, 
      limit: null, 
      offset: null 
    });
    const total = includeRecurringInstances ? results.length : totalCountQuery.length;
    const totalPages = Math.ceil(total / limitNum);

    // Apply pagination for instances (already paginated for regular results)
    const paginatedResults = includeRecurringInstances 
      ? results.slice(offset, offset + limitNum)
      : results;

    res.json({
      success: true,
      data: paginatedResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      },
      filters: {
        userId: filters.userId,
        startDate,
        endDate,
        category,
        status,
        tags,
        includeInstances: includeRecurringInstances
      }
    });

  } catch (error) {
    console.error('Get availabilities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve availabilities',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get specific availability by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAvailabilityById(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const result = await db.query('SELECT * FROM availability WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
        code: 'NOT_FOUND'
      });
    }

    const availability = dbRowToAvailability(result.rows[0]);

    // Check ownership (users can only see their own, admins can see all)
    if (req.user.role !== 'admin' && availability.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    res.json({
      success: true,
      data: availability.toJSON()
    });

  } catch (error) {
    console.error('Get availability by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve availability',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Update availability slot
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateAvailability(req, res) {
  try {
    const { id } = req.params;
    const availability = availabilityStore.get(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
        code: 'NOT_FOUND'
      });
    }

    // Check ownership (users can only update their own, admins can update all)
    if (req.user.role !== 'admin' && availability.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Don't allow changing userId or core system fields
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.createdBy;
    
    // Update fields
    Object.assign(availability, updateData, { updatedAt: new Date() });

    // Validate updated availability
    availability.validate();

    // Check for conflicts (excluding current availability)
    const conflicts = await checkConflicts(availability, id);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Availability conflicts with existing slots',
        code: 'AVAILABILITY_CONFLICT',
        conflicts: conflicts.map(c => ({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          date: c.date
        }))
      });
    }

    availabilityStore.set(id, availability);

    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: availability.toJSON()
    });

  } catch (error) {
    if (error instanceof AvailabilityValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        field: error.field
      });
    }

    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Delete availability slot
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteAvailability(req, res) {
  try {
    const { id } = req.params;
    const availability = availabilityStore.get(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
        code: 'NOT_FOUND'
      });
    }

    // Check ownership (users can only delete their own, admins can delete all)
    if (req.user.role !== 'admin' && availability.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Check if there are active bookings
    if (availability.currentBookings > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete availability with active bookings',
        code: 'HAS_BOOKINGS',
        currentBookings: availability.currentBookings
      });
    }

    availabilityStore.delete(id);

    res.json({
      success: true,
      message: 'Availability deleted successfully'
    });

  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete availability',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get user's availability slots
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserAvailability(req, res) {
  try {
    const { userId } = req.params;
    const {
      startDate,
      endDate,
      status = 'active',
      includeInstances = 'false'
    } = req.query;

    // Users can only see their own availability unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const userAvailabilities = Array.from(availabilityStore.values())
      .filter(a => a.userId === userId);

    let results = [];
    const includeRecurringInstances = includeInstances === 'true';

    if (includeRecurringInstances && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (const availability of userAvailabilities) {
        if (availability.status === status || status === 'all') {
          if (availability.isRecurring) {
            const instances = availability.generateInstances(start, end);
            results.push(...instances);
          } else if (availability.date) {
            const availDate = new Date(availability.date);
            if (availDate >= start && availDate <= end) {
              results.push(availability.toJSON());
            }
          }
        }
      }
    } else {
      results = userAvailabilities
        .filter(a => status === 'all' || a.status === status)
        .map(a => a.toJSON());
    }

    // Sort by date and time
    results.sort((a, b) => {
      const dateA = a.date || '9999-12-31';
      const dateB = b.date || '9999-12-31';
      
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      
      return a.startTime.localeCompare(b.startTime);
    });

    res.json({
      success: true,
      data: results,
      userId,
      filters: { startDate, endDate, status, includeInstances: includeRecurringInstances }
    });

  } catch (error) {
    console.error('Get user availability error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user availability',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Check for availability conflicts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function checkAvailabilityConflicts(req, res) {
  try {
    const {
      userId,
      startTime,
      endTime,
      date,
      excludeId
    } = req.body;

    // Users can only check conflicts for their own availability
    const targetUserId = userId || req.user.id;
    if (req.user.role !== 'admin' && req.user.id !== targetUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Create temporary availability object for conflict checking
    const tempAvailability = new Availability({
      userId: targetUserId,
      startTime,
      endTime,
      date,
      timeZone: req.body.timeZone || 'UTC'
    });

    try {
      tempAvailability.validate();
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.message,
        code: validationError.code,
        field: validationError.field
      });
    }

    const conflicts = await checkConflicts(tempAvailability, excludeId);

    res.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts.map(c => ({
        id: c.id,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        date: c.date,
        timeZone: c.timeZone
      }))
    });

  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check conflicts',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Helper function to check for conflicts
 * @param {Availability} availability - Availability to check
 * @param {string} excludeId - ID to exclude from conflict check
 * @returns {Array<Availability>} Conflicting availabilities
 */
async function checkConflicts(availability, excludeId = null) {
  const db = getDatabase();
  
  let query = `
    SELECT * FROM availability 
    WHERE user_id = $1 
    AND status = 'active'
  `;
  const params = [availability.userId];
  let paramCount = 1;

  if (excludeId) {
    paramCount++;
    query += ` AND id != $${paramCount}`;
    params.push(excludeId);
  }

  // For non-recurring availability with specific dates
  if (availability.date && !availability.isRecurring) {
    paramCount++;
    query += ` AND (date = $${paramCount} OR date IS NULL OR is_recurring = true)`;
    params.push(availability.date);
  }

  const result = await db.query(query, params);
  const conflicts = [];

  for (const row of result.rows) {
    const existing = dbRowToAvailability(row);
    
    // Skip if different dates (for non-recurring)
    if (availability.date && existing.date && availability.date !== existing.date) {
      continue;
    }

    // For recurring availability, would need more complex logic
    // For now, check simple time overlap
    if (isTimeOverlap(availability, existing)) {
      conflicts.push(existing);
    }
  }

  return conflicts;
}

/**
 * Check if two availability slots have time overlap
 * @param {Availability} a1 - First availability
 * @param {Availability} a2 - Second availability
 * @returns {boolean} Whether there's overlap
 */
function isTimeOverlap(a1, a2) {
  const start1 = timeToMinutes(a1.startTime);
  const end1 = timeToMinutes(a1.endTime);
  const start2 = timeToMinutes(a2.startTime);
  const end2 = timeToMinutes(a2.endTime);

  // Check for overlap: start1 < end2 && start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * Convert time string to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get availability statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAvailabilityStats(req, res) {
  try {
    const { userId } = req.params || {};
    const targetUserId = userId || req.user.id;

    // Users can only see their own stats unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== targetUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const userAvailabilities = Array.from(availabilityStore.values())
      .filter(a => a.userId === targetUserId);

    const stats = {
      total: userAvailabilities.length,
      active: userAvailabilities.filter(a => a.status === 'active').length,
      inactive: userAvailabilities.filter(a => a.status === 'inactive').length,
      booked: userAvailabilities.filter(a => a.status === 'booked').length,
      recurring: userAvailabilities.filter(a => a.isRecurring).length,
      oneTime: userAvailabilities.filter(a => !a.isRecurring).length,
      totalBookings: userAvailabilities.reduce((sum, a) => sum + a.currentBookings, 0),
      totalCapacity: userAvailabilities.reduce((sum, a) => sum + a.maxBookings, 0),
      categories: {}
    };

    // Category breakdown
    for (const availability of userAvailabilities) {
      if (!stats.categories[availability.category]) {
        stats.categories[availability.category] = 0;
      }
      stats.categories[availability.category]++;
    }

    stats.utilizationRate = stats.totalCapacity > 0 
      ? ((stats.totalBookings / stats.totalCapacity) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: stats,
      userId: targetUserId
    });

  } catch (error) {
    console.error('Get availability stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve availability statistics',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Find available time slots for booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function findAvailableSlots(req, res) {
  try {
    const {
      userId,
      startDate,
      endDate,
      durationMinutes = 60,
      timeZone = 'UTC',
      category,
      bufferMinutes = 0
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required',
        code: 'MISSING_DATE_RANGE'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    // Users can only search their own availability or admin can search any
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = parseInt(durationMinutes);
    const buffer = parseInt(bufferMinutes);

    // Get user's active availabilities
    const userAvailabilities = Array.from(availabilityStore.values())
      .filter(a => a.userId === userId && a.status === 'active');

    // Filter by category if provided
    const filteredAvailabilities = category
      ? userAvailabilities.filter(a => a.category === category)
      : userAvailabilities;

    // Generate all availability instances for the date range
    let availableInstances = [];
    for (const availability of filteredAvailabilities) {
      const instances = availability.generateInstances(start, end);
      availableInstances.push(...instances);
    }

    // Convert availability instances to time slots
    let availableSlots = [];
    for (const instance of availableInstances) {
      const instanceDate = new Date(instance.date);
      const slotStart = calendarService.combineDateTimeInTimeZone(
        instance.date,
        instance.startTime,
        timeZone
      );
      const slotEnd = calendarService.combineDateTimeInTimeZone(
        instance.date,
        instance.endTime,
        timeZone
      );

      // Generate time slots for this availability instance
      const slots = calendarService.generateTimeSlots(
        slotStart,
        slotEnd,
        duration,
        [], // No busy slots for now (would come from bookings)
        buffer
      );

      // Add metadata to each slot
      const enrichedSlots = slots.map(slot => ({
        ...slot,
        availabilityId: instance.parentId || instance.id,
        userId: instance.userId,
        category: instance.category,
        timeZone,
        hourlyRate: instance.hourlyRate,
        currency: instance.currency,
        maxBookings: instance.maxBookings,
        currentBookings: instance.currentBookings,
        isBookable: instance.maxBookings > instance.currentBookings
      }));

      availableSlots.push(...enrichedSlots);
    }

    // Sort slots by start time
    availableSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    res.json({
      success: true,
      data: availableSlots,
      filters: {
        userId,
        startDate,
        endDate,
        durationMinutes: duration,
        timeZone,
        category,
        bufferMinutes: buffer
      },
      totalSlots: availableSlots.length
    });

  } catch (error) {
    console.error('Find available slots error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find available slots',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Book a time slot (simulation of booking functionality)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function bookTimeSlot(req, res) {
  try {
    const {
      availabilityId,
      startTime,
      endTime,
      timeZone = 'UTC',
      notes = ''
    } = req.body;

    if (!availabilityId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Availability ID, start time, and end time are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const availability = availabilityStore.get(availabilityId);
    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
        code: 'AVAILABILITY_NOT_FOUND'
      });
    }

    // Check if slot is bookable
    const bookabilityCheck = availability.isBookable(new Date(), new Date(startTime));
    if (!bookabilityCheck.bookable) {
      return res.status(409).json({
        success: false,
        error: bookabilityCheck.reason,
        code: 'NOT_BOOKABLE'
      });
    }

    // Check for conflicts
    const requestedSlot = {
      start: new Date(startTime),
      end: new Date(endTime)
    };

    // In a real system, this would check against a bookings database
    // For now, we'll simulate by incrementing current bookings
    if (availability.currentBookings >= availability.maxBookings) {
      return res.status(409).json({
        success: false,
        error: 'No available slots remaining',
        code: 'FULLY_BOOKED'
      });
    }

    // Update booking count (in real system, this would create a booking record)
    availability.currentBookings += 1;
    availability.updatedAt = new Date();
    availabilityStore.set(availabilityId, availability);

    // Create booking confirmation
    const booking = {
      id: `booking_${Date.now()}`,
      availabilityId,
      userId: availability.userId,
      bookedBy: req.user.id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timeZone,
      duration: calendarService.calculateDuration(startTime, endTime),
      notes,
      status: 'confirmed',
      createdAt: new Date()
    };

    res.status(201).json({
      success: true,
      message: 'Time slot booked successfully',
      data: booking
    });

  } catch (error) {
    console.error('Book time slot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to book time slot',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get next available slot for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getNextAvailableSlot(req, res) {
  try {
    const { userId } = req.params;
    const {
      durationMinutes = 60,
      timeZone = 'UTC',
      category,
      fromTime
    } = req.query;

    // Users can only check their own availability
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const startFrom = fromTime ? new Date(fromTime) : new Date();
    const duration = parseInt(durationMinutes);

    // Get user's active availabilities
    const userAvailabilities = Array.from(availabilityStore.values())
      .filter(a => 
        a.userId === userId && 
        a.status === 'active' &&
        (!category || a.category === category)
      );

    if (userAvailabilities.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active availability found',
        code: 'NO_AVAILABILITY'
      });
    }

    // Find next available slot
    const searchEndDate = new Date(startFrom.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    let nextSlot = null;

    for (const availability of userAvailabilities) {
      const instances = availability.generateInstances(startFrom, searchEndDate);
      
      for (const instance of instances) {
        const slotStart = calendarService.combineDateTimeInTimeZone(
          instance.date,
          instance.startTime,
          timeZone
        );
        const slotEnd = calendarService.combineDateTimeInTimeZone(
          instance.date,
          instance.endTime,
          timeZone
        );

        // Skip slots that are in the past
        if (slotStart < startFrom) continue;

        // Check if there's enough duration
        const availableDuration = calendarService.calculateDuration(slotStart, slotEnd);
        if (availableDuration >= duration) {
          const candidateSlot = {
            availabilityId: availability.id,
            userId: availability.userId,
            start: slotStart,
            end: new Date(slotStart.getTime() + (duration * 60 * 1000)),
            timeZone,
            category: availability.category,
            hourlyRate: availability.hourlyRate,
            currency: availability.currency
          };

          if (!nextSlot || candidateSlot.start < nextSlot.start) {
            nextSlot = candidateSlot;
          }
        }
      }
    }

    if (!nextSlot) {
      return res.status(404).json({
        success: false,
        error: 'No available slots found in the next 30 days',
        code: 'NO_SLOTS_AVAILABLE'
      });
    }

    res.json({
      success: true,
      data: nextSlot,
      searchCriteria: {
        userId,
        durationMinutes: duration,
        timeZone,
        category,
        fromTime: startFrom
      }
    });

  } catch (error) {
    console.error('Get next available slot error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get next available slot',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Convert availability times to different timezone
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function convertAvailabilityTimezone(req, res) {
  try {
    const { id } = req.params;
    const { targetTimeZone } = req.query;

    if (!targetTimeZone) {
      return res.status(400).json({
        success: false,
        error: 'Target timezone is required',
        code: 'MISSING_TIMEZONE'
      });
    }

    const availability = availabilityStore.get(id);
    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'Availability not found',
        code: 'NOT_FOUND'
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && availability.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    try {
      // Convert times to target timezone
      const originalData = availability.toJSON();
      
      // For demonstration, create a sample date to show time conversion
      const sampleDate = availability.startDate || new Date().toISOString().split('T')[0];
      const originalStartDateTime = calendarService.combineDateTimeInTimeZone(
        sampleDate,
        availability.startTime,
        availability.timeZone
      );
      const originalEndDateTime = calendarService.combineDateTimeInTimeZone(
        sampleDate,
        availability.endTime,
        availability.timeZone
      );

      // Convert to target timezone
      const convertedStart = calendarService.convertTimeZone(
        originalStartDateTime,
        availability.timeZone,
        targetTimeZone
      );
      const convertedEnd = calendarService.convertTimeZone(
        originalEndDateTime,
        availability.timeZone,
        targetTimeZone
      );

      // Format converted times
      const convertedStartTime = calendarService.formatDateTime(
        convertedStart,
        targetTimeZone,
        { hour: '2-digit', minute: '2-digit', hour12: false }
      ).split(', ')[1];
      
      const convertedEndTime = calendarService.formatDateTime(
        convertedEnd,
        targetTimeZone,
        { hour: '2-digit', minute: '2-digit', hour12: false }
      ).split(', ')[1];

      res.json({
        success: true,
        data: {
          original: {
            ...originalData,
            sampleDateTime: {
              start: originalStartDateTime,
              end: originalEndDateTime
            }
          },
          converted: {
            ...originalData,
            timeZone: targetTimeZone,
            startTime: convertedStartTime,
            endTime: convertedEndTime,
            sampleDateTime: {
              start: convertedStart,
              end: convertedEnd
            }
          }
        }
      });

    } catch (timezoneError) {
      return res.status(400).json({
        success: false,
        error: `Timezone conversion failed: ${timezoneError.message}`,
        code: 'TIMEZONE_CONVERSION_FAILED'
      });
    }

  } catch (error) {
    console.error('Convert availability timezone error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert timezone',
      code: 'INTERNAL_ERROR'
    });
  }
}

module.exports = {
  createAvailability,
  getAvailabilities,
  getAvailabilityById,
  updateAvailability,
  deleteAvailability,
  getUserAvailability,
  checkAvailabilityConflicts,
  getAvailabilityStats,
  findAvailableSlots,
  bookTimeSlot,
  getNextAvailableSlot,
  convertAvailabilityTimezone,
  AvailabilityControllerError
};