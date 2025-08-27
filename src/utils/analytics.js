/**
 * Analytics Tracking Utility
 * Provides a unified interface for tracking user interactions and events
 */

// Configuration
const ANALYTICS_CONFIG = {
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  providers: {
    googleAnalytics: {
      enabled: !!process.env.REACT_APP_GA_MEASUREMENT_ID,
      measurementId: process.env.REACT_APP_GA_MEASUREMENT_ID
    },
    mixpanel: {
      enabled: !!process.env.REACT_APP_MIXPANEL_TOKEN,
      token: process.env.REACT_APP_MIXPANEL_TOKEN
    }
  }
};

// Analytics provider wrapper
class AnalyticsProvider {
  constructor() {
    this.initialized = false;
    this.providers = [];
    this.eventQueue = [];
  }

  /**
   * Initialize analytics providers
   */
  async init() {
    if (this.initialized || !ANALYTICS_CONFIG.enabled) {
      return;
    }

    try {
      // Initialize Google Analytics
      if (ANALYTICS_CONFIG.providers.googleAnalytics.enabled) {
        await this.initGoogleAnalytics();
      }

      // Initialize Mixpanel
      if (ANALYTICS_CONFIG.providers.mixpanel.enabled) {
        await this.initMixpanel();
      }

      this.initialized = true;

      // Process queued events
      this.processEventQueue();

      if (ANALYTICS_CONFIG.debug) {
        console.log('Analytics initialized with providers:', this.providers);
      }
    } catch (error) {
      console.warn('Analytics initialization failed:', error);
    }
  }

  /**
   * Initialize Google Analytics
   */
  async initGoogleAnalytics() {
    const { measurementId } = ANALYTICS_CONFIG.providers.googleAnalytics;
    
    // Load Google Analytics script
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.async = true;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', measurementId, {
      send_page_view: false, // We'll handle this manually
      custom_map: {
        custom_parameter_1: 'user_type',
        custom_parameter_2: 'onboarding_step'
      }
    });

    this.providers.push('googleAnalytics');
  }

  /**
   * Initialize Mixpanel
   */
  async initMixpanel() {
    // In a real implementation, you would load Mixpanel SDK
    // For now, we'll simulate it
    window.mixpanel = {
      init: () => {},
      track: (eventName, properties) => {
        if (ANALYTICS_CONFIG.debug) {
          console.log('Mixpanel track:', eventName, properties);
        }
      },
      identify: (userId) => {
        if (ANALYTICS_CONFIG.debug) {
          console.log('Mixpanel identify:', userId);
        }
      },
      people: {
        set: (properties) => {
          if (ANALYTICS_CONFIG.debug) {
            console.log('Mixpanel people set:', properties);
          }
        }
      }
    };

    this.providers.push('mixpanel');
  }

  /**
   * Process queued events
   */
  processEventQueue() {
    while (this.eventQueue.length > 0) {
      const { method, args } = this.eventQueue.shift();
      this[method](...args);
    }
  }

  /**
   * Track an event
   */
  track(eventName, properties = {}) {
    if (!this.initialized) {
      this.eventQueue.push({ method: 'track', args: [eventName, properties] });
      return;
    }

    const enrichedProperties = {
      ...properties,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      page_url: window.location.href,
      page_title: document.title
    };

    // Google Analytics
    if (this.providers.includes('googleAnalytics') && window.gtag) {
      window.gtag('event', eventName, {
        event_category: properties.category || 'engagement',
        event_label: properties.label,
        value: properties.value,
        custom_parameter_1: properties.user_type,
        custom_parameter_2: properties.onboarding_step
      });
    }

    // Mixpanel
    if (this.providers.includes('mixpanel') && window.mixpanel) {
      window.mixpanel.track(eventName, enrichedProperties);
    }

    if (ANALYTICS_CONFIG.debug) {
      console.log('Analytics track:', eventName, enrichedProperties);
    }
  }

  /**
   * Identify a user
   */
  identify(userId, properties = {}) {
    if (!this.initialized) {
      this.eventQueue.push({ method: 'identify', args: [userId, properties] });
      return;
    }

    // Google Analytics
    if (this.providers.includes('googleAnalytics') && window.gtag) {
      window.gtag('config', ANALYTICS_CONFIG.providers.googleAnalytics.measurementId, {
        user_id: userId
      });
    }

    // Mixpanel
    if (this.providers.includes('mixpanel') && window.mixpanel) {
      window.mixpanel.identify(userId);
      window.mixpanel.people.set(properties);
    }

    if (ANALYTICS_CONFIG.debug) {
      console.log('Analytics identify:', userId, properties);
    }
  }

  /**
   * Track page view
   */
  pageView(pageName, properties = {}) {
    if (!this.initialized) {
      this.eventQueue.push({ method: 'pageView', args: [pageName, properties] });
      return;
    }

    // Google Analytics
    if (this.providers.includes('googleAnalytics') && window.gtag) {
      window.gtag('config', ANALYTICS_CONFIG.providers.googleAnalytics.measurementId, {
        page_title: pageName,
        page_location: window.location.href
      });
    }

    // Track as event for other providers
    this.track('page_view', {
      page_name: pageName,
      ...properties
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties) {
    if (!this.initialized) {
      this.eventQueue.push({ method: 'setUserProperties', args: [properties] });
      return;
    }

    // Google Analytics
    if (this.providers.includes('googleAnalytics') && window.gtag) {
      window.gtag('config', ANALYTICS_CONFIG.providers.googleAnalytics.measurementId, {
        custom_map: properties
      });
    }

    // Mixpanel
    if (this.providers.includes('mixpanel') && window.mixpanel) {
      window.mixpanel.people.set(properties);
    }

    if (ANALYTICS_CONFIG.debug) {
      console.log('Analytics set user properties:', properties);
    }
  }
}

// Create singleton instance
const analytics = new AnalyticsProvider();

// Onboarding-specific tracking functions
export const OnboardingAnalytics = {
  /**
   * Track onboarding step started
   */
  stepStarted(stepId, stepIndex, totalSteps) {
    analytics.track('onboarding_step_started', {
      category: 'onboarding',
      step_id: stepId,
      step_index: stepIndex,
      total_steps: totalSteps,
      step_name: stepId.replace(/-/g, '_')
    });
  },

  /**
   * Track onboarding step completed
   */
  stepCompleted(stepId, stepIndex, totalSteps, timeSpent, data) {
    analytics.track('onboarding_step_completed', {
      category: 'onboarding',
      step_id: stepId,
      step_index: stepIndex,
      total_steps: totalSteps,
      time_spent_seconds: Math.round(timeSpent / 1000),
      step_name: stepId.replace(/-/g, '_'),
      data_completeness: this.calculateDataCompleteness(stepId, data)
    });
  },

  /**
   * Track onboarding step skipped
   */
  stepSkipped(stepId, stepIndex, totalSteps, reason) {
    analytics.track('onboarding_step_skipped', {
      category: 'onboarding',
      step_id: stepId,
      step_index: stepIndex,
      total_steps: totalSteps,
      skip_reason: reason,
      step_name: stepId.replace(/-/g, '_')
    });
  },

  /**
   * Track onboarding completed
   */
  completed(completionTime, totalSteps, completedSteps, overallCompleteness) {
    analytics.track('onboarding_completed', {
      category: 'onboarding',
      completion_time_seconds: Math.round(completionTime / 1000),
      total_steps: totalSteps,
      completed_steps: completedSteps,
      completion_rate: completedSteps / totalSteps,
      overall_completeness: overallCompleteness
    });
  },

  /**
   * Track onboarding abandoned
   */
  abandoned(stepId, stepIndex, totalSteps, timeSpent, reason) {
    analytics.track('onboarding_abandoned', {
      category: 'onboarding',
      abandoned_at_step: stepId,
      step_index: stepIndex,
      total_steps: totalSteps,
      time_spent_seconds: Math.round(timeSpent / 1000),
      abandon_reason: reason,
      completion_rate: stepIndex / totalSteps
    });
  },

  /**
   * Track specific onboarding interactions
   */
  interaction(action, stepId, properties = {}) {
    analytics.track('onboarding_interaction', {
      category: 'onboarding',
      action: action,
      step_id: stepId,
      step_name: stepId?.replace(/-/g, '_'),
      ...properties
    });
  },

  /**
   * Track form validation errors
   */
  validationError(stepId, fieldName, errorType, errorMessage) {
    analytics.track('onboarding_validation_error', {
      category: 'onboarding_errors',
      step_id: stepId,
      field_name: fieldName,
      error_type: errorType,
      error_message: errorMessage
    });
  },

  /**
   * Track auto-save events
   */
  autoSave(stepId, success, dataSize) {
    analytics.track('onboarding_auto_save', {
      category: 'onboarding',
      step_id: stepId,
      success: success,
      data_size_bytes: dataSize
    });
  },

  /**
   * Calculate data completeness for a step
   */
  calculateDataCompleteness(stepId, data) {
    if (!data) return 0;

    const completenessRules = {
      'personal-info': (data) => {
        const required = ['firstName', 'lastName', 'email', 'phone', 'bio'];
        const optional = ['profileImage', 'linkedInUrl', 'website', 'preferredName'];
        const requiredFilled = required.filter(field => data[field]).length;
        const optionalFilled = optional.filter(field => data[field]).length;
        return (requiredFilled * 2 + optionalFilled) / (required.length * 2 + optional.length);
      },
      'skills': (data) => {
        const skillCount = data.skills?.length || 0;
        const categorizedSkills = data.skills?.filter(s => s.category).length || 0;
        const proficiencySet = data.skills?.filter(s => s.proficiency).length || 0;
        return skillCount > 0 ? (categorizedSkills + proficiencySet) / (skillCount * 2) : 0;
      },
      'experience': (data) => {
        const hasWork = (data.workExperience?.length || 0) > 0;
        const hasEducation = (data.education?.length || 0) > 0;
        const hasAchievements = (data.achievements?.length || 0) > 0;
        return (hasWork + hasEducation + hasAchievements) / 3;
      },
      'availability': (data) => {
        const hasSchedule = Object.keys(data.weeklySchedule || {}).length > 0;
        const hasEngagementTypes = (data.engagementTypes?.length || 0) > 0;
        const hasRates = Object.keys(data.rates || {}).length > 0;
        return (hasSchedule + hasEngagementTypes + hasRates) / 3;
      },
      'review': () => 1 // Review step is always complete when reached
    };

    const calculator = completenessRules[stepId];
    return calculator ? Math.round(calculator(data) * 100) : 0;
  }
};

// General analytics functions
export const Analytics = {
  init: () => analytics.init(),
  track: (eventName, properties) => analytics.track(eventName, properties),
  identify: (userId, properties) => analytics.identify(userId, properties),
  pageView: (pageName, properties) => analytics.pageView(pageName, properties),
  setUserProperties: (properties) => analytics.setUserProperties(properties)
};

// Initialize analytics on module load
if (typeof window !== 'undefined') {
  // Defer initialization to avoid blocking
  setTimeout(() => analytics.init(), 1000);
}

export default Analytics;