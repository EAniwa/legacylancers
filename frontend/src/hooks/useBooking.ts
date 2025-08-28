import { useState, useEffect, useCallback } from 'react';
import { bookingApi } from '../services/bookingApi';
import type { BookingRequest, BookingResponse } from '../services/bookingApi';

export interface UseBookingOptions {
  userId?: string;
  role?: 'client' | 'retiree';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useBooking = (options: UseBookingOptions = {}) => {
  const { userId, role, autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!userId || !role) return;

    setLoading(true);
    setError(null);

    try {
      const data = await bookingApi.getBookingRequests(userId, role);
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  const createBooking = useCallback(async (
    request: Omit<BookingRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<BookingRequest> => {
    setError(null);
    
    try {
      const newBooking = await bookingApi.createBookingRequest(request);
      setBookings(prev => [newBooking, ...prev]);
      return newBooking;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create booking';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const respondToBooking = useCallback(async (
    bookingId: string,
    response: Omit<BookingResponse, 'id' | 'createdAt'>
  ): Promise<BookingResponse> => {
    setError(null);
    
    try {
      const bookingResponse = await bookingApi.respondToBooking(bookingId, response);
      
      // Update local booking status
      setBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: response.response === 'accept' ? 'accepted' : 'rejected' }
            : booking
        )
      );
      
      return bookingResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to respond to booking';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateBookingStatus = useCallback(async (
    id: string, 
    status: BookingRequest['status']
  ): Promise<void> => {
    setError(null);
    
    try {
      await bookingApi.updateBookingStatus(id, status);
      setBookings(prev => 
        prev.map(booking => 
          booking.id === id ? { ...booking, status } : booking
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update booking status';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getBookingById = useCallback((id: string): BookingRequest | undefined => {
    return bookings.find(booking => booking.id === id);
  }, [bookings]);

  const getBookingsByStatus = useCallback((status: BookingRequest['status']): BookingRequest[] => {
    return bookings.filter(booking => booking.status === status);
  }, [bookings]);

  const refreshBookings = useCallback(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!autoRefresh || !userId || !role) return;

    const interval = setInterval(fetchBookings, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchBookings, userId, role]);

  return {
    bookings,
    loading,
    error,
    createBooking,
    respondToBooking,
    updateBookingStatus,
    getBookingById,
    getBookingsByStatus,
    refreshBookings,
  };
};