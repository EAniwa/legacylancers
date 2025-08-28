import { useState, useEffect, useCallback } from 'react';
import { gigApi } from '../services/gigApi';
import type { GigBid } from '../services/gigApi';

export interface UseGigBiddingOptions {
  gigId?: string;
  retireeId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useGigBidding = (options: UseGigBiddingOptions = {}) => {
  const { gigId, retireeId, autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [bids, setBids] = useState<GigBid[]>([]);
  const [myBids, setMyBids] = useState<GigBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBids = useCallback(async () => {
    if (!gigId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await gigApi.getBids(gigId);
      setBids(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bids');
    } finally {
      setLoading(false);
    }
  }, [gigId]);

  const fetchMyBids = useCallback(async () => {
    if (!retireeId) return;

    try {
      const data = await gigApi.getMyBids(retireeId);
      setMyBids(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch my bids');
    }
  }, [retireeId]);

  const createBid = useCallback(async (
    bid: Omit<GigBid, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<GigBid> => {
    setError(null);
    
    try {
      const newBid = await gigApi.createBid(bid);
      
      // Update local state
      setBids(prev => [newBid, ...prev]);
      if (bid.retireeId === retireeId) {
        setMyBids(prev => [newBid, ...prev]);
      }
      
      return newBid;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bid';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [retireeId]);

  const updateBidStatus = useCallback(async (
    bidId: string,
    status: GigBid['status']
  ): Promise<void> => {
    if (!gigId) return;
    
    setError(null);
    
    try {
      await gigApi.updateBidStatus(gigId, bidId, status);
      
      // Update local state
      setBids(prev => 
        prev.map(bid => 
          bid.id === bidId ? { ...bid, status } : bid
        )
      );
      
      setMyBids(prev => 
        prev.map(bid => 
          bid.id === bidId ? { ...bid, status } : bid
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bid status';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [gigId]);

  const getBidsByStatus = useCallback((status: GigBid['status']): GigBid[] => {
    return bids.filter(bid => bid.status === status);
  }, [bids]);

  const getMyBidForGig = useCallback((currentGigId: string): GigBid | undefined => {
    return myBids.find(bid => bid.gigId === currentGigId);
  }, [myBids]);

  const hasAlreadyBid = useCallback((currentGigId: string): boolean => {
    return myBids.some(bid => bid.gigId === currentGigId && bid.status !== 'withdrawn');
  }, [myBids]);

  const refreshBids = useCallback(() => {
    fetchBids();
    if (retireeId) {
      fetchMyBids();
    }
  }, [fetchBids, fetchMyBids, retireeId]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  useEffect(() => {
    fetchMyBids();
  }, [fetchMyBids]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshBids();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshBids]);

  return {
    bids,
    myBids,
    loading,
    error,
    createBid,
    updateBidStatus,
    getBidsByStatus,
    getMyBidForGig,
    hasAlreadyBid,
    refreshBids,
  };
};