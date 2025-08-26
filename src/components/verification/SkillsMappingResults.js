/**
 * Skills Mapping Results Component
 * Shows how LinkedIn skills were mapped to platform skills
 */

import React, { useState, useEffect } from 'react';
import './SkillsMappingResults.css';

export const SkillsMappingResults = ({ sessionId, onContinue }) => {
  const [mappingData, setMappingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('mapped');

  useEffect(() => {
    fetchMappingResults();
  }, [sessionId]);

  const fetchMappingResults = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/verification/linkedin/skills-mapping/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch skills mapping');
      }

      setMappingData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="skills-mapping-loading">
        <div className="spinner"></div>
        <p>Loading skills mapping results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="skills-mapping-error">
        <span className="error-icon">❌</span>
        <p>{error}</p>
        <button 
          className="btn btn-primary"
          onClick={fetchMappingResults}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!mappingData) {
    return (
      <div className="skills-mapping-no-data">
        <p>No skills mapping data available.</p>
      </div>
    );
  }

  const { linkedInSkills, mappedSkills, unmappedSkills, mappingStats } = mappingData;

  const renderMappedSkills = () => (
    <div className="mapped-skills">
      <h4>Successfully Mapped Skills ({mappedSkills.length})</h4>
      {mappedSkills.length === 0 ? (
        <p className="no-skills">No skills were successfully mapped.</p>
      ) : (
        <div className="skills-grid">
          {mappedSkills.map((skill, index) => (
            <div key={index} className="skill-mapping-card mapped">
              <div className="mapping-arrow">
                <div className="linkedin-skill">
                  <span className="skill-source">LinkedIn</span>
                  <span className="skill-name">{skill.linkedInSkill.name}</span>
                  {skill.linkedInSkill.endorsements > 0 && (
                    <span className="endorsements">{skill.linkedInSkill.endorsements} endorsements</span>
                  )}
                </div>
                <div className="arrow">→</div>
                <div className="platform-skill">
                  <span className="skill-source">Platform</span>
                  <span className="skill-name">{skill.name}</span>
                  <span className="proficiency-level">{skill.proficiencyLevel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUnmappedSkills = () => (
    <div className="unmapped-skills">
      <h4>Unmapped Skills ({unmappedSkills.length})</h4>
      {unmappedSkills.length === 0 ? (
        <p className="no-skills">All skills were successfully mapped!</p>
      ) : (
        <>
          <p className="unmapped-explanation">
            These skills from your LinkedIn profile couldn't be automatically mapped to our platform skills. 
            They may be created as new skills or you can manually map them later.
          </p>
          <div className="skills-list">
            {unmappedSkills.map((skill, index) => (
              <div key={index} className="skill-card unmapped">
                <div className="skill-header">
                  <span className="skill-name">{skill.name}</span>
                  {skill.endorsements > 0 && (
                    <span className="endorsements">{skill.endorsements} endorsements</span>
                  )}
                </div>
                <div className="skill-actions">
                  <button className="btn btn-sm btn-outline">Create New Skill</button>
                  <button className="btn btn-sm btn-outline">Map Manually</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderOriginalSkills = () => (
    <div className="original-skills">
      <h4>Original LinkedIn Skills ({linkedInSkills.length})</h4>
      <div className="skills-list">
        {linkedInSkills.map((skill, index) => (
          <div key={index} className="skill-card original">
            <div className="skill-header">
              <span className="skill-name">{skill.name}</span>
              <span className="proficiency-level">{skill.proficiencyLevel}</span>
            </div>
            <div className="skill-details">
              {skill.endorsements > 0 && (
                <span className="endorsements">{skill.endorsements} endorsements</span>
              )}
              <span className="mapping-status">
                {mappedSkills.some(m => m.linkedInSkill.name === skill.name) ? '✅ Mapped' : '❌ Unmapped'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="skills-mapping-results">
      <div className="mapping-summary">
        <h3>Skills Mapping Summary</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{mappingStats.totalSkills}</div>
            <div className="stat-label">Total Skills</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{mappingStats.mappedCount}</div>
            <div className="stat-label">Mapped</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{mappingStats.unmappedCount}</div>
            <div className="stat-label">Unmapped</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{mappingStats.mappingRate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>
        
        {mappingStats.mappingRate < 70 && (
          <div className="mapping-warning">
            ⚠️ Low mapping success rate. You may want to review and manually map some skills.
          </div>
        )}
      </div>

      <div className="mapping-tabs">
        <button 
          className={`tab-button ${selectedTab === 'mapped' ? 'active' : ''}`}
          onClick={() => setSelectedTab('mapped')}
        >
          Mapped Skills ({mappedSkills.length})
        </button>
        <button 
          className={`tab-button ${selectedTab === 'unmapped' ? 'active' : ''}`}
          onClick={() => setSelectedTab('unmapped')}
        >
          Unmapped Skills ({unmappedSkills.length})
        </button>
        <button 
          className={`tab-button ${selectedTab === 'original' ? 'active' : ''}`}
          onClick={() => setSelectedTab('original')}
        >
          Original Skills ({linkedInSkills.length})
        </button>
      </div>

      <div className="tab-content">
        {selectedTab === 'mapped' && renderMappedSkills()}
        {selectedTab === 'unmapped' && renderUnmappedSkills()}
        {selectedTab === 'original' && renderOriginalSkills()}
      </div>

      {mappingStats.mappingRate >= 70 ? (
        <div className="mapping-success">
          <div className="success-icon">✅</div>
          <h4>Great mapping success!</h4>
          <p>Most of your skills were successfully mapped to the platform.</p>
        </div>
      ) : (
        <div className="mapping-needs-attention">
          <div className="attention-icon">⚠️</div>
          <h4>Mapping needs attention</h4>
          <p>Several skills couldn't be automatically mapped. You can:</p>
          <ul>
            <li>Continue with current mapping results</li>
            <li>Manually map unmapped skills</li>
            <li>Create new skill categories for unmapped skills</li>
          </ul>
        </div>
      )}

      <div className="mapping-actions">
        <div className="action-buttons">
          {onContinue && (
            <button 
              className="btn btn-primary"
              onClick={onContinue}
            >
              {mappingStats.mappingRate >= 70 ? 'Continue' : 'Continue Anyway'}
            </button>
          )}
          <button 
            className="btn btn-secondary"
            onClick={() => window.open('/skills/mapping-help', '_blank')}
          >
            Get Mapping Help
          </button>
          <button 
            className="btn btn-outline"
            onClick={fetchMappingResults}
          >
            Refresh Results
          </button>
        </div>
      </div>
    </div>
  );
};