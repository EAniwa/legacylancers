/**
 * OnboardingWizard Component
 * Core wizard framework with step management, routing, and progress tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOnboardingState } from '../../hooks/useOnboardingState';
import StepIndicator from './StepIndicator';
import './OnboardingWizard.css';

const ONBOARDING_STEPS = [
  {
    id: 'personal-info',
    title: 'Personal Information & Photo',
    description: 'Tell us about yourself and add a professional photo',
    path: '/onboarding/personal-info',
    component: null, // Will be provided by Stream B
    required: true,
    estimated_time: '5 minutes'
  },
  {
    id: 'skills',
    title: 'Skills & Categorization',
    description: 'Add your professional skills and expertise areas',
    path: '/onboarding/skills',
    component: null, // Will be provided by Stream C
    required: true,
    estimated_time: '10 minutes'
  },
  {
    id: 'experience',
    title: 'Experience & Background',
    description: 'Share your work history and professional experience',
    path: '/onboarding/experience',
    component: null, // Will be provided by Stream D
    required: true,
    estimated_time: '15 minutes'
  },
  {
    id: 'availability',
    title: 'Availability & Rates',
    description: 'Set your availability and compensation preferences',
    path: '/onboarding/availability',
    component: null, // Will be provided by Stream D
    required: true,
    estimated_time: '8 minutes'
  },
  {
    id: 'review',
    title: 'Review & Complete',
    description: 'Review your profile and complete onboarding',
    path: '/onboarding/review',
    component: null, // Will be provided by this stream
    required: true,
    estimated_time: '5 minutes'
  }
];

export default function OnboardingWizard({ 
  stepComponents = {},
  onComplete,
  onExit,
  className = '',
  autoSave = true,
  enableSkipping = false,
  customSteps = null
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStepParam = searchParams.get('step');
  
  const steps = customSteps || ONBOARDING_STEPS;
  
  // Find current step index
  const getCurrentStepIndex = useCallback(() => {
    if (!currentStepParam) return 0;
    const index = steps.findIndex(step => step.id === currentStepParam);
    return index >= 0 ? index : 0;
  }, [currentStepParam, steps]);

  const [currentStepIndex, setCurrentStepIndex] = useState(getCurrentStepIndex());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize onboarding state management
  const {
    data,
    isLoaded,
    isDirty,
    progress,
    updateStepData,
    completeStep,
    saveProgress,
    resetOnboarding,
    getStepData,
    isStepCompleted,
    canProceedToStep,
    autoSaveEnabled
  } = useOnboardingState({
    steps,
    autoSave,
    userId: null // Will be set from authentication context
  });

  const currentStep = steps[currentStepIndex];

  // Sync URL with current step
  useEffect(() => {
    const urlStepIndex = getCurrentStepIndex();
    if (urlStepIndex !== currentStepIndex) {
      setCurrentStepIndex(urlStepIndex);
    }
  }, [currentStepParam, getCurrentStepIndex, currentStepIndex]);

  // Update URL when step changes
  const updateURL = useCallback((stepIndex) => {
    const step = steps[stepIndex];
    if (step) {
      setSearchParams({ step: step.id });
    }
  }, [steps, setSearchParams]);

  // Navigation functions
  const goToStep = useCallback(async (stepIndex, force = false) => {
    if (stepIndex < 0 || stepIndex >= steps.length) return;

    const targetStep = steps[stepIndex];
    
    // Check if user can proceed to this step
    if (!force && !canProceedToStep(targetStep.id)) {
      setError(`Please complete previous steps before proceeding to ${targetStep.title}`);
      return;
    }

    setError(null);
    setCurrentStepIndex(stepIndex);
    updateURL(stepIndex);
  }, [steps, canProceedToStep, updateURL]);

  const goToNextStep = useCallback(async () => {
    if (currentStepIndex < steps.length - 1) {
      await goToStep(currentStepIndex + 1);
    } else {
      // Last step - complete onboarding
      await handleComplete();
    }
  }, [currentStepIndex, steps.length, goToStep]);

  const goToPreviousStep = useCallback(async () => {
    if (currentStepIndex > 0) {
      await goToStep(currentStepIndex - 1, true); // Allow going back
    }
  }, [currentStepIndex, goToStep]);

  // Step completion handling
  const handleStepComplete = useCallback(async (stepData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update step data
      await updateStepData(currentStep.id, stepData);
      
      // Mark step as completed
      await completeStep(currentStep.id);

      // Auto-advance to next step
      if (currentStepIndex < steps.length - 1) {
        setTimeout(() => goToNextStep(), 500); // Small delay for UX
      } else {
        await handleComplete();
      }
    } catch (error) {
      console.error('Error completing step:', error);
      setError('Failed to save progress. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentStep, currentStepIndex, steps.length, updateStepData, completeStep, goToNextStep]);

  // Onboarding completion
  const handleComplete = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate all required steps are completed
      const incompleteSteps = steps.filter(step => 
        step.required && !isStepCompleted(step.id)
      );

      if (incompleteSteps.length > 0) {
        throw new Error(`Please complete these required steps: ${incompleteSteps.map(s => s.title).join(', ')}`);
      }

      // Final save
      await saveProgress();

      // Call completion handler
      if (onComplete) {
        await onComplete(data, progress);
      }

      // Redirect to profile or dashboard
      navigate('/profile/complete', { replace: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError(error.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [steps, isStepCompleted, saveProgress, onComplete, data, progress, navigate]);

  // Exit handling
  const handleExit = useCallback(async () => {
    const shouldSave = isDirty && window.confirm(
      'You have unsaved changes. Would you like to save your progress before exiting?'
    );

    if (shouldSave) {
      await saveProgress();
    }

    if (onExit) {
      onExit(data, progress);
    } else {
      navigate('/dashboard');
    }
  }, [isDirty, saveProgress, onExit, data, progress, navigate]);

  // Skip step (if enabled)
  const handleSkipStep = useCallback(async () => {
    if (!enableSkipping || currentStep.required) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to skip "${currentStep.title}"? You can complete it later from your profile.`
    );
    
    if (confirmed) {
      await goToNextStep();
    }
  }, [enableSkipping, currentStep, goToNextStep]);

  // Auto-save handling
  useEffect(() => {
    let saveInterval;
    
    if (autoSaveEnabled && isDirty) {
      saveInterval = setInterval(async () => {
        try {
          await saveProgress();
        } catch (error) {
          console.warn('Auto-save failed:', error);
        }
      }, 30000); // Save every 30 seconds
    }
    
    return () => {
      if (saveInterval) clearInterval(saveInterval);
    };
  }, [autoSaveEnabled, isDirty, saveProgress]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="onboarding-wizard loading">
        <div className="loading-spinner"></div>
        <p>Loading your onboarding progress...</p>
      </div>
    );
  }

  // Get current step component
  const StepComponent = stepComponents[currentStep.id];

  return (
    <div className={`onboarding-wizard ${className}`}>
      {/* Header */}
      <header className="wizard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Complete Your Profile</h1>
            <p className="subtitle">
              Step {currentStepIndex + 1} of {steps.length}: {currentStep.title}
            </p>
          </div>
          <div className="header-right">
            <button 
              type="button"
              className="exit-button"
              onClick={handleExit}
              disabled={isLoading}
            >
              Save & Exit
            </button>
          </div>
        </div>
        
        {/* Progress Indicator */}
        <StepIndicator
          steps={steps}
          currentStepIndex={currentStepIndex}
          completedSteps={steps.filter(step => isStepCompleted(step.id))}
          onStepClick={goToStep}
          showLabels={true}
          className="wizard-progress"
        />
      </header>

      {/* Main Content */}
      <main className="wizard-content">
        {/* Error Display */}
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button 
              type="button"
              className="dismiss-error"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Auto-save Indicator */}
        {autoSaveEnabled && isDirty && (
          <div className="autosave-indicator">
            <span className="saving-icon">💾</span>
            <span>Changes will be saved automatically</span>
          </div>
        )}

        {/* Step Description */}
        <div className="step-info">
          <h2>{currentStep.title}</h2>
          <p className="step-description">{currentStep.description}</p>
          {currentStep.estimated_time && (
            <span className="estimated-time">
              ⏱️ Estimated time: {currentStep.estimated_time}
            </span>
          )}
        </div>

        {/* Step Content */}
        <div className="step-content">
          {StepComponent ? (
            <StepComponent
              data={getStepData(currentStep.id)}
              onUpdate={(data) => updateStepData(currentStep.id, data)}
              onComplete={handleStepComplete}
              onNext={goToNextStep}
              onPrevious={goToPreviousStep}
              isLoading={isLoading}
              error={error}
              canSkip={enableSkipping && !currentStep.required}
              onSkip={handleSkipStep}
            />
          ) : (
            <div className="step-placeholder">
              <div className="placeholder-content">
                <h3>Step Content Coming Soon</h3>
                <p>The component for "{currentStep.title}" will be implemented by other development streams.</p>
                <div className="placeholder-actions">
                  {currentStepIndex > 0 && (
                    <button 
                      type="button"
                      className="button secondary"
                      onClick={goToPreviousStep}
                      disabled={isLoading}
                    >
                      Previous
                    </button>
                  )}
                  <button 
                    type="button"
                    className="button primary"
                    onClick={goToNextStep}
                    disabled={isLoading}
                  >
                    {currentStepIndex === steps.length - 1 ? 'Complete' : 'Continue'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="wizard-footer">
        <div className="footer-content">
          <div className="footer-left">
            <span className="progress-text">
              {Math.round(progress.overall * 100)}% Complete
            </span>
          </div>
          <div className="footer-right">
            {currentStepIndex > 0 && (
              <button 
                type="button"
                className="button secondary"
                onClick={goToPreviousStep}
                disabled={isLoading}
              >
                Previous
              </button>
            )}
            {enableSkipping && !currentStep.required && (
              <button 
                type="button"
                className="button ghost"
                onClick={handleSkipStep}
                disabled={isLoading}
              >
                Skip for Now
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Saving your progress...</p>
        </div>
      )}
    </div>
  );
}

export { ONBOARDING_STEPS };