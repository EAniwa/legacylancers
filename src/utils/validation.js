/**
 * Validation Utilities
 * Comprehensive validation functions for onboarding forms
 */

import validator from 'validator';

/**
 * Base validation result structure
 */
class ValidationResult {
  constructor() {
    this.isValid = true;
    this.errors = {};
    this.warnings = {};
  }

  addError(field, message) {
    this.isValid = false;
    if (!this.errors[field]) {
      this.errors[field] = [];
    }
    this.errors[field].push(message);
  }

  addWarning(field, message) {
    if (!this.warnings[field]) {
      this.warnings[field] = [];
    }
    this.warnings[field].push(message);
  }

  getFirstError(field) {
    return this.errors[field]?.[0] || null;
  }

  hasError(field) {
    return !!this.errors[field]?.length;
  }

  hasWarning(field) {
    return !!this.warnings[field]?.length;
  }
}

/**
 * Common validation helpers
 */
const validators = {
  required: (value, fieldName) => {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  },

  minLength: (value, min, fieldName) => {
    if (value && value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (value, max, fieldName) => {
    if (value && value.length > max) {
      return `${fieldName} must be no more than ${max} characters`;
    }
    return null;
  },

  email: (value, fieldName = 'Email') => {
    if (value && !validator.isEmail(value)) {
      return `Please enter a valid ${fieldName.toLowerCase()}`;
    }
    return null;
  },

  url: (value, fieldName = 'URL') => {
    if (value && !validator.isURL(value, { require_protocol: true })) {
      return `Please enter a valid ${fieldName.toLowerCase()}`;
    }
    return null;
  },

  phone: (value, fieldName = 'Phone number') => {
    if (value && !validator.isMobilePhone(value, 'any', { strictMode: false })) {
      return `Please enter a valid ${fieldName.toLowerCase()}`;
    }
    return null;
  },

  alphaNumeric: (value, fieldName) => {
    if (value && !/^[a-zA-Z0-9\s'-]+$/.test(value)) {
      return `${fieldName} can only contain letters, numbers, spaces, hyphens, and apostrophes`;
    }
    return null;
  },

  noSpecialChars: (value, fieldName) => {
    if (value && !/^[a-zA-Z0-9\s'-.,]+$/.test(value)) {
      return `${fieldName} contains invalid characters`;
    }
    return null;
  },

  timezone: (value, fieldName = 'Timezone') => {
    if (value) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return null;
      } catch (error) {
        return `Please select a valid ${fieldName.toLowerCase()}`;
      }
    }
    return null;
  }
};

/**
 * Validate personal information step
 */
export function validatePersonalInfo(data) {
  const result = new ValidationResult();

  // First Name
  const firstNameError = validators.required(data.firstName, 'First name') ||
    validators.minLength(data.firstName, 2, 'First name') ||
    validators.maxLength(data.firstName, 50, 'First name') ||
    validators.alphaNumeric(data.firstName, 'First name');
  
  if (firstNameError) {
    result.addError('firstName', firstNameError);
  }

  // Last Name
  const lastNameError = validators.required(data.lastName, 'Last name') ||
    validators.minLength(data.lastName, 2, 'Last name') ||
    validators.maxLength(data.lastName, 50, 'Last name') ||
    validators.alphaNumeric(data.lastName, 'Last name');
  
  if (lastNameError) {
    result.addError('lastName', lastNameError);
  }

  // Preferred Name (optional)
  if (data.preferredName) {
    const preferredNameError = validators.minLength(data.preferredName, 2, 'Preferred name') ||
      validators.maxLength(data.preferredName, 50, 'Preferred name') ||
      validators.alphaNumeric(data.preferredName, 'Preferred name');
    
    if (preferredNameError) {
      result.addError('preferredName', preferredNameError);
    }
  }

  // Email
  const emailError = validators.required(data.email, 'Email address') ||
    validators.email(data.email, 'Email address');
  
  if (emailError) {
    result.addError('email', emailError);
  }

  // Phone
  const phoneError = validators.required(data.phone, 'Phone number') ||
    validators.phone(data.phone, 'Phone number');
  
  if (phoneError) {
    result.addError('phone', phoneError);
  }

  // Location validation
  if (data.location) {
    // City
    const cityError = validators.required(data.location.city, 'City') ||
      validators.minLength(data.location.city, 2, 'City') ||
      validators.maxLength(data.location.city, 100, 'City') ||
      validators.alphaNumeric(data.location.city, 'City');
    
    if (cityError) {
      result.addError('location.city', cityError);
    }

    // State
    const stateError = validators.required(data.location.state, 'State/Province') ||
      validators.minLength(data.location.state, 2, 'State/Province') ||
      validators.maxLength(data.location.state, 100, 'State/Province') ||
      validators.alphaNumeric(data.location.state, 'State/Province');
    
    if (stateError) {
      result.addError('location.state', stateError);
    }

    // Country
    const countryError = validators.required(data.location.country, 'Country');
    
    if (countryError) {
      result.addError('location.country', countryError);
    }

    // Timezone
    const timezoneError = validators.required(data.location.timezone, 'Timezone') ||
      validators.timezone(data.location.timezone, 'Timezone');
    
    if (timezoneError) {
      result.addError('location.timezone', timezoneError);
    }
  } else {
    result.addError('location', 'Location information is required');
  }

  // Bio
  const bioError = validators.required(data.bio, 'Professional bio') ||
    validators.minLength(data.bio, 50, 'Professional bio') ||
    validators.maxLength(data.bio, 1000, 'Professional bio');
  
  if (bioError) {
    result.addError('bio', bioError);
  }

  // Optional fields validation
  if (data.linkedInUrl) {
    const linkedInError = validators.url(data.linkedInUrl, 'LinkedIn URL');
    if (linkedInError) {
      result.addError('linkedInUrl', linkedInError);
    } else if (!data.linkedInUrl.includes('linkedin.com')) {
      result.addError('linkedInUrl', 'Please enter a valid LinkedIn profile URL');
    }
  }

  if (data.website) {
    const websiteError = validators.url(data.website, 'Website URL');
    if (websiteError) {
      result.addError('website', websiteError);
    }
  }

  return {
    isValid: result.isValid,
    errors: Object.fromEntries(
      Object.entries(result.errors).map(([key, messages]) => [key, messages[0]])
    ),
    warnings: Object.fromEntries(
      Object.entries(result.warnings).map(([key, messages]) => [key, messages[0]])
    )
  };
}

/**
 * Validate skills step
 */
export function validateSkills(data) {
  const result = new ValidationResult();

  // Skills array validation
  if (!data.skills || !Array.isArray(data.skills) || data.skills.length === 0) {
    result.addError('skills', 'Please select at least one skill');
  } else {
    // Validate minimum number of skills
    if (data.skills.length < 3) {
      result.addError('skills', 'Please select at least 3 skills to showcase your expertise');
    }

    // Validate maximum number of skills
    if (data.skills.length > 20) {
      result.addError('skills', 'Please select no more than 20 skills to keep your profile focused');
    }

    // Validate each skill
    data.skills.forEach((skill, index) => {
      if (!skill.name || skill.name.trim().length === 0) {
        result.addError(`skills.${index}.name`, 'Skill name is required');
      }

      if (!skill.level || !['beginner', 'intermediate', 'advanced', 'expert'].includes(skill.level)) {
        result.addError(`skills.${index}.level`, 'Please select a valid skill level');
      }

      if (skill.yearsOfExperience !== undefined && skill.yearsOfExperience !== null) {
        if (skill.yearsOfExperience < 0 || skill.yearsOfExperience > 50) {
          result.addError(`skills.${index}.yearsOfExperience`, 'Years of experience must be between 0 and 50');
        }
      }
    });
  }

  // Categories validation
  if (!data.categories || !Array.isArray(data.categories) || data.categories.length === 0) {
    result.addError('categories', 'Please organize your skills into at least one category');
  } else if (data.categories.length > 6) {
    result.addError('categories', 'Please use no more than 6 categories to keep your profile organized');
  }

  // Primary expertise validation
  if (!data.primaryExpertise || data.primaryExpertise.trim().length === 0) {
    result.addError('primaryExpertise', 'Please select your primary area of expertise');
  }

  return {
    isValid: result.isValid,
    errors: Object.fromEntries(
      Object.entries(result.errors).map(([key, messages]) => [key, messages[0]])
    ),
    warnings: Object.fromEntries(
      Object.entries(result.warnings).map(([key, messages]) => [key, messages[0]])
    )
  };
}

/**
 * Validate experience step
 */
export function validateExperience(data) {
  const result = new ValidationResult();

  // Work history validation
  if (!data.workHistory || !Array.isArray(data.workHistory) || data.workHistory.length === 0) {
    result.addError('workHistory', 'Please add at least one work experience');
  } else {
    data.workHistory.forEach((job, index) => {
      // Company name
      if (!job.company || job.company.trim().length === 0) {
        result.addError(`workHistory.${index}.company`, 'Company name is required');
      } else if (job.company.length > 100) {
        result.addError(`workHistory.${index}.company`, 'Company name must be less than 100 characters');
      }

      // Job title
      if (!job.title || job.title.trim().length === 0) {
        result.addError(`workHistory.${index}.title`, 'Job title is required');
      } else if (job.title.length > 100) {
        result.addError(`workHistory.${index}.title`, 'Job title must be less than 100 characters');
      }

      // Start date
      if (!job.startDate) {
        result.addError(`workHistory.${index}.startDate`, 'Start date is required');
      }

      // End date validation (if not current job)
      if (!job.isCurrent && !job.endDate) {
        result.addError(`workHistory.${index}.endDate`, 'End date is required for past positions');
      }

      // Date range validation
      if (job.startDate && job.endDate) {
        const start = new Date(job.startDate);
        const end = new Date(job.endDate);
        if (start > end) {
          result.addError(`workHistory.${index}.endDate`, 'End date must be after start date');
        }
      }

      // Description
      if (job.description && job.description.length > 1000) {
        result.addError(`workHistory.${index}.description`, 'Description must be less than 1000 characters');
      }
    });
  }

  // Education validation (optional, but if provided must be valid)
  if (data.education && Array.isArray(data.education)) {
    data.education.forEach((edu, index) => {
      if (edu.institution && edu.institution.length > 100) {
        result.addError(`education.${index}.institution`, 'Institution name must be less than 100 characters');
      }
      
      if (edu.degree && edu.degree.length > 100) {
        result.addError(`education.${index}.degree`, 'Degree must be less than 100 characters');
      }

      if (edu.field && edu.field.length > 100) {
        result.addError(`education.${index}.field`, 'Field of study must be less than 100 characters');
      }
    });
  }

  // Certifications validation (optional)
  if (data.certifications && Array.isArray(data.certifications)) {
    data.certifications.forEach((cert, index) => {
      if (cert.name && cert.name.length > 200) {
        result.addError(`certifications.${index}.name`, 'Certification name must be less than 200 characters');
      }
      
      if (cert.issuer && cert.issuer.length > 100) {
        result.addError(`certifications.${index}.issuer`, 'Issuer must be less than 100 characters');
      }
    });
  }

  return {
    isValid: result.isValid,
    errors: Object.fromEntries(
      Object.entries(result.errors).map(([key, messages]) => [key, messages[0]])
    ),
    warnings: Object.fromEntries(
      Object.entries(result.warnings).map(([key, messages]) => [key, messages[0]])
    )
  };
}

/**
 * Validate availability step
 */
export function validateAvailability(data) {
  const result = new ValidationResult();

  // Weekly availability validation
  if (!data.weeklyAvailability || typeof data.weeklyAvailability !== 'object') {
    result.addError('weeklyAvailability', 'Please set your weekly availability');
  } else {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let hasAnyAvailability = false;

    days.forEach(day => {
      const availability = data.weeklyAvailability[day];
      if (availability && availability.available) {
        hasAnyAvailability = true;
        
        // Validate time slots
        if (!availability.timeSlots || !Array.isArray(availability.timeSlots) || availability.timeSlots.length === 0) {
          result.addError(`weeklyAvailability.${day}`, `Please add time slots for ${day}`);
        } else {
          availability.timeSlots.forEach((slot, index) => {
            if (!slot.start || !slot.end) {
              result.addError(`weeklyAvailability.${day}.${index}`, 'Start and end times are required');
            } else if (slot.start >= slot.end) {
              result.addError(`weeklyAvailability.${day}.${index}`, 'End time must be after start time');
            }
          });
        }
      }
    });

    if (!hasAnyAvailability) {
      result.addError('weeklyAvailability', 'Please select at least one day when you are available');
    }
  }

  // Hourly rate validation
  if (!data.hourlyRate || data.hourlyRate <= 0) {
    result.addError('hourlyRate', 'Please set your hourly rate');
  } else if (data.hourlyRate > 1000) {
    result.addError('hourlyRate', 'Hourly rate seems too high. Please verify the amount.');
  } else if (data.hourlyRate < 5) {
    result.addWarning('hourlyRate', 'Your rate is below market average. Consider increasing it to attract quality clients.');
  }

  // Currency validation
  if (!data.currency) {
    result.addError('currency', 'Please select a currency');
  }

  // Project types validation
  if (!data.preferredProjectTypes || !Array.isArray(data.preferredProjectTypes) || data.preferredProjectTypes.length === 0) {
    result.addError('preferredProjectTypes', 'Please select at least one preferred project type');
  }

  // Minimum project duration validation
  if (!data.minimumProjectDuration) {
    result.addError('minimumProjectDuration', 'Please select minimum project duration');
  }

  // Maximum project duration validation (optional)
  if (data.maximumProjectDuration && data.minimumProjectDuration) {
    const minDuration = parseInt(data.minimumProjectDuration);
    const maxDuration = parseInt(data.maximumProjectDuration);
    
    if (maxDuration < minDuration) {
      result.addError('maximumProjectDuration', 'Maximum duration must be greater than minimum duration');
    }
  }

  return {
    isValid: result.isValid,
    errors: Object.fromEntries(
      Object.entries(result.errors).map(([key, messages]) => [key, messages[0]])
    ),
    warnings: Object.fromEntries(
      Object.entries(result.warnings).map(([key, messages]) => [key, messages[0]])
    )
  };
}

/**
 * Validate complete onboarding profile
 */
export function validateCompleteProfile(data) {
  const personalInfoResult = validatePersonalInfo(data.personalInfo || {});
  const skillsResult = validateSkills(data.skills || {});
  const experienceResult = validateExperience(data.experience || {});
  const availabilityResult = validateAvailability(data.availability || {});

  return {
    isValid: personalInfoResult.isValid && skillsResult.isValid && 
             experienceResult.isValid && availabilityResult.isValid,
    errors: {
      ...personalInfoResult.errors,
      ...skillsResult.errors,
      ...experienceResult.errors,
      ...availabilityResult.errors
    },
    warnings: {
      ...personalInfoResult.warnings,
      ...skillsResult.warnings,
      ...experienceResult.warnings,
      ...availabilityResult.warnings
    },
    stepResults: {
      personalInfo: personalInfoResult,
      skills: skillsResult,
      experience: experienceResult,
      availability: availabilityResult
    }
  };
}

/**
 * Real-time field validation
 */
export function validateField(fieldName, value, context = {}) {
  const result = new ValidationResult();

  switch (fieldName) {
    case 'firstName':
    case 'lastName':
      const nameError = validators.required(value, fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()) ||
        validators.minLength(value, 2, fieldName) ||
        validators.maxLength(value, 50, fieldName) ||
        validators.alphaNumeric(value, fieldName);
      if (nameError) result.addError(fieldName, nameError);
      break;

    case 'email':
      const emailError = validators.required(value, 'Email address') ||
        validators.email(value, 'Email address');
      if (emailError) result.addError(fieldName, emailError);
      break;

    case 'phone':
      const phoneError = validators.required(value, 'Phone number') ||
        validators.phone(value, 'Phone number');
      if (phoneError) result.addError(fieldName, phoneError);
      break;

    case 'bio':
      const bioError = validators.required(value, 'Professional bio') ||
        validators.minLength(value, 50, 'Professional bio') ||
        validators.maxLength(value, 1000, 'Professional bio');
      if (bioError) result.addError(fieldName, bioError);
      break;

    case 'linkedInUrl':
      if (value) {
        const linkedInError = validators.url(value, 'LinkedIn URL');
        if (linkedInError) {
          result.addError(fieldName, linkedInError);
        } else if (!value.includes('linkedin.com')) {
          result.addError(fieldName, 'Please enter a valid LinkedIn profile URL');
        }
      }
      break;

    case 'website':
      if (value) {
        const websiteError = validators.url(value, 'Website URL');
        if (websiteError) result.addError(fieldName, websiteError);
      }
      break;

    default:
      // Generic validation for unknown fields
      if (context.required && !value) {
        result.addError(fieldName, `${fieldName} is required`);
      }
      break;
  }

  return {
    isValid: result.isValid,
    error: result.getFirstError(fieldName),
    warning: result.warnings[fieldName]?.[0] || null
  };
}

export default {
  validatePersonalInfo,
  validateSkills,
  validateExperience,
  validateAvailability,
  validateCompleteProfile,
  validateField,
  validators
};