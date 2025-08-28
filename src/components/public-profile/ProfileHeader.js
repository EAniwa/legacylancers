/**
 * Profile Header Component
 * Displays professional photo, name, headline, and key actions
 */

import React, { useState } from 'react';
import './ProfileHeader.css';

const ProfileHeader = ({ profile, onContactClick, onAvailabilityClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const getProfileImageUrl = () => {
    if (imageError || !profile.profilePhotoUrl) {
      return '/assets/default-profile.jpg';
    }
    return profile.profilePhotoUrl;
  };

  const getAvailabilityStatusClass = (status) => {
    switch (status) {
      case 'available':
        return 'status-available';
      case 'busy':
        return 'status-busy';
      case 'unavailable':
        return 'status-unavailable';
      case 'retired':
        return 'status-retired';
      default:
        return 'status-unknown';
    }
  };

  const getAvailabilityText = (status) => {
    switch (status) {
      case 'available':
        return 'Available for work';
      case 'busy':
        return 'Currently busy';
      case 'unavailable':
        return 'Unavailable';
      case 'retired':
        return 'Retired';
      default:
        return 'Status unknown';
    }
  };

  return (
    <header className="profile-header">
      <div className="header-content">
        {/* Profile Photo */}
        <div className="profile-photo-container">
          <div className={`profile-photo ${!imageLoaded ? 'loading' : ''}`}>
            <img
              src={getProfileImageUrl()}
              alt={`${profile.displayName || 'Professional'} profile photo`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="eager" // Above the fold
            />
            {!imageLoaded && (
              <div className="photo-skeleton">
                <div className="skeleton-circle"></div>
              </div>
            )}
          </div>
          
          {/* Verification Badge */}
          {profile.verificationStatus === 'verified' && (
            <div className="verification-badge" title="Verified Profile">
              <span className="badge-icon">✓</span>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="profile-info">
          <div className="name-section">
            <h1 className="profile-name">
              {profile.displayName || 'Professional Profile'}
            </h1>
            
            {/* Availability Status */}
            <div className={`availability-status ${getAvailabilityStatusClass(profile.availabilityStatus)}`}>
              <span className="status-indicator"></span>
              <span className="status-text">{getAvailabilityText(profile.availabilityStatus)}</span>
            </div>
          </div>

          {/* Headline */}
          {profile.headline && (
            <p className="profile-headline">{profile.headline}</p>
          )}

          {/* Location & Industry */}
          <div className="profile-meta">
            {profile.industry && (
              <span className="meta-item">
                <span className="meta-icon">🏢</span>
                {profile.industry}
              </span>
            )}
            {profile.yearsOfExperience && (
              <span className="meta-item">
                <span className="meta-icon">⏱️</span>
                {profile.yearsOfExperience} years experience
              </span>
            )}
            {profile.timezone && (
              <span className="meta-item">
                <span className="meta-icon">🌍</span>
                {profile.timezone}
              </span>
            )}
          </div>

          {/* Engagement Types */}
          {profile.engagementTypes && profile.engagementTypes.length > 0 && (
            <div className="engagement-types">
              <span className="engagement-label">Available for:</span>
              <div className="engagement-tags">
                {profile.engagementTypes.map((type, index) => (
                  <span key={index} className={`engagement-tag ${type}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rates (if shown) */}
          {(profile.showHourlyRates && (profile.hourlyRateMin || profile.hourlyRateMax)) && (
            <div className="rate-display">
              <span className="rate-label">Hourly Rate:</span>
              <span className="rate-value">
                {profile.hourlyRateMin && profile.hourlyRateMax
                  ? `$${profile.hourlyRateMin} - $${profile.hourlyRateMax}`
                  : profile.hourlyRateMin
                  ? `From $${profile.hourlyRateMin}`
                  : `Up to $${profile.hourlyRateMax}`
                }
                <span className="rate-currency">
                  {profile.currency || 'USD'}/hour
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          <button 
            className="btn btn-primary contact-btn"
            onClick={onContactClick}
            aria-label={`Contact ${profile.displayName}`}
          >
            <span className="btn-icon">✉️</span>
            Contact
          </button>
          
          <button 
            className="btn btn-secondary availability-btn"
            onClick={onAvailabilityClick}
            aria-label={`View ${profile.displayName}'s availability`}
          >
            <span className="btn-icon">📅</span>
            View Availability
          </button>

          {/* External Links */}
          <div className="external-links">
            {profile.linkedinUrl && (
              <a 
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="external-link linkedin"
                aria-label={`View ${profile.displayName}'s LinkedIn profile`}
              >
                <span className="link-icon">🔗</span>
                LinkedIn
              </a>
            )}
            
            {profile.portfolioUrl && (
              <a 
                href={profile.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="external-link portfolio"
                aria-label={`View ${profile.displayName}'s portfolio`}
              >
                <span className="link-icon">🎯</span>
                Portfolio
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="header-background">
        <div className="background-pattern"></div>
        <div className="background-gradient"></div>
      </div>
    </header>
  );
};

export default ProfileHeader;