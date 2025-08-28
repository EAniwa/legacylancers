import React, { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import { AvailabilityPicker } from '../calendar/AvailabilityPicker';
import { ConflictResolution } from '../calendar/ConflictResolution';
import { calendarApi } from '../../services/calendarApi';
import type { BookingRequest } from '../../services/bookingApi';
import type { AvailabilitySlot, CalendarEvent } from '../../services/calendarApi';

interface BookingRequestFormProps {
  retireeId: string;
  clientId: string;
  onSubmit: (request: Omit<BookingRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> & { availabilitySlotId?: string }) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  enableCalendarIntegration?: boolean;
}

export const BookingRequestForm: React.FC<BookingRequestFormProps> = ({
  retireeId,
  clientId,
  onSubmit,
  onCancel,
  loading = false,
  enableCalendarIntegration = false,
}) => {
  const [formData, setFormData] = useState({
    serviceType: '',
    description: '',
    scheduledDate: '',
    budget: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [conflicts, setConflicts] = useState<CalendarEvent[]>([]);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.serviceType.trim()) {
      newErrors.serviceType = 'Service type is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (formData.budget && (isNaN(Number(formData.budget)) || Number(formData.budget) <= 0)) {
      newErrors.budget = 'Budget must be a valid positive number';
    }

    if (formData.scheduledDate) {
      const selectedDate = new Date(formData.scheduledDate);
      const now = new Date();
      if (selectedDate <= now) {
        newErrors.scheduledDate = 'Scheduled date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const request: Omit<BookingRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
      clientId,
      retireeId,
      serviceType: formData.serviceType.trim(),
      description: formData.description.trim(),
      scheduledDate: formData.scheduledDate || undefined,
      budget: formData.budget ? Number(formData.budget) : undefined,
    };

    try {
      await onSubmit(request);
      // Reset form on success
      setFormData({
        serviceType: '',
        description: '',
        scheduledDate: '',
        budget: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setErrors({});
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSlotSelect = async (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setFormData(prev => ({
      ...prev,
      scheduledDate: slot.startTime,
      timezone: slot.timezone,
    }));
    setShowCalendar(false);

    // Check for conflicts
    if (slot.startTime && slot.endTime) {
      setCheckingAvailability(true);
      try {
        const result = await calendarApi.checkSlotAvailability(
          retireeId,
          slot.startTime,
          slot.endTime,
          slot.timezone
        );

        if (!result.available && result.conflicts.length > 0) {
          setConflicts(result.conflicts);
          setShowConflictResolver(true);
        }
      } catch (error) {
        setError('availability', 'Failed to verify slot availability');
      } finally {
        setCheckingAvailability(false);
      }
    }
  };

  const handleConflictResolve = (alternativeSlot: AvailabilitySlot) => {
    setSelectedSlot(alternativeSlot);
    setFormData(prev => ({
      ...prev,
      scheduledDate: alternativeSlot.startTime,
      timezone: alternativeSlot.timezone,
    }));
    setShowConflictResolver(false);
    setConflicts([]);
  };

  const handleConflictCancel = () => {
    setShowConflictResolver(false);
    setConflicts([]);
    setSelectedSlot(null);
    setFormData(prev => ({ ...prev, scheduledDate: '', timezone: prev.timezone }));
  };

  const setError = (field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  };

  return (
    <>
      {/* Conflict Resolution Modal */}
      {showConflictResolver && selectedSlot && conflicts.length > 0 && (
        <ConflictResolution
          userId={retireeId}
          requestedStartTime={selectedSlot.startTime}
          requestedEndTime={selectedSlot.endTime}
          timezone={formData.timezone}
          conflicts={conflicts}
          onResolve={handleConflictResolve}
          onCancel={handleConflictCancel}
          isOpen={showConflictResolver}
        />
      )}

      <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Request a Booking</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700 mb-1">
            Service Type *
          </label>
          <select
            id="serviceType"
            value={formData.serviceType}
            onChange={(e) => handleInputChange('serviceType', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.serviceType ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
          >
            <option value="">Select a service</option>
            <option value="mentoring">Mentoring</option>
            <option value="consulting">Consulting</option>
            <option value="training">Training</option>
            <option value="speaking">Speaking Engagement</option>
            <option value="advisory">Advisory Services</option>
            <option value="other">Other</option>
          </select>
          {errors.serviceType && (
            <p className="mt-1 text-sm text-red-600">{errors.serviceType}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe what you need help with, the scope of work, and any specific requirements..."
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical ${
              errors.description ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          <div className="flex justify-between mt-1">
            <div>
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description}</p>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {formData.description.length}/500
            </p>
          </div>
        </div>

        {/* Calendar Integration Section */}
        {enableCalendarIntegration && (
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Select Available Time Slot
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowCalendar(!showCalendar)}
                disabled={loading || checkingAvailability}
              >
                {showCalendar ? 'Hide Calendar' : 'Browse Availability'}
              </Button>
            </div>

            {selectedSlot && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-medium text-green-800 mb-1">Selected Time Slot</h4>
                    <p className="text-sm text-green-700">
                      {format(new Date(selectedSlot.startTime), 'EEEE, MMMM d, yyyy')} <br />
                      {format(new Date(selectedSlot.startTime), 'h:mm a')} - {format(new Date(selectedSlot.endTime), 'h:mm a')} <br />
                      Rate: ${selectedSlot.rate}/hour • {selectedSlot.engagementType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSlot(null);
                      setFormData(prev => ({ ...prev, scheduledDate: '' }));
                    }}
                    className="text-green-600 hover:text-green-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {checkingAvailability && (
              <div className="flex items-center text-sm text-blue-600 mb-4">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking availability...
              </div>
            )}

            {showCalendar && (
              <div className="mb-6">
                <AvailabilityPicker
                  userId={retireeId}
                  selectedSlot={selectedSlot || undefined}
                  onSlotSelect={handleSlotSelect}
                  timezone={formData.timezone}
                  className="border border-gray-200 rounded-lg"
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Date (Optional)
            </label>
            <input
              type="datetime-local"
              id="scheduledDate"
              value={formData.scheduledDate}
              onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.scheduledDate ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.scheduledDate && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduledDate}</p>
            )}
          </div>

          <div>
            <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
              Budget (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                id="budget"
                value={formData.budget}
                onChange={(e) => handleInputChange('budget', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.budget ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={loading}
              />
            </div>
            {errors.budget && (
              <p className="mt-1 text-sm text-red-600">{errors.budget}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            Send Booking Request
          </Button>
        </div>
      </form>
      </div>
    </>
  );
};