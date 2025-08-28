import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConflictResolution } from '../ConflictResolution';
import { calendarApi } from '../../../services/calendarApi';
import type { CalendarEvent, AvailabilitySlot } from '../../../services/calendarApi';

// Mock the calendar API
jest.mock('../../../services/calendarApi', () => ({
  calendarApi: {
    checkSlotAvailability: jest.fn(),
  },
}));

const mockCalendarApi = calendarApi as jest.Mocked<typeof calendarApi>;

const mockConflicts: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Existing Meeting',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T11:00:00Z',
    type: 'booking',
    status: 'confirmed',
    userId: 'user-123',
    timezone: 'America/New_York',
  },
];

const mockAlternatives: AvailabilitySlot[] = [
  {
    id: 'alt-1',
    startTime: '2024-01-15T12:00:00Z',
    endTime: '2024-01-15T13:00:00Z',
    timezone: 'America/New_York',
    rate: 150,
    engagementType: 'consultation',
    isBooked: false,
    isRecurring: false,
    maxBookings: 1,
    currentBookings: 0,
  },
];

describe('ConflictResolution', () => {
  const defaultProps = {
    userId: 'user-123',
    requestedStartTime: '2024-01-15T10:00:00Z',
    requestedEndTime: '2024-01-15T11:00:00Z',
    timezone: 'America/New_York',
    conflicts: mockConflicts,
    onResolve: jest.fn(),
    onCancel: jest.fn(),
    isOpen: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCalendarApi.checkSlotAvailability.mockResolvedValue({
      available: false,
      conflicts: mockConflicts,
      alternatives: mockAlternatives,
    });
  });

  it('renders conflict resolution modal when open', async () => {
    render(<ConflictResolution {...defaultProps} />);
    
    expect(screen.getByText('Scheduling Conflict Detected')).toBeInTheDocument();
    expect(screen.getByText('Your requested time slot conflicts with existing events. Please select an alternative time.')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<ConflictResolution {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Scheduling Conflict Detected')).not.toBeInTheDocument();
  });

  it('displays the requested time slot', () => {
    render(<ConflictResolution {...defaultProps} />);
    
    expect(screen.getByText('Requested Time (Not Available)')).toBeInTheDocument();
    expect(screen.getByText('Monday, January 15, 2024')).toBeInTheDocument();
  });

  it('displays conflicting events', () => {
    render(<ConflictResolution {...defaultProps} />);
    
    expect(screen.getByText('Conflicting Events')).toBeInTheDocument();
    expect(screen.getByText('Existing Meeting')).toBeInTheDocument();
    expect(screen.getByText('📅')).toBeInTheDocument();
  });

  it('loads and displays alternative time slots', async () => {
    render(<ConflictResolution {...defaultProps} />);

    await waitFor(() => {
      expect(mockCalendarApi.checkSlotAvailability).toHaveBeenCalledWith(
        'user-123',
        '2024-01-15T10:00:00Z',
        '2024-01-15T11:00:00Z',
        'America/New_York'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Suggested Alternative Times')).toBeInTheDocument();
      expect(screen.getByText('Jan 15, 12:00 PM - 1:00 PM')).toBeInTheDocument();
    });
  });

  it('allows selecting an alternative slot', async () => {
    render(<ConflictResolution {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Jan 15, 12:00 PM - 1:00 PM')).toBeInTheDocument();
    });

    const alternativeSlot = screen.getByText('Jan 15, 12:00 PM - 1:00 PM').closest('button');
    fireEvent.click(alternativeSlot!);

    const confirmButton = screen.getByText('Confirm Alternative Time');
    expect(confirmButton).not.toBeDisabled();
  });

  it('calls onResolve when confirming alternative slot', async () => {
    const onResolve = jest.fn();
    render(<ConflictResolution {...defaultProps} onResolve={onResolve} />);

    await waitFor(() => {
      expect(screen.getByText('Jan 15, 12:00 PM - 1:00 PM')).toBeInTheDocument();
    });

    // Select alternative slot
    const alternativeSlot = screen.getByText('Jan 15, 12:00 PM - 1:00 PM').closest('button');
    fireEvent.click(alternativeSlot!);

    // Confirm selection
    const confirmButton = screen.getByText('Confirm Alternative Time');
    fireEvent.click(confirmButton);

    expect(onResolve).toHaveBeenCalledWith(mockAlternatives[0]);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<ConflictResolution {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('shows calendar view when requested', async () => {
    render(<ConflictResolution {...defaultProps} />);

    const browseCalendarButton = screen.getByText('Browse Full Calendar');
    fireEvent.click(browseCalendarButton);

    expect(screen.getByText('Hide Calendar')).toBeInTheDocument();
  });

  it('handles API errors when loading alternatives', async () => {
    mockCalendarApi.checkSlotAvailability.mockRejectedValue(new Error('API Error'));
    
    render(<ConflictResolution {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText('Suggested Alternative Times')).not.toBeInTheDocument();
    });
  });

  it('disables confirm button when no alternative is selected', async () => {
    render(<ConflictResolution {...defaultProps} />);

    await waitFor(() => {
      const confirmButton = screen.getByText('Confirm Alternative Time');
      expect(confirmButton).toBeDisabled();
    });
  });

  it('displays loading state while fetching alternatives', () => {
    mockCalendarApi.checkSlotAvailability.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ConflictResolution {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
  });
});