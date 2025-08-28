/**
 * SkillsStep Component Tests
 * Comprehensive test suite for skills selection and categorization functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import SkillsStep from './SkillsStep';

// Mock react-select
jest.mock('react-select', () => {
  return function MockSelect({ options, onChange, placeholder, value, onInputChange, isLoading, loadingMessage, noOptionsMessage }) {
    return (
      <div data-testid="skills-select">
        <input
          data-testid="skills-select-input"
          placeholder={placeholder}
          onChange={(e) => {
            if (onInputChange) onInputChange(e.target.value);
            if (onChange && e.target.value) {
              const option = options?.find(opt => opt.label.toLowerCase().includes(e.target.value.toLowerCase()));
              if (option) onChange(option);
            }
          }}
        />
        {isLoading && <div data-testid="loading">Loading...</div>}
        <div data-testid="select-options">
          {options?.map((option, index) => (
            <div 
              key={index}
              data-testid={`option-${index}`}
              onClick={() => onChange && onChange(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
    );
  };
});

// Mock DnD Provider for tests
const DnDTestProvider = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    {children}
  </DndProvider>
);

const renderSkillsStep = (props = {}) => {
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

  return render(
    <DnDTestProvider>
      <SkillsStep {...defaultProps} />
    </DnDTestProvider>
  );
};

describe('SkillsStep Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders the skills step with all sections', () => {
      renderSkillsStep();
      
      expect(screen.getByText('Add Your Skills')).toBeInTheDocument();
      expect(screen.getByText('Categorize Your Skills')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search for skills/)).toBeInTheDocument();
      expect(screen.getByText('Popular Skills')).toBeInTheDocument();
    });

    it('displays all skill categories', () => {
      renderSkillsStep();
      
      expect(screen.getByText('Technical Skills')).toBeInTheDocument();
      expect(screen.getByText('Communication')).toBeInTheDocument();
      expect(screen.getByText('Leadership')).toBeInTheDocument();
      expect(screen.getByText('Project Management')).toBeInTheDocument();
      expect(screen.getByText('Analytical')).toBeInTheDocument();
      expect(screen.getByText('Creative')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    it('displays popular skills when no skills are added', () => {
      renderSkillsStep();
      
      expect(screen.getByText('Popular Skills')).toBeInTheDocument();
      expect(screen.getByText('+ JavaScript')).toBeInTheDocument();
      expect(screen.getByText('+ Python')).toBeInTheDocument();
      expect(screen.getByText('+ Project Management')).toBeInTheDocument();
    });

    it('displays continue button as disabled when no skills added', () => {
      renderSkillsStep();
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });
  });

  describe('Skills Management', () => {
    it('allows adding skills via search input', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      renderSkillsStep({ onUpdate: mockOnUpdate });

      const searchInput = screen.getByTestId('skills-select-input');
      await user.type(searchInput, 'JavaScript');
      
      await waitFor(() => {
        const option = screen.getByText('JavaScript');
        expect(option).toBeInTheDocument();
      });
      
      const jsOption = screen.getByText('JavaScript');
      await user.click(jsOption);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('allows adding popular skills by clicking buttons', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      renderSkillsStep({ onUpdate: mockOnUpdate });

      const jsButton = screen.getByText('+ JavaScript');
      await user.click(jsButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('hides popular skills section when 5+ skills are added', () => {
      const skillsData = {
        skills: Array.from({ length: 6 }, (_, i) => ({
          name: `Skill ${i}`,
          category: 'technical',
          proficiency: 'intermediate'
        }))
      };
      
      renderSkillsStep({ data: skillsData });
      
      expect(screen.queryByText('Popular Skills')).not.toBeInTheDocument();
    });

    it('prevents adding duplicate skills', async () => {
      const user = userEvent.setup();
      const skillsData = {
        skills: [{ name: 'JavaScript', category: 'technical', proficiency: 'intermediate' }]
      };
      
      renderSkillsStep({ data: skillsData });
      
      const jsButton = screen.queryByText('+ JavaScript');
      expect(jsButton).not.toBeInTheDocument();
    });
  });

  describe('Skills Categorization', () => {
    it('displays skills in their assigned categories', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'advanced' },
          { name: 'Leadership', category: 'leadership', proficiency: 'intermediate' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      // Check that skills appear in their respective category sections
      const technicalSection = screen.getByText('Technical Skills').closest('.category-zone');
      const leadershipSection = screen.getByText('Leadership').closest('.category-zone');
      
      expect(technicalSection).toContainElement(screen.getByText('JavaScript'));
      expect(leadershipSection).toContainElement(screen.getByText('Leadership'));
    });

    it('allows updating skill proficiency', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const skillsData = {
        skills: [{ name: 'JavaScript', category: 'technical', proficiency: 'intermediate' }]
      };
      
      renderSkillsStep({ data: skillsData, onUpdate: mockOnUpdate });
      
      const proficiencySelect = screen.getByDisplayValue('intermediate');
      await user.selectOptions(proficiencySelect, 'advanced');
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('allows removing skills', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      const skillsData = {
        skills: [{ name: 'JavaScript', category: 'technical', proficiency: 'intermediate' }]
      };
      
      renderSkillsStep({ data: skillsData, onUpdate: mockOnUpdate });
      
      const removeButton = screen.getByLabelText('Remove JavaScript');
      await user.click(removeButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Skills Summary', () => {
    it('displays skills summary when skills are present', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'advanced' },
          { name: 'Leadership', category: 'leadership', proficiency: 'intermediate' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      expect(screen.getByText('Your Skills Summary')).toBeInTheDocument();
      expect(screen.getByText('JavaScript (advanced)')).toBeInTheDocument();
      expect(screen.getByText('Leadership (intermediate)')).toBeInTheDocument();
    });

    it('groups skills by category in summary', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'advanced' },
          { name: 'Python', category: 'technical', proficiency: 'intermediate' },
          { name: 'Leadership', category: 'leadership', proficiency: 'expert' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      const technicalSummary = screen.getByText('Technical').closest('.summary-category');
      const leadershipSummary = screen.getByText('Leadership').closest('.summary-category');
      
      expect(technicalSummary).toContainElement(screen.getByText('JavaScript (advanced)'));
      expect(technicalSummary).toContainElement(screen.getByText('Python (intermediate)'));
      expect(leadershipSummary).toContainElement(screen.getByText('Leadership (expert)'));
    });
  });

  describe('Form Validation', () => {
    it('shows validation message when less than 3 skills', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'intermediate' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      expect(screen.getByText(/Please add at least 3 skills to continue/)).toBeInTheDocument();
      expect(screen.getByText('You have 1 skill.')).toBeInTheDocument();
    });

    it('enables continue button when 3+ skills are added', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'intermediate' },
          { name: 'Python', category: 'technical', proficiency: 'advanced' },
          { name: 'Leadership', category: 'leadership', proficiency: 'expert' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it('does not show validation message when 3+ skills present', () => {
      const skillsData = {
        skills: Array.from({ length: 3 }, (_, i) => ({
          name: `Skill ${i}`,
          category: 'technical',
          proficiency: 'intermediate'
        }))
      };
      
      renderSkillsStep({ data: skillsData });
      
      expect(screen.queryByText(/Please add at least 3 skills to continue/)).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('calls onComplete with skills data when form is submitted', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'intermediate' },
          { name: 'Python', category: 'technical', proficiency: 'advanced' },
          { name: 'Leadership', category: 'leadership', proficiency: 'expert' }
        ]
      };
      
      renderSkillsStep({ data: skillsData, onComplete: mockOnComplete });
      
      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith({
        skills: expect.arrayContaining([
          expect.objectContaining({
            name: 'JavaScript',
            category: 'technical',
            proficiency: 'intermediate'
          }),
          expect.objectContaining({
            name: 'Python',
            category: 'technical',
            proficiency: 'advanced'
          }),
          expect.objectContaining({
            name: 'Leadership',
            category: 'leadership',
            proficiency: 'expert'
          })
        ])
      });
    });

    it('does not submit when validation fails', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'intermediate' }
        ]
      };
      
      renderSkillsStep({ data: skillsData, onComplete: mockOnComplete });
      
      const submitButton = screen.getByRole('button', { name: /continue/i });
      await user.click(submitButton);
      
      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('calls onPrevious when previous button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnPrevious = jest.fn();
      
      renderSkillsStep({ onPrevious: mockOnPrevious });
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);
      
      expect(mockOnPrevious).toHaveBeenCalled();
    });

    it('shows and calls onSkip when skipping is enabled', async () => {
      const user = userEvent.setup();
      const mockOnSkip = jest.fn();
      
      renderSkillsStep({ canSkip: true, onSkip: mockOnSkip });
      
      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      expect(skipButton).toBeInTheDocument();
      
      await user.click(skipButton);
      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('does not show skip button when skipping is disabled', () => {
      renderSkillsStep({ canSkip: false });
      
      const skipButton = screen.queryByRole('button', { name: /skip for now/i });
      expect(skipButton).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('disables form elements when loading', () => {
      renderSkillsStep({ isLoading: true });
      
      const continueButton = screen.getByRole('button', { name: /saving.../i });
      expect(continueButton).toBeDisabled();
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('displays error message when error is provided', () => {
      const errorMessage = 'Failed to save skills';
      renderSkillsStep({ error: errorMessage });
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('shows loading state in skills search', async () => {
      const user = userEvent.setup();
      renderSkillsStep();
      
      const searchInput = screen.getByTestId('skills-select-input');
      await user.type(searchInput, 'test');
      
      // Note: This would need to be implemented in the actual component
      // to show loading state during search
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for skill removal buttons', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'intermediate' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      const removeButton = screen.getByLabelText('Remove JavaScript');
      expect(removeButton).toBeInTheDocument();
    });

    it('has proper form labels and associations', () => {
      renderSkillsStep();
      
      // Check for proper labeling of proficiency selects would be added here
      // when skills are present
    });
  });

  describe('Data Persistence', () => {
    it('calls onUpdate when skills data changes', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      
      renderSkillsStep({ onUpdate: mockOnUpdate });
      
      // Simulate adding a skill (this would trigger onUpdate)
      const jsButton = screen.getByText('+ JavaScript');
      await user.click(jsButton);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('maintains skill data across re-renders', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical', proficiency: 'advanced' }
        ]
      };
      
      const { rerender } = renderSkillsStep({ data: skillsData });
      
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      
      rerender(
        <DnDTestProvider>
          <SkillsStep data={skillsData} onUpdate={jest.fn()} onComplete={jest.fn()} />
        </DnDTestProvider>
      );
      
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty skills array gracefully', () => {
      renderSkillsStep({ data: { skills: [] } });
      
      expect(screen.getByText('Add some skills above to start organizing them into categories.')).toBeInTheDocument();
    });

    it('handles missing data prop gracefully', () => {
      renderSkillsStep({ data: undefined });
      
      expect(screen.getByText('Add Your Skills')).toBeInTheDocument();
    });

    it('handles skills without proficiency set', () => {
      const skillsData = {
        skills: [
          { name: 'JavaScript', category: 'technical' }
        ]
      };
      
      renderSkillsStep({ data: skillsData });
      
      // Should default to intermediate proficiency
      expect(screen.getByDisplayValue('intermediate')).toBeInTheDocument();
    });
  });
});