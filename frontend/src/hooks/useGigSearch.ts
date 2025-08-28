import { useState, useEffect, useCallback } from 'react';
import { gigApi } from '../services/gigApi';
import type { Gig, GigSearchFilters } from '../services/gigApi';

export const useGigSearch = () => {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GigSearchFilters>({
    sortBy: 'newest',
  });
  const [totalCount, setTotalCount] = useState(0);

  const searchGigs = useCallback(async (searchFilters?: GigSearchFilters) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = { ...filters, ...searchFilters };
      const results = await gigApi.getGigs(searchParams);
      setGigs(results);
      setTotalCount(results.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search gigs');
      setGigs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const updateFilters = useCallback((newFilters: Partial<GigSearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ sortBy: 'newest' });
  }, []);

  const hasActiveFilters = useCallback(() => {
    return Object.keys(filters).some(key => 
      key !== 'sortBy' && filters[key as keyof GigSearchFilters] !== undefined
    );
  }, [filters]);

  const refreshGigs = useCallback(() => {
    searchGigs();
  }, [searchGigs]);

  useEffect(() => {
    searchGigs();
  }, [filters, searchGigs]);

  return {
    gigs,
    loading,
    error,
    filters,
    totalCount,
    searchGigs,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    refreshGigs,
  };
};