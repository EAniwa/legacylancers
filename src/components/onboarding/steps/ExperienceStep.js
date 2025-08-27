/**
 * ExperienceStep Component
 * Work history, education, and achievement management
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import './ExperienceStep.css';

const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'volunteer', label: 'Volunteer' }
];

const EDUCATION_LEVELS = [
  { value: 'high-school', label: 'High School' },
  { value: 'associates', label: 'Associate Degree' },
  { value: 'bachelors', label: 'Bachelor\'s Degree' },
  { value: 'masters', label: 'Master\'s Degree' },
  { value: 'phd', label: 'Ph.D.' },
  { value: 'professional', label: 'Professional Degree' },
  { value: 'certification', label: 'Professional Certification' },
  { value: 'bootcamp', label: 'Bootcamp/Training Program' }
];

const ACHIEVEMENT_TYPES = [
  { value: 'award', label: 'Award', icon: '🏆' },
  { value: 'publication', label: 'Publication', icon: '📄' },
  { value: 'patent', label: 'Patent', icon: '💡' },
  { value: 'speaking', label: 'Speaking Engagement', icon: '🎤' },
  { value: 'leadership', label: 'Leadership Role', icon: '👥' },
  { value: 'project', label: 'Major Project', icon: '🚀' },
  { value: 'certification', label: 'Certification', icon: '📜' },
  { value: 'other', label: 'Other', icon: '⭐' }
];

// Work Experience Item Component
function WorkExperienceItem({ experience, index, onUpdate, onRemove }) {
  const [isEditing, setIsEditing] = useState(!experience.company);
  const [formData, setFormData] = useState({
    company: experience.company || '',
    position: experience.position || '',
    location: experience.location || '',
    employmentType: experience.employmentType || 'full-time',
    startDate: experience.startDate || '',
    endDate: experience.endDate || '',
    current: experience.current || false,
    description: experience.description || '',
    achievements: experience.achievements || []
  });

  const [achievementText, setAchievementText] = useState('');

  const handleInputChange = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    
    // If marking as current job, clear end date
    if (field === 'current' && value) {
      updatedData.endDate = '';
    }
    
    setFormData(updatedData);
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.company || !formData.position || !formData.startDate) {
      return;
    }
    
    onUpdate(index, formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (!experience.company) {
      onRemove(index);
    } else {
      setFormData({
        company: experience.company || '',
        position: experience.position || '',
        location: experience.location || '',
        employmentType: experience.employmentType || 'full-time',
        startDate: experience.startDate || '',
        endDate: experience.endDate || '',
        current: experience.current || false,
        description: experience.description || '',
        achievements: experience.achievements || []
      });
      setIsEditing(false);
    }
  };

  const addAchievement = () => {
    if (!achievementText.trim()) return;
    
    const updatedData = {
      ...formData,
      achievements: [...formData.achievements, achievementText.trim()]
    };
    setFormData(updatedData);
    setAchievementText('');
  };

  const removeAchievement = (achievementIndex) => {
    const updatedData = {
      ...formData,
      achievements: formData.achievements.filter((_, i) => i !== achievementIndex)
    };
    setFormData(updatedData);
  };

  if (!isEditing) {
    return (
      <div className="experience-item">
        <div className="experience-header">
          <div className="experience-info">
            <h4>{formData.position}</h4>
            <p className="company">{formData.company}</p>
            <p className="period">
              {formData.startDate} - {formData.current ? 'Present' : formData.endDate}
              {formData.location && ` • ${formData.location}`}
            </p>
          </div>
          <div className="experience-actions">
            <button 
              type="button" 
              className="edit-btn"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            <button 
              type="button" 
              className="remove-btn"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
        </div>
        
        {formData.description && (
          <p className="experience-description">{formData.description}</p>
        )}
        
        {formData.achievements.length > 0 && (
          <div className="experience-achievements">
            <h5>Key Achievements:</h5>
            <ul>
              {formData.achievements.map((achievement, i) => (
                <li key={i}>{achievement}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="experience-item editing">
      <div className="experience-form">
        <div className="form-row">
          <div className="form-field">
            <label>Company Name *</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="Company name"
              required
            />
          </div>
          
          <div className="form-field">
            <label>Job Title *</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
              placeholder="Your job title"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="City, State/Country"
            />
          </div>
          
          <div className="form-field">
            <label>Employment Type</label>
            <select
              value={formData.employmentType}
              onChange={(e) => handleInputChange('employmentType', e.target.value)}
            >
              {EMPLOYMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Start Date *</label>
            <input
              type="month"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              required
            />
          </div>
          
          <div className="form-field">
            <div className="current-job-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.current}
                  onChange={(e) => handleInputChange('current', e.target.checked)}
                />
                I currently work here
              </label>
            </div>
            
            {!formData.current && (
              <>
                <label>End Date</label>
                <input
                  type="month"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                />
              </>
            )}
          </div>
        </div>

        <div className="form-field">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe your role, responsibilities, and key accomplishments..."
            rows={3}
          />
        </div>

        {/* Achievements Section */}
        <div className="achievements-section">
          <label>Key Achievements</label>
          <div className="achievement-input">
            <input
              type="text"
              value={achievementText}
              onChange={(e) => setAchievementText(e.target.value)}
              placeholder="Add a key achievement or accomplishment"
              onKeyPress={(e) => e.key === 'Enter' && addAchievement()}
            />
            <button type="button" onClick={addAchievement}>
              Add
            </button>
          </div>
          
          {formData.achievements.length > 0 && (
            <div className="achievements-list">
              {formData.achievements.map((achievement, i) => (
                <div key={i} className="achievement-item">
                  <span>{achievement}</span>
                  <button
                    type="button"
                    onClick={() => removeAchievement(i)}
                    className="remove-achievement"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="save-btn" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Education Item Component
function EducationItem({ education, index, onUpdate, onRemove }) {
  const [isEditing, setIsEditing] = useState(!education.institution);
  const [formData, setFormData] = useState({
    institution: education.institution || '',
    degree: education.degree || '',
    field: education.field || '',
    level: education.level || 'bachelors',
    startDate: education.startDate || '',
    endDate: education.endDate || '',
    current: education.current || false,
    gpa: education.gpa || '',
    description: education.description || ''
  });

  const handleInputChange = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    
    if (field === 'current' && value) {
      updatedData.endDate = '';
    }
    
    setFormData(updatedData);
  };

  const handleSave = () => {
    if (!formData.institution || !formData.degree) {
      return;
    }
    
    onUpdate(index, formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (!education.institution) {
      onRemove(index);
    } else {
      setFormData({
        institution: education.institution || '',
        degree: education.degree || '',
        field: education.field || '',
        level: education.level || 'bachelors',
        startDate: education.startDate || '',
        endDate: education.endDate || '',
        current: education.current || false,
        gpa: education.gpa || '',
        description: education.description || ''
      });
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="education-item">
        <div className="education-header">
          <div className="education-info">
            <h4>{formData.degree}</h4>
            <p className="institution">{formData.institution}</p>
            <p className="period">
              {formData.startDate} - {formData.current ? 'Present' : formData.endDate}
              {formData.gpa && ` • GPA: ${formData.gpa}`}
            </p>
          </div>
          <div className="education-actions">
            <button 
              type="button" 
              className="edit-btn"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            <button 
              type="button" 
              className="remove-btn"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
        </div>
        
        {formData.description && (
          <p className="education-description">{formData.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="education-item editing">
      <div className="education-form">
        <div className="form-row">
          <div className="form-field">
            <label>Institution Name *</label>
            <input
              type="text"
              value={formData.institution}
              onChange={(e) => handleInputChange('institution', e.target.value)}
              placeholder="School or institution name"
              required
            />
          </div>
          
          <div className="form-field">
            <label>Education Level</label>
            <select
              value={formData.level}
              onChange={(e) => handleInputChange('level', e.target.value)}
            >
              {EDUCATION_LEVELS.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Degree/Certificate *</label>
            <input
              type="text"
              value={formData.degree}
              onChange={(e) => handleInputChange('degree', e.target.value)}
              placeholder="e.g., Bachelor of Science, MBA, etc."
              required
            />
          </div>
          
          <div className="form-field">
            <label>Field of Study</label>
            <input
              type="text"
              value={formData.field}
              onChange={(e) => handleInputChange('field', e.target.value)}
              placeholder="e.g., Computer Science, Business Administration"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Start Date</label>
            <input
              type="month"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
            />
          </div>
          
          <div className="form-field">
            <div className="current-education-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.current}
                  onChange={(e) => handleInputChange('current', e.target.checked)}
                />
                I'm currently enrolled
              </label>
            </div>
            
            {!formData.current && (
              <>
                <label>End Date</label>
                <input
                  type="month"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                />
              </>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>GPA (Optional)</label>
            <input
              type="text"
              value={formData.gpa}
              onChange={(e) => handleInputChange('gpa', e.target.value)}
              placeholder="3.8/4.0"
            />
          </div>
        </div>

        <div className="form-field">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Relevant coursework, honors, activities, etc."
            rows={2}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="save-btn" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Certification Upload Component
function CertificationUpload({ certifications, onUpdate }) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files) => {
    const validFiles = Array.from(files).filter(file => 
      file.type.includes('pdf') || 
      file.type.includes('image') ||
      file.size < 5 * 1024 * 1024 // 5MB limit
    );

    const newCertifications = validFiles.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      file: file,
      size: file.size,
      type: file.type,
      status: 'pending'
    }));

    onUpdate([...certifications, ...newCertifications]);
  }, [certifications, onUpdate]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeCertification = (id) => {
    onUpdate(certifications.filter(cert => cert.id !== id));
  };

  return (
    <div className="certification-upload">
      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-content">
          <div className="upload-icon">📄</div>
          <p>Drag and drop certification files here</p>
          <p className="upload-hint">or <span className="browse-link">browse files</span></p>
          <input
            type="file"
            multiple
            accept=".pdf,image/*"
            onChange={(e) => handleFiles(e.target.files)}
            className="file-input"
          />
        </div>
      </div>
      
      {certifications.length > 0 && (
        <div className="certifications-list">
          <h5>Uploaded Certifications</h5>
          {certifications.map(cert => (
            <div key={cert.id} className="certification-item">
              <div className="cert-info">
                <span className="cert-name">{cert.name}</span>
                <span className="cert-size">
                  {(cert.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeCertification(cert.id)}
                className="remove-cert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExperienceStep({
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
      workExperience: data.workExperience || [],
      education: data.education || [],
      certifications: data.certifications || [],
      achievements: data.achievements || []
    }
  });

  const [workExperience, setWorkExperience] = useState(data.workExperience || []);
  const [education, setEducation] = useState(data.education || []);
  const [certifications, setCertifications] = useState(data.certifications || []);
  const [achievements, setAchievements] = useState(data.achievements || []);
  const [newAchievement, setNewAchievement] = useState({ type: 'award', title: '', description: '', date: '' });

  // Update parent when data changes
  useEffect(() => {
    if (onUpdate) {
      onUpdate({ 
        workExperience, 
        education, 
        certifications, 
        achievements 
      });
    }
  }, [workExperience, education, certifications, achievements, onUpdate]);

  // Work Experience handlers
  const addWorkExperience = () => {
    setWorkExperience([...workExperience, {}]);
  };

  const updateWorkExperience = (index, data) => {
    const updated = [...workExperience];
    updated[index] = data;
    setWorkExperience(updated);
    setValue('workExperience', updated);
  };

  const removeWorkExperience = (index) => {
    const updated = workExperience.filter((_, i) => i !== index);
    setWorkExperience(updated);
    setValue('workExperience', updated);
  };

  // Education handlers
  const addEducation = () => {
    setEducation([...education, {}]);
  };

  const updateEducation = (index, data) => {
    const updated = [...education];
    updated[index] = data;
    setEducation(updated);
    setValue('education', updated);
  };

  const removeEducation = (index) => {
    const updated = education.filter((_, i) => i !== index);
    setEducation(updated);
    setValue('education', updated);
  };

  // Achievement handlers
  const addAchievement = () => {
    if (!newAchievement.title.trim()) return;
    
    const achievement = {
      ...newAchievement,
      id: Date.now()
    };
    
    const updated = [...achievements, achievement];
    setAchievements(updated);
    setValue('achievements', updated);
    setNewAchievement({ type: 'award', title: '', description: '', date: '' });
  };

  const removeAchievement = (id) => {
    const updated = achievements.filter(achievement => achievement.id !== id);
    setAchievements(updated);
    setValue('achievements', updated);
  };

  // Form validation
  const validateForm = () => {
    return workExperience.length >= 1 || education.length >= 1;
  };

  // Handle form submission
  const onSubmit = (formData) => {
    if (!validateForm()) {
      return;
    }

    const submissionData = {
      workExperience,
      education,
      certifications,
      achievements
    };

    if (onComplete) {
      onComplete(submissionData);
    }
  };

  return (
    <div className="experience-step">
      <form onSubmit={handleSubmit(onSubmit)} className="experience-form">
        
        {/* Work Experience Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Work Experience</h3>
            <button 
              type="button" 
              className="add-btn"
              onClick={addWorkExperience}
            >
              + Add Experience
            </button>
          </div>
          <p className="section-description">
            Add your professional work experience, starting with your most recent position.
          </p>

          {workExperience.length === 0 ? (
            <div className="empty-state">
              <p>No work experience added yet. Click "Add Experience" to get started.</p>
            </div>
          ) : (
            <div className="experience-list">
              {workExperience.map((experience, index) => (
                <WorkExperienceItem
                  key={index}
                  experience={experience}
                  index={index}
                  onUpdate={updateWorkExperience}
                  onRemove={removeWorkExperience}
                />
              ))}
            </div>
          )}
        </div>

        {/* Education Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Education</h3>
            <button 
              type="button" 
              className="add-btn"
              onClick={addEducation}
            >
              + Add Education
            </button>
          </div>
          <p className="section-description">
            Add your educational background, certifications, and relevant training.
          </p>

          {education.length === 0 ? (
            <div className="empty-state">
              <p>No education added yet. Click "Add Education" to get started.</p>
            </div>
          ) : (
            <div className="education-list">
              {education.map((edu, index) => (
                <EducationItem
                  key={index}
                  education={edu}
                  index={index}
                  onUpdate={updateEducation}
                  onRemove={removeEducation}
                />
              ))}
            </div>
          )}
        </div>

        {/* Achievement Highlights */}
        <div className="form-section">
          <h3>Achievement Highlights</h3>
          <p className="section-description">
            Showcase your notable achievements, awards, publications, or other accomplishments.
          </p>

          <div className="achievement-form">
            <div className="form-row">
              <div className="form-field">
                <label>Achievement Type</label>
                <select
                  value={newAchievement.type}
                  onChange={(e) => setNewAchievement({...newAchievement, type: e.target.value})}
                >
                  {ACHIEVEMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-field">
                <label>Date</label>
                <input
                  type="month"
                  value={newAchievement.date}
                  onChange={(e) => setNewAchievement({...newAchievement, date: e.target.value})}
                />
              </div>
            </div>

            <div className="form-field">
              <label>Title *</label>
              <input
                type="text"
                value={newAchievement.title}
                onChange={(e) => setNewAchievement({...newAchievement, title: e.target.value})}
                placeholder="Achievement title"
                required
              />
            </div>

            <div className="form-field">
              <label>Description</label>
              <textarea
                value={newAchievement.description}
                onChange={(e) => setNewAchievement({...newAchievement, description: e.target.value})}
                placeholder="Describe your achievement and its impact"
                rows={2}
              />
            </div>

            <button 
              type="button" 
              className="add-achievement-btn"
              onClick={addAchievement}
              disabled={!newAchievement.title.trim()}
            >
              Add Achievement
            </button>
          </div>

          {achievements.length > 0 && (
            <div className="achievements-list">
              {achievements.map(achievement => (
                <div key={achievement.id} className="achievement-item">
                  <div className="achievement-header">
                    <div className="achievement-info">
                      <div className="achievement-type">
                        {ACHIEVEMENT_TYPES.find(t => t.value === achievement.type)?.icon} 
                        {ACHIEVEMENT_TYPES.find(t => t.value === achievement.type)?.label}
                      </div>
                      <h4>{achievement.title}</h4>
                      {achievement.date && <span className="achievement-date">{achievement.date}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAchievement(achievement.id)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                  {achievement.description && (
                    <p className="achievement-description">{achievement.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certification Upload */}
        <div className="form-section">
          <h3>Certification Documents</h3>
          <p className="section-description">
            Upload certificates, diplomas, or other credential documents (PDF or image files, max 5MB each).
          </p>

          <CertificationUpload
            certifications={certifications}
            onUpdate={setCertifications}
          />
        </div>

        {/* Validation Message */}
        {!validateForm() && (
          <div className="validation-message">
            <span className="validation-icon">ℹ️</span>
            Please add at least one work experience or education entry to continue.
          </div>
        )}

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
          
          {canSkip && onSkip && (
            <button
              type="button"
              className="button ghost"
              onClick={onSkip}
              disabled={isLoading}
            >
              Skip for Now
            </button>
          )}
          
          <button
            type="submit"
            className="button primary"
            disabled={isLoading || !validateForm()}
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </button>
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