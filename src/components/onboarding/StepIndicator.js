/**
 * StepIndicator Component
 * Visual progress indicator showing completion status and step navigation
 */

import React from 'react';
import './StepIndicator.css';

export default function StepIndicator({
  steps = [],
  currentStepIndex = 0,
  completedSteps = [],
  onStepClick,
  showLabels = false,
  orientation = 'horizontal', // 'horizontal' or 'vertical'
  variant = 'default', // 'default', 'minimal', 'detailed'
  className = '',
  disabled = false,
  allowClickableSteps = true
}) {
  const completedStepIds = completedSteps.map(step => 
    typeof step === 'string' ? step : step.id
  );

  // Determine step status
  const getStepStatus = (step, index) => {
    if (completedStepIds.includes(step.id)) {
      return 'completed';
    }
    if (index === currentStepIndex) {
      return 'current';
    }
    if (index < currentStepIndex) {
      return 'accessible';
    }
    return 'upcoming';
  };

  // Handle step click
  const handleStepClick = (step, index) => {
    if (disabled || !allowClickableSteps || !onStepClick) return;
    
    const status = getStepStatus(step, index);
    
    // Only allow clicking on completed, current, or accessible steps
    if (status === 'upcoming') return;
    
    onStepClick(index);
  };

  // Calculate overall progress percentage
  const progressPercentage = steps.length > 0 
    ? ((completedSteps.length / steps.length) * 100)
    : 0;

  // Render step number/icon
  const renderStepMarker = (step, index, status) => {
    const isClickable = allowClickableSteps && !disabled && status !== 'upcoming';
    
    return (
      <div
        className={`step-marker ${status} ${isClickable ? 'clickable' : ''}`}
        onClick={() => handleStepClick(step, index)}
        role={isClickable ? 'button' : 'presentation'}
        tabIndex={isClickable ? 0 : -1}
        onKeyPress={(e) => {
          if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleStepClick(step, index);
          }
        }}
        title={isClickable ? `Go to ${step.title}` : step.title}
      >
        <div className="marker-content">
          {status === 'completed' ? (
            <span className="check-icon">✓</span>
          ) : status === 'current' ? (
            <div className="current-indicator">
              <span className="step-number">{index + 1}</span>
            </div>
          ) : (
            <span className="step-number">{index + 1}</span>
          )}
        </div>
        
        {step.required && (
          <span className="required-indicator" title="Required step">*</span>
        )}
      </div>
    );
  };

  // Render step label
  const renderStepLabel = (step, index, status) => {
    if (!showLabels) return null;

    const isClickable = allowClickableSteps && !disabled && status !== 'upcoming';

    return (
      <div
        className={`step-label ${status} ${isClickable ? 'clickable' : ''}`}
        onClick={() => handleStepClick(step, index)}
      >
        <div className="label-title">{step.title}</div>
        {variant === 'detailed' && step.description && (
          <div className="label-description">{step.description}</div>
        )}
        {variant === 'detailed' && step.estimated_time && (
          <div className="label-time">⏱️ {step.estimated_time}</div>
        )}
        {step.required && variant !== 'minimal' && (
          <span className="required-badge">Required</span>
        )}
      </div>
    );
  };

  // Render progress line between steps
  const renderProgressLine = (index, status, nextStatus) => {
    if (index === steps.length - 1) return null;

    const isCompleted = status === 'completed' || 
                       (status === 'current' && nextStatus !== 'upcoming');
    
    return (
      <div 
        className={`progress-line ${isCompleted ? 'completed' : 'incomplete'}`}
        style={{
          [orientation === 'horizontal' ? 'width' : 'height']: 
            orientation === 'horizontal' ? '100%' : '2rem'
        }}
      />
    );
  };

  return (
    <div 
      className={`step-indicator ${orientation} ${variant} ${className} ${disabled ? 'disabled' : ''}`}
      role="progressbar"
      aria-valuenow={currentStepIndex + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuetext={`Step ${currentStepIndex + 1} of ${steps.length}: ${steps[currentStepIndex]?.title || ''}`}
    >
      {/* Overall Progress Bar (for minimal variant) */}
      {variant === 'minimal' && (
        <div className="overall-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="progress-text">
            {Math.round(progressPercentage)}% Complete ({completedSteps.length}/{steps.length} steps)
          </div>
        </div>
      )}

      {/* Step List */}
      {variant !== 'minimal' && (
        <div className="steps-container">
          {steps.map((step, index) => {
            const status = getStepStatus(step, index);
            const nextStatus = index < steps.length - 1 
              ? getStepStatus(steps[index + 1], index + 1)
              : null;

            return (
              <div key={step.id} className="step-item">
                <div className="step-content">
                  {renderStepMarker(step, index, status)}
                  {renderStepLabel(step, index, status)}
                </div>
                {renderProgressLine(index, status, nextStatus)}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Information */}
      {variant === 'detailed' && (
        <div className="progress-summary">
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{completedSteps.length}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat">
              <span className="stat-value">{steps.length - completedSteps.length}</span>
              <span className="stat-label">Remaining</span>
            </div>
            <div className="stat">
              <span className="stat-value">{Math.round(progressPercentage)}%</span>
              <span className="stat-label">Progress</span>
            </div>
          </div>
          
          {steps[currentStepIndex]?.estimated_time && (
            <div className="current-step-info">
              <span>Current step: {steps[currentStepIndex].title}</span>
              <span>Est. time: {steps[currentStepIndex].estimated_time}</span>
            </div>
          )}
        </div>
      )}

      {/* Accessibility Information */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Currently on step {currentStepIndex + 1} of {steps.length}: {steps[currentStepIndex]?.title}.
        {completedSteps.length} steps completed.
        {steps.filter(s => s.required).length - completedSteps.filter(s => steps.find(st => st.id === (typeof s === 'string' ? s : s.id))?.required).length} required steps remaining.
      </div>
    </div>
  );
}

// Helper component for mobile-optimized step indicator
export function MobileStepIndicator({ 
  steps, 
  currentStepIndex, 
  completedSteps, 
  className = '' 
}) {
  const progressPercentage = steps.length > 0 
    ? (((currentStepIndex + 1) / steps.length) * 100)
    : 0;

  return (
    <div className={`mobile-step-indicator ${className}`}>
      <div className="mobile-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-info">
          <span className="step-counter">
            {currentStepIndex + 1} / {steps.length}
          </span>
          <span className="step-title">
            {steps[currentStepIndex]?.title}
          </span>
        </div>
      </div>
    </div>
  );
}

// Compact step indicator for headers/small spaces
export function CompactStepIndicator({ 
  steps, 
  currentStepIndex, 
  completedSteps, 
  className = '' 
}) {
  const progressPercentage = steps.length > 0 
    ? ((completedSteps.length / steps.length) * 100)
    : 0;

  return (
    <div className={`compact-step-indicator ${className}`}>
      <div className="compact-content">
        <div className="step-dots">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.some(cs => 
              (typeof cs === 'string' ? cs : cs.id) === step.id
            );
            const isCurrent = index === currentStepIndex;
            
            return (
              <div 
                key={step.id}
                className={`step-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                title={step.title}
              />
            );
          })}
        </div>
        <span className="progress-text">{Math.round(progressPercentage)}%</span>
      </div>
    </div>
  );
}