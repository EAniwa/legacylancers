import React, { useState } from 'react';
import { Button } from '../ui/Button';
import type { GigBid, Gig } from '../../services/gigApi';

interface BidFormProps {
  gig: Gig;
  retireeId: string;
  onSubmit: (bid: Omit<GigBid, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const BidForm: React.FC<BidFormProps> = ({
  gig,
  retireeId,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    proposal: '',
    budget: '',
    estimatedHours: '',
    deliveryDate: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.proposal.trim()) {
      newErrors.proposal = 'Proposal is required';
    } else if (formData.proposal.trim().length < 100) {
      newErrors.proposal = 'Proposal must be at least 100 characters';
    }

    if (formData.budget && (isNaN(Number(formData.budget)) || Number(formData.budget) <= 0)) {
      newErrors.budget = 'Budget must be a valid positive number';
    }

    if (formData.estimatedHours && (isNaN(Number(formData.estimatedHours)) || Number(formData.estimatedHours) <= 0)) {
      newErrors.estimatedHours = 'Estimated hours must be a valid positive number';
    }

    if (formData.deliveryDate) {
      const selectedDate = new Date(formData.deliveryDate);
      const now = new Date();
      if (selectedDate <= now) {
        newErrors.deliveryDate = 'Delivery date must be in the future';
      }
      
      if (gig.deadline && selectedDate > new Date(gig.deadline)) {
        newErrors.deliveryDate = 'Delivery date cannot be after the gig deadline';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const bid: Omit<GigBid, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
      gigId: gig.id!,
      retireeId,
      proposal: formData.proposal.trim(),
      budget: formData.budget ? Number(formData.budget) : undefined,
      estimatedHours: formData.estimatedHours ? Number(formData.estimatedHours) : undefined,
      deliveryDate: formData.deliveryDate || undefined,
    };

    try {
      await onSubmit(bid);
      // Reset form on success
      setFormData({
        proposal: '',
        budget: '',
        estimatedHours: '',
        deliveryDate: '',
      });
      setErrors({});
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getBudgetGuidance = () => {
    const { budget } = gig;
    if (budget.type === 'negotiable') {
      return 'This client is open to budget negotiations.';
    }
    if (budget.type === 'fixed') {
      return `Client's budget: $${budget.min?.toLocaleString()}`;
    }
    if (budget.type === 'hourly') {
      if (budget.min && budget.max) {
        return `Client's rate range: $${budget.min} - $${budget.max}/hr`;
      }
      return `Client's rate: $${(budget.min || budget.max)}/hr`;
    }
    return '';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Submit Proposal for: {gig.title}
        </h3>
        <p className="text-sm text-blue-600">{getBudgetGuidance()}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Proposal */}
        <div>
          <label htmlFor="proposal" className="block text-sm font-medium text-gray-700 mb-1">
            Your Proposal *
          </label>
          <textarea
            id="proposal"
            value={formData.proposal}
            onChange={(e) => handleInputChange('proposal', e.target.value)}
            placeholder="Explain why you're the right person for this gig. Include your relevant experience, approach to the project, and what value you'll provide..."
            rows={6}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical ${
              errors.proposal ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
            maxLength={1500}
          />
          <div className="flex justify-between mt-1">
            <div>
              {errors.proposal && (
                <p className="text-sm text-red-600">{errors.proposal}</p>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {formData.proposal.length}/1500
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Budget */}
          <div>
            <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
              Your Rate/Budget
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                id="budget"
                value={formData.budget}
                onChange={(e) => handleInputChange('budget', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.budget ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={loading}
              />
            </div>
            {errors.budget && (
              <p className="mt-1 text-sm text-red-600">{errors.budget}</p>
            )}
          </div>

          {/* Estimated Hours */}
          <div>
            <label htmlFor="estimatedHours" className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Hours
            </label>
            <input
              type="number"
              id="estimatedHours"
              value={formData.estimatedHours}
              onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
              placeholder="0"
              min="0"
              step="0.5"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.estimatedHours ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.estimatedHours && (
              <p className="mt-1 text-sm text-red-600">{errors.estimatedHours}</p>
            )}
          </div>

          {/* Delivery Date */}
          <div>
            <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Date
            </label>
            <input
              type="date"
              id="deliveryDate"
              value={formData.deliveryDate}
              onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.deliveryDate ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
              min={new Date().toISOString().split('T')[0]}
              max={gig.deadline ? new Date(gig.deadline).toISOString().split('T')[0] : undefined}
            />
            {errors.deliveryDate && (
              <p className="mt-1 text-sm text-red-600">{errors.deliveryDate}</p>
            )}
          </div>
        </div>

        {/* Gig Requirements Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Gig Requirements</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
            <div>Category: {gig.category}</div>
            <div>Experience: {gig.experienceLevel}</div>
            <div>Location: {gig.isRemote ? 'Remote' : gig.location || 'TBD'}</div>
            {gig.deadline && (
              <div>Deadline: {new Date(gig.deadline).toLocaleDateString()}</div>
            )}
          </div>
          {gig.skills.length > 0 && (
            <div className="mt-2">
              <span className="text-sm text-gray-700">Skills: </span>
              <span className="text-sm text-gray-600">{gig.skills.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            Submit Proposal
          </Button>
        </div>
      </form>
    </div>
  );
};