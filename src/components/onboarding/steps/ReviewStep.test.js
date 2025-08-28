/**
 * ReviewStep Component Tests
 * Comprehensive test suite for profile review and completion
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReviewStep from './ReviewStep';

const renderReviewStep = (props = {}) => {
  const defaultProps = {
    data: {},
    onUpdate: jest.fn(),
    onComplete: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    isLoading: false,
    error: null,
    canSkip: false,
    onSkip: null,
    ...props
  };

  return render(<ReviewStep {...defaultProps} />);
};

const mockCompleteData = {
  personalInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    bio: 'Experienced software engineer with 10+ years in the industry.',
    location: {
      city: 'New York',
      state: 'NY',
      country: 'US',
      timezone: 'America/New_York'
    },
    profileImage: {
      url: 'https://example.com/profile.jpg'
    },
    linkedInUrl: 'https://linkedin.com/in/johndoe',
    website: 'https://johndoe.dev'
  },
  skills: {
    skills: [
      { name: 'JavaScript', category: 'technical', proficiency: 'advanced' },
      { name: 'React', category: 'technical', proficiency: 'expert' },
      { name: 'Leadership', category: 'leadership', proficiency: 'intermediate' },
      { name: 'Project Management', category: 'project-management', proficiency: 'advanced' }
    ]
  },
  experience: {
    workExperience: [{
      company: 'Tech Corp',
      position: 'Senior Software Engineer',
      startDate: '2020-01',
      endDate: '2024-01',
      current: false,
      description: 'Led development of web applications',
      achievements: ['Reduced page load times by 50%', 'Mentored 5 junior developers']
    }],
    education: [{
      institution: 'State University',
      degree: 'Bachelor of Computer Science',
      field: 'Computer Science',
      startDate: '2016-09',
      endDate: '2020-05',
      gpa: '3.8/4.0'
    }]
  },
  availability: {
    timeZone: 'America/New_York',
    weeklySchedule: {
      0: { available: true, timeSlots: [{ start: '09:00', end: '17:00' }] },
      1: { available: true, timeSlots: [{ start: '09:00', end: '17:00' }] }
    },
    engagementTypes: ['hourly', 'project'],
    rates: { hourly: '150', project: '5000' },
    minNotice: '24',
    maxAdvanceBooking: '60',
    bufferTime: '15',
    autoAccept: true
  }
};

describe('ReviewStep Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders review header and tabs', () => {
      renderReviewStep();
      
      expect(screen.getByText('Review & Complete Your Profile')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /profile preview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /completion status/i })).toBeInTheDocument();
    });

    it('defaults to profile preview tab', () => {
      renderReviewStep({ data: mockCompleteData });
      
      expect(screen.getByRole('button', { name: /profile preview/i })).toHaveClass('active');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows final settings section', () => {
      renderReviewStep();
      
      expect(screen.getByText('Final Settings')).toBeInTheDocument();
      expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /public/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /private/i })).toBeInTheDocument();
    });

    it('shows terms agreement checkbox', () => {
      renderReviewStep();
      
      expect(screen.getByText(/I agree to the Terms of Service and Privacy Policy/)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /terms of service/i })).toBeInTheDocument();
    });
  });

  describe('Profile Preview Tab', () => {
    it('displays personal information correctly', () => {
      renderReviewStep({ data: mockCompleteData });
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('📍 New York, NY, US')).toBeInTheDocument();
      expect(screen.getByText('Experienced software engineer with 10+ years in the industry.')).toBeInTheDocument();
      expect(screen.getByText('✉️ john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('📞 +1-555-123-4567')).toBeInTheDocument();
      expect(screen.getByText('💼 LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('🌐 Website')).toBeInTheDocument();
    });

    it('displays profile image when available', () => {
      renderReviewStep({ data: mockCompleteData });
      
      const profileImage = screen.getByAltText('John Doe');
      expect(profileImage).toBeInTheDocument();
      expect(profileImage).toHaveAttribute('src', 'https://example.com/profile.jpg');
    });

    it('displays initials placeholder when no profile image', () => {
      const dataWithoutImage = {
        ...mockCompleteData,
        personalInfo: {
          ...mockCompleteData.personalInfo,
          profileImage: null
        }
      };
      
      renderReviewStep({ data: dataWithoutImage });
      
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('displays skills grouped by category', () => {
      renderReviewStep({ data: mockCompleteData });
      
      expect(screen.getByText('Skills & Expertise')).toBeInTheDocument();
      expect(screen.getByText('Technical')).toBeInTheDocument();
      expect(screen.getByText('Leadership')).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });

    it('displays work experience', () => {
      renderReviewStep({ data: mockCompleteData });
      
      expect(screen.getByText('Work Experience')).toBeInTheDocument();
      expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      expect(screen.getByText('Led development of web applications')).toBeInTheDocument();
      expect(screen.getByText('Reduced page load times by 50%')).toBeInTheDocument();
    });

    it('displays education information', () => {
      renderReviewStep({ data: mockCompleteData });
      
      expect(screen.getByText('Education')).toBeInTheDocument();
      expect(screen.getByText('Bachelor of Computer Science')).toBeInTheDocument();
      expect(screen.getByText('State University')).toBeInTheDocument();
      expect(screen.getByText('Field: Computer Science')).toBeInTheDocument();
      expect(screen.getByText('GPA: 3.8/4.0')).toBeInTheDocument();
    });

    it('displays availability and rates', () => {
      renderReviewStep({ data: mockCompleteData });
      
      expect(screen.getByText('Availability & Rates')).toBeInTheDocument();
      expect(screen.getByText('Weekly Availability:')).toBeInTheDocument();
      expect(screen.getByText('16 hours')).toBeInTheDocument();
      expect(screen.getByText('Timezone:')).toBeInTheDocument();
      expect(screen.getByText('America/New_York')).toBeInTheDocument();
      expect(screen.getByText('Service Rates')).toBeInTheDocument();
      expect(screen.getByText('$150')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
    });
  });

  describe('Completion Status Tab', () => {
    it('switches to completion status tab when clicked', async () => {
      const user = userEvent.setup();
      renderReviewStep({ data: mockCompleteData });
      
      const statusTab = screen.getByRole('button', { name: /completion status/i });
      await user.click(statusTab);
      
      expect(statusTab).toHaveClass('active');
      expect(screen.getByText('Profile Completion')).toBeInTheDocument();
    });

    it('shows overall completion percentage', async () => {
      const user = userEvent.setup();
      renderReviewStep({ data: mockCompleteData });
      
      const statusTab = screen.getByRole('button', { name: /completion status/i });
      await user.click(statusTab);
      
      expect(screen.getByText(/% Complete/)).toBeInTheDocument();
      expect(screen.getByText('Great! Your profile is complete and ready to go live.')).toBeInTheDocument();
    });

    it('shows section completion statuses', async () => {
      const user = userEvent.setup();
      renderReviewStep({ data: mockCompleteData });
      
      const statusTab = screen.getByRole('button', { name: /completion status/i });
      await user.click(statusTab);
      
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Skills & Expertise')).toBeInTheDocument();
      expect(screen.getByText('Experience')).toBeInTheDocument();
      expect(screen.getByText('Availability & Rates')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows validation issues when data is incomplete', () => {
      const incompleteData = {
        personalInfo: {
          firstName: 'John'
          // Missing required fields
        }
      };
      
      renderReviewStep({ data: incompleteData });
      
      expect(screen.getByText('🚨 Issues to Address')).toBeInTheDocument();
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    it('disables complete button when validation fails', () => {
      const incompleteData = {
        personalInfo: {
          firstName: 'John'
        }
      };
      
      renderReviewStep({ data: incompleteData });
      
      const completeButton = screen.getByRole('button', { name: /complete profile/i });
      expect(completeButton).toBeDisabled();
    });

    it('enables complete button when all validations pass', async () => {
      const user = userEvent.setup();
      renderReviewStep({ data: mockCompleteData });
      
      // Agree to terms
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i });
      await user.click(termsCheckbox);
      
      const completeButton = screen.getByRole('button', { name: /complete profile/i });
      expect(completeButton).not.toBeDisabled();
    });

    it('requires terms agreement to enable complete button', () => {
      renderReviewStep({ data: mockCompleteData });
      
      const completeButton = screen.getByRole('button', { name: /complete profile/i });
      expect(completeButton).toBeDisabled();
    });
  });

  describe('Final Settings', () => {
    it('allows changing profile visibility', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      renderReviewStep({ onUpdate: mockOnUpdate });
      
      const privateRadio = screen.getByRole('radio', { name: /private/i });
      await user.click(privateRadio);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('defaults to public visibility', () => {
      renderReviewStep();
      
      const publicRadio = screen.getByRole('radio', { name: /public/i });
      expect(publicRadio).toBeChecked();
    });

    it('allows toggling email notifications', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      renderReviewStep({ onUpdate: mockOnUpdate });
      
      const emailNotificationsCheckbox = screen.getByRole('checkbox', { name: /email notifications/i });
      await user.click(emailNotificationsCheckbox);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('allows setting profile completion for later', async () => {
      const user = userEvent.setup();
      const mockOnUpdate = jest.fn();
      renderReviewStep({ onUpdate: mockOnUpdate });
      
      const completeLaterCheckbox = screen.getByRole('checkbox', { name: /complete missing profile sections later/i });
      await user.click(completeLaterCheckbox);
      
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('calls onComplete with all data when submitted', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      renderReviewStep({ data: mockCompleteData, onComplete: mockOnComplete });
      
      // Agree to terms
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i });
      await user.click(termsCheckbox);
      
      // Submit
      const completeButton = screen.getByRole('button', { name: /complete profile/i });
      await user.click(completeButton);
      
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          personalInfo: expect.any(Object),
          skills: expect.any(Object),
          experience: expect.any(Object),
          availability: expect.any(Object),
          reviewData: expect.objectContaining({
            agreedToTerms: true,
            profileVisibility: 'public'
          }),
          completedAt: expect.any(String)
        })
      );
    });

    it('does not submit when validation fails', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      
      renderReviewStep({ onComplete: mockOnComplete });
      
      const completeButton = screen.getByRole('button', { name: /complete profile/i });
      await user.click(completeButton);
      
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('allows completing with incomplete data when save for later option is used', async () => {
      const user = userEvent.setup();
      const mockOnComplete = jest.fn();
      const incompleteData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      };
      
      renderReviewStep({ data: incompleteData, onComplete: mockOnComplete });
      
      // Agree to terms
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i });
      await user.click(termsCheckbox);
      
      // Use save & complete later button
      const saveLaterButton = screen.getByRole('button', { name: /save & complete later/i });
      await user.click(saveLaterButton);
      
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('calls onPrevious when previous button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnPrevious = jest.fn();
      
      renderReviewStep({ onPrevious: mockOnPrevious });
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      await user.click(previousButton);
      
      expect(mockOnPrevious).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading state when submitting', () => {
      renderReviewStep({ isLoading: true });
      
      const loadingButton = screen.getByRole('button', { name: /completing profile/i });
      expect(loadingButton).toBeDisabled();
      
      const previousButton = screen.getByRole('button', { name: /previous/i });
      expect(previousButton).toBeDisabled();
    });

    it('displays error message when error is provided', () => {
      const errorMessage = 'Failed to complete profile';
      renderReviewStep({ error: errorMessage });
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Data Display Edge Cases', () => {
    it('handles missing personal info gracefully', () => {
      const dataWithoutPersonalInfo = {
        ...mockCompleteData,
        personalInfo: undefined
      };
      
      renderReviewStep({ data: dataWithoutPersonalInfo });
      
      expect(screen.getByText('Review & Complete Your Profile')).toBeInTheDocument();
    });

    it('handles empty skills array', () => {
      const dataWithoutSkills = {
        ...mockCompleteData,
        skills: { skills: [] }
      };
      
      renderReviewStep({ data: dataWithoutSkills });
      
      expect(screen.queryByText('Skills & Expertise')).not.toBeInTheDocument();
    });

    it('handles missing work experience and education', () => {
      const dataWithoutExperience = {
        ...mockCompleteData,
        experience: {
          workExperience: [],
          education: []
        }
      };
      
      renderReviewStep({ data: dataWithoutExperience });
      
      expect(screen.queryByText('Work Experience')).not.toBeInTheDocument();
      expect(screen.queryByText('Education')).not.toBeInTheDocument();
    });

    it('handles missing availability data', () => {
      const dataWithoutAvailability = {
        ...mockCompleteData,
        availability: undefined
      };
      
      renderReviewStep({ data: dataWithoutAvailability });
      
      expect(screen.queryByText('Availability & Rates')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper radio button labels and associations', () => {
      renderReviewStep();
      
      const publicRadio = screen.getByRole('radio', { name: /public/i });
      const privateRadio = screen.getByRole('radio', { name: /private/i });
      
      expect(publicRadio).toBeInTheDocument();
      expect(privateRadio).toBeInTheDocument();
    });

    it('has proper checkbox labels and associations', () => {
      renderReviewStep();
      
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms of service/i });
      const emailNotificationsCheckbox = screen.getByRole('checkbox', { name: /email notifications/i });
      
      expect(termsCheckbox).toBeInTheDocument();
      expect(emailNotificationsCheckbox).toBeInTheDocument();
    });

    it('provides proper tab navigation', async () => {
      const user = userEvent.setup();
      renderReviewStep();
      
      const previewTab = screen.getByRole('button', { name: /profile preview/i });
      const statusTab = screen.getByRole('button', { name: /completion status/i });
      
      expect(previewTab).toHaveClass('active');
      
      await user.click(statusTab);
      expect(statusTab).toHaveClass('active');
      expect(previewTab).not.toHaveClass('active');
      
      await user.click(previewTab);
      expect(previewTab).toHaveClass('active');
      expect(statusTab).not.toHaveClass('active');
    });
  });

  describe('Data Calculations', () => {
    it('correctly calculates weekly availability hours', () => {
      const availabilityData = {
        ...mockCompleteData,
        availability: {
          ...mockCompleteData.availability,
          weeklySchedule: {
            0: { available: true, timeSlots: [{ start: '09:00', end: '17:00' }] }, // 8 hours
            1: { available: true, timeSlots: [{ start: '09:00', end: '13:00' }] }, // 4 hours
            2: { available: true, timeSlots: [{ start: '14:00', end: '18:00' }] }  // 4 hours
          }
        }
      };
      
      renderReviewStep({ data: availabilityData });
      
      expect(screen.getByText('16 hours')).toBeInTheDocument();
    });

    it('handles zero availability hours', () => {
      const noAvailabilityData = {
        ...mockCompleteData,
        availability: {
          ...mockCompleteData.availability,
          weeklySchedule: {}
        }
      };
      
      renderReviewStep({ data: noAvailabilityData });
      
      expect(screen.getByText('0 hours')).toBeInTheDocument();
    });
  });
});