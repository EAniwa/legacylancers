/**
 * Booking Routes Integration Tests
 * Tests all booking API endpoints with authentication and validation
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../../../src/app');
const { User } = require('../../../src/models/User');
const { Profile } = require('../../../src/models/Profile');
const { Booking } = require('../../../src/models/Booking');
const { generateJWT } = require('../../../src/auth/jwt');

describe('Booking Routes Integration Tests', () => {
  let clientUser, retireeUser, clientProfile, retireeProfile;
  let clientToken, retireeToken;
  let testBooking;

  beforeEach(async () => {
    // Reset booking model
    await Booking.reset();

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
      headline: 'Looking for help',
      bio: 'A client seeking expertise'
    });

    retireeProfile = await Profile.create({
      user_id: retireeUser.id,
      display_name: 'Retiree Expert',
      headline: 'Consultant & Advisor',
      bio: 'Experienced professional ready to help',
      availability_status: 'available',
      hourly_rate: 150,
      currency: 'USD'
    });

    // Generate JWT tokens
    clientToken = generateJWT({ id: clientUser.id, email: clientUser.email });
    retireeToken = generateJWT({ id: retireeUser.id, email: retireeUser.email });

    // Create a test booking
    testBooking = await Booking.create({
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
    }, clientUser.id);
  });

  afterEach(async () => {
    // Cleanup
    await Booking.reset();
    await Profile.reset();
    await User.reset();
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking with valid data', async () => {
      const bookingData = {
        clientId: clientUser.id,
        retireeId: retireeUser.id,
        clientProfileId: clientProfile.id,
        retireeProfileId: retireeProfile.id,
        title: 'Marketing Strategy Consultation',
        description: 'Need comprehensive marketing strategy for my business expansion.',
        engagementType: 'consulting',
        proposedRate: 100,
        proposedRateType: 'hourly',
        estimatedHours: 8,
        urgencyLevel: 'high',
        clientMessage: 'This is urgent, can we start ASAP?'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: bookingData.title,
        description: bookingData.description,
        client_id: clientUser.id,
        retiree_id: retireeUser.id,
        status: 'request',
        engagement_type: 'consulting',
        proposed_rate: 100,
        urgency_level: 'high'
      });
      expect(response.body.data.client).toMatchObject({
        id: clientUser.id,
        firstName: clientUser.firstName,
        email: clientUser.email
      });
      expect(response.body.data.retiree).toMatchObject({
        id: retireeUser.id,
        firstName: retireeUser.firstName
      });
    });

    it('should reject booking creation without authentication', async () => {
      const bookingData = {
        clientId: clientUser.id,
        retireeId: retireeUser.id,
        title: 'Test Booking',
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject booking with missing required fields', async () => {
      const bookingData = {
        clientId: clientUser.id,
        // Missing retireeId, title, description
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('REQUIRED_FIELD');
    });

    it('should reject booking when client and retiree are the same', async () => {
      const bookingData = {
        clientId: clientUser.id,
        retireeId: clientUser.id, // Same as client
        title: 'Test Booking',
        description: 'Test description longer than ten characters'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SAME_USER');
    });

    it('should reject booking with invalid rate', async () => {
      const bookingData = {
        clientId: clientUser.id,
        retireeId: retireeUser.id,
        title: 'Test Booking',
        description: 'Test description longer than ten characters',
        proposedRate: -50 // Invalid negative rate
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bookings', () => {
    beforeEach(async () => {
      // Create additional test bookings
      await Booking.create({
        clientId: clientUser.id,
        retireeId: retireeUser.id,
        title: 'Another Consultation',
        description: 'Another consultation session',
        engagementType: 'freelance'
      }, clientUser.id);
    });

    it('should get user bookings with default pagination', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toMatchObject({
        total: expect.any(Number),
        limit: 20,
        offset: 0,
        hasMore: expect.any(Boolean)
      });
      expect(response.body.summary).toBeDefined();
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/bookings?status=request')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach(booking => {
        expect(booking.status).toBe('request');
      });
    });

    it('should filter bookings by engagement type', async () => {
      const response = await request(app)
        .get('/api/bookings?engagement_type=consulting')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(booking => {
        expect(booking.engagement_type).toBe('consulting');
      });
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/bookings?limit=invalid')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_INTEGER');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/bookings?limit=1')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/bookings/:bookingId', () => {
    it('should get booking details for authorized user', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testBooking.id,
        title: testBooking.title,
        description: testBooking.description,
        status: 'request'
      });
      expect(response.body.data.user_role).toBe('client');
      expect(response.body.data.requirements).toBeInstanceOf(Array);
      expect(response.body.data.history).toBeInstanceOf(Array);
      expect(response.body.data.next_possible_states).toBeInstanceOf(Array);
    });

    it('should reject access for unauthorized user', async () => {
      // Create another user who shouldn't have access
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        emailVerified: true,
        status: 'active'
      });
      const otherToken = generateJWT({ id: otherUser.id, email: otherUser.email });

      const response = await request(app)
        .get(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UNAUTHORIZED_VIEW');
    });

    it('should return 404 for non-existent booking', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/bookings/${fakeId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BOOKING_NOT_FOUND');
    });

    it('should validate booking ID format', async () => {
      const response = await request(app)
        .get('/api/bookings/invalid-uuid')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_UUID');
    });
  });

  describe('POST /api/bookings/:bookingId/accept', () => {
    it('should allow retiree to accept booking', async () => {
      const acceptanceData = {
        response: 'Happy to help with this project!',
        agreed_rate: 130,
        agreed_rate_type: 'hourly'
      };

      const response = await request(app)
        .post(`/api/bookings/${testBooking.id}/accept`)
        .set('Authorization', `Bearer ${retireeToken}`)
        .send(acceptanceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('accepted');
      expect(response.body.data.agreed_rate).toBe(130);
      expect(response.body.data.retiree_response).toBe(acceptanceData.response);
    });

    it('should reject acceptance by client', async () => {
      const response = await request(app)
        .post(`/api/bookings/${testBooking.id}/accept`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ response: 'Test' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UNAUTHORIZED_ACCEPTANCE');
    });

    it('should validate agreed rate', async () => {
      const response = await request(app)
        .post(`/api/bookings/${testBooking.id}/accept`)
        .set('Authorization', `Bearer ${retireeToken}`)
        .send({ agreed_rate: -10 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings/:bookingId/reject', () => {
    it('should allow retiree to reject booking', async () => {
      const rejectionData = {
        reason: 'Unfortunately, I am not available during the requested timeframe.'
      };

      const response = await request(app)
        .post(`/api/bookings/${testBooking.id}/reject`)
        .set('Authorization', `Bearer ${retireeToken}`)
        .send(rejectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
      expect(response.body.data.rejection_reason).toBe(rejectionData.reason);
    });

    it('should require rejection reason', async () => {
      const response = await request(app)
        .post(`/api/bookings/${testBooking.id}/reject`)
        .set('Authorization', `Bearer ${retireeToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('REQUIRED_FIELD');
    });

    it('should validate minimum length for rejection reason', async () => {
      const response = await request(app)
        .post(`/api/bookings/${testBooking.id}/reject`)
        .set('Authorization', `Bearer ${retireeToken}`)
        .send({ reason: 'Too short' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_LENGTH');
    });
  });

  describe('PUT /api/bookings/:bookingId', () => {
    it('should allow client to update booking details', async () => {
      const updateData = {
        title: 'Updated Strategic Consulting',
        estimated_hours: 10,
        urgency_level: 'urgent'
      };

      const response = await request(app)
        .put(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.estimated_hours).toBe(updateData.estimated_hours);
      expect(response.body.data.urgency_level).toBe(updateData.urgency_level);
    });

    it('should validate update fields', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ title: 'x' }) // Too short
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_LENGTH');
    });

    it('should reject empty update', async () => {
      const response = await request(app)
        .put(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_UPDATE_FIELDS');
    });
  });

  describe('DELETE /api/bookings/:bookingId', () => {
    it('should allow client to cancel booking', async () => {
      const cancellationData = {
        reason: 'Changed requirements, no longer need this service.'
      };

      const response = await request(app)
        .delete(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(cancellationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.data.cancellation_reason).toBe(cancellationData.reason);
    });

    it('should require cancellation reason', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${testBooking.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('REQUIRED_FIELD');
    });
  });

  describe('GET /api/bookings/:bookingId/transitions', () => {
    it('should get available transitions for current user', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBooking.id}/transitions`)
        .set('Authorization', `Bearer ${retireeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.current_state).toBe('request');
      expect(response.body.data.user_role).toBe('retiree');
      expect(response.body.data.available_transitions).toBeInstanceOf(Array);
      
      const transitions = response.body.data.available_transitions;
      expect(transitions.some(t => t.state === 'accepted')).toBe(true);
      expect(transitions.some(t => t.state === 'rejected')).toBe(true);
    });
  });

  describe('GET /api/bookings/:bookingId/history', () => {
    it('should get booking history', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBooking.id}/history`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const historyEntry = response.body.data[0];
      expect(historyEntry).toMatchObject({
        booking_id: testBooking.id,
        event_type: 'status_change',
        to_status: 'request'
      });
    });

    it('should validate history query parameters', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBooking.id}/history?limit=invalid`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_INTEGER');
    });
  });

  describe('GET /api/bookings/dashboard', () => {
    it('should get user dashboard data', async () => {
      const response = await request(app)
        .get('/api/bookings/dashboard')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        statistics: expect.any(Object),
        recent_bookings: expect.any(Array),
        active_bookings: expect.any(Array),
        summary: expect.any(Object)
      });
    });
  });

  describe('GET /api/bookings/stats', () => {
    it('should get user booking statistics', async () => {
      const response = await request(app)
        .get('/api/bookings/stats')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        as_client: expect.any(Object),
        as_retiree: expect.any(Object),
        combined: expect.any(Object)
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting for booking creation', async () => {
      const bookingData = {
        clientId: clientUser.id,
        retireeId: retireeUser.id,
        title: 'Rate Limit Test',
        description: 'Testing rate limiting functionality'
      };

      // Make 11 requests quickly (limit is 10 per hour)
      const promises = Array.from({ length: 11 }, () =>
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${clientToken}`)
          .send(bookingData)
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      expect(rateLimitedResponse).toBeDefined();
      expect(rateLimitedResponse.body.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // This test would require mocking to simulate internal errors
      // For now, we'll test that the error structure is correct
      const response = await request(app)
        .get('/api/bookings/invalid-uuid-format')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });
  });
});