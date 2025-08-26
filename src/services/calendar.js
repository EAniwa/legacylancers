/**
 * Calendar Service
 * Handles time zone conversion, scheduling logic, and calendar operations
 */

/**
 * Calendar Service Error Class
 */
class CalendarServiceError extends Error {
  constructor(message, code = 'CALENDAR_ERROR') {
    super(message);
    this.name = 'CalendarServiceError';
    this.code = code;
  }
}

/**
 * Calendar Service Class
 */
class CalendarService {
  constructor() {
    // Cache for time zone validation
    this.validTimeZones = new Set();
    this.initializeTimeZones();
  }

  /**
   * Initialize valid time zones
   */
  initializeTimeZones() {
    try {
      // Get all supported time zones
      const timeZones = Intl.supportedValuesOf('timeZone');
      this.validTimeZones = new Set(timeZones);
    } catch (error) {
      // Fallback to common time zones if Intl.supportedValuesOf is not available
      const commonTimeZones = [
        'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
        'America/Denver', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
        'Australia/Sydney', 'Australia/Melbourne'
      ];
      this.validTimeZones = new Set(commonTimeZones);
    }
  }

  /**
   * Validate if a time zone is supported
   * @param {string} timeZone - Time zone to validate
   * @returns {boolean} Whether time zone is valid
   */
  isValidTimeZone(timeZone) {
    if (this.validTimeZones.has(timeZone)) {
      return true;
    }

    // Try to create a date with the time zone
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format(new Date());
      this.validTimeZones.add(timeZone); // Cache it
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert time from one timezone to another
   * @param {Date|string} dateTime - Date/time to convert
   * @param {string} fromTimeZone - Source time zone
   * @param {string} toTimeZone - Target time zone
   * @returns {Date} Converted date
   */
  convertTimeZone(dateTime, fromTimeZone, toTimeZone) {
    if (!this.isValidTimeZone(fromTimeZone)) {
      throw new CalendarServiceError(`Invalid source time zone: ${fromTimeZone}`, 'INVALID_SOURCE_TIMEZONE');
    }

    if (!this.isValidTimeZone(toTimeZone)) {
      throw new CalendarServiceError(`Invalid target time zone: ${toTimeZone}`, 'INVALID_TARGET_TIMEZONE');
    }

    try {
      const date = new Date(dateTime);
      
      // Convert to UTC first, then to target timezone
      const utcTime = new Date(date.toLocaleString('en-US', { timeZone: fromTimeZone }));
      const targetTime = new Date(utcTime.toLocaleString('en-US', { timeZone: toTimeZone }));
      
      return targetTime;
    } catch (error) {
      throw new CalendarServiceError(`Time zone conversion failed: ${error.message}`, 'CONVERSION_FAILED');
    }
  }

  /**
   * Get current time in a specific timezone
   * @param {string} timeZone - Target time zone
   * @returns {Date} Current time in specified timezone
   */
  getCurrentTimeInTimeZone(timeZone) {
    if (!this.isValidTimeZone(timeZone)) {
      throw new CalendarServiceError(`Invalid time zone: ${timeZone}`, 'INVALID_TIMEZONE');
    }

    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone }));
  }

  /**
   * Combine date and time string into a Date object in specific timezone
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @param {string} timeStr - Time string (HH:MM)
   * @param {string} timeZone - Time zone
   * @returns {Date} Combined date/time
   */
  combineDateTimeInTimeZone(dateStr, timeStr, timeZone) {
    if (!this.isValidTimeZone(timeZone)) {
      throw new CalendarServiceError(`Invalid time zone: ${timeZone}`, 'INVALID_TIMEZONE');
    }

    try {
      // Create ISO string and parse in timezone
      const isoString = `${dateStr}T${timeStr}:00`;
      const date = new Date(isoString);
      
      // Adjust for timezone offset
      const timeZoneDate = new Date(date.toLocaleString('en-US', { timeZone }));
      return timeZoneDate;
    } catch (error) {
      throw new CalendarServiceError(`Failed to combine date/time: ${error.message}`, 'DATETIME_COMBINATION_FAILED');
    }
  }

  /**
   * Get time zone offset in minutes
   * @param {string} timeZone - Time zone
   * @param {Date} date - Reference date (defaults to now)
   * @returns {number} Offset in minutes from UTC
   */
  getTimeZoneOffset(timeZone, date = new Date()) {
    if (!this.isValidTimeZone(timeZone)) {
      throw new CalendarServiceError(`Invalid time zone: ${timeZone}`, 'INVALID_TIMEZONE');
    }

    try {
      // Get UTC time and local time
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
      const localTime = new Date(utcTime + (this.getTimeZoneOffsetMs(timeZone, date)));
      
      return (localTime.getTime() - utcTime) / 60000;
    } catch (error) {
      throw new CalendarServiceError(`Failed to get timezone offset: ${error.message}`, 'OFFSET_CALCULATION_FAILED');
    }
  }

  /**
   * Get time zone offset in milliseconds
   * @param {string} timeZone - Time zone
   * @param {Date} date - Reference date
   * @returns {number} Offset in milliseconds
   */
  getTimeZoneOffsetMs(timeZone, date) {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
    return tzDate.getTime() - utcDate.getTime();
  }

  /**
   * Check if two time ranges overlap
   * @param {Object} range1 - First time range
   * @param {Object} range2 - Second time range
   * @returns {boolean} Whether ranges overlap
   */
  timeRangesOverlap(range1, range2) {
    const start1 = new Date(range1.start);
    const end1 = new Date(range1.end);
    const start2 = new Date(range2.start);
    const end2 = new Date(range2.end);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Find available time slots in a given period
   * @param {Object} params - Parameters for finding slots
   * @param {Date} params.startDate - Start of period
   * @param {Date} params.endDate - End of period
   * @param {number} params.durationMinutes - Required slot duration
   * @param {Array} params.busySlots - Already booked time slots
   * @param {Array} params.availableHours - Available hours per day (optional)
   * @param {string} params.timeZone - Time zone for calculations
   * @returns {Array<Object>} Available time slots
   */
  findAvailableSlots(params) {
    const {
      startDate,
      endDate,
      durationMinutes,
      busySlots = [],
      availableHours = [{ start: '09:00', end: '17:00' }], // Default 9-5
      timeZone = 'UTC',
      bufferMinutes = 0
    } = params;

    if (!this.isValidTimeZone(timeZone)) {
      throw new CalendarServiceError(`Invalid time zone: ${timeZone}`, 'INVALID_TIMEZONE');
    }

    const availableSlots = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const daySlots = this.findDayAvailableSlots({
        date: new Date(current),
        durationMinutes,
        busySlots,
        availableHours,
        timeZone,
        bufferMinutes
      });

      availableSlots.push(...daySlots);
      current.setDate(current.getDate() + 1);
    }

    return availableSlots;
  }

  /**
   * Find available slots for a specific day
   * @param {Object} params - Day slot parameters
   * @returns {Array<Object>} Available slots for the day
   */
  findDayAvailableSlots(params) {
    const {
      date,
      durationMinutes,
      busySlots,
      availableHours,
      timeZone,
      bufferMinutes
    } = params;

    const daySlots = [];
    const dateStr = date.toISOString().split('T')[0];

    for (const hours of availableHours) {
      const dayStart = this.combineDateTimeInTimeZone(dateStr, hours.start, timeZone);
      const dayEnd = this.combineDateTimeInTimeZone(dateStr, hours.end, timeZone);

      const slots = this.generateTimeSlots(
        dayStart,
        dayEnd,
        durationMinutes,
        busySlots,
        bufferMinutes
      );

      daySlots.push(...slots);
    }

    return daySlots;
  }

  /**
   * Generate time slots within a range, avoiding busy slots
   * @param {Date} rangeStart - Start of range
   * @param {Date} rangeEnd - End of range
   * @param {number} durationMinutes - Slot duration
   * @param {Array} busySlots - Busy time slots
   * @param {number} bufferMinutes - Buffer between slots
   * @returns {Array<Object>} Generated time slots
   */
  generateTimeSlots(rangeStart, rangeEnd, durationMinutes, busySlots, bufferMinutes) {
    const slots = [];
    const slotDuration = durationMinutes + bufferMinutes;
    let current = new Date(rangeStart);

    while (current.getTime() + (durationMinutes * 60000) <= rangeEnd.getTime()) {
      const slotEnd = new Date(current.getTime() + (durationMinutes * 60000));
      
      // Check if this slot conflicts with busy slots
      const hasConflict = busySlots.some(busySlot => {
        return this.timeRangesOverlap(
          { start: current, end: slotEnd },
          { start: new Date(busySlot.start), end: new Date(busySlot.end) }
        );
      });

      if (!hasConflict) {
        slots.push({
          start: new Date(current),
          end: new Date(slotEnd),
          duration: durationMinutes
        });
      }

      // Move to next slot
      current = new Date(current.getTime() + (slotDuration * 60000));
    }

    return slots;
  }

  /**
   * Calculate meeting duration between two times
   * @param {Date|string} startTime - Start time
   * @param {Date|string} endTime - End time
   * @returns {number} Duration in minutes
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (end <= start) {
      throw new CalendarServiceError('End time must be after start time', 'INVALID_TIME_RANGE');
    }

    return (end.getTime() - start.getTime()) / (1000 * 60);
  }

  /**
   * Get business days between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Array<number>} excludeWeekdays - Weekdays to exclude (0=Sunday, 6=Saturday)
   * @returns {Array<Date>} Business days
   */
  getBusinessDays(startDate, endDate, excludeWeekdays = [0, 6]) {
    const businessDays = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      if (!excludeWeekdays.includes(current.getDay())) {
        businessDays.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return businessDays;
  }

  /**
   * Format date/time for display in specific timezone
   * @param {Date} date - Date to format
   * @param {string} timeZone - Display timezone
   * @param {Object} options - Formatting options
   * @returns {string} Formatted date/time string
   */
  formatDateTime(date, timeZone = 'UTC', options = {}) {
    if (!this.isValidTimeZone(timeZone)) {
      throw new CalendarServiceError(`Invalid time zone: ${timeZone}`, 'INVALID_TIMEZONE');
    }

    const defaultOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
      hour12: false
    };

    const formatOptions = { ...defaultOptions, ...options };

    try {
      return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (error) {
      throw new CalendarServiceError(`Date formatting failed: ${error.message}`, 'FORMAT_FAILED');
    }
  }

  /**
   * Parse recurring pattern to generate specific dates
   * @param {Object} pattern - Recurrence pattern
   * @param {Date} startDate - Pattern start date
   * @param {Date} endDate - Pattern end date
   * @returns {Array<Date>} Generated dates
   */
  generateRecurringDates(pattern, startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      switch (pattern.type) {
        case 'daily':
          dates.push(new Date(current));
          current.setDate(current.getDate() + (pattern.interval || 1));
          break;

        case 'weekly':
          if (pattern.daysOfWeek && pattern.daysOfWeek.includes(current.getDay())) {
            dates.push(new Date(current));
          }
          current.setDate(current.getDate() + 1);
          break;

        case 'monthly':
          if (current.getDate() === pattern.dayOfMonth) {
            dates.push(new Date(current));
          }
          current.setDate(current.getDate() + 1);
          if (current.getDate() === 1) {
            // Reset to correct day of month for next month
            current.setDate(pattern.dayOfMonth);
          }
          break;

        default:
          throw new CalendarServiceError(`Unsupported recurrence type: ${pattern.type}`, 'UNSUPPORTED_RECURRENCE');
      }
    }

    return dates;
  }

  /**
   * Check if a specific time slot is within business hours
   * @param {Date} dateTime - Date/time to check
   * @param {Object} businessHours - Business hours definition
   * @param {string} timeZone - Timezone for business hours
   * @returns {boolean} Whether time is within business hours
   */
  isWithinBusinessHours(dateTime, businessHours, timeZone = 'UTC') {
    if (!this.isValidTimeZone(timeZone)) {
      throw new CalendarServiceError(`Invalid time zone: ${timeZone}`, 'INVALID_TIMEZONE');
    }

    const date = new Date(dateTime);
    const dayOfWeek = date.getDay();
    const timeStr = this.formatDateTime(date, timeZone, { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }).split(', ')[1];

    // Check if day has business hours defined
    const dayHours = businessHours[dayOfWeek] || businessHours.default;
    if (!dayHours || dayHours.closed) {
      return false;
    }

    // Check if time is within range
    return timeStr >= dayHours.start && timeStr <= dayHours.end;
  }

  /**
   * Calculate the next available time slot
   * @param {Date} fromTime - Starting time
   * @param {number} durationMinutes - Required duration
   * @param {Array} busySlots - Already booked slots
   * @param {string} timeZone - Timezone
   * @returns {Object|null} Next available slot or null
   */
  getNextAvailableSlot(fromTime, durationMinutes, busySlots, timeZone = 'UTC') {
    const searchEnd = new Date(fromTime.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days ahead
    
    const availableSlots = this.findAvailableSlots({
      startDate: fromTime,
      endDate: searchEnd,
      durationMinutes,
      busySlots,
      timeZone
    });

    return availableSlots.length > 0 ? availableSlots[0] : null;
  }
}

// Create singleton instance
const calendarService = new CalendarService();

module.exports = {
  CalendarService,
  CalendarServiceError,
  calendarService
};