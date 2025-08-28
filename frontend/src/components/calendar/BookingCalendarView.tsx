import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths 
} from 'date-fns';
import { Button } from '../ui/Button';
import { calendarApi } from '../../services/calendarApi';
import type { CalendarEvent } from '../../services/calendarApi';

interface BookingCalendarViewProps {
  userId: string;
  userRole: 'client' | 'retiree';
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  className?: string;
}

export const BookingCalendarView: React.FC<BookingCalendarViewProps> = ({
  userId,
  userRole,
  onEventClick,
  onDateClick,
  className = '',
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const calendarEvents = await calendarApi.getCalendarEvents(
        userId,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      setEvents(calendarEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [userId, currentMonth]);

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(event => 
      isSameDay(new Date(event.startTime), date)
    );
  };

  const getEventTypeColor = (event: CalendarEvent): string => {
    switch (event.type) {
      case 'booking':
        return event.status === 'confirmed' 
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'availability':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'blocked':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'gig':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const renderCalendarHeader = () => (
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-lg font-semibold text-gray-900">
        {userRole === 'client' ? 'Booking Calendar' : 'My Schedule'}
      </h3>
      <div className="flex items-center space-x-3">
        <Button size="sm" variant="outline" onClick={handlePrevMonth}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        
        <div className="text-center min-w-[140px]">
          <h4 className="text-base font-medium text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h4>
        </div>
        
        <Button size="sm" variant="outline" onClick={handleToday}>
          Today
        </Button>
        
        <Button size="sm" variant="outline" onClick={handleNextMonth}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );

  const renderDayHeaders = () => (
    <div className="grid grid-cols-7 gap-1 mb-2">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="p-2 text-center">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {day}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCalendarGrid = () => {
    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-2 border border-gray-200 ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div
                className={`text-sm font-medium mb-2 cursor-pointer hover:text-blue-600 ${
                  isTodayDate ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                }`}
                onClick={() => onDateClick && onDateClick(day)}
              >
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick && onEventClick(event)}
                    className={`text-xs p-1 rounded border cursor-pointer hover:opacity-80 ${getEventTypeColor(event)}`}
                    title={`${event.title} - ${format(new Date(event.startTime), 'h:mm a')}`}
                  >
                    <div className="flex items-center">
                      <span className="mr-1">{getEventTypeIcon(event)}</span>
                      <span className="truncate">
                        {format(new Date(event.startTime), 'h:mm a')}
                      </span>
                    </div>
                    <div className="truncate font-medium">
                      {event.title}
                    </div>
                  </div>
                ))}
                
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 p-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLegend = () => (
    <div className="mt-6 flex flex-wrap gap-4 text-xs">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200 mr-2"></div>
        <span>📅 Bookings</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded bg-green-100 border border-green-200 mr-2"></div>
        <span>🕐 Availability</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200 mr-2"></div>
        <span>💼 Gigs</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded bg-red-100 border border-red-200 mr-2"></div>
        <span>🚫 Blocked</span>
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {renderCalendarHeader()}
      
      {renderDayHeaders()}
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderCalendarGrid()
      )}
      
      {renderLegend()}

      {error && (
        <div className="mt-4 text-center text-red-600">
          <p>Error loading calendar: {error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEvents}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};