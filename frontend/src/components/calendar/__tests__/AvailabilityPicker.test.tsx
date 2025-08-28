import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvailabilityPicker } from '../AvailabilityPicker';
import { calendarApi } from '../../../services/calendarApi';
import type { AvailabilitySlot } from '../../../services/calendarApi';

// Mock the calendar API
jest.mock('../../../services/calendarApi', () => ({
  calendarApi: {
    getAvailableSlots: jest.fn(),
  },
}));

const mockCalendarApi = calendarApi as jest.Mocked<typeof calendarApi>;

const mockSlots: AvailabilitySlot[] = [
  {
    id: 'slot-1',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T11:00:00Z',
    timezone: 'America/New_York',
    rate: 150,
    engagementType: 'consultation',
    isBooked: false,
    isRecurring: false,
    maxBookings: 1,
    currentBookings: 0,
  },
  {
    id: 'slot-2',
    startTime: '2024-01-15T14:00:00Z',
    endTime: '2024-01-15T15:00:00Z',
    timezone: 'America/New_York',
    rate: 200,
    engagementType: 'mentoring',
    isBooked: true,
    isRecurring: false,
    maxBookings: 1,
    currentBookings: 1,
  },
];

describe('AvailabilityPicker', () => {
  const defaultProps = {
    userId: 'user-123',
    onSlotSelect: jest.fn(),
    timezone: 'America/New_York',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalendarApi.getAvailableSlots.mockResolvedValue(mockSlots);
  });

  it('renders the availability picker header correctly', async () => {
    render(<AvailabilityPicker {...defaultProps} />);
    
    expect(screen.getByText('Select Available Time')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('loads and displays available slots', async () => {
    render(<AvailabilityPicker {...defaultProps} />);

    await waitFor(() => {
      expect(mockCalendarApi.getAvailableSlots).toHaveBeenCalledWith(
        'user-123',
        expect.any(String),
        expect.any(String),
        'America/New_York'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('10:00 AM - 11:00 AM')).toBeInTheDocument();
      expect(screen.getByText('$150/hr')).toBeInTheDocument();
    });
  });

  it('filters out booked slots and shows them as disabled', async () => {
    render(<AvailabilityPicker {...defaultProps} />);

    await waitFor(() => {
      const bookedSlotButton = screen.queryByText('2:00 PM - 3:00 PM');
      expect(bookedSlotButton).not.toBeInTheDocument();
    });
  });

  it('calls onSlotSelect when a slot is clicked', async () => {
    const onSlotSelect = jest.fn();
    render(<AvailabilityPicker {...defaultProps} onSlotSelect={onSlotSelect} />);

    await waitFor(() => {
      expect(screen.getByText('10:00 AM - 11:00 AM')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('10:00 AM - 11:00 AM'));

    expect(onSlotSelect).toHaveBeenCalledWith(mockSlots[0]);
  });

  it('navigates between weeks', async () => {
    render(<AvailabilityPicker {...defaultProps} />);

    const nextWeekButton = screen.getAllByRole('button')[2]; // Third button is next week
    fireEvent.click(nextWeekButton);

    await waitFor(() => {
      expect(mockCalendarApi.getAvailableSlots).toHaveBeenCalledTimes(2);
    });
  });

  it('displays selected slot information', async () => {
    const selectedSlot = mockSlots[0];
    render(<AvailabilityPicker {...defaultProps} selectedSlot={selectedSlot} />);

    await waitFor(() => {
      expect(screen.getByText('Selected Time Slot')).toBeInTheDocument();
      expect(screen.getByText('Rate: $150/hour')).toBeInTheDocument();
      expect(screen.getByText('Type: consultation')).toBeInTheDocument();
    });
  });

  it('shows no availability message when no slots are available', async () => {
    mockCalendarApi.getAvailableSlots.mockResolvedValue([]);
    render(<AvailabilityPicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No availability for this week. Try selecting a different week.')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockCalendarApi.getAvailableSlots.mockRejectedValue(new Error('API Error'));
    render(<AvailabilityPicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load availability')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('filters slots based on advance notice requirement', async () => {
    const futureSlot = {
      ...mockSlots[0],
      startTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // 25 hours from now
    };
    
    mockCalendarApi.getAvailableSlots.mockResolvedValue([futureSlot]);
    
    render(<AvailabilityPicker {...defaultProps} minAdvanceNotice={24} />);

    await waitFor(() => {
      expect(screen.getByText(futureSlot.startTime.split('T')[0])).toBeInTheDocument();
    });
  });
});