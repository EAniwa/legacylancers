/**
 * Onboarding API Service Tests
 * Comprehensive tests for the onboarding API service layer
 */

import axios from 'axios';
import { onboardingApi, OnboardingApiError } from '../../src/services/onboarding-api';

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('OnboardingApi Service', () => {
  const mockResponse = (data, status = 200) => ({
    data,
    status,
    statusText: 'OK'
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Authentication Token Handling', () => {
    it('retrieves token from localStorage', () => {
      localStorage.setItem('legacylancers_auth_token', 'test-token');
      
      const token = onboardingApi.getAuthToken();
      expect(token).toBe('test-token');
    });

    it('retrieves token from sessionStorage when localStorage is empty', () => {
      sessionStorage.setItem('legacylancers_auth_token', 'session-token');
      
      const token = onboardingApi.getAuthToken();
      expect(token).toBe('session-token');
    });

    it('returns null when no token exists', () => {
      const token = onboardingApi.getAuthToken();
      expect(token).toBe(null);
    });

    it('handles storage errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn(() => {
        throw new Error('Storage error');
      });

      const token = onboardingApi.getAuthToken();
      expect(token).toBe(null);

      // Restore original method
      localStorage.getItem = originalGetItem;
    });
  });

  describe('Error Handling', () => {
    it('transforms server errors correctly', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR'
          }
        }
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(errorResponse),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      await expect(onboardingApi.getProgress('user-id')).rejects.toThrow(OnboardingApiError);
      await expect(onboardingApi.getProgress('user-id')).rejects.toThrow('Validation failed');
    });

    it('handles network errors', async () => {
      const networkError = {
        request: {}
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(networkError),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      await expect(onboardingApi.getProgress('user-id')).rejects.toThrow('Network error - please check your connection');
    });

    it('handles unknown errors', async () => {
      const unknownError = new Error('Unknown error');

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(unknownError),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      await expect(onboardingApi.getProgress('user-id')).rejects.toThrow('Unknown error');
    });
  });

  describe('Progress Management', () => {
    it('gets onboarding progress successfully', async () => {
      const mockProgressData = {
        data: {
          data: { 'step-1': { name: 'John' } },
          completedSteps: ['step-1']
        }
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse(mockProgressData)),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await onboardingApi.getProgress('user-id');
      expect(result).toEqual(mockProgressData.data);
    });

    it('returns null when progress not found (404)', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { error: 'Progress not found' }
        }
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(notFoundError),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await onboardingApi.getProgress('user-id');
      expect(result).toBe(null);
    });

    it('saves progress successfully', async () => {
      const progressData = {
        data: { 'step-1': { name: 'John' } },
        completedSteps: ['step-1'],
        progress: { overall: 0.5 }
      };

      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue(mockResponse({ data: 'saved' })),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.saveProgress('user-id', progressData);
      
      expect(mockClient.post).toHaveBeenCalledWith('/onboarding/progress', {
        userId: 'user-id',
        data: progressData.data,
        completedSteps: progressData.completedSteps,
        progress: progressData.progress,
        lastSaved: expect.any(String)
      });
      expect(result).toBe('saved');
    });

    it('resets progress successfully', async () => {
      const mockClient = {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn().mockResolvedValue(mockResponse({ success: true })),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.resetProgress('user-id');
      
      expect(mockClient.delete).toHaveBeenCalledWith('/onboarding/progress/user-id');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Onboarding Completion', () => {
    it('completes onboarding successfully', async () => {
      const onboardingData = {
        data: { 'step-1': { name: 'John' } },
        completedSteps: ['step-1', 'step-2']
      };

      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue(mockResponse({ data: 'completed' })),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.completeOnboarding('user-id', onboardingData);
      
      expect(mockClient.post).toHaveBeenCalledWith('/onboarding/complete', {
        userId: 'user-id',
        onboardingData,
        completedAt: expect.any(String)
      });
      expect(result).toBe('completed');
    });
  });

  describe('Profile Management', () => {
    it('gets current profile successfully', async () => {
      const mockProfile = {
        data: {
          data: {
            profile: { id: '123', name: 'John Doe' }
          }
        }
      };

      const mockClient = {
        get: jest.fn().mockResolvedValue(mockResponse(mockProfile)),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.getCurrentProfile();
      expect(result).toEqual(mockProfile.data.data.profile);
    });

    it('returns null when profile not found', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { error: 'Profile not found' }
        }
      };

      const mockClient = {
        get: jest.fn().mockRejectedValue(notFoundError),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.getCurrentProfile();
      expect(result).toBe(null);
    });

    it('updates profile successfully', async () => {
      const profileData = { name: 'John Updated' };
      const mockUpdatedProfile = {
        data: {
          data: {
            profile: { id: '123', name: 'John Updated' }
          }
        }
      };

      const mockClient = {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn().mockResolvedValue(mockResponse(mockUpdatedProfile)),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.updateProfile('profile-id', profileData);
      
      expect(mockClient.patch).toHaveBeenCalledWith('/profiles/profile-id', profileData);
      expect(result).toEqual(mockUpdatedProfile.data.data.profile);
    });
  });

  describe('File Upload', () => {
    it('uploads profile image successfully', async () => {
      const mockFile = new Blob(['test'], { type: 'image/jpeg' });
      const mockUploadResponse = {
        data: {
          data: {
            url: 'https://example.com/image.jpg',
            filename: 'image.jpg'
          }
        }
      };

      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue(mockResponse(mockUploadResponse)),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.uploadProfileImage(mockFile);
      
      expect(mockClient.post).toHaveBeenCalledWith(
        '/upload/profile-image',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      );
      expect(result).toEqual(mockUploadResponse.data.data);
    });

    it('handles upload progress callback', async () => {
      const mockFile = new Blob(['test'], { type: 'image/jpeg' });
      const onProgress = jest.fn();
      
      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockImplementation((url, data, config) => {
          // Simulate progress callback
          config.onUploadProgress({ loaded: 50, total: 100 });
          return Promise.resolve(mockResponse({ data: {} }));
        }),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      await onboardingApi.uploadProfileImage(mockFile, onProgress);
      
      expect(onProgress).toHaveBeenCalledWith(50);
    });
  });

  describe('Data Validation', () => {
    describe('Personal Info Validation', () => {
      it('validates required fields', () => {
        const invalidData = { firstName: '', email: 'invalid-email' };
        const result = onboardingApi.validateStepData('personal-info', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('firstName is required');
        expect(result.errors).toContain('lastName is required');
        expect(result.errors).toContain('Valid email address is required');
      });

      it('passes validation with valid data', () => {
        const validData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        };
        const result = onboardingApi.validateStepData('personal-info', validData);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('validates phone number format', () => {
        const invalidData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: 'invalid-phone'
        };
        const result = onboardingApi.validateStepData('personal-info', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Valid phone number is required');
      });
    });

    describe('Skills Validation', () => {
      it('validates required skills', () => {
        const invalidData = { primarySkills: [] };
        const result = onboardingApi.validateStepData('skills', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one primary skill is required');
      });

      it('validates skill count limits', () => {
        const invalidData = {
          primarySkills: new Array(11).fill('skill'),
          industry: 'Technology'
        };
        const result = onboardingApi.validateStepData('skills', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Maximum 10 primary skills allowed');
      });
    });

    describe('Experience Validation', () => {
      it('validates required work history', () => {
        const invalidData = { workHistory: [] };
        const result = onboardingApi.validateStepData('experience', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one work experience entry is required');
      });

      it('validates work history entries', () => {
        const invalidData = {
          workHistory: [
            { title: '', company: 'Company A', startDate: '2020-01-01' },
            { title: 'Developer', company: '', startDate: '2021-01-01' },
            { title: 'Manager', company: 'Company C', startDate: '' }
          ]
        };
        const result = onboardingApi.validateStepData('experience', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Job title is required for work experience 1');
        expect(result.errors).toContain('Company name is required for work experience 2');
        expect(result.errors).toContain('Start date is required for work experience 3');
      });
    });

    describe('Availability Validation', () => {
      it('validates required fields', () => {
        const invalidData = { engagementTypes: [] };
        const result = onboardingApi.validateStepData('availability', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Availability status is required');
        expect(result.errors).toContain('At least one engagement type must be selected');
      });

      it('validates hourly rate', () => {
        const invalidData = {
          availabilityStatus: 'available',
          engagementTypes: ['freelance'],
          hourlyRate: -10
        };
        const result = onboardingApi.validateStepData('availability', invalidData);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Valid hourly rate is required');
      });
    });

    it('returns valid for unknown step types', () => {
      const result = onboardingApi.validateStepData('unknown-step', {});
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Utility Functions', () => {
    it('checks auth status successfully', async () => {
      localStorage.setItem('legacylancers_auth_token', 'test-token');

      const mockClient = {
        get: jest.fn().mockResolvedValue(mockResponse({ valid: true })),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.checkAuthStatus();
      
      expect(result).toBe(true);
      expect(mockClient.get).toHaveBeenCalledWith('/auth/verify');
    });

    it('returns false when no auth token', async () => {
      const result = await onboardingApi.checkAuthStatus();
      expect(result).toBe(false);
    });

    it('gets API health status', async () => {
      const healthData = { status: 'ok', timestamp: '2023-01-01T00:00:00Z' };

      const mockClient = {
        get: jest.fn().mockResolvedValue(mockResponse(healthData)),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.getApiHealth();
      
      expect(result).toEqual(healthData);
      expect(mockClient.get).toHaveBeenCalledWith('/health');
    });

    it('gets onboarding metadata', async () => {
      const skillsData = { data: [{ name: 'JavaScript', category: 'Programming' }] };
      const industriesData = { data: ['Technology', 'Healthcare'] };

      const mockClient = {
        get: jest.fn()
          .mockResolvedValueOnce(mockResponse(skillsData))
          .mockResolvedValueOnce(mockResponse(industriesData)),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.getOnboardingMetadata();
      
      expect(result).toEqual({
        skillCategories: skillsData.data,
        industries: industriesData.data
      });
    });

    it('handles metadata fetch errors gracefully', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('Network error')),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };

      mockedAxios.create.mockReturnValue(mockClient);

      const result = await onboardingApi.getOnboardingMetadata();
      
      expect(result).toEqual({
        skillCategories: [],
        industries: []
      });
    });
  });
});