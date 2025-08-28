/**
 * Booking State Machine Utility
 * Manages booking state transitions and validation
 */

class BookingStateMachineError extends Error {
  constructor(message, code = 'STATE_MACHINE_ERROR') {
    super(message);
    this.name = 'BookingStateMachineError';
    this.code = code;
  }
}

/**
 * Booking states and their allowed transitions
 * State Flow: request → pending → accepted/rejected → active → delivered → completed
 * Cancellation can happen from most states
 */
const BOOKING_STATES = {
  REQUEST: 'request',
  PENDING: 'pending', 
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

/**
 * Valid state transitions mapping
 * Each state maps to an array of valid next states
 */
const STATE_TRANSITIONS = {
  [BOOKING_STATES.REQUEST]: [
    BOOKING_STATES.PENDING,
    BOOKING_STATES.ACCEPTED,
    BOOKING_STATES.REJECTED,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.PENDING]: [
    BOOKING_STATES.ACCEPTED,
    BOOKING_STATES.REJECTED,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.ACCEPTED]: [
    BOOKING_STATES.ACTIVE,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.REJECTED]: [
    BOOKING_STATES.REQUEST // Allow re-submission after rejection
  ],
  [BOOKING_STATES.ACTIVE]: [
    BOOKING_STATES.DELIVERED,
    BOOKING_STATES.CANCELLED
  ],
  [BOOKING_STATES.DELIVERED]: [
    BOOKING_STATES.COMPLETED,
    BOOKING_STATES.ACTIVE // Allow returning to active if delivery rejected
  ],
  [BOOKING_STATES.COMPLETED]: [], // Final state
  [BOOKING_STATES.CANCELLED]: [] // Final state
};

/**
 * Role-based permissions for state transitions
 * Defines which roles can perform which transitions
 */
const TRANSITION_PERMISSIONS = {
  [BOOKING_STATES.REQUEST]: {
    [BOOKING_STATES.PENDING]: ['client', 'system'],
    [BOOKING_STATES.ACCEPTED]: ['retiree'],
    [BOOKING_STATES.REJECTED]: ['retiree'],
    [BOOKING_STATES.CANCELLED]: ['client']
  },
  [BOOKING_STATES.PENDING]: {
    [BOOKING_STATES.ACCEPTED]: ['retiree'],
    [BOOKING_STATES.REJECTED]: ['retiree'],
    [BOOKING_STATES.CANCELLED]: ['client', 'retiree']
  },
  [BOOKING_STATES.ACCEPTED]: {
    [BOOKING_STATES.ACTIVE]: ['client', 'retiree', 'system'],
    [BOOKING_STATES.CANCELLED]: ['client', 'retiree']
  },
  [BOOKING_STATES.REJECTED]: {
    [BOOKING_STATES.REQUEST]: ['client']
  },
  [BOOKING_STATES.ACTIVE]: {
    [BOOKING_STATES.DELIVERED]: ['retiree'],
    [BOOKING_STATES.CANCELLED]: ['client', 'retiree']
  },
  [BOOKING_STATES.DELIVERED]: {
    [BOOKING_STATES.COMPLETED]: ['client'],
    [BOOKING_STATES.ACTIVE]: ['client'] // If delivery is not satisfactory
  },
  [BOOKING_STATES.COMPLETED]: {},
  [BOOKING_STATES.CANCELLED]: {}
};

/**
 * Required fields for each state transition
 * Fields that must be present when transitioning to a state
 */
const STATE_REQUIREMENTS = {
  [BOOKING_STATES.REQUEST]: ['title', 'description', 'client_id', 'retiree_id'],
  [BOOKING_STATES.PENDING]: [],
  [BOOKING_STATES.ACCEPTED]: ['agreed_rate', 'agreed_rate_type'],
  [BOOKING_STATES.REJECTED]: ['rejection_reason'],
  [BOOKING_STATES.ACTIVE]: ['start_date'],
  [BOOKING_STATES.DELIVERED]: ['delivery_date'],
  [BOOKING_STATES.COMPLETED]: ['completion_date'],
  [BOOKING_STATES.CANCELLED]: ['cancellation_reason']
};

/**
 * State descriptions for user-friendly messages
 */
const STATE_DESCRIPTIONS = {
  [BOOKING_STATES.REQUEST]: 'Booking request created',
  [BOOKING_STATES.PENDING]: 'Awaiting retiree response',
  [BOOKING_STATES.ACCEPTED]: 'Booking accepted by retiree',
  [BOOKING_STATES.REJECTED]: 'Booking declined by retiree',
  [BOOKING_STATES.ACTIVE]: 'Work in progress',
  [BOOKING_STATES.DELIVERED]: 'Work completed, awaiting approval',
  [BOOKING_STATES.COMPLETED]: 'Booking successfully completed',
  [BOOKING_STATES.CANCELLED]: 'Booking cancelled'
};

/**
 * Booking State Machine Class
 */
class BookingStateMachine {
  
  /**
   * Check if a state transition is valid
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} True if transition is valid
   */
  static isValidTransition(fromState, toState) {
    if (!fromState || !toState) {
      return false;
    }

    if (!this.isValidState(fromState) || !this.isValidState(toState)) {
      return false;
    }

    const allowedTransitions = STATE_TRANSITIONS[fromState] || [];
    return allowedTransitions.includes(toState);
  }

  /**
   * Check if a state is valid
   * @param {string} state - State to check
   * @returns {boolean} True if state is valid
   */
  static isValidState(state) {
    return Object.values(BOOKING_STATES).includes(state);
  }

  /**
   * Check if a user role can perform a specific transition
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @param {string} userRole - User role ('client', 'retiree', 'admin', 'system')
   * @returns {boolean} True if role can perform transition
   */
  static canUserTransition(fromState, toState, userRole) {
    if (!this.isValidTransition(fromState, toState)) {
      return false;
    }

    // Admins can perform any valid transition
    if (userRole === 'admin') {
      return true;
    }

    const transitionPerms = TRANSITION_PERMISSIONS[fromState] || {};
    const allowedRoles = transitionPerms[toState] || [];
    
    return allowedRoles.includes(userRole);
  }

  /**
   * Get allowed next states for a given state
   * @param {string} currentState - Current state
   * @returns {Array<string>} Array of valid next states
   */
  static getNextStates(currentState) {
    if (!this.isValidState(currentState)) {
      return [];
    }

    return STATE_TRANSITIONS[currentState] || [];
  }

  /**
   * Get allowed next states for a user role
   * @param {string} currentState - Current state
   * @param {string} userRole - User role
   * @returns {Array<string>} Array of valid next states for the role
   */
  static getNextStatesForRole(currentState, userRole) {
    const nextStates = this.getNextStates(currentState);
    
    if (userRole === 'admin') {
      return nextStates;
    }

    return nextStates.filter(nextState => 
      this.canUserTransition(currentState, nextState, userRole)
    );
  }

  /**
   * Validate state transition with comprehensive checks
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @param {string} userRole - User role performing transition
   * @param {Object} bookingData - Booking data to validate requirements
   * @returns {Object} Validation result with success/error details
   */
  static validateTransition(fromState, toState, userRole, bookingData = {}) {
    try {
      // Check if states are valid
      if (!this.isValidState(fromState)) {
        return {
          success: false,
          error: 'Invalid current state',
          code: 'INVALID_FROM_STATE'
        };
      }

      if (!this.isValidState(toState)) {
        return {
          success: false,
          error: 'Invalid target state',
          code: 'INVALID_TO_STATE'
        };
      }

      // Check if transition is allowed
      if (!this.isValidTransition(fromState, toState)) {
        return {
          success: false,
          error: `Cannot transition from ${fromState} to ${toState}`,
          code: 'INVALID_TRANSITION'
        };
      }

      // Check role permissions
      if (!this.canUserTransition(fromState, toState, userRole)) {
        return {
          success: false,
          error: `Role ${userRole} cannot perform transition from ${fromState} to ${toState}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check required fields for target state
      const requiredFields = STATE_REQUIREMENTS[toState] || [];
      const missingFields = requiredFields.filter(field => 
        !bookingData[field] || 
        (typeof bookingData[field] === 'string' && bookingData[field].trim() === '')
      );

      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Missing required fields for ${toState} state: ${missingFields.join(', ')}`,
          code: 'MISSING_REQUIRED_FIELDS',
          missingFields
        };
      }

      // All checks passed
      return {
        success: true,
        message: `Transition from ${fromState} to ${toState} is valid`,
        description: STATE_DESCRIPTIONS[toState]
      };

    } catch (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Get state description
   * @param {string} state - Booking state
   * @returns {string} Human-readable state description
   */
  static getStateDescription(state) {
    return STATE_DESCRIPTIONS[state] || 'Unknown state';
  }

  /**
   * Check if state is a final state (no further transitions possible)
   * @param {string} state - State to check
   * @returns {boolean} True if state is final
   */
  static isFinalState(state) {
    const nextStates = this.getNextStates(state);
    return nextStates.length === 0;
  }

  /**
   * Get all possible states
   * @returns {Object} All booking states
   */
  static getAllStates() {
    return { ...BOOKING_STATES };
  }

  /**
   * Get initial state for new bookings
   * @returns {string} Initial booking state
   */
  static getInitialState() {
    return BOOKING_STATES.REQUEST;
  }

  /**
   * Check if booking can be cancelled from current state
   * @param {string} currentState - Current booking state
   * @returns {boolean} True if booking can be cancelled
   */
  static canBeCancelled(currentState) {
    return this.getNextStates(currentState).includes(BOOKING_STATES.CANCELLED);
  }

  /**
   * Get user role from booking and user context
   * @param {Object} booking - Booking object
   * @param {string} userId - User ID
   * @returns {string} User role in context of this booking
   */
  static getUserRoleForBooking(booking, userId) {
    if (!booking || !userId) {
      return 'unknown';
    }

    if (booking.client_id === userId) {
      return 'client';
    }
    
    if (booking.retiree_id === userId) {
      return 'retiree';
    }

    return 'unknown';
  }

  /**
   * Generate transition summary for API responses
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @param {Object} additionalData - Additional transition data
   * @returns {Object} Transition summary
   */
  static getTransitionSummary(fromState, toState, additionalData = {}) {
    return {
      from: {
        state: fromState,
        description: this.getStateDescription(fromState)
      },
      to: {
        state: toState,
        description: this.getStateDescription(toState)
      },
      timestamp: new Date().toISOString(),
      ...additionalData
    };
  }
}

module.exports = {
  BookingStateMachine,
  BookingStateMachineError,
  BOOKING_STATES,
  STATE_TRANSITIONS,
  TRANSITION_PERMISSIONS,
  STATE_REQUIREMENTS,
  STATE_DESCRIPTIONS
};