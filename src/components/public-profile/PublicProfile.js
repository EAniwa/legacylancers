/**
 * Public Profile Component
 * SEO-optimized responsive profile page with all sections
 */

import React, { useState, useEffect } from 'react';
import ProfileHeader from './ProfileHeader';
import ProfileSummary from './ProfileSummary';
import SkillsShowcase from './SkillsShowcase';
import ExperienceDisplay from './ExperienceDisplay';
import AvailabilityCalendar from './AvailabilityCalendar';
import ContactSection from './ContactSection';
import SocialSharing from './SocialSharing';
import './PublicProfile.css';

const PublicProfile = ({ profileData }) => {
  const [activeSection, setActiveSection] = useState('summary');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate component with server-side rendered data
    if (profileData) {
      setIsLoading(false);
    }
  }, [profileData]);

  useEffect(() => {
    // Update page title dynamically for SPA navigation
    if (profileData?.seo?.title) {
      document.title = profileData.seo.title;
    }

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && profileData?.seo?.description) {
      metaDescription.setAttribute('content', profileData.seo.description);
    }
  }, [profileData]);

  if (isLoading || !profileData) {
    return (
      <div className="profile-loading">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-content"></div>
          <div className="skeleton-sidebar"></div>
        </div>
      </div>
    );
  }

  const handleSectionChange = (section) => {
    setActiveSection(section);
    
    // Update URL without page reload for better UX
    const url = new URL(window.location);
    url.hash = section;
    window.history.pushState({}, '', url);
  };

  const handleContactClick = () => {
    // Navigate to contact form
    window.location.href = `/profile/${profileData.profileSlug}/contact`;
  };

  const handleAvailabilityClick = () => {
    // Navigate to availability view
    window.location.href = `/profile/${profileData.profileSlug}/availability`;
  };

  return (
    <div className="public-profile">
      <div className="profile-container">
        {/* Profile Header */}
        <ProfileHeader 
          profile={profileData}
          onContactClick={handleContactClick}
          onAvailabilityClick={handleAvailabilityClick}
        />

        {/* Navigation Tabs */}
        <nav className="profile-navigation" role="tablist">
          <button
            className={`nav-tab ${activeSection === 'summary' ? 'active' : ''}`}
            onClick={() => handleSectionChange('summary')}
            role="tab"
            aria-selected={activeSection === 'summary'}
            aria-controls="summary-panel"
          >
            Summary
          </button>
          <button
            className={`nav-tab ${activeSection === 'skills' ? 'active' : ''}`}
            onClick={() => handleSectionChange('skills')}
            role="tab"
            aria-selected={activeSection === 'skills'}
            aria-controls="skills-panel"
          >
            Skills
          </button>
          <button
            className={`nav-tab ${activeSection === 'experience' ? 'active' : ''}`}
            onClick={() => handleSectionChange('experience')}
            role="tab"
            aria-selected={activeSection === 'experience'}
            aria-controls="experience-panel"
          >
            Experience
          </button>
          <button
            className={`nav-tab ${activeSection === 'availability' ? 'active' : ''}`}
            onClick={() => handleSectionChange('availability')}
            role="tab"
            aria-selected={activeSection === 'availability'}
            aria-controls="availability-panel"
          >
            Availability
          </button>
        </nav>

        {/* Main Content */}
        <div className="profile-content">
          <main className="profile-main">
            {/* Summary Section */}
            {activeSection === 'summary' && (
              <section 
                id="summary-panel" 
                className="profile-section"
                role="tabpanel"
                aria-labelledby="summary-tab"
              >
                <ProfileSummary profile={profileData} />
              </section>
            )}

            {/* Skills Section */}
            {activeSection === 'skills' && (
              <section 
                id="skills-panel" 
                className="profile-section"
                role="tabpanel"
                aria-labelledby="skills-tab"
              >
                <SkillsShowcase 
                  skills={profileData.skills} 
                  profileSlug={profileData.profileSlug}
                />
              </section>
            )}

            {/* Experience Section */}
            {activeSection === 'experience' && (
              <section 
                id="experience-panel" 
                className="profile-section"
                role="tabpanel"
                aria-labelledby="experience-tab"
              >
                <ExperienceDisplay profile={profileData} />
              </section>
            )}

            {/* Availability Section */}
            {activeSection === 'availability' && (
              <section 
                id="availability-panel" 
                className="profile-section"
                role="tabpanel"
                aria-labelledby="availability-tab"
              >
                <AvailabilityCalendar 
                  availability={profileData.availability}
                  profileSlug={profileData.profileSlug}
                />
              </section>
            )}
          </main>

          {/* Sidebar */}
          <aside className="profile-sidebar">
            <ContactSection 
              profile={profileData}
              onContactClick={handleContactClick}
            />
            
            <SocialSharing 
              profile={profileData}
              socialData={profileData.socialSharing}
            />

            {/* Profile Stats */}
            <div className="profile-stats">
              <h3>Profile Stats</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{profileData.yearsOfExperience || 0}</span>
                  <span className="stat-label">Years Experience</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{profileData.profileCompletenessScore || 0}%</span>
                  <span className="stat-label">Profile Complete</span>
                </div>
                {profileData.totalReviews > 0 && (
                  <div className="stat-item">
                    <span className="stat-value">{profileData.averageRating?.toFixed(1) || 'N/A'}</span>
                    <span className="stat-label">Average Rating</span>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Badges */}
            <div className="verification-badges">
              <h3>Verification</h3>
              <div className="badges-list">
                {profileData.verificationStatus === 'verified' && (
                  <div className="badge verified">
                    <span className="badge-icon">✓</span>
                    Profile Verified
                  </div>
                )}
                {profileData.linkedinVerified && (
                  <div className="badge linkedin">
                    <span className="badge-icon">🔗</span>
                    LinkedIn Verified
                  </div>
                )}
                {profileData.backgroundCheckStatus === 'completed' && (
                  <div className="badge background-check">
                    <span className="badge-icon">🛡️</span>
                    Background Checked
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Structured Data Script (client-side enhancement) */}
      {profileData.structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(profileData.structuredData)
          }}
        />
      )}
    </div>
  );
};

export default PublicProfile;