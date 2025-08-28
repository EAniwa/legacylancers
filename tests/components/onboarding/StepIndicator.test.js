/**
 * StepIndicator Component Tests
 * Comprehensive tests for step indicator progress tracking
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StepIndicator, { MobileStepIndicator, CompactStepIndicator } from '../../../src/components/onboarding/StepIndicator';

// Mock CSS imports
jest.mock('../../../src/components/onboarding/StepIndicator.css', () => ({}));

const mockSteps = [
  {
    id: 'step-1',
    title: 'Personal Info',
    description: 'Add your personal information',
    required: true,
    estimated_time: '5 minutes'
  },
  {
    id: 'step-2',
    title: 'Skills',
    description: 'List your skills',
    required: true,
    estimated_time: '10 minutes'
  },
  {
    id: 'step-3',
    title: 'Experience',
    description: 'Add work experience',
    required: false,
    estimated_time: '15 minutes'
  },
  {
    id: 'step-4',
    title: 'Review',
    description: 'Review and complete',
    required: true,
    estimated_time: '5 minutes'
  }
];

describe('StepIndicator Component', () => {
  const defaultProps = {
    steps: mockSteps,
    currentStepIndex: 0,
    completedSteps: [],
    onStepClick: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders all steps', () => {
      render(<StepIndicator {...defaultProps} />);

      mockSteps.forEach(step => {
        expect(screen.getByTitle(step.title)).toBeInTheDocument();
      });
    });

    it('renders step numbers correctly', () => {
      render(<StepIndicator {...defaultProps} />);

      // Check that step numbers 1-4 are rendered
      for (let i = 1; i <= 4; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument();
      }
    });

    it('renders with proper ARIA attributes', () => {
      render(<StepIndicator {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
      expect(progressBar).toHaveAttribute('aria-valuemin', '1');
      expect(progressBar).toHaveAttribute('aria-valuemax', '4');
    });
  });

  describe('Step States', () => {
    it('shows current step correctly', () => {
      render(<StepIndicator {...defaultProps} currentStepIndex={1} />);

      const currentStepMarker = screen.getByText('2').closest('.step-marker');
      expect(currentStepMarker).toHaveClass('current');
    });

    it('shows completed steps with checkmarks', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          currentStepIndex={2}
          completedSteps={['step-1', 'step-2']}
        />
      );

      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks).toHaveLength(2);
    });

    it('shows upcoming steps as disabled', () => {
      render(<StepIndicator {...defaultProps} currentStepIndex={1} />);

      const upcomingStepMarker = screen.getByText('4').closest('.step-marker');
      expect(upcomingStepMarker).toHaveClass('upcoming');
    });

    it('shows accessible steps for completed/current steps', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          currentStepIndex={2}
          completedSteps={['step-1']}
        />
      );

      const accessibleStepMarker = screen.getByText('1').closest('.step-marker');
      expect(accessibleStepMarker).toHaveClass('completed');
    });
  });

  describe('Required Step Indicators', () => {
    it('shows required indicators for required steps', () => {
      render(<StepIndicator {...defaultProps} />);

      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators.length).toBeGreaterThan(0);
    });

    it('shows required badges when labels are shown', () => {
      render(<StepIndicator {...defaultProps} showLabels={true} />);

      const requiredBadges = screen.getAllByText('Required');
      expect(requiredBadges.length).toBe(3); // 3 required steps
    });
  });

  describe('Labels and Descriptions', () => {
    it('shows labels when showLabels is true', () => {
      render(<StepIndicator {...defaultProps} showLabels={true} />);

      mockSteps.forEach(step => {
        expect(screen.getByText(step.title)).toBeInTheDocument();
      });
    });

    it('hides labels when showLabels is false', () => {
      render(<StepIndicator {...defaultProps} showLabels={false} />);

      mockSteps.forEach(step => {
        expect(screen.queryByText(step.title)).not.toBeInTheDocument();
      });
    });

    it('shows descriptions in detailed variant', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          showLabels={true} 
          variant="detailed"
        />
      );

      mockSteps.forEach(step => {
        expect(screen.getByText(step.description)).toBeInTheDocument();
      });
    });

    it('shows estimated time in detailed variant', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          showLabels={true} 
          variant="detailed"
        />
      );

      mockSteps.forEach(step => {
        expect(screen.getByText(`⏱️ ${step.estimated_time}`)).toBeInTheDocument();
      });
    });
  });

  describe('Variants', () => {
    it('renders minimal variant with progress bar', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          variant="minimal"
          completedSteps={['step-1', 'step-2']}
        />
      );

      expect(screen.getByText('50% Complete (2/4 steps)')).toBeInTheDocument();
      
      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    it('renders detailed variant with summary stats', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          variant="detailed"
          completedSteps={['step-1']}
          currentStepIndex={1}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument(); // Completed count
      expect(screen.getByText('3')).toBeInTheDocument(); // Remaining count
      expect(screen.getByText('25%')).toBeInTheDocument(); // Progress percentage
    });
  });

  describe('Orientation', () => {
    it('renders horizontal orientation by default', () => {
      const { container } = render(<StepIndicator {...defaultProps} />);
      
      const indicator = container.querySelector('.step-indicator');
      expect(indicator).toHaveClass('horizontal');
    });

    it('renders vertical orientation when specified', () => {
      const { container } = render(
        <StepIndicator {...defaultProps} orientation="vertical" />
      );
      
      const indicator = container.querySelector('.step-indicator');
      expect(indicator).toHaveClass('vertical');
    });
  });

  describe('Interaction', () => {
    it('calls onStepClick when step is clicked', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(
        <StepIndicator 
          {...defaultProps} 
          onStepClick={onStepClick}
          completedSteps={['step-1']}
          currentStepIndex={1}
        />
      );

      // Click on the first (completed) step
      const firstStepMarker = screen.getByText('✓').closest('.step-marker');
      await user.click(firstStepMarker);

      expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it('does not call onStepClick for upcoming steps', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(
        <StepIndicator 
          {...defaultProps} 
          onStepClick={onStepClick}
          currentStepIndex={1}
        />
      );

      // Try to click on an upcoming step (step 4)
      const upcomingStepMarker = screen.getByText('4').closest('.step-marker');
      await user.click(upcomingStepMarker);

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(
        <StepIndicator 
          {...defaultProps} 
          onStepClick={onStepClick}
          completedSteps={['step-1']}
          currentStepIndex={1}
        />
      );

      const firstStepMarker = screen.getByText('✓').closest('.step-marker');
      firstStepMarker.focus();
      await user.keyboard('{Enter}');

      expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it('does not respond to clicks when disabled', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(
        <StepIndicator 
          {...defaultProps} 
          onStepClick={onStepClick}
          disabled={true}
        />
      );

      const currentStepMarker = screen.getByText('1').closest('.step-marker');
      await user.click(currentStepMarker);

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('does not respond to clicks when allowClickableSteps is false', async () => {
      const user = userEvent.setup();
      const onStepClick = jest.fn();

      render(
        <StepIndicator 
          {...defaultProps} 
          onStepClick={onStepClick}
          allowClickableSteps={false}
        />
      );

      const currentStepMarker = screen.getByText('1').closest('.step-marker');
      await user.click(currentStepMarker);

      expect(onStepClick).not.toHaveBeenCalled();
    });
  });

  describe('Progress Calculation', () => {
    it('calculates progress percentage correctly', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          variant="minimal"
          completedSteps={['step-1', 'step-2', 'step-3']}
        />
      );

      expect(screen.getByText('75% Complete (3/4 steps)')).toBeInTheDocument();
    });

    it('handles empty completed steps', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          variant="minimal"
          completedSteps={[]}
        />
      );

      expect(screen.getByText('0% Complete (0/4 steps)')).toBeInTheDocument();
    });

    it('handles all steps completed', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          variant="minimal"
          completedSteps={['step-1', 'step-2', 'step-3', 'step-4']}
        />
      );

      expect(screen.getByText('100% Complete (4/4 steps)')).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('provides screen reader content', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          completedSteps={['step-1']}
          currentStepIndex={1}
        />
      );

      const srContent = document.querySelector('.sr-only');
      expect(srContent).toHaveTextContent(/Currently on step 2 of 4/);
      expect(srContent).toHaveTextContent(/1 steps completed/);
    });

    it('has proper focus management', () => {
      render(
        <StepIndicator 
          {...defaultProps} 
          completedSteps={['step-1']}
        />
      );

      const clickableMarker = screen.getByText('✓').closest('.step-marker');
      expect(clickableMarker).toHaveAttribute('tabIndex', '0');
      expect(clickableMarker).toHaveAttribute('role', 'button');
    });

    it('provides proper titles for tooltips', () => {
      render(<StepIndicator {...defaultProps} />);

      mockSteps.forEach(step => {
        const marker = screen.getByTitle(step.title);
        expect(marker).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles empty steps array', () => {
      render(<StepIndicator {...defaultProps} steps={[]} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemax', '0');
    });

    it('handles invalid currentStepIndex', () => {
      render(<StepIndicator {...defaultProps} currentStepIndex={10} />);

      // Should not crash and should handle gracefully
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });
});

describe('MobileStepIndicator Component', () => {
  const props = {
    steps: mockSteps,
    currentStepIndex: 1,
    completedSteps: ['step-1']
  };

  it('renders mobile-optimized indicator', () => {
    render(<MobileStepIndicator {...props} />);

    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('shows progress bar', () => {
    const { container } = render(<MobileStepIndicator {...props} />);
    
    const progressBar = container.querySelector('.progress-bar');
    expect(progressBar).toBeInTheDocument();
  });
});

describe('CompactStepIndicator Component', () => {
  const props = {
    steps: mockSteps,
    currentStepIndex: 1,
    completedSteps: ['step-1']
  };

  it('renders compact indicator with dots', () => {
    const { container } = render(<CompactStepIndicator {...props} />);
    
    const dots = container.querySelectorAll('.step-dot');
    expect(dots).toHaveLength(4);
  });

  it('shows correct progress percentage', () => {
    render(<CompactStepIndicator {...props} />);

    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('applies correct classes to dots', () => {
    const { container } = render(<CompactStepIndicator {...props} />);
    
    const dots = container.querySelectorAll('.step-dot');
    expect(dots[0]).toHaveClass('completed');
    expect(dots[1]).toHaveClass('current');
    expect(dots[2]).not.toHaveClass('completed');
    expect(dots[3]).not.toHaveClass('completed');
  });
});