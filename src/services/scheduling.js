/**
 * Scheduling Service
 * Handles booking logic, conflict resolution, and availability management
 */

const { Availability, AvailabilityValidationError } = require('../models/Availability');
const { calendarService, CalendarServiceError } = require('./calendar');

/**
 * Scheduling Service Error Class
 */
class SchedulingServiceError extends Error {
  constructor(message, code = 'SCHEDULING_ERROR', data = null) {
    super(message);
    this.name = 'SchedulingServiceError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Scheduling Service Class
 */
class SchedulingService {
  constructor() {
    // In-memory storage for bookings (in production, this would be database)
    this.bookings = new Map();
    this.nextBookingId = 1;
  }

  /**
   * Check if a time slot is available for booking
   * @param {Object} availability - Availability object
   * @param {Date} startTime - Desired start time
   * @param {Date} endTime - Desired end time
   * @param {string} timeZone - Time zone for the booking
   * @returns {Object} Availability check result
   */
  checkSlotAvailability(availability, startTime, endTime, timeZone = 'UTC') {
    const result = {
      available: false,
      reason: null,
      suggestedTimes: [],
      conflictingBookings: []
    };

    try {
      // Validate time zone
      if (!calendarService.isValidTimeZone(timeZone)) {
        result.reason = `Invalid time zone: ${timeZone}`;
        return result;
      }

      // Check if availability is bookable
      const bookabilityCheck = availability.isBookable(new Date(), startTime);
      if (!bookabilityCheck.bookable) {
        result.reason = bookabilityCheck.reason;
        return result;
      }

      // Check for existing booking conflicts
      const conflicts = this.findConflictingBookings(availability.id, startTime, endTime);
      if (conflicts.length > 0) {
        result.reason = 'Time slot conflicts with existing bookings';
        result.conflictingBookings = conflicts;
        return result;
      }

      // Check capacity
      if (availability.currentBookings >= availability.maxBookings) {
        result.reason = 'Maximum booking capacity reached';
        return result;
      }

      // Check minimum advance notice
      const timeDiff = startTime.getTime() - Date.now();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      if (hoursDiff < availability.minimumNoticeHours) {
        result.reason = `Booking requires at least ${availability.minimumNoticeHours} hours advance notice`;
        return result;
      }

      // Check maximum advance booking
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      if (daysDiff > availability.maximumAdvanceDays) {
        result.reason = `Booking cannot be made more than ${availability.maximumAdvanceDays} days in advance`;
        return result;
      }

      // Check if booking falls within availability time window
      const availabilityStart = calendarService.combineDateTimeInTimeZone(
        availability.startDate,
        availability.startTime,
        availability.timeZone
      );
      const availabilityEnd = calendarService.combineDateTimeInTimeZone(
        availability.endDate || availability.startDate,
        availability.endTime,
        availability.timeZone
      );

      // Convert booking times to availability time zone for comparison
      const bookingStartInAvailTZ = calendarService.convertTimeZone(
        startTime, 
        timeZone, 
        availability.timeZone
      );
      const bookingEndInAvailTZ = calendarService.convertTimeZone(
        endTime, 
        timeZone, 
        availability.timeZone
      );

      if (bookingStartInAvailTZ < availabilityStart || bookingEndInAvailTZ > availabilityEnd) {
        result.reason = 'Booking time is outside availability window';
        
        // Suggest alternative times
        result.suggestedTimes = this.suggestAlternativeTimes(
          availability, 
          startTime, 
          endTime, 
          timeZone
        );
        return result;
      }

      result.available = true;
      return result;

    } catch (error) {
      result.reason = `Availability check failed: ${error.message}`;
      return result;
    }
  }

  /**
   * Find conflicting bookings for an availability slot
   * @param {string} availabilityId - Availability ID
   * @param {Date} startTime - Booking start time
   * @param {Date} endTime - Booking end time
   * @returns {Array} Conflicting bookings
   */
  findConflictingBookings(availabilityId, startTime, endTime) {
    const conflicts = [];
    
    for (const booking of this.bookings.values()) {
      if (booking.availabilityId === availabilityId && 
          booking.status !== 'cancelled' &&
          calendarService.timeRangesOverlap(
            { start: startTime, end: endTime },
            { start: booking.startTime, end: booking.endTime }
          )) {
        conflicts.push(booking);
      }
    }

    return conflicts;
  }

  /**
   * Suggest alternative booking times
   * @param {Object} availability - Availability object
   * @param {Date} desiredStart - Desired start time
   * @param {Date} desiredEnd - Desired end time
   * @param {string} timeZone - Booking time zone
   * @returns {Array} Suggested alternative times
   */
  suggestAlternativeTimes(availability, desiredStart, desiredEnd, timeZone) {
    const duration = calendarService.calculateDuration(desiredStart, desiredEnd);
    const suggestions = [];

    try {
      // Look for slots in the next 7 days
      const searchStart = new Date();
      const searchEnd = new Date(searchStart.getTime() + (7 * 24 * 60 * 60 * 1000));

      // Get existing bookings for this availability
      const existingBookings = Array.from(this.bookings.values())
        .filter(booking => booking.availabilityId === availability.id && booking.status !== 'cancelled')
        .map(booking => ({
          start: booking.startTime,
          end: booking.endTime
        }));

      // Generate available slots
      const availableSlots = calendarService.findAvailableSlots({
        startDate: searchStart,
        endDate: searchEnd,
        durationMinutes: duration,
        busySlots: existingBookings,
        timeZone: availability.timeZone,
        availableHours: [{
          start: availability.startTime,
          end: availability.endTime
        }]
      });

      // Convert first 5 slots to the requested time zone
      for (let i = 0; i < Math.min(5, availableSlots.length); i++) {
        const slot = availableSlots[i];
        suggestions.push({
          start: calendarService.convertTimeZone(slot.start, availability.timeZone, timeZone),
          end: calendarService.convertTimeZone(slot.end, availability.timeZone, timeZone),
          timeZone
        });
      }

    } catch (error) {
      console.warn('Failed to generate alternative times:', error);
    }

    return suggestions;
  }

  /**
   * Create a new booking
   * @param {Object} bookingData - Booking information
   * @returns {Object} Created booking
   */
  createBooking(bookingData) {
    const {
      availabilityId,
      bookedBy,
      startTime,
      endTime,
      timeZone,
      notes,
      attendeeInfo
    } = bookingData;

    // Validate required fields
    if (!availabilityId || !bookedBy || !startTime || !endTime) {
      throw new SchedulingServiceError(
        'Missing required booking fields',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const bookingId = (this.nextBookingId++).toString();
    const booking = {
      id: bookingId,
      availabilityId,
      bookedBy,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timeZone: timeZone || 'UTC',
      duration: calendarService.calculateDuration(startTime, endTime),
      notes: notes || '',
      attendeeInfo: attendeeInfo || {},
      status: 'pending', // 'pending', 'confirmed', 'cancelled', 'completed'
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.bookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Confirm a booking
   * @param {string} bookingId - Booking ID
   * @param {string} confirmedBy - User who confirmed the booking
   * @returns {Object} Updated booking
   */
  confirmBooking(bookingId, confirmedBy) {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new SchedulingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status !== 'pending') {
      throw new SchedulingServiceError(
        `Cannot confirm booking with status: ${booking.status}`,
        'INVALID_BOOKING_STATUS'
      );
    }

    booking.status = 'confirmed';
    booking.confirmedBy = confirmedBy;
    booking.confirmedAt = new Date();
    booking.updatedAt = new Date();

    this.bookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Cancel a booking
   * @param {string} bookingId - Booking ID
   * @param {string} cancelledBy - User who cancelled the booking
   * @param {string} reason - Cancellation reason
   * @returns {Object} Updated booking
   */
  cancelBooking(bookingId, cancelledBy, reason = '') {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new SchedulingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status === 'completed') {
      throw new SchedulingServiceError(
        'Cannot cancel completed booking',
        'CANNOT_CANCEL_COMPLETED'
      );
    }

    booking.status = 'cancelled';
    booking.cancelledBy = cancelledBy;
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;
    booking.updatedAt = new Date();

    this.bookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Get bookings for a specific availability
   * @param {string} availabilityId - Availability ID
   * @param {Object} options - Filter options
   * @returns {Array} Bookings
   */
  getBookingsForAvailability(availabilityId, options = {}) {
    const { status, startDate, endDate } = options;
    
    let bookings = Array.from(this.bookings.values())
      .filter(booking => booking.availabilityId === availabilityId);

    if (status) {
      bookings = bookings.filter(booking => booking.status === status);
    }

    if (startDate) {
      bookings = bookings.filter(booking => booking.startTime >= new Date(startDate));
    }

    if (endDate) {
      bookings = bookings.filter(booking => booking.endTime <= new Date(endDate));
    }

    return bookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Get bookings for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Array} User's bookings
   */
  getUserBookings(userId, options = {}) {
    const { status, startDate, endDate, role = 'bookedBy' } = options;
    
    let bookings = Array.from(this.bookings.values())
      .filter(booking => booking[role] === userId);

    if (status) {
      bookings = bookings.filter(booking => booking.status === status);
    }

    if (startDate) {
      bookings = bookings.filter(booking => booking.startTime >= new Date(startDate));
    }

    if (endDate) {
      bookings = bookings.filter(booking => booking.endTime <= new Date(endDate));
    }

    return bookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Calculate booking statistics
   * @param {string} availabilityId - Availability ID
   * @param {Object} options - Calculation options
   * @returns {Object} Booking statistics
   */
  getBookingStats(availabilityId, options = {}) {
    const { startDate, endDate } = options;
    const bookings = this.getBookingsForAvailability(availabilityId, { startDate, endDate });

    const stats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      totalDuration: bookings.reduce((sum, b) => sum + b.duration, 0),
      averageDuration: 0
    };

    if (stats.total > 0) {
      stats.averageDuration = Math.round(stats.totalDuration / stats.total);
    }

    return stats;
  }

  /**
   * Find optimal meeting times for multiple participants
   * @param {Array} participantAvailabilities - Array of availability objects
   * @param {number} durationMinutes - Meeting duration
   * @param {Date} earliestStart - Earliest possible start time
   * @param {Date} latestEnd - Latest possible end time
   * @param {string} timeZone - Preferred time zone
   * @returns {Array} Optimal meeting times
   */
  findOptimalMeetingTimes(participantAvailabilities, durationMinutes, earliestStart, latestEnd, timeZone = 'UTC') {
    const optimalTimes = [];

    try {
      // Get all busy slots from all participants
      const allBusySlots = [];
      
      for (const availability of participantAvailabilities) {
        const participantBookings = this.getBookingsForAvailability(availability.id, {
          startDate: earliestStart,
          endDate: latestEnd
        }).filter(booking => booking.status !== 'cancelled');

        allBusySlots.push(...participantBookings.map(booking => ({
          start: booking.startTime,
          end: booking.endTime
        })));
      }

      // Find common available time slots
      const commonSlots = calendarService.findAvailableSlots({
        startDate: earliestStart,
        endDate: latestEnd,
        durationMinutes,
        busySlots: allBusySlots,
        timeZone,
        availableHours: [{ start: '09:00', end: '17:00' }] // Default business hours
      });

      // Filter slots that work for all participants
      for (const slot of commonSlots) {
        let worksForAll = true;
        
        for (const availability of participantAvailabilities) {
          // Check if slot falls within participant's availability
          const slotInParticipantTZ = {
            start: calendarService.convertTimeZone(slot.start, timeZone, availability.timeZone),
            end: calendarService.convertTimeZone(slot.end, timeZone, availability.timeZone)
          };

          const availabilityCheck = this.checkSlotAvailability(
            availability,
            slotInParticipantTZ.start,
            slotInParticipantTZ.end,
            availability.timeZone
          );

          if (!availabilityCheck.available) {
            worksForAll = false;
            break;
          }
        }

        if (worksForAll) {
          optimalTimes.push({
            start: slot.start,
            end: slot.end,
            timeZone,
            participants: participantAvailabilities.map(a => a.userId)
          });
        }
      }

    } catch (error) {
      throw new SchedulingServiceError(
        `Failed to find optimal meeting times: ${error.message}`,
        'OPTIMAL_TIME_SEARCH_FAILED'
      );
    }

    return optimalTimes.slice(0, 10); // Return top 10 options
  }

  /**
   * Get booking by ID
   * @param {string} bookingId - Booking ID
   * @returns {Object|null} Booking or null if not found
   */
  getBooking(bookingId) {
    return this.bookings.get(bookingId) || null;
  }

  /**
   * Update booking details
   * @param {string} bookingId - Booking ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated booking
   */
  updateBooking(bookingId, updates) {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new SchedulingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    // Prevent updating certain fields
    const protectedFields = ['id', 'availabilityId', 'bookedBy', 'createdAt'];
    const allowedUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (!protectedFields.includes(key)) {
        allowedUpdates[key] = updates[key];
      }
    });

    Object.assign(booking, allowedUpdates, { updatedAt: new Date() });
    
    // Recalculate duration if times changed
    if (updates.startTime || updates.endTime) {
      booking.duration = calendarService.calculateDuration(booking.startTime, booking.endTime);
    }

    this.bookings.set(bookingId, booking);
    return booking;
  }
}

// Create singleton instance
const schedulingService = new SchedulingService();

module.exports = {
  SchedulingService,
  SchedulingServiceError,
  schedulingService
};