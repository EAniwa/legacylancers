import React, { useState } from 'react';
import { Button } from '../ui/Button';
import type { Gig } from '../../services/gigApi';

interface GigPostFormProps {
  clientId: string;
  onSubmit: (gig: Omit<Gig, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'applicantCount'>) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

const categories = [
  'Software Development',
  'Consulting',
  'Mentoring',
  'Training',
  'Speaking',
  'Advisory',
  'Project Management',
  'Strategy',
  'Operations',
  'Marketing',
  'Sales',
  'Design',
  'Writing',
  'Other'
];

const skillOptions = [
  'Leadership', 'Strategy', 'Project Management', 'Software Engineering',
  'Data Analytics', 'Marketing', 'Sales', 'Operations', 'Finance',
  'Human Resources', 'Consulting', 'Training', 'Public Speaking',
  'Mentoring', 'Business Development', 'Product Management'
];

export const GigPostForm: React.FC<GigPostFormProps> = ({
  clientId,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    budgetType: 'negotiable' as 'fixed' | 'hourly' | 'negotiable',
    budgetMin: '',
    budgetMax: '',
    skills: [] as string[],
    deadline: '',
    location: '',
    isRemote: true,
    experienceLevel: 'any' as 'entry' | 'intermediate' | 'expert' | 'any',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 50) {
      newErrors.description = 'Description must be at least 50 characters';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.budgetType !== 'negotiable') {
      if (formData.budgetMin && (isNaN(Number(formData.budgetMin)) || Number(formData.budgetMin) <= 0)) {
        newErrors.budgetMin = 'Minimum budget must be a valid positive number';
      }
      
      if (formData.budgetMax && (isNaN(Number(formData.budgetMax)) || Number(formData.budgetMax) <= 0)) {
        newErrors.budgetMax = 'Maximum budget must be a valid positive number';
      }
      
      if (formData.budgetMin && formData.budgetMax && Number(formData.budgetMin) > Number(formData.budgetMax)) {
        newErrors.budgetMax = 'Maximum budget must be greater than minimum budget';
      }
    }

    if (formData.deadline) {
      const selectedDate = new Date(formData.deadline);
      const now = new Date();
      if (selectedDate <= now) {
        newErrors.deadline = 'Deadline must be in the future';
      }
    }

    if (!formData.isRemote && !formData.location.trim()) {
      newErrors.location = 'Location is required for non-remote gigs';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const gig: Omit<Gig, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'applicantCount'> = {
      clientId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      budget: {
        type: formData.budgetType,
        min: formData.budgetMin ? Number(formData.budgetMin) : undefined,
        max: formData.budgetMax ? Number(formData.budgetMax) : undefined,
      },
      skills: formData.skills,
      deadline: formData.deadline || undefined,
      location: formData.location.trim() || undefined,
      isRemote: formData.isRemote,
      experienceLevel: formData.experienceLevel,
    };

    try {
      await onSubmit(gig);
      // Reset form on success
      setFormData({
        title: '',
        description: '',
        category: '',
        budgetType: 'negotiable',
        budgetMin: '',
        budgetMax: '',
        skills: [],
        deadline: '',
        location: '',
        isRemote: true,
        experienceLevel: 'any',
      });
      setErrors({});
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Post a New Gig</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Gig Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="e.g., Need a senior developer for React project review"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.title ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
            maxLength={100}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Provide detailed information about the project, requirements, deliverables, and any specific qualifications needed..."
            rows={6}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical ${
              errors.description ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
            maxLength={2000}
          />
          <div className="flex justify-between mt-1">
            <div>
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description}</p>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {formData.description.length}/2000
            </p>
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.category ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-600">{errors.category}</p>
          )}
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Budget</label>
          
          <div className="space-y-3">
            <div className="flex gap-4">
              {[
                { value: 'negotiable', label: 'Negotiable' },
                { value: 'fixed', label: 'Fixed Price' },
                { value: 'hourly', label: 'Hourly Rate' },
              ].map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    value={option.value}
                    checked={formData.budgetType === option.value}
                    onChange={(e) => handleInputChange('budgetType', e.target.value)}
                    className="mr-2 text-blue-600 focus:ring-blue-500"
                    disabled={loading}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {formData.budgetType !== 'negotiable' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="budgetMin" className="block text-sm text-gray-600 mb-1">
                    {formData.budgetType === 'fixed' ? 'Budget' : 'Minimum Rate'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      id="budgetMin"
                      value={formData.budgetMin}
                      onChange={(e) => handleInputChange('budgetMin', e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.budgetMin ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    {formData.budgetType === 'hourly' && (
                      <span className="absolute right-3 top-2 text-gray-500">/hr</span>
                    )}
                  </div>
                  {errors.budgetMin && (
                    <p className="mt-1 text-sm text-red-600">{errors.budgetMin}</p>
                  )}
                </div>

                {formData.budgetType === 'hourly' && (
                  <div>
                    <label htmlFor="budgetMax" className="block text-sm text-gray-600 mb-1">
                      Maximum Rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        id="budgetMax"
                        value={formData.budgetMax}
                        onChange={(e) => handleInputChange('budgetMax', e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.budgetMax ? 'border-red-300' : 'border-gray-300'
                        }`}
                        disabled={loading}
                      />
                      <span className="absolute right-3 top-2 text-gray-500">/hr</span>
                    </div>
                    {errors.budgetMax && (
                      <p className="mt-1 text-sm text-red-600">{errors.budgetMax}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Skills */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Required Skills (select all that apply)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {skillOptions.map((skill) => (
              <label key={skill} className="flex items-center p-2 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.skills.includes(skill)}
                  onChange={() => handleSkillToggle(skill)}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                  disabled={loading}
                />
                <span className="text-sm">{skill}</span>
              </label>
            ))}
          </div>
          {formData.skills.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {formData.skills.join(', ')}
            </p>
          )}
        </div>

        {/* Location & Remote */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isRemote}
                onChange={(e) => handleInputChange('isRemote', e.target.checked)}
                className="mr-2 text-blue-600 focus:ring-blue-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-700">Remote work allowed</span>
            </label>
          </div>

          {!formData.isRemote && (
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Location *
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="City, State/Province"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.location ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location}</p>
              )}
            </div>
          )}
        </div>

        {/* Experience Level & Deadline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-1">
              Experience Level Required
            </label>
            <select
              id="experienceLevel"
              value={formData.experienceLevel}
              onChange={(e) => handleInputChange('experienceLevel', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="any">Any Level</option>
              <option value="entry">Entry Level</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
              Deadline (Optional)
            </label>
            <input
              type="datetime-local"
              id="deadline"
              value={formData.deadline}
              onChange={(e) => handleInputChange('deadline', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.deadline ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.deadline && (
              <p className="mt-1 text-sm text-red-600">{errors.deadline}</p>
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
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
            Post Gig
          </Button>
        </div>
      </form>
    </div>
  );
};