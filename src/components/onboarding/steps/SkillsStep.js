/**
 * SkillsStep Component
 * Skills selection, categorization, and proficiency management
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import './SkillsStep.css';

const SKILL_CATEGORIES = [
  { value: 'technical', label: 'Technical Skills', color: '#4CAF50' },
  { value: 'communication', label: 'Communication', color: '#2196F3' },
  { value: 'leadership', label: 'Leadership', color: '#FF9800' },
  { value: 'project-management', label: 'Project Management', color: '#9C27B0' },
  { value: 'analytical', label: 'Analytical', color: '#607D8B' },
  { value: 'creative', label: 'Creative', color: '#E91E63' },
  { value: 'business', label: 'Business', color: '#795548' }
];

const PROFICIENCY_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Basic understanding' },
  { value: 'intermediate', label: 'Intermediate', description: 'Working knowledge' },
  { value: 'advanced', label: 'Advanced', description: 'Expert level' },
  { value: 'expert', label: 'Expert', description: 'Industry leader' }
];

const POPULAR_SKILLS = [
  { name: 'JavaScript', category: 'technical' },
  { name: 'Python', category: 'technical' },
  { name: 'Project Management', category: 'project-management' },
  { name: 'Leadership', category: 'leadership' },
  { name: 'Communication', category: 'communication' },
  { name: 'Data Analysis', category: 'analytical' },
  { name: 'Strategic Planning', category: 'business' },
  { name: 'Team Building', category: 'leadership' },
  { name: 'Public Speaking', category: 'communication' },
  { name: 'SQL', category: 'technical' },
  { name: 'Marketing Strategy', category: 'business' },
  { name: 'Financial Analysis', category: 'analytical' }
];

const DragDropItemTypes = {
  SKILL: 'skill'
};

// Draggable skill component
function DraggableSkill({ skill, index, onRemove, onUpdate }) {
  const [{ isDragging }, drag] = useDrag({
    type: DragDropItemTypes.SKILL,
    item: { skill, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const handleProficiencyChange = (newProficiency) => {
    onUpdate(index, { ...skill, proficiency: newProficiency });
  };

  return (
    <div 
      ref={drag}
      className={`skill-item ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="skill-header">
        <span className="skill-name">{skill.name}</span>
        <button 
          type="button"
          className="skill-remove"
          onClick={() => onRemove(index)}
          aria-label={`Remove ${skill.name}`}
        >
          ×
        </button>
      </div>
      
      <div className="skill-proficiency">
        <label className="proficiency-label">Proficiency:</label>
        <select
          value={skill.proficiency || 'intermediate'}
          onChange={(e) => handleProficiencyChange(e.target.value)}
          className="proficiency-select"
        >
          {PROFICIENCY_LEVELS.map(level => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Category drop zone component
function CategoryDropZone({ category, skills, onDrop, onUpdateSkill, onRemoveSkill }) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DragDropItemTypes.SKILL,
    drop: (item) => onDrop(item.skill, item.index, category.value),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const categorySkills = skills.filter(skill => skill.category === category.value);

  return (
    <div 
      ref={drop}
      className={`category-zone ${isOver && canDrop ? 'drop-active' : ''}`}
      style={{ borderColor: category.color }}
    >
      <div className="category-header" style={{ backgroundColor: category.color }}>
        <h4>{category.label}</h4>
        <span className="skill-count">{categorySkills.length} skills</span>
      </div>
      
      <div className="category-skills">
        {categorySkills.length === 0 ? (
          <div className="empty-category">
            <p>Drag skills here to categorize them as {category.label.toLowerCase()}</p>
          </div>
        ) : (
          categorySkills.map((skill, index) => {
            const globalIndex = skills.indexOf(skill);
            return (
              <DraggableSkill
                key={`${skill.name}-${globalIndex}`}
                skill={skill}
                index={globalIndex}
                onRemove={onRemoveSkill}
                onUpdate={onUpdateSkill}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SkillsStep({
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
      skills: data.skills || [],
      skillSearch: '',
      selectedCategory: null
    }
  });

  const [skills, setSkills] = useState(data.skills || []);
  const [skillOptions, setSkillOptions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Watch for changes
  const watchedSkills = watch('skills');

  // Update parent when skills change
  useEffect(() => {
    if (onUpdate) {
      onUpdate({ skills });
    }
  }, [skills, onUpdate]);

  // Load skill suggestions
  const loadSkillOptions = useCallback(async (inputValue) => {
    if (!inputValue || inputValue.length < 2) {
      setSkillOptions([]);
      return;
    }

    setIsSearching(true);
    try {
      // In a real app, this would be an API call
      // Simulating API search with timeout
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const filtered = POPULAR_SKILLS
        .filter(skill => 
          skill.name.toLowerCase().includes(inputValue.toLowerCase()) &&
          !skills.some(existingSkill => 
            existingSkill.name.toLowerCase() === skill.name.toLowerCase()
          )
        )
        .map(skill => ({
          value: skill.name,
          label: skill.name,
          category: skill.category
        }));

      // Add custom option if not found
      if (!filtered.some(option => option.value.toLowerCase() === inputValue.toLowerCase())) {
        filtered.unshift({
          value: inputValue,
          label: `Add "${inputValue}"`,
          category: 'technical', // Default category
          isCustom: true
        });
      }

      setSkillOptions(filtered);
    } catch (error) {
      console.error('Failed to load skill options:', error);
      setSkillOptions([]);
    } finally {
      setIsSearching(false);
    }
  }, [skills]);

  // Add skill
  const addSkill = useCallback((selectedOption) => {
    if (!selectedOption) return;

    const newSkill = {
      name: selectedOption.value,
      category: selectedOption.category || 'technical',
      proficiency: 'intermediate',
      isCustom: selectedOption.isCustom || false
    };

    const updatedSkills = [...skills, newSkill];
    setSkills(updatedSkills);
    setValue('skills', updatedSkills);
    setValue('skillSearch', '');
    setSkillOptions([]);
  }, [skills, setValue]);

  // Remove skill
  const removeSkill = useCallback((index) => {
    const updatedSkills = skills.filter((_, i) => i !== index);
    setSkills(updatedSkills);
    setValue('skills', updatedSkills);
  }, [skills, setValue]);

  // Update skill
  const updateSkill = useCallback((index, updatedSkill) => {
    const updatedSkills = [...skills];
    updatedSkills[index] = updatedSkill;
    setSkills(updatedSkills);
    setValue('skills', updatedSkills);
  }, [skills, setValue]);

  // Handle drag and drop
  const handleDrop = useCallback((skill, fromIndex, toCategory) => {
    const updatedSkills = [...skills];
    const skillIndex = updatedSkills.findIndex(s => s === skill);
    
    if (skillIndex >= 0) {
      updatedSkills[skillIndex] = { ...skill, category: toCategory };
      setSkills(updatedSkills);
      setValue('skills', updatedSkills);
    }
  }, [skills, setValue]);

  // Add popular skill
  const addPopularSkill = useCallback((popularSkill) => {
    if (skills.some(skill => skill.name.toLowerCase() === popularSkill.name.toLowerCase())) {
      return; // Skill already added
    }

    const newSkill = {
      name: popularSkill.name,
      category: popularSkill.category,
      proficiency: 'intermediate',
      isCustom: false
    };

    const updatedSkills = [...skills, newSkill];
    setSkills(updatedSkills);
    setValue('skills', updatedSkills);
  }, [skills, setValue]);

  // Form validation
  const validateForm = useCallback(() => {
    return skills.length >= 3; // Minimum 3 skills required
  }, [skills]);

  // Handle form submission
  const onSubmit = useCallback((formData) => {
    if (!validateForm()) {
      return;
    }

    const submissionData = {
      skills: skills.map(skill => ({
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency || 'intermediate',
        isCustom: skill.isCustom || false
      }))
    };

    if (onComplete) {
      onComplete(submissionData);
    }
  }, [skills, validateForm, onComplete]);

  // Get skills by category for display
  const skillsByCategory = useMemo(() => {
    const grouped = {};
    SKILL_CATEGORIES.forEach(cat => {
      grouped[cat.value] = skills.filter(skill => skill.category === cat.value);
    });
    return grouped;
  }, [skills]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="skills-step">
        <form onSubmit={handleSubmit(onSubmit)} className="skills-form">
          
          {/* Skill Search Section */}
          <div className="form-section">
            <h3>Add Your Skills</h3>
            <p className="section-description">
              Search and add skills that represent your expertise. You can drag them to different categories below.
            </p>

            <div className="skill-search">
              <Controller
                name="skillSearch"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    options={skillOptions}
                    isLoading={isSearching}
                    placeholder="Search for skills (e.g., JavaScript, Project Management)"
                    onInputChange={loadSkillOptions}
                    onChange={addSkill}
                    value={null}
                    noOptionsMessage={({ inputValue }) => 
                      inputValue.length < 2 ? 'Type at least 2 characters' : 'No skills found'
                    }
                    className="skill-select"
                    classNamePrefix="skill-select"
                    loadingMessage={() => 'Searching skills...'}
                  />
                )}
              />
            </div>

            {/* Popular Skills */}
            {showSuggestions && skills.length < 5 && (
              <div className="popular-skills">
                <h4>Popular Skills</h4>
                <div className="popular-skills-grid">
                  {POPULAR_SKILLS
                    .filter(popular => 
                      !skills.some(skill => 
                        skill.name.toLowerCase() === popular.name.toLowerCase()
                      )
                    )
                    .slice(0, 8)
                    .map(popular => (
                      <button
                        key={popular.name}
                        type="button"
                        className="popular-skill-btn"
                        onClick={() => addPopularSkill(popular)}
                      >
                        + {popular.name}
                      </button>
                    ))
                  }
                </div>
                
                <button
                  type="button"
                  className="hide-suggestions"
                  onClick={() => setShowSuggestions(false)}
                >
                  Hide suggestions
                </button>
              </div>
            )}
          </div>

          {/* Skills Categorization */}
          <div className="form-section">
            <h3>Categorize Your Skills</h3>
            <p className="section-description">
              Drag and drop your skills into the appropriate categories. This helps clients find you more easily.
            </p>

            {skills.length === 0 ? (
              <div className="no-skills">
                <p>Add some skills above to start organizing them into categories.</p>
              </div>
            ) : (
              <div className="categories-grid">
                {SKILL_CATEGORIES.map(category => (
                  <CategoryDropZone
                    key={category.value}
                    category={category}
                    skills={skills}
                    onDrop={handleDrop}
                    onUpdateSkill={updateSkill}
                    onRemoveSkill={removeSkill}
                  />
                ))}
              </div>
            )}

            {/* Validation Message */}
            {skills.length < 3 && (
              <div className="validation-message">
                <span className="validation-icon">ℹ️</span>
                Please add at least 3 skills to continue. You have {skills.length} skill{skills.length === 1 ? '' : 's'}.
              </div>
            )}
          </div>

          {/* Skills Summary */}
          {skills.length > 0 && (
            <div className="form-section">
              <h3>Your Skills Summary</h3>
              <div className="skills-summary">
                {SKILL_CATEGORIES.map(category => {
                  const categorySkills = skillsByCategory[category.value] || [];
                  if (categorySkills.length === 0) return null;

                  return (
                    <div key={category.value} className="summary-category">
                      <h4 style={{ color: category.color }}>{category.label}</h4>
                      <div className="summary-skills">
                        {categorySkills.map((skill, index) => (
                          <span key={index} className="summary-skill">
                            {skill.name} ({skill.proficiency})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
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
    </DndProvider>
  );
}