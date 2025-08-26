/**
 * useOnboardingState Hook
 * Custom hook for onboarding state management with auto-save functionality
 * and persistence across browser sessions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { onboardingApi } from '../services/onboarding-api';

const STORAGE_KEY_PREFIX = 'legacylancers_onboarding';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 1000; // 1 second

export function useOnboardingState({
  steps = [],
  autoSave = true,
  userId = null,
  storageType = 'localStorage', // 'localStorage', 'sessionStorage', 'none'
  onError = null,
  onSave = null,
  onLoad = null
} = {}) {
  // Core state
  const [data, setData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  // Refs for managing intervals and timeouts
  const autoSaveIntervalRef = useRef(null);
  const debounceSaveTimeoutRef = useRef(null);
  const saveQueueRef = useRef([]);

  // Storage key for this user/session
  const storageKey = `${STORAGE_KEY_PREFIX}_${userId || 'anonymous'}`;

  // Initialize progress tracking
  const [progress, setProgress] = useState({
    overall: 0,
    stepProgress: {},
    estimatedTimeRemaining: null,
    completionPercentage: 0
  });

  // Calculate progress
  const calculateProgress = useCallback(() => {
    const totalSteps = steps.length;
    const completedCount = completedSteps.size;
    const overallProgress = totalSteps > 0 ? completedCount / totalSteps : 0;

    // Calculate step-specific progress
    const stepProgress = {};
    steps.forEach(step => {
      const stepData = data[step.id];
      const isCompleted = completedSteps.has(step.id);
      
      if (isCompleted) {
        stepProgress[step.id] = 1;
      } else if (stepData) {
        // Estimate progress based on filled fields
        const fields = Object.keys(stepData);
        const filledFields = fields.filter(key => {
          const value = stepData[key];
          return value !== null && value !== undefined && value !== '';
        });
        stepProgress[step.id] = fields.length > 0 ? filledFields.length / fields.length : 0;
      } else {
        stepProgress[step.id] = 0;
      }
    });

    // Estimate time remaining
    const remainingSteps = steps.filter(step => !completedSteps.has(step.id));
    const estimatedTimeRemaining = remainingSteps.reduce((total, step) => {
      if (step.estimated_time) {
        const minutes = parseInt(step.estimated_time.match(/\d+/)?.[0] || '5');
        return total + minutes;
      }
      return total + 5; // Default 5 minutes per step
    }, 0);

    setProgress({
      overall: overallProgress,
      stepProgress,
      estimatedTimeRemaining,
      completionPercentage: Math.round(overallProgress * 100)
    });
  }, [steps, completedSteps, data]);

  // Load data from storage
  const loadFromStorage = useCallback(() => {
    if (storageType === 'none') return {};

    try {
      const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
      const stored = storage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load from storage:', error);
      return {};
    }
  }, [storageKey, storageType]);

  // Save data to storage
  const saveToStorage = useCallback((dataToSave) => {
    if (storageType === 'none') return;

    try {
      const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
      storage.setItem(storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.warn('Failed to save to storage:', error);
    }
  }, [storageKey, storageType]);

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        setError(null);
        
        let loadedData = {};
        let loadedCompletedSteps = new Set();

        // Load from local storage first
        const storageData = loadFromStorage();
        if (storageData.data) {
          loadedData = storageData.data;
          loadedCompletedSteps = new Set(storageData.completedSteps || []);
        }

        // If user is authenticated, try to load from server
        if (userId) {
          try {
            const serverData = await onboardingApi.getProgress(userId);
            if (serverData) {
              // Merge server data with local storage, server takes precedence
              loadedData = { ...loadedData, ...serverData.data };
              loadedCompletedSteps = new Set([
                ...loadedCompletedSteps,
                ...(serverData.completedSteps || [])
              ]);
            }
          } catch (serverError) {
            console.warn('Failed to load from server, using local storage:', serverError);
          }
        }

        setData(loadedData);
        setCompletedSteps(loadedCompletedSteps);
        setIsLoaded(true);
        setLastSaved(storageData.lastSaved || null);

        if (onLoad) {
          onLoad(loadedData, loadedCompletedSteps);
        }

      } catch (error) {
        console.error('Failed to load onboarding data:', error);
        setError('Failed to load your onboarding progress');
        setIsLoaded(true);

        if (onError) {
          onError(error);
        }
      }
    }

    loadInitialData();
  }, [userId, loadFromStorage, onLoad, onError]);

  // Auto-save functionality
  const saveProgress = useCallback(async (force = false) => {
    if (isSaving && !force) return;

    try {
      setIsSaving(true);
      setError(null);

      const saveData = {
        data,
        completedSteps: Array.from(completedSteps),
        lastSaved: new Date().toISOString(),
        progress
      };

      // Save to local storage immediately
      saveToStorage(saveData);

      // Save to server if user is authenticated
      if (userId) {
        await onboardingApi.saveProgress(userId, saveData);
      }

      setLastSaved(saveData.lastSaved);
      setIsDirty(false);

      if (onSave) {
        onSave(saveData);
      }

    } catch (error) {
      console.error('Failed to save onboarding data:', error);
      setError('Failed to save your progress');
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [data, completedSteps, progress, isSaving, userId, saveToStorage, onSave, onError]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (debounceSaveTimeoutRef.current) {
      clearTimeout(debounceSaveTimeoutRef.current);
    }

    debounceSaveTimeoutRef.current = setTimeout(() => {
      saveProgress();
    }, DEBOUNCE_DELAY);
  }, [saveProgress]);

  // Set up auto-save interval
  useEffect(() => {
    if (autoSave && isDirty) {
      autoSaveIntervalRef.current = setInterval(() => {
        saveProgress();
      }, AUTO_SAVE_INTERVAL);

      return () => {
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
        }
      };
    }
  }, [autoSave, isDirty, saveProgress]);

  // Update step data
  const updateStepData = useCallback((stepId, stepData, immediate = false) => {
    setData(prevData => ({
      ...prevData,
      [stepId]: {
        ...prevData[stepId],
        ...stepData
      }
    }));

    setIsDirty(true);

    // Trigger save
    if (immediate) {
      saveProgress();
    } else if (autoSave) {
      debouncedSave();
    }
  }, [autoSave, saveProgress, debouncedSave]);

  // Complete a step
  const completeStep = useCallback((stepId, immediate = true) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    setIsDirty(true);

    // Trigger save
    if (immediate) {
      saveProgress();
    } else if (autoSave) {
      debouncedSave();
    }
  }, [autoSave, saveProgress, debouncedSave]);

  // Uncomplete a step (for editing)
  const uncompleteStep = useCallback((stepId, immediate = false) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      newSet.delete(stepId);
      return newSet;
    });
    setIsDirty(true);

    if (immediate) {
      saveProgress();
    } else if (autoSave) {
      debouncedSave();
    }
  }, [autoSave, saveProgress, debouncedSave]);

  // Reset onboarding (clear all data)
  const resetOnboarding = useCallback(async (confirm = true) => {
    if (confirm && !window.confirm('Are you sure you want to reset all onboarding progress? This cannot be undone.')) {
      return false;
    }

    try {
      // Clear local data
      setData({});
      setCompletedSteps(new Set());
      setIsDirty(false);

      // Clear storage
      if (storageType !== 'none') {
        const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
        storage.removeItem(storageKey);
      }

      // Clear server data if authenticated
      if (userId) {
        await onboardingApi.resetProgress(userId);
      }

      setLastSaved(null);
      return true;
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
      setError('Failed to reset onboarding progress');
      
      if (onError) {
        onError(error);
      }
      return false;
    }
  }, [userId, storageType, storageKey, onError]);

  // Get data for a specific step
  const getStepData = useCallback((stepId) => {
    return data[stepId] || {};
  }, [data]);

  // Check if step is completed
  const isStepCompleted = useCallback((stepId) => {
    return completedSteps.has(stepId);
  }, [completedSteps]);

  // Check if user can proceed to a step
  const canProceedToStep = useCallback((stepId) => {
    const stepIndex = steps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) return false;

    // Can always access first step
    if (stepIndex === 0) return true;

    // Check if all previous required steps are completed
    for (let i = 0; i < stepIndex; i++) {
      const previousStep = steps[i];
      if (previousStep.required && !completedSteps.has(previousStep.id)) {
        return false;
      }
    }

    return true;
  }, [steps, completedSteps]);

  // Calculate progress whenever dependencies change
  useEffect(() => {
    calculateProgress();
  }, [calculateProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
      if (debounceSaveTimeoutRef.current) {
        clearTimeout(debounceSaveTimeoutRef.current);
      }
    };
  }, []);

  // Return hook interface
  return {
    // Data
    data,
    progress,
    completedSteps: Array.from(completedSteps),
    
    // Status
    isLoaded,
    isDirty,
    isSaving,
    lastSaved,
    error,
    
    // Actions
    updateStepData,
    completeStep,
    uncompleteStep,
    saveProgress,
    resetOnboarding,
    
    // Queries
    getStepData,
    isStepCompleted,
    canProceedToStep,
    
    // Config
    autoSaveEnabled: autoSave
  };
}