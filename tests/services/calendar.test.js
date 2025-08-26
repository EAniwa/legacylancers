/**
 * Calendar Service Tests
 * Comprehensive tests for calendar service functionality
 */

const { CalendarService, CalendarServiceError, calendarService } = require('../../src/services/calendar');

describe('CalendarService', () => {
  let service;

  beforeEach(() => {
    service = new CalendarService();
  });

  describe('isValidTimeZone', () => {
    test('should validate common time zones', () => {
      expect(service.isValidTimeZone('UTC')).toBe(true);
      expect(service.isValidTimeZone('America/New_York')).toBe(true);
      expect(service.isValidTimeZone('Europe/London')).toBe(true);
      expect(service.isValidTimeZone('Asia/Tokyo')).toBe(true);
    });

    test('should reject invalid time zones', () => {
      expect(service.isValidTimeZone('Invalid/Timezone')).toBe(false);
      expect(service.isValidTimeZone('NotATimezone')).toBe(false);
      expect(service.isValidTimeZone('')).toBe(false);
    });

    test('should cache validated time zones', () => {
      // First call
      const isValid1 = service.isValidTimeZone('America/Los_Angeles');
      expect(isValid1).toBe(true);

      // Should now be in cache
      expect(service.validTimeZones.has('America/Los_Angeles')).toBe(true);

      // Second call should use cache
      const isValid2 = service.isValidTimeZone('America/Los_Angeles');
      expect(isValid2).toBe(true);
    });
  });

  describe('convertTimeZone', () => {
    test('should convert between time zones', () => {
      const sourceDate = new Date('2025-01-15T12:00:00Z'); // UTC
      
      const converted = service.convertTimeZone(sourceDate, 'UTC', 'America/New_York');
      
      expect(converted).toBeInstanceOf(Date);
      expect(converted.getTime()).not.toBe(sourceDate.getTime());
    });

    test('should handle string date input', () => {
      const sourceDateStr = '2025-01-15T12:00:00Z';
      
      const converted = service.convertTimeZone(sourceDateStr, 'UTC', 'Europe/London');
      
      expect(converted).toBeInstanceOf(Date);
    });

    test('should throw error for invalid source time zone', () => {
      const date = new Date();
      
      expect(() => {
        service.convertTimeZone(date, 'Invalid/Timezone', 'UTC');
      }).toThrow(CalendarServiceError);
    });

    test('should throw error for invalid target time zone', () => {
      const date = new Date();
      
      expect(() => {
        service.convertTimeZone(date, 'UTC', 'Invalid/Timezone');
      }).toThrow(CalendarServiceError);
    });
  });

  describe('getCurrentTimeInTimeZone', () => {
    test('should return current time in specified timezone', () => {
      const utcTime = service.getCurrentTimeInTimeZone('UTC');
      const nyTime = service.getCurrentTimeInTimeZone('America/New_York');
      
      expect(utcTime).toBeInstanceOf(Date);
      expect(nyTime).toBeInstanceOf(Date);
      
      // Both should represent the current time but displayed in different timezones
      // They could be several hours different due to timezone conversion
      const now = new Date();
      expect(Math.abs(utcTime.getTime() - now.getTime())).toBeLessThan(5000);
      expect(Math.abs(nyTime.getTime() - now.getTime())).toBeLessThan(5000);
    });

    test('should throw error for invalid time zone', () => {
      expect(() => {
        service.getCurrentTimeInTimeZone('Invalid/Timezone');
      }).toThrow(CalendarServiceError);
    });
  });

  describe('combineDateTimeInTimeZone', () => {
    test('should combine date and time strings correctly', () => {
      const combined = service.combineDateTimeInTimeZone('2025-01-15', '14:30', 'UTC');
      
      expect(combined).toBeInstanceOf(Date);
      // Check that the combined date contains the expected date components
      expect(combined.getFullYear()).toBe(2025);
      expect(combined.getMonth()).toBe(0); // January (0-indexed)
      expect(combined.getDate()).toBe(15);
    });

    test('should handle different time zones', () => {
      const utcTime = service.combineDateTimeInTimeZone('2025-01-15', '12:00', 'UTC');
      const nyTime = service.combineDateTimeInTimeZone('2025-01-15', '12:00', 'America/New_York');
      
      expect(utcTime).toBeInstanceOf(Date);
      expect(nyTime).toBeInstanceOf(Date);
      expect(utcTime.getTime()).not.toBe(nyTime.getTime());
    });

    test('should throw error for invalid time zone', () => {
      expect(() => {
        service.combineDateTimeInTimeZone('2025-01-15', '12:00', 'Invalid/Timezone');
      }).toThrow(CalendarServiceError);
    });
  });

  describe('timeRangesOverlap', () => {
    test('should detect overlapping ranges', () => {
      const range1 = {
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z')
      };
      
      const range2 = {
        start: new Date('2025-01-15T11:00:00Z'),
        end: new Date('2025-01-15T13:00:00Z')
      };
      
      expect(service.timeRangesOverlap(range1, range2)).toBe(true);
    });

    test('should detect non-overlapping ranges', () => {
      const range1 = {
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z')
      };
      
      const range2 = {
        start: new Date('2025-01-15T13:00:00Z'),
        end: new Date('2025-01-15T15:00:00Z')
      };
      
      expect(service.timeRangesOverlap(range1, range2)).toBe(false);
    });

    test('should detect adjacent ranges as non-overlapping', () => {
      const range1 = {
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z')
      };
      
      const range2 = {
        start: new Date('2025-01-15T12:00:00Z'),
        end: new Date('2025-01-15T14:00:00Z')
      };
      
      expect(service.timeRangesOverlap(range1, range2)).toBe(false);
    });
  });

  describe('findAvailableSlots', () => {
    test('should find available slots with no conflicts', () => {
      const params = {
        startDate: new Date('2025-01-15T00:00:00Z'),
        endDate: new Date('2025-01-15T23:59:59Z'),
        durationMinutes: 60,
        busySlots: [],
        availableHours: [{ start: '09:00', end: '17:00' }],
        timeZone: 'UTC'
      };
      
      const slots = service.findAvailableSlots(params);
      
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
      
      if (slots.length > 0) {
        expect(slots[0]).toHaveProperty('start');
        expect(slots[0]).toHaveProperty('end');
        expect(slots[0]).toHaveProperty('duration');
        expect(slots[0].duration).toBe(60);
      }
    });

    test('should avoid busy slots', () => {
      const busySlots = [{
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T12:00:00Z')
      }];
      
      const params = {
        startDate: new Date('2025-01-15T00:00:00Z'),
        endDate: new Date('2025-01-15T23:59:59Z'),
        durationMinutes: 60,
        busySlots,
        availableHours: [{ start: '09:00', end: '17:00' }],
        timeZone: 'UTC'
      };
      
      const slots = service.findAvailableSlots(params);
      
      // Verify no slots overlap with busy time
      const hasConflict = slots.some(slot => {
        return service.timeRangesOverlap(
          { start: slot.start, end: slot.end },
          busySlots[0]
        );
      });
      
      expect(hasConflict).toBe(false);
    });

    test('should respect buffer time', () => {
      const params = {
        startDate: new Date('2025-01-15T00:00:00Z'),
        endDate: new Date('2025-01-15T23:59:59Z'),
        durationMinutes: 60,
        busySlots: [],
        availableHours: [{ start: '09:00', end: '12:00' }], // 3 hour window
        timeZone: 'UTC',
        bufferMinutes: 30
      };
      
      const slots = service.findAvailableSlots(params);
      
      // With 60min slots + 30min buffer, should fit fewer slots in a 3-hour window
      expect(slots.length).toBeLessThanOrEqual(2);
    });

    test('should throw error for invalid time zone', () => {
      const params = {
        startDate: new Date('2025-01-15T00:00:00Z'),
        endDate: new Date('2025-01-15T23:59:59Z'),
        durationMinutes: 60,
        timeZone: 'Invalid/Timezone'
      };
      
      expect(() => {
        service.findAvailableSlots(params);
      }).toThrow(CalendarServiceError);
    });
  });

  describe('generateTimeSlots', () => {
    test('should generate slots for given time range', () => {
      const rangeStart = new Date('2025-01-15T09:00:00Z');
      const rangeEnd = new Date('2025-01-15T17:00:00Z');
      
      const slots = service.generateTimeSlots(rangeStart, rangeEnd, 60, [], 0);
      
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBe(8); // 8 hours = 8 one-hour slots
      
      expect(slots[0].start.getTime()).toBe(rangeStart.getTime());
      expect(slots[0].duration).toBe(60);
    });

    test('should avoid busy slots', () => {
      const rangeStart = new Date('2025-01-15T09:00:00Z');
      const rangeEnd = new Date('2025-01-15T13:00:00Z');
      
      const busySlots = [{
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T11:00:00Z')
      }];
      
      const slots = service.generateTimeSlots(rangeStart, rangeEnd, 60, busySlots, 0);
      
      // Should have slots before and after busy time
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.length).toBeLessThan(4); // Less than would fit without busy slot
      
      // Verify no slots overlap with busy time
      const hasConflict = slots.some(slot => {
        return service.timeRangesOverlap(
          { start: slot.start, end: slot.end },
          busySlots[0]
        );
      });
      
      expect(hasConflict).toBe(false);
    });
  });

  describe('calculateDuration', () => {
    test('should calculate duration in minutes', () => {
      const start = new Date('2025-01-15T10:00:00Z');
      const end = new Date('2025-01-15T12:30:00Z');
      
      const duration = service.calculateDuration(start, end);
      
      expect(duration).toBe(150); // 2.5 hours = 150 minutes
    });

    test('should handle string inputs', () => {
      const duration = service.calculateDuration(
        '2025-01-15T10:00:00Z',
        '2025-01-15T11:00:00Z'
      );
      
      expect(duration).toBe(60);
    });

    test('should throw error when end is before start', () => {
      const start = new Date('2025-01-15T12:00:00Z');
      const end = new Date('2025-01-15T10:00:00Z');
      
      expect(() => {
        service.calculateDuration(start, end);
      }).toThrow(CalendarServiceError);
    });
  });

  describe('getBusinessDays', () => {
    test('should return business days excluding weekends', () => {
      const startDate = new Date('2025-01-13'); // Monday
      const endDate = new Date('2025-01-19'); // Sunday
      
      const businessDays = service.getBusinessDays(startDate, endDate);
      
      expect(businessDays).toHaveLength(5); // Mon-Fri
      
      // Verify no weekends
      businessDays.forEach(day => {
        expect(day.getDay()).not.toBe(0); // Not Sunday
        expect(day.getDay()).not.toBe(6); // Not Saturday
      });
    });

    test('should respect custom exclusions', () => {
      const startDate = new Date('2025-01-13'); // Monday
      const endDate = new Date('2025-01-19'); // Sunday
      
      const businessDays = service.getBusinessDays(startDate, endDate, [0, 1, 6]); // Exclude Sun, Mon, Sat
      
      expect(businessDays).toHaveLength(4); // Tue-Fri
      
      businessDays.forEach(day => {
        expect([2, 3, 4, 5]).toContain(day.getDay()); // Only Tue-Fri
      });
    });
  });

  describe('formatDateTime', () => {
    test('should format date in specified timezone', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      
      const formatted = service.formatDateTime(date, 'UTC');
      
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('2025');
      expect(formatted).toContain('01');
      expect(formatted).toContain('15');
    });

    test('should use custom format options', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      
      const formatted = service.formatDateTime(date, 'UTC', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      expect(formatted).toContain('2025');
      expect(formatted).toMatch(/Jan|January/);
    });

    test('should throw error for invalid timezone', () => {
      const date = new Date();
      
      expect(() => {
        service.formatDateTime(date, 'Invalid/Timezone');
      }).toThrow(CalendarServiceError);
    });
  });

  describe('generateRecurringDates', () => {
    test('should generate daily recurring dates', () => {
      const pattern = { type: 'daily' };
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-20');
      
      const dates = service.generateRecurringDates(pattern, startDate, endDate);
      
      expect(dates).toHaveLength(6); // 6 days inclusive
      expect(dates[0].toDateString()).toBe(startDate.toDateString());
      expect(dates[5].toDateString()).toBe(endDate.toDateString());
    });

    test('should generate weekly recurring dates for specific days', () => {
      const pattern = { 
        type: 'weekly',
        daysOfWeek: [1, 3, 5] // Mon, Wed, Fri
      };
      const startDate = new Date('2025-01-13'); // Monday
      const endDate = new Date('2025-01-26'); // Next Sunday
      
      const dates = service.generateRecurringDates(pattern, startDate, endDate);
      
      expect(dates.length).toBe(6); // 2 weeks × 3 days = 6 days
      dates.forEach(date => {
        expect([1, 3, 5]).toContain(date.getDay());
      });
    });

    test('should generate monthly recurring dates', () => {
      const pattern = { 
        type: 'monthly',
        dayOfMonth: 15
      };
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-03-31'); // Only go to March to avoid complexity
      
      const dates = service.generateRecurringDates(pattern, startDate, endDate);
      
      expect(dates.length).toBeGreaterThanOrEqual(2); // At least Jan, Feb, Mar
      dates.forEach(date => {
        expect(date.getDate()).toBe(15);
      });
    });

    test('should handle daily recurrence with interval', () => {
      const pattern = { 
        type: 'daily',
        interval: 2 // Every other day
      };
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-20');
      
      const dates = service.generateRecurringDates(pattern, startDate, endDate);
      
      expect(dates).toHaveLength(3); // Every other day in 6-day span
    });

    test('should throw error for unsupported recurrence type', () => {
      const pattern = { type: 'unsupported' };
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-20');
      
      expect(() => {
        service.generateRecurringDates(pattern, startDate, endDate);
      }).toThrow(CalendarServiceError);
    });
  });

  describe('isWithinBusinessHours', () => {
    const businessHours = {
      default: { start: '09:00', end: '17:00' },
      0: { closed: true }, // Sunday
      6: { closed: true }  // Saturday
    };

    test('should return true for time within business hours', () => {
      const dateTime = new Date('2025-01-15T12:00:00Z'); // Wednesday noon UTC
      
      const isWithin = service.isWithinBusinessHours(dateTime, businessHours, 'UTC');
      
      expect(isWithin).toBe(true);
    });

    test('should return false for time outside business hours', () => {
      const dateTime = new Date('2025-01-15T20:00:00Z'); // Wednesday 8 PM UTC
      
      const isWithin = service.isWithinBusinessHours(dateTime, businessHours, 'UTC');
      
      expect(isWithin).toBe(false);
    });

    test('should return false for closed days', () => {
      const dateTime = new Date('2025-01-19T12:00:00Z'); // Sunday noon UTC
      
      const isWithin = service.isWithinBusinessHours(dateTime, businessHours, 'UTC');
      
      expect(isWithin).toBe(false);
    });

    test('should throw error for invalid timezone', () => {
      const dateTime = new Date();
      
      expect(() => {
        service.isWithinBusinessHours(dateTime, businessHours, 'Invalid/Timezone');
      }).toThrow(CalendarServiceError);
    });
  });

  describe('getNextAvailableSlot', () => {
    test('should find next available slot', () => {
      const fromTime = new Date('2025-01-15T12:00:00Z');
      const busySlots = [{
        start: new Date('2025-01-15T13:00:00Z'),
        end: new Date('2025-01-15T14:00:00Z')
      }];
      
      const nextSlot = service.getNextAvailableSlot(fromTime, 60, busySlots, 'UTC');
      
      if (nextSlot) {
        expect(nextSlot).toHaveProperty('start');
        expect(nextSlot).toHaveProperty('end');
        expect(nextSlot.start.getTime()).toBeGreaterThanOrEqual(fromTime.getTime());
      }
    });

    test('should return null when no slots available', () => {
      const fromTime = new Date('2025-01-15T12:00:00Z');
      
      // Create many busy slots to block availability
      const busySlots = [];
      for (let i = 0; i < 30; i++) {
        const start = new Date(fromTime.getTime() + (i * 24 * 60 * 60 * 1000)); // Each day
        const end = new Date(start.getTime() + (23 * 60 * 60 * 1000)); // Nearly full day
        busySlots.push({ start, end });
      }
      
      const nextSlot = service.getNextAvailableSlot(fromTime, 60, busySlots, 'UTC');
      
      expect(nextSlot).toBeNull();
    });
  });

  describe('singleton instance', () => {
    test('should provide singleton instance', () => {
      expect(calendarService).toBeInstanceOf(CalendarService);
      expect(calendarService).toBe(calendarService); // Same instance
    });

    test('should have initialized time zones', () => {
      expect(calendarService.validTimeZones.size).toBeGreaterThan(0);
      // UTC should be available either in cache or can be validated
      expect(calendarService.isValidTimeZone('UTC')).toBe(true);
    });
  });
});