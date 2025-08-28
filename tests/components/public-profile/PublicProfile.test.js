/**
 * Public Profile Component Tests
 * Tests for the main public profile React component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicProfile from '../../../src/components/public-profile/PublicProfile';

// Mock child components
jest.mock('../../../src/components/public-profile/ProfileHeader', () => {
  return function MockProfileHeader({ profile, onContactClick, onAvailabilityClick }) {
    return (
      <div data-testid="profile-header">
        <h1>{profile.displayName}</h1>
        <button onClick={onContactClick}>Contact</button>
        <button onClick={onAvailabilityClick}>View Availability</button>
      </div>
    );
  };
});

jest.mock('../../../src/components/public-profile/ProfileSummary', () => {
  return function MockProfileSummary({ profile }) {
    return <div data-testid="profile-summary">Summary for {profile.displayName}</div>;
  };
});

jest.mock('../../../src/components/public-profile/SkillsShowcase', () => {
  return function MockSkillsShowcase({ skills, profileSlug }) {
    return <div data-testid="skills-showcase">Skills: {skills.length} skills</div>;
  };
});

jest.mock('../../../src/components/public-profile/ExperienceDisplay', () => {
  return function MockExperienceDisplay({ profile }) {
    return <div data-testid="experience-display">Experience for {profile.displayName}</div>;
  };
});

jest.mock('../../../src/components/public-profile/AvailabilityCalendar', () => {
  return function MockAvailabilityCalendar({ availability, profileSlug }) {
    return <div data-testid="availability-calendar">Availability Status: {availability?.status}</div>;
  };
});

jest.mock('../../../src/components/public-profile/ContactSection', () => {
  return function MockContactSection({ profile, onContactClick }) {
    return (
      <div data-testid="contact-section">
        Contact {profile.displayName}
        <button onClick={onContactClick}>Contact Button</button>
      </div>
    );
  };
});

jest.mock('../../../src/components/public-profile/SocialSharing', () => {
  return function MockSocialSharing({ profile, socialData }) {
    return <div data-testid="social-sharing">Share {profile.displayName}</div>;
  };
});

// Mock window.location
const mockLocation = {
  href: 'https://example.com/profile/john-doe',
  origin: 'https://example.com'
};

delete window.location;
window.location = mockLocation;

describe('PublicProfile Component', () => {
  const mockProfileData = {
    id: '123',
    displayName: 'John Doe',
    headline: 'Senior Technology Executive',
    bio: 'Experienced technology leader with 20 years in the industry.',
    profileSlug: 'john-doe',
    industry: 'Technology',
    yearsOfExperience: 20,
    availabilityStatus: 'available',
    engagementTypes: ['consulting', 'mentoring'],
    profileCompletenessScore: 85,
    verificationStatus: 'verified',
    linkedinVerified: true,
    skills: [
      { id: 1, name: 'Leadership', proficiencyLevel: 'expert' },
      { id: 2, name: 'Strategy', proficiencyLevel: 'advanced' }
    ],
    availability: {
      status: 'available',
      responseTime: '24 hours'
    },
    seo: {
      title: 'John Doe - Senior Technology Executive',
      description: 'Experienced technology leader with 20 years in the industry.'
    },
    socialSharing: {
      openGraph: {
        type: 'profile',
        title: 'John Doe',
        description: 'Senior Technology Executive'
      }
    },
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'John Doe'
    }
  };

  beforeEach(() => {
    // Mock document methods
    Object.defineProperty(document, 'title', {
      writable: true,
      value: ''
    });

    // Mock querySelector
    document.querySelector = jest.fn(() => ({
      setAttribute: jest.fn()
    }));

    // Mock window.history
    window.history = {
      pushState: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render loading state when no profile data', () => {
      render(<PublicProfile profileData={null} />);
      
      expect(screen.getByText('Loading profile...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });

    it('should render loading state initially then hydrate with data', async () => {
      const { rerender } = render(<PublicProfile profileData={null} />);
      
      expect(screen.getByText('Loading profile...')).toBeInTheDocument();
      
      rerender(<PublicProfile profileData={mockProfileData} />);
      
      await waitFor(() => {
        expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument();
        expect(screen.getByTestId('profile-header')).toBeInTheDocument();
      });
    });

    it('should render all main sections when profile data is loaded', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByTestId('profile-header')).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(screen.getByText('Experience')).toBeInTheDocument();
      expect(screen.getByText('Availability')).toBeInTheDocument();
    });

    it('should render sidebar components', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByTestId('contact-section')).toBeInTheDocument();
      expect(screen.getByTestId('social-sharing')).toBeInTheDocument();
      expect(screen.getByText('Profile Stats')).toBeInTheDocument();
      expect(screen.getByText('Verification')).toBeInTheDocument();
    });
  });

  describe('Navigation and Sections', () => {
    it('should show summary section by default', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByTestId('profile-summary')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /summary/i, selected: true })).toBeInTheDocument();
    });

    it('should switch sections when navigation tabs are clicked', async () => {
      render(<PublicProfile profileData={mockProfileData} />);

      // Initial state - summary should be active
      expect(screen.getByTestId('profile-summary')).toBeInTheDocument();
      
      // Click skills tab
      fireEvent.click(screen.getByRole('tab', { name: /skills/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('skills-showcase')).toBeInTheDocument();
        expect(screen.queryByTestId('profile-summary')).not.toBeInTheDocument();
      });

      // Click experience tab
      fireEvent.click(screen.getByRole('tab', { name: /experience/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('experience-display')).toBeInTheDocument();
        expect(screen.queryByTestId('skills-showcase')).not.toBeInTheDocument();
      });

      // Click availability tab
      fireEvent.click(screen.getByRole('tab', { name: /availability/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('availability-calendar')).toBeInTheDocument();
        expect(screen.queryByTestId('experience-display')).not.toBeInTheDocument();
      });
    });

    it('should update URL hash when section changes', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      fireEvent.click(screen.getByRole('tab', { name: /skills/i }));

      expect(window.history.pushState).toHaveBeenCalledWith(
        {},
        '',
        expect.objectContaining({
          hash: 'skills'
        })
      );
    });

    it('should set proper ARIA attributes for tab navigation', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      const summaryTab = screen.getByRole('tab', { name: /summary/i });
      const skillsTab = screen.getByRole('tab', { name: /skills/i });

      expect(summaryTab).toHaveAttribute('aria-selected', 'true');
      expect(skillsTab).toHaveAttribute('aria-selected', 'false');
      expect(summaryTab).toHaveAttribute('aria-controls', 'summary-panel');
    });
  });

  describe('SEO and Meta Data', () => {
    it('should update document title when profile loads', async () => {
      render(<PublicProfile profileData={mockProfileData} />);

      await waitFor(() => {
        expect(document.title).toBe('John Doe - Senior Technology Executive');
      });
    });

    it('should update meta description when profile loads', async () => {
      const mockMetaElement = { setAttribute: jest.fn() };
      document.querySelector = jest.fn(() => mockMetaElement);

      render(<PublicProfile profileData={mockProfileData} />);

      await waitFor(() => {
        expect(document.querySelector).toHaveBeenCalledWith('meta[name="description"]');
        expect(mockMetaElement.setAttribute).toHaveBeenCalledWith(
          'content',
          'Experienced technology leader with 20 years in the industry.'
        );
      });
    });

    it('should render structured data script when available', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBeGreaterThan(0);
    });
  });

  describe('Profile Stats', () => {
    it('should display years of experience', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('Years Experience')).toBeInTheDocument();
    });

    it('should display profile completeness score', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Profile Complete')).toBeInTheDocument();
    });

    it('should display average rating when available', () => {
      const profileWithRating = {
        ...mockProfileData,
        averageRating: 4.8,
        totalReviews: 25
      };

      render(<PublicProfile profileData={profileWithRating} />);

      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText('Average Rating')).toBeInTheDocument();
    });

    it('should not display rating when no reviews', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.queryByText('Average Rating')).not.toBeInTheDocument();
    });
  });

  describe('Verification Badges', () => {
    it('should show verification badges when profile is verified', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByText('Profile Verified')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn Verified')).toBeInTheDocument();
    });

    it('should show background check badge when completed', () => {
      const profileWithBgCheck = {
        ...mockProfileData,
        backgroundCheckStatus: 'completed'
      };

      render(<PublicProfile profileData={profileWithBgCheck} />);

      expect(screen.getByText('Background Checked')).toBeInTheDocument();
    });

    it('should not show verification badges when not verified', () => {
      const unverifiedProfile = {
        ...mockProfileData,
        verificationStatus: 'unverified',
        linkedinVerified: false
      };

      render(<PublicProfile profileData={unverifiedProfile} />);

      expect(screen.queryByText('Profile Verified')).not.toBeInTheDocument();
      expect(screen.queryByText('LinkedIn Verified')).not.toBeInTheDocument();
    });
  });

  describe('Contact and Availability Actions', () => {
    it('should handle contact button click', () => {
      // Mock window.location.href
      delete window.location;
      window.location = { href: '' };

      render(<PublicProfile profileData={mockProfileData} />);

      fireEvent.click(screen.getByText('Contact'));

      expect(window.location.href).toBe('/profile/john-doe/contact');
    });

    it('should handle availability button click', () => {
      // Mock window.location.href  
      delete window.location;
      window.location = { href: '' };

      render(<PublicProfile profileData={mockProfileData} />);

      fireEvent.click(screen.getByText('View Availability'));

      expect(window.location.href).toBe('/profile/john-doe/availability');
    });
  });

  describe('Component Props Passing', () => {
    it('should pass correct props to ProfileHeader', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should pass correct props to SkillsShowcase when skills section is active', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      fireEvent.click(screen.getByRole('tab', { name: /skills/i }));

      expect(screen.getByText('Skills: 2 skills')).toBeInTheDocument();
    });

    it('should pass correct props to AvailabilityCalendar when availability section is active', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      fireEvent.click(screen.getByRole('tab', { name: /availability/i }));

      expect(screen.getByText('Availability Status: available')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should be accessible with keyboard navigation', () => {
      render(<PublicProfile profileData={mockProfileData} />);

      const firstTab = screen.getByRole('tab', { name: /summary/i });
      const secondTab = screen.getByRole('tab', { name: /skills/i });

      // Focus first tab
      firstTab.focus();
      expect(firstTab).toHaveFocus();

      // Navigate with keyboard
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      fireEvent.click(secondTab);

      expect(screen.getByTestId('skills-showcase')).toBeInTheDocument();
    });

    it('should handle missing optional profile data gracefully', () => {
      const minimalProfile = {
        id: '123',
        displayName: 'John Doe',
        profileSlug: 'john-doe',
        skills: [],
        seo: { title: 'John Doe' },
        socialSharing: {},
        structuredData: {}
      };

      expect(() => {
        render(<PublicProfile profileData={minimalProfile} />);
      }).not.toThrow();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined profile data gracefully', () => {
      render(<PublicProfile profileData={undefined} />);

      expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    });

    it('should handle profile data without required fields', () => {
      const incompleteProfile = {
        profileSlug: 'test'
      };

      expect(() => {
        render(<PublicProfile profileData={incompleteProfile} />);
      }).not.toThrow();
    });
  });
});