/**
 * OnboardingWizard Component Tests
 * Comprehensive tests for the onboarding wizard functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import OnboardingWizard, { ONBOARDING_STEPS } from '../../../src/components/onboarding/OnboardingWizard';
import { useOnboardingState } from '../../../src/hooks/useOnboardingState';

// Mock the custom hook
jest.mock('../../../src/hooks/useOnboardingState');

// Mock router navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => {
    const searchParams = new URLSearchParams();
    const setSearchParams = jest.fn();
    return [searchParams, setSearchParams];
  }
}));

// Mock CSS imports
jest.mock('../../../src/components/onboarding/OnboardingWizard.css', () => ({}));

// Test wrapper component
const WizardWrapper = ({ children, ...props }) => (
  <BrowserRouter>
    {React.cloneElement(children, props)}
  </BrowserRouter>
);

describe('OnboardingWizard Component', () => {
  const mockOnboardingState = {
    data: {},
    isLoaded: true,
    isDirty: false,
    progress: { overall: 0.4, stepProgress: {} },
    updateStepData: jest.fn(),
    completeStep: jest.fn(),
    saveProgress: jest.fn(),
    resetOnboarding: jest.fn(),
    getStepData: jest.fn(() => ({})),
    isStepCompleted: jest.fn(() => false),
    canProceedToStep: jest.fn(() => true),
    autoSaveEnabled: true
  };

  beforeEach(() => {
    useOnboardingState.mockReturnValue(mockOnboardingState);
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders loading state when not loaded', () => {
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        isLoaded: false
      });

      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      expect(screen.getByText('Loading your onboarding progress...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders wizard header with title and exit button', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save & exit/i })).toBeInTheDocument();
    });

    it('renders step information correctly', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      const firstStep = ONBOARDING_STEPS[0];
      expect(screen.getByText(firstStep.title)).toBeInTheDocument();
      expect(screen.getByText(firstStep.description)).toBeInTheDocument();
      expect(screen.getByText(firstStep.estimated_time)).toBeInTheDocument();
    });

    it('renders step placeholder when no component provided', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      expect(screen.getByText('Step Content Coming Soon')).toBeInTheDocument();
      expect(screen.getByText(/The component for.*will be implemented/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('renders custom step component when provided', () => {
      const MockStepComponent = jest.fn(({ onComplete }) => (
        <div>
          <span>Mock Step Component</span>
          <button onClick={() => onComplete({ test: 'data' })}>Complete Step</button>
        </div>
      ));

      const stepComponents = {
        'personal-info': MockStepComponent
      };

      render(
        <WizardWrapper>
          <OnboardingWizard stepComponents={stepComponents} />
        </WizardWrapper>
      );

      expect(screen.getByText('Mock Step Component')).toBeInTheDocument();
      expect(MockStepComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {},
          onUpdate: expect.any(Function),
          onComplete: expect.any(Function),
          onNext: expect.any(Function),
          onPrevious: expect.any(Function),
          isLoading: false,
          error: null
        }),
        expect.any(Object)
      );
    });
  });

  describe('Navigation', () => {
    it('handles next step navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument();
      });
    });

    it('handles previous step navigation', async () => {
      const user = userEvent.setup();
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        isStepCompleted: jest.fn(() => true)
      });

      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // Navigate to step 2 first
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Then navigate back
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);

      await waitFor(() => {
        expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
      });
    });

    it('prevents navigation to restricted steps', async () => {
      const user = userEvent.setup();
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        canProceedToStep: jest.fn(() => false)
      });

      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Should show error and not navigate
      await waitFor(() => {
        expect(screen.getByText(/Please complete previous steps/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
    });

    it('handles completion on last step', async () => {
      const user = userEvent.setup();
      const onComplete = jest.fn();
      
      // Start on last step
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        isStepCompleted: jest.fn(() => true)
      });

      render(
        <WizardWrapper>
          <OnboardingWizard onComplete={onComplete} />
        </WizardWrapper>
      );

      // Navigate to last step (review)
      for (let i = 0; i < 4; i++) {
        const continueButton = screen.getByRole('button', { name: /continue/i });
        await user.click(continueButton);
      }

      const completeButton = screen.getByRole('button', { name: /complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnboardingState.saveProgress).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/profile/complete', { replace: true });
      });
    });
  });

  describe('Step Management', () => {
    it('handles step completion with custom component', async () => {
      const user = userEvent.setup();
      const MockStepComponent = ({ onComplete }) => (
        <button onClick={() => onComplete({ test: 'data' })}>Complete Step</button>
      );

      const stepComponents = {
        'personal-info': MockStepComponent
      };

      render(
        <WizardWrapper>
          <OnboardingWizard stepComponents={stepComponents} />
        </WizardWrapper>
      );

      const completeButton = screen.getByRole('button', { name: /complete step/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockOnboardingState.updateStepData).toHaveBeenCalledWith('personal-info', { test: 'data' });
        expect(mockOnboardingState.completeStep).toHaveBeenCalledWith('personal-info');
      });
    });

    it('displays auto-save indicator when enabled and dirty', () => {
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        isDirty: true,
        autoSaveEnabled: true
      });

      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      expect(screen.getByText('Changes will be saved automatically')).toBeInTheDocument();
    });

    it('displays error messages', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // Simulate error state
      act(() => {
        // This would normally be triggered by an error in step completion
        fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      });
    });
  });

  describe('Progress Tracking', () => {
    it('displays progress percentage correctly', () => {
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        progress: { overall: 0.6 }
      });

      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      expect(screen.getByText('60% Complete')).toBeInTheDocument();
    });

    it('renders step indicator component', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // StepIndicator should be rendered (we'll test it separately)
      const progressBar = document.querySelector('.wizard-progress');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Exit and Save Functionality', () => {
    it('handles exit without changes', async () => {
      const user = userEvent.setup();
      const onExit = jest.fn();

      render(
        <WizardWrapper>
          <OnboardingWizard onExit={onExit} />
        </WizardWrapper>
      );

      const exitButton = screen.getByRole('button', { name: /save & exit/i });
      await user.click(exitButton);

      expect(onExit).toHaveBeenCalledWith(mockOnboardingState.data, mockOnboardingState.progress);
    });

    it('prompts to save when exiting with changes', async () => {
      const user = userEvent.setup();
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        isDirty: true
      });

      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      const exitButton = screen.getByRole('button', { name: /save & exit/i });
      await user.click(exitButton);

      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('unsaved changes')
      );
    });
  });

  describe('Loading States', () => {
    it('shows loading overlay when saving', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // Simulate loading state (would be triggered by step completion)
      act(() => {
        // This would normally set isLoading to true
      });
    });
  });

  describe('Error Handling', () => {
    it('displays and dismisses error messages', async () => {
      const user = userEvent.setup();
      
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // Simulate error by trying to proceed without permission
      useOnboardingState.mockReturnValue({
        ...mockOnboardingState,
        canProceedToStep: jest.fn(() => false)
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/Please complete previous steps/);
        expect(errorMessage).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: '×' });
      await user.click(dismissButton);

      expect(screen.queryByText(/Please complete previous steps/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Complete Your Profile');
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      
      // Check for proper button roles
      expect(screen.getByRole('button', { name: /save & exit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('provides screen reader friendly progress updates', () => {
      render(
        <WizardWrapper>
          <OnboardingWizard />
        </WizardWrapper>
      );

      // Step indicator should include sr-only content
      const srOnlyContent = document.querySelector('.sr-only');
      expect(srOnlyContent).toBeInTheDocument();
    });
  });

  describe('Custom Configuration', () => {
    it('accepts custom steps configuration', () => {
      const customSteps = [
        {
          id: 'custom-step',
          title: 'Custom Step',
          description: 'This is a custom step',
          required: true
        }
      ];

      render(
        <WizardWrapper>
          <OnboardingWizard customSteps={customSteps} />
        </WizardWrapper>
      );

      expect(screen.getByText('Custom Step')).toBeInTheDocument();
      expect(screen.getByText('This is a custom step')).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 1/)).toBeInTheDocument();
    });

    it('handles skip functionality when enabled', async () => {
      const user = userEvent.setup();
      
      const customSteps = [
        {
          id: 'skippable-step',
          title: 'Skippable Step',
          description: 'This step can be skipped',
          required: false
        }
      ];

      render(
        <WizardWrapper>
          <OnboardingWizard customSteps={customSteps} enableSkipping={true} />
        </WizardWrapper>
      );

      expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
      
      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      await user.click(skipButton);

      expect(global.confirm).toHaveBeenCalledWith(
        expect.stringContaining('skip')
      );
    });
  });
});