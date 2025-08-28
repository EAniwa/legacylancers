/**
 * Onboarding API Service
 * Service layer for onboarding data persistence and integration with backend
 */

import axios from 'axios';

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';
const ONBOARDING_ENDPOINTS = {
  getProgress: '/onboarding/progress',
  saveProgress: '/onboarding/progress',
  resetProgress: '/onboarding/progress',
  completeOnboarding: '/onboarding/complete',
  getProfile: '/profiles/me',
  updateProfile: '/profiles',
  uploadImage: '/upload/profile-image'
};

class OnboardingApiError extends Error {
  constructor(message, code, status, details = null) {
    super(message);
    this.name = 'OnboardingApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class OnboardingApi {
  constructor() {
    // Configure axios instance with defaults
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        return this.handleApiError(error);
      }
    );
  }

  // Get authentication token from storage
  getAuthToken() {
    try {
      // Try localStorage first, then sessionStorage
      return localStorage.getItem('legacylancers_auth_token') || 
             sessionStorage.getItem('legacylancers_auth_token');
    } catch (error) {
      console.warn('Failed to get auth token:', error);
      return null;
    }
  }

  // Handle API errors with proper error transformation
  handleApiError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const message = data?.error || data?.message || 'API request failed';
      const code = data?.code || 'API_ERROR';
      
      throw new OnboardingApiError(message, code, status, data);
    } else if (error.request) {
      // Request was made but no response received
      throw new OnboardingApiError(
        'Network error - please check your connection',
        'NETWORK_ERROR',
        0
      );
    } else {
      // Something else went wrong
      throw new OnboardingApiError(
        error.message || 'Unknown error occurred',
        'UNKNOWN_ERROR',
        0
      );
    }
  }

  // Get onboarding progress for a user
  async getProgress(userId) {
    try {
      const response = await this.client.get(`${ONBOARDING_ENDPOINTS.getProgress}/${userId}`);
      return response.data?.data || null;
    } catch (error) {
      // If progress doesn't exist yet, return null instead of throwing
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Save onboarding progress
  async saveProgress(userId, progressData) {
    try {
      const payload = {
        userId,
        data: progressData.data || {},
        completedSteps: progressData.completedSteps || [],
        progress: progressData.progress || {},
        lastSaved: progressData.lastSaved || new Date().toISOString()
      };

      const response = await this.client.post(ONBOARDING_ENDPOINTS.saveProgress, payload);
      return response.data?.data;
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
      throw error;
    }
  }

  // Reset onboarding progress (delete all data)
  async resetProgress(userId) {
    try {
      const response = await this.client.delete(`${ONBOARDING_ENDPOINTS.resetProgress}/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to reset onboarding progress:', error);
      throw error;
    }
  }

  // Complete onboarding and create/update profile
  async completeOnboarding(userId, onboardingData) {
    try {
      const payload = {
        userId,
        onboardingData,
        completedAt: new Date().toISOString()
      };

      const response = await this.client.post(ONBOARDING_ENDPOINTS.completeOnboarding, payload);
      return response.data?.data;
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
    }
  }

  // Get current user profile (for pre-filling data)
  async getCurrentProfile() {
    try {
      const response = await this.client.get(ONBOARDING_ENDPOINTS.getProfile);
      return response.data?.data?.profile || null;
    } catch (error) {
      if (error.status === 404) {
        return null; // No profile exists yet
      }
      throw error;
    }
  }

  // Update profile with onboarding data
  async updateProfile(profileId, profileData) {
    try {
      const response = await this.client.patch(`${ONBOARDING_ENDPOINTS.updateProfile}/${profileId}`, profileData);
      return response.data?.data?.profile;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }

  // Upload profile image
  async uploadProfileImage(file, onProgress = null) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      };

      if (onProgress) {
        config.onUploadProgress = (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        };
      }

      const response = await this.client.post(ONBOARDING_ENDPOINTS.uploadImage, formData, config);
      return response.data?.data;
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      throw error;
    }
  }

  // Validate step data before saving
  validateStepData(stepId, stepData) {
    const validators = {
      'personal-info': this.validatePersonalInfo,
      'skills': this.validateSkills,
      'experience': this.validateExperience,
      'availability': this.validateAvailability,
      'review': this.validateReview
    };

    const validator = validators[stepId];
    if (!validator) {
      return { isValid: true, errors: [] };
    }

    return validator.call(this, stepData);
  }

  // Step-specific validation functions
  validatePersonalInfo(data) {
    const errors = [];
    const required = ['firstName', 'lastName', 'email'];

    required.forEach(field => {
      if (!data[field] || data[field].toString().trim() === '') {
        errors.push(`${field} is required`);
      }
    });

    if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
      errors.push('Valid email address is required');
    }

    if (data.phone && !/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
      errors.push('Valid phone number is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateSkills(data) {
    const errors = [];

    if (!data.primarySkills || data.primarySkills.length === 0) {
      errors.push('At least one primary skill is required');
    }

    if (data.primarySkills && data.primarySkills.length > 10) {
      errors.push('Maximum 10 primary skills allowed');
    }

    if (!data.industry || data.industry.trim() === '') {
      errors.push('Industry selection is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateExperience(data) {
    const errors = [];

    if (!data.workHistory || data.workHistory.length === 0) {
      errors.push('At least one work experience entry is required');
    }

    if (data.workHistory) {
      data.workHistory.forEach((job, index) => {
        if (!job.title || job.title.trim() === '') {
          errors.push(`Job title is required for work experience ${index + 1}`);
        }
        if (!job.company || job.company.trim() === '') {
          errors.push(`Company name is required for work experience ${index + 1}`);
        }
        if (!job.startDate) {
          errors.push(`Start date is required for work experience ${index + 1}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateAvailability(data) {
    const errors = [];

    if (!data.availabilityStatus) {
      errors.push('Availability status is required');
    }

    if (!data.engagementTypes || data.engagementTypes.length === 0) {
      errors.push('At least one engagement type must be selected');
    }

    if (data.hourlyRate && (isNaN(data.hourlyRate) || data.hourlyRate < 0)) {
      errors.push('Valid hourly rate is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateReview(data) {
    const errors = [];

    // Review step validation would check that all previous steps are complete
    // This is handled by the useOnboardingState hook

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Utility functions
  async checkAuthStatus() {
    try {
      const token = this.getAuthToken();
      if (!token) {
        throw new OnboardingApiError('No authentication token found', 'NO_AUTH_TOKEN', 401);
      }

      // Verify token is valid by making a simple API call
      await this.client.get('/auth/verify');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get API health status
  async getApiHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new OnboardingApiError('API health check failed', 'API_UNAVAILABLE', 503);
    }
  }

  // Prefetch data for onboarding (skills, industries, etc.)
  async getOnboardingMetadata() {
    try {
      const [skillsResponse, industriesResponse] = await Promise.all([
        this.client.get('/skills/categories'),
        this.client.get('/profiles/industries')
      ]);

      return {
        skillCategories: skillsResponse.data?.data || [],
        industries: industriesResponse.data?.data || []
      };
    } catch (error) {
      console.warn('Failed to load onboarding metadata:', error);
      return {
        skillCategories: [],
        industries: []
      };
    }
  }
}

// Create and export singleton instance
export const onboardingApi = new OnboardingApi();

// Export error class for error handling
export { OnboardingApiError };

// Export default class for testing or custom instances
export default OnboardingApi;