/**
 * useOnboardingState Hook Tests
 * Comprehensive tests for onboarding state management and auto-save functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnboardingState } from '../../src/hooks/useOnboardingState';
import { onboardingApi } from '../../src/services/onboarding-api';

// Mock the onboarding API
jest.mock('../../src/services/onboarding-api', () => ({
  onboardingApi: {
    getProgress: jest.fn(),
    saveProgress: jest.fn(),
    resetProgress: jest.fn()
  }
}));

const mockSteps = [
  {
    id: 'step-1',
    title: 'Personal Info',
    required: true,
    estimated_time: '5 minutes'
  },
  {
    id: 'step-2',
    title: 'Skills',
    required: true,
    estimated_time: '10 minutes'
  },
  {
    id: 'step-3',
    title: 'Experience',
    required: false,
    estimated_time: '15 minutes'
  }
];

describe('useOnboardingState Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Initialization', () => {
    it('initializes with default values', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.data).toEqual({});
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.progress.overall).toBe(0);
    });

    it('loads data from localStorage when no server data', async () => {
      const storageData = {
        data: { 'step-1': { name: 'John' } },
        completedSteps: ['step-1'],
        lastSaved: '2023-01-01T00:00:00.000Z'
      };
      localStorage.setItem('legacylancers_onboarding_test-user', JSON.stringify(storageData));

      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.data).toEqual({ 'step-1': { name: 'John' } });
      expect(result.current.completedSteps).toEqual(['step-1']);
      expect(result.current.lastSaved).toBe('2023-01-01T00:00:00.000Z');
    });

    it('merges server data with local storage', async () => {
      const storageData = {
        data: { 'step-1': { name: 'John' } },
        completedSteps: ['step-1']
      };
      localStorage.setItem('legacylancers_onboarding_test-user', JSON.stringify(storageData));

      const serverData = {
        data: { 'step-2': { skills: ['JavaScript'] } },
        completedSteps: ['step-2']
      };
      onboardingApi.getProgress.mockResolvedValue(serverData);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.data).toEqual({
        'step-1': { name: 'John' },
        'step-2': { skills: ['JavaScript'] }
      });
      expect(result.current.completedSteps).toEqual(['step-1', 'step-2']);
    });

    it('handles initialization errors gracefully', async () => {
      onboardingApi.getProgress.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.error).toBe('Failed to load your onboarding progress');
    });
  });

  describe('Data Updates', () => {
    it('updates step data correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John', age: 30 });
      });

      expect(result.current.data['step-1']).toEqual({ name: 'John', age: 30 });
      expect(result.current.isDirty).toBe(true);
    });

    it('merges step data with existing data', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      act(() => {
        result.current.updateStepData('step-1', { age: 30 });
      });

      expect(result.current.data['step-1']).toEqual({ name: 'John', age: 30 });
    });

    it('completes steps correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.completeStep('step-1');
      });

      expect(result.current.completedSteps).toContain('step-1');
      expect(result.current.isDirty).toBe(true);
    });

    it('uncompletes steps correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.completeStep('step-1');
      });

      act(() => {
        result.current.uncompleteStep('step-1');
      });

      expect(result.current.completedSteps).not.toContain('step-1');
    });
  });

  describe('Progress Calculation', () => {
    it('calculates overall progress correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.completeStep('step-1');
      });

      expect(result.current.progress.overall).toBeCloseTo(1/3);
      expect(result.current.progress.completionPercentage).toBe(33);
    });

    it('calculates step-specific progress', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John', age: '' });
      });

      // Should show 50% for step with 1 filled field out of 2
      expect(result.current.progress.stepProgress['step-1']).toBe(0.5);
    });

    it('estimates time remaining correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.completeStep('step-1');
      });

      // Should calculate remaining time for step-2 (10 min) + step-3 (15 min) = 25 min
      expect(result.current.progress.estimatedTimeRemaining).toBe(25);
    });
  });

  describe('Save Functionality', () => {
    it('saves progress to both storage and server', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.saveProgress.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      await act(async () => {
        await result.current.saveProgress();
      });

      expect(onboardingApi.saveProgress).toHaveBeenCalledWith('test-user', expect.objectContaining({
        data: { 'step-1': { name: 'John' } },
        completedSteps: []
      }));

      expect(result.current.isDirty).toBe(false);
      expect(result.current.lastSaved).toBeTruthy();
    });

    it('handles save errors gracefully', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.saveProgress.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      await act(async () => {
        await result.current.saveProgress();
      });

      expect(result.current.error).toBe('Failed to save your progress');
    });

    it('saves immediately when immediate flag is true', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.saveProgress.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        result.current.updateStepData('step-1', { name: 'John' }, true);
      });

      expect(onboardingApi.saveProgress).toHaveBeenCalled();
    });
  });

  describe('Auto-save Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('auto-saves when enabled and dirty', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.saveProgress.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          autoSave: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      expect(result.current.isDirty).toBe(true);

      // Fast-forward time to trigger auto-save
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(onboardingApi.saveProgress).toHaveBeenCalled();
      });
    });

    it('does not auto-save when disabled', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.saveProgress.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          autoSave: false
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(onboardingApi.saveProgress).not.toHaveBeenCalled();
    });
  });

  describe('Query Functions', () => {
    it('returns step data correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      const stepData = result.current.getStepData('step-1');
      expect(stepData).toEqual({ name: 'John' });

      const emptyStepData = result.current.getStepData('step-2');
      expect(emptyStepData).toEqual({});
    });

    it('checks step completion correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.isStepCompleted('step-1')).toBe(false);

      act(() => {
        result.current.completeStep('step-1');
      });

      expect(result.current.isStepCompleted('step-1')).toBe(true);
    });

    it('checks step accessibility correctly', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // First step should always be accessible
      expect(result.current.canProceedToStep('step-1')).toBe(true);

      // Second step should not be accessible until first is complete
      expect(result.current.canProceedToStep('step-2')).toBe(false);

      act(() => {
        result.current.completeStep('step-1');
      });

      // Now second step should be accessible
      expect(result.current.canProceedToStep('step-2')).toBe(true);

      // Third step should be accessible even if step-2 isn't complete (not required)
      expect(result.current.canProceedToStep('step-3')).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    it('resets all data when confirmed', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.resetProgress.mockResolvedValue({});
      global.confirm = jest.fn(() => true);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
        result.current.completeStep('step-1');
      });

      await act(async () => {
        const result_reset = await result.current.resetOnboarding();
        expect(result_reset).toBe(true);
      });

      expect(result.current.data).toEqual({});
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.isDirty).toBe(false);
      expect(onboardingApi.resetProgress).toHaveBeenCalledWith('test-user');
    });

    it('does not reset when not confirmed', async () => {
      onboardingApi.getProgress.mockResolvedValue(null);
      global.confirm = jest.fn(() => false);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      act(() => {
        result.current.updateStepData('step-1', { name: 'John' });
      });

      await act(async () => {
        const result_reset = await result.current.resetOnboarding();
        expect(result_reset).toBe(false);
      });

      expect(result.current.data).toEqual({ 'step-1': { name: 'John' } });
    });
  });

  describe('Storage Types', () => {
    it('uses sessionStorage when specified', async () => {
      const storageData = {
        data: { 'step-1': { name: 'John' } },
        completedSteps: ['step-1']
      };
      sessionStorage.setItem('legacylancers_onboarding_test-user', JSON.stringify(storageData));

      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          storageType: 'sessionStorage'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.data).toEqual({ 'step-1': { name: 'John' } });
    });

    it('does not use storage when set to none', async () => {
      localStorage.setItem('legacylancers_onboarding_test-user', JSON.stringify({
        data: { 'step-1': { name: 'John' } }
      }));

      onboardingApi.getProgress.mockResolvedValue(null);

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          storageType: 'none'
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.data).toEqual({});
    });
  });

  describe('Event Callbacks', () => {
    it('calls onLoad callback when data is loaded', async () => {
      const onLoad = jest.fn();
      const serverData = {
        data: { 'step-1': { name: 'John' } },
        completedSteps: ['step-1']
      };
      onboardingApi.getProgress.mockResolvedValue(serverData);

      renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          onLoad
        })
      );

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledWith({ 'step-1': { name: 'John' } }, new Set(['step-1']));
      });
    });

    it('calls onSave callback when data is saved', async () => {
      const onSave = jest.fn();
      onboardingApi.getProgress.mockResolvedValue(null);
      onboardingApi.saveProgress.mockResolvedValue({});

      const { result } = renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          onSave
        })
      );

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.saveProgress();
      });

      expect(onSave).toHaveBeenCalled();
    });

    it('calls onError callback when errors occur', async () => {
      const onError = jest.fn();
      onboardingApi.getProgress.mockRejectedValue(new Error('Load failed'));

      renderHook(() =>
        useOnboardingState({
          steps: mockSteps,
          userId: 'test-user',
          onError
        })
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});