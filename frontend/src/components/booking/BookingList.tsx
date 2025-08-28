import React, { useState } from 'react';
import { BookingCard } from './BookingCard';
import type { BookingRequest } from '../../services/bookingApi';

interface BookingListProps {
  bookings: BookingRequest[];
  userRole: 'client' | 'retiree';
  onRespond?: (bookingId: string, response: 'accept' | 'reject') => Promise<void>;
  onViewDetails?: (bookingId: string) => void;
  onChat?: (bookingId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}

type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed';

export const BookingList: React.FC<BookingListProps> = ({
  bookings,
  userRole,
  onRespond,
  onViewDetails,
  onChat,
  loading = false,
  emptyMessage = 'No bookings found',
}) => {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const filteredBookings = bookings.filter(booking => 
    filter === 'all' ? true : booking.status === filter
  );

  const getFilterCounts = () => {
    const counts = bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      all: bookings.length,
      pending: 0,
      accepted: 0,
      rejected: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      ...counts,
    };
  };

  const filterCounts = getFilterCounts();

  const handleRespond = async (bookingId: string, response: 'accept' | 'reject') => {
    if (!onRespond) return;
    
    setRespondingTo(bookingId);
    try {
      await onRespond(bookingId, response);
    } finally {
      setRespondingTo(null);
    }
  };

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {filterOptions.map((option) => {
            const count = filterCounts[option.value] || 0;
            const isActive = filter === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {option.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBookings.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {filter === 'all' ? emptyMessage : `No ${filter} bookings`}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {userRole === 'client' 
              ? 'Create a booking request to get started.' 
              : 'Booking requests will appear here when clients reach out to you.'}
          </p>
        </div>
      )}

      {/* Booking Cards */}
      {!loading && filteredBookings.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {filteredBookings.length} of {bookings.length} bookings
            </p>
          </div>
          
          <div className="grid gap-4">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                userRole={userRole}
                onRespond={handleRespond}
                onViewDetails={onViewDetails}
                onChat={onChat}
                loading={respondingTo === booking.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};