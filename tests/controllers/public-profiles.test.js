/**
 * Public Profile Controller Tests
 * Tests for SEO-optimized public profile pages
 */

const request = require('supertest');
const app = require('../../src/app');
const { Profile } = require('../../src/models/Profile');

describe('Public Profile Controller', () => {
  let testProfile;

  beforeEach(async () => {
    // Reset profile data before each test
    await Profile.reset();

    // Create a test profile
    testProfile = await Profile.create('user123', {
      displayName: 'John Doe',
      headline: 'Senior Technology Executive',
      bio: 'Experienced technology leader with 20 years in the industry. Specializes in digital transformation and team leadership.',
      industry: 'Technology',
      yearsOfExperience: 20,
      previousCompany: 'Tech Corp',
      previousTitle: 'CTO',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      portfolioUrl: 'https://johndoe.com',
      profilePhotoUrl: 'https://example.com/photo.jpg',
      availabilityStatus: 'available',
      timezone: 'America/New_York',
      engagementTypes: ['consulting', 'mentoring'],
      hourlyRateMin: 150,
      hourlyRateMax: 300,
      currency: 'USD',
      isProfilePublic: true,
      searchable: true,
      showHourlyRates: true,
      verificationStatus: 'verified',
      linkedinVerified: true
    });
  });

  describe('GET /profile/:slug', () => {
    it('should return public profile HTML by default', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('John Doe');
      expect(response.text).toContain('Senior Technology Executive');
      expect(response.text).toContain('<meta name="description"');
      expect(response.text).toContain('<meta property="og:title"');
      expect(response.text).toContain('application/ld+json');
    });

    it('should return JSON when format=json is specified', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('John Doe');
      expect(response.body.data.seo).toBeDefined();
      expect(response.body.data.socialSharing).toBeDefined();
      expect(response.body.data.structuredData).toBeDefined();
    });

    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .get('/profile/non-existent-profile')
        .expect(404);

      expect(response.text).toContain('Profile Not Found');
    });

    it('should return 404 for private profile', async () => {
      // Make profile private
      await Profile.update(testProfile.id, { isProfilePublic: false });

      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}`)
        .expect(404);

      expect(response.text).toContain('Profile Not Found');
    });

    it('should return 404 for non-searchable profile', async () => {
      // Make profile non-searchable
      await Profile.update(testProfile.id, { searchable: false });

      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}`)
        .expect(404);

      expect(response.text).toContain('Profile Not Found');
    });

    it('should include proper SEO meta tags', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}`)
        .expect(200);

      const html = response.text;

      // Check basic meta tags
      expect(html).toMatch(/<title>.*John Doe.*<\/title>/);
      expect(html).toMatch(/<meta name="description" content=".*"/);
      expect(html).toMatch(/<meta name="robots" content="index,follow"/);
      expect(html).toMatch(/<link rel="canonical" href=".*"/);

      // Check Open Graph tags
      expect(html).toMatch(/<meta property="og:type" content="profile"/);
      expect(html).toMatch(/<meta property="og:title" content=".*John Doe.*"/);
      expect(html).toMatch(/<meta property="og:description" content=".*"/);
      expect(html).toMatch(/<meta property="og:image" content=".*"/);

      // Check Twitter Card tags
      expect(html).toMatch(/<meta name="twitter:card" content=".*"/);
      expect(html).toMatch(/<meta name="twitter:title" content=".*"/);

      // Check structured data
      expect(html).toMatch(/<script type="application\/ld\+json">/);
      expect(html).toMatch(/"@type":\s*"Person"/);
    });

    it('should apply privacy filters for public view', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      const profile = response.body.data;

      // Should include public fields
      expect(profile.displayName).toBeDefined();
      expect(profile.headline).toBeDefined();
      expect(profile.industry).toBeDefined();
      expect(profile.engagementTypes).toBeDefined();

      // Should include rates if consent given
      expect(profile.hourlyRateMin).toBeDefined();
      expect(profile.hourlyRateMax).toBeDefined();

      // Should not include private fields
      expect(profile.dataSharingConsent).toBeUndefined();
      expect(profile.publicProfileConsent).toBeUndefined();
    });

    it('should include skills and availability data', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      const profile = response.body.data;

      expect(profile.skills).toBeDefined();
      expect(Array.isArray(profile.skills)).toBe(true);
      expect(profile.availability).toBeDefined();
      expect(profile.availability.status).toBeDefined();
    });

    it('should set appropriate cache headers', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}`)
        .expect(200);

      expect(response.headers['cache-control']).toMatch(/public.*max-age=300/);
    });
  });

  describe('GET /profiles', () => {
    beforeEach(async () => {
      // Create additional test profiles
      await Profile.create('user456', {
        displayName: 'Jane Smith',
        headline: 'Marketing Director',
        industry: 'Marketing',
        yearsOfExperience: 15,
        availabilityStatus: 'available',
        engagementTypes: ['consulting'],
        hourlyRateMin: 100,
        hourlyRateMax: 200,
        isProfilePublic: true,
        searchable: true,
        verificationStatus: 'verified'
      });

      await Profile.create('user789', {
        displayName: 'Bob Johnson',
        headline: 'Finance Expert',
        industry: 'Finance',
        yearsOfExperience: 25,
        availabilityStatus: 'busy',
        engagementTypes: ['project'],
        hourlyRateMin: 200,
        hourlyRateMax: 400,
        isProfilePublic: true,
        searchable: true
      });
    });

    it('should return profile directory HTML by default', async () => {
      const response = await request(app)
        .get('/profiles')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('Professional Directory');
      expect(response.text).toContain('<meta name="description"');
      expect(response.text).toContain('directory-data');
    });

    it('should return JSON when format=json is specified', async () => {
      const response = await request(app)
        .get('/profiles?format=json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profiles).toBeDefined();
      expect(Array.isArray(response.body.data.profiles)).toBe(true);
      expect(response.body.data.profiles.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter profiles by industry', async () => {
      const response = await request(app)
        .get('/profiles?industry=Technology&format=json')
        .expect(200);

      const profiles = response.body.data.profiles;
      expect(profiles.length).toBe(1);
      expect(profiles[0].displayName).toBe('John Doe');
      expect(profiles[0].industry).toBe('Technology');
    });

    it('should filter profiles by engagement type', async () => {
      const response = await request(app)
        .get('/profiles?engagementTypes=consulting&format=json')
        .expect(200);

      const profiles = response.body.data.profiles;
      expect(profiles.length).toBeGreaterThanOrEqual(2);
      
      profiles.forEach(profile => {
        expect(profile.engagementTypes).toContain('consulting');
      });
    });

    it('should filter profiles by experience', async () => {
      const response = await request(app)
        .get('/profiles?minExperience=20&format=json')
        .expect(200);

      const profiles = response.body.data.profiles;
      profiles.forEach(profile => {
        expect(profile.yearsOfExperience).toBeGreaterThanOrEqual(20);
      });
    });

    it('should filter profiles by maximum hourly rate', async () => {
      const response = await request(app)
        .get('/profiles?maxHourlyRate=150&format=json')
        .expect(200);

      const profiles = response.body.data.profiles;
      profiles.forEach(profile => {
        if (profile.hourlyRateMin) {
          expect(profile.hourlyRateMin).toBeLessThanOrEqual(150);
        }
      });
    });

    it('should filter verified profiles only', async () => {
      const response = await request(app)
        .get('/profiles?verified=true&format=json')
        .expect(200);

      const profiles = response.body.data.profiles;
      profiles.forEach(profile => {
        expect(profile.verificationStatus).toBe('verified');
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/profiles?page=1&limit=2&format=json')
        .expect(200);

      const data = response.body.data;
      expect(data.profiles.length).toBeLessThanOrEqual(2);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBeGreaterThan(0);
    });

    it('should include only public and searchable profiles', async () => {
      // Create a private profile
      await Profile.create('private-user', {
        displayName: 'Private User',
        isProfilePublic: false,
        searchable: true
      });

      // Create a non-searchable profile
      await Profile.create('hidden-user', {
        displayName: 'Hidden User',
        isProfilePublic: true,
        searchable: false
      });

      const response = await request(app)
        .get('/profiles?format=json')
        .expect(200);

      const profiles = response.body.data.profiles;
      const profileNames = profiles.map(p => p.displayName);

      expect(profileNames).not.toContain('Private User');
      expect(profileNames).not.toContain('Hidden User');
    });

    it('should set appropriate cache headers for directory', async () => {
      const response = await request(app)
        .get('/profiles')
        .expect(200);

      expect(response.headers['cache-control']).toMatch(/public.*max-age=600/);
    });
  });

  describe('GET /profile/:slug/contact', () => {
    it('should return contact form HTML', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}/contact`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('Contact John Doe');
      expect(response.text).toContain('contact-data');
      expect(response.text).toContain('<meta name="robots" content="noindex,follow"');
    });

    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .get('/profile/non-existent/contact')
        .expect(404);

      expect(response.text).toContain('Profile Not Found');
    });

    it('should return 404 for private profile', async () => {
      await Profile.update(testProfile.id, { isProfilePublic: false });

      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}/contact`)
        .expect(404);

      expect(response.text).toContain('Profile Not Found');
    });
  });

  describe('POST /profile/:slug/contact', () => {
    const validContactData = {
      name: 'Test User',
      email: 'test@example.com',
      subject: 'Business Inquiry',
      message: 'I would like to discuss a potential project with you. We have a consulting opportunity that matches your expertise.',
      engagementType: 'consulting',
      timestamp: Date.now() - 5000 // 5 seconds ago
    };

    it('should submit contact form successfully', async () => {
      const response = await request(app)
        .post(`/profile/${testProfile.profileSlug}/contact`)
        .send(validContactData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('sent successfully');
      expect(response.body.data.inquiryId).toBeDefined();
      expect(response.body.data.profileDisplayName).toBe('John Doe');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/profile/${testProfile.profileSlug}/contact`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post(`/profile/${testProfile.profileSlug}/contact`)
        .send({
          ...validContactData,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email');
    });

    it('should detect spam via honeypot', async () => {
      const response = await request(app)
        .post(`/profile/${testProfile.profileSlug}/contact`)
        .send({
          ...validContactData,
          honeypot: 'spam-content'
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('rate limited');
    });

    it('should detect spam via timing', async () => {
      const response = await request(app)
        .post(`/profile/${testProfile.profileSlug}/contact`)
        .send({
          ...validContactData,
          timestamp: Date.now() // Too recent
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('rate limited');
    });

    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .post('/profile/non-existent/contact')
        .send(validContactData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for private profile', async () => {
      await Profile.update(testProfile.id, { isProfilePublic: false });

      const response = await request(app)
        .post(`/profile/${testProfile.profileSlug}/contact`)
        .send(validContactData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /profile/:slug/availability', () => {
    it('should return availability data as JSON by default', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}/availability`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.availability).toBeDefined();
      expect(response.body.data.profile.displayName).toBe('John Doe');
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}/availability?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange.startDate).toBe(startDate);
      expect(response.body.data.dateRange.endDate).toBe(endDate);
    });

    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .get('/profile/non-existent/availability')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for private profile', async () => {
      await Profile.update(testProfile.id, { isProfilePublic: false });

      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}/availability`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('SEO and Meta Data Generation', () => {
    it('should generate proper structured data', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      const structuredData = response.body.data.structuredData;

      expect(structuredData['@context']).toBe('https://schema.org');
      expect(structuredData['@type']).toBe('Person');
      expect(structuredData.name).toBe('John Doe');
      expect(structuredData.jobTitle).toBe('Senior Technology Executive');
      expect(structuredData.description).toBeDefined();
      expect(structuredData.image).toBeDefined();
      expect(structuredData.url).toContain(testProfile.profileSlug);
    });

    it('should generate Open Graph data', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      const openGraph = response.body.data.socialSharing.openGraph;

      expect(openGraph.type).toBe('profile');
      expect(openGraph.title).toContain('John Doe');
      expect(openGraph.description).toBeDefined();
      expect(openGraph.image).toBeDefined();
      expect(openGraph.url).toContain(testProfile.profileSlug);
    });

    it('should generate Twitter Card data', async () => {
      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      const twitterCard = response.body.data.socialSharing.twitter;

      expect(twitterCard.card).toBe('summary_large_image');
      expect(twitterCard.title).toContain('John Doe');
      expect(twitterCard.description).toBeDefined();
      expect(twitterCard.image).toBeDefined();
    });

    it('should handle profiles without photos gracefully', async () => {
      await Profile.update(testProfile.id, { profilePhotoUrl: null });

      const response = await request(app)
        .get(`/profile/${testProfile.profileSlug}?format=json`)
        .expect(200);

      const socialData = response.body.data.socialSharing;
      expect(socialData.openGraph.image).toBe('/assets/default-profile.jpg');
      expect(socialData.twitter.image).toBe('/assets/default-profile.jpg');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to contact form', async () => {
      const contactData = {
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message',
        timestamp: Date.now() - 5000
      };

      // Make multiple requests quickly
      const requests = Array(6).fill().map(() => 
        request(app)
          .post(`/profile/${testProfile.profileSlug}/contact`)
          .send(contactData)
      );

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to public pages', async () => {
      // This is harder to test in unit tests, but we can verify the middleware is applied
      // by checking that excessive requests eventually get rate limited
      const requests = Array(150).fill().map(() => 
        request(app).get(`/profile/${testProfile.profileSlug}`)
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited after 100 requests
      const rateLimited = responses
        .filter(r => r.status === 'fulfilled')
        .filter(r => r.value.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});