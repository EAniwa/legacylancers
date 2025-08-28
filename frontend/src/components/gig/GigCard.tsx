import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/Button';
import type { Gig } from '../../services/gigApi';

interface GigCardProps {
  gig: Gig;
  userRole: 'client' | 'retiree';
  userId?: string;
  hasUserBid?: boolean;
  onBid?: (gigId: string) => void;
  onViewBids?: (gigId: string) => void;
  onEdit?: (gigId: string) => void;
  onViewDetails?: (gigId: string) => void;
  loading?: boolean;
}

export const GigCard: React.FC<GigCardProps> = ({
  gig,
  userRole,
  userId,
  hasUserBid = false,
  onBid,
  onViewBids,
  onEdit,
  onViewDetails,
  loading = false,
}) => {
  const isOwner = userRole === 'client' && gig.clientId === userId;
  const canBid = userRole === 'retiree' && !hasUserBid && gig.status === 'open';

  const getBudgetDisplay = () => {
    const { budget } = gig;
    if (budget.type === 'negotiable') {
      return 'Budget: Negotiable';
    }
    
    const formatAmount = (amount: number) => `$${amount.toLocaleString()}`;
    
    if (budget.type === 'fixed') {
      return `Budget: ${formatAmount(budget.min || 0)}`;
    }
    
    if (budget.type === 'hourly') {
      if (budget.min && budget.max) {
        return `Rate: ${formatAmount(budget.min)} - ${formatAmount(budget.max)}/hr`;
      }
      return `Rate: ${formatAmount(budget.min || budget.max || 0)}/hr`;
    }
    
    return 'Budget: Not specified';
  };

  const getStatusColor = (status: Gig['status']) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
            {gig.title}
          </h3>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(gig.status)}`}>
              {gig.status.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {gig.category}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">
            {getBudgetDisplay()}
          </p>
          {gig.applicantCount !== undefined && (
            <p className="text-sm text-gray-500">
              {gig.applicantCount} {gig.applicantCount === 1 ? 'applicant' : 'applicants'}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="text-gray-600 text-sm line-clamp-3">
          {gig.description}
        </p>
      </div>

      {/* Skills */}
      {gig.skills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {gig.skills.slice(0, 5).map((skill) => (
              <span
                key={skill}
                className="inline-flex px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full"
              >
                {skill}
              </span>
            ))}
            {gig.skills.length > 5 && (
              <span className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                +{gig.skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Meta Information */}
      <div className="space-y-2 mb-4">
        {gig.deadline && (
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Deadline: {format(new Date(gig.deadline), 'PPp')}</span>
          </div>
        )}

        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>
            {gig.isRemote ? 'Remote' : gig.location || 'Location TBD'}
          </span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Experience: {gig.experienceLevel.replace('_', ' ')}</span>
        </div>

        {gig.createdAt && (
          <div className="flex items-center text-sm text-gray-500">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Posted {formatDistanceToNow(new Date(gig.createdAt), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <div className="flex space-x-2">
          {canBid && onBid && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onBid(gig.id!)}
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Submit Proposal
            </Button>
          )}

          {hasUserBid && (
            <span className="inline-flex items-center px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Proposal Submitted
            </span>
          )}

          {isOwner && onViewBids && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onViewBids(gig.id!)}
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              View Proposals ({gig.applicantCount || 0})
            </Button>
          )}

          {isOwner && onEdit && gig.status === 'open' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(gig.id!)}
              disabled={loading}
            >
              Edit
            </Button>
          )}
        </div>

        {onViewDetails && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(gig.id!)}
            disabled={loading}
          >
            View Details
          </Button>
        )}
      </div>
    </div>
  );
};