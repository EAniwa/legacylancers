/**
 * Skills Showcase Component
 * Interactive display of skills with proficiency levels and verification
 */

import React, { useState } from 'react';
import './SkillsShowcase.css';

const SkillsShowcase = ({ skills, profileSlug }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState(null);

  if (!skills || skills.length === 0) {
    return (
      <div className="skills-showcase empty">
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>Skills Not Listed</h3>
          <p>This professional has not yet added their skills to their profile.</p>
        </div>
      </div>
    );
  }

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    const category = skill.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {});

  // Get all categories
  const categories = ['all', ...Object.keys(skillsByCategory)];

  // Filter skills based on selected category
  const filteredSkills = selectedCategory === 'all'
    ? skills
    : skillsByCategory[selectedCategory] || [];

  const getProficiencyLevel = (level) => {
    const levels = {
      beginner: { text: 'Beginner', value: 25 },
      intermediate: { text: 'Intermediate', value: 50 },
      advanced: { text: 'Advanced', value: 75 },
      expert: { text: 'Expert', value: 100 }
    };
    return levels[level] || { text: level, value: 50 };
  };

  const getProficiencyColor = (level) => {
    const colors = {
      beginner: '#fbbf24',
      intermediate: '#60a5fa',
      advanced: '#34d399',
      expert: '#a855f7'
    };
    return colors[level] || '#6b7280';
  };

  const handleSkillClick = (skill) => {
    setSelectedSkill(selectedSkill?.id === skill.id ? null : skill);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Technical': '💻',
      'Leadership': '👥',
      'Strategy': '🎯',
      'Communication': '💬',
      'Design': '🎨',
      'Marketing': '📈',
      'Finance': '💰',
      'Operations': '⚙️',
      'General': '🔧'
    };
    return icons[category] || '🔧';
  };

  return (
    <div className="skills-showcase">
      <div className="showcase-header">
        <h2>Skills & Expertise</h2>
        <p>Professional skills and competencies</p>
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <div className="filter-tabs">
          {categories.map((category) => (
            <button
              key={category}
              className={`filter-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all' ? (
                <>
                  <span className="tab-icon">🎯</span>
                  All Skills
                </>
              ) : (
                <>
                  <span className="tab-icon">{getCategoryIcon(category)}</span>
                  {category}
                  <span className="skill-count">({skillsByCategory[category]?.length || 0})</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      <div className="skills-grid">
        {filteredSkills.map((skill, index) => (
          <div
            key={skill.id || index}
            className={`skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
            onClick={() => handleSkillClick(skill)}
          >
            <div className="skill-header">
              <div className="skill-name">
                <h3>{skill.name}</h3>
                {skill.verified && (
                  <span className="verified-badge" title="Verified Skill">
                    ✓
                  </span>
                )}
              </div>
              
              {/* Proficiency Level */}
              {skill.proficiencyLevel && (
                <div className="proficiency-indicator">
                  <div className="proficiency-bar">
                    <div
                      className="proficiency-fill"
                      style={{
                        width: `${getProficiencyLevel(skill.proficiencyLevel).value}%`,
                        backgroundColor: getProficiencyColor(skill.proficiencyLevel)
                      }}
                    ></div>
                  </div>
                  <span className="proficiency-text">
                    {getProficiencyLevel(skill.proficiencyLevel).text}
                  </span>
                </div>
              )}
            </div>

            {/* Skill Details */}
            {skill.description && (
              <p className="skill-description">{skill.description}</p>
            )}

            {/* Skill Meta */}
            <div className="skill-meta">
              {skill.category && (
                <span className="skill-category">
                  {getCategoryIcon(skill.category)} {skill.category}
                </span>
              )}
              {skill.yearsExperience && (
                <span className="years-experience">
                  {skill.yearsExperience} years
                </span>
              )}
            </div>

            {/* Endorsements/Usage Count */}
            {skill.endorsements > 0 && (
              <div className="skill-endorsements">
                <span className="endorsement-count">
                  {skill.endorsements} endorsements
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div className="skill-modal-overlay" onClick={() => setSelectedSkill(null)}>
          <div className="skill-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h3>{selectedSkill.name}</h3>
                {selectedSkill.verified && (
                  <span className="verified-badge large">
                    ✓ Verified
                  </span>
                )}
              </div>
              <button
                className="modal-close"
                onClick={() => setSelectedSkill(null)}
                aria-label="Close skill details"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              {/* Proficiency Details */}
              {selectedSkill.proficiencyLevel && (
                <div className="proficiency-details">
                  <h4>Proficiency Level</h4>
                  <div className="proficiency-display">
                    <div className="proficiency-bar large">
                      <div
                        className="proficiency-fill"
                        style={{
                          width: `${getProficiencyLevel(selectedSkill.proficiencyLevel).value}%`,
                          backgroundColor: getProficiencyColor(selectedSkill.proficiencyLevel)
                        }}
                      ></div>
                    </div>
                    <span className="proficiency-label">
                      {getProficiencyLevel(selectedSkill.proficiencyLevel).text}
                    </span>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedSkill.description && (
                <div className="skill-detail-description">
                  <h4>About This Skill</h4>
                  <p>{selectedSkill.description}</p>
                </div>
              )}

              {/* Experience */}
              {selectedSkill.yearsExperience && (
                <div className="skill-experience">
                  <h4>Experience</h4>
                  <p>{selectedSkill.yearsExperience} years of professional experience</p>
                </div>
              )}

              {/* Projects or Examples */}
              {selectedSkill.projects && selectedSkill.projects.length > 0 && (
                <div className="skill-projects">
                  <h4>Related Projects</h4>
                  <ul className="projects-list">
                    {selectedSkill.projects.map((project, index) => (
                      <li key={index} className="project-item">
                        <strong>{project.name}</strong>
                        {project.description && (
                          <span> - {project.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Certifications */}
              {selectedSkill.certifications && selectedSkill.certifications.length > 0 && (
                <div className="skill-certifications">
                  <h4>Related Certifications</h4>
                  <ul className="certifications-list">
                    {selectedSkill.certifications.map((cert, index) => (
                      <li key={index} className="certification-item">
                        <strong>{cert.name}</strong>
                        {cert.issuer && <span> - {cert.issuer}</span>}
                        {cert.year && <span> ({cert.year})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Skills Summary */}
      <div className="skills-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{skills.length}</span>
            <span className="stat-label">Total Skills</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {skills.filter(skill => skill.verified).length}
            </span>
            <span className="stat-label">Verified Skills</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {skills.filter(skill => skill.proficiencyLevel === 'expert').length}
            </span>
            <span className="stat-label">Expert Level</span>
          </div>
        </div>

        {/* Top Categories */}
        <div className="top-categories">
          <h4>Top Skill Categories</h4>
          <div className="category-tags">
            {Object.entries(skillsByCategory)
              .sort((a, b) => b[1].length - a[1].length)
              .slice(0, 5)
              .map(([category, categorySkills]) => (
                <span key={category} className="category-tag">
                  {getCategoryIcon(category)}
                  {category} ({categorySkills.length})
                </span>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillsShowcase;