export interface Gig {
  id?: string;
  clientId: string;
  title: string;
  description: string;
  category: string;
  budget: {
    min?: number;
    max?: number;
    type: 'fixed' | 'hourly' | 'negotiable';
  };
  skills: string[];
  deadline?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'closed';
  location?: string;
  isRemote: boolean;
  experienceLevel: 'entry' | 'intermediate' | 'expert' | 'any';
  createdAt?: string;
  updatedAt?: string;
  applicantCount?: number;
}

export interface GigBid {
  id?: string;
  gigId: string;
  retireeId: string;
  proposal: string;
  budget?: number;
  estimatedHours?: number;
  deliveryDate?: string;
  attachments?: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt?: string;
  updatedAt?: string;
}

export interface GigSearchFilters {
  category?: string;
  minBudget?: number;
  maxBudget?: number;
  skills?: string[];
  location?: string;
  isRemote?: boolean;
  experienceLevel?: string;
  sortBy?: 'newest' | 'oldest' | 'budget_high' | 'budget_low' | 'deadline';
}

class GigApiService {
  private baseUrl = '/api/gigs';

  async createGig(gig: Omit<Gig, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'applicantCount'>): Promise<Gig> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gig),
    });

    if (!response.ok) {
      throw new Error(`Failed to create gig: ${response.statusText}`);
    }

    return response.json();
  }

  async getGigs(filters?: GigSearchFilters): Promise<Gig[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const response = await fetch(`${this.baseUrl}?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch gigs: ${response.statusText}`);
    }

    return response.json();
  }

  async getGig(id: string): Promise<Gig> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch gig: ${response.statusText}`);
    }

    return response.json();
  }

  async updateGig(id: string, updates: Partial<Gig>): Promise<Gig> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update gig: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteGig(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete gig: ${response.statusText}`);
    }
  }

  async getMyGigs(clientId: string): Promise<Gig[]> {
    const response = await fetch(`${this.baseUrl}/my-gigs/${clientId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch user gigs: ${response.statusText}`);
    }

    return response.json();
  }

  async createBid(bid: Omit<GigBid, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<GigBid> {
    const response = await fetch(`${this.baseUrl}/${bid.gigId}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bid),
    });

    if (!response.ok) {
      throw new Error(`Failed to create bid: ${response.statusText}`);
    }

    return response.json();
  }

  async getBids(gigId: string): Promise<GigBid[]> {
    const response = await fetch(`${this.baseUrl}/${gigId}/bids`);

    if (!response.ok) {
      throw new Error(`Failed to fetch bids: ${response.statusText}`);
    }

    return response.json();
  }

  async getMyBids(retireeId: string): Promise<GigBid[]> {
    const response = await fetch(`${this.baseUrl}/bids/my-bids/${retireeId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch user bids: ${response.statusText}`);
    }

    return response.json();
  }

  async updateBidStatus(gigId: string, bidId: string, status: GigBid['status']): Promise<GigBid> {
    const response = await fetch(`${this.baseUrl}/${gigId}/bids/${bidId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update bid status: ${response.statusText}`);
    }

    return response.json();
  }
}

export const gigApi = new GigApiService();