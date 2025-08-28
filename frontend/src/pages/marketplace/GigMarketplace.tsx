import React, { useState } from 'react';
import { GigCard } from '../../components/gig/GigCard';
import { GigPostForm } from '../../components/gig/GigPostForm';
import { GigFilters } from '../../components/marketplace/GigFilters';
import { GigSearch } from '../../components/marketplace/GigSearch';
import { BidForm } from '../../components/bidding/BidForm';
import { Button } from '../../components/ui/Button';
import { useGigSearch } from '../../hooks/useGigSearch';
import { useGigBidding } from '../../hooks/useGigBidding';
import { gigApi } from '../../services/gigApi';
import type { Gig } from '../../services/gigApi';

interface GigMarketplaceProps {
  userId: string;
  userRole: 'client' | 'retiree';
}

export const GigMarketplace: React.FC<GigMarketplaceProps> = ({
  userId,
  userRole,
}) => {
  const [showPostForm, setShowPostForm] = useState(false);
  const [showBidForm, setShowBidForm] = useState<string | null>(null);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    gigs,
    loading: searchLoading,
    error: searchError,
    filters,
    totalCount,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    refreshGigs,
  } = useGigSearch();

  const {
    myBids,
    loading: bidLoading,
    createBid,
    hasAlreadyBid,
  } = useGigBidding({
    retireeId: userRole === 'retiree' ? userId : undefined,
    autoRefresh: true,
  });

  // Filter gigs by search query on client side for better UX
  const filteredGigs = gigs.filter(gig => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      gig.title.toLowerCase().includes(query) ||
      gig.description.toLowerCase().includes(query) ||
      gig.skills.some(skill => skill.toLowerCase().includes(query)) ||
      gig.category.toLowerCase().includes(query)
    );
  });

  const handleCreateGig = async (gigData: Omit<Gig, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'applicantCount'>) => {
    try {
      setError(null);
      await gigApi.createGig(gigData);
      setSuccess('Gig posted successfully!');
      setShowPostForm(false);
      refreshGigs();
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post gig');
    }
  };

  const handleSubmitBid = async (bidData: any) => {
    try {
      setError(null);
      await createBid(bidData);
      setSuccess('Proposal submitted successfully!');
      setShowBidForm(null);
      setSelectedGig(null);
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit proposal');
    }
  };

  const handleBidClick = (gigId: string) => {
    const gig = gigs.find(g => g.id === gigId);
    if (gig) {
      setSelectedGig(gig);
      setShowBidForm(gigId);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleViewBids = (gigId: string) => {
    // TODO: Implement bid management modal
    console.log('View bids for gig:', gigId);
  };

  const handleViewDetails = (gigId: string) => {
    // TODO: Implement gig details modal
    console.log('View details for gig:', gigId);
  };

  const dismissError = () => setError(null);
  const dismissSuccess = () => setSuccess(null);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userRole === 'client' ? 'Gig Marketplace' : 'Available Gigs'}
          </h1>
          <p className="text-gray-600 mt-1">
            {userRole === 'client' 
              ? 'Post gigs and manage proposals from talented retirees' 
              : 'Discover opportunities and submit proposals'}
          </p>
        </div>
        
        {userRole === 'client' && (
          <Button
            variant="primary"
            onClick={() => setShowPostForm(true)}
            disabled={showPostForm}
          >
            Post New Gig
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
            <button onClick={dismissError} className="text-red-400 hover:text-red-600">
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
            <button onClick={dismissSuccess} className="text-green-400 hover:text-green-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Post Gig Form */}
      {showPostForm && userRole === 'client' && (
        <div className="mb-8">
          <GigPostForm
            clientId={userId}
            onSubmit={handleCreateGig}
            onCancel={() => setShowPostForm(false)}
            loading={searchLoading}
          />
        </div>
      )}

      {/* Bid Form */}
      {showBidForm && selectedGig && userRole === 'retiree' && (
        <div className="mb-8">
          <BidForm
            gig={selectedGig}
            retireeId={userId}
            onSubmit={handleSubmitBid}
            onCancel={() => {
              setShowBidForm(null);
              setSelectedGig(null);
            }}
            loading={bidLoading}
          />
        </div>
      )}

      {/* Search and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1">
          <GigFilters
            filters={filters}
            onFiltersChange={updateFilters}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters()}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <div>
            <GigSearch onSearch={handleSearch} loading={searchLoading} />
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-600">
                  {searchQuery ? (
                    <>Showing {filteredGigs.length} results for "{searchQuery}"</>
                  ) : (
                    <>Showing {filteredGigs.length} of {totalCount} gigs</>
                  )}
                </p>
                {(hasActiveFilters() || searchQuery) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      clearFilters();
                      setSearchQuery('');
                      handleSearch('');
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={refreshGigs}
                disabled={searchLoading}
                loading={searchLoading}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {searchLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Empty State */}
          {!searchLoading && filteredGigs.length === 0 && (
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery || hasActiveFilters() ? 'No gigs match your criteria' : 'No gigs available'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {userRole === 'client' 
                  ? 'Post your first gig to get started!' 
                  : searchQuery || hasActiveFilters()
                    ? 'Try adjusting your search or filters'
                    : 'New gigs will appear here when clients post them.'}
              </p>
              {(searchQuery || hasActiveFilters()) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearFilters();
                    setSearchQuery('');
                    handleSearch('');
                  }}
                  className="mt-3"
                >
                  Show All Gigs
                </Button>
              )}
            </div>
          )}

          {/* Gig List */}
          {!searchLoading && filteredGigs.length > 0 && (
            <div className="space-y-4">
              {filteredGigs.map((gig) => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  userRole={userRole}
                  userId={userId}
                  hasUserBid={hasAlreadyBid(gig.id!)}
                  onBid={handleBidClick}
                  onViewBids={handleViewBids}
                  onViewDetails={handleViewDetails}
                  loading={bidLoading && showBidForm === gig.id}
                />
              ))}

              {/* Load More (if pagination is implemented) */}
              {filteredGigs.length >= 20 && (
                <div className="text-center pt-6">
                  <Button
                    variant="outline"
                    onClick={refreshGigs}
                    disabled={searchLoading}
                  >
                    Load More Gigs
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Search Error */}
          {searchError && (
            <div className="text-center text-red-600 py-8">
              <p>Error loading gigs: {searchError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshGigs}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="border-t pt-6 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-2xl font-bold text-blue-600">{totalCount}</p>
            <p className="text-sm text-gray-600">Total Gigs</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-2xl font-bold text-green-600">
              {gigs.filter(g => g.status === 'open').length}
            </p>
            <p className="text-sm text-gray-600">Open Gigs</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-2xl font-bold text-orange-600">
              {gigs.filter(g => g.status === 'in_progress').length}
            </p>
            <p className="text-sm text-gray-600">In Progress</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-2xl font-bold text-gray-600">
              {userRole === 'retiree' ? myBids.length : 'N/A'}
            </p>
            <p className="text-sm text-gray-600">
              {userRole === 'retiree' ? 'My Proposals' : 'Completed'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};