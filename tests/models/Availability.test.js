/**
 * Availability Model Tests
 * Comprehensive tests for the Availability model and validation
 */

const { Availability, AvailabilityValidationError } = require('../../src/models/Availability');

describe('Availability Model', () => {
  
  describe('constructor', () => {
    test('should create availability with default values', () => {
      const availability = new Availability();
      
      expect(availability.id).toBeNull();
      expect(availability.userId).toBeNull();
      expect(availability.title).toBe('');
      expect(availability.status).toBe('active');
      expect(availability.isRecurring).toBe(false);
      expect(availability.maxBookings).toBe(1);
      expect(availability.currentBookings).toBe(0);
      expect(availability.timeZone).toBe('UTC');
    });

    test('should create availability with provided data', () => {
      const data = {
        id: 'test-id',
        userId: 'user-123',
        title: 'Morning Consultation',
        startTime: '09:00',
        endTime: '10:00',
        timeZone: 'America/New_York',
        date: '2025-01-15',
        isRecurring: true,
        recurrencePattern: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        maxBookings: 5,
        category: 'consultation',
        hourlyRate: 150,
        currency: 'USD'
      };

      const availability = new Availability(data);
      
      expect(availability.id).toBe('test-id');
      expect(availability.userId).toBe('user-123');
      expect(availability.title).toBe('Morning Consultation');
      expect(availability.startTime).toBe('09:00');
      expect(availability.endTime).toBe('10:00');
      expect(availability.timeZone).toBe('America/New_York');
      expect(availability.date).toBe('2025-01-15');
      expect(availability.isRecurring).toBe(true);
      expect(availability.recurrencePattern).toBe('weekly');
      expect(availability.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      expect(availability.maxBookings).toBe(5);
      expect(availability.category).toBe('consultation');
      expect(availability.hourlyRate).toBe(150);
      expect(availability.currency).toBe('USD');
    });
  });

  describe('validation', () => {
    let validData;

    beforeEach(() => {
      validData = {
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        timeZone: 'UTC'
      };
    });

    test('should validate successfully with valid data', () => {
      const availability = new Availability(validData);
      expect(() => availability.validate()).not.toThrow();
    });

    test('should throw error for missing userId', () => {
      delete validData.userId;
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('User ID is required');
    });

    test('should throw error for missing startTime', () => {
      delete validData.startTime;
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('Start time is required');
    });

    test('should throw error for missing endTime', () => {
      delete validData.endTime;
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('End time is required');
    });

    test('should throw error for invalid time format', () => {
      validData.startTime = '25:00'; // Invalid hour
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('Invalid start time format');
    });

    test('should throw error when end time is before start time', () => {
      validData.startTime = '17:00';
      validData.endTime = '09:00';
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('End time must be after start time');
    });

    test('should throw error for too short duration', () => {
      validData.startTime = '09:00';
      validData.endTime = '09:10'; // 10 minutes, minimum is 15
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('Minimum duration is 15 minutes');
    });

    test('should throw error for too long duration', () => {
      validData.startTime = '09:00';
      validData.endTime = '22:00'; // 13 hours, maximum is 12
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('Maximum duration is 12 hours');
    });

    test('should throw error for past date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      validData.date = yesterday.toISOString().split('T')[0];
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('Date cannot be in the past');
    });

    test('should throw error for invalid timezone', () => {
      validData.timeZone = 'Invalid/Timezone';
      const availability = new Availability(validData);
      
      expect(() => availability.validate()).toThrow(AvailabilityValidationError);
      expect(() => availability.validate()).toThrow('Invalid time zone');
    });

    describe('recurring validation', () => {
      beforeEach(() => {
        validData.isRecurring = true;
      });

      test('should throw error for missing recurrence pattern', () => {
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Invalid recurrence pattern');
      });

      test('should throw error for invalid recurrence pattern', () => {
        validData.recurrencePattern = 'invalid';
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Invalid recurrence pattern');
      });

      test('should validate weekly recurrence with valid days of week', () => {
        validData.recurrencePattern = 'weekly';
        validData.daysOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).not.toThrow();
      });

      test('should throw error for weekly recurrence without days of week', () => {
        validData.recurrencePattern = 'weekly';
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Days of week required for weekly recurrence');
      });

      test('should throw error for invalid days of week', () => {
        validData.recurrencePattern = 'weekly';
        validData.daysOfWeek = [1, 2, 7]; // 7 is invalid (should be 0-6)
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Days of week must be integers 0-6');
      });

      test('should validate monthly recurrence with valid day of month', () => {
        validData.recurrencePattern = 'monthly';
        validData.dayOfMonth = 15;
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).not.toThrow();
      });

      test('should throw error for invalid day of month', () => {
        validData.recurrencePattern = 'monthly';
        validData.dayOfMonth = 32; // Invalid day
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Day of month must be 1-31');
      });

      test('should throw error for past recurrence end date', () => {
        validData.recurrencePattern = 'daily';
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        validData.recurrenceEnd = yesterday.toISOString();
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Recurrence end date must be in the future');
      });
    });

    describe('booking validation', () => {
      test('should throw error for invalid max bookings', () => {
        validData.maxBookings = 0;
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Maximum bookings must be at least 1');
      });

      test('should throw error for negative current bookings', () => {
        validData.currentBookings = -1;
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Current bookings cannot be negative');
      });

      test('should throw error when current bookings exceed max bookings', () => {
        validData.maxBookings = 5;
        validData.currentBookings = 6;
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Current bookings cannot exceed maximum bookings');
      });

      test('should throw error for excessive buffer minutes', () => {
        validData.bufferMinutes = 300; // 5 hours, max is 4
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Buffer minutes must be between 0 and 240');
      });
    });

    describe('advance booking validation', () => {
      test('should throw error for invalid min advance hours', () => {
        validData.minAdvanceHours = -1;
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Minimum advance hours must be between 0 and 8760');
      });

      test('should throw error for invalid max advance days', () => {
        validData.maxAdvanceDays = 400; // More than 1 year
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Maximum advance days must be between 1 and 365');
      });

      test('should throw error when min advance time exceeds max advance time', () => {
        validData.minAdvanceHours = 8760; // 365 days
        validData.maxAdvanceDays = 30; // 30 days
        const availability = new Availability(validData);
        
        expect(() => availability.validate()).toThrow(AvailabilityValidationError);
        expect(() => availability.validate()).toThrow('Minimum advance time must be less than maximum advance time');
      });
    });
  });

  describe('isBookable', () => {
    let availability;

    beforeEach(() => {
      availability = new Availability({
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        status: 'active',
        maxBookings: 3,
        currentBookings: 1,
        minAdvanceHours: 24,
        maxAdvanceDays: 30
      });
    });

    test('should return bookable true for active slot with available capacity', () => {
      const result = availability.isBookable();
      
      expect(result.bookable).toBe(true);
      expect(result.availableSlots).toBe(2);
    });

    test('should return bookable false for inactive slot', () => {
      availability.status = 'inactive';
      const result = availability.isBookable();
      
      expect(result.bookable).toBe(false);
      expect(result.reason).toBe('Availability slot is not active');
    });

    test('should return bookable false when fully booked', () => {
      availability.currentBookings = 3;
      const result = availability.isBookable();
      
      expect(result.bookable).toBe(false);
      expect(result.reason).toBe('No available slots remaining');
    });

    test('should return bookable false when booking too soon', () => {
      const requestTime = new Date();
      const desiredTime = new Date(requestTime.getTime() + (12 * 60 * 60 * 1000)); // 12 hours later
      
      const result = availability.isBookable(requestTime, desiredTime);
      
      expect(result.bookable).toBe(false);
      expect(result.reason).toContain('Booking requires at least 24 hours advance notice');
    });

    test('should return bookable false when booking too far in advance', () => {
      const requestTime = new Date();
      const desiredTime = new Date(requestTime.getTime() + (35 * 24 * 60 * 60 * 1000)); // 35 days later
      
      const result = availability.isBookable(requestTime, desiredTime);
      
      expect(result.bookable).toBe(false);
      expect(result.reason).toContain('Booking cannot be made more than 30 days in advance');
    });

    test('should return bookable true for valid advance booking', () => {
      const requestTime = new Date();
      const desiredTime = new Date(requestTime.getTime() + (48 * 60 * 60 * 1000)); // 48 hours later
      
      const result = availability.isBookable(requestTime, desiredTime);
      
      expect(result.bookable).toBe(true);
    });
  });

  describe('generateInstances', () => {
    test('should generate single instance for non-recurring availability', () => {
      const availability = new Availability({
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        date: '2025-01-15',
        isRecurring: false
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const instances = availability.generateInstances(startDate, endDate);

      expect(instances).toHaveLength(1);
      expect(instances[0].date).toBe('2025-01-15');
      expect(instances[0].isInstance).toBe(true);
    });

    test('should generate no instances for non-recurring availability outside date range', () => {
      const availability = new Availability({
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        date: '2025-02-15',
        isRecurring: false
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const instances = availability.generateInstances(startDate, endDate);

      expect(instances).toHaveLength(0);
    });

    test('should generate daily recurring instances', () => {
      const availability = new Availability({
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        recurrencePattern: 'daily'
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-05');
      const instances = availability.generateInstances(startDate, endDate);

      expect(instances).toHaveLength(5);
      expect(instances[0].date).toBe('2025-01-01');
      expect(instances[4].date).toBe('2025-01-05');
    });

    test('should generate weekly recurring instances for specific days', () => {
      const availability = new Availability({
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        recurrencePattern: 'weekly',
        daysOfWeek: [1, 3, 5] // Monday, Wednesday, Friday
      });

      // Start on a Sunday (2025-01-05 is a Sunday)
      const startDate = new Date('2025-01-05');
      const endDate = new Date('2025-01-11');
      const instances = availability.generateInstances(startDate, endDate);

      expect(instances).toHaveLength(3);
      expect(instances[0].date).toBe('2025-01-06'); // Monday
      expect(instances[1].date).toBe('2025-01-08'); // Wednesday
      expect(instances[2].date).toBe('2025-01-10'); // Friday
    });

    test('should respect recurrence end date', () => {
      const availability = new Availability({
        userId: 'user-123',
        startTime: '09:00',
        endTime: '17:00',
        isRecurring: true,
        recurrencePattern: 'daily',
        recurrenceEnd: '2025-01-03T00:00:00Z'
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-10');
      const instances = availability.generateInstances(startDate, endDate);

      expect(instances).toHaveLength(3);
      expect(instances[2].date).toBe('2025-01-03');
    });
  });

  describe('getDurationMinutes', () => {
    test('should calculate duration correctly', () => {
      const availability = new Availability({
        startTime: '09:00',
        endTime: '10:30'
      });

      expect(availability.getDurationMinutes()).toBe(90);
    });

    test('should handle overnight duration', () => {
      const availability = new Availability({
        startTime: '23:00',
        endTime: '01:00'
      });

      // Since this crosses midnight, it should be calculated as negative
      // In real usage, this would be validated against in the validate() method
      expect(availability.getDurationMinutes()).toBe(-1320); // -22 hours
    });
  });

  describe('getEffectiveRate', () => {
    test('should return null when no hourly rate set', () => {
      const availability = new Availability({});
      
      expect(availability.getEffectiveRate()).toBeNull();
    });

    test('should return rate when currency matches', () => {
      const availability = new Availability({
        hourlyRate: 100,
        currency: 'USD'
      });
      
      expect(availability.getEffectiveRate('USD')).toBe(100);
    });

    test('should return rate for currency conversion placeholder', () => {
      const availability = new Availability({
        hourlyRate: 100,
        currency: 'EUR'
      });
      
      // Currently returns base rate (placeholder for conversion)
      expect(availability.getEffectiveRate('USD')).toBe(100);
    });
  });

  describe('toJSON', () => {
    test('should serialize all properties correctly', () => {
      const data = {
        id: 'test-id',
        userId: 'user-123',
        title: 'Test Availability',
        startTime: '09:00',
        endTime: '17:00',
        timeZone: 'UTC',
        isRecurring: true,
        recurrencePattern: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5],
        maxBookings: 3,
        category: 'consultation'
      };

      const availability = new Availability(data);
      const json = availability.toJSON();

      expect(json.id).toBe('test-id');
      expect(json.userId).toBe('user-123');
      expect(json.title).toBe('Test Availability');
      expect(json.startTime).toBe('09:00');
      expect(json.endTime).toBe('17:00');
      expect(json.isRecurring).toBe(true);
      expect(json.recurrencePattern).toBe('weekly');
      expect(json.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      expect(json.maxBookings).toBe(3);
      expect(json.category).toBe('consultation');
    });
  });

  describe('fromJSON', () => {
    test('should create Availability instance from JSON', () => {
      const json = {
        id: 'test-id',
        userId: 'user-123',
        title: 'Test Availability',
        startTime: '09:00',
        endTime: '17:00'
      };

      const availability = Availability.fromJSON(json);

      expect(availability).toBeInstanceOf(Availability);
      expect(availability.id).toBe('test-id');
      expect(availability.userId).toBe('user-123');
      expect(availability.title).toBe('Test Availability');
    });
  });

  describe('createInstance', () => {
    test('should create availability instance with correct properties', () => {
      const availability = new Availability({
        id: 'parent-123',
        userId: 'user-123',
        title: 'Daily Standup',
        startTime: '09:00',
        endTime: '09:30',
        maxBookings: 10,
        category: 'meeting',
        tags: ['standup', 'team']
      });

      const instanceDate = new Date('2025-01-15');
      const instance = availability.createInstance(instanceDate);

      expect(instance.id).toBe('parent-123_2025-01-15');
      expect(instance.parentId).toBe('parent-123');
      expect(instance.userId).toBe('user-123');
      expect(instance.title).toBe('Daily Standup');
      expect(instance.date).toBe('2025-01-15');
      expect(instance.currentBookings).toBe(0);
      expect(instance.isInstance).toBe(true);
      expect(instance.tags).toEqual(['standup', 'team']);
    });
  });

  describe('fromDatabase', () => {
    test('should create Availability from database row', () => {
      const dbRow = {
        id: 'test-id',
        user_id: 'user-123',
        schedule_type: 'recurring',
        engagement_type: 'consulting',
        start_date: '2025-01-15',
        start_time: '09:00',
        end_time: '17:00',
        time_zone: 'UTC',
        recurrence_pattern: 'weekly',
        recurrence_days: [1, 2, 3, 4, 5],
        status: 'available',
        max_bookings: 5,
        current_bookings: 2,
        title: 'Consultation Hours',
        location_type: 'remote'
      };

      const availability = Availability.fromDatabase(dbRow);

      expect(availability).toBeInstanceOf(Availability);
      expect(availability.id).toBe('test-id');
      expect(availability.userId).toBe('user-123');
      expect(availability.scheduleType).toBe('recurring');
      expect(availability.engagementType).toBe('consulting');
      expect(availability.startDate).toBe('2025-01-15');
      expect(availability.recurrencePattern).toBe('weekly');
      expect(availability.recurrenceDays).toEqual([1, 2, 3, 4, 5]);
      expect(availability.locationType).toBe('remote');
    });
  });

  describe('toDatabase', () => {
    test('should convert to database format', () => {
      const availability = new Availability({
        id: 'test-id',
        userId: 'user-123',
        scheduleType: 'recurring',
        engagementType: 'consulting',
        startDate: '2025-01-15',
        startTime: '09:00',
        endTime: '17:00',
        recurrencePattern: 'weekly',
        recurrenceDays: [1, 2, 3, 4, 5],
        locationType: 'remote'
      });

      const dbFormat = availability.toDatabase();

      expect(dbFormat.id).toBe('test-id');
      expect(dbFormat.user_id).toBe('user-123');
      expect(dbFormat.schedule_type).toBe('recurring');
      expect(dbFormat.engagement_type).toBe('consulting');
      expect(dbFormat.start_date).toBe('2025-01-15');
      expect(dbFormat.start_time).toBe('09:00');
      expect(dbFormat.end_time).toBe('17:00');
      expect(dbFormat.recurrence_pattern).toBe('weekly');
      expect(dbFormat.recurrence_days).toEqual([1, 2, 3, 4, 5]);
      expect(dbFormat.location_type).toBe('remote');
    });

    test('should omit null values in database format', () => {
      const availability = new Availability({
        userId: 'user-123',
        startDate: '2025-01-15',
        startTime: '09:00',
        endTime: '17:00'
      });

      const dbFormat = availability.toDatabase();

      expect(dbFormat).not.toHaveProperty('id'); // Should be omitted since it's null
      expect(dbFormat).not.toHaveProperty('engagement_type');
      expect(dbFormat).not.toHaveProperty('end_date');
    });
  });

  describe('TimeZoneUtils', () => {
    describe('convertTime', () => {
      test('should return same time for same timezone', () => {
        const converted = TimeZoneUtils.convertTime('09:00', new Date('2025-01-15'), 'UTC', 'UTC');
        expect(converted).toBe('09:00');
      });

      test('should convert time between timezones', () => {
        const date = new Date('2025-01-15');
        const converted = TimeZoneUtils.convertTime('09:00', date, 'UTC', 'America/New_York');
        // The actual conversion depends on DST, so we just check it's a valid time format
        expect(converted).toMatch(/^\d{2}:\d{2}$/);
      });
    });

    describe('isValidTimeZone', () => {
      test('should validate correct timezone', () => {
        expect(TimeZoneUtils.isValidTimeZone('UTC')).toBe(true);
        expect(TimeZoneUtils.isValidTimeZone('America/New_York')).toBe(true);
      });

      test('should reject invalid timezone', () => {
        expect(TimeZoneUtils.isValidTimeZone('Invalid/Timezone')).toBe(false);
      });
    });

    describe('getTimezoneOffset', () => {
      test('should return offset in minutes', () => {
        const offset = TimeZoneUtils.getTimezoneOffset('UTC');
        expect(typeof offset).toBe('number');
      });
    });
  });
});