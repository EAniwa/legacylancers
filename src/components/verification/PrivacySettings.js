/**
 * Privacy Settings Component
 * Allows users to control what LinkedIn data is imported and how it's used
 */

import React from 'react';
import './PrivacySettings.css';

export const PrivacySettings = ({ settings, onChange }) => {
  const handleSettingChange = (key, value) => {
    onChange({
      ...settings,
      [key]: value
    });
  };

  const privacyLevels = [
    {
      value: 'minimal',
      title: 'Minimal',
      description: 'Import only basic profile information for verification',
      includes: ['Name', 'Current position title', 'Profile photo']
    },
    {
      value: 'selective',
      title: 'Selective',
      description: 'Import selected professional information',
      includes: ['Basic profile', 'Current position', 'Key skills', 'Education']
    },
    {
      value: 'full',
      title: 'Full Import',
      description: 'Import comprehensive professional profile',
      includes: ['Complete profile', 'All positions', 'All skills', 'Education', 'Endorsements']
    }
  ];

  return (
    <div className="privacy-settings">
      <div className="settings-section">
        <h3>Privacy Level</h3>
        <p>Choose how much information to import from your LinkedIn profile.</p>
        
        <div className="privacy-levels">
          {privacyLevels.map((level) => (
            <div 
              key={level.value}
              className={`privacy-level ${settings.privacyLevel === level.value ? 'selected' : ''}`}
              onClick={() => handleSettingChange('privacyLevel', level.value)}
            >
              <div className="level-header">
                <input
                  type="radio"
                  name="privacyLevel"
                  value={level.value}
                  checked={settings.privacyLevel === level.value}
                  onChange={(e) => handleSettingChange('privacyLevel', e.target.value)}
                />
                <label>
                  <strong>{level.title}</strong>
                </label>
              </div>
              <p className="level-description">{level.description}</p>
              <div className="level-includes">
                <strong>Includes:</strong>
                <ul>
                  {level.includes.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>Import Options</h3>
        <p>Fine-tune what specific data types to import.</p>
        
        <div className="import-options">
          <div className="option-group">
            <label className="option-item">
              <input
                type="checkbox"
                checked={settings.importProfile}
                onChange={(e) => handleSettingChange('importProfile', e.target.checked)}
              />
              <span className="checkmark"></span>
              <div className="option-content">
                <strong>Basic Profile Information</strong>
                <p>Name, headline, profile photo, and current position</p>
              </div>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={settings.importSkills}
                onChange={(e) => handleSettingChange('importSkills', e.target.checked)}
              />
              <span className="checkmark"></span>
              <div className="option-content">
                <strong>Skills & Endorsements</strong>
                <p>Professional skills with endorsement counts</p>
              </div>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={settings.importExperience}
                onChange={(e) => handleSettingChange('importExperience', e.target.checked)}
              />
              <span className="checkmark"></span>
              <div className="option-content">
                <strong>Work Experience</strong>
                <p>Current and past positions, companies, and job descriptions</p>
              </div>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={settings.importEducation}
                onChange={(e) => handleSettingChange('importEducation', e.target.checked)}
              />
              <span className="checkmark"></span>
              <div className="option-content">
                <strong>Education History</strong>
                <p>Schools, degrees, and fields of study</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Data Usage</h3>
        <div className="data-usage-info">
          <div className="info-item">
            <span className="info-icon">🔒</span>
            <div className="info-content">
              <strong>Privacy Protected</strong>
              <p>Your LinkedIn data is imported securely and stored with encryption.</p>
            </div>
          </div>
          
          <div className="info-item">
            <span className="info-icon">👤</span>
            <div className="info-content">
              <strong>Profile Enhancement</strong>
              <p>Imported data enhances your platform profile and improves matching.</p>
            </div>
          </div>
          
          <div className="info-item">
            <span className="info-icon">✅</span>
            <div className="info-content">
              <strong>Verification Only</strong>
              <p>Data is used only for profile verification and enhancement purposes.</p>
            </div>
          </div>
          
          <div className="info-item">
            <span className="info-icon">🗑️</span>
            <div className="info-content">
              <strong>Data Control</strong>
              <p>You can delete imported data at any time from your account settings.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Additional Options</h3>
        <div className="additional-options">
          <label className="option-item">
            <input
              type="checkbox"
              checked={settings.autoMapSkills !== false}
              onChange={(e) => handleSettingChange('autoMapSkills', e.target.checked)}
            />
            <span className="checkmark"></span>
            <div className="option-content">
              <strong>Auto-map Skills</strong>
              <p>Automatically match LinkedIn skills to platform skill categories</p>
            </div>
          </label>
        </div>
      </div>

      <div className="settings-summary">
        <h4>Summary of Selected Settings:</h4>
        <div className="summary-items">
          <div className="summary-item">
            <span className="summary-label">Privacy Level:</span>
            <span className="summary-value">{
              privacyLevels.find(level => level.value === settings.privacyLevel)?.title || 'Unknown'
            }</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Profile Import:</span>
            <span className={`summary-value ${settings.importProfile ? 'enabled' : 'disabled'}`}>
              {settings.importProfile ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Skills Import:</span>
            <span className={`summary-value ${settings.importSkills ? 'enabled' : 'disabled'}`}>
              {settings.importSkills ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Experience Import:</span>
            <span className={`summary-value ${settings.importExperience ? 'enabled' : 'disabled'}`}>
              {settings.importExperience ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Education Import:</span>
            <span className={`summary-value ${settings.importEducation ? 'enabled' : 'disabled'}`}>
              {settings.importEducation ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};