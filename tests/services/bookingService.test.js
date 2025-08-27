/**
 * Booking Service Unit Tests
 * Tests core booking business logic and workflows
 */

const { v4: uuidv4 } = require('uuid');
const { BookingService, BookingServiceError } = require('../../src/services/bookingService');
const { Booking, BookingError } = require('../../src/models/Booking');
const { User } = require('../../src/models/User');
const { Profile } = require('../../src/models/Profile');
const { BookingStateMachine, BOOKING_STATES } = require('../../src/utils/bookingStateMachine');

describe('BookingService', () => {
  let clientUser, retireeUser, clientProfile, retireeProfile;
  let testBookingData;

  beforeEach(async () => {
    // Reset models
    await Booking.reset();
    await Profile.reset();
    await User.reset();

    // Create test users
    clientUser = await User.create({
      email: 'client@test.com',
      password: 'password123',
      firstName: 'Client',
      lastName: 'User',
      emailVerified: true,
      status: 'active'
    });

    retireeUser = await User.create({
      email: 'retiree@test.com',
      password: 'password123',
      firstName: 'Retiree',
      lastName: 'Expert',
      emailVerified: true,
      status: 'active'
    });

    // Create test profiles
    clientProfile = await Profile.create({
      user_id: clientUser.id,
      display_name: 'Client User',
      headline: 'Looking for help'
    });

    retireeProfile = await Profile.create({
      user_id: retireeUser.id,
      display_name: 'Retiree Expert',
      headline: 'Consultant & Advisor',
      availability_status: 'available',
      hourly_rate: 150,
      currency: 'USD'
    });

    // Test booking data
    testBookingData = {
      clientId: clientUser.id,
      retireeId: retireeUser.id,
      clientProfileId: clientProfile.id,
      retireeProfileId: retireeProfile.id,
      title: 'Strategic Consulting Session',
      description: 'Need help with business strategy and planning for my startup.',
      engagementType: 'consulting',
      proposedRate: 120,
      proposedRateType: 'hourly',
      estimatedHours: 5,
      clientMessage: 'Looking forward to working with you!'
    };
  });

  afterEach(async () => {
    // Cleanup
    await Booking.reset();
    await Profile.reset();
    await User.reset();
  });

  describe('createBooking', () => {
    it('should create a booking successfully', async () => {
      const booking = await BookingService.createBooking(testBookingData, clientUser.id);

      expect(booking).toMatchObject({
        title: testBookingData.title,
        description: testBookingData.description,
        client_id: clientUser.id,
        retiree_id: retireeUser.id,
        status: BOOKING_STATES.REQUEST,
        engagement_type: 'consulting',
        proposed_rate: 120
      });
      expect(booking.client).toBeDefined();
      expect(booking.retiree).toBeDefined();
      expect(booking.client_profile).toBeDefined();
      expect(booking.retiree_profile).toBeDefined();
    });

    it('should reject booking creation by non-client', async () => {
      await expect(
        BookingService.createBooking(testBookingData, retireeUser.id)
      ).rejects.toThrow(BookingServiceError);
    });

    it('should validate client existence', async () => {
      const invalidData = { ...testBookingData, clientId: uuidv4() };
      
      await expect(
        BookingService.createBooking(invalidData, invalidData.clientId)
      ).rejects.toThrow('Client not found');
    });

    it('should validate retiree existence', async () => {
      const invalidData = { ...testBookingData, retireeId: uuidv4() };
      
      await expect(
        BookingService.createBooking(invalidData, clientUser.id)
      ).rejects.toThrow('Retiree not found');
    });

    it('should require verified emails', async () => {
      // Create unverified user
      const unverifiedUser = await User.create({
        email: 'unverified@test.com',
        password: 'password123',
        firstName: 'Unverified',
        lastName: 'User',
        emailVerified: false,
        status: 'active'
      });

      const invalidData = { ...testBookingData, retireeId: unverifiedUser.id };
      
      await expect(
        BookingService.createBooking(invalidData, clientUser.id)
      ).rejects.toThrow('email must be verified');
    });

    it('should require active user accounts', async () => {
      // Create inactive user
      const inactiveUser = await User.create({
        email: 'inactive@test.com',
        password: 'password123',
        firstName: 'Inactive',
        lastName: 'User',
        emailVerified: true,
        status: 'suspended'
      });

      const invalidData = { ...testBookingData, retireeId: inactiveUser.id };
      
      await expect(
        BookingService.createBooking(invalidData, clientUser.id)
      ).rejects.toThrow('account is not active');
    });

    it('should validate profile ownership', async () => {
      // Create profile for different user
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });

      const otherProfile = await Profile.create({
        user_id: otherUser.id,
        display_name: 'Other Profile'
      });

      const invalidData = { ...testBookingData, retireeProfileId: otherProfile.id };
      
      await expect(
        BookingService.createBooking(invalidData, clientUser.id)
      ).rejects.toThrow('Invalid retiree profile');
    });

    it('should check retiree availability', async () => {
      // Set retiree as unavailable
      await Profile.update(retireeProfile.id, { availability_status: 'unavailable' });

      await expect(
        BookingService.createBooking(testBookingData, clientUser.id)
      ).rejects.toThrow('currently unavailable for bookings');
    });

    it('should include requirements if provided', async () => {
      const dataWithRequirements = {
        ...testBookingData,
        requirements: [
          {
            requirement_type: 'skill',
            title: 'Strategic Planning Experience',
            description: 'At least 5 years of strategic planning experience',
            is_mandatory: true,
            min_years_experience: 5
          }
        ]
      };

      const booking = await BookingService.createBooking(dataWithRequirements, clientUser.id);
      expect(booking).toBeDefined();
      
      // Verify requirements were added
      const requirements = await Booking.getRequirements(booking.id);
      expect(requirements).toHaveLength(1);
      expect(requirements[0].title).toBe('Strategic Planning Experience');
    });
  });

  describe('acceptBooking', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await BookingService.createBooking(testBookingData, clientUser.id);
    });

    it('should allow retiree to accept booking', async () => {
      const acceptanceData = {
        response: 'Happy to help with this project!',
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      };

      const result = await BookingService.acceptBooking(
        testBooking.id,
        retireeUser.id,
        acceptanceData
      );

      expect(result.status).toBe(BOOKING_STATES.ACCEPTED);
      expect(result.agreed_rate).toBe(130);
      expect(result.retiree_response).toBe(acceptanceData.response);
    });

    it('should reject acceptance by client', async () => {
      await expect(
        BookingService.acceptBooking(testBooking.id, clientUser.id, {})
      ).rejects.toThrow('Not authorized to accept');
    });

    it('should validate state transition', async () => {
      // First accept the booking
      await BookingService.acceptBooking(testBooking.id, retireeUser.id, {
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      });

      // Try to accept again (invalid transition from accepted to accepted)
      await expect(
        BookingService.acceptBooking(testBooking.id, retireeUser.id, {})
      ).rejects.toThrow(BookingServiceError);
    });

    it('should handle non-existent booking', async () => {
      const fakeId = uuidv4();
      
      await expect(
        BookingService.acceptBooking(fakeId, retireeUser.id, {})
      ).rejects.toThrow('Booking not found');
    });
  });

  describe('rejectBooking', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await BookingService.createBooking(testBookingData, clientUser.id);
    });

    it('should allow retiree to reject booking', async () => {
      const rejectionReason = 'Unfortunately, I am not available during the requested timeframe.';

      const result = await BookingService.rejectBooking(
        testBooking.id,
        retireeUser.id,
        rejectionReason
      );

      expect(result.status).toBe(BOOKING_STATES.REJECTED);
      expect(result.rejection_reason).toBe(rejectionReason);
    });

    it('should reject rejection by client', async () => {
      await expect(
        BookingService.rejectBooking(testBooking.id, clientUser.id, 'test reason')
      ).rejects.toThrow('Not authorized to reject');
    });

    it('should require rejection reason', async () => {
      await expect(
        BookingService.rejectBooking(testBooking.id, retireeUser.id, '')
      ).rejects.toThrow('Rejection reason is required');
    });

    it('should handle whitespace-only reason', async () => {
      await expect(
        BookingService.rejectBooking(testBooking.id, retireeUser.id, '   ')
      ).rejects.toThrow('Rejection reason is required');
    });
  });

  describe('startBooking', () => {
    let acceptedBooking;

    beforeEach(async () => {
      const booking = await BookingService.createBooking(testBookingData, clientUser.id);
      acceptedBooking = await BookingService.acceptBooking(booking.id, retireeUser.id, {
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      });
    });

    it('should allow client to start booking', async () => {
      const result = await BookingService.startBooking(acceptedBooking.id, clientUser.id);

      expect(result.status).toBe(BOOKING_STATES.ACTIVE);
      expect(result.start_date).toBeDefined();
    });

    it('should allow retiree to start booking', async () => {
      const result = await BookingService.startBooking(acceptedBooking.id, retireeUser.id);

      expect(result.status).toBe(BOOKING_STATES.ACTIVE);
      expect(result.start_date).toBeDefined();
    });

    it('should reject unauthorized user', async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });

      await expect(
        BookingService.startBooking(acceptedBooking.id, otherUser.id)
      ).rejects.toThrow('Not authorized to start');
    });
  });

  describe('deliverBooking', () => {
    let activeBooking;

    beforeEach(async () => {
      const booking = await BookingService.createBooking(testBookingData, clientUser.id);
      const accepted = await BookingService.acceptBooking(booking.id, retireeUser.id, {
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      });
      activeBooking = await BookingService.startBooking(accepted.id, clientUser.id);
    });

    it('should allow retiree to deliver booking', async () => {
      const deliveryData = {
        notes: 'Completed all requested analysis and recommendations',
        deliverables: ['Strategy Report', 'Action Plan'],
        next_steps: 'Schedule follow-up meeting'
      };

      const result = await BookingService.deliverBooking(
        activeBooking.id,
        retireeUser.id,
        deliveryData
      );

      expect(result.status).toBe(BOOKING_STATES.DELIVERED);
      expect(result.delivery_date).toBeDefined();
    });

    it('should reject delivery by client', async () => {
      await expect(
        BookingService.deliverBooking(activeBooking.id, clientUser.id, {})
      ).rejects.toThrow('Only the retiree can mark booking as delivered');
    });
  });

  describe('completeBooking', () => {
    let deliveredBooking;

    beforeEach(async () => {
      const booking = await BookingService.createBooking(testBookingData, clientUser.id);
      const accepted = await BookingService.acceptBooking(booking.id, retireeUser.id, {
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      });
      const active = await BookingService.startBooking(accepted.id, clientUser.id);
      deliveredBooking = await BookingService.deliverBooking(active.id, retireeUser.id, {
        notes: 'Work completed successfully'
      });
    });

    it('should allow client to complete booking', async () => {
      const completionData = {
        client_rating: 5,
        retiree_rating: 4,
        client_feedback: 'Excellent work, very satisfied',
        retiree_feedback: 'Great client, clear communication'
      };

      const result = await BookingService.completeBooking(
        deliveredBooking.id,
        clientUser.id,
        completionData
      );

      expect(result.status).toBe(BOOKING_STATES.COMPLETED);
      expect(result.completion_date).toBeDefined();
      expect(result.client_rating).toBe(5);
      expect(result.retiree_rating).toBe(4);
    });

    it('should reject completion by retiree', async () => {
      await expect(
        BookingService.completeBooking(deliveredBooking.id, retireeUser.id, {})
      ).rejects.toThrow('Only the client can complete the booking');
    });

    it('should update retiree profile rating', async () => {
      const originalRating = retireeProfile.average_rating || 0;
      const originalReviews = retireeProfile.total_reviews || 0;

      await BookingService.completeBooking(deliveredBooking.id, clientUser.id, {
        retiree_rating: 5
      });

      // Verify profile was updated (this would require mocking or actual database)
      // For now, we just verify the method completes successfully
    });
  });

  describe('cancelBooking', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await BookingService.createBooking(testBookingData, clientUser.id);
    });

    it('should allow client to cancel booking', async () => {
      const cancellationReason = 'Changed requirements, no longer need this service.';

      const result = await BookingService.cancelBooking(
        testBooking.id,
        clientUser.id,
        cancellationReason
      );

      expect(result.status).toBe(BOOKING_STATES.CANCELLED);
      expect(result.cancellation_reason).toBe(cancellationReason);
    });

    it('should allow retiree to cancel booking', async () => {
      const cancellationReason = 'Emergency came up, cannot fulfill this booking.';

      const result = await BookingService.cancelBooking(
        testBooking.id,
        retireeUser.id,
        cancellationReason
      );

      expect(result.status).toBe(BOOKING_STATES.CANCELLED);
      expect(result.cancellation_reason).toBe(cancellationReason);
    });

    it('should require cancellation reason', async () => {
      await expect(
        BookingService.cancelBooking(testBooking.id, clientUser.id, '')
      ).rejects.toThrow('Cancellation reason is required');
    });

    it('should reject unauthorized cancellation', async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });

      await expect(
        BookingService.cancelBooking(testBooking.id, otherUser.id, 'test reason')
      ).rejects.toThrow('Not authorized to cancel');
    });

    it('should prevent cancellation of completed booking', async () => {
      // Create a completed booking
      const booking = await BookingService.createBooking(testBookingData, clientUser.id);
      const accepted = await BookingService.acceptBooking(booking.id, retireeUser.id, {
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      });
      const active = await BookingService.startBooking(accepted.id, clientUser.id);
      const delivered = await BookingService.deliverBooking(active.id, retireeUser.id, {});
      const completed = await BookingService.completeBooking(delivered.id, clientUser.id, {});

      await expect(
        BookingService.cancelBooking(completed.id, clientUser.id, 'test reason')
      ).rejects.toThrow('cannot be cancelled');
    });
  });

  describe('getBookingDetails', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await BookingService.createBooking(testBookingData, clientUser.id);
    });

    it('should return booking details for client', async () => {
      const result = await BookingService.getBookingDetails(testBooking.id, clientUser.id);

      expect(result).toMatchObject({
        id: testBooking.id,
        title: testBooking.title,
        status: BOOKING_STATES.REQUEST
      });
      expect(result.user_role).toBe('client');
      expect(result.requirements).toBeInstanceOf(Array);
      expect(result.history).toBeInstanceOf(Array);
      expect(result.next_possible_states).toBeInstanceOf(Array);
    });

    it('should return booking details for retiree', async () => {
      const result = await BookingService.getBookingDetails(testBooking.id, retireeUser.id);

      expect(result.user_role).toBe('retiree');
      expect(result.next_possible_states).toContain(BOOKING_STATES.ACCEPTED);
      expect(result.next_possible_states).toContain(BOOKING_STATES.REJECTED);
    });

    it('should reject unauthorized access', async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });

      await expect(
        BookingService.getBookingDetails(testBooking.id, otherUser.id)
      ).rejects.toThrow('Not authorized to view');
    });

    it('should handle non-existent booking', async () => {
      const fakeId = uuidv4();
      
      await expect(
        BookingService.getBookingDetails(fakeId, clientUser.id)
      ).rejects.toThrow('Booking not found');
    });
  });

  describe('searchBookings', () => {
    beforeEach(async () => {
      // Create multiple bookings for testing
      await BookingService.createBooking({
        ...testBookingData,
        title: 'Marketing Consultation',
        engagementType: 'freelance'
      }, clientUser.id);

      await BookingService.createBooking({
        ...testBookingData,
        title: 'Technical Review',
        engagementType: 'project'
      }, clientUser.id);
    });

    it('should search user bookings with filters', async () => {
      const result = await BookingService.searchBookings(
        { engagementType: 'consulting' },
        { limit: 10, offset: 0 },
        clientUser.id
      );

      expect(result.bookings).toBeInstanceOf(Array);
      expect(result.pagination).toMatchObject({
        total: expect.any(Number),
        limit: 10,
        offset: 0,
        hasMore: expect.any(Boolean)
      });
      expect(result.summary).toBeDefined();

      // All results should match filter
      result.bookings.forEach(booking => {
        expect(booking.engagement_type).toBe('consulting');
      });
    });

    it('should restrict search to user bookings', async () => {
      const result = await BookingService.searchBookings(
        {},
        { limit: 20 },
        clientUser.id
      );

      // All bookings should involve the requesting user
      result.bookings.forEach(booking => {
        expect(
          booking.client_id === clientUser.id || booking.retiree_id === clientUser.id
        ).toBe(true);
      });
    });

    it('should handle non-existent user', async () => {
      const fakeUserId = uuidv4();
      
      await expect(
        BookingService.searchBookings({}, {}, fakeUserId)
      ).rejects.toThrow('User not found');
    });

    it('should prevent unauthorized access to other user bookings', async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active',
        role: 'user' // Not admin
      });

      await expect(
        BookingService.searchBookings(
          { clientId: clientUser.id },
          {},
          otherUser.id
        )
      ).rejects.toThrow('Cannot access other users');
    });
  });

  describe('updateBooking', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await BookingService.createBooking(testBookingData, clientUser.id);
    });

    it('should allow client to update booking', async () => {
      const updateData = {
        title: 'Updated Strategic Consulting',
        estimated_hours: 10,
        urgency_level: 'urgent'
      };

      const result = await BookingService.updateBooking(
        testBooking.id,
        updateData,
        clientUser.id
      );

      expect(result.title).toBe(updateData.title);
      expect(result.estimated_hours).toBe(updateData.estimated_hours);
      expect(result.urgency_level).toBe(updateData.urgency_level);
    });

    it('should allow retiree to update allowed fields', async () => {
      const updateData = {
        retiree_response: 'Looking forward to this project'
      };

      const result = await BookingService.updateBooking(
        testBooking.id,
        updateData,
        retireeUser.id
      );

      expect(result.retiree_response).toBe(updateData.retiree_response);
    });

    it('should reject unauthorized updates', async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });

      await expect(
        BookingService.updateBooking(testBooking.id, { title: 'Hack' }, otherUser.id)
      ).rejects.toThrow('Not authorized to update');
    });
  });

  describe('getUserBookingStats', () => {
    beforeEach(async () => {
      // Create bookings for stats testing
      await BookingService.createBooking(testBookingData, clientUser.id);
      
      const booking = await BookingService.createBooking({
        ...testBookingData,
        clientId: retireeUser.id, // Retiree as client
        retireeId: clientUser.id, // Client as retiree
        title: 'Reverse Booking'
      }, retireeUser.id);
    });

    it('should return user booking statistics', async () => {
      const stats = await BookingService.getUserBookingStats(clientUser.id);

      expect(stats).toMatchObject({
        as_client: {
          total: expect.any(Number),
          byStatus: expect.any(Object),
          byEngagementType: expect.any(Object),
          totalValue: expect.any(Number),
          averageRate: expect.any(Number)
        },
        as_retiree: {
          total: expect.any(Number),
          byStatus: expect.any(Object),
          byEngagementType: expect.any(Object),
          totalValue: expect.any(Number),
          averageRate: expect.any(Number)
        },
        combined: {
          total: expect.any(Number),
          totalValue: expect.any(Number),
          averageRate: expect.any(Number)
        }
      });
    });

    it('should handle non-existent user', async () => {
      const fakeUserId = uuidv4();
      
      await expect(
        BookingService.getUserBookingStats(fakeUserId)
      ).rejects.toThrow('User not found');
    });
  });

  describe('findActiveBookingsBetweenUsers', () => {
    it('should find active bookings between users', async () => {
      await BookingService.createBooking(testBookingData, clientUser.id);
      
      const activeBookings = await BookingService.findActiveBookingsBetweenUsers(
        clientUser.id,
        retireeUser.id
      );

      expect(activeBookings).toBeInstanceOf(Array);
      expect(activeBookings.length).toBeGreaterThan(0);
    });

    it('should return empty array for no bookings', async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });

      const activeBookings = await BookingService.findActiveBookingsBetweenUsers(
        clientUser.id,
        otherUser.id
      );

      expect(activeBookings).toEqual([]);
    });
  });

  describe('enrichBookingData', () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await BookingService.createBooking(testBookingData, clientUser.id);
    });

    it('should enrich booking with user and profile data', async () => {
      const enriched = await BookingService.enrichBookingData(testBooking);

      expect(enriched.client).toMatchObject({
        id: clientUser.id,
        firstName: clientUser.firstName,
        lastName: clientUser.lastName,
        email: clientUser.email
      });
      expect(enriched.retiree).toMatchObject({
        id: retireeUser.id,
        firstName: retireeUser.firstName,
        lastName: retireeUser.lastName
      });
      expect(enriched.client_profile).toBeDefined();
      expect(enriched.retiree_profile).toBeDefined();
      expect(enriched.state_description).toBe('Booking request created');
      expect(enriched.is_final_state).toBe(false);
      expect(enriched.can_be_cancelled).toBe(true);
    });

    it('should handle booking without profiles', async () => {
      const bookingWithoutProfiles = await Booking.create({
        clientId: clientUser.id,
        retireeId: retireeUser.id,
        title: 'No Profiles Booking',
        description: 'Test booking without profiles'
      }, clientUser.id);

      const enriched = await BookingService.enrichBookingData(bookingWithoutProfiles);

      expect(enriched.client_profile).toBeNull();
      expect(enriched.retiree_profile).toBeNull();
      expect(enriched.client).toBeDefined();
      expect(enriched.retiree).toBeDefined();
    });

    it('should gracefully handle errors', async () => {
      // Create a booking with invalid user references
      const invalidBooking = {
        ...testBooking,
        client_id: uuidv4(),
        retiree_id: uuidv4()
      };

      const enriched = await BookingService.enrichBookingData(invalidBooking);
      
      // Should return original booking if enrichment fails
      expect(enriched).toEqual(invalidBooking);
    });
  });

  describe('getBookingsSummary', () => {
    let bookings;

    beforeEach(async () => {
      const booking1 = await BookingService.createBooking(testBookingData, clientUser.id);
      const booking2 = await BookingService.createBooking({
        ...testBookingData,
        title: 'Marketing Consultation',
        engagementType: 'freelance',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next week
      }, clientUser.id);

      bookings = [booking1, booking2];
    });

    it('should generate comprehensive booking summary', async () => {
      const summary = BookingService.getBookingsSummary(bookings);

      expect(summary).toMatchObject({
        total: 2,
        by_status: expect.any(Object),
        by_engagement_type: expect.any(Object),
        upcoming: expect.any(Number),
        overdue: expect.any(Number),
        total_value: expect.any(Number)
      });

      expect(summary.by_status.request).toBe(2);
      expect(summary.by_engagement_type.consulting).toBe(1);
      expect(summary.by_engagement_type.freelance).toBe(1);
    });

    it('should handle empty bookings array', async () => {
      const summary = BookingService.getBookingsSummary([]);

      expect(summary).toMatchObject({
        total: 0,
        by_status: {},
        by_engagement_type: {},
        upcoming: 0,
        overdue: 0,
        total_value: 0
      });
    });
  });
});