import React from 'react';
import { Button } from '../ui/Button';
import type { GigSearchFilters } from '../../services/gigApi';

interface GigFiltersProps {
  filters: GigSearchFilters;
  onFiltersChange: (filters: Partial<GigSearchFilters>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
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

const experienceLevels = [
  { value: 'any', label: 'Any Level' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' },
];

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'budget_high', label: 'Highest Budget' },
  { value: 'budget_low', label: 'Lowest Budget' },
  { value: 'deadline', label: 'Closest Deadline' },
];

export const GigFilters: React.FC<GigFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilters,
}) => {
  const handleSkillToggle = (skill: string) => {
    const currentSkills = filters.skills || [];
    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter(s => s !== skill)
      : [...currentSkills, skill];
    
    onFiltersChange({ skills: newSkills.length > 0 ? newSkills : undefined });
  };

  const isSkillSelected = (skill: string) => {
    return (filters.skills || []).includes(skill);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Filter Gigs</h3>
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="outline"
            onClick={onClearFilters}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
          Category
        </label>
        <select
          id="category"
          value={filters.category || ''}
          onChange={(e) => onFiltersChange({ category: e.target.value || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Budget Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Budget Range
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              type="number"
              placeholder="Min budget"
              value={filters.minBudget || ''}
              onChange={(e) => onFiltersChange({ 
                minBudget: e.target.value ? Number(e.target.value) : undefined 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
            />
          </div>
          <div>
            <input
              type="number"
              placeholder="Max budget"
              value={filters.maxBudget || ''}
              onChange={(e) => onFiltersChange({ 
                maxBudget: e.target.value ? Number(e.target.value) : undefined 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Experience Level */}
      <div>
        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-2">
          Experience Level
        </label>
        <select
          id="experienceLevel"
          value={filters.experienceLevel || ''}
          onChange={(e) => onFiltersChange({ experienceLevel: e.target.value || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Any Level</option>
          {experienceLevels.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.isRemote === true}
              onChange={(e) => onFiltersChange({ 
                isRemote: e.target.checked ? true : undefined 
              })}
              className="mr-2 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Remote work only</span>
          </label>
          <input
            type="text"
            placeholder="City, State/Province"
            value={filters.location || ''}
            onChange={(e) => onFiltersChange({ location: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Required Skills
        </label>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {skillOptions.map((skill) => (
            <label key={skill} className="flex items-center p-2 hover:bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={isSkillSelected(skill)}
                onChange={() => handleSkillToggle(skill)}
                className="mr-2 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">{skill}</span>
            </label>
          ))}
        </div>
        {(filters.skills?.length || 0) > 0 && (
          <p className="mt-2 text-sm text-blue-600">
            {filters.skills!.length} skills selected
          </p>
        )}
      </div>

      {/* Sort Options */}
      <div>
        <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">
          Sort By
        </label>
        <select
          id="sortBy"
          value={filters.sortBy || 'newest'}
          onChange={(e) => onFiltersChange({ 
            sortBy: e.target.value as GigSearchFilters['sortBy'] 
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};