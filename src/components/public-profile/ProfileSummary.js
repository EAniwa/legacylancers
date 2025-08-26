/**
 * Profile Summary Component
 * Displays professional bio and key profile information
 */

import React from 'react';
import './ProfileSummary.css';

const ProfileSummary = ({ profile }) => {
  const formatBio = (bio) => {
    if (!bio) return null;
    
    // Split bio into paragraphs for better readability
    const paragraphs = bio.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="bio-paragraph">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="profile-summary">
      <div className="summary-content">
        {/* Professional Bio */}
        <section className="bio-section">
          <h2>About</h2>
          <div className="bio-content">
            {profile.bio ? (
              formatBio(profile.bio)
            ) : (
              <p className="bio-placeholder">
                This professional has not yet added a detailed biography.
              </p>
            )}
          </div>
        </section>

        {/* Key Highlights */}
        <section className="highlights-section">
          <h3>Key Highlights</h3>
          <div className="highlights-grid">
            {/* Years of Experience */}
            {profile.yearsOfExperience && (
              <div className="highlight-item">
                <div className="highlight-icon">🎯</div>
                <div className="highlight-content">
                  <h4>{profile.yearsOfExperience} Years</h4>
                  <p>Professional Experience</p>
                </div>
              </div>
            )}

            {/* Industry Expertise */}
            {profile.industry && (
              <div className="highlight-item">
                <div className="highlight-icon">🏢</div>
                <div className="highlight-content">
                  <h4>{profile.industry}</h4>
                  <p>Industry Expertise</p>
                </div>
              </div>
            )}

            {/* Previous Company */}
            {profile.previousCompany && (
              <div className="highlight-item">
                <div className="highlight-icon">🏛️</div>
                <div className="highlight-content">
                  <h4>{profile.previousCompany}</h4>
                  <p>Previous Company</p>
                </div>
              </div>
            )}

            {/* Previous Title */}
            {profile.previousTitle && (
              <div className="highlight-item">
                <div className="highlight-icon">👔</div>
                <div className="highlight-content">
                  <h4>{profile.previousTitle}</h4>
                  <p>Previous Role</p>
                </div>
              </div>
            )}

            {/* Verification Status */}
            {profile.verificationStatus === 'verified' && (
              <div className="highlight-item verified">
                <div className="highlight-icon">✅</div>
                <div className="highlight-content">
                  <h4>Verified</h4>
                  <p>Profile Verified</p>
                </div>
              </div>
            )}

            {/* Profile Completeness */}
            {profile.profileCompletenessScore && (
              <div className="highlight-item">
                <div className="highlight-icon">📊</div>
                <div className="highlight-content">
                  <h4>{profile.profileCompletenessScore}%</h4>
                  <p>Profile Complete</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Engagement Preferences */}
        <section className="engagement-section">
          <h3>What I Offer</h3>
          <div className="engagement-preferences">
            {profile.engagementTypes && profile.engagementTypes.length > 0 ? (
              <div className="engagement-list">
                {profile.engagementTypes.map((type, index) => (
                  <div key={index} className={`engagement-item ${type}`}>
                    <div className="engagement-icon">
                      {getEngagementIcon(type)}
                    </div>
                    <div className="engagement-details">
                      <h4>{getEngagementTitle(type)}</h4>
                      <p>{getEngagementDescription(type)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="engagement-placeholder">
                Engagement preferences not specified.
              </p>
            )}
          </div>
        </section>

        {/* Pricing Information */}
        {(profile.showHourlyRates || profile.showProjectRates) && (
          <section className="pricing-section">
            <h3>Pricing</h3>
            <div className="pricing-grid">
              {/* Hourly Rates */}
              {profile.showHourlyRates && (profile.hourlyRateMin || profile.hourlyRateMax) && (
                <div className="pricing-item">
                  <div className="pricing-type">
                    <span className="pricing-icon">⏰</span>
                    <h4>Hourly Rate</h4>
                  </div>
                  <div className="pricing-value">
                    <span className="rate">
                      {profile.hourlyRateMin && profile.hourlyRateMax
                        ? `$${profile.hourlyRateMin} - $${profile.hourlyRateMax}`
                        : profile.hourlyRateMin
                        ? `From $${profile.hourlyRateMin}`
                        : `Up to $${profile.hourlyRateMax}`
                      }
                    </span>
                    <span className="rate-period">/{profile.currency || 'USD'} per hour</span>
                  </div>
                </div>
              )}

              {/* Project Rates */}
              {profile.showProjectRates && (profile.projectRateMin || profile.projectRateMax) && (
                <div className="pricing-item">
                  <div className="pricing-type">
                    <span className="pricing-icon">📋</span>
                    <h4>Project Rate</h4>
                  </div>
                  <div className="pricing-value">
                    <span className="rate">
                      {profile.projectRateMin && profile.projectRateMax
                        ? `$${profile.projectRateMin} - $${profile.projectRateMax}`
                        : profile.projectRateMin
                        ? `From $${profile.projectRateMin}`
                        : `Up to $${profile.projectRateMax}`
                      }
                    </span>
                    <span className="rate-period">/{profile.currency || 'USD'} per project</span>
                  </div>
                </div>
              )}

              {/* Keynote Speaking */}
              {profile.keynoteRate && (
                <div className="pricing-item">
                  <div className="pricing-type">
                    <span className="pricing-icon">🎤</span>
                    <h4>Keynote Speaking</h4>
                  </div>
                  <div className="pricing-value">
                    <span className="rate">${profile.keynoteRate}</span>
                    <span className="rate-period">/{profile.currency || 'USD'} per event</span>
                  </div>
                </div>
              )}

              {/* Mentoring */}
              {profile.mentoringRate && (
                <div className="pricing-item">
                  <div className="pricing-type">
                    <span className="pricing-icon">🎯</span>
                    <h4>Mentoring</h4>
                  </div>
                  <div className="pricing-value">
                    <span className="rate">${profile.mentoringRate}</span>
                    <span className="rate-period">/{profile.currency || 'USD'} per session</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Statistics */}
        {(profile.totalReviews > 0 || profile.totalEngagements > 0) && (
          <section className="statistics-section">
            <h3>Track Record</h3>
            <div className="statistics-grid">
              {profile.totalEngagements > 0 && (
                <div className="stat-item">
                  <div className="stat-icon">🤝</div>
                  <div className="stat-content">
                    <span className="stat-number">{profile.totalEngagements}</span>
                    <span className="stat-label">Total Engagements</span>
                  </div>
                </div>
              )}

              {profile.totalReviews > 0 && (
                <div className="stat-item">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-content">
                    <span className="stat-number">
                      {profile.averageRating?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="stat-label">
                      Average Rating ({profile.totalReviews} reviews)
                    </span>
                  </div>
                </div>
              )}

              {profile.totalRevenue > 0 && (
                <div className="stat-item">
                  <div className="stat-icon">💰</div>
                  <div className="stat-content">
                    <span className="stat-number">
                      ${profile.totalRevenue.toLocaleString()}
                    </span>
                    <span className="stat-label">Total Revenue</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

// Helper functions for engagement types
function getEngagementIcon(type) {
  const icons = {
    freelance: '💼',
    consulting: '🔍',
    project: '📋',
    keynote: '🎤',
    mentoring: '🎯'
  };
  return icons[type] || '💼';
}

function getEngagementTitle(type) {
  const titles = {
    freelance: 'Freelance Work',
    consulting: 'Consulting',
    project: 'Project Work',
    keynote: 'Keynote Speaking',
    mentoring: 'Mentoring'
  };
  return titles[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getEngagementDescription(type) {
  const descriptions = {
    freelance: 'Available for ongoing freelance projects and contract work',
    consulting: 'Strategic consulting and advisory services for organizations',
    project: 'Discrete project-based work with defined scope and timeline',
    keynote: 'Professional speaking engagements and keynote presentations',
    mentoring: 'One-on-one mentoring and coaching for professionals'
  };
  return descriptions[type] || 'Professional services available';
}

export default ProfileSummary;