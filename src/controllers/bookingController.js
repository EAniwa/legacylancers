/**
 * Booking Controller
 * Handles HTTP requests for booking management API endpoints
 */

const { BookingService, BookingServiceError } = require('../services/bookingService');
const { BookingError } = require('../models/Booking');
const { BookingStateMachine } = require('../utils/bookingStateMachine');

class BookingController {

  /**
   * Create a new booking request
   * POST /api/bookings
   */
  async createBooking(req, res) {
    try {
      // Extract user from auth middleware
      const userId = req.user.id;
      
      // Create booking data from request
      const bookingData = {
        clientId: req.body.clientId,
        retireeId: req.body.retireeId,
        clientProfileId: req.body.clientProfileId,
        retireeProfileId: req.body.retireeProfileId,
        title: req.body.title,
        description: req.body.description,
        serviceCategory: req.body.serviceCategory,
        engagementType: req.body.engagementType,
        proposedRate: req.body.proposedRate,
        proposedRateType: req.body.proposedRateType,
        currency: req.body.currency,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        estimatedHours: req.body.estimatedHours,
        flexibleTiming: req.body.flexibleTiming,
        timezone: req.body.timezone,
        clientMessage: req.body.clientMessage,
        urgencyLevel: req.body.urgencyLevel,
        remoteWork: req.body.remoteWork,
        location: req.body.location,
        requirements: req.body.requirements
      };

      const booking = await BookingService.createBooking(bookingData, userId);

      res.status(201).json({
        success: true,
        data: booking,
        message: 'Booking request created successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get bookings with filtering and pagination
   * GET /api/bookings
   */
  async getBookings(req, res) {
    try {
      const userId = req.user.id;
      
      // Extract query parameters
      const criteria = {
        clientId: req.query.client_id,
        retireeId: req.query.retiree_id,
        status: req.query.status ? req.query.status.split(',') : undefined,
        engagementType: req.query.engagement_type,
        serviceCategory: req.query.service_category,
        startDate: req.query.start_date,
        endDate: req.query.end_date
      };

      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sort_by || 'created_at',
        sortOrder: req.query.sort_order || 'desc'
      };

      const results = await BookingService.searchBookings(criteria, options, userId);

      res.json({
        success: true,
        data: results.bookings,
        pagination: results.pagination,
        summary: results.summary,
        message: `Retrieved ${results.bookings.length} bookings`
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get specific booking details
   * GET /api/bookings/:bookingId
   */
  async getBookingById(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;

      const booking = await BookingService.getBookingDetails(bookingId, userId);

      res.json({
        success: true,
        data: booking,
        message: 'Booking details retrieved successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Update booking details
   * PUT /api/bookings/:bookingId
   */
  async updateBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const booking = await BookingService.updateBooking(bookingId, updateData, userId);

      res.json({
        success: true,
        data: booking,
        message: 'Booking updated successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Delete/cancel booking
   * DELETE /api/bookings/:bookingId
   */
  async deleteBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Cancellation reason is required',
          code: 'MISSING_CANCELLATION_REASON'
        });
      }

      const booking = await BookingService.cancelBooking(bookingId, userId, reason);

      res.json({
        success: true,
        data: booking,
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Accept booking request
   * POST /api/bookings/:bookingId/accept
   */
  async acceptBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      
      const acceptanceData = {
        response: req.body.response,
        agreed_rate: req.body.agreed_rate,
        agreed_rate_type: req.body.agreed_rate_type,
        terms: req.body.terms
      };

      const booking = await BookingService.acceptBooking(bookingId, userId, acceptanceData);

      res.json({
        success: true,
        data: booking,
        message: 'Booking accepted successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Reject booking request
   * POST /api/bookings/:bookingId/reject
   */
  async rejectBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
          code: 'MISSING_REJECTION_REASON'
        });
      }

      const booking = await BookingService.rejectBooking(bookingId, userId, reason);

      res.json({
        success: true,
        data: booking,
        message: 'Booking rejected successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Start active work on booking
   * POST /api/bookings/:bookingId/start
   */
  async startBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;

      const booking = await BookingService.startBooking(bookingId, userId);

      res.json({
        success: true,
        data: booking,
        message: 'Booking started successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Mark booking as delivered
   * POST /api/bookings/:bookingId/deliver
   */
  async deliverBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      
      const deliveryData = {
        notes: req.body.notes,
        deliverables: req.body.deliverables,
        next_steps: req.body.next_steps
      };

      const booking = await BookingService.deliverBooking(bookingId, userId, deliveryData);

      res.json({
        success: true,
        data: booking,
        message: 'Booking marked as delivered successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Complete booking
   * POST /api/bookings/:bookingId/complete
   */
  async completeBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      
      const completionData = {
        client_rating: req.body.client_rating,
        retiree_rating: req.body.retiree_rating,
        client_feedback: req.body.client_feedback,
        retiree_feedback: req.body.retiree_feedback,
        final_notes: req.body.final_notes
      };

      const booking = await BookingService.completeBooking(bookingId, userId, completionData);

      res.json({
        success: true,
        data: booking,
        message: 'Booking completed successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get booking history
   * GET /api/bookings/:bookingId/history
   */
  async getBookingHistory(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      
      // First verify user has access to this booking
      const booking = await BookingService.getBookingDetails(bookingId, userId);
      
      const options = {
        limit: parseInt(req.query.limit) || 50,
        sortOrder: req.query.sort_order || 'desc'
      };

      const history = await BookingService.getBookingHistory(bookingId, options);

      res.json({
        success: true,
        data: history,
        message: 'Booking history retrieved successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get user's booking statistics
   * GET /api/bookings/stats
   */
  async getUserBookingStats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await BookingService.getUserBookingStats(userId);

      res.json({
        success: true,
        data: stats,
        message: 'User booking statistics retrieved successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get available state transitions for a booking
   * GET /api/bookings/:bookingId/transitions
   */
  async getAvailableTransitions(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;

      // Get booking details to determine user role and current state
      const booking = await BookingService.getBookingDetails(bookingId, userId);
      
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      const nextStates = BookingStateMachine.getNextStatesForRole(booking.status, userRole);
      
      const transitions = nextStates.map(state => ({
        state,
        description: BookingStateMachine.getStateDescription(state),
        canTransition: BookingStateMachine.canUserTransition(booking.status, state, userRole)
      }));

      res.json({
        success: true,
        data: {
          current_state: booking.status,
          current_description: BookingStateMachine.getStateDescription(booking.status),
          user_role: userRole,
          available_transitions: transitions,
          is_final_state: BookingStateMachine.isFinalState(booking.status),
          can_be_cancelled: BookingStateMachine.canBeCancelled(booking.status)
        },
        message: 'Available transitions retrieved successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Add requirement to booking
   * POST /api/bookings/:bookingId/requirements
   */
  async addRequirement(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      
      // First verify user has access to this booking
      await BookingService.getBookingDetails(bookingId, userId);
      
      const requirementData = {
        requirement_type: req.body.requirement_type,
        title: req.body.title,
        description: req.body.description,
        is_mandatory: req.body.is_mandatory,
        priority: req.body.priority,
        skill_id: req.body.skill_id,
        required_proficiency: req.body.required_proficiency,
        min_years_experience: req.body.min_years_experience,
        deliverable_format: req.body.deliverable_format,
        expected_quantity: req.body.expected_quantity
      };

      const { Booking } = require('../models/Booking');
      const requirement = await Booking.addRequirement(bookingId, requirementData);

      res.status(201).json({
        success: true,
        data: requirement,
        message: 'Requirement added successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get booking requirements
   * GET /api/bookings/:bookingId/requirements
   */
  async getRequirements(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.id;
      
      // First verify user has access to this booking
      await BookingService.getBookingDetails(bookingId, userId);
      
      const { Booking } = require('../models/Booking');
      const requirements = await Booking.getRequirements(bookingId);

      res.json({
        success: true,
        data: requirements,
        message: 'Requirements retrieved successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get booking dashboard data (summary of all bookings for the user)
   * GET /api/bookings/dashboard
   */
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      // Get recent bookings and statistics
      const [stats, recentBookings, activeBookings] = await Promise.all([
        BookingService.getUserBookingStats(userId),
        BookingService.searchBookings({}, { limit: 10, sortBy: 'updated_at', sortOrder: 'desc' }, userId),
        BookingService.searchBookings(
          { status: ['accepted', 'active', 'delivered'] }, 
          { limit: 5, sortBy: 'start_date', sortOrder: 'asc' }, 
          userId
        )
      ]);

      res.json({
        success: true,
        data: {
          statistics: stats,
          recent_bookings: recentBookings.bookings,
          active_bookings: activeBookings.bookings,
          summary: recentBookings.summary
        },
        message: 'Dashboard data retrieved successfully'
      });

    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Error handler for booking controller
   * @param {Error} error - Error to handle
   * @param {Object} res - Express response object
   */
  handleError(error, res) {
    console.error('Booking Controller Error:', error);

    // Handle specific error types
    if (error instanceof BookingServiceError || error instanceof BookingError) {
      const statusCode = this.getStatusCodeForError(error.code);
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR'
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }

  /**
   * Map error codes to HTTP status codes
   * @param {string} errorCode - Error code
   * @returns {number} HTTP status code
   */
  getStatusCodeForError(errorCode) {
    const errorStatusMap = {
      // Authentication/Authorization errors
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
      
      // Not found errors
      'BOOKING_NOT_FOUND': 404,
      'CLIENT_NOT_FOUND': 404,
      'RETIREE_NOT_FOUND': 404,
      'USER_NOT_FOUND': 404,
      
      // Bad request errors
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
      'INSUFFICIENT_PERMISSIONS': 403,
      'MISSING_REQUIRED_FIELDS': 400,
      'CANCELLATION_NOT_ALLOWED': 400,
      
      // Conflict errors
      'SAME_USER': 409,
      
      // Default to 400 for other errors
      'DEFAULT': 400
    };

    return errorStatusMap[errorCode] || errorStatusMap.DEFAULT;
  }
}

module.exports = new BookingController();