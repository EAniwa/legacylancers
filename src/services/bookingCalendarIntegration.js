/**
 * Booking-Calendar Integration Service
 * Automatically creates, updates, and cancels calendar events based on booking changes
 */

const { getDatabase } = require('../config/database');
const { calendarService } = require('./calendar');

/**
 * Integration Error Class
 */
class BookingCalendarIntegrationError extends Error {
  constructor(message, statusCode = 500, code = 'INTEGRATION_ERROR') {
    super(message);
    this.name = 'BookingCalendarIntegrationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Create calendar events for both client and provider when booking is confirmed
 * @param {Object} booking - Booking object
 * @returns {Promise<Object>} Created calendar events
 */
async function createCalendarEventsForBooking(booking) {
  const db = getDatabase();
  
  try {
    // Get user details for attendees
    const usersResult = await db.query(
      `SELECT id, email, name FROM users WHERE id IN ($1, $2)`,
      [booking.client_id, booking.provider_id]
    );
    
    if (usersResult.rows.length !== 2) {
      throw new BookingCalendarIntegrationError(
        'Could not find client or provider users',
        404,
        'USERS_NOT_FOUND'
      );
    }

    const users = usersResult.rows.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    const client = users[booking.client_id];
    const provider = users[booking.provider_id];

    const events = [];

    // Create calendar event for client
    const clientEventData = {
      title: `Session: ${booking.title}`,
      description: `Session with ${provider.name}\n\n${booking.description || ''}`,
      startTime: booking.start_time,
      endTime: booking.end_time,
      timeZone: booking.time_zone || 'UTC',
      bookingId: booking.id,
      source: 'booking',
      status: booking.status === 'confirmed' ? 'confirmed' : 'tentative',
      meetingUrl: booking.meeting_url,
      attendees: [
        {
          email: client.email,
          name: client.name,
          status: 'accepted',
          role: 'client'
        },
        {
          email: provider.email,
          name: provider.name,
          status: 'accepted',
          role: 'provider'
        }
      ]
    };

    // Create calendar event for provider
    const providerEventData = {
      title: `Session: ${booking.title}`,
      description: `Session with ${client.name}\n\n${booking.description || ''}`,
      startTime: booking.start_time,
      endTime: booking.end_time,
      timeZone: booking.time_zone || 'UTC',
      bookingId: booking.id,
      source: 'booking',
      status: booking.status === 'confirmed' ? 'confirmed' : 'tentative',
      meetingUrl: booking.meeting_url,
      attendees: [
        {
          email: client.email,
          name: client.name,
          status: 'accepted',
          role: 'client'
        },
        {
          email: provider.email,
          name: provider.name,
          status: 'accepted',
          role: 'provider'
        }
      ]
    };

    // Create client calendar event
    const clientEventResult = await db.query(`
      INSERT INTO calendar_events (
        user_id, title, description, start_time, end_time, time_zone,
        booking_id, source, status, meeting_url, attendees, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      client.id,
      clientEventData.title,
      clientEventData.description,
      clientEventData.startTime,
      clientEventData.endTime,
      clientEventData.timeZone,
      clientEventData.bookingId,
      clientEventData.source,
      clientEventData.status,
      clientEventData.meetingUrl,
      JSON.stringify(clientEventData.attendees),
      client.id
    ]);

    events.push({
      userId: client.id,
      event: clientEventResult.rows[0]
    });

    // Create provider calendar event
    const providerEventResult = await db.query(`
      INSERT INTO calendar_events (
        user_id, title, description, start_time, end_time, time_zone,
        booking_id, source, status, meeting_url, attendees, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      provider.id,
      providerEventData.title,
      providerEventData.description,
      providerEventData.startTime,
      providerEventData.endTime,
      providerEventData.timeZone,
      providerEventData.bookingId,
      providerEventData.source,
      providerEventData.status,
      providerEventData.meetingUrl,
      JSON.stringify(providerEventData.attendees),
      provider.id
    ]);

    events.push({
      userId: provider.id,
      event: providerEventResult.rows[0]
    });

    return {
      success: true,
      events,
      bookingId: booking.id
    };

  } catch (error) {
    console.error('Create calendar events for booking error:', error);
    throw new BookingCalendarIntegrationError(
      `Failed to create calendar events: ${error.message}`,
      500,
      'CREATION_FAILED'
    );
  }
}

/**
 * Update calendar events when booking is modified
 * @param {Object} booking - Updated booking object
 * @param {Object} changes - Object containing changed fields
 * @returns {Promise<Object>} Updated calendar events
 */
async function updateCalendarEventsForBooking(booking, changes) {
  const db = getDatabase();
  
  try {
    // Get existing calendar events for this booking
    const existingEventsResult = await db.query(
      'SELECT * FROM calendar_events WHERE booking_id = $1',
      [booking.id]
    );

    if (existingEventsResult.rows.length === 0) {
      throw new BookingCalendarIntegrationError(
        'No calendar events found for this booking',
        404,
        'EVENTS_NOT_FOUND'
      );
    }

    const updatedEvents = [];
    const updateFields = [];
    const updateParams = [];
    let paramCount = 0;

    // Build update query based on changes
    if (changes.title) {
      paramCount++;
      updateFields.push(`title = $${paramCount}`);
      updateParams.push(`Session: ${changes.title}`);
    }

    if (changes.description !== undefined) {
      // Need to get user info to rebuild description
      const usersResult = await db.query(
        `SELECT id, name FROM users WHERE id IN ($1, $2)`,
        [booking.client_id, booking.provider_id]
      );
      
      const users = usersResult.rows.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      // Update description for each event with appropriate perspective
      for (const eventRow of existingEventsResult.rows) {
        const isClientEvent = eventRow.user_id === booking.client_id;
        const otherUser = isClientEvent ? users[booking.provider_id] : users[booking.client_id];
        
        const newDescription = `Session with ${otherUser.name}\n\n${changes.description || ''}`;
        
        await db.query(
          'UPDATE calendar_events SET description = $1 WHERE id = $2',
          [newDescription, eventRow.id]
        );
      }
    }

    if (changes.start_time) {
      paramCount++;
      updateFields.push(`start_time = $${paramCount}`);
      updateParams.push(changes.start_time);
    }

    if (changes.end_time) {
      paramCount++;
      updateFields.push(`end_time = $${paramCount}`);
      updateParams.push(changes.end_time);
    }

    if (changes.time_zone) {
      paramCount++;
      updateFields.push(`time_zone = $${paramCount}`);
      updateParams.push(changes.time_zone);
    }

    if (changes.status) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateParams.push(changes.status === 'confirmed' ? 'confirmed' : 'tentative');
    }

    if (changes.meeting_url !== undefined) {
      paramCount++;
      updateFields.push(`meeting_url = $${paramCount}`);
      updateParams.push(changes.meeting_url);
    }

    // Apply updates if there are any
    if (updateFields.length > 0) {
      paramCount++;
      const updateQuery = `
        UPDATE calendar_events 
        SET ${updateFields.join(', ')} 
        WHERE booking_id = $${paramCount}
        RETURNING *
      `;
      updateParams.push(booking.id);

      const updateResult = await db.query(updateQuery, updateParams);
      updatedEvents.push(...updateResult.rows);
    }

    return {
      success: true,
      events: updatedEvents,
      bookingId: booking.id,
      changes
    };

  } catch (error) {
    console.error('Update calendar events for booking error:', error);
    throw new BookingCalendarIntegrationError(
      `Failed to update calendar events: ${error.message}`,
      500,
      'UPDATE_FAILED'
    );
  }
}

/**
 * Cancel calendar events when booking is cancelled
 * @param {number} bookingId - Booking ID
 * @returns {Promise<Object>} Cancelled calendar events
 */
async function cancelCalendarEventsForBooking(bookingId) {
  const db = getDatabase();
  
  try {
    // Update calendar events to cancelled status
    const result = await db.query(`
      UPDATE calendar_events 
      SET status = 'cancelled'
      WHERE booking_id = $1
      RETURNING *
    `, [bookingId]);

    if (result.rows.length === 0) {
      throw new BookingCalendarIntegrationError(
        'No calendar events found for this booking',
        404,
        'EVENTS_NOT_FOUND'
      );
    }

    return {
      success: true,
      events: result.rows,
      bookingId
    };

  } catch (error) {
    console.error('Cancel calendar events for booking error:', error);
    throw new BookingCalendarIntegrationError(
      `Failed to cancel calendar events: ${error.message}`,
      500,
      'CANCELLATION_FAILED'
    );
  }
}

/**
 * Delete calendar events when booking is permanently deleted
 * @param {number} bookingId - Booking ID
 * @returns {Promise<Object>} Deleted calendar events info
 */
async function deleteCalendarEventsForBooking(bookingId) {
  const db = getDatabase();
  
  try {
    // Get events before deleting for return info
    const existingEventsResult = await db.query(
      'SELECT id, user_id FROM calendar_events WHERE booking_id = $1',
      [bookingId]
    );

    // Delete calendar events
    const result = await db.query(
      'DELETE FROM calendar_events WHERE booking_id = $1',
      [bookingId]
    );

    return {
      success: true,
      deletedCount: result.rowCount,
      deletedEvents: existingEventsResult.rows,
      bookingId
    };

  } catch (error) {
    console.error('Delete calendar events for booking error:', error);
    throw new BookingCalendarIntegrationError(
      `Failed to delete calendar events: ${error.message}`,
      500,
      'DELETION_FAILED'
    );
  }
}

/**
 * Sync booking status with calendar event status
 * @param {number} bookingId - Booking ID
 * @returns {Promise<Object>} Sync result
 */
async function syncBookingCalendarStatus(bookingId) {
  const db = getDatabase();
  
  try {
    // Get booking status
    const bookingResult = await db.query(
      'SELECT id, status FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new BookingCalendarIntegrationError(
        'Booking not found',
        404,
        'BOOKING_NOT_FOUND'
      );
    }

    const booking = bookingResult.rows[0];
    const calendarStatus = booking.status === 'confirmed' ? 'confirmed' : 
                          booking.status === 'cancelled' ? 'cancelled' : 'tentative';

    // Update calendar events to match booking status
    const result = await db.query(`
      UPDATE calendar_events 
      SET status = $1
      WHERE booking_id = $2
      RETURNING *
    `, [calendarStatus, bookingId]);

    return {
      success: true,
      bookingStatus: booking.status,
      calendarStatus,
      updatedEvents: result.rows,
      bookingId
    };

  } catch (error) {
    console.error('Sync booking calendar status error:', error);
    throw new BookingCalendarIntegrationError(
      `Failed to sync booking calendar status: ${error.message}`,
      500,
      'SYNC_FAILED'
    );
  }
}

/**
 * Get calendar events for a specific booking
 * @param {number} bookingId - Booking ID
 * @returns {Promise<Array>} Calendar events
 */
async function getCalendarEventsForBooking(bookingId) {
  const db = getDatabase();
  
  try {
    const result = await db.query(`
      SELECT ce.*, u.name as user_name, u.email as user_email
      FROM calendar_events ce
      JOIN users u ON ce.user_id = u.id
      WHERE ce.booking_id = $1
      ORDER BY ce.user_id
    `, [bookingId]);

    return {
      success: true,
      events: result.rows,
      bookingId
    };

  } catch (error) {
    console.error('Get calendar events for booking error:', error);
    throw new BookingCalendarIntegrationError(
      `Failed to get calendar events: ${error.message}`,
      500,
      'RETRIEVAL_FAILED'
    );
  }
}

/**
 * Check if calendar events exist for a booking
 * @param {number} bookingId - Booking ID
 * @returns {Promise<boolean>} Whether events exist
 */
async function hasCalendarEventsForBooking(bookingId) {
  const db = getDatabase();
  
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM calendar_events WHERE booking_id = $1',
      [bookingId]
    );

    return parseInt(result.rows[0].count) > 0;

  } catch (error) {
    console.error('Check calendar events for booking error:', error);
    return false;
  }
}

/**
 * Booking lifecycle hooks for automatic calendar integration
 */
const bookingHooks = {
  /**
   * Called when booking is confirmed
   * @param {Object} booking - Booking object
   */
  async onBookingConfirmed(booking) {
    try {
      const hasEvents = await hasCalendarEventsForBooking(booking.id);
      if (!hasEvents) {
        await createCalendarEventsForBooking(booking);
      } else {
        // Update existing events to confirmed status
        await syncBookingCalendarStatus(booking.id);
      }
    } catch (error) {
      console.error('Booking confirmed hook error:', error);
      // Don't throw - booking confirmation should succeed even if calendar fails
    }
  },

  /**
   * Called when booking is updated
   * @param {Object} booking - Updated booking object
   * @param {Object} changes - Changed fields
   */
  async onBookingUpdated(booking, changes) {
    try {
      const hasEvents = await hasCalendarEventsForBooking(booking.id);
      if (hasEvents) {
        await updateCalendarEventsForBooking(booking, changes);
      }
    } catch (error) {
      console.error('Booking updated hook error:', error);
      // Don't throw - booking update should succeed even if calendar fails
    }
  },

  /**
   * Called when booking is cancelled
   * @param {number} bookingId - Booking ID
   */
  async onBookingCancelled(bookingId) {
    try {
      await cancelCalendarEventsForBooking(bookingId);
    } catch (error) {
      console.error('Booking cancelled hook error:', error);
      // Don't throw - booking cancellation should succeed even if calendar fails
    }
  },

  /**
   * Called when booking is deleted
   * @param {number} bookingId - Booking ID
   */
  async onBookingDeleted(bookingId) {
    try {
      await deleteCalendarEventsForBooking(bookingId);
    } catch (error) {
      console.error('Booking deleted hook error:', error);
      // Don't throw - booking deletion should succeed even if calendar fails
    }
  }
};

module.exports = {
  createCalendarEventsForBooking,
  updateCalendarEventsForBooking,
  cancelCalendarEventsForBooking,
  deleteCalendarEventsForBooking,
  syncBookingCalendarStatus,
  getCalendarEventsForBooking,
  hasCalendarEventsForBooking,
  bookingHooks,
  BookingCalendarIntegrationError
};