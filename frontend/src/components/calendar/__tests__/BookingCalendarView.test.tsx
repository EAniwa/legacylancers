import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingCalendarView } from '../BookingCalendarView';
import { calendarApi } from '../../../services/calendarApi';
import type { CalendarEvent } from '../../../services/calendarApi';

// Mock the calendar API
jest.mock('../../../services/calendarApi', () => ({
  calendarApi: {
    getCalendarEvents: jest.fn(),
  },
}));

const mockCalendarApi = calendarApi as jest.Mocked<typeof calendarApi>;

const mockEvents: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Client Meeting',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    type: 'booking',
    status: 'confirmed',
    userId: 'user-123',
    timezone: 'America/New_York',
  },
  {
    id: 'event-2',
    title: 'Available Slot',
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    type: 'availability',
    status: 'available',
    userId: 'user-123',
    timezone: 'America/New_York',
  },
];

describe('BookingCalendarView', () => {
  const defaultProps = {
    userId: 'user-123',
    userRole: 'client' as 'client' | 'retiree',
    onEventClick: jest.fn(),
    onDateClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalendarApi.getCalendarEvents.mockResolvedValue(mockEvents);
  });

  it('renders calendar header with correct title for client', async () => {
    render(<BookingCalendarView {...defaultProps} />);
    
    expect(screen.getByText('Booking Calendar')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders calendar header with correct title for retiree', async () => {
    render(<BookingCalendarView {...defaultProps} userRole="retiree" />);
    
    expect(screen.getByText('My Schedule')).toBeInTheDocument();
  });

  it('loads and displays calendar events', async () => {
    render(<BookingCalendarView {...defaultProps} />);

    await waitFor(() => {
      expect(mockCalendarApi.getCalendarEvents).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(String)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Client Meeting')).toBeInTheDocument();
      expect(screen.getByText('Available Slot')).toBeInTheDocument();
    });
  });

  it('displays event type icons correctly', async () => {
    render(<BookingCalendarView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('📅')).toBeInTheDocument(); // Booking icon
      expect(screen.getByText('🕐')).toBeInTheDocument(); // Availability icon
    });
  });

  it('navigates between months', async () => {
    render(<BookingCalendarView {...defaultProps} />);

    const nextMonthButton = screen.getAllByRole('button')[2]; // Third button is next month
    fireEvent.click(nextMonthButton);

    await waitFor(() => {
      expect(mockCalendarApi.getCalendarEvents).toHaveBeenCalledTimes(2);
    });
  });

  it('calls onEventClick when event is clicked', async () => {
    const onEventClick = jest.fn();
    render(<BookingCalendarView {...defaultProps} onEventClick={onEventClick} />);

    await waitFor(() => {
      expect(screen.getByText('Client Meeting')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Client Meeting'));

    expect(onEventClick).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('calls onDateClick when date is clicked', async () => {
    const onDateClick = jest.fn();
    render(<BookingCalendarView {...defaultProps} onDateClick={onDateClick} />);

    await waitFor(() => {
      const today = new Date().getDate().toString();
      const dateElement = screen.getByText(today);
      fireEvent.click(dateElement);
    });

    expect(onDateClick).toHaveBeenCalledWith(expect.any(Date));
  });

  it('displays calendar legend', () => {
    render(<BookingCalendarView {...defaultProps} />);
    
    expect(screen.getByText('📅 Bookings')).toBeInTheDocument();
    expect(screen.getByText('🕐 Availability')).toBeInTheDocument();
    expect(screen.getByText('💼 Gigs')).toBeInTheDocument();
    expect(screen.getByText('🚫 Blocked')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockCalendarApi.getCalendarEvents.mockRejectedValue(new Error('API Error'));
    render(<BookingCalendarView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error loading calendar: API Error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('shows loading spinner while fetching events', () => {
    mockCalendarApi.getCalendarEvents.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<BookingCalendarView {...defaultProps} />);
    
    const loadingElement = screen.getByRole('button'); // Loading spinner has button role
    expect(loadingElement).toBeInTheDocument();
  });

  it('shows "+N more" indicator when day has too many events', async () => {
    const manyEvents = Array.from({ length: 5 }, (_, i) => ({
      ...mockEvents[0],
      id: `event-${i}`,
      title: `Event ${i}`,
    }));

    mockCalendarApi.getCalendarEvents.mockResolvedValue(manyEvents);
    render(<BookingCalendarView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });
  });
});