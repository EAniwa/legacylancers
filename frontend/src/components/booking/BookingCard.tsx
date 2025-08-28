import React from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import type { BookingRequest } from '../../services/bookingApi';

interface BookingCardProps {
  booking: BookingRequest;
  userRole: 'client' | 'retiree';
  onRespond?: (bookingId: string, response: 'accept' | 'reject') => void;
  onViewDetails?: (bookingId: string) => void;
  onChat?: (bookingId: string) => void;
  loading?: boolean;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  userRole,
  onRespond,
  onViewDetails,
  onChat,
  loading = false,
}) => {
  const getStatusColor = (status: BookingRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: BookingRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending Response';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const canRespond = userRole === 'retiree' && booking.status === 'pending';
  const canChat = ['accepted', 'in_progress'].includes(booking.status);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {booking.serviceType}
          </h3>
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
            {getStatusText(booking.status)}
          </span>
        </div>
        {booking.budget && (
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">
              ${booking.budget.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-gray-600 text-sm line-clamp-3">
            {booking.description}
          </p>
        </div>

        {booking.scheduledDate && (
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {format(new Date(booking.scheduledDate), 'PPpp')}
            </span>
          </div>
        )}

        {booking.createdAt && (
          <div className="flex items-center text-sm text-gray-500">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Requested {format(new Date(booking.createdAt), 'PPp')}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <div className="flex space-x-2">
          {canRespond && onRespond && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onRespond(booking.id!, 'accept')}
                disabled={loading}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRespond(booking.id!, 'reject')}
                disabled={loading}
              >
                Reject
              </Button>
            </>
          )}

          {canChat && onChat && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChat(booking.id!)}
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </Button>
          )}
        </div>

        {onViewDetails && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(booking.id!)}
            disabled={loading}
          >
            View Details
          </Button>
        )}
      </div>
    </div>
  );
};