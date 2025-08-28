/**
 * Booking System Performance Tests
 * Load testing and performance validation for booking system
 */

const request = require('supertest');
const { performance } = require('perf_hooks');

// Performance test configuration
const PERFORMANCE_CONFIG = {
  thresholds: {
    booking: 2000,        // 2 seconds max
    calendar: 500,        // 500ms max
    messaging: 100,       // 100ms max
    availability: 500     // 500ms max
  },
  load: {
    concurrent: 50,       // Concurrent requests
    duration: 30000,      // 30 seconds
    rampUp: 5000         // 5 seconds ramp-up
  }
};

describe('Booking System Performance Tests', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    app = require('../../src/app');
    authToken = await getTestAuthToken();
  });

  describe('Response Time Benchmarks', () => {
    test('booking creation should meet performance threshold', async () => {
      const bookingData = {
        providerId: 'test-provider',
        title: 'Performance Test Booking',
        startTime: '2024-02-01T10:00:00Z',
        endTime: '2024-02-01T11:00:00Z'
      };

      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData);

      const responseTime = performance.now() - startTime;

      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.booking);
      
      console.log(`Booking creation time: ${responseTime.toFixed(2)}ms`);
    });

    test('availability queries should meet performance threshold', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        await request(app)
          .get('/api/availability/slots')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            userId: 'test-provider',
            startDate: '2024-02-01',
            endDate: '2024-02-28',
            durationMinutes: 60
          })
          .expect(200);

        const responseTime = performance.now() - startTime;
        times.push(responseTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.availability);
      expect(maxTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.availability * 2);
      
      console.log(`Average availability query time: ${avgTime.toFixed(2)}ms`);
      console.log(`Max availability query time: ${maxTime.toFixed(2)}ms`);
    });

    test('calendar operations should meet performance threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          startDate: '2024-02-01',
          endDate: '2024-02-28'
        })
        .expect(200);

      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.calendar);
      
      console.log(`Calendar query time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Load Testing', () => {
    test('should handle concurrent booking requests', async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const bookingData = {
          providerId: `test-provider-${i % 5}`, // Distribute across 5 providers
          title: `Load Test Booking ${i}`,
          startTime: new Date(Date.now() + i * 3600000).toISOString(), // Staggered times
          endTime: new Date(Date.now() + i * 3600000 + 3600000).toISOString()
        };

        const promise = request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${authToken}`)
          .send(bookingData);

        promises.push({ promise, startTime: performance.now() });
      }

      const results = await Promise.allSettled(
        promises.map(p => p.promise)
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successCount / concurrentRequests) * 100;

      expect(successRate).toBeGreaterThan(90); // 90% success rate minimum
      
      console.log(`Concurrent booking success rate: ${successRate.toFixed(2)}%`);
    });

    test('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const requestInterval = 200; // Request every 200ms
      const startTime = Date.now();
      const responses = [];

      while (Date.now() - startTime < duration) {
        const reqStartTime = performance.now();
        
        try {
          const response = await request(app)
            .get('/api/calendar/events')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ 
              startDate: '2024-02-01',
              endDate: '2024-02-07'
            });

          const responseTime = performance.now() - reqStartTime;
          
          responses.push({
            status: response.status,
            time: responseTime,
            timestamp: Date.now()
          });

        } catch (error) {
          responses.push({
            status: 'error',
            time: performance.now() - reqStartTime,
            timestamp: Date.now(),
            error: error.message
          });
        }

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      const successResponses = responses.filter(r => r.status === 200);
      const avgResponseTime = successResponses.reduce((sum, r) => sum + r.time, 0) / successResponses.length;
      const successRate = (successResponses.length / responses.length) * 100;

      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.thresholds.calendar * 1.5);

      console.log(`Sustained load success rate: ${successRate.toFixed(2)}%`);
      console.log(`Average response time under load: ${avgResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not have significant memory leaks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ 
            startDate: '2024-02-01',
            endDate: '2024-02-07'
          })
          .expect(200);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be less than 50% after 100 requests
      expect(memoryIncreasePercent).toBeLessThan(50);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)`);
    });
  });

  describe('Database Performance', () => {
    test('should maintain database query performance', async () => {
      const queryTests = [
        {
          name: 'booking queries',
          endpoint: '/api/bookings',
          threshold: 1000
        },
        {
          name: 'calendar queries', 
          endpoint: '/api/calendar/events',
          threshold: 500
        },
        {
          name: 'availability queries',
          endpoint: '/api/availability/slots',
          threshold: 500
        }
      ];

      for (const test of queryTests) {
        const times = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          
          await request(app)
            .get(test.endpoint)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          times.push(performance.now() - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        expect(avgTime).toBeLessThan(test.threshold);

        console.log(`${test.name} average time: ${avgTime.toFixed(2)}ms`);
      }
    });
  });

  describe('Stress Testing', () => {
    test('should handle peak load gracefully', async () => {
      const peakConcurrent = 100;
      const promises = [];

      console.log(`Starting stress test with ${peakConcurrent} concurrent requests...`);

      for (let i = 0; i < peakConcurrent; i++) {
        const promise = request(app)
          .get('/api/calendar/events')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ 
            startDate: '2024-02-01',
            endDate: '2024-02-07'
          })
          .then(response => ({
            status: response.status,
            time: Date.now()
          }))
          .catch(error => ({
            status: 'error',
            error: error.message,
            time: Date.now()
          }));

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.status === 200).length;
      const errorCount = results.filter(r => r.status === 'error').length;
      const successRate = (successCount / peakConcurrent) * 100;

      // Under stress, we accept 80% success rate
      expect(successRate).toBeGreaterThan(80);

      console.log(`Stress test results:`);
      console.log(`  Success: ${successCount}/${peakConcurrent} (${successRate.toFixed(2)}%)`);
      console.log(`  Errors: ${errorCount}`);
    });
  });
});

/**
 * Performance Test Utilities
 */

async function getTestAuthToken() {
  // Mock auth token for testing
  return 'mock-performance-test-token';
}

/**
 * Test Results Summary
 */
afterAll(() => {
  console.log('\n=== PERFORMANCE TEST SUMMARY ===');
  console.log('Thresholds:');
  Object.entries(PERFORMANCE_CONFIG.thresholds).forEach(([key, value]) => {
    console.log(`  ${key}: < ${value}ms`);
  });
  console.log('================================\n');
});