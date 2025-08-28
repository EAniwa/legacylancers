export interface BookingRequest {
  id?: string;
  clientId: string;
  retireeId: string;
  serviceType: string;
  description: string;
  scheduledDate?: string;
  budget?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingResponse {
  id: string;
  bookingId: string;
  retireeId: string;
  response: 'accept' | 'reject' | 'negotiate';
  message?: string;
  counterOffer?: {
    budget?: number;
    scheduledDate?: string;
    terms?: string;
  };
  createdAt: string;
}

class BookingApiService {
  private baseUrl = '/api/bookings';

  async createBookingRequest(request: Omit<BookingRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<BookingRequest> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create booking request: ${response.statusText}`);
    }

    return response.json();
  }

  async getBookingRequests(userId: string, role: 'client' | 'retiree'): Promise<BookingRequest[]> {
    const params = new URLSearchParams({ userId, role });
    const response = await fetch(`${this.baseUrl}?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch booking requests: ${response.statusText}`);
    }

    return response.json();
  }

  async getBookingRequest(id: string): Promise<BookingRequest> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch booking request: ${response.statusText}`);
    }

    return response.json();
  }

  async respondToBooking(bookingId: string, response: Omit<BookingResponse, 'id' | 'createdAt'>): Promise<BookingResponse> {
    const res = await fetch(`${this.baseUrl}/${bookingId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    });

    if (!res.ok) {
      throw new Error(`Failed to respond to booking: ${res.statusText}`);
    }

    return res.json();
  }

  async updateBookingStatus(id: string, status: BookingRequest['status']): Promise<BookingRequest> {
    const response = await fetch(`${this.baseUrl}/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update booking status: ${response.statusText}`);
    }

    return response.json();
  }

  async getBookingHistory(userId: string): Promise<BookingRequest[]> {
    const response = await fetch(`${this.baseUrl}/history/${userId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch booking history: ${response.statusText}`);
    }

    return response.json();
  }
}

export const bookingApi = new BookingApiService();