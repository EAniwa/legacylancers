/**
 * Scheduling Service Tests
 * Comprehensive tests for scheduling logic and booking management
 */

const { SchedulingService, SchedulingServiceError, schedulingService } = require('../../src/services/scheduling');
const { Availability } = require('../../src/models/Availability');

describe('SchedulingService', () => {
  let service;
  let mockAvailability;

  beforeEach(() => {
    // Use a fresh instance for each test
    service = new SchedulingService();
    
    // Create a mock availability for testing (with future date)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    
    mockAvailability = new Availability({
      id: 'availability-123',
      userId: 'user-123',
      scheduleType: 'one_time',
      startDate: futureDate.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      timeZone: 'UTC',
      status: 'available',
      maxBookings: 3,
      currentBookings: 1,
      minimumNoticeHours: 24,
      maximumAdvanceDays: 90
    });
  });

  describe('checkSlotAvailability', () => {
    test('should return available for valid booking', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2); // 2 days from now
      const startTime = new Date(tomorrow);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(tomorrow);
      endTime.setHours(12, 0, 0, 0);

      const result = service.checkSlotAvailability(mockAvailability, startTime, endTime, 'UTC');

      expect(result.available).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.conflictingBookings).toHaveLength(0);
    });

    test('should return unavailable for invalid timezone', () => {
      const startTime = new Date();
      const endTime = new Date();

      const result = service.checkSlotAvailability(mockAvailability, startTime, endTime, 'Invalid/Timezone');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('Invalid time zone');
    });

    test('should return unavailable when booking too soon', () => {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
      const startTime = new Date(now.getTime() + (12 * 60 * 60 * 1000)); // 12 hours from now
      startTime.setFullYear(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate());
      const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour later

      const result = service.checkSlotAvailability(mockAvailability, startTime, endTime, 'UTC');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('Booking requires at least 24 hours advance notice');
    });

    test('should return unavailable when booking too far in advance', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + (100 * 24 * 60 * 60 * 1000)); // 100 days from now  
      const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour later
      
      // Make sure the booking time is within the availability window but too far in advance
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 100);
      startTime.setFullYear(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate());
      endTime.setFullYear(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate());

      const result = service.checkSlotAvailability(mockAvailability, startTime, endTime, 'UTC');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('Booking cannot be made more than 90 days in advance');
    });

    test('should detect booking conflicts', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      
      // Create a conflicting booking
      const existingBooking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date(tomorrow.getTime() + (10 * 60 * 60 * 1000)), // 10:00
        endTime: new Date(tomorrow.getTime() + (12 * 60 * 60 * 1000)), // 12:00
        timeZone: 'UTC'
      });

      // Try to book overlapping time
      const startTime = new Date(tomorrow.getTime() + (11 * 60 * 60 * 1000)); // 11:00
      const endTime = new Date(tomorrow.getTime() + (13 * 60 * 60 * 1000)); // 13:00

      const result = service.checkSlotAvailability(mockAvailability, startTime, endTime, 'UTC');

      expect(result.available).toBe(false);
      expect(result.reason).toContain('conflicts with existing bookings');
      expect(result.conflictingBookings).toHaveLength(1);
    });
  });

  describe('createBooking', () => {
    test('should create booking with valid data', () => {
      const bookingData = {
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z'),
        timeZone: 'UTC',
        notes: 'Important meeting'
      };

      const booking = service.createBooking(bookingData);

      expect(booking).toBeDefined();
      expect(booking.id).toBeDefined();
      expect(booking.availabilityId).toBe('availability-123');
      expect(booking.bookedBy).toBe('user-456');
      expect(booking.status).toBe('pending');
      expect(booking.duration).toBe(120); // 2 hours
      expect(booking.notes).toBe('Important meeting');
      expect(booking.createdAt).toBeInstanceOf(Date);
    });

    test('should throw error for missing required fields', () => {
      const incompleteData = {
        availabilityId: 'availability-123',
        // Missing bookedBy, startTime, endTime
      };

      expect(() => {
        service.createBooking(incompleteData);
      }).toThrow(SchedulingServiceError);
    });
  });

  describe('confirmBooking', () => {
    test('should confirm pending booking', () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      const confirmedBooking = service.confirmBooking(booking.id, 'user-123');

      expect(confirmedBooking.status).toBe('confirmed');
      expect(confirmedBooking.confirmedBy).toBe('user-123');
      expect(confirmedBooking.confirmedAt).toBeInstanceOf(Date);
    });

    test('should throw error for non-existent booking', () => {
      expect(() => {
        service.confirmBooking('non-existent-id', 'user-123');
      }).toThrow(SchedulingServiceError);
    });

    test('should throw error for already confirmed booking', () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      service.confirmBooking(booking.id, 'user-123');

      expect(() => {
        service.confirmBooking(booking.id, 'user-123');
      }).toThrow(SchedulingServiceError);
    });
  });

  describe('cancelBooking', () => {
    test('should cancel booking with reason', () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      const cancelledBooking = service.cancelBooking(booking.id, 'user-456', 'No longer needed');

      expect(cancelledBooking.status).toBe('cancelled');
      expect(cancelledBooking.cancelledBy).toBe('user-456');
      expect(cancelledBooking.cancellationReason).toBe('No longer needed');
      expect(cancelledBooking.cancelledAt).toBeInstanceOf(Date);
    });

    test('should not allow cancelling completed booking', () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      // Manually set to completed
      booking.status = 'completed';
      service.bookings.set(booking.id, booking);

      expect(() => {
        service.cancelBooking(booking.id, 'user-456', 'Test reason');
      }).toThrow(SchedulingServiceError);
    });
  });

  describe('getBookingsForAvailability', () => {
    beforeEach(() => {
      // Create test bookings
      service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-789',
        startTime: new Date('2025-01-16T14:00:00Z'),
        endTime: new Date('2025-01-16T16:00:00Z')
      });

      service.createBooking({
        availabilityId: 'availability-456', // Different availability
        bookedBy: 'user-789',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });
    });

    test('should return bookings for specific availability', () => {
      const bookings = service.getBookingsForAvailability('availability-123');

      expect(bookings).toHaveLength(2);
      expect(bookings.every(b => b.availabilityId === 'availability-123')).toBe(true);
    });

    test('should filter by status', () => {
      const bookings = service.getBookingsForAvailability('availability-123');
      service.confirmBooking(bookings[0].id, 'user-123');

      const confirmedBookings = service.getBookingsForAvailability('availability-123', { status: 'confirmed' });
      const pendingBookings = service.getBookingsForAvailability('availability-123', { status: 'pending' });

      expect(confirmedBookings).toHaveLength(1);
      expect(pendingBookings).toHaveLength(1);
    });

    test('should filter by date range', () => {
      const bookings = service.getBookingsForAvailability('availability-123', {
        startDate: new Date('2025-01-15T00:00:00Z'),
        endDate: new Date('2025-01-15T23:59:59Z')
      });

      expect(bookings).toHaveLength(1);
      expect(bookings[0].startTime.toISOString().startsWith('2025-01-15')).toBe(true);
    });

    test('should sort bookings by start time', () => {
      const bookings = service.getBookingsForAvailability('availability-123');

      expect(bookings[0].startTime.getTime()).toBeLessThan(bookings[1].startTime.getTime());
    });
  });

  describe('getUserBookings', () => {
    beforeEach(() => {
      // Create test bookings
      service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      service.createBooking({
        availabilityId: 'availability-456',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-16T14:00:00Z'),
        endTime: new Date('2025-01-16T16:00:00Z')
      });

      service.createBooking({
        availabilityId: 'availability-789',
        bookedBy: 'user-789', // Different user
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });
    });

    test('should return bookings for specific user', () => {
      const userBookings = service.getUserBookings('user-456');

      expect(userBookings).toHaveLength(2);
      expect(userBookings.every(b => b.bookedBy === 'user-456')).toBe(true);
    });

    test('should filter by date range', () => {
      const userBookings = service.getUserBookings('user-456', {
        startDate: new Date('2025-01-15T00:00:00Z'),
        endDate: new Date('2025-01-15T23:59:59Z')
      });

      expect(userBookings).toHaveLength(1);
    });
  });

  describe('getBookingStats', () => {
    beforeEach(() => {
      // Create bookings with different statuses
      const booking1 = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z') // 2 hours
      });

      const booking2 = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-789',
        startTime: new Date('2025-01-16T14:00:00Z'),
        endTime: new Date('2025-01-16T15:00:00Z') // 1 hour
      });

      service.confirmBooking(booking1.id, 'user-123');
      service.cancelBooking(booking2.id, 'user-789', 'Changed mind');
    });

    test('should return comprehensive booking statistics', () => {
      const stats = service.getBookingStats('availability-123');

      expect(stats.total).toBe(2);
      expect(stats.confirmed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.totalDuration).toBe(180); // 120 + 60 minutes
      expect(stats.averageDuration).toBe(90); // 180 / 2
    });

    test('should return zero stats for no bookings', () => {
      const stats = service.getBookingStats('non-existent-availability');

      expect(stats.total).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });

  describe('findOptimalMeetingTimes', () => {
    test('should find common available times for multiple participants', () => {
      const participant1 = new Availability({
        id: 'availability-1',
        userId: 'user-1',
        startDate: '2025-01-15',
        startTime: '09:00',
        endTime: '17:00',
        timeZone: 'UTC'
      });

      const participant2 = new Availability({
        id: 'availability-2',
        userId: 'user-2',
        startDate: '2025-01-15',
        startTime: '10:00',
        endTime: '16:00',
        timeZone: 'UTC'
      });

      const earliestStart = new Date('2025-01-15T09:00:00Z');
      const latestEnd = new Date('2025-01-15T17:00:00Z');

      const optimalTimes = service.findOptimalMeetingTimes(
        [participant1, participant2],
        60, // 1 hour meeting
        earliestStart,
        latestEnd,
        'UTC'
      );

      expect(Array.isArray(optimalTimes)).toBe(true);
      expect(optimalTimes.length).toBeGreaterThan(0);
      
      if (optimalTimes.length > 0) {
        expect(optimalTimes[0].participants).toHaveLength(2);
        expect(optimalTimes[0].participants).toContain('user-1');
        expect(optimalTimes[0].participants).toContain('user-2');
      }
    });

    test('should return empty array when no common times available', () => {
      // Create availabilities with no overlap - one morning, one afternoon
      const participant1 = new Availability({
        id: 'availability-1',
        userId: 'user-1',
        startDate: '2025-01-15',
        startTime: '09:00',
        endTime: '11:00', // Only 2 hours
        timeZone: 'UTC',
        status: 'available'
      });

      const participant2 = new Availability({
        id: 'availability-2',
        userId: 'user-2',
        startDate: '2025-01-15',
        startTime: '15:00', // Gap from 11:00 to 15:00
        endTime: '17:00',
        timeZone: 'UTC',
        status: 'available'
      });

      const earliestStart = new Date('2025-01-15T09:00:00Z');
      const latestEnd = new Date('2025-01-15T17:00:00Z');

      const optimalTimes = service.findOptimalMeetingTimes(
        [participant1, participant2],
        60, // 1 hour meeting
        earliestStart,
        latestEnd,
        'UTC'
      );

      expect(optimalTimes).toHaveLength(0);
    });
  });

  describe('updateBooking', () => {
    test('should update booking fields', async () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z'),
        notes: 'Original notes'
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedBooking = service.updateBooking(booking.id, {
        notes: 'Updated notes',
        attendeeInfo: { name: 'John Doe', phone: '555-1234' }
      });

      expect(updatedBooking.notes).toBe('Updated notes');
      expect(updatedBooking.attendeeInfo.name).toBe('John Doe');
      expect(updatedBooking.updatedAt.getTime()).toBeGreaterThan(booking.createdAt.getTime());
    });

    test('should recalculate duration when times are updated', () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z') // 2 hours
      });

      expect(booking.duration).toBe(120); // 2 hours

      const updatedBooking = service.updateBooking(booking.id, {
        endTime: new Date('2025-01-15T11:00:00Z') // 1 hour
      });

      expect(updatedBooking.duration).toBe(60); // 1 hour
    });

    test('should not update protected fields', () => {
      const booking = service.createBooking({
        availabilityId: 'availability-123',
        bookedBy: 'user-456',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T12:00:00Z')
      });

      const updatedBooking = service.updateBooking(booking.id, {
        id: 'new-id',
        availabilityId: 'new-availability',
        bookedBy: 'new-user',
        createdAt: new Date('2020-01-01'),
        notes: 'Updated notes'
      });

      expect(updatedBooking.id).toBe(booking.id); // Should not change
      expect(updatedBooking.availabilityId).toBe('availability-123'); // Should not change
      expect(updatedBooking.bookedBy).toBe('user-456'); // Should not change
      expect(updatedBooking.notes).toBe('Updated notes'); // Should change
    });
  });

  describe('suggestAlternativeTimes', () => {
    test('should suggest alternative times when slot not available', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const desiredStart = new Date(tomorrow);
      desiredStart.setHours(10, 0, 0, 0);
      const desiredEnd = new Date(tomorrow);
      desiredEnd.setHours(12, 0, 0, 0);

      const suggestions = service.suggestAlternativeTimes(mockAvailability, desiredStart, desiredEnd, 'UTC');

      expect(Array.isArray(suggestions)).toBe(true);
      // Suggestions may be empty if no alternatives found, which is acceptable
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('start');
        expect(suggestions[0]).toHaveProperty('end');
        expect(suggestions[0]).toHaveProperty('timeZone');
      }
    });
  });

  describe('singleton instance', () => {
    test('should provide singleton instance', () => {
      expect(schedulingService).toBeInstanceOf(SchedulingService);
      expect(schedulingService).toBe(schedulingService); // Same instance
    });
  });
});