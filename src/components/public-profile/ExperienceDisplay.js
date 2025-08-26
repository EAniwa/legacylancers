/**
 * Experience Display Component
 * Shows professional experience, achievements, and career history
 */

import React, { useState } from 'react';
import './ExperienceDisplay.css';

const ExperienceDisplay = ({ profile }) => {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  // Mock experience data - in production this would come from the API
  const mockExperience = {
    positions: [
      {
        id: 1,
        title: profile.previousTitle || 'Senior Executive',
        company: profile.previousCompany || 'Fortune 500 Company',
        startDate: '2015-01',
        endDate: '2023-12',
        current: false,
        location: 'New York, NY',
        description: 'Led strategic initiatives and managed cross-functional teams to drive business growth and operational excellence.',
        achievements: [
          'Increased revenue by 35% through strategic market expansion',
          'Led digital transformation initiative affecting 10,000+ employees',
          'Implemented cost optimization program saving $2M annually'
        ]
      },
      {
        id: 2,
        title: 'VP of Operations',
        company: 'Tech Startup Inc.',
        startDate: '2012-03',
        endDate: '2015-01',
        current: false,
        location: 'San Francisco, CA',
        description: 'Oversaw operations scaling from startup to mid-size company.',
        achievements: [
          'Built operations team from 5 to 50 employees',
          'Established processes for 300% growth period',
          'Launched 3 new product lines successfully'
        ]
      }
    ],
    education: [
      {
        id: 1,
        degree: 'MBA',
        field: 'Business Administration',
        institution: 'Harvard Business School',
        year: '2010',
        honors: 'Magna Cum Laude'
      },
      {
        id: 2,
        degree: 'Bachelor of Science',
        field: 'Engineering',
        institution: 'MIT',
        year: '2005',
        honors: null
      }
    ],
    certifications: [
      {
        id: 1,
        name: 'Certified Project Management Professional (PMP)',
        issuer: 'PMI',
        year: '2018',
        expires: '2024'
      },
      {
        id: 2,
        name: 'Six Sigma Black Belt',
        issuer: 'ASQ',
        year: '2016',
        expires: null
      }
    ],
    achievements: [
      {
        id: 1,
        title: 'Industry Leader of the Year',
        organization: 'Business Excellence Awards',
        year: '2022',
        description: 'Recognized for outstanding leadership in digital transformation'
      },
      {
        id: 2,
        title: 'Top 40 Under 40',
        organization: 'Business Journal',
        year: '2018',
        description: 'Listed among top young business leaders in the region'
      }
    ]
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const calculateDuration = (startDate, endDate) => {
    const start = new Date(startDate + '-01');
    const end = endDate ? new Date(endDate + '-01') : new Date();
    
    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                   end.getMonth() - start.getMonth();
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    let duration = '';
    if (years > 0) duration += `${years} year${years > 1 ? 's' : ''}`;
    if (remainingMonths > 0) {
      if (duration) duration += ' ';
      duration += `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
    
    return duration || '1 month';
  };

  return (
    <div className="experience-display">
      <div className="experience-header">
        <h2>Professional Experience</h2>
        <p>Career history and achievements</p>
      </div>

      {/* Professional Experience */}
      <section className="experience-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('experience')}
        >
          <h3>
            <span className="section-icon">💼</span>
            Work Experience
          </h3>
          <button className="expand-toggle">
            {expandedSection === 'experience' ? '−' : '+'}
          </button>
        </div>
        
        <div className={`section-content ${expandedSection === 'experience' ? 'expanded' : 'collapsed'}`}>
          <div className="positions-timeline">
            {mockExperience.positions.map((position, index) => (
              <div key={position.id} className="position-item">
                <div className="timeline-marker">
                  <div className="marker-dot"></div>
                  {index < mockExperience.positions.length - 1 && (
                    <div className="timeline-line"></div>
                  )}
                </div>
                
                <div className="position-content">
                  <div className="position-header">
                    <h4 className="position-title">{position.title}</h4>
                    <div className="position-meta">
                      <span className="company-name">{position.company}</span>
                      <span className="position-location">{position.location}</span>
                    </div>
                    <div className="position-duration">
                      <span className="date-range">
                        {formatDate(position.startDate)} - {position.endDate ? formatDate(position.endDate) : 'Present'}
                      </span>
                      <span className="duration">
                        ({calculateDuration(position.startDate, position.endDate)})
                      </span>
                    </div>
                  </div>
                  
                  <div className="position-description">
                    <p>{position.description}</p>
                  </div>
                  
                  {position.achievements && position.achievements.length > 0 && (
                    <div className="position-achievements">
                      <h5>Key Achievements:</h5>
                      <ul>
                        {position.achievements.map((achievement, achIndex) => (
                          <li key={achIndex}>{achievement}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Education */}
      <section className="experience-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('education')}
        >
          <h3>
            <span className="section-icon">🎓</span>
            Education
          </h3>
          <button className="expand-toggle">
            {expandedSection === 'education' ? '−' : '+'}
          </button>
        </div>
        
        <div className={`section-content ${expandedSection === 'education' ? 'expanded' : 'collapsed'}`}>
          <div className="education-list">
            {mockExperience.education.map((edu) => (
              <div key={edu.id} className="education-item">
                <div className="education-content">
                  <h4 className="degree-title">
                    {edu.degree} in {edu.field}
                  </h4>
                  <div className="institution-info">
                    <span className="institution-name">{edu.institution}</span>
                    <span className="graduation-year">Class of {edu.year}</span>
                  </div>
                  {edu.honors && (
                    <div className="honors">
                      <span className="honors-badge">{edu.honors}</span>
                    </div>
                  )}
                </div>
                <div className="education-icon">🏛️</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="experience-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('certifications')}
        >
          <h3>
            <span className="section-icon">📜</span>
            Certifications
          </h3>
          <button className="expand-toggle">
            {expandedSection === 'certifications' ? '−' : '+'}
          </button>
        </div>
        
        <div className={`section-content ${expandedSection === 'certifications' ? 'expanded' : 'collapsed'}`}>
          <div className="certifications-grid">
            {mockExperience.certifications.map((cert) => (
              <div key={cert.id} className="certification-card">
                <div className="cert-header">
                  <h4 className="cert-name">{cert.name}</h4>
                  <div className="cert-issuer">{cert.issuer}</div>
                </div>
                <div className="cert-details">
                  <span className="cert-year">Earned: {cert.year}</span>
                  {cert.expires && (
                    <span className="cert-expires">
                      Expires: {cert.expires}
                    </span>
                  )}
                </div>
                <div className="cert-icon">🏆</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Awards & Achievements */}
      <section className="experience-section">
        <div 
          className="section-header"
          onClick={() => toggleSection('achievements')}
        >
          <h3>
            <span className="section-icon">🏆</span>
            Awards & Recognition
          </h3>
          <button className="expand-toggle">
            {expandedSection === 'achievements' ? '−' : '+'}
          </button>
        </div>
        
        <div className={`section-content ${expandedSection === 'achievements' ? 'expanded' : 'collapsed'}`}>
          <div className="achievements-list">
            {mockExperience.achievements.map((achievement) => (
              <div key={achievement.id} className="achievement-item">
                <div className="achievement-icon">🌟</div>
                <div className="achievement-content">
                  <h4 className="achievement-title">{achievement.title}</h4>
                  <div className="achievement-meta">
                    <span className="achievement-org">{achievement.organization}</span>
                    <span className="achievement-year">{achievement.year}</span>
                  </div>
                  {achievement.description && (
                    <p className="achievement-description">{achievement.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Career Summary */}
      <section className="career-summary">
        <h3>Career Summary</h3>
        <div className="summary-stats">
          <div className="summary-item">
            <div className="summary-icon">📈</div>
            <div className="summary-content">
              <span className="summary-number">{profile.yearsOfExperience || 15}</span>
              <span className="summary-label">Years Experience</span>
            </div>
          </div>
          
          <div className="summary-item">
            <div className="summary-icon">🏢</div>
            <div className="summary-content">
              <span className="summary-number">{mockExperience.positions.length}</span>
              <span className="summary-label">Leadership Positions</span>
            </div>
          </div>
          
          <div className="summary-item">
            <div className="summary-icon">🎓</div>
            <div className="summary-content">
              <span className="summary-number">{mockExperience.education.length}</span>
              <span className="summary-label">Degrees</span>
            </div>
          </div>
          
          <div className="summary-item">
            <div className="summary-icon">📜</div>
            <div className="summary-content">
              <span className="summary-number">{mockExperience.certifications.length}</span>
              <span className="summary-label">Certifications</span>
            </div>
          </div>
        </div>

        {/* Key Industries */}
        <div className="key-industries">
          <h4>Industry Experience</h4>
          <div className="industry-tags">
            <span className="industry-tag">Technology</span>
            <span className="industry-tag">Finance</span>
            <span className="industry-tag">Healthcare</span>
            <span className="industry-tag">Manufacturing</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ExperienceDisplay;