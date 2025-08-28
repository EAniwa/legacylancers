/**
 * Verification Progress Component
 * Shows the progress of LinkedIn verification process
 */

import React from 'react';
import './VerificationProgress.css';

export const VerificationProgress = ({ session, onRetry }) => {
  if (!session) {
    return (
      <div className="verification-progress">
        <div className="progress-placeholder">
          Loading verification status...
        </div>
      </div>
    );
  }

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '⏳';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭️';
      default:
        return '⏸️';
    }
  };

  const getStepClassName = (status) => {
    return `progress-step ${status}`;
  };

  return (
    <div className="verification-progress">
      <div className="progress-header">
        <h3>Verification Progress</h3>
        <div className="progress-summary">
          {session.progress.completedSteps} of {session.progress.totalSteps} steps completed
          ({session.progress.percentComplete || 0}%)
        </div>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${session.progress.percentComplete || 0}%` }}
          ></div>
        </div>
      </div>

      <div className="progress-steps">
        {session.progress.steps.map((step, index) => (
          <div key={step.name} className={getStepClassName(step.status)}>
            <div className="step-indicator">
              <span className="step-icon">{getStepIcon(step.status)}</span>
              <span className="step-number">{index + 1}</span>
            </div>
            <div className="step-content">
              <div className="step-title">{step.message}</div>
              {step.status === 'in_progress' && (
                <div className="step-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              {step.status === 'failed' && (
                <div className="step-error">
                  Failed - please try again
                </div>
              )}
              {step.updatedAt && (
                <div className="step-timestamp">
                  {new Date(step.updatedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {session.state === 'failed' && (
        <div className="progress-actions">
          <button 
            className="btn btn-primary"
            onClick={onRetry}
          >
            Retry Verification
          </button>
        </div>
      )}

      {session.errors && session.errors.length > 0 && (
        <div className="progress-errors">
          <h4>Errors:</h4>
          {session.errors.map((error, index) => (
            <div key={index} className="error-item">
              <span className="error-type">{error.type}:</span>
              <span className="error-message">{error.message}</span>
              {error.timestamp && (
                <span className="error-timestamp">
                  {new Date(error.timestamp).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {session.warnings && session.warnings.length > 0 && (
        <div className="progress-warnings">
          <h4>Warnings:</h4>
          {session.warnings.map((warning, index) => (
            <div key={index} className="warning-item">
              <span className="warning-type">{warning.type}:</span>
              <span className="warning-message">{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="progress-details">
        <div className="detail-item">
          <span className="detail-label">Session ID:</span>
          <span className="detail-value">{session.sessionId}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">State:</span>
          <span className={`detail-value state-${session.state}`}>{session.state}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Started:</span>
          <span className="detail-value">{new Date(session.createdAt).toLocaleString()}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Last Updated:</span>
          <span className="detail-value">{new Date(session.updatedAt).toLocaleString()}</span>
        </div>
        {session.expiresAt && (
          <div className="detail-item">
            <span className="detail-label">Expires:</span>
            <span className="detail-value">{new Date(session.expiresAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};