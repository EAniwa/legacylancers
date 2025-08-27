/**
 * Booking Service
 * Core business logic for booking management and workflow orchestration
 */

const { Booking, BookingError } = require('../models/Booking');
const { User, UserError } = require('../models/User');
const { Profile } = require('../models/Profile');
const { BookingStateMachine, BOOKING_STATES } = require('../utils/bookingStateMachine');

class BookingServiceError extends Error {
  constructor(message, code = 'BOOKING_SERVICE_ERROR') {
    super(message);
    this.name = 'BookingServiceError';
    this.code = code;
  }
}

/**
 * Booking Service Class
 * Handles high-level booking operations and business logic
 */
class BookingService {

  /**
   * Create a new booking request
   * @param {Object} bookingData - Booking creation data
   * @param {string} createdBy - User ID creating the booking
   * @returns {Promise<Object>} Created booking with enriched data
   */
  async createBooking(bookingData, createdBy) {
    try {
      // Validate that creator is the client
      if (bookingData.clientId !== createdBy) {
        throw new BookingServiceError('Only clients can create booking requests', 'UNAUTHORIZED_CREATION');
      }

      // Verify users exist
      const client = await User.findById(bookingData.clientId);
      const retiree = await User.findById(bookingData.retireeId);

      if (!client) {
        throw new BookingServiceError('Client not found', 'CLIENT_NOT_FOUND');
      }

      if (!retiree) {
        throw new BookingServiceError('Retiree not found', 'RETIREE_NOT_FOUND');
      }

      // Verify users are active and verified
      if (client.status !== 'active') {
        throw new BookingServiceError('Client account is not active', 'CLIENT_INACTIVE');
      }

      if (retiree.status !== 'active') {
        throw new BookingServiceError('Retiree account is not active', 'RETIREE_INACTIVE');
      }

      if (!client.emailVerified) {
        throw new BookingServiceError('Client email must be verified', 'CLIENT_EMAIL_NOT_VERIFIED');
      }

      if (!retiree.emailVerified) {
        throw new BookingServiceError('Retiree email must be verified', 'RETIREE_EMAIL_NOT_VERIFIED');
      }

      // Get profiles if specified
      let clientProfile = null;
      let retireeProfile = null;

      if (bookingData.clientProfileId) {
        clientProfile = await Profile.findById(bookingData.clientProfileId);
        if (!clientProfile || clientProfile.user_id !== bookingData.clientId) {
          throw new BookingServiceError('Invalid client profile', 'INVALID_CLIENT_PROFILE');
        }
      }

      if (bookingData.retireeProfileId) {
        retireeProfile = await Profile.findById(bookingData.retireeProfileId);
        if (!retireeProfile || retireeProfile.user_id !== bookingData.retireeId) {
          throw new BookingServiceError('Invalid retiree profile', 'INVALID_RETIREE_PROFILE');
        }
        
        // Check if retiree profile is available for bookings
        if (retireeProfile.availability_status === 'unavailable') {
          throw new BookingServiceError('Retiree is currently unavailable for bookings', 'RETIREE_UNAVAILABLE');
        }
      }

      // Check for existing active bookings between the same users
      const existingBookings = await this.findActiveBookingsBetweenUsers(
        bookingData.clientId, 
        bookingData.retireeId
      );

      if (existingBookings.length > 0) {
        // Allow multiple bookings but warn about existing ones
        console.log(`Found ${existingBookings.length} existing active bookings between users`);
      }

      // Create the booking
      const booking = await Booking.create(bookingData, createdBy);

      // Enrich booking data with user and profile information
      const enrichedBooking = await this.enrichBookingData(booking);

      // TODO: Trigger notifications
      // await this.notifyRetireeOfNewBooking(booking);

      // Log successful creation
      console.log(`Booking created successfully: ${booking.id} by ${createdBy}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to create booking: ${error.message}`, 'CREATE_BOOKING_FAILED');
    }
  }

  /**
   * Accept a booking request
   * @param {string} bookingId - Booking ID
   * @param {string} retireeId - Retiree user ID
   * @param {Object} acceptanceData - Acceptance data (rates, terms)
   * @returns {Promise<Object>} Updated booking
   */
  async acceptBooking(bookingId, retireeId, acceptanceData = {}) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify retiree authorization
      if (booking.retiree_id !== retireeId) {
        throw new BookingServiceError('Not authorized to accept this booking', 'UNAUTHORIZED_ACCEPTANCE');
      }

      // Verify current state allows acceptance
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, retireeId);
      const validation = BookingStateMachine.validateTransition(
        booking.status,
        BOOKING_STATES.ACCEPTED,
        userRole,
        acceptanceData
      );

      if (!validation.success) {
        throw new BookingServiceError(validation.error, validation.code);
      }

      // Prepare update data
      const updateData = {
        retiree_response: acceptanceData.response || 'Booking accepted',
        ...acceptanceData
      };

      // Update booking status
      const updatedBooking = await Booking.updateStatus(
        bookingId,
        BOOKING_STATES.ACCEPTED,
        retireeId,
        updateData
      );

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      // TODO: Notify client of acceptance
      // await this.notifyClientOfBookingAcceptance(enrichedBooking);

      console.log(`Booking ${bookingId} accepted by ${retireeId}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to accept booking: ${error.message}`, 'ACCEPT_BOOKING_FAILED');
    }
  }

  /**
   * Reject a booking request
   * @param {string} bookingId - Booking ID
   * @param {string} retireeId - Retiree user ID
   * @param {string} rejectionReason - Reason for rejection
   * @returns {Promise<Object>} Updated booking
   */
  async rejectBooking(bookingId, retireeId, rejectionReason) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify retiree authorization
      if (booking.retiree_id !== retireeId) {
        throw new BookingServiceError('Not authorized to reject this booking', 'UNAUTHORIZED_REJECTION');
      }

      if (!rejectionReason || rejectionReason.trim() === '') {
        throw new BookingServiceError('Rejection reason is required', 'MISSING_REJECTION_REASON');
      }

      // Update booking status
      const updatedBooking = await Booking.updateStatus(
        bookingId,
        BOOKING_STATES.REJECTED,
        retireeId,
        { rejection_reason: rejectionReason }
      );

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      // TODO: Notify client of rejection
      // await this.notifyClientOfBookingRejection(enrichedBooking);

      console.log(`Booking ${bookingId} rejected by ${retireeId}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to reject booking: ${error.message}`, 'REJECT_BOOKING_FAILED');
    }
  }

  /**
   * Start active work on a booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID starting the work
   * @returns {Promise<Object>} Updated booking
   */
  async startBooking(bookingId, userId) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify user authorization (client or retiree can start)
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      if (userRole === 'unknown') {
        throw new BookingServiceError('Not authorized to start this booking', 'UNAUTHORIZED_START');
      }

      // Update booking status
      const updatedBooking = await Booking.updateStatus(
        bookingId,
        BOOKING_STATES.ACTIVE,
        userId,
        { start_date: new Date() }
      );

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      // TODO: Notify both parties of booking start
      // await this.notifyBookingStart(enrichedBooking, userId);

      console.log(`Booking ${bookingId} started by ${userId}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to start booking: ${error.message}`, 'START_BOOKING_FAILED');
    }
  }

  /**
   * Mark booking as delivered
   * @param {string} bookingId - Booking ID
   * @param {string} retireeId - Retiree user ID
   * @param {Object} deliveryData - Delivery data and notes
   * @returns {Promise<Object>} Updated booking
   */
  async deliverBooking(bookingId, retireeId, deliveryData = {}) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify retiree authorization
      if (booking.retiree_id !== retireeId) {
        throw new BookingServiceError('Only the retiree can mark booking as delivered', 'UNAUTHORIZED_DELIVERY');
      }

      // Update booking status
      const updatedBooking = await Booking.updateStatus(
        bookingId,
        BOOKING_STATES.DELIVERED,
        retireeId,
        {
          delivery_date: new Date(),
          delivery_notes: deliveryData.notes || '',
          ...deliveryData
        }
      );

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      // TODO: Notify client of delivery
      // await this.notifyClientOfDelivery(enrichedBooking);

      console.log(`Booking ${bookingId} delivered by ${retireeId}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to deliver booking: ${error.message}`, 'DELIVER_BOOKING_FAILED');
    }
  }

  /**
   * Complete a booking
   * @param {string} bookingId - Booking ID
   * @param {string} clientId - Client user ID
   * @param {Object} completionData - Completion data (ratings, feedback)
   * @returns {Promise<Object>} Updated booking
   */
  async completeBooking(bookingId, clientId, completionData = {}) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify client authorization
      if (booking.client_id !== clientId) {
        throw new BookingServiceError('Only the client can complete the booking', 'UNAUTHORIZED_COMPLETION');
      }

      // Update booking status
      const updatedBooking = await Booking.updateStatus(
        bookingId,
        BOOKING_STATES.COMPLETED,
        clientId,
        {
          completion_date: new Date(),
          ...completionData
        }
      );

      // Update profile statistics if ratings provided
      if (completionData.retiree_rating && booking.retiree_profile_id) {
        await this.updateProfileRating(booking.retiree_profile_id, completionData.retiree_rating);
      }

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      // TODO: Trigger payment processing
      // await this.processBookingPayment(enrichedBooking);

      // TODO: Notify retiree of completion
      // await this.notifyRetireeOfCompletion(enrichedBooking);

      console.log(`Booking ${bookingId} completed by ${clientId}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to complete booking: ${error.message}`, 'COMPLETE_BOOKING_FAILED');
    }
  }

  /**
   * Cancel a booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID requesting cancellation
   * @param {string} cancellationReason - Reason for cancellation
   * @returns {Promise<Object>} Updated booking
   */
  async cancelBooking(bookingId, userId, cancellationReason) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify user authorization
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      if (userRole === 'unknown') {
        throw new BookingServiceError('Not authorized to cancel this booking', 'UNAUTHORIZED_CANCELLATION');
      }

      if (!cancellationReason || cancellationReason.trim() === '') {
        throw new BookingServiceError('Cancellation reason is required', 'MISSING_CANCELLATION_REASON');
      }

      // Check if booking can be cancelled
      if (!BookingStateMachine.canBeCancelled(booking.status)) {
        throw new BookingServiceError('Booking cannot be cancelled in current state', 'CANCELLATION_NOT_ALLOWED');
      }

      // Update booking status
      const updatedBooking = await Booking.updateStatus(
        bookingId,
        BOOKING_STATES.CANCELLED,
        userId,
        { cancellation_reason: cancellationReason }
      );

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      // TODO: Process cancellation (refunds, notifications)
      // await this.processCancellation(enrichedBooking, userId, userRole);

      console.log(`Booking ${bookingId} cancelled by ${userId} (${userRole})`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to cancel booking: ${error.message}`, 'CANCEL_BOOKING_FAILED');
    }
  }

  /**
   * Get booking with full details
   * @param {string} bookingId - Booking ID
   * @param {string} requestingUserId - User ID requesting the data
   * @returns {Promise<Object>} Booking with full details
   */
  async getBookingDetails(bookingId, requestingUserId) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify user has access to this booking
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, requestingUserId);
      if (userRole === 'unknown') {
        throw new BookingServiceError('Not authorized to view this booking', 'UNAUTHORIZED_VIEW');
      }

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(booking);

      // Add requirements and history
      const [requirements, history] = await Promise.all([
        Booking.getRequirements(bookingId),
        Booking.getHistory(bookingId, { limit: 50 })
      ]);

      return {
        ...enrichedBooking,
        requirements,
        history,
        user_role: userRole,
        next_possible_states: BookingStateMachine.getNextStatesForRole(booking.status, userRole)
      };

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to get booking details: ${error.message}`, 'GET_BOOKING_FAILED');
    }
  }

  /**
   * Search bookings with filters
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @param {string} requestingUserId - User ID requesting the data
   * @returns {Promise<Object>} Search results
   */
  async searchBookings(criteria, options, requestingUserId) {
    try {
      // Ensure user can only see their own bookings (unless admin)
      const user = await User.findById(requestingUserId);
      if (!user) {
        throw new BookingServiceError('User not found', 'USER_NOT_FOUND');
      }

      // Restrict search to user's own bookings unless admin
      if (user.role !== 'admin') {
        if (!criteria.clientId && !criteria.retireeId) {
          // If no specific user filter, search both client and retiree bookings
          criteria.clientId = requestingUserId;
        } else {
          // Verify user can access the specified bookings
          if (criteria.clientId && criteria.clientId !== requestingUserId) {
            throw new BookingServiceError('Cannot access other users\' bookings', 'UNAUTHORIZED_SEARCH');
          }
          if (criteria.retireeId && criteria.retireeId !== requestingUserId) {
            throw new BookingServiceError('Cannot access other users\' bookings', 'UNAUTHORIZED_SEARCH');
          }
        }
      }

      // Search bookings
      const results = await Booking.findByCriteria(criteria, options);

      // Enrich booking data
      const enrichedBookings = await Promise.all(
        results.bookings.map(booking => this.enrichBookingData(booking))
      );

      return {
        bookings: enrichedBookings,
        pagination: results.pagination,
        summary: await this.getBookingsSummary(enrichedBookings)
      };

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to search bookings: ${error.message}`, 'SEARCH_BOOKINGS_FAILED');
    }
  }

  /**
   * Update booking details
   * @param {string} bookingId - Booking ID
   * @param {Object} updateData - Fields to update
   * @param {string} userId - User performing the update
   * @returns {Promise<Object>} Updated booking
   */
  async updateBooking(bookingId, updateData, userId) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      // Verify user authorization
      const userRole = BookingStateMachine.getUserRoleForBooking(booking, userId);
      if (userRole === 'unknown') {
        throw new BookingServiceError('Not authorized to update this booking', 'UNAUTHORIZED_UPDATE');
      }

      // Update booking
      const updatedBooking = await Booking.update(bookingId, updateData, userId);

      // Enrich booking data
      const enrichedBooking = await this.enrichBookingData(updatedBooking);

      console.log(`Booking ${bookingId} updated by ${userId}`);

      return enrichedBooking;

    } catch (error) {
      if (error instanceof BookingError || error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to update booking: ${error.message}`, 'UPDATE_BOOKING_FAILED');
    }
  }

  /**
   * Get booking statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User's booking statistics
   */
  async getUserBookingStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new BookingServiceError('User not found', 'USER_NOT_FOUND');
      }

      // Get stats as client and as retiree
      const [clientStats, retireeStats] = await Promise.all([
        Booking.getStats({ clientId: userId }),
        Booking.getStats({ retireeId: userId })
      ]);

      return {
        as_client: clientStats,
        as_retiree: retireeStats,
        combined: {
          total: clientStats.total + retireeStats.total,
          totalValue: clientStats.totalValue + retireeStats.totalValue,
          averageRate: (clientStats.averageRate + retireeStats.averageRate) / 2
        }
      };

    } catch (error) {
      if (error instanceof BookingServiceError) {
        throw error;
      }
      throw new BookingServiceError(`Failed to get user booking stats: ${error.message}`, 'GET_STATS_FAILED');
    }
  }

  // Helper methods

  /**
   * Enrich booking data with user and profile information
   * @param {Object} booking - Raw booking object
   * @returns {Promise<Object>} Enriched booking object
   */
  async enrichBookingData(booking) {
    try {
      // Get user information
      const [client, retiree] = await Promise.all([
        User.findById(booking.client_id),
        User.findById(booking.retiree_id)
      ]);

      // Get profile information if available
      let clientProfile = null;
      let retireeProfile = null;

      if (booking.client_profile_id) {
        clientProfile = await Profile.findById(booking.client_profile_id);
      }

      if (booking.retiree_profile_id) {
        retireeProfile = await Profile.findById(booking.retiree_profile_id);
      }

      return {
        ...booking,
        client: client ? {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          emailVerified: client.emailVerified
        } : null,
        retiree: retiree ? {
          id: retiree.id,
          firstName: retiree.firstName,
          lastName: retiree.lastName,
          email: retiree.email,
          emailVerified: retiree.emailVerified
        } : null,
        client_profile: clientProfile ? {
          id: clientProfile.id,
          display_name: clientProfile.display_name,
          headline: clientProfile.headline,
          profile_photo_url: clientProfile.profile_photo_url
        } : null,
        retiree_profile: retireeProfile ? {
          id: retireeProfile.id,
          display_name: retireeProfile.display_name,
          headline: retireeProfile.headline,
          profile_photo_url: retireeProfile.profile_photo_url,
          average_rating: retireeProfile.average_rating,
          total_reviews: retireeProfile.total_reviews
        } : null,
        state_description: BookingStateMachine.getStateDescription(booking.status),
        is_final_state: BookingStateMachine.isFinalState(booking.status),
        can_be_cancelled: BookingStateMachine.canBeCancelled(booking.status)
      };

    } catch (error) {
      console.error('Error enriching booking data:', error);
      return booking; // Return original booking if enrichment fails
    }
  }

  /**
   * Find active bookings between two users
   * @param {string} clientId - Client user ID
   * @param {string} retireeId - Retiree user ID
   * @returns {Promise<Array>} Active bookings
   */
  async findActiveBookingsBetweenUsers(clientId, retireeId) {
    try {
      const activeStates = [
        BOOKING_STATES.REQUEST,
        BOOKING_STATES.PENDING,
        BOOKING_STATES.ACCEPTED,
        BOOKING_STATES.ACTIVE,
        BOOKING_STATES.DELIVERED
      ];

      const results = await Booking.findByCriteria({
        clientId,
        retireeId,
        status: activeStates
      });

      return results.bookings;

    } catch (error) {
      console.error('Error finding active bookings:', error);
      return [];
    }
  }

  /**
   * Update profile rating after booking completion
   * @param {string} profileId - Profile ID to update
   * @param {number} rating - New rating to incorporate
   * @returns {Promise<void>}
   */
  async updateProfileRating(profileId, rating) {
    try {
      const profile = await Profile.findById(profileId);
      if (!profile) return;

      const currentRating = profile.average_rating || 0;
      const currentReviews = profile.total_reviews || 0;
      
      const newTotalReviews = currentReviews + 1;
      const newAverageRating = ((currentRating * currentReviews) + rating) / newTotalReviews;

      await Profile.update(profileId, {
        average_rating: Math.round(newAverageRating * 100) / 100, // Round to 2 decimal places
        total_reviews: newTotalReviews
      });

    } catch (error) {
      console.error('Error updating profile rating:', error);
      // Don't throw error as this is not critical for booking completion
    }
  }

  /**
   * Generate summary of bookings
   * @param {Array} bookings - Array of bookings
   * @returns {Object} Summary statistics
   */
  getBookingsSummary(bookings) {
    const summary = {
      total: bookings.length,
      by_status: {},
      by_engagement_type: {},
      upcoming: 0,
      overdue: 0,
      total_value: 0
    };

    const now = new Date();

    for (const booking of bookings) {
      // Count by status
      summary.by_status[booking.status] = (summary.by_status[booking.status] || 0) + 1;
      
      // Count by engagement type
      summary.by_engagement_type[booking.engagement_type] = 
        (summary.by_engagement_type[booking.engagement_type] || 0) + 1;
      
      // Count upcoming and overdue
      if (booking.start_date) {
        const startDate = new Date(booking.start_date);
        if (startDate > now && booking.status !== BOOKING_STATES.COMPLETED && booking.status !== BOOKING_STATES.CANCELLED) {
          summary.upcoming++;
        }
      }
      
      if (booking.end_date) {
        const endDate = new Date(booking.end_date);
        if (endDate < now && booking.status === BOOKING_STATES.ACTIVE) {
          summary.overdue++;
        }
      }
      
      // Calculate total value
      if (booking.agreed_rate && booking.estimated_hours) {
        summary.total_value += booking.agreed_rate * booking.estimated_hours;
      }
    }

    return summary;
  }
}

// Export singleton instance
module.exports = {
  BookingService: new BookingService(),
  BookingServiceError
};