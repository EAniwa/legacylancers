/**
 * ReviewStep Component
 * Final profile review and onboarding completion
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import './ReviewStep.css';

// Profile Preview Component
function ProfilePreview({ data }) {
  const { personalInfo, skills, experience, availability } = data;
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getAvailabilityHours = () => {
    if (!availability?.weeklySchedule) return 0;
    
    return Object.values(availability.weeklySchedule).reduce((total, day) => {
      if (!day.available) return total;
      
      return total + day.timeSlots.reduce((dayTotal, slot) => {
        const start = new Date(`2000-01-01 ${slot.start}`);
        const end = new Date(`2000-01-01 ${slot.end}`);
        const hours = (end - start) / (1000 * 60 * 60);
        return dayTotal + hours;
      }, 0);
    }, 0);
  };

  const skillsByCategory = useMemo(() => {
    if (!skills?.skills) return {};
    
    return skills.skills.reduce((grouped, skill) => {
      const category = skill.category || 'other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(skill);
      return grouped;
    }, {});
  }, [skills?.skills]);

  return (
    <div className="profile-preview">
      {/* Header Section */}
      <div className="preview-header">
        <div className="profile-image">
          {personalInfo?.profileImage?.url ? (
            <img 
              src={personalInfo.profileImage.url} 
              alt={`${personalInfo.firstName} ${personalInfo.lastName}`}
              className="profile-photo"
            />
          ) : (
            <div className="profile-photo-placeholder">
              {personalInfo?.firstName?.[0]}{personalInfo?.lastName?.[0]}
            </div>
          )}
        </div>
        
        <div className="profile-info">
          <h2 className="profile-name">
            {personalInfo?.preferredName || personalInfo?.firstName} {personalInfo?.lastName}
          </h2>
          
          {personalInfo?.location && (
            <div className="profile-location">
              📍 {personalInfo.location.city}, {personalInfo.location.state}, {personalInfo.location.country}
            </div>
          )}
          
          {personalInfo?.bio && (
            <p className="profile-bio">{personalInfo.bio}</p>
          )}
          
          <div className="profile-contact">
            {personalInfo?.email && (
              <span className="contact-item">✉️ {personalInfo.email}</span>
            )}
            {personalInfo?.phone && (
              <span className="contact-item">📞 {personalInfo.phone}</span>
            )}
            {personalInfo?.linkedInUrl && (
              <span className="contact-item">💼 LinkedIn</span>
            )}
            {personalInfo?.website && (
              <span className="contact-item">🌐 Website</span>
            )}
          </div>
        </div>
      </div>

      {/* Skills Section */}
      {skills?.skills && skills.skills.length > 0 && (
        <div className="preview-section">
          <h3>Skills & Expertise</h3>
          <div className="skills-categories">
            {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
              <div key={category} className="skill-category">
                <h4 className="category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                </h4>
                <div className="category-skills">
                  {categorySkills.map((skill, index) => (
                    <div key={index} className="skill-tag">
                      <span className="skill-name">{skill.name}</span>
                      <span className="skill-level">{skill.proficiency}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience Section */}
      {experience?.workExperience && experience.workExperience.length > 0 && (
        <div className="preview-section">
          <h3>Work Experience</h3>
          <div className="experience-list">
            {experience.workExperience.map((exp, index) => (
              <div key={index} className="experience-item">
                <div className="experience-header">
                  <div className="experience-title">
                    <h4>{exp.position}</h4>
                    <p className="company-name">{exp.company}</p>
                  </div>
                  <div className="experience-period">
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </div>
                </div>
                
                {exp.description && (
                  <p className="experience-description">{exp.description}</p>
                )}
                
                {exp.achievements && exp.achievements.length > 0 && (
                  <div className="experience-achievements">
                    <strong>Key Achievements:</strong>
                    <ul>
                      {exp.achievements.map((achievement, i) => (
                        <li key={i}>{achievement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education Section */}
      {experience?.education && experience.education.length > 0 && (
        <div className="preview-section">
          <h3>Education</h3>
          <div className="education-list">
            {experience.education.map((edu, index) => (
              <div key={index} className="education-item">
                <div className="education-header">
                  <div className="education-title">
                    <h4>{edu.degree}</h4>
                    <p className="institution-name">{edu.institution}</p>
                  </div>
                  <div className="education-period">
                    {edu.startDate} - {edu.current ? 'Present' : edu.endDate}
                  </div>
                </div>
                
                {edu.field && (
                  <p className="field-of-study">Field: {edu.field}</p>
                )}
                
                {edu.gpa && (
                  <p className="gpa">GPA: {edu.gpa}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Availability & Rates Section */}
      {availability && (
        <div className="preview-section">
          <h3>Availability & Rates</h3>
          
          <div className="availability-summary">
            <div className="availability-info">
              <div className="info-item">
                <strong>Weekly Availability:</strong>
                <span>{getAvailabilityHours()} hours</span>
              </div>
              
              <div className="info-item">
                <strong>Timezone:</strong>
                <span>{availability.timeZone}</span>
              </div>
              
              {availability.minNotice && (
                <div className="info-item">
                  <strong>Minimum Notice:</strong>
                  <span>{availability.minNotice} hours</span>
                </div>
              )}
            </div>
            
            {availability.engagementTypes && availability.rates && (
              <div className="rates-info">
                <h4>Service Rates</h4>
                <div className="rates-list">
                  {availability.engagementTypes.map(type => {
                    const rate = availability.rates[type];
                    if (!rate) return null;
                    
                    const typeLabels = {
                      hourly: 'Hourly Consulting',
                      project: 'Project-Based',
                      retainer: 'Retainer',
                      mentoring: 'Mentoring',
                      training: 'Training/Workshops',
                      advisory: 'Advisory Role'
                    };
                    
                    return (
                      <div key={type} className="rate-item">
                        <span className="rate-type">{typeLabels[type] || type}</span>
                        <span className="rate-amount">{formatCurrency(rate)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Completion Summary Component
function CompletionSummary({ data }) {
  const getSectionStatus = (sectionData, requiredFields = []) => {
    if (!sectionData) return { status: 'incomplete', percentage: 0 };
    
    if (requiredFields.length === 0) {
      return { status: 'complete', percentage: 100 };
    }
    
    const completedFields = requiredFields.filter(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], sectionData);
      return value !== null && value !== undefined && value !== '';
    }).length;
    
    const percentage = Math.round((completedFields / requiredFields.length) * 100);
    const status = percentage === 100 ? 'complete' : percentage >= 50 ? 'partial' : 'incomplete';
    
    return { status, percentage };
  };

  const sections = [
    {
      name: 'Personal Information',
      data: data.personalInfo,
      requiredFields: ['firstName', 'lastName', 'email', 'phone', 'bio', 'location.city'],
      status: getSectionStatus(data.personalInfo, ['firstName', 'lastName', 'email', 'phone', 'bio', 'location.city'])
    },
    {
      name: 'Skills & Expertise',
      data: data.skills,
      requiredFields: ['skills'],
      status: getSectionStatus(data.skills, ['skills'])
    },
    {
      name: 'Experience',
      data: data.experience,
      requiredFields: [],
      status: getSectionStatus(data.experience)
    },
    {
      name: 'Availability & Rates',
      data: data.availability,
      requiredFields: ['weeklySchedule', 'engagementTypes', 'rates'],
      status: getSectionStatus(data.availability, ['weeklySchedule', 'engagementTypes', 'rates'])
    }
  ];

  const overallCompletion = Math.round(
    sections.reduce((sum, section) => sum + section.status.percentage, 0) / sections.length
  );

  return (
    <div className="completion-summary">
      <div className="overall-progress">
        <div className="progress-header">
          <h3>Profile Completion</h3>
          <span className="progress-percentage">{overallCompletion}%</span>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${overallCompletion}%` }}
          />
        </div>
        
        <p className="progress-description">
          {overallCompletion === 100 
            ? 'Great! Your profile is complete and ready to go live.'
            : `Complete ${100 - overallCompletion}% more to maximize your profile visibility.`
          }
        </p>
      </div>

      <div className="section-statuses">
        {sections.map((section, index) => (
          <div key={index} className={`section-status ${section.status.status}`}>
            <div className="status-icon">
              {section.status.status === 'complete' ? '✅' :
               section.status.status === 'partial' ? '⚠️' : '❌'}
            </div>
            <div className="status-info">
              <span className="status-name">{section.name}</span>
              <span className="status-percentage">{section.status.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReviewStep({
  data = {},
  onUpdate,
  onComplete,
  onNext,
  onPrevious,
  isLoading = false,
  error = null,
  canSkip = false,
  onSkip = null
}) {
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      agreedToTerms: false,
      profileVisibility: 'public',
      emailNotifications: true,
      profileCompleteLater: false
    }
  });

  const [activeTab, setActiveTab] = useState('preview');
  const [validationIssues, setValidationIssues] = useState([]);

  const agreedToTerms = watch('agreedToTerms');
  const profileVisibility = watch('profileVisibility');

  // Validate profile data
  useEffect(() => {
    const issues = [];
    
    // Check personal info
    if (!data.personalInfo?.firstName) issues.push('First name is required');
    if (!data.personalInfo?.lastName) issues.push('Last name is required');
    if (!data.personalInfo?.email) issues.push('Email is required');
    if (!data.personalInfo?.bio) issues.push('Professional bio is required');
    
    // Check skills
    if (!data.skills?.skills || data.skills.skills.length < 3) {
      issues.push('At least 3 skills are required');
    }
    
    // Check availability
    if (!data.availability?.engagementTypes || data.availability.engagementTypes.length === 0) {
      issues.push('At least one engagement type must be selected');
    }
    
    if (data.availability?.engagementTypes && !Object.keys(data.availability.rates || {}).some(type => 
      data.availability.engagementTypes.includes(type) && data.availability.rates[type]
    )) {
      issues.push('Rates must be set for selected engagement types');
    }

    setValidationIssues(issues);
  }, [data]);

  // Update parent when data changes
  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        agreedToTerms: agreedToTerms,
        profileVisibility: profileVisibility,
        emailNotifications: watch('emailNotifications'),
        profileCompleteLater: watch('profileCompleteLater')
      });
    }
  }, [agreedToTerms, profileVisibility, watch, onUpdate]);

  // Form validation
  const validateForm = () => {
    return agreedToTerms && validationIssues.length === 0;
  };

  // Handle form submission
  const onSubmit = (formData) => {
    if (!validateForm()) {
      return;
    }

    const submissionData = {
      ...data,
      reviewData: formData,
      completedAt: new Date().toISOString()
    };

    if (onComplete) {
      onComplete(submissionData);
    }
  };

  return (
    <div className="review-step">
      <div className="review-header">
        <h2>Review & Complete Your Profile</h2>
        <p>Review your information below and complete your onboarding.</p>
        
        <div className="review-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Profile Preview
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Completion Status
          </button>
        </div>
      </div>

      <div className="review-content">
        {activeTab === 'preview' && (
          <ProfilePreview data={data} />
        )}
        
        {activeTab === 'summary' && (
          <CompletionSummary data={data} />
        )}
      </div>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <div className="validation-issues">
          <h4>🚨 Issues to Address</h4>
          <ul>
            {validationIssues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
          <p>Please go back and address these issues before completing your profile.</p>
        </div>
      )}

      {/* Final Settings Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="review-form">
        <div className="form-section">
          <h3>Final Settings</h3>
          
          <div className="form-field">
            <label>Profile Visibility</label>
            <div className="visibility-options">
              <label className="radio-option">
                <input
                  type="radio"
                  value="public"
                  checked={profileVisibility === 'public'}
                  onChange={(e) => setValue('profileVisibility', e.target.value)}
                />
                <div className="option-content">
                  <strong>Public</strong>
                  <span>Your profile will be visible to all clients</span>
                </div>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  value="private"
                  checked={profileVisibility === 'private'}
                  onChange={(e) => setValue('profileVisibility', e.target.value)}
                />
                <div className="option-content">
                  <strong>Private</strong>
                  <span>Only you can see your profile until you make it public</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-field checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={watch('emailNotifications')}
                onChange={(e) => setValue('emailNotifications', e.target.checked)}
              />
              <span>Send me email notifications about new opportunities</span>
            </label>
          </div>

          <div className="form-field checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={watch('profileCompleteLater')}
                onChange={(e) => setValue('profileCompleteLater', e.target.checked)}
              />
              <span>I'll complete missing profile sections later</span>
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="terms-section">
            <div className="form-field checkbox-field required">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setValue('agreedToTerms', e.target.checked)}
                  required
                />
                <span>
                  I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          {onPrevious && (
            <button
              type="button"
              className="button secondary"
              onClick={onPrevious}
              disabled={isLoading}
            >
              Previous
            </button>
          )}
          
          <div className="primary-actions">
            {validationIssues.length > 0 && (
              <button
                type="button"
                className="button outline"
                onClick={() => onComplete({ ...data, reviewData: { agreedToTerms, profileVisibility }, skipValidation: true })}
                disabled={!agreedToTerms || isLoading}
              >
                Save & Complete Later
              </button>
            )}
            
            <button
              type="submit"
              className="button primary large"
              disabled={isLoading || !validateForm()}
            >
              {isLoading ? 'Completing Profile...' : 'Complete Profile & Go Live! 🎉'}
            </button>
          </div>
        </div>

        {/* Global Error */}
        {error && (
          <div className="form-error">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}