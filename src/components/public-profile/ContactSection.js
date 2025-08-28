/**
 * Contact Section Component
 * Quick contact information and action buttons
 */

import React from 'react';
import './ContactSection.css';

const ContactSection = ({ profile, onContactClick }) => {
  const getAvailabilityStatusColor = (status) => {
    const colors = {
      available: '#10b981',
      busy: '#f59e0b',
      unavailable: '#ef4444',
      retired: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getResponseTimeText = (availability) => {
    if (!availability || !availability.responseTime) {
      return 'Response time varies';
    }
    return `Usually responds within ${availability.responseTime}`;
  };

  return (
    <div className="contact-section">
      <div className="section-header">
        <h3>Get in Touch</h3>
      </div>

      {/* Quick Contact Info */}
      <div className="quick-info">
        <div className="availability-info">
          <div className="availability-status">
            <span 
              className="status-dot"
              style={{ backgroundColor: getAvailabilityStatusColor(profile.availabilityStatus) }}
            ></span>
            <span className="status-text">
              {profile.availabilityStatus === 'available' ? 'Available for work' :
               profile.availabilityStatus === 'busy' ? 'Currently busy' :
               profile.availabilityStatus === 'unavailable' ? 'Unavailable' :
               'Status unknown'}
            </span>
          </div>
          
          {profile.availability && (
            <div className="response-time">
              <span className="response-icon">⏱️</span>
              <span className="response-text">
                {getResponseTimeText(profile.availability)}
              </span>
            </div>
          )}
        </div>

        {/* Timezone */}
        {profile.timezone && (
          <div className="timezone-info">
            <span className="timezone-icon">🌍</span>
            <span className="timezone-text">{profile.timezone}</span>
          </div>
        )}

        {/* Engagement Types */}
        {profile.engagementTypes && profile.engagementTypes.length > 0 && (
          <div className="engagement-types-quick">
            <div className="engagement-label">Available for:</div>
            <div className="engagement-list">
              {profile.engagementTypes.slice(0, 3).map((type, index) => (
                <span key={index} className="engagement-tag">
                  {type}
                </span>
              ))}
              {profile.engagementTypes.length > 3 && (
                <span className="more-types">
                  +{profile.engagementTypes.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contact Actions */}
      <div className="contact-actions">
        <button 
          className="btn btn-primary contact-main"
          onClick={onContactClick}
        >
          <span className="btn-icon">✉️</span>
          Send Message
        </button>

        <div className="secondary-actions">
          <a 
            href={`/profile/${profile.profileSlug}/availability`}
            className="btn btn-secondary"
          >
            <span className="btn-icon">📅</span>
            View Calendar
          </a>
          
          {profile.linkedinUrl && (
            <a 
              href={profile.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary linkedin"
            >
              <span className="btn-icon">🔗</span>
              LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* Contact Methods */}
      <div className="contact-methods">
        <h4>Preferred Contact</h4>
        <div className="methods-list">
          <div className="method-item primary">
            <div className="method-icon">📧</div>
            <div className="method-info">
              <span className="method-name">Contact Form</span>
              <span className="method-description">Secure messaging through platform</span>
            </div>
          </div>
          
          {profile.linkedinUrl && (
            <div className="method-item">
              <div className="method-icon">🔗</div>
              <div className="method-info">
                <span className="method-name">LinkedIn</span>
                <span className="method-description">Professional networking</span>
              </div>
            </div>
          )}
          
          <div className="method-item">
            <div className="method-icon">📞</div>
            <div className="method-info">
              <span className="method-name">Video Call</span>
              <span className="method-description">Schedule consultation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Quick View */}
      {(profile.showHourlyRates && (profile.hourlyRateMin || profile.hourlyRateMax)) && (
        <div className="pricing-quick">
          <h4>Starting Rate</h4>
          <div className="rate-display">
            <span className="rate-value">
              {profile.hourlyRateMin ? `$${profile.hourlyRateMin}` : 'Contact for pricing'}
            </span>
            <span className="rate-unit">/{profile.currency || 'USD'} per hour</span>
          </div>
          {profile.hourlyRateMax && profile.hourlyRateMin !== profile.hourlyRateMax && (
            <div className="rate-range">
              Rate range: ${profile.hourlyRateMin} - ${profile.hourlyRateMax}
            </div>
          )}
        </div>
      )}

      {/* Contact Tips */}
      <div className="contact-tips">
        <h4>Contact Tips</h4>
        <ul className="tips-list">
          <li>Be specific about your project needs</li>
          <li>Include your timeline and budget</li>
          <li>Mention how you found this profile</li>
          <li>Professional inquiries only</li>
        </ul>
      </div>

      {/* Trust Signals */}
      <div className="trust-signals">
        <div className="trust-items">
          {profile.verificationStatus === 'verified' && (
            <div className="trust-item">
              <span className="trust-icon verified">✓</span>
              <span className="trust-text">Verified Profile</span>
            </div>
          )}
          
          {profile.linkedinVerified && (
            <div className="trust-item">
              <span className="trust-icon linkedin">🔗</span>
              <span className="trust-text">LinkedIn Verified</span>
            </div>
          )}
          
          {profile.backgroundCheckStatus === 'completed' && (
            <div className="trust-item">
              <span className="trust-icon background">🛡️</span>
              <span className="trust-text">Background Checked</span>
            </div>
          )}
          
          <div className="trust-item">
            <span className="trust-icon secure">🔒</span>
            <span className="trust-text">Secure Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactSection;