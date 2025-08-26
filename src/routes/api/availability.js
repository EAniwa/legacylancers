/**
 * Availability API Routes
 * RESTful endpoints for availability management with proper middleware
 */

const express = require('express');
const {
  requiredAuthenticate,
  verifiedUserOnly,
  requireOwnershipOrAdmin
} = require('../../middleware/auth');

const {
  createAvailability,
  getAvailabilities,
  getAvailabilityById,
  updateAvailability,
  deleteAvailability,
  getUserAvailability,
  checkAvailabilityConflicts,
  getAvailabilityStats,
  findAvailableSlots,
  bookTimeSlot,
  getNextAvailableSlot,
  convertAvailabilityTimezone
} = require('../../controllers/availability');

const router = express.Router();

/**
 * Validation middleware for availability endpoints
 */
function validateAvailabilityCreate(req, res, next) {
  const { 
    startTime, 
    endTime, 
    startDate, 
    scheduleType,
    engagementType,
    locationType
  } = req.body;

  // Required fields
  if (!startDate) {
    return res.status(400).json({
      success: false,
      error: 'Start date is required',
      code: 'MISSING_START_DATE'
    });
  }

  if (!startTime) {
    return res.status(400).json({
      success: false,
      error: 'Start time is required',
      code: 'MISSING_START_TIME'
    });
  }

  if (!endTime) {
    return res.status(400).json({
      success: false,
      error: 'End time is required',
      code: 'MISSING_END_TIME'
    });
  }

  // Validate schedule type
  const validScheduleTypes = ['one_time', 'recurring', 'blocked'];
  if (scheduleType && !validScheduleTypes.includes(scheduleType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid schedule type. Must be one of: ${validScheduleTypes.join(', ')}`,
      code: 'INVALID_SCHEDULE_TYPE'
    });
  }

  // Validate engagement type if provided
  const validEngagementTypes = ['freelance', 'consulting', 'project', 'keynote', 'mentoring'];
  if (engagementType && !validEngagementTypes.includes(engagementType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid engagement type. Must be one of: ${validEngagementTypes.join(', ')}`,
      code: 'INVALID_ENGAGEMENT_TYPE'
    });
  }

  // Validate location type if provided
  const validLocationTypes = ['remote', 'in_person', 'hybrid'];
  if (locationType && !validLocationTypes.includes(locationType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid location type. Must be one of: ${validLocationTypes.join(', ')}`,
      code: 'INVALID_LOCATION_TYPE'
    });
  }

  // Validate date format
  if (isNaN(Date.parse(startDate))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid start date format. Use YYYY-MM-DD',
      code: 'INVALID_START_DATE'
    });
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5]?[0-9])$/;
  
  if (!timeRegex.test(startTime)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid start time format. Use HH:MM format',
      code: 'INVALID_START_TIME_FORMAT'
    });
  }

  if (!timeRegex.test(endTime)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid end time format. Use HH:MM format',
      code: 'INVALID_END_TIME_FORMAT'
    });
  }

  next();
}

/**
 * Validation middleware for query parameters
 */
function validateQueryParams(req, res, next) {
  const { startDate, endDate, page, limit } = req.query;

  // Validate date format if provided
  if (startDate && isNaN(Date.parse(startDate))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid start date format. Use YYYY-MM-DD',
      code: 'INVALID_START_DATE'
    });
  }

  if (endDate && isNaN(Date.parse(endDate))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid end date format. Use YYYY-MM-DD',
      code: 'INVALID_END_DATE'
    });
  }

  // Validate date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date',
        code: 'INVALID_DATE_RANGE'
      });
    }

    // Limit date range to prevent excessive queries
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      return res.status(400).json({
        success: false,
        error: 'Date range cannot exceed 365 days',
        code: 'DATE_RANGE_TOO_LARGE'
      });
    }
  }

  // Validate pagination parameters
  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return res.status(400).json({
      success: false,
      error: 'Page must be a positive integer',
      code: 'INVALID_PAGE'
    });
  }

  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    return res.status(400).json({
      success: false,
      error: 'Limit must be an integer between 1 and 100',
      code: 'INVALID_LIMIT'
    });
  }

  next();
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 60000) { // 100 requests per minute
  return (req, res, next) => {
    const key = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, []);
    }

    const requests = rateLimitMap.get(key);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Too many requests.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    rateLimitMap.set(key, recentRequests);

    next();
  };
}

/**
 * @route   POST /api/availability
 * @desc    Create new availability slot
 * @access  Private (verified users only)
 */
router.post('/',
  verifiedUserOnly,
  validateAvailabilityCreate,
  rateLimit(20, 60000), // 20 creates per minute
  createAvailability
);

/**
 * @route   GET /api/availability
 * @desc    Get availability slots with filtering and pagination
 * @access  Private
 */
router.get('/',
  requiredAuthenticate,
  validateQueryParams,
  rateLimit(200, 60000), // 200 reads per minute
  getAvailabilities
);

/**
 * @route   GET /api/availability/:id
 * @desc    Get specific availability by ID
 * @access  Private
 */
router.get('/:id',
  requiredAuthenticate,
  rateLimit(100, 60000),
  getAvailabilityById
);

/**
 * @route   PUT /api/availability/:id
 * @desc    Update availability slot
 * @access  Private (owner or admin)
 */
router.put('/:id',
  verifiedUserOnly,
  rateLimit(50, 60000), // 50 updates per minute
  updateAvailability
);

/**
 * @route   DELETE /api/availability/:id
 * @desc    Delete availability slot
 * @access  Private (owner or admin)
 */
router.delete('/:id',
  verifiedUserOnly,
  rateLimit(30, 60000), // 30 deletes per minute
  deleteAvailability
);

/**
 * @route   GET /api/availability/user/:userId
 * @desc    Get user's availability slots
 * @access  Private (own data or admin)
 */
router.get('/user/:userId',
  requiredAuthenticate,
  requireOwnershipOrAdmin('userId'),
  validateQueryParams,
  rateLimit(200, 60000),
  getUserAvailability
);

/**
 * @route   GET /api/availability/user/:userId/stats
 * @desc    Get user's availability statistics
 * @access  Private (own data or admin)
 */
router.get('/user/:userId/stats',
  requiredAuthenticate,
  requireOwnershipOrAdmin('userId'),
  rateLimit(50, 60000),
  getAvailabilityStats
);

/**
 * @route   POST /api/availability/check-conflict
 * @desc    Check for availability conflicts
 * @access  Private
 */
router.post('/check-conflict',
  verifiedUserOnly,
  rateLimit(100, 60000),
  checkAvailabilityConflicts
);

/**
 * @route   GET /api/availability/slots/find
 * @desc    Find available time slots for booking
 * @access  Private
 */
router.get('/slots/find',
  requiredAuthenticate,
  validateQueryParams,
  rateLimit(100, 60000),
  findAvailableSlots
);

/**
 * @route   POST /api/availability/slots/book
 * @desc    Book a time slot
 * @access  Private (verified users only)
 */
router.post('/slots/book',
  verifiedUserOnly,
  rateLimit(10, 60000), // 10 bookings per minute
  bookTimeSlot
);

/**
 * @route   GET /api/availability/user/:userId/next-slot
 * @desc    Get next available slot for a user
 * @access  Private (own data or admin)
 */
router.get('/user/:userId/next-slot',
  requiredAuthenticate,
  requireOwnershipOrAdmin('userId'),
  rateLimit(50, 60000),
  getNextAvailableSlot
);

/**
 * @route   GET /api/availability/:id/convert-timezone
 * @desc    Convert availability times to different timezone
 * @access  Private (owner or admin)
 */
router.get('/:id/convert-timezone',
  requiredAuthenticate,
  rateLimit(50, 60000),
  convertAvailabilityTimezone
);

/**
 * Error handling middleware for this router
 */
router.use((error, req, res, next) => {
  console.error('Availability route error:', error);

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      code: 'INVALID_ID'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

module.exports = router;