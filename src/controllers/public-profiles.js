/**
 * Public Profile Controllers
 * Handles SEO-optimized public profile pages with server-side rendering
 */

const { Profile, ProfileError } = require('../models/Profile');
const { Skill } = require('../models/Skill');
const { Availability } = require('../models/Availability');
const imageProcessingService = require('../services/image-processing');

/**
 * Get public profile by slug with SEO optimization
 * GET /profile/:slug
 */
async function getPublicProfile(req, res) {
  try {
    const { slug } = req.params;
    const { format = 'html' } = req.query;

    // Get profile
    const profile = await Profile.findBySlug(slug);

    if (!profile) {
      return renderNotFound(res, format);
    }

    // Check if profile is public
    if (!profile.isProfilePublic || !profile.searchable) {
      return renderNotFound(res, format);
    }

    // Apply privacy filters for public view
    const publicProfile = Profile.applyPrivacyFilters(profile, {
      isOwner: false,
      isAdmin: false,
      isPublicView: true
    });

    // Get profile skills
    const profileSkills = await getProfileSkills(profile.userId);

    // Get availability summary
    const availabilitySummary = await getAvailabilitySummary(profile.userId);

    // Prepare enhanced profile data
    const enhancedProfile = {
      ...publicProfile,
      skills: profileSkills,
      availability: availabilitySummary,
      seo: generateSEOData(publicProfile),
      socialSharing: generateSocialSharingData(publicProfile),
      structuredData: generateStructuredData(publicProfile)
    };

    // Return JSON if requested
    if (format === 'json') {
      return res.json({
        success: true,
        data: enhancedProfile
      });
    }

    // Render HTML with SSR
    return renderProfileHTML(res, enhancedProfile);

  } catch (error) {
    console.error('Get public profile error:', error);

    if (error instanceof ProfileError) {
      return renderError(res, 400, error.message);
    }

    return renderError(res, 500, 'Failed to load profile');
  }
}

/**
 * Get public profile directory with search and filtering
 * GET /profiles
 */
async function getProfileDirectory(req, res) {
  try {
    const {
      page = 1,
      limit = 12,
      industry,
      engagementTypes,
      minExperience,
      maxHourlyRate,
      verified,
      sort = 'profileCompletenessScore',
      order = 'desc',
      search,
      format = 'html'
    } = req.query;

    // Build search criteria
    const criteria = {
      searchable: true
    };

    if (industry) criteria.industry = industry;
    if (engagementTypes) {
      criteria.engagementTypes = Array.isArray(engagementTypes) 
        ? engagementTypes 
        : [engagementTypes];
    }
    if (minExperience) criteria.minExperience = parseInt(minExperience);
    if (maxHourlyRate) criteria.maxHourlyRate = parseFloat(maxHourlyRate);
    if (verified === 'true') criteria.verified = true;

    // Search options
    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 24), // Cap at 24 for performance
      sort,
      order,
      includePrivate: false // Only public profiles
    };

    // Perform search
    const results = await Profile.search(criteria, options);

    // Filter to only include public profiles and apply privacy filters
    const publicProfiles = results.profiles
      .filter(profile => profile.isProfilePublic && profile.searchable)
      .map(profile => Profile.applyPrivacyFilters(profile, {
        isOwner: false,
        isAdmin: false,
        isPublicView: true
      }));

    // Update pagination with filtered count
    const filteredPagination = {
      ...results.pagination,
      total: publicProfiles.length,
      pages: Math.ceil(publicProfiles.length / options.limit)
    };

    const directoryData = {
      profiles: publicProfiles,
      pagination: filteredPagination,
      filters: {
        industry,
        engagementTypes,
        minExperience,
        maxHourlyRate,
        verified,
        search
      },
      seo: generateDirectorySEOData(criteria, options)
    };

    // Return JSON if requested
    if (format === 'json') {
      return res.json({
        success: true,
        data: directoryData
      });
    }

    // Render HTML directory page
    return renderDirectoryHTML(res, directoryData);

  } catch (error) {
    console.error('Get profile directory error:', error);
    return renderError(res, 500, 'Failed to load profiles directory');
  }
}

/**
 * Get profile contact form
 * GET /profile/:slug/contact
 */
async function getContactForm(req, res) {
  try {
    const { slug } = req.params;

    // Get profile to verify it exists and is public
    const profile = await Profile.findBySlug(slug);

    if (!profile || !profile.isProfilePublic || !profile.searchable) {
      return renderNotFound(res);
    }

    const contactData = {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        headline: profile.headline,
        profileSlug: profile.profileSlug,
        profilePhotoUrl: profile.profilePhotoUrl
      },
      seo: generateContactSEOData(profile)
    };

    return renderContactFormHTML(res, contactData);

  } catch (error) {
    console.error('Get contact form error:', error);
    return renderError(res, 500, 'Failed to load contact form');
  }
}

/**
 * Submit contact form
 * POST /profile/:slug/contact
 */
async function submitContactForm(req, res) {
  try {
    const { slug } = req.params;
    const {
      name,
      email,
      subject,
      message,
      honeypot, // Spam protection
      timestamp, // Spam protection
      engagementType
    } = req.body;

    // Basic spam protection
    if (honeypot || !timestamp || Date.now() - parseInt(timestamp) < 3000) {
      // Log suspicious activity
      console.warn('Potential spam contact form submission', {
        slug,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        honeypot: !!honeypot,
        timestamp,
        timeDiff: Date.now() - parseInt(timestamp)
      });

      return res.status(429).json({
        success: false,
        error: 'Request rate limited',
        code: 'RATE_LIMITED'
      });
    }

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Get profile
    const profile = await Profile.findBySlug(slug);

    if (!profile || !profile.isProfilePublic || !profile.searchable) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Create contact inquiry record (in production, this would go to database)
    const inquiry = {
      id: `inquiry_${Date.now()}`,
      profileId: profile.id,
      profileSlug: slug,
      fromName: name,
      fromEmail: email,
      subject: subject || 'New contact inquiry',
      message,
      engagementType,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    };

    // Log the inquiry (in production, save to database and send email)
    console.log('New contact inquiry:', inquiry);

    // Send success response
    res.json({
      success: true,
      message: 'Your message has been sent successfully',
      data: {
        inquiryId: inquiry.id,
        profileDisplayName: profile.displayName
      }
    });

  } catch (error) {
    console.error('Submit contact form error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Get profile availability for public view
 * GET /profile/:slug/availability
 */
async function getProfileAvailability(req, res) {
  try {
    const { slug } = req.params;
    const {
      startDate,
      endDate,
      format = 'json'
    } = req.query;

    // Get profile
    const profile = await Profile.findBySlug(slug);

    if (!profile || !profile.isProfilePublic || !profile.searchable) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    // Get availability summary for public view
    const availabilitySummary = await getPublicAvailabilitySummary(
      profile.userId,
      startDate,
      endDate
    );

    const availabilityData = {
      profile: {
        displayName: profile.displayName,
        profileSlug: profile.profileSlug,
        timezone: profile.timezone,
        availabilityStatus: profile.availabilityStatus
      },
      availability: availabilitySummary,
      dateRange: { startDate, endDate }
    };

    if (format === 'json') {
      return res.json({
        success: true,
        data: availabilityData
      });
    }

    // Render availability calendar view
    return renderAvailabilityHTML(res, availabilityData);

  } catch (error) {
    console.error('Get profile availability error:', error);
    return renderError(res, 500, 'Failed to load availability');
  }
}

/**
 * Helper function to get profile skills
 */
async function getProfileSkills(userId) {
  try {
    // In production, this would query user_skills table
    // For now, return mock data based on profile
    return [
      { name: 'Leadership', proficiencyLevel: 'expert', verified: true },
      { name: 'Strategic Planning', proficiencyLevel: 'advanced', verified: true },
      { name: 'Business Development', proficiencyLevel: 'expert', verified: false }
    ];
  } catch (error) {
    console.error('Error getting profile skills:', error);
    return [];
  }
}

/**
 * Helper function to get availability summary
 */
async function getAvailabilitySummary(userId) {
  try {
    // In production, this would query availability and bookings
    // For now, return summary data
    return {
      status: 'available',
      timezone: 'America/New_York',
      nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      engagementTypes: ['consulting', 'mentoring'],
      responseTime: '24 hours'
    };
  } catch (error) {
    console.error('Error getting availability summary:', error);
    return null;
  }
}

/**
 * Helper function to get public availability summary
 */
async function getPublicAvailabilitySummary(userId, startDate, endDate) {
  try {
    // In production, this would show available time slots
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return {
      availableSlots: [
        {
          date: '2024-01-15',
          timeSlots: ['09:00-10:00', '14:00-15:00', '16:00-17:00']
        },
        {
          date: '2024-01-16',
          timeSlots: ['10:00-11:00', '15:00-16:00']
        }
      ],
      timezone: 'America/New_York',
      bookingUrl: `/profile/${userId}/book`
    };
  } catch (error) {
    console.error('Error getting public availability summary:', error);
    return null;
  }
}

/**
 * Generate SEO data for profile
 */
function generateSEOData(profile) {
  const title = profile.displayName 
    ? `${profile.displayName} - ${profile.headline || 'Professional Profile'}`
    : 'Professional Profile';
  
  const description = profile.bio
    ? profile.bio.substring(0, 160) + (profile.bio.length > 160 ? '...' : '')
    : `Professional with ${profile.yearsOfExperience || 0} years of experience in ${profile.industry || 'various industries'}.`;

  return {
    title,
    description,
    canonical: `/profile/${profile.profileSlug}`,
    robots: 'index,follow',
    language: 'en'
  };
}

/**
 * Generate social sharing data
 */
function generateSocialSharingData(profile) {
  const title = profile.displayName || 'Professional Profile';
  const description = profile.headline || profile.bio?.substring(0, 200) || 'View this professional profile';
  const image = profile.profilePhotoUrl || '/assets/default-profile.jpg';

  return {
    openGraph: {
      type: 'profile',
      title,
      description,
      image,
      url: `/profile/${profile.profileSlug}`
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      image
    }
  };
}

/**
 * Generate structured data (JSON-LD)
 */
function generateStructuredData(profile) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.displayName,
    jobTitle: profile.headline,
    description: profile.bio,
    image: profile.profilePhotoUrl,
    url: `/profile/${profile.profileSlug}`,
    worksFor: profile.previousCompany ? {
      '@type': 'Organization',
      name: profile.previousCompany
    } : undefined,
    knowsAbout: profile.industry,
    alumniOf: profile.previousCompany,
    sameAs: profile.linkedinUrl ? [profile.linkedinUrl] : undefined,
    offers: {
      '@type': 'Offer',
      availability: profile.availabilityStatus,
      priceRange: profile.hourlyRateMin && profile.hourlyRateMax
        ? `${profile.hourlyRateMin}-${profile.hourlyRateMax} ${profile.currency}/hour`
        : undefined
    }
  };
}

/**
 * Generate directory SEO data
 */
function generateDirectorySEOData(criteria, options) {
  let title = 'Professional Directory - LegacyLancers';
  let description = 'Browse experienced professionals for consulting, mentoring, and project work.';

  if (criteria.industry) {
    title = `${criteria.industry} Professionals - LegacyLancers`;
    description = `Find experienced ${criteria.industry} professionals for your next project.`;
  }

  return {
    title,
    description,
    canonical: '/profiles',
    robots: 'index,follow'
  };
}

/**
 * Generate contact form SEO data
 */
function generateContactSEOData(profile) {
  return {
    title: `Contact ${profile.displayName} - LegacyLancers`,
    description: `Get in touch with ${profile.displayName} for professional services and collaborations.`,
    canonical: `/profile/${profile.profileSlug}/contact`,
    robots: 'noindex,follow'
  };
}

/**
 * Render HTML profile page
 */
function renderProfileHTML(res, profileData) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profileData.seo.title}</title>
  <meta name="description" content="${profileData.seo.description}">
  <meta name="robots" content="${profileData.seo.robots}">
  <link rel="canonical" href="${profileData.seo.canonical}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="${profileData.socialSharing.openGraph.type}">
  <meta property="og:title" content="${profileData.socialSharing.openGraph.title}">
  <meta property="og:description" content="${profileData.socialSharing.openGraph.description}">
  <meta property="og:image" content="${profileData.socialSharing.openGraph.image}">
  <meta property="og:url" content="${profileData.socialSharing.openGraph.url}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="${profileData.socialSharing.twitter.card}">
  <meta name="twitter:title" content="${profileData.socialSharing.twitter.title}">
  <meta name="twitter:description" content="${profileData.socialSharing.twitter.description}">
  <meta name="twitter:image" content="${profileData.socialSharing.twitter.image}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify(profileData.structuredData)}
  </script>
  
  <link rel="stylesheet" href="/styles/profile.css">
  <link rel="preload" href="/styles/components.css" as="style">
</head>
<body>
  <div id="root">
    <div class="profile-loading">Loading profile...</div>
  </div>
  
  <!-- Profile data for React hydration -->
  <script type="application/json" id="profile-data">
    ${JSON.stringify(profileData)}
  </script>
  
  <script src="/js/profile.bundle.js" defer></script>
</body>
</html>`;

  res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
  res.send(html);
}

/**
 * Render directory HTML
 */
function renderDirectoryHTML(res, directoryData) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${directoryData.seo.title}</title>
  <meta name="description" content="${directoryData.seo.description}">
  <meta name="robots" content="${directoryData.seo.robots}">
  <link rel="canonical" href="${directoryData.seo.canonical}">
  
  <link rel="stylesheet" href="/styles/directory.css">
</head>
<body>
  <div id="root">
    <div class="directory-loading">Loading directory...</div>
  </div>
  
  <script type="application/json" id="directory-data">
    ${JSON.stringify(directoryData)}
  </script>
  
  <script src="/js/directory.bundle.js" defer></script>
</body>
</html>`;

  res.set('Cache-Control', 'public, max-age=600'); // 10 minute cache
  res.send(html);
}

/**
 * Render contact form HTML
 */
function renderContactFormHTML(res, contactData) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${contactData.seo.title}</title>
  <meta name="description" content="${contactData.seo.description}">
  <meta name="robots" content="${contactData.seo.robots}">
  <link rel="canonical" href="${contactData.seo.canonical}">
  
  <link rel="stylesheet" href="/styles/contact.css">
</head>
<body>
  <div id="root">
    <div class="contact-loading">Loading contact form...</div>
  </div>
  
  <script type="application/json" id="contact-data">
    ${JSON.stringify(contactData)}
  </script>
  
  <script src="/js/contact.bundle.js" defer></script>
</body>
</html>`;

  res.send(html);
}

/**
 * Render availability HTML
 */
function renderAvailabilityHTML(res, availabilityData) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Availability - ${availabilityData.profile.displayName}</title>
  <meta name="description" content="View available time slots and book a session">
  <meta name="robots" content="noindex,follow">
  
  <link rel="stylesheet" href="/styles/availability.css">
</head>
<body>
  <div id="root">
    <div class="availability-loading">Loading availability...</div>
  </div>
  
  <script type="application/json" id="availability-data">
    ${JSON.stringify(availabilityData)}
  </script>
  
  <script src="/js/availability.bundle.js" defer></script>
</body>
</html>`;

  res.send(html);
}

/**
 * Render 404 page
 */
function renderNotFound(res, format = 'html') {
  if (format === 'json') {
    return res.status(404).json({
      success: false,
      error: 'Profile not found',
      code: 'PROFILE_NOT_FOUND'
    });
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile Not Found - LegacyLancers</title>
  <meta name="robots" content="noindex,nofollow">
</head>
<body>
  <div class="error-page">
    <h1>Profile Not Found</h1>
    <p>The requested profile could not be found or is not publicly available.</p>
    <a href="/profiles">Browse All Profiles</a>
  </div>
</body>
</html>`;

  res.status(404).send(html);
}

/**
 * Render error page
 */
function renderError(res, statusCode, message) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - LegacyLancers</title>
  <meta name="robots" content="noindex,nofollow">
</head>
<body>
  <div class="error-page">
    <h1>Oops! Something went wrong</h1>
    <p>${message}</p>
    <a href="/profiles">Browse Profiles</a>
  </div>
</body>
</html>`;

  res.status(statusCode).send(html);
}

module.exports = {
  getPublicProfile,
  getProfileDirectory,
  getContactForm,
  submitContactForm,
  getProfileAvailability
};