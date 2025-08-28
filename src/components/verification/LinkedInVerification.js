/**
 * LinkedIn Verification Component
 * Main component for handling LinkedIn profile import and verification
 */

import React, { useState, useEffect } from 'react';
import './LinkedInVerification.css';
import { VerificationProgress } from './VerificationProgress';
import { PrivacySettings } from './PrivacySettings';
import { SkillsMappingResults } from './SkillsMappingResults';
import { VerificationBadge } from './VerificationBadge';

export const LinkedInVerification = ({ 
  user, 
  onVerificationComplete, 
  onCancel,
  existingAccessToken = null 
}) => {
  const [currentStep, setCurrentStep] = useState('start');
  const [verificationSession, setVerificationSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [privacySettings, setPrivacySettings] = useState({
    privacyLevel: 'selective',
    importProfile: true,
    importSkills: true,
    importExperience: true,
    importEducation: true
  });

  const steps = [
    { key: 'start', title: 'Start Verification', icon: '🚀' },
    { key: 'privacy', title: 'Privacy Settings', icon: '🔒' },
    { key: 'import', title: 'Import Data', icon: '⬇️' },
    { key: 'mapping', title: 'Skills Mapping', icon: '🔗' },
    { key: 'review', title: 'Review & Confirm', icon: '✅' },
    { key: 'complete', title: 'Complete', icon: '🎉' }
  ];

  useEffect(() => {
    // Check if we have an existing verification session
    const savedSessionId = sessionStorage.getItem('linkedin_verification_session');
    if (savedSessionId) {
      resumeVerification(savedSessionId);
    }
  }, []);

  const startVerification = async () => {
    if (!existingAccessToken) {
      setError('LinkedIn access token is required. Please connect your LinkedIn account first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verification/linkedin/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          accessToken: existingAccessToken,
          options: privacySettings
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to start verification');
      }

      setVerificationSession(result.data);
      sessionStorage.setItem('linkedin_verification_session', result.data.sessionId);
      
      if (result.data.state === 'verified') {
        setCurrentStep('complete');
      } else {
        setCurrentStep('import');
        pollVerificationStatus(result.data.sessionId);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resumeVerification = async (sessionId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/verification/linkedin/status/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setVerificationSession(result.data);
        determineCurrentStep(result.data);
        
        if (result.data.state !== 'verified' && result.data.state !== 'failed') {
          pollVerificationStatus(sessionId);
        }
      } else {
        // Session not found or expired, clear it
        sessionStorage.removeItem('linkedin_verification_session');
      }
    } catch (err) {
      console.error('Failed to resume verification:', err);
      sessionStorage.removeItem('linkedin_verification_session');
    } finally {
      setIsLoading(false);
    }
  };

  const determineCurrentStep = (session) => {
    switch (session.state) {
      case 'pending':
        setCurrentStep('import');
        break;
      case 'in_progress':
        setCurrentStep('import');
        break;
      case 'data_imported':
        setCurrentStep('mapping');
        break;
      case 'skills_mapped':
        setCurrentStep('review');
        break;
      case 'verified':
        setCurrentStep('complete');
        break;
      case 'failed':
        setCurrentStep('start');
        break;
      default:
        setCurrentStep('start');
    }
  };

  const pollVerificationStatus = async (sessionId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/verification/linkedin/status/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        const result = await response.json();

        if (result.success) {
          setVerificationSession(result.data);
          
          if (result.data.state === 'verified') {
            clearInterval(pollInterval);
            setCurrentStep('complete');
            sessionStorage.removeItem('linkedin_verification_session');
            if (onVerificationComplete) {
              onVerificationComplete(result.data);
            }
          } else if (result.data.state === 'failed') {
            clearInterval(pollInterval);
            setError('Verification failed. Please try again.');
            setCurrentStep('start');
          } else {
            determineCurrentStep(result.data);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 5 * 60 * 1000);
  };

  const cancelVerification = async () => {
    if (verificationSession) {
      try {
        await fetch(`/api/verification/linkedin/cancel/${verificationSession.sessionId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      } catch (err) {
        console.error('Failed to cancel verification:', err);
      }
    }

    sessionStorage.removeItem('linkedin_verification_session');
    setVerificationSession(null);
    setCurrentStep('start');
    
    if (onCancel) {
      onCancel();
    }
  };

  const handlePrivacySettingsChange = (newSettings) => {
    setPrivacySettings(newSettings);
  };

  const proceedToNextStep = () => {
    const currentIndex = steps.findIndex(step => step.key === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key);
    }
  };

  const goBackToStep = (stepKey) => {
    setCurrentStep(stepKey);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'start':
        return (
          <div className="verification-start">
            <div className="linkedin-logo">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="#0077B5">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <h2>LinkedIn Profile Verification</h2>
            <p>Import your LinkedIn profile data to verify your professional background and skills.</p>
            
            {!existingAccessToken ? (
              <div className="oauth-required">
                <p>Please connect your LinkedIn account first to start the verification process.</p>
                <button 
                  className="btn btn-linkedin"
                  onClick={() => window.location.href = '/api/auth/oauth/linkedin'}
                >
                  Connect LinkedIn Account
                </button>
              </div>
            ) : (
              <div className="verification-benefits">
                <h3>What will be imported:</h3>
                <ul>
                  <li>✅ Professional profile information</li>
                  <li>✅ Work experience and positions</li>
                  <li>✅ Education history</li>
                  <li>✅ Skills and endorsements</li>
                  <li>✅ Profile photo and headline</li>
                </ul>
                
                <div className="action-buttons">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setCurrentStep('privacy')}
                    disabled={isLoading}
                  >
                    Start Verification
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={cancelVerification}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'privacy':
        return (
          <div className="privacy-settings-step">
            <h2>Privacy Settings</h2>
            <p>Choose what information to import and how it will be used.</p>
            
            <PrivacySettings 
              settings={privacySettings}
              onChange={handlePrivacySettingsChange}
            />
            
            <div className="action-buttons">
              <button 
                className="btn btn-primary"
                onClick={startVerification}
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : 'Start Import'}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep('start')}
              >
                Back
              </button>
            </div>
          </div>
        );

      case 'import':
        return (
          <div className="import-progress">
            <h2>Importing LinkedIn Data</h2>
            <p>Please wait while we import your LinkedIn profile data...</p>
            
            {verificationSession && (
              <VerificationProgress 
                session={verificationSession}
                onRetry={() => pollVerificationStatus(verificationSession.sessionId)}
              />
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-secondary"
                onClick={cancelVerification}
              >
                Cancel Verification
              </button>
            </div>
          </div>
        );

      case 'mapping':
        return (
          <div className="skills-mapping-step">
            <h2>Skills Mapping Results</h2>
            <p>Review how your LinkedIn skills have been mapped to our platform.</p>
            
            {verificationSession && (
              <SkillsMappingResults 
                sessionId={verificationSession.sessionId}
                onContinue={() => setCurrentStep('review')}
              />
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-primary"
                onClick={() => setCurrentStep('review')}
              >
                Continue to Review
              </button>
              <button 
                className="btn btn-secondary"
                onClick={cancelVerification}
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="review-step">
            <h2>Review Imported Data</h2>
            <p>Please review the imported data before completing verification.</p>
            
            {verificationSession && (
              <div className="import-summary">
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-value">{verificationSession.data.profileImported ? '✅' : '❌'}</span>
                    <span className="stat-label">Profile</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{verificationSession.data.skillsMapped || 0}</span>
                    <span className="stat-label">Skills Mapped</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{verificationSession.data.experienceImported || 0}</span>
                    <span className="stat-label">Positions</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{verificationSession.data.educationImported || 0}</span>
                    <span className="stat-label">Education</span>
                  </div>
                </div>

                {verificationSession.warnings && verificationSession.warnings.length > 0 && (
                  <div className="warnings">
                    <h4>⚠️ Warnings</h4>
                    {verificationSession.warnings.map((warning, index) => (
                      <div key={index} className="warning-item">
                        {warning.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-primary"
                onClick={proceedToNextStep}
              >
                Complete Verification
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep('mapping')}
              >
                Back to Skills
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="verification-complete">
            <div className="success-icon">🎉</div>
            <h2>LinkedIn Verification Complete!</h2>
            <p>Your LinkedIn profile has been successfully verified and imported.</p>
            
            <VerificationBadge type="linkedin" status="verified" />
            
            {verificationSession && (
              <div className="completion-summary">
                <h3>What was imported:</h3>
                <ul>
                  {verificationSession.data.profileImported && <li>✅ Profile information</li>}
                  {verificationSession.data.skillsMapped > 0 && <li>✅ {verificationSession.data.skillsMapped} skills mapped</li>}
                  {verificationSession.data.experienceImported > 0 && <li>✅ {verificationSession.data.experienceImported} work positions</li>}
                  {verificationSession.data.educationImported > 0 && <li>✅ {verificationSession.data.educationImported} education records</li>}
                </ul>
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  sessionStorage.removeItem('linkedin_verification_session');
                  if (onVerificationComplete) {
                    onVerificationComplete(verificationSession);
                  }
                }}
              >
                Continue to Profile
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="linkedin-verification">
      <div className="verification-header">
        <div className="step-indicators">
          {steps.map((step, index) => (
            <div 
              key={step.key}
              className={`step-indicator ${currentStep === step.key ? 'active' : ''} ${
                steps.findIndex(s => s.key === currentStep) > index ? 'completed' : ''
              }`}
              onClick={() => {
                const currentIndex = steps.findIndex(s => s.key === currentStep);
                if (index < currentIndex) {
                  goBackToStep(step.key);
                }
              }}
            >
              <div className="step-icon">{step.icon}</div>
              <div className="step-title">{step.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="verification-content">
        {error && (
          <div className="error-message">
            <span className="error-icon">❌</span>
            <span>{error}</span>
            <button 
              className="error-dismiss"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}
        
        {renderStepContent()}
      </div>
    </div>
  );
};