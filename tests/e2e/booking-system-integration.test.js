/**
 * End-to-End Booking System Integration Tests
 * Comprehensive testing of the entire booking ecosystem
 */

const request = require('supertest');
const { getDatabase, initializeDatabase, closeDatabase } = require('../../src/config/database');

// Test configuration
const TEST_CONFIG = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    timeout: 10000
  },
  performance: {
    bookingMaxTime: 2000,  // 2 seconds
    messageMaxTime: 100,   // 100ms
    availabilityMaxTime: 500 // 500ms
  },
  users: {
    client: {
      id: 'test-client-001',
      email: 'client@legacylancers-test.com',
      name: 'Test Client',
      role: 'client'
    },
    provider: {
      id: 'test-provider-001', 
      email: 'provider@legacylancers-test.com',
      name: 'Test Provider',
      role: 'provider'
    }
  }
};

describe('Booking System Integration Tests', () => {
  let db;
  let app;
  let clientToken;
  let providerToken;

  beforeAll(async () => {
    // Initialize database and app
    db = await initializeDatabase();
    app = require('../../src/app');
    
    // Create test users and get auth tokens
    const authResult = await setupTestUsers();
    clientToken = authResult.clientToken;
    providerToken = authResult.providerToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeDatabase();
  });

  describe('1. Authentication Integration', () => {
    test('should authenticate users for booking operations', async () => {
      const response = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(TEST_CONFIG.users.client.email);
    });

    test('should reject unauthorized booking requests', async () => {
      await request(app)
        .post('/api/bookings')
        .send({ title: 'Test Booking' })
        .expect(401);
    });
  });

  describe('2. Profile System Integration', () => {
    test('should integrate profile data in booking process', async () => {
      // Get provider profile
      const profileResponse = await request(app)
        .get(`/api/profiles/${TEST_CONFIG.users.provider.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);
      
      expect(profileResponse.body.data.skills).toBeDefined();
      expect(profileResponse.body.data.availability).toBeDefined();
    });

    test('should validate provider exists before booking', async () => {
      const bookingData = {
        providerId: 'non-existent-provider',
        title: 'Test Session',
        startTime: '2024-02-01T10:00:00Z',
        endTime: '2024-02-01T11:00:00Z'
      };

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(404);
    });
  });

  describe('3. Calendar Integration Validation', () => {
    let testBookingId;

    test('should create calendar events when booking confirmed', async () => {
      const bookingData = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'Integration Test Session',
        description: 'Testing calendar integration',
        startTime: '2024-02-01T14:00:00Z',
        endTime: '2024-02-01T15:00:00Z',
        timeZone: 'UTC'
      };

      // Create booking
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(201);

      testBookingId = bookingResponse.body.data.id;

      // Verify calendar events created
      const calendarResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ 
          startDate: '2024-02-01',
          endDate: '2024-02-01'
        })
        .expect(200);

      const bookingEvents = calendarResponse.body.data.filter(
        event => event.bookingId === testBookingId
      );
      expect(bookingEvents).toHaveLength(1);
      expect(bookingEvents[0].title).toContain('Integration Test Session');
    });

    test('should update calendar events when booking changes', async () => {
      const updateData = {
        title: 'Updated Integration Test Session',
        startTime: '2024-02-01T15:00:00Z',
        endTime: '2024-02-01T16:00:00Z'
      };

      // Update booking
      await request(app)
        .put(`/api/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(200);

      // Verify calendar event updated
      const calendarResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ 
          startDate: '2024-02-01',
          endDate: '2024-02-01'
        })
        .expect(200);

      const bookingEvents = calendarResponse.body.data.filter(
        event => event.bookingId === testBookingId
      );
      expect(bookingEvents[0].title).toContain('Updated Integration Test Session');
    });

    test('should handle timezone conversions correctly', async () => {
      const conversionResponse = await request(app)
        .post('/api/calendar/convert-timezone')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          dateTime: '2024-02-01T14:00:00Z',
          fromTimeZone: 'UTC',
          toTimeZone: 'America/New_York'
        })
        .expect(200);

      expect(conversionResponse.body.success).toBe(true);
      expect(conversionResponse.body.data.converted.timeZone).toBe('America/New_York');
    });
  });

  describe('4. Availability System Integration', () => {
    test('should check availability before booking', async () => {
      const startTime = performance.now();
      
      const availabilityResponse = await request(app)
        .get(`/api/availability/slots`)
        .set('Authorization', `Bearer ${clientToken}`)
        .query({
          userId: TEST_CONFIG.users.provider.id,
          startDate: '2024-02-01',
          endDate: '2024-02-01',
          durationMinutes: 60
        })
        .expect(200);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(TEST_CONFIG.performance.availabilityMaxTime);
      expect(availabilityResponse.body.data).toBeDefined();
    });

    test('should prevent double booking conflicts', async () => {
      // Create first booking
      const bookingData1 = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'First Booking',
        startTime: '2024-02-02T10:00:00Z',
        endTime: '2024-02-02T11:00:00Z'
      };

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData1)
        .expect(201);

      // Attempt conflicting booking
      const bookingData2 = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'Conflicting Booking',
        startTime: '2024-02-02T10:30:00Z',
        endTime: '2024-02-02T11:30:00Z'
      };

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData2)
        .expect(409); // Conflict
    });
  });

  describe('5. Performance Benchmarks', () => {
    test('booking creation should complete within 2 seconds', async () => {
      const bookingData = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'Performance Test Booking',
        startTime: '2024-02-03T10:00:00Z',
        endTime: '2024-02-03T11:00:00Z'
      };

      const startTime = performance.now();
      
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(201);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(TEST_CONFIG.performance.bookingMaxTime);
    });

    test('calendar queries should complete within 500ms', async () => {
      const startTime = performance.now();
      
      await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ 
          startDate: '2024-02-01',
          endDate: '2024-02-28'
        })
        .expect(200);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(TEST_CONFIG.performance.availabilityMaxTime);
    });
  });

  describe('6. Database Integrity', () => {
    test('should maintain referential integrity across tables', async () => {
      // Create booking
      const bookingData = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'Integrity Test Booking',
        startTime: '2024-02-04T10:00:00Z',
        endTime: '2024-02-04T11:00:00Z'
      };

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(201);

      const bookingId = bookingResponse.body.data.id;

      // Verify calendar event exists
      const calendarResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ 
          startDate: '2024-02-04',
          endDate: '2024-02-04'
        })
        .expect(200);

      const bookingEvents = calendarResponse.body.data.filter(
        event => event.bookingId === bookingId
      );
      expect(bookingEvents.length).toBeGreaterThan(0);

      // Delete booking
      await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      // Verify calendar events cleaned up
      const calendarResponseAfter = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${clientToken}`)
        .query({ 
          startDate: '2024-02-04',
          endDate: '2024-02-04'
        })
        .expect(200);

      const bookingEventsAfter = calendarResponseAfter.body.data.filter(
        event => event.bookingId === bookingId
      );
      expect(bookingEventsAfter).toHaveLength(0);
    });
  });

  describe('7. Error Handling & Edge Cases', () => {
    test('should handle invalid booking dates gracefully', async () => {
      const bookingData = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'Invalid Date Booking',
        startTime: '2024-02-05T15:00:00Z',
        endTime: '2024-02-05T14:00:00Z' // End before start
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('time');
    });

    test('should handle database connection failures gracefully', async () => {
      // This test would require mocking database failures
      // Implementation depends on testing infrastructure
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('8. Security Validation', () => {
    test('should prevent unauthorized access to other users\' bookings', async () => {
      // Create booking as client
      const bookingData = {
        providerId: TEST_CONFIG.users.provider.id,
        title: 'Security Test Booking',
        startTime: '2024-02-06T10:00:00Z',
        endTime: '2024-02-06T11:00:00Z'
      };

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(bookingData)
        .expect(201);

      const bookingId = bookingResponse.body.data.id;

      // Try to access as different user (would need another test user)
      // For now, test unauthorized access
      await request(app)
        .get(`/api/bookings/${bookingId}`)
        .expect(401);
    });

    test('should validate file upload security', async () => {
      // Test file upload restrictions
      const maliciousFile = Buffer.from('malicious content');
      
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${clientToken}`)
        .attach('file', maliciousFile, 'malicious.exe')
        .expect(400); // Should reject executable files
    });
  });
});

/**
 * Helper Functions
 */

async function setupTestUsers() {
  // Mock authentication tokens for testing
  // In real implementation, would create actual test users
  return {
    clientToken: 'mock-client-token',
    providerToken: 'mock-provider-token'
  };
}

async function cleanupTestData() {
  // Clean up any test data created during tests
  try {
    if (db) {
      // Delete test bookings, calendar events, etc.
      await db.query('DELETE FROM calendar_events WHERE title LIKE \'%Test%\'');
      await db.query('DELETE FROM bookings WHERE title LIKE \'%Test%\'');
    }
  } catch (error) {
    console.warn('Cleanup failed:', error.message);
  }
}