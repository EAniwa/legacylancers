/**
 * Contact Form Component
 * Secure contact form with spam protection
 */

import React, { useState, useEffect } from 'react';
import './ContactForm.css';

const ContactForm = ({ profileData }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    engagementType: '',
    budget: '',
    timeline: '',
    honeypot: '', // Spam protection field
    timestamp: Date.now() // Spam protection timestamp
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [characterCount, setCharacterCount] = useState(0);

  const maxMessageLength = 2000;

  useEffect(() => {
    // Update character count when message changes
    setCharacterCount(formData.message.length);
  }, [formData.message]);

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    } else if (formData.message.length > maxMessageLength) {
      newErrors.message = `Message must be less than ${maxMessageLength} characters`;
    }

    // Subject validation (optional but if provided must be valid)
    if (formData.subject && formData.subject.length > 200) {
      newErrors.subject = 'Subject must be less than 200 characters';
    }

    // Spam protection checks
    if (formData.honeypot) {
      newErrors.honeypot = 'Bot detected';
    }

    if (Date.now() - formData.timestamp < 3000) {
      newErrors.timestamp = 'Form submitted too quickly';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(`/profile/${profileData.profileSlug}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: 'success',
          message: 'Your message has been sent successfully! You should receive a confirmation email shortly.'
        });

        // Reset form
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
          engagementType: '',
          budget: '',
          timeline: '',
          honeypot: '',
          timestamp: Date.now()
        });
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.error || 'Failed to send message. Please try again.'
        });
      }
    } catch (error) {
      console.error('Contact form error:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Network error. Please check your connection and try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const engagementTypes = [
    { value: 'consulting', label: 'Consulting Project' },
    { value: 'mentoring', label: 'Mentoring Session' },
    { value: 'project', label: 'Project Work' },
    { value: 'keynote', label: 'Speaking Engagement' },
    { value: 'freelance', label: 'Freelance Work' },
    { value: 'other', label: 'Other' }
  ];

  const budgetRanges = [
    { value: 'under-1k', label: 'Under $1,000' },
    { value: '1k-5k', label: '$1,000 - $5,000' },
    { value: '5k-10k', label: '$5,000 - $10,000' },
    { value: '10k-25k', label: '$10,000 - $25,000' },
    { value: '25k-50k', label: '$25,000 - $50,000' },
    { value: 'over-50k', label: 'Over $50,000' },
    { value: 'negotiable', label: 'Negotiable' }
  ];

  const timelines = [
    { value: 'asap', label: 'ASAP' },
    { value: '1-week', label: 'Within 1 week' },
    { value: '2-weeks', label: 'Within 2 weeks' },
    { value: '1-month', label: 'Within 1 month' },
    { value: '3-months', label: 'Within 3 months' },
    { value: 'flexible', label: 'Flexible' }
  ];

  return (
    <div className="contact-form-container">
      {/* Profile Info Header */}
      <div className="contact-header">
        <div className="profile-info">
          {profileData.profilePhotoUrl && (
            <img 
              src={profileData.profilePhotoUrl} 
              alt={profileData.displayName}
              className="profile-photo"
            />
          )}
          <div className="profile-details">
            <h1>Contact {profileData.displayName}</h1>
            {profileData.headline && (
              <p className="profile-headline">{profileData.headline}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <form className="contact-form" onSubmit={handleSubmit} noValidate>
        {/* Honeypot field for spam protection */}
        <input
          type="text"
          name="honeypot"
          value={formData.honeypot}
          onChange={handleInputChange}
          className="honeypot"
          tabIndex="-1"
          autoComplete="off"
        />

        <div className="form-section">
          <h2>Your Information</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Enter your full name"
                maxLength="100"
                required
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email address"
                required
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Project Details</h2>
          
          <div className="form-group">
            <label htmlFor="engagementType" className="form-label">
              Type of Engagement
            </label>
            <select
              id="engagementType"
              name="engagementType"
              value={formData.engagementType}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">Select engagement type</option>
              {engagementTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="budget" className="form-label">
                Budget Range
              </label>
              <select
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="">Select budget range</option>
                {budgetRanges.map(budget => (
                  <option key={budget.value} value={budget.value}>
                    {budget.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="timeline" className="form-label">
                Timeline
              </label>
              <select
                id="timeline"
                name="timeline"
                value={formData.timeline}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="">Select timeline</option>
                {timelines.map(timeline => (
                  <option key={timeline.value} value={timeline.value}>
                    {timeline.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="subject" className="form-label">
              Subject
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              className={`form-input ${errors.subject ? 'error' : ''}`}
              placeholder="Brief subject line"
              maxLength="200"
            />
            {errors.subject && <span className="error-message">{errors.subject}</span>}
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="message" className="form-label">
              Message <span className="required">*</span>
            </label>
            <div className="textarea-container">
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                className={`form-textarea ${errors.message ? 'error' : ''}`}
                placeholder="Please describe your project, requirements, and any specific questions you have..."
                rows="6"
                maxLength={maxMessageLength}
                required
              />
              <div className="character-count">
                {characterCount}/{maxMessageLength}
              </div>
            </div>
            {errors.message && <span className="error-message">{errors.message}</span>}
          </div>
        </div>

        {/* Submit Status */}
        {submitStatus && (
          <div className={`submit-status ${submitStatus.type}`}>
            <div className="status-icon">
              {submitStatus.type === 'success' ? '✅' : '❌'}
            </div>
            <div className="status-message">
              {submitStatus.message}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="submit-spinner"></span>
                Sending Message...
              </>
            ) : (
              <>
                <span className="submit-icon">📤</span>
                Send Message
              </>
            )}
          </button>
        </div>

        {/* Form Footer */}
        <div className="form-footer">
          <div className="privacy-notice">
            <span className="privacy-icon">🔒</span>
            <span className="privacy-text">
              Your information is secure and will only be shared with {profileData.displayName}.
              We never share your contact details with third parties.
            </span>
          </div>
          
          <div className="response-expectation">
            <span className="response-icon">⏱️</span>
            <span className="response-text">
              You can expect a response within {profileData.availability?.responseTime || '48 hours'}.
            </span>
          </div>
        </div>
      </form>

      {/* Contact Tips Sidebar */}
      <aside className="contact-tips">
        <h3>Tips for a Great Message</h3>
        <ul className="tips-list">
          <li>
            <span className="tip-icon">🎯</span>
            <div className="tip-content">
              <strong>Be specific</strong>
              <p>Clearly describe your project scope and objectives</p>
            </div>
          </li>
          <li>
            <span className="tip-icon">💰</span>
            <div className="tip-content">
              <strong>Include budget</strong>
              <p>Share your budget range to get accurate proposals</p>
            </div>
          </li>
          <li>
            <span className="tip-icon">📅</span>
            <div className="tip-content">
              <strong>Mention timeline</strong>
              <p>Let them know when you need the work completed</p>
            </div>
          </li>
          <li>
            <span className="tip-icon">📋</span>
            <div className="tip-content">
              <strong>Share context</strong>
              <p>Explain how you found their profile and why you're interested</p>
            </div>
          </li>
        </ul>

        {/* Alternative Contact */}
        <div className="alternative-contact">
          <h4>Other Ways to Connect</h4>
          <div className="contact-options">
            {profileData.linkedinUrl && (
              <a 
                href={profileData.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-option linkedin"
              >
                <span className="option-icon">💼</span>
                LinkedIn
              </a>
            )}
            
            <button 
              className="contact-option calendar"
              onClick={() => window.location.href = `/profile/${profileData.profileSlug}/availability`}
            >
              <span className="option-icon">📅</span>
              View Calendar
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ContactForm;