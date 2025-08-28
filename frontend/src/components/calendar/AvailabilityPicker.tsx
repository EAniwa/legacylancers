import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { Button } from '../ui/Button';
import { calendarApi } from '../../services/calendarApi';
import type { AvailabilitySlot } from '../../services/calendarApi';

interface AvailabilityPickerProps {
  userId: string;
  selectedSlot?: AvailabilitySlot;
  onSlotSelect: (slot: AvailabilitySlot) => void;
  onDateChange?: (date: string) => void;
  timezone?: string;
  minAdvanceNotice?: number; // hours
  className?: string;
}

export const AvailabilityPicker: React.FC<AvailabilityPickerProps> = ({
  userId,
  selectedSlot,
  onSlotSelect,
  onDateChange,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  minAdvanceNotice = 24,
  className = '',
}) => {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date()));
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const fetchAvailability = async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = format(currentWeek, 'yyyy-MM-dd');
      const endDate = format(addDays(currentWeek, 6), 'yyyy-MM-dd');
      
      const slots = await calendarApi.getAvailableSlots(
        userId,
        startDate,
        endDate,
        timezone
      );

      // Filter out slots that don't meet advance notice requirement
      const minNoticeTime = new Date();
      minNoticeTime.setHours(minNoticeTime.getHours() + minAdvanceNotice);

      const validSlots = slots.filter(slot => 
        new Date(slot.startTime) > minNoticeTime && !slot.isBooked
      );

      setAvailableSlots(validSlots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability');
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [userId, currentWeek, timezone, minAdvanceNotice]);

  const getSlotsForDate = (date: Date): AvailabilitySlot[] => {
    return availableSlots.filter(slot => 
      isSameDay(new Date(slot.startTime), date)
    );
  };

  const isSlotSelected = (slot: AvailabilitySlot): boolean => {
    return selectedSlot?.id === slot.id;
  };

  const handleSlotClick = (slot: AvailabilitySlot) => {
    onSlotSelect(slot);
    if (onDateChange) {
      onDateChange(format(new Date(slot.startTime), 'yyyy-MM-dd'));
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  const goToToday = () => {
    setCurrentWeek(startOfWeek(new Date()));
  };

  const formatSlotTime = (slot: AvailabilitySlot): string => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Select Available Time
        </h3>
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" onClick={goToPreviousWeek}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <Button size="sm" variant="outline" onClick={goToToday}>
            Today
          </Button>
          <Button size="sm" variant="outline" onClick={goToNextWeek}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="text-center mb-4">
        <p className="text-sm text-gray-600">
          Week of {format(currentWeek, 'MMMM d, yyyy')} ({timezone})
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAvailability}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 mb-4">
          {/* Day Headers */}
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="p-3 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                {format(day, 'EEE')}
              </div>
              <div className={`text-sm font-medium mt-1 ${
                isToday(day) ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}

          {/* Time Slots */}
          {weekDays.map((day) => {
            const daySlots = getSlotsForDate(day);
            
            return (
              <div key={`slots-${day.toISOString()}`} className="space-y-1">
                {daySlots.length === 0 ? (
                  <div className="p-2 text-center">
                    <p className="text-xs text-gray-400">No availability</p>
                  </div>
                ) : (
                  daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      disabled={slot.isBooked || slot.currentBookings >= slot.maxBookings}
                      className={`w-full p-2 text-xs rounded transition-colors ${
                        isSlotSelected(slot)
                          ? 'bg-blue-600 text-white'
                          : slot.isBooked || slot.currentBookings >= slot.maxBookings
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      <div className="font-medium">
                        {formatSlotTime(slot)}
                      </div>
                      <div className="text-xs opacity-75">
                        ${slot.rate}/hr
                      </div>
                      {slot.currentBookings > 0 && (
                        <div className="text-xs opacity-75">
                          {slot.currentBookings}/{slot.maxBookings}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedSlot && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Time Slot</h4>
          <div className="text-sm text-blue-800">
            <p>
              <strong>{format(new Date(selectedSlot.startTime), 'EEEE, MMMM d, yyyy')}</strong>
            </p>
            <p>{formatSlotTime(selectedSlot)}</p>
            <p>Rate: ${selectedSlot.rate}/hour</p>
            <p>Type: {selectedSlot.engagementType}</p>
          </div>
        </div>
      )}

      {availableSlots.length === 0 && !loading && !error && (
        <div className="text-center py-6">
          <svg
            className="mx-auto h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-500 mt-2">
            No availability for this week. Try selecting a different week.
          </p>
        </div>
      )}
    </div>
  );
};