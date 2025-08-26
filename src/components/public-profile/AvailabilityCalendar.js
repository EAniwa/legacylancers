/**
 * Availability Calendar Component
 * Shows professional's available time slots and booking interface
 */

import React, { useState, useEffect } from 'react';
import './AvailabilityCalendar.css';

const AvailabilityCalendar = ({ availability, profileSlug }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  useEffect(() => {
    // Set initial selected date to today or next available date
    const today = new Date();
    const nextAvailable = availability?.nextAvailable ? new Date(availability.nextAvailable) : today;
    setSelectedDate(nextAvailable);
  }, [availability]);

  if (!availability) {
    return (
      <div className="availability-calendar empty">
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>Availability Not Set</h3>
          <p>This professional has not yet configured their availability schedule.</p>
          <button className="contact-alternative">
            Contact for Availability
          </button>
        </div>
      </div>
    );
  }

  // Mock availability data expansion
  const mockAvailableSlots = [
    {
      date: '2024-01-15',
      timeSlots: [
        { time: '09:00-10:00', available: true, type: 'consulting' },
        { time: '10:30-11:30', available: true, type: 'mentoring' },
        { time: '14:00-15:00', available: true, type: 'consulting' },
        { time: '16:00-17:00', available: false, type: 'consulting' } // booked
      ]
    },
    {
      date: '2024-01-16',
      timeSlots: [
        { time: '10:00-11:00', available: true, type: 'consulting' },
        { time: '15:00-16:00', available: true, type: 'mentoring' }
      ]
    },
    {
      date: '2024-01-17',
      timeSlots: [
        { time: '09:00-10:00', available: true, type: 'consulting' },
        { time: '11:00-12:00', available: true, type: 'project' },
        { time: '14:30-15:30', available: true, type: 'mentoring' }
      ]
    }
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateKey = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getAvailabilityForDate = (date) => {
    if (!date) return null;
    const dateKey = formatDateKey(date);
    return mockAvailableSlots.find(slot => slot.date === dateKey);
  };

  const hasAvailability = (date) => {
    if (!date) return false;
    const availability = getAvailabilityForDate(date);
    return availability && availability.timeSlots.some(slot => slot.available);
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date) => {
    if (!date) return false;
    const today = new Date();
    return date < today && !isToday(date);
  };

  const getEngagementTypeIcon = (type) => {
    const icons = {
      consulting: '🔍',
      mentoring: '🎯',
      project: '📋',
      keynote: '🎤',
      freelance: '💼'
    };
    return icons[type] || '💼';
  };

  const getEngagementTypeColor = (type) => {
    const colors = {
      consulting: '#3b82f6',
      mentoring: '#10b981',
      project: '#f59e0b',
      keynote: '#8b5cf6',
      freelance: '#ef4444'
    };
    return colors[type] || '#6b7280';
  };

  const handleDateClick = (date) => {
    if (isPast(date) || !hasAvailability(date)) return;
    setSelectedDate(date);
  };

  const handleTimeSlotClick = (timeSlot, date) => {
    if (!timeSlot.available) return;
    setSelectedTimeSlot({ ...timeSlot, date: formatDateKey(date) });
  };

  const handleBookingRequest = () => {
    if (!selectedTimeSlot) return;
    
    // In production, this would open a booking modal or redirect to booking page
    alert(`Booking request for ${selectedTimeSlot.time} on ${selectedTimeSlot.date}`);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const monthDays = getDaysInMonth(currentMonth);
  const selectedDateAvailability = getAvailabilityForDate(selectedDate);

  return (
    <div className="availability-calendar">
      <div className="calendar-header">
        <div className="header-info">
          <h2>Availability Schedule</h2>
          <div className="availability-status">
            <span className={`status-indicator ${availability.status}`}></span>
            <span className="status-text">
              {availability.status === 'available' ? 'Available for bookings' : 'Limited availability'}
            </span>
          </div>
        </div>

        <div className="calendar-controls">
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              📅 Calendar
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="calendar-view">
          <div className="month-navigation">
            <button 
              className="nav-btn prev"
              onClick={() => navigateMonth(-1)}
            >
              ←
            </button>
            <h3 className="month-title">
              {currentMonth.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </h3>
            <button 
              className="nav-btn next"
              onClick={() => navigateMonth(1)}
            >
              →
            </button>
          </div>

          <div className="calendar-grid">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="calendar-header-day">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {monthDays.map((date, index) => (
              <div
                key={index}
                className={`calendar-day ${
                  !date ? 'empty' : ''
                } ${
                  date && isToday(date) ? 'today' : ''
                } ${
                  date && isPast(date) ? 'past' : ''
                } ${
                  date && hasAvailability(date) ? 'has-availability' : ''
                } ${
                  date && selectedDate && date.toDateString() === selectedDate.toDateString() ? 'selected' : ''
                }`}
                onClick={() => date && handleDateClick(date)}
              >
                {date && (
                  <>
                    <span className="day-number">{date.getDate()}</span>
                    {hasAvailability(date) && (
                      <div className="availability-indicator">
                        <span className="available-slots">
                          {getAvailabilityForDate(date)?.timeSlots.filter(slot => slot.available).length}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="list-view">
          <div className="available-dates">
            {mockAvailableSlots.map((dateSlot) => {
              const date = new Date(dateSlot.date);
              const availableSlots = dateSlot.timeSlots.filter(slot => slot.available);
              
              if (availableSlots.length === 0) return null;

              return (
                <div key={dateSlot.date} className="date-group">
                  <div className="date-header">
                    <h4>{formatDate(date)}</h4>
                    <span className="available-count">
                      {availableSlots.length} slot{availableSlots.length !== 1 ? 's' : ''} available
                    </span>
                  </div>
                  <div className="time-slots-list">
                    {availableSlots.map((slot, index) => (
                      <div 
                        key={index}
                        className={`time-slot-item ${selectedTimeSlot?.time === slot.time && selectedTimeSlot?.date === dateSlot.date ? 'selected' : ''}`}
                        onClick={() => handleTimeSlotClick(slot, date)}
                      >
                        <div className="slot-time">{slot.time}</div>
                        <div className="slot-type">
                          <span 
                            className="type-icon"
                            style={{ color: getEngagementTypeColor(slot.type) }}
                          >
                            {getEngagementTypeIcon(slot.type)}
                          </span>
                          <span className="type-name">
                            {slot.type.charAt(0).toUpperCase() + slot.type.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Date Details */}
      {selectedDate && selectedDateAvailability && (
        <div className="selected-date-details">
          <h3>Available Times - {formatDate(selectedDate)}</h3>
          <div className="time-slots-grid">
            {selectedDateAvailability.timeSlots.map((slot, index) => (
              <div 
                key={index}
                className={`time-slot ${slot.available ? 'available' : 'booked'} ${
                  selectedTimeSlot?.time === slot.time ? 'selected' : ''
                }`}
                onClick={() => slot.available && handleTimeSlotClick(slot, selectedDate)}
              >
                <div className="slot-header">
                  <span className="slot-time">{slot.time}</span>
                  <span 
                    className="slot-type-badge"
                    style={{ backgroundColor: getEngagementTypeColor(slot.type) }}
                  >
                    {getEngagementTypeIcon(slot.type)} {slot.type}
                  </span>
                </div>
                <div className="slot-status">
                  {slot.available ? 'Available' : 'Booked'}
                </div>
              </div>
            ))}
          </div>

          {selectedTimeSlot && (
            <div className="booking-section">
              <div className="booking-details">
                <h4>Selected Time Slot</h4>
                <p>
                  <strong>{selectedTimeSlot.time}</strong> on {formatDate(selectedDate)}
                </p>
                <p>Session Type: <strong>{selectedTimeSlot.type}</strong></p>
              </div>
              <button 
                className="btn btn-primary book-now"
                onClick={handleBookingRequest}
              >
                Request Booking
              </button>
            </div>
          )}
        </div>
      )}

      {/* Availability Legend */}
      <div className="availability-legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <div className="legend-color booked"></div>
            <span>Booked</span>
          </div>
          <div className="legend-item">
            <div className="legend-color today"></div>
            <span>Today</span>
          </div>
        </div>

        <div className="engagement-types">
          <h5>Session Types</h5>
          <div className="type-legend">
            {['consulting', 'mentoring', 'project', 'keynote'].map(type => (
              <div key={type} className="type-item">
                <span 
                  className="type-icon"
                  style={{ color: getEngagementTypeColor(type) }}
                >
                  {getEngagementTypeIcon(type)}
                </span>
                <span className="type-label">
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Info */}
      <div className="booking-info">
        <h4>Booking Information</h4>
        <div className="info-items">
          <div className="info-item">
            <span className="info-label">Response Time:</span>
            <span className="info-value">{availability.responseTime || '24 hours'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Timezone:</span>
            <span className="info-value">{availability.timezone || 'UTC'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Booking Window:</span>
            <span className="info-value">Up to 30 days in advance</span>
          </div>
        </div>
        
        <p className="booking-note">
          All times shown are in {availability.timezone || 'UTC'}. 
          You will receive a confirmation email after requesting a booking.
        </p>
      </div>
    </div>
  );
};

export default AvailabilityCalendar;