import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BookingRequestForm } from '../components/booking/BookingRequestForm'
import { BookingCard } from '../components/booking/BookingCard'
import { BookingList } from '../components/booking/BookingList'
import type { BookingRequest } from '../services/bookingApi'

// Mock the booking API
vi.mock('../services/bookingApi', () => ({
  bookingApi: {
    createBookingRequest: vi.fn(),
    getBookingRequests: vi.fn(),
    respondToBooking: vi.fn(),
  }
}))

describe('Booking Interface Components', () => {
  const mockBooking: BookingRequest = {
    id: '1',
    clientId: 'client-1',
    retireeId: 'retiree-1',
    serviceType: 'mentoring',
    description: 'Looking for career guidance in software engineering',
    status: 'pending',
    budget: 500,
    scheduledDate: '2025-09-01T10:00:00Z',
    createdAt: '2025-08-28T15:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BookingRequestForm', () => {
    it('renders all form fields correctly', () => {
      const mockSubmit = vi.fn()
      
      render(
        <BookingRequestForm
          clientId="client-1"
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      expect(screen.getByLabelText(/service type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/preferred date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/budget/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /send booking request/i })).toBeInTheDocument()
    })

    it('validates required fields', async () => {
      const mockSubmit = vi.fn()
      
      render(
        <BookingRequestForm
          clientId="client-1"
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      const submitButton = screen.getByRole('button', { name: /send booking request/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/service type is required/i)).toBeInTheDocument()
        expect(screen.getByText(/description is required/i)).toBeInTheDocument()
      })

      expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('submits form with valid data', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined)
      
      render(
        <BookingRequestForm
          clientId="client-1"
          retireeId="retiree-1"
          onSubmit={mockSubmit}
        />
      )

      // Fill out the form
      fireEvent.change(screen.getByLabelText(/service type/i), {
        target: { value: 'mentoring' }
      })
      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'Looking for career guidance in software engineering' }
      })

      const submitButton = screen.getByRole('button', { name: /send booking request/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          clientId: 'client-1',
          retireeId: 'retiree-1',
          serviceType: 'mentoring',
          description: 'Looking for career guidance in software engineering',
        })
      })
    })
  })

  describe('BookingCard', () => {
    it('renders booking information correctly', () => {
      render(
        <BookingCard
          booking={mockBooking}
          userRole="client"
        />
      )

      expect(screen.getByText('mentoring')).toBeInTheDocument()
      expect(screen.getByText(/career guidance/i)).toBeInTheDocument()
      expect(screen.getByText('Pending Response')).toBeInTheDocument()
      expect(screen.getByText('$500')).toBeInTheDocument()
    })

    it('shows accept/reject buttons for retirees when status is pending', () => {
      const mockRespond = vi.fn()
      
      render(
        <BookingCard
          booking={mockBooking}
          userRole="retiree"
          onRespond={mockRespond}
        />
      )

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })

    it('shows chat button when booking is accepted', () => {
      const mockChat = vi.fn()
      const acceptedBooking = { ...mockBooking, status: 'accepted' as const }
      
      render(
        <BookingCard
          booking={acceptedBooking}
          userRole="client"
          onChat={mockChat}
        />
      )

      expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
    })

    it('calls onRespond when accept button is clicked', () => {
      const mockRespond = vi.fn()
      
      render(
        <BookingCard
          booking={mockBooking}
          userRole="retiree"
          onRespond={mockRespond}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /accept/i }))
      expect(mockRespond).toHaveBeenCalledWith('1', 'accept')
    })
  })

  describe('BookingList', () => {
    const mockBookings: BookingRequest[] = [
      mockBooking,
      {
        ...mockBooking,
        id: '2',
        status: 'accepted',
        serviceType: 'consulting',
      },
      {
        ...mockBooking,
        id: '3',
        status: 'completed',
        serviceType: 'training',
      }
    ]

    it('renders all bookings', () => {
      render(
        <BookingList
          bookings={mockBookings}
          userRole="client"
        />
      )

      expect(screen.getByText('mentoring')).toBeInTheDocument()
      expect(screen.getByText('consulting')).toBeInTheDocument()
      expect(screen.getByText('training')).toBeInTheDocument()
    })

    it('filters bookings by status', () => {
      render(
        <BookingList
          bookings={mockBookings}
          userRole="client"
        />
      )

      // Click on the "Accepted" tab
      fireEvent.click(screen.getByRole('button', { name: /accepted/i }))

      expect(screen.getByText('consulting')).toBeInTheDocument()
      expect(screen.queryByText('mentoring')).not.toBeInTheDocument()
      expect(screen.queryByText('training')).not.toBeInTheDocument()
    })

    it('shows empty state when no bookings match filter', () => {
      render(
        <BookingList
          bookings={mockBookings}
          userRole="client"
        />
      )

      // Click on a tab with no matching bookings
      fireEvent.click(screen.getByRole('button', { name: /rejected/i }))

      expect(screen.getByText(/no rejected bookings/i)).toBeInTheDocument()
    })

    it('shows loading state', () => {
      render(
        <BookingList
          bookings={[]}
          userRole="client"
          loading={true}
        />
      )

      expect(screen.getByRole('progressbar') || screen.getByText(/loading/i)).toBeInTheDocument()
    })
  })
})