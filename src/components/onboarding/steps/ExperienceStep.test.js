/**
 * ExperienceStep Component Tests
 * Comprehensive test suite for experience and education management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ExperienceStep from './ExperienceStep';

const renderExperienceStep = (props = {}) => {
  const defaultProps = {
    data: {},
    onUpdate: jest.fn(),
    onComplete: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    isLoading: false,
    error: null,
    canSkip: false,
    onSkip: null,
    ...props
  };

  return render(<ExperienceStep {...defaultProps} />);
};

describe('ExperienceStep Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders all main sections', () => {
      renderExperienceStep();
      
      expect(screen.getByText('Work Experience')).toBeInTheDocument();
      expect(screen.getByText('Education')).toBeInTheDocument();
      expect(screen.getByText('Achievement Highlights')).toBeInTheDocument();
      expect(screen.getByText('Certification Documents')).toBeInTheDocument();
    });

    it('shows empty states when no data', () => {
      renderExperienceStep();
      
      expect(screen.getByText('No work experience added yet. Click "Add Experience" to get started.')).toBeInTheDocument();
      expect(screen.getByText('No education added yet. Click "Add Education" to get started.')).toBeInTheDocument();
    });

    it('shows add buttons for each section', () => {
      renderExperienceStep();
      
      expect(screen.getByRole('button', { name: '+ Add Experience' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+ Add Education' })).toBeInTheDocument();
    });

    it('displays validation message when no experience or education', () => {
      renderExperienceStep();
      
      expect(screen.getByText('Please add at least one work experience or education entry to continue.')).toBeInTheDocument();
    });
  });

  describe('Work Experience Management', () => {
    it('allows adding new work experience', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderExperienceStep({ onUpdate: mockOnUpdate });
      
      const addButton = screen.getByRole('button', { name: '+ Add Experience' });
      await user.click(addButton);
      
      expect(screen.getByPlaceholderText('Company name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Your job title')).toBeInTheDocument();
    });

    it('validates required fields for work experience', async () => {
      const user = userEvent.setup();
      renderExperienceStep();
      
      const addButton = screen.getByRole('button', { name: '+ Add Experience' });
      await user.click(addButton);
      
      // Try to save without required fields
      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);
      
      // Should not save (form should still be in editing mode)
      expect(screen.getByPlaceholderText('Company name')).toBeInTheDocument();
    });

    it('saves work experience when valid data is provided', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderExperienceStep({ onUpdate: mockOnUpdate });
      
      // Add new experience
      const addButton = screen.getByRole('button', { name: '+ Add Experience' });
      await user.click(addButton);
      
      // Fill required fields
      await user.type(screen.getByPlaceholderText('Company name'), 'Test Company');
      await user.type(screen.getByPlaceholderText('Your job title'), 'Software Engineer');
      await user.type(screen.getByDisplayValue(''), '2020-01');
      
      // Save
      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Test Company')).toBeInTheDocument();
    });

    it('handles current job checkbox properly', async () => {
      const user = userEvent.setup();
      renderExperienceStep();
      
      const addButton = screen.getByRole('button', { name: '+ Add Experience' });
      await user.click(addButton);
      
      const currentJobCheckbox = screen.getByLabelText('I currently work here');
      await user.click(currentJobCheckbox);
      
      // End date field should be hidden when current job is checked
      expect(screen.queryByLabelText('End Date')).not.toBeInTheDocument();
    });

    it('allows adding and removing achievements', async () => {
      const user = userEvent.setup();
      renderExperienceStep();
      
      const addButton = screen.getByRole('button', { name: '+ Add Experience' });
      await user.click(addButton);
      
      // Add achievement
      const achievementInput = screen.getByPlaceholderText('Add a key achievement or accomplishment');
      await user.type(achievementInput, 'Led team of 5 developers');
      
      const addAchievementButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addAchievementButton);
      
      expect(screen.getByText('Led team of 5 developers')).toBeInTheDocument();
      
      // Remove achievement
      const removeButton = screen.getByRole('button', { name: '×' });
      await user.click(removeButton);
      
      expect(screen.queryByText('Led team of 5 developers')).not.toBeInTheDocument();
    });

    it('allows editing existing work experience', async () => {
      const user = userEvent.setup();
      const experienceData = {
        workExperience: [{
          company: 'Old Company',
          position: 'Developer',
          startDate: '2020-01',
          endDate: '2021-01',
          current: false,
          description: 'Worked on web apps'
        }]
      };
      
      renderExperienceStep({ data: experienceData });
      
      const editButton = screen.getByRole('button', { name: 'Edit' });
      await user.click(editButton);
      
      expect(screen.getByDisplayValue('Old Company')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Developer')).toBeInTheDocument();
    });

    it('allows removing work experience', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const experienceData = {
        workExperience: [{
          company: 'Test Company',
          position: 'Developer',
          startDate: '2020-01',
          endDate: '2021-01'
        }]
      };
      
      renderExperienceStep({ data: experienceData, onUpdate: mockOnUpdate });
      
      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Education Management', () => {
    it('allows adding new education', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderExperienceStep({ onUpdate: mockOnUpdate });
      
      const addButton = screen.getByRole('button', { name: '+ Add Education' });
      await user.click(addButton);
      
      expect(screen.getByPlaceholderText('School or institution name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., Bachelor of Science, MBA, etc.')).toBeInTheDocument();
    });

    it('validates required fields for education', async () => {
      const user = userEvent.setup();
      renderExperienceStep();
      
      const addButton = screen.getByRole('button', { name: '+ Add Education' });
      await user.click(addButton);
      
      // Try to save without required fields
      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);
      
      // Should not save (form should still be in editing mode)
      expect(screen.getByPlaceholderText('School or institution name')).toBeInTheDocument();
    });

    it('saves education when valid data is provided', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderExperienceStep({ onUpdate: mockOnUpdate });
      
      // Add new education
      const addButton = screen.getByRole('button', { name: '+ Add Education' });
      await user.click(addButton);
      
      // Fill required fields
      await user.type(screen.getByPlaceholderText('School or institution name'), 'Test University');
      await user.type(screen.getByPlaceholderText('e.g., Bachelor of Science, MBA, etc.'), 'Bachelor of Computer Science');
      
      // Save
      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
      expect(screen.getByText('Bachelor of Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Test University')).toBeInTheDocument();
    });

    it('handles currently enrolled checkbox properly', async () => {
      const user = userEvent.setup();
      renderExperienceStep();
      
      const addButton = screen.getByRole('button', { name: '+ Add Education' });
      await user.click(addButton);
      
      const currentlyEnrolledCheckbox = screen.getByLabelText('I\'m currently enrolled');
      await user.click(currentlyEnrolledCheckbox);
      
      // End date field should be hidden when currently enrolled is checked
      expect(screen.queryByLabelText('End Date')).not.toBeInTheDocument();
    });

    it('allows editing existing education', async () => {
      const user = userEvent.setup();
      const educationData = {
        education: [{
          institution: 'Old University',
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          startDate: '2016-09',
          endDate: '2020-05'
        }]
      };
      
      renderExperienceStep({ data: educationData });
      
      const editButton = screen.getByRole('button', { name: 'Edit' });
      await user.click(editButton);
      
      expect(screen.getByDisplayValue('Old University')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Bachelor of Science')).toBeInTheDocument();
    });

    it('allows removing education', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const educationData = {
        education: [{
          institution: 'Test University',
          degree: 'Bachelor of Science',
          startDate: '2016-09',
          endDate: '2020-05'
        }]
      };
      
      renderExperienceStep({ data: educationData, onUpdate: mockOnUpdate });
      
      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Achievement Management', () => {
    it('allows adding achievements with different types', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderExperienceStep({ onUpdate: mockOnUpdate });
      
      // Fill achievement form
      await user.selectOptions(screen.getByDisplayValue('🏆 Award'), 'publication');
      await user.type(screen.getByPlaceholderText('Achievement title'), 'Published Research Paper');
      await user.type(screen.getByPlaceholderText('Describe your achievement and its impact'), 'Research on AI applications');
      await user.type(screen.getAllByDisplayValue('')[0], '2023-06'); // date field
      
      // Add achievement
      const addButton = screen.getByRole('button', { name: 'Add Achievement' });
      await user.click(addButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
      expect(screen.getByText('Published Research Paper')).toBeInTheDocument();
    });

    it('prevents adding empty achievements', async () => {
      const user = userEvent.setup();
      renderExperienceStep();
      
      const addButton = screen.getByRole('button', { name: 'Add Achievement' });
      expect(addButton).toBeDisabled();
      
      // Add title
      await user.type(screen.getByPlaceholderText('Achievement title'), 'Test Achievement');
      expect(addButton).not.toBeDisabled();
    });

    it('allows removing achievements', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const achievementData = {
        achievements: [{
          id: 1,
          type: 'award',
          title: 'Employee of the Year',
          description: 'Outstanding performance',
          date: '2023-12'
        }]
      };
      
      renderExperienceStep({ data: achievementData, onUpdate: mockOnUpdate });
      
      const removeButton = screen.getByRole('button', { name: 'Remove' });
      await user.click(removeButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('File Upload', () => {
    it('displays file upload area for certifications', () => {
      renderExperienceStep();
      
      expect(screen.getByText('Drag and drop certification files here')).toBeInTheDocument();
      expect(screen.getByText(/or browse files/)).toBeInTheDocument();
    });

    // Note: File upload testing would require more complex setup to mock File API
    // This would be implemented with additional test utilities
  });

  describe('Form Validation', () => {
    it('enables continue button when work experience is added', () => {
      const experienceData = {
        workExperience: [{
          company: 'Test Company',
          position: 'Developer',
          startDate: '2020-01'
        }]
      };
      
      renderExperienceStep({ data: experienceData });
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('enables continue button when education is added', () => {
      const educationData = {
        education: [{
          institution: 'Test University',
          degree: 'Bachelor of Science'
        }]
      };
      
      renderExperienceStep({ data: educationData });
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('disables continue button when no experience or education', () => {
      renderExperienceStep();
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('calls onComplete with experience data when form is submitted', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      const experienceData = {
        workExperience: [{
          company: 'Test Company',
          position: 'Developer',
          startDate: '2020-01'
        }],
        education: [],
        achievements: [],
        certifications: []
      };
      
      renderExperienceStep({ data: experienceData, onComplete: mockOnComplete });
      
      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith({
        workExperience: expect.arrayContaining([
          expect.objectContaining({
            company: 'Test Company',
            position: 'Developer'
          })
        ]),
        education: [],
        certifications: [],
        achievements: []
      });
    });

    it('does not submit when validation fails', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      
      renderExperienceStep({ onComplete: mockOnComplete });
      
      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('calls onPrevious when previous button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnPrevious = jest.fn();
      
      renderExperienceStep({ onPrevious: mockOnPrevious });
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);
      
      expect(mockOnPrevious).toHaveBeenCalled();
    });

    it('shows and calls onSkip when skipping is enabled', async () => {
      const user = userEvent.setup();
      const mockOnSkip = jest.fn();
      
      renderExperienceStep({ canSkip: true, onSkip: mockOnSkip });
      
      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      expect(skipButton).toBeInTheDocument();
      
      await user.click(skipButton);
      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('disables form elements when loading', () => {
      renderExperienceStep({ isLoading: true });
      
      const continueButton = screen.getByRole('button', { name: /saving.../i });
      expect(continueButton).toBeDisabled();
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('displays error message when error is provided', () => {
      const errorMessage = 'Failed to save experience';
      renderExperienceStep({ error: errorMessage });
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Data Persistence', () => {
    it('calls onUpdate when data changes', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderExperienceStep({ onUpdate: mockOnUpdate });
      
      const addButton = screen.getByRole('button', { name: '+ Add Experience' });
      await user.click(addButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('maintains data across re-renders', () => {
      const experienceData = {
        workExperience: [{
          company: 'Test Company',
          position: 'Developer',
          startDate: '2020-01'
        }]
      };
      
      const { rerender } = renderExperienceStep({ data: experienceData });
      
      expect(screen.getByText('Developer')).toBeInTheDocument();
      
      rerender(<ExperienceStep data={experienceData} onUpdate={jest.fn()} onComplete={jest.fn()} />);
      
      expect(screen.getByText('Developer')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty data gracefully', () => {
      renderExperienceStep({ data: {} });
      
      expect(screen.getByText('Work Experience')).toBeInTheDocument();
    });

    it('handles missing data prop gracefully', () => {
      renderExperienceStep({ data: undefined });
      
      expect(screen.getByText('Work Experience')).toBeInTheDocument();
    });
  });
});