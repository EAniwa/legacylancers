export interface TimeSlot {
  id?: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  bookingId?: string;
  userId: string;
  timezone: string;
  engagementType?: string;
  rate?: number;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  startTime: string;
  endTime: string;
  userId: string;
  bookingId?: string;
  gigId?: string;
  type: 'booking' | 'availability' | 'blocked' | 'gig';
  status?: 'confirmed' | 'pending' | 'cancelled';
  attendees?: string[];
  location?: string;
  isVirtual?: boolean;
  meetingUrl?: string;
}

export interface AvailabilitySlot {
  id: string;
  startTime: string;
  endTime: string;
  engagementType: string;
  rate: number;
  timezone: string;
  isBooked: boolean;
  maxBookings: number;
  currentBookings: number;
}

export interface BookingSlot {
  availabilityId: string;
  requestedStartTime: string;
  requestedEndTime: string;
  duration: number;
  timezone: string;
  notes?: string;
}

class CalendarApiService {
  private baseUrl = '/api/calendar';
  private availabilityUrl = '/api/availability';

  // Get available slots for a specific user and date range
  async getAvailableSlots(
    userId: string, 
    startDate: string, 
    endDate: string,
    timezone?: string
  ): Promise<AvailabilitySlot[]> {
    const params = new URLSearchParams({
      userId,
      startDate,
      endDate,
      ...(timezone && { timezone }),
    });

    const response = await fetch(`${this.availabilityUrl}/slots/find?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch available slots: ${response.statusText}`);
    }

    return response.json();
  }

  // Check if a specific time slot is available
  async checkSlotAvailability(
    userId: string,
    startTime: string,
    endTime: string,
    timezone: string
  ): Promise<{ available: boolean; conflicts: CalendarEvent[]; alternatives: AvailabilitySlot[] }> {
    const response = await fetch(`${this.availabilityUrl}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        startTime,
        endTime,
        timezone,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to check availability: ${response.statusText}`);
    }

    return response.json();
  }

  // Book a time slot (links to booking system)
  async bookTimeSlot(bookingSlot: BookingSlot & { bookingId: string }): Promise<CalendarEvent> {
    const response = await fetch(`${this.availabilityUrl}/slots/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingSlot),
    });

    if (!response.ok) {
      throw new Error(`Failed to book time slot: ${response.statusText}`);
    }

    return response.json();
  }

  // Get calendar events for a user (bookings + availability)
  async getCalendarEvents(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      userId,
      startDate,
      endDate,
    });

    const response = await fetch(`${this.baseUrl}/events?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
    }

    return response.json();
  }

  // Create a calendar event for a confirmed booking
  async createBookingEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const response = await fetch(`${this.baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Failed to create calendar event: ${response.statusText}`);
    }

    return response.json();
  }

  // Update calendar event when booking changes
  async updateBookingEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update calendar event: ${response.statusText}`);
    }

    return response.json();
  }

  // Cancel/remove calendar event when booking is cancelled
  async cancelBookingEvent(eventId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel calendar event: ${response.statusText}`);
    }
  }

  // Get timezone suggestions based on user location
  async getTimezoneOptions(): Promise<{ value: string; label: string; offset: string }[]> {
    const response = await fetch(`${this.baseUrl}/timezones`);

    if (!response.ok) {
      throw new Error(`Failed to fetch timezone options: ${response.statusText}`);
    }

    return response.json();
  }

  // Convert time between timezones
  async convertTimezone(
    dateTime: string,
    fromTimezone: string,
    toTimezone: string
  ): Promise<{ convertedTime: string; offset: number }> {
    const response = await fetch(`${this.baseUrl}/convert-timezone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateTime,
        fromTimezone,
        toTimezone,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to convert timezone: ${response.statusText}`);
    }

    return response.json();
  }

  // Reschedule a booking to a new time slot
  async rescheduleBooking(
    bookingId: string,
    newSlot: BookingSlot
  ): Promise<{ oldEvent: CalendarEvent; newEvent: CalendarEvent }> {
    const response = await fetch(`${this.baseUrl}/booking/${bookingId}/reschedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newSlot),
    });

    if (!response.ok) {
      throw new Error(`Failed to reschedule booking: ${response.statusText}`);
    }

    return response.json();
  }
}

export const calendarApi = new CalendarApiService();