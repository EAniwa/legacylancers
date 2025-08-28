import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import { AvailabilityPicker } from './AvailabilityPicker';
import { calendarApi } from '../../services/calendarApi';
import type { CalendarEvent, AvailabilitySlot } from '../../services/calendarApi';

interface ConflictResolutionProps {
  userId: string;
  requestedStartTime: string;
  requestedEndTime: string;
  timezone: string;
  conflicts: CalendarEvent[];
  onResolve: (selectedSlot: AvailabilitySlot) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export const ConflictResolution: React.FC<ConflictResolutionProps> = ({
  userId,
  requestedStartTime,
  requestedEndTime,
  timezone,
  conflicts,
  onResolve,
  onCancel,
  isOpen,
}) => {
  const [alternatives, setAlternatives] = useState<AvailabilitySlot[]>([]);
  const [selectedAlternative, setSelectedAlternative] = useState<AvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAlternatives();
    }
  }, [isOpen, userId, requestedStartTime, requestedEndTime, timezone]);

  const fetchAlternatives = async () => {
    setLoading(true);
    
    try {
      const result = await calendarApi.checkSlotAvailability(
        userId,
        requestedStartTime,
        requestedEndTime,
        timezone
      );
      setAlternatives(result.alternatives || []);
    } catch (error) {
      console.error('Failed to fetch alternatives:', error);
      setAlternatives([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlternative = (slot: AvailabilitySlot) => {
    setSelectedAlternative(slot);
  };

  const handleConfirmSelection = () => {
    if (selectedAlternative) {
      onResolve(selectedAlternative);
    }
  };

  const formatConflictTime = (event: CalendarEvent): string => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'h:mm a')}`;
  };

  const formatSlotTime = (slot: AvailabilitySlot): string => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'h:mm a')}`;
  };

  const getEventTypeIcon = (event: CalendarEvent): string => {
    switch (event.type) {
      case 'booking':
        return '📅';
      case 'availability':
        return '🕐';
      case 'blocked':
        return '🚫';
      case 'gig':
        return '💼';
      default:
        return '📋';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Scheduling Conflict Detected
              </h2>
              <p className="text-gray-600">
                Your requested time slot conflicts with existing events. Please select an alternative time.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Requested Time */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-red-800 mb-2">Requested Time (Not Available)</h3>
            <p className="text-sm text-red-700">
              {format(new Date(requestedStartTime), 'EEEE, MMMM d, yyyy')} <br />
              {format(new Date(requestedStartTime), 'h:mm a')} - {format(new Date(requestedEndTime), 'h:mm a')} ({timezone})
            </p>
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-yellow-800 mb-3">Conflicting Events</h3>
              <div className="space-y-2">
                {conflicts.map((event) => (
                  <div key={event.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium text-yellow-900">{event.title}</span>
                      <span className="text-yellow-700 ml-2">{getEventTypeIcon(event)}</span>
                    </div>
                    <span className="text-yellow-700">
                      {formatConflictTime(event)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alternative Options */}
          <div className="space-y-6">
            {/* Quick Alternatives */}
            {!loading && alternatives.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Suggested Alternative Times
                </h3>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {alternatives.slice(0, 10).map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSelectAlternative(slot)}
                      className={`w-full p-3 text-left border rounded-lg transition-colors ${
                        selectedAlternative?.id === slot.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatSlotTime(slot)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {slot.engagementType} • ${slot.rate}/hour
                          </p>
                        </div>
                        {selectedAlternative?.id === slot.id && (
                          <div className="text-blue-600">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar View Toggle */}
            <div className="border-t pt-6">
              <Button
                variant="outline"
                onClick={() => setShowCalendar(!showCalendar)}
                className="mb-4"
              >
                {showCalendar ? 'Hide Calendar' : 'Browse Full Calendar'}
              </Button>

              {showCalendar && (
                <AvailabilityPicker
                  userId={userId}
                  onSlotSelect={handleSelectAlternative}
                  selectedSlot={selectedAlternative || undefined}
                  timezone={timezone}
                  minAdvanceNotice={2} // 2 hours minimum for rescheduling
                />
              )}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* No Alternatives */}
            {!loading && alternatives.length === 0 && (
              <div className="text-center py-8">
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
                  No alternative time slots available. Try selecting a different week.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmSelection}
              disabled={!selectedAlternative}
            >
              Confirm Alternative Time
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};