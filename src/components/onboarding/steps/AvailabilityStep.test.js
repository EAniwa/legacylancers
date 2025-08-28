/**
 * AvailabilityStep Component Tests
 * Comprehensive test suite for availability and rate configuration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AvailabilityStep from './AvailabilityStep';

// Mock react-calendar
jest.mock('react-calendar', () => {
  return function MockCalendar({ onChange, tileClassName, onTileClick, minDate, className }) {
    return (
      <div data-testid="mock-calendar" className={className}>
        <div data-testid="calendar-tile" onClick={() => onChange && onChange(new Date())}>
          Mock Calendar Tile
        </div>
      </div>
    );
  };
});

const renderAvailabilityStep = (props = {}) => {
  const defaultProps = {
    data: {},
    onUpdate: jest.fn(),
    onComplete: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    isLoading: false,
    error: null,
    canSkip: false,
    onSkip: null,
    ...props
  };

  return render(<AvailabilityStep {...defaultProps} />);
};

describe('AvailabilityStep Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders all main sections', () => {
      renderAvailabilityStep();
      
      expect(screen.getByText('Timezone & Location')).toBeInTheDocument();
      expect(screen.getByText('Weekly Availability')).toBeInTheDocument();
      expect(screen.getByText('Rate Configuration')).toBeInTheDocument();
      expect(screen.getByText('Blackout Dates')).toBeInTheDocument();
      expect(screen.getByText('Booking Preferences')).toBeInTheDocument();
    });

    it('displays timezone selector with default value', () => {
      renderAvailabilityStep();
      
      const timezoneSelect = screen.getByRole('combobox');
      expect(timezoneSelect).toBeInTheDocument();
    });

    it('shows all days of the week in schedule', () => {
      renderAvailabilityStep();
      
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();
      expect(screen.getByText('Thursday')).toBeInTheDocument();
      expect(screen.getByText('Friday')).toBeInTheDocument();
      expect(screen.getByText('Saturday')).toBeInTheDocument();
      expect(screen.getByText('Sunday')).toBeInTheDocument();
    });

    it('displays all engagement types', () => {
      renderAvailabilityStep();
      
      expect(screen.getByText('Hourly Consulting')).toBeInTheDocument();
      expect(screen.getByText('Project-Based')).toBeInTheDocument();
      expect(screen.getByText('Retainer')).toBeInTheDocument();
      expect(screen.getByText('Mentoring')).toBeInTheDocument();
      expect(screen.getByText('Training/Workshops')).toBeInTheDocument();
      expect(screen.getByText('Advisory Role')).toBeInTheDocument();
    });
  });

  describe('Weekly Schedule Management', () => {
    it('allows toggling day availability', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const mondayCheckbox = screen.getByRole('checkbox', { name: /monday/i });
      await user.click(mondayCheckbox);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('shows time slots when day is available', async () => {
      const user = userEvent.setup();
      const scheduleData = {
        weeklySchedule: {
          0: { // Monday
            available: true,
            timeSlots: [{ start: '09:00', end: '17:00' }]
          }
        }
      };
      
      renderAvailabilityStep({ data: scheduleData });
      
      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('17:00')).toBeInTheDocument();
    });

    it('allows adding multiple time slots per day', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const scheduleData = {
        weeklySchedule: {
          0: {
            available: true,
            timeSlots: [{ start: '09:00', end: '12:00' }]
          }
        }
      };
      
      renderAvailabilityStep({ data: scheduleData, onUpdate: mockOnUpdate });
      
      const addTimeSlotButton = screen.getByRole('button', { name: /add time slot/i });
      await user.click(addTimeSlotButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('allows removing time slots', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const scheduleData = {
        weeklySchedule: {
          0: {
            available: true,
            timeSlots: [
              { start: '09:00', end: '12:00' },
              { start: '13:00', end: '17:00' }
            ]
          }
        }
      };
      
      renderAvailabilityStep({ data: scheduleData, onUpdate: mockOnUpdate });
      
      const removeButtons = screen.getAllByRole('button', { name: '×' });
      await user.click(removeButtons[0]);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('calculates total weekly hours correctly', () => {
      const scheduleData = {
        weeklySchedule: {
          0: { // Monday
            available: true,
            timeSlots: [{ start: '09:00', end: '17:00' }] // 8 hours
          },
          1: { // Tuesday
            available: true,
            timeSlots: [{ start: '09:00', end: '13:00' }] // 4 hours
          }
        }
      };
      
      renderAvailabilityStep({ data: scheduleData });
      
      expect(screen.getByText('Total weekly availability: 12 hours')).toBeInTheDocument();
    });
  });

  describe('Rate Configuration', () => {
    it('allows selecting engagement types', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const hourlyCheckbox = screen.getByRole('checkbox', { name: /hourly consulting/i });
      await user.click(hourlyCheckbox);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('shows rate input when engagement type is selected', async () => {
      const user = userEvent.setup();
      const availabilityData = {
        engagementTypes: ['hourly'],
        rates: {}
      };
      
      renderAvailabilityStep({ data: availabilityData });
      
      expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
      expect(screen.getByText('Your Rate (per hour)')).toBeInTheDocument();
    });

    it('allows setting rates for engagement types', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const availabilityData = {
        engagementTypes: ['hourly'],
        rates: {}
      };
      
      renderAvailabilityStep({ data: availabilityData, onUpdate: mockOnUpdate });
      
      const rateInput = screen.getByPlaceholderText('0');
      await user.type(rateInput, '100');
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('displays market guidance for rates', () => {
      const availabilityData = {
        engagementTypes: ['hourly'],
        rates: { hourly: '100' }
      };
      
      renderAvailabilityStep({ data: availabilityData });
      
      expect(screen.getByText('Market Range')).toBeInTheDocument();
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('Avg')).toBeInTheDocument();
      expect(screen.getByText('Max')).toBeInTheDocument();
    });

    it('shows appropriate rate guidance based on value', () => {
      const belowMarketData = {
        engagementTypes: ['hourly'],
        rates: { hourly: '30' }
      };
      
      renderAvailabilityStep({ data: belowMarketData });
      
      expect(screen.getByText('Below market range')).toBeInTheDocument();
    });
  });

  describe('Blackout Dates Management', () => {
    it('displays calendar for blackout date selection', () => {
      renderAvailabilityStep();
      
      expect(screen.getByTestId('mock-calendar')).toBeInTheDocument();
    });

    it('allows adding blackout periods', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const addBlackoutButton = screen.getByRole('button', { name: /add blackout period/i });
      await user.click(addBlackoutButton);
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows existing blackout periods', () => {
      const blackoutData = {
        blackoutDates: [{
          id: 1,
          start: new Date('2024-01-01'),
          end: new Date('2024-01-07'),
          reason: 'Vacation'
        }]
      };
      
      renderAvailabilityStep({ data: blackoutData });
      
      expect(screen.getByText('Current Blackout Periods')).toBeInTheDocument();
      expect(screen.getByText('Vacation')).toBeInTheDocument();
    });

    it('allows removing blackout periods', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const blackoutData = {
        blackoutDates: [{
          id: 1,
          start: new Date('2024-01-01'),
          end: new Date('2024-01-07'),
          reason: 'Vacation'
        }]
      };
      
      renderAvailabilityStep({ data: blackoutData, onUpdate: mockOnUpdate });
      
      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Booking Preferences', () => {
    it('displays all booking preference options', () => {
      renderAvailabilityStep();
      
      expect(screen.getByText('Minimum Notice (hours)')).toBeInTheDocument();
      expect(screen.getByText('Maximum Advance Booking (days)')).toBeInTheDocument();
      expect(screen.getByText('Buffer Time Between Meetings (minutes)')).toBeInTheDocument();
      expect(screen.getByText('Automatically accept bookings within my availability')).toBeInTheDocument();
    });

    it('allows changing booking preferences', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const minNoticeSelect = screen.getByDisplayValue('24 hours');
      await user.selectOptions(minNoticeSelect, '48');
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('allows toggling auto-accept setting', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const autoAcceptCheckbox = screen.getByRole('checkbox', { name: /automatically accept bookings/i });
      await user.click(autoAcceptCheckbox);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('disables continue button when no engagement types selected', () => {
      renderAvailabilityStep();
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });

    it('disables continue button when no availability set', () => {
      const noAvailabilityData = {
        engagementTypes: ['hourly'],
        rates: { hourly: '100' },
        weeklySchedule: {}
      };
      
      renderAvailabilityStep({ data: noAvailabilityData });
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });

    it('enables continue button when valid data is provided', () => {
      const validData = {
        engagementTypes: ['hourly'],
        rates: { hourly: '100' },
        weeklySchedule: {
          0: {
            available: true,
            timeSlots: [{ start: '09:00', end: '17:00' }]
          }
        }
      };
      
      renderAvailabilityStep({ data: validData });
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('shows validation message when requirements not met', () => {
      renderAvailabilityStep();
      
      expect(screen.getByText('Please set up your availability and rates to continue.')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('calls onComplete with availability data when form is submitted', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      const validData = {
        timeZone: 'America/New_York',
        engagementTypes: ['hourly'],
        rates: { hourly: '100' },
        weeklySchedule: {
          0: {
            available: true,
            timeSlots: [{ start: '09:00', end: '17:00' }]
          }
        },
        blackoutDates: [],
        minNotice: '24',
        maxAdvanceBooking: '60',
        bufferTime: '15',
        autoAccept: false
      };
      
      renderAvailabilityStep({ data: validData, onComplete: mockOnComplete });
      
      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          timeZone: 'America/New_York',
          engagementTypes: ['hourly'],
          rates: { hourly: '100' },
          weeklySchedule: expect.any(Object),
          minNotice: '24',
          maxAdvanceBooking: '60',
          bufferTime: '15',
          autoAccept: false
        })
      );
    });

    it('does not submit when validation fails', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      
      renderAvailabilityStep({ onComplete: mockOnComplete });
      
      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('calls onPrevious when previous button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnPrevious = jest.fn();
      
      renderAvailabilityStep({ onPrevious: mockOnPrevious });
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);
      
      expect(mockOnPrevious).toHaveBeenCalled();
    });

    it('shows and calls onSkip when skipping is enabled', async () => {
      const user = userEvent.setup();
      const mockOnSkip = jest.fn();
      
      renderAvailabilityStep({ canSkip: true, onSkip: mockOnSkip });
      
      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      expect(skipButton).toBeInTheDocument();
      
      await user.click(skipButton);
      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('disables form elements when loading', () => {
      renderAvailabilityStep({ isLoading: true });
      
      const continueButton = screen.getByRole('button', { name: /saving.../i });
      expect(continueButton).toBeDisabled();
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('displays error message when error is provided', () => {
      const errorMessage = 'Failed to save availability';
      renderAvailabilityStep({ error: errorMessage });
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Data Persistence', () => {
    it('calls onUpdate when data changes', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const hourlyCheckbox = screen.getByRole('checkbox', { name: /hourly consulting/i });
      await user.click(hourlyCheckbox);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('maintains data across re-renders', () => {
      const availabilityData = {
        engagementTypes: ['hourly'],
        rates: { hourly: '100' }
      };
      
      const { rerender } = renderAvailabilityStep({ data: availabilityData });
      
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
      
      rerender(<AvailabilityStep data={availabilityData} onUpdate={jest.fn()} onComplete={jest.fn()} />);
      
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    });
  });

  describe('Timezone Handling', () => {
    it('updates timezone when changed', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderAvailabilityStep({ onUpdate: mockOnUpdate });
      
      const timezoneSelect = screen.getByRole('combobox');
      await user.selectOptions(timezoneSelect, 'America/Los_Angeles');
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('displays timezone info in schedule header', () => {
      const timezoneData = {
        timeZone: 'America/New_York'
      };
      
      renderAvailabilityStep({ data: timezoneData });
      
      expect(screen.getByText('America/New_York')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty data gracefully', () => {
      renderAvailabilityStep({ data: {} });
      
      expect(screen.getByText('Timezone & Location')).toBeInTheDocument();
    });

    it('handles missing data prop gracefully', () => {
      renderAvailabilityStep({ data: undefined });
      
      expect(screen.getByText('Timezone & Location')).toBeInTheDocument();
    });

    it('handles invalid time slots gracefully', () => {
      const invalidData = {
        weeklySchedule: {
          0: {
            available: true,
            timeSlots: [{ start: '', end: '' }]
          }
        }
      };
      
      renderAvailabilityStep({ data: invalidData });
      
      expect(screen.getByText('Weekly Availability')).toBeInTheDocument();
    });
  });
});