/**
 * AvailabilityStep Component
 * Calendar-based availability setting and rate configuration
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './AvailabilityStep.css';

const ENGAGEMENT_TYPES = [
  { 
    value: 'hourly', 
    label: 'Hourly Consulting', 
    description: 'Work on an hourly basis',
    icon: '⏱️'
  },
  { 
    value: 'project', 
    label: 'Project-Based', 
    description: 'Fixed-scope projects',
    icon: '📁'
  },
  { 
    value: 'retainer', 
    label: 'Retainer', 
    description: 'Ongoing monthly engagement',
    icon: '📋'
  },
  { 
    value: 'mentoring', 
    label: 'Mentoring', 
    description: '1-on-1 guidance and coaching',
    icon: '🎯'
  },
  { 
    value: 'training', 
    label: 'Training/Workshops', 
    description: 'Educational sessions',
    icon: '🎓'
  },
  { 
    value: 'advisory', 
    label: 'Advisory Role', 
    description: 'Strategic guidance',
    icon: '🧭'
  }
];

const TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Stockholm',
  'Australia/Sydney',
  'Asia/Tokyo',
  'Asia/Singapore'
];

const MARKET_RATES = {
  hourly: { min: 50, avg: 125, max: 500 },
  project: { min: 1000, avg: 7500, max: 50000 },
  retainer: { min: 2000, avg: 8000, max: 25000 },
  mentoring: { min: 75, avg: 150, max: 300 },
  training: { min: 100, avg: 250, max: 1000 },
  advisory: { min: 200, avg: 400, max: 1500 }
};

// Weekly Schedule Component
function WeeklySchedule({ schedule, onScheduleChange, timeZone }) {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const handleDayToggle = (dayIndex) => {
    const newSchedule = { ...schedule };
    if (newSchedule[dayIndex]) {
      delete newSchedule[dayIndex];
    } else {
      newSchedule[dayIndex] = {
        available: true,
        timeSlots: [{ start: '09:00', end: '17:00' }]
      };
    }
    onScheduleChange(newSchedule);
  };

  const handleTimeSlotChange = (dayIndex, slotIndex, field, value) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dayIndex]) return;
    
    newSchedule[dayIndex].timeSlots[slotIndex][field] = value;
    onScheduleChange(newSchedule);
  };

  const addTimeSlot = (dayIndex) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dayIndex]) return;
    
    newSchedule[dayIndex].timeSlots.push({ start: '09:00', end: '17:00' });
    onScheduleChange(newSchedule);
  };

  const removeTimeSlot = (dayIndex, slotIndex) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dayIndex]) return;
    
    newSchedule[dayIndex].timeSlots.splice(slotIndex, 1);
    if (newSchedule[dayIndex].timeSlots.length === 0) {
      delete newSchedule[dayIndex];
    }
    onScheduleChange(newSchedule);
  };

  return (
    <div className="weekly-schedule">
      <div className="schedule-header">
        <h4>Weekly Availability</h4>
        <div className="timezone-info">
          <span className="timezone-label">Timezone:</span>
          <span className="timezone-value">{timeZone}</span>
        </div>
      </div>

      <div className="schedule-days">
        {daysOfWeek.map((day, dayIndex) => {
          const isAvailable = schedule[dayIndex];
          
          return (
            <div key={day} className={`schedule-day ${isAvailable ? 'available' : 'unavailable'}`}>
              <div className="day-header">
                <label className="day-toggle">
                  <input
                    type="checkbox"
                    checked={!!isAvailable}
                    onChange={() => handleDayToggle(dayIndex)}
                  />
                  <span className="day-name">{day}</span>
                </label>
              </div>

              {isAvailable && (
                <div className="time-slots">
                  {isAvailable.timeSlots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="time-slot">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => handleTimeSlotChange(dayIndex, slotIndex, 'start', e.target.value)}
                        className="time-input"
                      />
                      <span className="time-separator">to</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => handleTimeSlotChange(dayIndex, slotIndex, 'end', e.target.value)}
                        className="time-input"
                      />
                      {isAvailable.timeSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                          className="remove-slot"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => addTimeSlot(dayIndex)}
                    className="add-time-slot"
                  >
                    + Add time slot
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Rate Configuration Component
function RateConfiguration({ engagementTypes, rates, onRateChange, onEngagementToggle }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRateGuidance = (type, rate) => {
    const market = MARKET_RATES[type];
    if (!market || !rate) return '';
    
    const numRate = parseFloat(rate);
    if (numRate < market.min) return 'Below market range';
    if (numRate > market.max) return 'Above market range';
    if (numRate < market.avg) return 'Below market average';
    if (numRate > market.avg) return 'Above market average';
    return 'Market average';
  };

  return (
    <div className="rate-configuration">
      <h4>Rate Configuration</h4>
      <p className="rate-description">
        Set your rates for different types of engagements. You can enable multiple types.
      </p>

      <div className="engagement-types">
        {ENGAGEMENT_TYPES.map(type => {
          const isEnabled = engagementTypes.includes(type.value);
          const currentRate = rates[type.value] || '';
          const rateGuidance = getRateGuidance(type.value, currentRate);
          const market = MARKET_RATES[type.value];

          return (
            <div key={type.value} className={`engagement-type ${isEnabled ? 'enabled' : 'disabled'}`}>
              <div className="engagement-header">
                <label className="engagement-toggle">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => onEngagementToggle(type.value, e.target.checked)}
                  />
                  <div className="engagement-info">
                    <span className="engagement-icon">{type.icon}</span>
                    <div className="engagement-details">
                      <span className="engagement-name">{type.label}</span>
                      <span className="engagement-description">{type.description}</span>
                    </div>
                  </div>
                </label>
              </div>

              {isEnabled && (
                <div className="rate-input-section">
                  <div className="rate-input-group">
                    <label className="rate-label">
                      Your Rate {type.value === 'hourly' || type.value === 'mentoring' || type.value === 'training' ? '(per hour)' : 
                                 type.value === 'retainer' ? '(per month)' : 
                                 type.value === 'advisory' ? '(per hour)' : '(per project)'}
                    </label>
                    <div className="rate-input-wrapper">
                      <span className="currency-symbol">$</span>
                      <input
                        type="number"
                        value={currentRate}
                        onChange={(e) => onRateChange(type.value, e.target.value)}
                        placeholder="0"
                        className="rate-input"
                        min="0"
                        step={type.value === 'project' || type.value === 'retainer' ? '100' : '5'}
                      />
                    </div>
                    
                    {rateGuidance && (
                      <div className={`rate-guidance ${rateGuidance.includes('Below') ? 'below' : 
                                                     rateGuidance.includes('Above') ? 'above' : 'average'}`}>
                        {rateGuidance}
                      </div>
                    )}
                  </div>

                  <div className="market-guidance">
                    <h5>Market Range</h5>
                    <div className="market-range">
                      <div className="range-bar">
                        <div className="range-segment min">
                          <span className="range-label">Min</span>
                          <span className="range-value">{formatCurrency(market.min)}</span>
                        </div>
                        <div className="range-segment avg">
                          <span className="range-label">Avg</span>
                          <span className="range-value">{formatCurrency(market.avg)}</span>
                        </div>
                        <div className="range-segment max">
                          <span className="range-label">Max</span>
                          <span className="range-value">{formatCurrency(market.max)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Blackout Dates Component
function BlackoutDates({ blackoutDates, onBlackoutChange }) {
  const [selectedRange, setSelectedRange] = useState(null);
  const [isAddingRange, setIsAddingRange] = useState(false);

  const handleDateClick = (date) => {
    if (!isAddingRange) return;

    if (!selectedRange) {
      setSelectedRange([date, date]);
    } else {
      const [start] = selectedRange;
      if (date < start) {
        setSelectedRange([date, start]);
      } else {
        setSelectedRange([start, date]);
      }
    }
  };

  const addBlackoutRange = () => {
    if (!selectedRange) return;

    const newBlackout = {
      id: Date.now(),
      start: selectedRange[0],
      end: selectedRange[1],
      reason: 'Unavailable'
    };

    onBlackoutChange([...blackoutDates, newBlackout]);
    setSelectedRange(null);
    setIsAddingRange(false);
  };

  const removeBlackout = (id) => {
    onBlackoutChange(blackoutDates.filter(b => b.id !== id));
  };

  const isBlackoutDate = (date) => {
    return blackoutDates.some(blackout => {
      const blackoutStart = new Date(blackout.start);
      const blackoutEnd = new Date(blackout.end);
      return date >= blackoutStart && date <= blackoutEnd;
    });
  };

  const tileClassName = ({ date }) => {
    const classes = [];
    
    if (isBlackoutDate(date)) {
      classes.push('blackout-date');
    }
    
    if (selectedRange && isAddingRange) {
      const [start, end] = selectedRange;
      if (date >= start && date <= end) {
        classes.push('selected-range');
      }
    }
    
    return classes.join(' ');
  };

  return (
    <div className="blackout-dates">
      <div className="blackout-header">
        <h4>Blackout Dates</h4>
        <button
          type="button"
          className={`add-blackout-btn ${isAddingRange ? 'active' : ''}`}
          onClick={() => setIsAddingRange(!isAddingRange)}
        >
          {isAddingRange ? 'Cancel' : '+ Add Blackout Period'}
        </button>
      </div>

      <div className="calendar-section">
        <Calendar
          onChange={handleDateClick}
          value={selectedRange}
          selectRange={isAddingRange}
          tileClassName={tileClassName}
          minDate={new Date()}
          className="availability-calendar"
        />

        {isAddingRange && selectedRange && (
          <div className="range-actions">
            <div className="selected-range-info">
              Selected: {selectedRange[0].toLocaleDateString()} - {selectedRange[1].toLocaleDateString()}
            </div>
            <button
              type="button"
              className="confirm-range-btn"
              onClick={addBlackoutRange}
            >
              Add Blackout Period
            </button>
          </div>
        )}
      </div>

      {blackoutDates.length > 0 && (
        <div className="blackout-list">
          <h5>Current Blackout Periods</h5>
          {blackoutDates.map(blackout => (
            <div key={blackout.id} className="blackout-item">
              <div className="blackout-info">
                <span className="blackout-dates">
                  {new Date(blackout.start).toLocaleDateString()} - {new Date(blackout.end).toLocaleDateString()}
                </span>
                <span className="blackout-reason">{blackout.reason}</span>
              </div>
              <button
                type="button"
                onClick={() => removeBlackout(blackout.id)}
                className="remove-blackout"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AvailabilityStep({
  data = {},
  onUpdate,
  onComplete,
  onNext,
  onPrevious,
  isLoading = false,
  error = null,
  canSkip = false,
  onSkip = null
}) {
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      timeZone: data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      weeklySchedule: data.weeklySchedule || {},
      engagementTypes: data.engagementTypes || ['hourly'],
      rates: data.rates || {},
      blackoutDates: data.blackoutDates || [],
      minNotice: data.minNotice || '24',
      maxAdvanceBooking: data.maxAdvanceBooking || '60',
      bufferTime: data.bufferTime || '15',
      autoAccept: data.autoAccept || false
    }
  });

  const [weeklySchedule, setWeeklySchedule] = useState(data.weeklySchedule || {});
  const [engagementTypes, setEngagementTypes] = useState(data.engagementTypes || ['hourly']);
  const [rates, setRates] = useState(data.rates || {});
  const [blackoutDates, setBlackoutDates] = useState(data.blackoutDates || []);
  const timeZone = watch('timeZone');

  // Update parent when data changes
  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        timeZone,
        weeklySchedule,
        engagementTypes,
        rates,
        blackoutDates,
        minNotice: watch('minNotice'),
        maxAdvanceBooking: watch('maxAdvanceBooking'),
        bufferTime: watch('bufferTime'),
        autoAccept: watch('autoAccept')
      });
    }
  }, [weeklySchedule, engagementTypes, rates, blackoutDates, timeZone, watch, onUpdate]);

  const handleEngagementToggle = (type, enabled) => {
    let newTypes;
    if (enabled) {
      newTypes = [...engagementTypes, type];
    } else {
      newTypes = engagementTypes.filter(t => t !== type);
      // Remove rate for disabled type
      const newRates = { ...rates };
      delete newRates[type];
      setRates(newRates);
    }
    setEngagementTypes(newTypes);
    setValue('engagementTypes', newTypes);
  };

  const handleRateChange = (type, value) => {
    const newRates = { ...rates, [type]: value };
    setRates(newRates);
    setValue('rates', newRates);
  };

  // Form validation
  const validateForm = () => {
    // At least one engagement type with rate
    const hasValidEngagement = engagementTypes.some(type => rates[type] && parseFloat(rates[type]) > 0);
    // At least one day of availability
    const hasAvailability = Object.keys(weeklySchedule).length > 0;
    
    return hasValidEngagement && hasAvailability;
  };

  // Handle form submission
  const onSubmit = (formData) => {
    if (!validateForm()) {
      return;
    }

    const submissionData = {
      timeZone: formData.timeZone,
      weeklySchedule,
      engagementTypes,
      rates,
      blackoutDates,
      minNotice: formData.minNotice,
      maxAdvanceBooking: formData.maxAdvanceBooking,
      bufferTime: formData.bufferTime,
      autoAccept: formData.autoAccept
    };

    if (onComplete) {
      onComplete(submissionData);
    }
  };

  const totalAvailableHours = useMemo(() => {
    return Object.values(weeklySchedule).reduce((total, day) => {
      if (!day.available) return total;
      
      return total + day.timeSlots.reduce((dayTotal, slot) => {
        const start = new Date(`2000-01-01 ${slot.start}`);
        const end = new Date(`2000-01-01 ${slot.end}`);
        const hours = (end - start) / (1000 * 60 * 60);
        return dayTotal + hours;
      }, 0);
    }, 0);
  }, [weeklySchedule]);

  return (
    <div className="availability-step">
      <form onSubmit={handleSubmit(onSubmit)} className="availability-form">
        
        {/* Timezone Selection */}
        <div className="form-section">
          <h3>Timezone & Location</h3>
          <p className="section-description">
            Set your working timezone to help clients schedule meetings at appropriate times.
          </p>

          <div className="form-field">
            <label>Timezone</label>
            <Controller
              name="timeZone"
              control={control}
              render={({ field }) => (
                <select {...field} className="timezone-select">
                  {TIME_ZONES.map(tz => (
                    <option key={tz} value={tz}>
                      {tz.replace('_', ' ')} ({new Date().toLocaleTimeString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop()})
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        {/* Weekly Schedule */}
        <div className="form-section">
          <WeeklySchedule
            schedule={weeklySchedule}
            onScheduleChange={setWeeklySchedule}
            timeZone={timeZone}
          />
          
          {totalAvailableHours > 0 && (
            <div className="availability-summary">
              <span className="total-hours">
                Total weekly availability: {totalAvailableHours} hours
              </span>
            </div>
          )}
        </div>

        {/* Rate Configuration */}
        <div className="form-section">
          <RateConfiguration
            engagementTypes={engagementTypes}
            rates={rates}
            onRateChange={handleRateChange}
            onEngagementToggle={handleEngagementToggle}
          />
        </div>

        {/* Blackout Dates */}
        <div className="form-section">
          <BlackoutDates
            blackoutDates={blackoutDates}
            onBlackoutChange={setBlackoutDates}
          />
        </div>

        {/* Booking Preferences */}
        <div className="form-section">
          <h3>Booking Preferences</h3>
          <div className="preferences-grid">
            <div className="form-field">
              <label>Minimum Notice (hours)</label>
              <Controller
                name="minNotice"
                control={control}
                render={({ field }) => (
                  <select {...field}>
                    <option value="2">2 hours</option>
                    <option value="12">12 hours</option>
                    <option value="24">24 hours</option>
                    <option value="48">48 hours</option>
                    <option value="72">72 hours</option>
                    <option value="168">1 week</option>
                  </select>
                )}
              />
            </div>

            <div className="form-field">
              <label>Maximum Advance Booking (days)</label>
              <Controller
                name="maxAdvanceBooking"
                control={control}
                render={({ field }) => (
                  <select {...field}>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                  </select>
                )}
              />
            </div>

            <div className="form-field">
              <label>Buffer Time Between Meetings (minutes)</label>
              <Controller
                name="bufferTime"
                control={control}
                render={({ field }) => (
                  <select {...field}>
                    <option value="0">No buffer</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                )}
              />
            </div>
          </div>

          <div className="form-field checkbox-field">
            <Controller
              name="autoAccept"
              control={control}
              render={({ field }) => (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...field}
                    checked={field.value}
                  />
                  <span>Automatically accept bookings within my availability</span>
                </label>
              )}
            />
            <p className="field-description">
              When enabled, clients can book available time slots immediately without your approval.
            </p>
          </div>
        </div>

        {/* Validation Message */}
        {!validateForm() && (
          <div className="validation-message">
            <span className="validation-icon">ℹ️</span>
            Please set up your availability and rates to continue.
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          {onPrevious && (
            <button
              type="button"
              className="button secondary"
              onClick={onPrevious}
              disabled={isLoading}
            >
              Previous
            </button>
          )}
          
          {canSkip && onSkip && (
            <button
              type="button"
              className="button ghost"
              onClick={onSkip}
              disabled={isLoading}
            >
              Skip for Now
            </button>
          )}
          
          <button
            type="submit"
            className="button primary"
            disabled={isLoading || !validateForm()}
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </button>
        </div>

        {/* Global Error */}
        {error && (
          <div className="form-error">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}