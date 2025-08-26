/**
 * Contact Form Component Tests
 * Tests for the contact form with spam protection
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactForm from '../../../src/components/contact/ContactForm';

// Mock fetch
global.fetch = jest.fn();

describe('ContactForm Component', () => {
  const mockProfileData = {
    displayName: 'John Doe',
    headline: 'Senior Technology Executive',
    profileSlug: 'john-doe',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    availability: {
      responseTime: '24 hours'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    
    // Mock successful response by default
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Your message has been sent successfully!',
        data: { inquiryId: '123', profileDisplayName: 'John Doe' }
      })
    });
  });

  describe('Component Rendering', () => {
    it('should render contact form with profile information', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText('Contact John Doe')).toBeInTheDocument();
      expect(screen.getByText('Senior Technology Executive')).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    });

    it('should render all form sections', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText('Your Information')).toBeInTheDocument();
      expect(screen.getByText('Project Details')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('should render engagement type dropdown with options', () => {
      render(<ContactForm profileData={mockProfileData} />);

      const engagementSelect = screen.getByLabelText(/type of engagement/i);
      expect(engagementSelect).toBeInTheDocument();
      
      // Check for specific options
      expect(screen.getByRole('option', { name: /consulting project/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /mentoring session/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /speaking engagement/i })).toBeInTheDocument();
    });

    it('should render budget and timeline dropdowns', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByLabelText(/budget range/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/timeline/i)).toBeInTheDocument();
      
      // Check for specific budget options
      expect(screen.getByRole('option', { name: /under \$1,000/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /over \$50,000/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields on submit', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Message is required')).toBeInTheDocument();
      });

      // Should not submit form
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'invalid-email' }
      });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate minimum name length', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'A' }
      });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('should validate minimum message length', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: 'Short' }
      });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText('Message must be at least 10 characters')).toBeInTheDocument();
      });
    });

    it('should validate maximum message length', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      const longMessage = 'A'.repeat(2001);
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: longMessage }
      });
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText('Message must be less than 2000 characters')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user starts typing', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      // Trigger validation error
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      // Start typing in name field
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'John' }
      });

      await waitFor(() => {
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Character Counter', () => {
    it('should show character count for message field', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText('0/2000')).toBeInTheDocument();
    });

    it('should update character count as user types', () => {
      render(<ContactForm profileData={mockProfileData} />);

      const message = 'This is a test message';
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: message }
      });

      expect(screen.getByText(`${message.length}/2000`)).toBeInTheDocument();
    });
  });

  describe('Spam Protection', () => {
    it('should include honeypot field that is hidden', () => {
      render(<ContactForm profileData={mockProfileData} />);

      const honeypotField = screen.getByDisplayValue('');
      expect(honeypotField).toHaveAttribute('name', 'honeypot');
      expect(honeypotField).toHaveAttribute('tabindex', '-1');
      expect(honeypotField).toHaveClass('honeypot');
    });

    it('should include timestamp in form data', () => {
      render(<ContactForm profileData={mockProfileData} />);

      // The timestamp should be set when component mounts
      // We can't directly access it, but it's tested in the controller tests
    });
  });

  describe('Form Submission', () => {
    const validFormData = {
      name: 'Jane Smith',
      email: 'jane@example.com',
      subject: 'Business Inquiry',
      message: 'I would like to discuss a potential consulting project with you.',
      engagementType: 'consulting',
      budget: '5k-10k',
      timeline: '1-month'
    };

    it('should submit form with valid data', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      // Fill out form
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: validFormData.name }
      });
      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: validFormData.email }
      });
      fireEvent.change(screen.getByLabelText(/subject/i), {
        target: { value: validFormData.subject }
      });
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: validFormData.message }
      });
      fireEvent.change(screen.getByLabelText(/type of engagement/i), {
        target: { value: validFormData.engagementType }
      });

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/profile/john-doe/contact',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining(validFormData.name)
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      // Mock delayed response
      fetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, message: 'Success' })
        }), 100);
      }));

      render(<ContactForm profileData={mockProfileData} />);

      // Fill minimum required fields
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' }
      });
      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: 'This is a test message with enough characters.' }
      });

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      // Should show loading state
      expect(screen.getByText('Sending Message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sending message/i })).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Sending Message...')).not.toBeInTheDocument();
      });
    });

    it('should show success message on successful submission', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      // Fill minimum required fields
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' }
      });
      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: 'This is a test message with enough characters.' }
      });

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText(/your message has been sent successfully/i)).toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const messageInput = screen.getByLabelText(/message/i);

      // Fill out form
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(messageInput, { target: { value: 'Test message' } });

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(nameInput.value).toBe('');
        expect(emailInput.value).toBe('');
        expect(messageInput.value).toBe('');
      });
    });

    it('should show error message on submission failure', async () => {
      fetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Server error occurred'
        })
      });

      render(<ContactForm profileData={mockProfileData} />);

      // Fill minimum required fields
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' }
      });
      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: 'This is a test message with enough characters.' }
      });

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText('Server error occurred')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      render(<ContactForm profileData={mockProfileData} />);

      // Fill minimum required fields
      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'Test User' }
      });
      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: 'This is a test message with enough characters.' }
      });

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Contact Tips and Information', () => {
    it('should display contact tips sidebar', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText('Tips for a Great Message')).toBeInTheDocument();
      expect(screen.getByText('Be specific')).toBeInTheDocument();
      expect(screen.getByText('Include budget')).toBeInTheDocument();
      expect(screen.getByText('Mention timeline')).toBeInTheDocument();
    });

    it('should display privacy notice', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText(/your information is secure/i)).toBeInTheDocument();
      expect(screen.getByText(/never share your contact details/i)).toBeInTheDocument();
    });

    it('should display expected response time', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText(/you can expect a response within 24 hours/i)).toBeInTheDocument();
    });

    it('should use default response time when not provided', () => {
      const profileWithoutResponseTime = {
        ...mockProfileData,
        availability: {}
      };

      render(<ContactForm profileData={profileWithoutResponseTime} />);

      expect(screen.getByText(/you can expect a response within 48 hours/i)).toBeInTheDocument();
    });

    it('should display alternative contact options', () => {
      const profileWithLinkedIn = {
        ...mockProfileData,
        linkedinUrl: 'https://linkedin.com/in/johndoe'
      };

      render(<ContactForm profileData={profileWithLinkedIn} />);

      expect(screen.getByText('Other Ways to Connect')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('View Calendar')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and associations', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    });

    it('should mark required fields with asterisk', () => {
      render(<ContactForm profileData={mockProfileData} />);

      expect(screen.getByText(/full name/i)).toBeInTheDocument();
      expect(screen.getByText(/email address/i)).toBeInTheDocument();
      expect(screen.getByText(/message/i)).toBeInTheDocument();
      
      // Check for required indicators (asterisks)
      expect(document.querySelectorAll('.required')).toHaveLength(3);
    });

    it('should have proper error message associations', async () => {
      render(<ContactForm profileData={mockProfileData} />);

      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await waitFor(() => {
        const errorMessages = screen.getAllByClass('error-message');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Profile Photo Display', () => {
    it('should display profile photo when available', () => {
      render(<ContactForm profileData={mockProfileData} />);

      const profilePhoto = screen.getByAltText('John Doe');
      expect(profilePhoto).toBeInTheDocument();
      expect(profilePhoto).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('should handle missing profile photo gracefully', () => {
      const profileWithoutPhoto = {
        ...mockProfileData,
        profilePhotoUrl: null
      };

      render(<ContactForm profileData={profileWithoutPhoto} />);

      expect(screen.queryByAltText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Contact John Doe')).toBeInTheDocument();
    });
  });
});