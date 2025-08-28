/**
 * Comprehensive Test Configuration
 * Centralized configuration for all test suites
 */

const path = require('path');

module.exports = {
  // Test Environment Configuration
  environment: {
    NODE_ENV: 'test',
    API_BASE_URL: process.env.TEST_API_URL || 'http://localhost:3001',
    WEBSOCKET_URL: process.env.TEST_WEBSOCKET_URL || 'http://localhost:3001',
    DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/legacylancers_test'
  },

  // Performance Thresholds
  performance: {
    api: {
      booking: 2000,        // 2 seconds max for booking operations
      calendar: 500,        // 500ms max for calendar queries
      availability: 500,    // 500ms max for availability checks
      messaging: 100,       // 100ms max for message operations
      profile: 1000,        // 1 second max for profile operations
      authentication: 1500  // 1.5 seconds max for auth operations
    },
    websocket: {
      connection: 2000,     // 2 seconds max connection time
      messageLatency: 100,  // 100ms max message delivery
      reconnection: 3000,   // 3 seconds max reconnection time
      typing: 50           // 50ms max typing indicator delivery
    },
    database: {
      simpleQuery: 100,     // 100ms max for simple queries
      complexQuery: 500,    // 500ms max for complex queries
      transaction: 1000     // 1 second max for transactions
    }
  },

  // Load Testing Configuration
  load: {
    concurrent: {
      light: 10,           // Light load testing
      medium: 50,          // Medium load testing
      heavy: 100,          // Heavy load testing
      stress: 200          // Stress testing
    },
    duration: {
      quick: 10000,        // 10 seconds
      medium: 30000,       // 30 seconds
      extended: 60000      // 1 minute
    },
    websocket: {
      maxConnections: 100,
      messagesPerConnection: 50,
      connectionRampUp: 5000
    }
  },

  // Test Data Configuration
  testData: {
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
      },
      admin: {
        id: 'test-admin-001',
        email: 'admin@legacylancers-test.com',
        name: 'Test Admin',
        role: 'admin'
      }
    },
    bookings: {
      valid: {
        title: 'Integration Test Session',
        description: 'Test booking for integration testing',
        duration: 3600000, // 1 hour in milliseconds
        timeZone: 'UTC'
      },
      invalid: {
        pastTime: {
          startTime: '2023-01-01T10:00:00Z',
          endTime: '2023-01-01T11:00:00Z'
        },
        invalidTimeRange: {
          startTime: '2024-02-01T15:00:00Z',
          endTime: '2024-02-01T14:00:00Z' // End before start
        }
      }
    },
    calendar: {
      dateRanges: {
        week: {
          startDate: '2024-02-01',
          endDate: '2024-02-07'
        },
        month: {
          startDate: '2024-02-01', 
          endDate: '2024-02-28'
        }
      },
      timezones: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']
    }
  },

  // Test Timeouts
  timeouts: {
    unit: 5000,           // 5 seconds for unit tests
    integration: 10000,   // 10 seconds for integration tests
    e2e: 30000,          // 30 seconds for end-to-end tests
    performance: 60000,   // 1 minute for performance tests
    load: 120000         // 2 minutes for load tests
  },

  // Mock Data Configuration
  mocks: {
    auth: {
      validToken: 'mock-valid-jwt-token',
      expiredToken: 'mock-expired-jwt-token',
      invalidToken: 'mock-invalid-jwt-token'
    },
    files: {
      validImage: 'test-image.jpg',
      validDocument: 'test-document.pdf',
      invalidFile: 'malicious.exe',
      largeFile: 'large-file.zip'
    },
    external: {
      calendarProvider: 'mock-calendar-provider',
      paymentProvider: 'mock-payment-provider',
      emailService: 'mock-email-service'
    }
  },

  // Security Test Configuration
  security: {
    rateLimiting: {
      requests: 100,        // Requests per window
      windowMs: 15 * 60 * 1000, // 15 minutes
      testExcess: 150       // Test with 50% over limit
    },
    fileUpload: {
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSize: 10 * 1024 * 1024, // 10MB
      blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.js']
    },
    authentication: {
      bruteForce: {
        maxAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutes
      }
    }
  },

  // Database Test Configuration
  database: {
    cleanup: {
      tables: [
        'calendar_events',
        'bookings',
        'booking_history', 
        'messages',
        'conversations',
        'notifications'
      ],
      testDataPattern: '%test%' // Delete records with 'test' in title/name
    },
    migrations: {
      testMigrations: path.join(__dirname, '../db/migrations/test'),
      seedData: path.join(__dirname, 'fixtures/seed-data.sql')
    }
  },

  // CI/CD Configuration
  ci: {
    coverage: {
      threshold: {
        global: 85,         // 85% global coverage
        functions: 80,      // 80% function coverage
        lines: 85,          // 85% line coverage
        branches: 75        // 75% branch coverage
      }
    },
    reporters: ['json', 'html', 'text-summary'],
    parallel: true,         // Run tests in parallel
    maxWorkers: '50%'      // Use 50% of available CPU cores
  },

  // Monitoring and Alerting
  monitoring: {
    healthcheck: {
      endpoint: '/health',
      timeout: 5000,
      expectedStatus: 200
    },
    metrics: {
      collectDuringTests: true,
      exportPath: './test-results/metrics.json'
    }
  },

  // Test Utilities
  utilities: {
    cleanup: {
      timeout: 10000,      // 10 seconds to cleanup after tests
      retries: 3           // Retry cleanup 3 times if it fails
    },
    retry: {
      attempts: 3,         // Retry flaky tests 3 times
      delay: 1000         // 1 second delay between retries
    }
  }
};