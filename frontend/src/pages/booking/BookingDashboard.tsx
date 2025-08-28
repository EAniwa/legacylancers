import React, { useState } from 'react';
import { BookingList } from '../../components/booking/BookingList';
import { BookingRequestForm } from '../../components/booking/BookingRequestForm';
import { Button } from '../../components/ui/Button';
import { useBooking } from '../../hooks/useBooking';

interface BookingDashboardProps {
  userId: string;
  userRole: 'client' | 'retiree';
  selectedRetireeId?: string; // For direct booking
}

export const BookingDashboard: React.FC<BookingDashboardProps> = ({
  userId,
  userRole,
  selectedRetireeId,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    bookings,
    loading,
    error: bookingError,
    createBooking,
    respondToBooking,
    refreshBookings,
  } = useBooking({
    userId,
    role: userRole,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  });

  const handleCreateBooking = async (request: any) => {
    try {
      setError(null);
      await createBooking(request);
      setSuccess('Booking request sent successfully!');
      setShowCreateForm(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking request');
    }
  };

  const handleRespond = async (bookingId: string, response: 'accept' | 'reject') => {
    try {
      setError(null);
      await respondToBooking(bookingId, {
        bookingId,
        retireeId: userId,
        response,
        message: `Booking ${response}ed by retiree`,
      });
      
      setSuccess(`Booking request ${response}ed successfully!`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${response} booking request`);
    }
  };

  const handleViewDetails = (bookingId: string) => {
    // TODO: Implement booking details modal or navigation
    console.log('View details for booking:', bookingId);
  };

  const handleChat = (bookingId: string) => {
    // TODO: Open chat interface for the booking
    console.log('Open chat for booking:', bookingId);
  };

  const dismissError = () => setError(null);
  const dismissSuccess = () => setSuccess(null);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'client' ? 'My Booking Requests' : 'Booking Requests'}
          </h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'client' 
              ? 'Manage your booking requests and track their status' 
              : 'Review and respond to booking requests from clients'}
          </p>
        </div>
        
        {userRole === 'client' && (
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            disabled={showCreateForm}
          >
            New Booking Request
          </Button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={dismissError}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div className="flex">
              <svg className="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">{success}</p>
              </div>
            </div>
            <button
              onClick={dismissSuccess}
              className="text-green-400 hover:text-green-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Create Booking Form */}
      {showCreateForm && userRole === 'client' && (
        <div className="mb-8">
          <BookingRequestForm
            clientId={userId}
            retireeId={selectedRetireeId || 'placeholder-retiree-id'} // TODO: Replace with actual retiree selection
            onSubmit={handleCreateBooking}
            onCancel={() => setShowCreateForm(false)}
            loading={loading}
          />
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Bookings</p>
              <p className="text-xl font-semibold text-gray-900">{bookings.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-xl font-semibold text-gray-900">
                {bookings.filter(b => b.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-xl font-semibold text-gray-900">
                {bookings.filter(b => b.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-semibold text-gray-900">
                {bookings.filter(b => b.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshBookings}
          disabled={loading}
          loading={loading}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Booking List */}
      <BookingList
        bookings={bookings}
        userRole={userRole}
        onRespond={handleRespond}
        onViewDetails={handleViewDetails}
        onChat={handleChat}
        loading={loading}
        emptyMessage={
          userRole === 'client' 
            ? 'No booking requests yet. Create your first booking request to get started!' 
            : 'No booking requests received yet. Clients will be able to book your services once your profile is complete.'
        }
      />

      {bookingError && (
        <div className="mt-4 text-center text-red-600">
          <p>Error loading bookings: {bookingError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshBookings}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};