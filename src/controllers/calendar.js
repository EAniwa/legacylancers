/**
 * Calendar Controller
 * Handles calendar events, booking integration, and timezone operations
 */

const { getDatabase } = require('../config/database');
const { calendarService } = require('../services/calendar');
const { 
  createCalendarEventsForBooking,
  updateCalendarEventsForBooking,
  cancelCalendarEventsForBooking,
  getCalendarEventsForBooking,
  hasCalendarEventsForBooking
} = require('../services/bookingCalendarIntegration');

/**
 * Calendar Controller Error Class
 */
class CalendarControllerError extends Error {
  constructor(message, statusCode = 500, code = 'CALENDAR_ERROR') {
    super(message);
    this.name = 'CalendarControllerError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Convert database row to calendar event object
 * @param {Object} row - Database row
 * @returns {Object} Calendar event object
 */
function dbRowToCalendarEvent(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: row.start_time,
    endTime: row.end_time,
    timeZone: row.time_zone,
    isAllDay: row.is_all_day,
    isRecurring: row.is_recurring,
    recurringPattern: row.recurring_pattern,
    bookingId: row.booking_id,
    availabilityId: row.availability_id,
    source: row.source,
    visibility: row.visibility,
    externalEventId: row.external_event_id,
    externalCalendarId: row.external_calendar_id,
    meetingUrl: row.meeting_url,
    meetingId: row.meeting_id,
    meetingPassword: row.meeting_password,
    status: row.status,
    reminderMinutes: row.reminder_minutes,
    attendees: row.attendees,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by
  };
}

/**
 * Get calendar events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCalendarEvents(req, res) {
  try {
    const {
      startDate,
      endDate,
      userId,
      status = 'confirmed',
      source,
      visibility = 'private',
      includeBookings = 'true',
      timeZone = 'UTC'
    } = req.query;

    const db = getDatabase();
    
    let query = `
      SELECT ce.*, b.title as booking_title, a.title as availability_title
      FROM calendar_events ce
      LEFT JOIN bookings b ON ce.booking_id = b.id
      LEFT JOIN availability a ON ce.availability_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // User filter (own events or admin can see all)
    if (req.user.role !== 'admin') {
      paramCount++;
      query += ` AND ce.user_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (userId) {
      paramCount++;
      query += ` AND ce.user_id = $${paramCount}`;
      params.push(userId);
    }

    // Date range filter
    if (startDate && endDate) {
      paramCount++;
      query += ` AND ce.start_time >= $${paramCount} AND ce.end_time <= $${paramCount + 1}`;
      params.push(new Date(startDate), new Date(endDate));
      paramCount++;
    }

    // Status filter
    if (status !== 'all') {
      paramCount++;
      query += ` AND ce.status = $${paramCount}`;
      params.push(status);
    }

    // Source filter
    if (source) {
      paramCount++;
      query += ` AND ce.source = $${paramCount}`;
      params.push(source);
    }

    // Visibility filter
    if (visibility !== 'all') {
      paramCount++;
      query += ` AND ce.visibility = $${paramCount}`;
      params.push(visibility);
    }

    query += ` ORDER BY ce.start_time ASC`;

    const result = await db.query(query, params);
    const events = result.rows.map(row => {
      const event = dbRowToCalendarEvent(row);
      
      // Add related data
      if (row.booking_title) {
        event.booking = { title: row.booking_title };
      }
      if (row.availability_title) {
        event.availability = { title: row.availability_title };
      }
      
      // Convert times to requested timezone
      if (timeZone !== 'UTC') {
        event.localStartTime = calendarService.convertTimeZone(
          new Date(event.startTime), 
          'UTC', 
          timeZone
        );
        event.localEndTime = calendarService.convertTimeZone(
          new Date(event.endTime), 
          'UTC', 
          timeZone
        );
      }
      
      return event;
    });

    res.json({
      success: true,
      data: events,
      filters: {
        startDate,
        endDate,
        userId: req.user.role === 'admin' ? userId : req.user.id,
        status,
        source,
        visibility,
        timeZone
      },
      totalEvents: events.length
    });

  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve calendar events',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Create calendar event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createCalendarEvent(req, res) {
  try {
    const eventData = {
      ...req.body,
      userId: req.user.id,
      createdBy: req.user.id
    };

    // Validate required fields
    if (!eventData.title || !eventData.startTime || !eventData.endTime) {
      return res.status(400).json({
        success: false,
        error: 'Title, start time, and end time are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate time range
    const startTime = new Date(eventData.startTime);
    const endTime = new Date(eventData.endTime);
    
    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        error: 'End time must be after start time',
        code: 'INVALID_TIME_RANGE'
      });
    }

    const db = getDatabase();
    const query = `
      INSERT INTO calendar_events (
        user_id, title, description, location, start_time, end_time, time_zone,
        is_all_day, is_recurring, recurring_pattern, booking_id, availability_id,
        source, visibility, meeting_url, meeting_id, meeting_password, status,
        reminder_minutes, attendees, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;

    const result = await db.query(query, [
      eventData.userId,
      eventData.title,
      eventData.description || null,
      eventData.location || null,
      startTime,
      endTime,
      eventData.timeZone || 'UTC',
      eventData.isAllDay || false,
      eventData.isRecurring || false,
      eventData.recurringPattern || null,
      eventData.bookingId || null,
      eventData.availabilityId || null,
      eventData.source || 'manual',
      eventData.visibility || 'private',
      eventData.meetingUrl || null,
      eventData.meetingId || null,
      eventData.meetingPassword || null,
      eventData.status || 'confirmed',
      eventData.reminderMinutes || null,
      eventData.attendees || null,
      eventData.createdBy
    ]);

    const createdEvent = dbRowToCalendarEvent(result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      data: createdEvent
    });

  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create calendar event',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get calendar event by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getCalendarEventById(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const result = await db.query(
      `SELECT ce.*, b.title as booking_title, a.title as availability_title
       FROM calendar_events ce
       LEFT JOIN bookings b ON ce.booking_id = b.id
       LEFT JOIN availability a ON ce.availability_id = a.id
       WHERE ce.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Calendar event not found',
        code: 'NOT_FOUND'
      });
    }

    const event = dbRowToCalendarEvent(result.rows[0]);
    const row = result.rows[0];

    // Check ownership
    if (req.user.role !== 'admin' && event.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Add related data
    if (row.booking_title) {
      event.booking = { title: row.booking_title };
    }
    if (row.availability_title) {
      event.availability = { title: row.availability_title };
    }

    res.json({
      success: true,
      data: event
    });

  } catch (error) {
    console.error('Get calendar event by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve calendar event',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Update calendar event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if event exists and user has permission
    const existingResult = await db.query(
      'SELECT * FROM calendar_events WHERE id = $1', 
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Calendar event not found',
        code: 'NOT_FOUND'
      });
    }

    const existingEvent = dbRowToCalendarEvent(existingResult.rows[0]);

    if (req.user.role !== 'admin' && existingEvent.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Validate time range if being updated
    if (req.body.startTime || req.body.endTime) {
      const startTime = new Date(req.body.startTime || existingEvent.startTime);
      const endTime = new Date(req.body.endTime || existingEvent.endTime);
      
      if (endTime <= startTime) {
        return res.status(400).json({
          success: false,
          error: 'End time must be after start time',
          code: 'INVALID_TIME_RANGE'
        });
      }
    }

    // Build update query
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    const allowedFields = [
      'title', 'description', 'location', 'start_time', 'end_time', 'time_zone',
      'is_all_day', 'meeting_url', 'meeting_id', 'meeting_password', 'status',
      'reminder_minutes', 'attendees'
    ];

    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (req.body[camelField] !== undefined) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        params.push(req.body[camelField]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        code: 'NO_UPDATE_FIELDS'
      });
    }

    paramCount++;
    const query = `
      UPDATE calendar_events 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    params.push(id);

    const result = await db.query(query, params);
    const updatedEvent = dbRowToCalendarEvent(result.rows[0]);

    res.json({
      success: true,
      message: 'Calendar event updated successfully',
      data: updatedEvent
    });

  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update calendar event',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Delete calendar event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Check if event exists and user has permission
    const existingResult = await db.query(
      'SELECT * FROM calendar_events WHERE id = $1', 
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Calendar event not found',
        code: 'NOT_FOUND'
      });
    }

    const existingEvent = dbRowToCalendarEvent(existingResult.rows[0]);

    if (req.user.role !== 'admin' && existingEvent.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    await db.query('DELETE FROM calendar_events WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Calendar event deleted successfully'
    });

  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete calendar event',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get available timezones
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTimezones(req, res) {
  try {
    const timezones = calendarService.getSupportedTimezones();
    
    res.json({
      success: true,
      data: timezones,
      totalTimezones: timezones.length
    });

  } catch (error) {
    console.error('Get timezones error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve timezones',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Convert time between timezones
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function convertTimezone(req, res) {
  try {
    const { dateTime, fromTimeZone, toTimeZone } = req.body;

    if (!dateTime || !fromTimeZone || !toTimeZone) {
      return res.status(400).json({
        success: false,
        error: 'DateTime, fromTimeZone, and toTimeZone are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    try {
      const originalDate = new Date(dateTime);
      const convertedDate = calendarService.convertTimeZone(
        originalDate, 
        fromTimeZone, 
        toTimeZone
      );

      res.json({
        success: true,
        data: {
          original: {
            dateTime: originalDate,
            timeZone: fromTimeZone,
            formatted: calendarService.formatDateTime(originalDate, fromTimeZone)
          },
          converted: {
            dateTime: convertedDate,
            timeZone: toTimeZone,
            formatted: calendarService.formatDateTime(convertedDate, toTimeZone)
          }
        }
      });

    } catch (conversionError) {
      return res.status(400).json({
        success: false,
        error: `Timezone conversion failed: ${conversionError.message}`,
        code: 'TIMEZONE_CONVERSION_FAILED'
      });
    }

  } catch (error) {
    console.error('Convert timezone error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert timezone',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Create calendar event from booking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createEventFromBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const db = getDatabase();
    
    // Get booking details
    const bookingResult = await db.query(
      `SELECT b.*, u.name as client_name, p.name as provider_name 
       FROM bookings b
       JOIN users u ON b.client_id = u.id
       JOIN users p ON b.provider_id = p.id
       WHERE b.id = $1`,
      [bookingId]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND'
      });
    }

    const booking = bookingResult.rows[0];
    
    // Check permission (user must be part of the booking)
    if (req.user.role !== 'admin' && 
        booking.client_id !== req.user.id && 
        booking.provider_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Check if calendar event already exists for this booking
    const existingEventResult = await db.query(
      'SELECT * FROM calendar_events WHERE booking_id = $1 AND user_id = $2',
      [bookingId, req.user.id]
    );

    if (existingEventResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Calendar event already exists for this booking',
        code: 'EVENT_ALREADY_EXISTS'
      });
    }

    // Create calendar event
    const eventData = {
      title: `${booking.title} - ${req.user.id === booking.client_id ? booking.provider_name : booking.client_name}`,
      description: booking.description || `Booking session: ${booking.title}`,
      startTime: booking.start_time,
      endTime: booking.end_time,
      timeZone: booking.time_zone || 'UTC',
      bookingId: booking.id,
      source: 'booking',
      status: booking.status === 'confirmed' ? 'confirmed' : 'tentative',
      meetingUrl: booking.meeting_url,
      attendees: [
        {
          email: req.user.email,
          name: req.user.name,
          status: 'accepted',
          role: req.user.id === booking.client_id ? 'client' : 'provider'
        }
      ]
    };

    const query = `
      INSERT INTO calendar_events (
        user_id, title, description, start_time, end_time, time_zone,
        booking_id, source, status, meeting_url, attendees, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await db.query(query, [
      req.user.id,
      eventData.title,
      eventData.description,
      eventData.startTime,
      eventData.endTime,
      eventData.timeZone,
      eventData.bookingId,
      eventData.source,
      eventData.status,
      eventData.meetingUrl,
      JSON.stringify(eventData.attendees),
      req.user.id
    ]);

    const createdEvent = dbRowToCalendarEvent(result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Calendar event created from booking successfully',
      data: createdEvent
    });

  } catch (error) {
    console.error('Create event from booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create calendar event from booking',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Placeholder functions for remaining endpoints
async function updateEventFromBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const db = getDatabase();
    
    // Get booking details
    const bookingResult = await db.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND'
      });
    }

    const booking = bookingResult.rows[0];
    
    // Check permission
    if (req.user.role !== 'admin' && 
        booking.client_id !== req.user.id && 
        booking.provider_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Check if events exist
    const hasEvents = await hasCalendarEventsForBooking(bookingId);
    if (!hasEvents) {
      return res.status(404).json({
        success: false,
        error: 'No calendar events found for this booking',
        code: 'EVENTS_NOT_FOUND'
      });
    }

    // Update events with changes from request body
    const result = await updateCalendarEventsForBooking(booking, req.body);

    res.json({
      success: true,
      message: 'Calendar events updated successfully',
      data: result
    });

  } catch (error) {
    console.error('Update event from booking error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to update calendar event from booking',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}

async function cancelEventFromBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const db = getDatabase();
    
    // Get booking details
    const bookingResult = await db.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND'
      });
    }

    const booking = bookingResult.rows[0];
    
    // Check permission
    if (req.user.role !== 'admin' && 
        booking.client_id !== req.user.id && 
        booking.provider_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Cancel calendar events
    const result = await cancelCalendarEventsForBooking(bookingId);

    res.json({
      success: true,
      message: 'Calendar events cancelled successfully',
      data: result
    });

  } catch (error) {
    console.error('Cancel event from booking error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Failed to cancel calendar event from booking',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}

async function getCalendarSyncStatus(req, res) {
  res.status(501).json({
    success: false,
    error: 'Not yet implemented',
    code: 'NOT_IMPLEMENTED'
  });
}

async function syncExternalCalendar(req, res) {
  res.status(501).json({
    success: false,
    error: 'Not yet implemented',
    code: 'NOT_IMPLEMENTED'
  });
}

async function getAvailabilityCalendar(req, res) {
  res.status(501).json({
    success: false,
    error: 'Not yet implemented',
    code: 'NOT_IMPLEMENTED'
  });
}

async function blockTime(req, res) {
  res.status(501).json({
    success: false,
    error: 'Not yet implemented',
    code: 'NOT_IMPLEMENTED'
  });
}

module.exports = {
  getCalendarEvents,
  createCalendarEvent,
  getCalendarEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
  getTimezones,
  convertTimezone,
  createEventFromBooking,
  updateEventFromBooking,
  cancelEventFromBooking,
  getCalendarSyncStatus,
  syncExternalCalendar,
  getAvailabilityCalendar,
  blockTime,
  CalendarControllerError
};