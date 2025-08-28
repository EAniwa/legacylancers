/**
 * Booking API Routes
 * RESTful API endpoints for booking management with comprehensive workflow support
 */

const express = require('express');
const router = express.Router();

// Import middleware and controllers
const bookingController = require('../../controllers/bookingController');
const authMiddleware = require('../../middleware/auth');
const bookingValidationMiddleware = require('../../middleware/bookingValidation');
const rateLimiting = require('../../middleware/rateLimiting');

// Apply authentication middleware to all booking routes
router.use(authMiddleware.requiredAuthenticate);

// ============================================================================
// BOOKING CRUD OPERATIONS
// ============================================================================

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking request
 * @access  Private (authenticated users only)
 * @body    {Object} bookingData - Booking creation data
 */
router.post('/', 
  rateLimiting.bookingCreation(),
  bookingValidationMiddleware.validateBookingCreation,
  bookingController.createBooking
);

/**
 * @route   GET /api/bookings
 * @desc    Get bookings with filtering and pagination
 * @access  Private (users can only see their own bookings unless admin)
 * @query   {string} client_id - Filter by client ID
 * @query   {string} retiree_id - Filter by retiree ID 
 * @query   {string} status - Filter by status (comma-separated for multiple)
 * @query   {string} engagement_type - Filter by engagement type
 * @query   {string} service_category - Filter by service category
 * @query   {string} start_date - Filter by start date (ISO format)
 * @query   {string} end_date - Filter by end date (ISO format)
 * @query   {number} limit - Results per page (default: 20, max: 100)
 * @query   {number} offset - Pagination offset (default: 0)
 * @query   {string} sort_by - Sort field (default: created_at)
 * @query   {string} sort_order - Sort order: asc|desc (default: desc)
 */
router.get('/',
  rateLimiting.bookingListing(),
  bookingValidationMiddleware.validateBookingQuery,
  bookingController.getBookings
);

/**
 * @route   GET /api/bookings/dashboard
 * @desc    Get user's booking dashboard data (overview, stats, recent activity)
 * @access  Private
 */
router.get('/dashboard',
  rateLimiting.bookingListing(),
  bookingController.getDashboard
);

/**
 * @route   GET /api/bookings/stats
 * @desc    Get user's booking statistics
 * @access  Private
 */
router.get('/stats',
  rateLimiting.bookingListing(), 
  bookingController.getUserBookingStats
);

/**
 * @route   GET /api/bookings/:bookingId
 * @desc    Get specific booking details with full information
 * @access  Private (client, retiree, or admin only)
 * @param   {string} bookingId - Booking UUID
 */
router.get('/:bookingId',
  rateLimiting.bookingDetails(),
  bookingValidationMiddleware.validateBookingId,
  bookingController.getBookingById
);

/**
 * @route   PUT /api/bookings/:bookingId
 * @desc    Update booking details (non-status fields)
 * @access  Private (client, retiree based on field permissions)
 * @param   {string} bookingId - Booking UUID
 * @body    {Object} updateData - Fields to update
 */
router.put('/:bookingId',
  rateLimiting.bookingUpdates(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateBookingUpdate,
  bookingController.updateBooking
);

/**
 * @route   DELETE /api/bookings/:bookingId
 * @desc    Cancel/delete booking with reason
 * @access  Private (client, retiree, or admin)
 * @param   {string} bookingId - Booking UUID
 * @body    {string} reason - Cancellation reason (required)
 */
router.delete('/:bookingId',
  rateLimiting.bookingUpdates(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateCancellationReason,
  bookingController.deleteBooking
);

// ============================================================================
// BOOKING STATE MANAGEMENT
// ============================================================================

/**
 * @route   POST /api/bookings/:bookingId/accept
 * @desc    Accept a booking request (retiree only)
 * @access  Private (retiree only)
 * @param   {string} bookingId - Booking UUID
 * @body    {string} response - Optional acceptance message
 * @body    {number} agreed_rate - Agreed hourly/project rate
 * @body    {string} agreed_rate_type - Rate type (hourly, project, daily, weekly)
 * @body    {Object} terms - Optional additional terms
 */
router.post('/:bookingId/accept',
  rateLimiting.bookingStateChanges(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateBookingAcceptance,
  bookingController.acceptBooking
);

/**
 * @route   POST /api/bookings/:bookingId/reject
 * @desc    Reject a booking request (retiree only)
 * @access  Private (retiree only)
 * @param   {string} bookingId - Booking UUID
 * @body    {string} reason - Rejection reason (required)
 */
router.post('/:bookingId/reject',
  rateLimiting.bookingStateChanges(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateRejectionReason,
  bookingController.rejectBooking
);

/**
 * @route   POST /api/bookings/:bookingId/start
 * @desc    Start active work on booking (client or retiree)
 * @access  Private (client or retiree)
 * @param   {string} bookingId - Booking UUID
 */
router.post('/:bookingId/start',
  rateLimiting.bookingStateChanges(),
  bookingValidationMiddleware.validateBookingId,
  bookingController.startBooking
);

/**
 * @route   POST /api/bookings/:bookingId/deliver
 * @desc    Mark booking as delivered (retiree only)
 * @access  Private (retiree only)
 * @param   {string} bookingId - Booking UUID
 * @body    {string} notes - Delivery notes
 * @body    {Array} deliverables - List of deliverables
 * @body    {string} next_steps - Recommended next steps
 */
router.post('/:bookingId/deliver',
  rateLimiting.bookingStateChanges(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateBookingDelivery,
  bookingController.deliverBooking
);

/**
 * @route   POST /api/bookings/:bookingId/complete
 * @desc    Complete booking (client only)
 * @access  Private (client only)
 * @param   {string} bookingId - Booking UUID
 * @body    {number} client_rating - Rating for retiree (1-5)
 * @body    {number} retiree_rating - Rating for client (1-5)
 * @body    {string} client_feedback - Feedback from client
 * @body    {string} retiree_feedback - Feedback from retiree
 * @body    {string} final_notes - Final completion notes
 */
router.post('/:bookingId/complete',
  rateLimiting.bookingStateChanges(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateBookingCompletion,
  bookingController.completeBooking
);

// ============================================================================
// BOOKING WORKFLOW AND METADATA
// ============================================================================

/**
 * @route   GET /api/bookings/:bookingId/transitions
 * @desc    Get available state transitions for a booking
 * @access  Private (client, retiree, or admin)
 * @param   {string} bookingId - Booking UUID
 */
router.get('/:bookingId/transitions',
  rateLimiting.bookingDetails(),
  bookingValidationMiddleware.validateBookingId,
  bookingController.getAvailableTransitions
);

/**
 * @route   GET /api/bookings/:bookingId/history
 * @desc    Get booking history and audit trail
 * @access  Private (client, retiree, or admin)
 * @param   {string} bookingId - Booking UUID
 * @query   {number} limit - Number of history entries (default: 50, max: 100)
 * @query   {string} sort_order - Sort order: asc|desc (default: desc)
 */
router.get('/:bookingId/history',
  rateLimiting.bookingDetails(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateHistoryQuery,
  bookingController.getBookingHistory
);

/**
 * @route   GET /api/bookings/:bookingId/requirements
 * @desc    Get booking requirements and specifications
 * @access  Private (client, retiree, or admin)
 * @param   {string} bookingId - Booking UUID
 */
router.get('/:bookingId/requirements',
  rateLimiting.bookingDetails(),
  bookingValidationMiddleware.validateBookingId,
  bookingController.getRequirements
);

/**
 * @route   POST /api/bookings/:bookingId/requirements
 * @desc    Add requirement to booking
 * @access  Private (client primarily, retiree for clarifications)
 * @param   {string} bookingId - Booking UUID
 * @body    {string} requirement_type - Type: skill, experience, certification, tool, deliverable, other
 * @body    {string} title - Requirement title
 * @body    {string} description - Requirement description
 * @body    {boolean} is_mandatory - Whether requirement is mandatory (default: true)
 * @body    {number} priority - Priority level (0 = highest, default: 0)
 * @body    {string} skill_id - Related skill ID (for skill requirements)
 * @body    {string} required_proficiency - Required skill proficiency level
 * @body    {number} min_years_experience - Minimum years of experience
 * @body    {string} deliverable_format - Expected deliverable format
 * @body    {number} expected_quantity - Expected quantity (default: 1)
 */
router.post('/:bookingId/requirements',
  rateLimiting.bookingUpdates(),
  bookingValidationMiddleware.validateBookingId,
  bookingValidationMiddleware.validateRequirementCreation,
  bookingController.addRequirement
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Route-specific error handler for booking operations
 * Handles booking-related errors and provides meaningful responses
 */
router.use((error, req, res, next) => {
  console.error('Booking Route Error:', {
    error: error.message,
    code: error.code,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Handle specific booking error types
  if (error.name === 'BookingError' || error.name === 'BookingServiceError') {
    const statusCode = getStatusCodeForBookingError(error.code);
    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: error.details || null,
      timestamp: new Date().toISOString()
    });
  }

  // Pass to next error handler
  next(error);
});

/**
 * Map booking error codes to HTTP status codes
 * @param {string} errorCode - Error code from booking system
 * @returns {number} HTTP status code
 */
function getStatusCodeForBookingError(errorCode) {
  const errorStatusMap = {
    // Authentication/Authorization
    'UNAUTHORIZED_CREATION': 403,
    'UNAUTHORIZED_ACCEPTANCE': 403,
    'UNAUTHORIZED_REJECTION': 403,
    'UNAUTHORIZED_START': 403,
    'UNAUTHORIZED_DELIVERY': 403,
    'UNAUTHORIZED_COMPLETION': 403,
    'UNAUTHORIZED_CANCELLATION': 403,
    'UNAUTHORIZED_VIEW': 403,
    'UNAUTHORIZED_UPDATE': 403,
    'UNAUTHORIZED_SEARCH': 403,
    'INSUFFICIENT_PERMISSIONS': 403,
    
    // Not Found
    'BOOKING_NOT_FOUND': 404,
    'CLIENT_NOT_FOUND': 404,
    'RETIREE_NOT_FOUND': 404,
    'USER_NOT_FOUND': 404,
    
    // Bad Request
    'INVALID_CLIENT_PROFILE': 400,
    'INVALID_RETIREE_PROFILE': 400,
    'CLIENT_INACTIVE': 400,
    'RETIREE_INACTIVE': 400,
    'CLIENT_EMAIL_NOT_VERIFIED': 400,
    'RETIREE_EMAIL_NOT_VERIFIED': 400,
    'RETIREE_UNAVAILABLE': 400,
    'MISSING_REJECTION_REASON': 400,
    'MISSING_CANCELLATION_REASON': 400,
    'INVALID_TRANSITION': 400,
    'MISSING_REQUIRED_FIELDS': 400,
    'CANCELLATION_NOT_ALLOWED': 400,
    'INVALID_TITLE_LENGTH': 400,
    'INVALID_DESCRIPTION_LENGTH': 400,
    'INVALID_ENGAGEMENT_TYPE': 400,
    'INVALID_DATE_RANGE': 400,
    'INVALID_RATE': 400,
    'INVALID_DATE': 400,
    
    // Conflict
    'SAME_USER': 409,
    'INVALID_USER_ASSIGNMENT': 409,
    
    // Default
    'DEFAULT': 400
  };

  return errorStatusMap[errorCode] || errorStatusMap.DEFAULT;
}

module.exports = router;