/**
 * Availability Model
 * Handles availability data structure, validation, and business logic
 */

class AvailabilityValidationError extends Error {
  constructor(message, field = null, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'AvailabilityValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * Availability Model
 * Represents time slots when users are available for appointments
 */
class Availability {
  constructor(data = {}) {
    // Core fields
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.title = data.title || '';
    this.description = data.description || '';
    
    // Time fields
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    this.timeZone = data.timeZone || 'UTC';
    this.date = data.date || null; // For specific date availability
    
    // Recurrence fields
    this.isRecurring = data.isRecurring || false;
    this.recurrencePattern = data.recurrencePattern || null; // 'daily', 'weekly', 'monthly'
    this.recurrenceEnd = data.recurrenceEnd || null; // End date for recurrence
    this.daysOfWeek = data.daysOfWeek || []; // For weekly recurrence: [0,1,2,3,4,5,6] (Sun-Sat)
    this.dayOfMonth = data.dayOfMonth || null; // For monthly recurrence: 1-31
    
    // Status and metadata
    this.status = data.status || 'active'; // 'active', 'inactive', 'booked'
    this.maxBookings = data.maxBookings || 1; // How many bookings this slot can accept
    this.currentBookings = data.currentBookings || 0;
    this.bufferMinutes = data.bufferMinutes || 0; // Buffer time before/after appointments
    
    // Booking restrictions
    this.minAdvanceHours = data.minAdvanceHours || 24; // Minimum hours in advance to book
    this.maxAdvanceDays = data.maxAdvanceDays || 30; // Maximum days in advance to book
    
    // Tags and categories
    this.tags = data.tags || [];
    this.category = data.category || 'general'; // 'meeting', 'consultation', 'interview', etc.
    
    // Pricing (optional)
    this.hourlyRate = data.hourlyRate || null;
    this.currency = data.currency || 'USD';
    
    // System fields
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.createdBy = data.createdBy || null;
  }

  /**
   * Validate the availability data
   * @returns {boolean} True if valid
   * @throws {AvailabilityValidationError} If validation fails
   */
  validate() {
    // Required fields
    if (!this.userId) {
      throw new AvailabilityValidationError('User ID is required', 'userId', 'REQUIRED_FIELD');
    }

    if (!this.startTime) {
      throw new AvailabilityValidationError('Start time is required', 'startTime', 'REQUIRED_FIELD');
    }

    if (!this.endTime) {
      throw new AvailabilityValidationError('End time is required', 'endTime', 'REQUIRED_FIELD');
    }

    // Time validation
    this.validateTime();
    
    // Date validation (if specific date)
    if (this.date) {
      this.validateDate();
    }
    
    // Recurrence validation
    if (this.isRecurring) {
      this.validateRecurrence();
    }
    
    // Booking validation
    this.validateBookings();
    
    // Time zone validation
    this.validateTimeZone();
    
    // Advance booking validation
    this.validateAdvanceBooking();

    return true;
  }

  /**
   * Validate time fields
   */
  validateTime() {
    const start = new Date(`1970-01-01T${this.startTime}:00`);
    const end = new Date(`1970-01-01T${this.endTime}:00`);

    if (isNaN(start.getTime())) {
      throw new AvailabilityValidationError('Invalid start time format. Use HH:MM format', 'startTime', 'INVALID_FORMAT');
    }

    if (isNaN(end.getTime())) {
      throw new AvailabilityValidationError('Invalid end time format. Use HH:MM format', 'endTime', 'INVALID_FORMAT');
    }

    if (end <= start) {
      throw new AvailabilityValidationError('End time must be after start time', 'endTime', 'INVALID_TIME_RANGE');
    }

    // Check for reasonable duration (at least 15 minutes, max 12 hours)
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = durationMs / (1000 * 60);

    if (durationMinutes < 15) {
      throw new AvailabilityValidationError('Minimum duration is 15 minutes', 'duration', 'INVALID_DURATION');
    }

    if (durationMinutes > 720) { // 12 hours
      throw new AvailabilityValidationError('Maximum duration is 12 hours', 'duration', 'INVALID_DURATION');
    }
  }

  /**
   * Validate date field
   */
  validateDate() {
    const dateObj = new Date(this.date);
    
    if (isNaN(dateObj.getTime())) {
      throw new AvailabilityValidationError('Invalid date format', 'date', 'INVALID_FORMAT');
    }

    // Date should not be in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateObj < today) {
      throw new AvailabilityValidationError('Date cannot be in the past', 'date', 'INVALID_DATE');
    }
  }

  /**
   * Validate recurrence pattern
   */
  validateRecurrence() {
    const validPatterns = ['daily', 'weekly', 'monthly'];
    
    if (!this.recurrencePattern || !validPatterns.includes(this.recurrencePattern)) {
      throw new AvailabilityValidationError(
        'Invalid recurrence pattern. Must be: daily, weekly, or monthly', 
        'recurrencePattern', 
        'INVALID_RECURRENCE'
      );
    }

    // Weekly recurrence validation
    if (this.recurrencePattern === 'weekly') {
      if (!Array.isArray(this.daysOfWeek) || this.daysOfWeek.length === 0) {
        throw new AvailabilityValidationError('Days of week required for weekly recurrence', 'daysOfWeek', 'REQUIRED_FIELD');
      }

      for (const day of this.daysOfWeek) {
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          throw new AvailabilityValidationError('Days of week must be integers 0-6 (Sun-Sat)', 'daysOfWeek', 'INVALID_DAY');
        }
      }
    }

    // Monthly recurrence validation
    if (this.recurrencePattern === 'monthly') {
      if (!this.dayOfMonth || this.dayOfMonth < 1 || this.dayOfMonth > 31) {
        throw new AvailabilityValidationError('Day of month must be 1-31 for monthly recurrence', 'dayOfMonth', 'INVALID_DAY');
      }
    }

    // Recurrence end validation
    if (this.recurrenceEnd) {
      const endDate = new Date(this.recurrenceEnd);
      if (isNaN(endDate.getTime())) {
        throw new AvailabilityValidationError('Invalid recurrence end date format', 'recurrenceEnd', 'INVALID_FORMAT');
      }

      const today = new Date();
      if (endDate <= today) {
        throw new AvailabilityValidationError('Recurrence end date must be in the future', 'recurrenceEnd', 'INVALID_DATE');
      }
    }
  }

  /**
   * Validate booking-related fields
   */
  validateBookings() {
    if (this.maxBookings < 1) {
      throw new AvailabilityValidationError('Maximum bookings must be at least 1', 'maxBookings', 'INVALID_VALUE');
    }

    if (this.currentBookings < 0) {
      throw new AvailabilityValidationError('Current bookings cannot be negative', 'currentBookings', 'INVALID_VALUE');
    }

    if (this.currentBookings > this.maxBookings) {
      throw new AvailabilityValidationError('Current bookings cannot exceed maximum bookings', 'currentBookings', 'INVALID_VALUE');
    }

    if (this.bufferMinutes < 0 || this.bufferMinutes > 240) { // Max 4 hours buffer
      throw new AvailabilityValidationError('Buffer minutes must be between 0 and 240', 'bufferMinutes', 'INVALID_VALUE');
    }
  }

  /**
   * Validate time zone
   */
  validateTimeZone() {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: this.timeZone });
    } catch (error) {
      throw new AvailabilityValidationError('Invalid time zone', 'timeZone', 'INVALID_TIMEZONE');
    }
  }

  /**
   * Validate advance booking constraints
   */
  validateAdvanceBooking() {
    if (this.minAdvanceHours < 0 || this.minAdvanceHours > 8760) { // Max 1 year
      throw new AvailabilityValidationError('Minimum advance hours must be between 0 and 8760', 'minAdvanceHours', 'INVALID_VALUE');
    }

    if (this.maxAdvanceDays < 1 || this.maxAdvanceDays > 365) { // Max 1 year
      throw new AvailabilityValidationError('Maximum advance days must be between 1 and 365', 'maxAdvanceDays', 'INVALID_VALUE');
    }

    // Ensure minimum advance time doesn't exceed maximum advance time
    const minAdvanceMs = this.minAdvanceHours * 60 * 60 * 1000;
    const maxAdvanceMs = this.maxAdvanceDays * 24 * 60 * 60 * 1000;

    if (minAdvanceMs >= maxAdvanceMs) {
      throw new AvailabilityValidationError(
        'Minimum advance time must be less than maximum advance time', 
        'advanceBooking', 
        'INVALID_ADVANCE_RANGE'
      );
    }
  }

  /**
   * Check if this availability slot is bookable at a given time
   * @param {Date} requestTime - When the booking request is made
   * @param {Date} desiredTime - When the appointment is desired
   * @returns {Object} Booking availability status
   */
  isBookable(requestTime = new Date(), desiredTime = null) {
    const result = {
      bookable: false,
      reason: null,
      availableSlots: this.maxBookings - this.currentBookings
    };

    // Check if slot is available for booking
    if (this.status === 'blocked') {
      result.reason = 'This time slot is blocked';
      return result;
    }

    if (this.status === 'booked' && this.currentBookings >= this.maxBookings) {
      result.reason = 'This time slot is fully booked';
      return result;
    }

    // Check if there are available slots
    if (this.currentBookings >= this.maxBookings) {
      result.reason = 'No available slots remaining';
      return result;
    }

    // If specific time is provided, check advance booking constraints
    if (desiredTime) {
      const timeDiff = desiredTime.getTime() - requestTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      if (hoursDiff < this.minimumNoticeHours) {
        result.reason = `Booking requires at least ${this.minimumNoticeHours} hours advance notice`;
        return result;
      }

      if (daysDiff > this.maximumAdvanceDays) {
        result.reason = `Booking cannot be made more than ${this.maximumAdvanceDays} days in advance`;
        return result;
      }
    }

    result.bookable = true;
    return result;
  }

  /**
   * Generate availability instances for a date range (handles recurring patterns)
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Array<Object>} Array of availability instances
   */
  generateInstances(startDate, endDate) {
    const instances = [];

    if (!this.isRecurring) {
      // Single instance
      if (this.date) {
        const instanceDate = new Date(this.date);
        if (instanceDate >= startDate && instanceDate <= endDate) {
          instances.push(this.createInstance(instanceDate));
        }
      }
      return instances;
    }

    // Recurring instances
    const current = new Date(startDate);
    const end = this.recurrenceEnd ? new Date(Math.min(endDate.getTime(), new Date(this.recurrenceEnd).getTime())) : endDate;

    while (current <= end) {
      if (this.shouldGenerateInstance(current)) {
        instances.push(this.createInstance(new Date(current)));
      }
      
      // Increment based on pattern
      switch (this.recurrencePattern) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 1);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return instances;
  }

  /**
   * Check if an instance should be generated for a specific date
   * @param {Date} date - Date to check
   * @returns {boolean} Whether to generate instance
   */
  shouldGenerateInstance(date) {
    if (!this.isRecurring) return false;

    switch (this.recurrencePattern) {
      case 'daily':
        return true;
        
      case 'weekly':
        return this.daysOfWeek.includes(date.getDay());
        
      case 'monthly':
        return date.getDate() === this.dayOfMonth;
        
      default:
        return false;
    }
  }

  /**
   * Create an availability instance for a specific date
   * @param {Date} date - Date for the instance
   * @returns {Object} Availability instance
   */
  createInstance(date) {
    return {
      id: `${this.id}_${date.toISOString().split('T')[0]}`,
      parentId: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      startTime: this.startTime,
      endTime: this.endTime,
      timeZone: this.timeZone,
      date: date.toISOString().split('T')[0],
      status: this.status,
      maxBookings: this.maxBookings,
      currentBookings: 0, // New instance starts with 0 bookings
      bufferMinutes: this.bufferMinutes,
      category: this.category,
      tags: [...this.tags],
      hourlyRate: this.hourlyRate,
      currency: this.currency,
      isInstance: true
    };
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON object
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      startTime: this.startTime,
      endTime: this.endTime,
      timeZone: this.timeZone,
      date: this.date,
      isRecurring: this.isRecurring,
      recurrencePattern: this.recurrencePattern,
      recurrenceEnd: this.recurrenceEnd,
      daysOfWeek: this.daysOfWeek,
      dayOfMonth: this.dayOfMonth,
      status: this.status,
      maxBookings: this.maxBookings,
      currentBookings: this.currentBookings,
      bufferMinutes: this.bufferMinutes,
      minAdvanceHours: this.minAdvanceHours,
      maxAdvanceDays: this.maxAdvanceDays,
      tags: this.tags,
      category: this.category,
      hourlyRate: this.hourlyRate,
      currency: this.currency,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy
    };
  }

  /**
   * Create Availability from JSON data
   * @param {Object} json - JSON data
   * @returns {Availability} Availability instance
   */
  static fromJSON(json) {
    return new Availability(json);
  }

  /**
   * Get duration in minutes
   * @returns {number} Duration in minutes
   */
  getDurationMinutes() {
    const start = new Date(`1970-01-01T${this.startTime}:00`);
    const end = new Date(`1970-01-01T${this.endTime}:00`);
    return (end.getTime() - start.getTime()) / (1000 * 60);
  }

  /**
   * Get effective hourly rate (considering currency conversion if needed)
   * @param {string} targetCurrency - Target currency for conversion
   * @returns {number} Hourly rate in target currency
   */
  getEffectiveRate(targetCurrency = 'USD') {
    if (!this.hourlyRate) return null;
    
    // In a real implementation, this would use a currency conversion service
    // For now, return the base rate
    if (this.currency === targetCurrency) {
      return this.hourlyRate;
    }
    
    // Placeholder for currency conversion
    return this.hourlyRate;
  }
}

/**
 * Time zone utilities
 */
class TimeZoneUtils {
  /**
   * Convert time from one timezone to another
   * @param {string} time - Time in HH:MM format
   * @param {Date} date - Date to use for conversion
   * @param {string} fromTZ - Source timezone
   * @param {string} targetTZ - Target timezone
   * @returns {string} Converted time in HH:MM format
   */
  static convertTime(time, date, fromTZ, targetTZ) {
    if (fromTZ === targetTZ) return time;

    // Create a date object in the source timezone
    const [hours, minutes] = time.split(':').map(Number);
    const sourceDateTime = new Date(date);
    sourceDateTime.setHours(hours, minutes, 0, 0);

    // Convert to target timezone
    const targetDateTime = new Date(sourceDateTime.toLocaleString('en-US', { timeZone: targetTZ }));
    
    // Format back to HH:MM
    return targetDateTime.toTimeString().substring(0, 5);
  }

  /**
   * Get timezone offset in minutes
   * @param {string} timeZone - IANA timezone identifier
   * @param {Date} date - Date to get offset for
   * @returns {number} Offset in minutes
   */
  static getTimezoneOffset(timeZone, date = new Date()) {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
    return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
  }

  /**
   * Check if timezone is valid
   * @param {string} timeZone - IANA timezone identifier
   * @returns {boolean} True if valid
   */
  static isValidTimeZone(timeZone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = {
  Availability,
  AvailabilityValidationError,
  TimeZoneUtils
};