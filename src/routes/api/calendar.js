/**
 * Calendar API Routes
 * Handles calendar events, timezone conversions, and booking integration
 */

const express = require('express');
const { calendarController } = require('../../controllers/calendar');
const { authMiddleware } = require('../../middleware/auth');
const { rateLimitMiddleware } = require('../../middleware/rateLimit');
const { validationMiddleware, calendarValidation } = require('../../middleware/validation');

const router = express.Router();

// Apply authentication to all calendar routes
router.use(authMiddleware);

// Apply rate limiting (higher limits for calendar operations)
router.use(rateLimitMiddleware({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200 // 200 requests per 15 minutes
}));

/**
 * Calendar Events Routes
 */

// Get calendar events
router.get('/events', 
  validationMiddleware(calendarValidation.getEvents), 
  calendarController.getCalendarEvents
);

// Create calendar event
router.post('/events', 
  validationMiddleware(calendarValidation.createEvent), 
  calendarController.createCalendarEvent
);

// Get specific calendar event
router.get('/events/:id', 
  validationMiddleware(calendarValidation.getEventById), 
  calendarController.getCalendarEventById
);

// Update calendar event
router.put('/events/:id', 
  validationMiddleware(calendarValidation.updateEvent), 
  calendarController.updateCalendarEvent
);

// Delete calendar event
router.delete('/events/:id', 
  validationMiddleware(calendarValidation.deleteEvent), 
  calendarController.deleteCalendarEvent
);

/**
 * Timezone and Conversion Routes
 */

// Get available timezones
router.get('/timezones', calendarController.getTimezones);

// Convert time between timezones
router.post('/convert-timezone', 
  validationMiddleware(calendarValidation.convertTimezone), 
  calendarController.convertTimezone
);

/**
 * Booking Integration Routes
 */

// Create calendar event from booking
router.post('/events/from-booking/:bookingId', 
  validationMiddleware(calendarValidation.createEventFromBooking), 
  calendarController.createEventFromBooking
);

// Update calendar event when booking changes
router.put('/events/booking/:bookingId', 
  validationMiddleware(calendarValidation.updateEventFromBooking), 
  calendarController.updateEventFromBooking
);

// Cancel calendar event when booking is cancelled
router.delete('/events/booking/:bookingId', 
  validationMiddleware(calendarValidation.cancelEventFromBooking), 
  calendarController.cancelEventFromBooking
);

/**
 * Calendar Sync Routes
 */

// Get calendar sync status
router.get('/sync/status', calendarController.getCalendarSyncStatus);

// Sync with external calendar
router.post('/sync/external', 
  validationMiddleware(calendarValidation.syncExternal), 
  calendarController.syncExternalCalendar
);

/**
 * Availability Integration Routes
 */

// Get calendar view of availability
router.get('/availability-calendar', 
  validationMiddleware(calendarValidation.getAvailabilityCalendar), 
  calendarController.getAvailabilityCalendar
);

// Block time on calendar (creates blocked availability)
router.post('/block-time', 
  validationMiddleware(calendarValidation.blockTime), 
  calendarController.blockTime
);

module.exports = router;