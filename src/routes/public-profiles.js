/**
 * Public Profile Routes
 * Handles SEO-optimized public profile pages and directory
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const publicProfileController = require('../controllers/public-profiles');
const { securityLogger } = require('../middleware/security');

const router = express.Router();

// Rate limiting for public pages
const publicPageLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for contact forms (more restrictive)
const contactFormLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 contact form submissions per windowMs
  message: {
    success: false,
    error: 'Too many contact form submissions. Please try again later.',
    code: 'CONTACT_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting and security logging to all routes
router.use(publicPageLimit);
router.use(securityLogger());

/**
 * Public profile directory
 * GET /profiles
 */
router.get('/profiles', publicProfileController.getProfileDirectory);

/**
 * Individual public profile page
 * GET /profile/:slug
 */
router.get('/profile/:slug', publicProfileController.getPublicProfile);

/**
 * Profile contact form page
 * GET /profile/:slug/contact
 */
router.get('/profile/:slug/contact', publicProfileController.getContactForm);

/**
 * Submit contact form
 * POST /profile/:slug/contact
 */
router.post('/profile/:slug/contact', contactFormLimit, publicProfileController.submitContactForm);

/**
 * Profile availability view
 * GET /profile/:slug/availability
 */
router.get('/profile/:slug/availability', publicProfileController.getProfileAvailability);

/**
 * SEO sitemap endpoint (XML)
 * GET /sitemap.xml
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    // In production, this would generate a proper XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${req.protocol}://${req.get('host')}/profiles</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${req.protocol}://${req.get('host')}/profile/sample-profile</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Robots.txt endpoint
 * GET /robots.txt
 */
router.get('/robots.txt', (req, res) => {
  const robotsTxt = `User-agent: *
Allow: /profiles
Allow: /profile/
Disallow: /api/
Disallow: /profile/*/contact
Disallow: /profile/*/availability

Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`;

  res.set('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

/**
 * Health check for public pages
 * GET /public/health
 */
router.get('/public/health', (req, res) => {
  res.json({
    success: true,
    service: 'Public Profiles',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /profiles',
      'GET /profile/:slug',
      'GET /profile/:slug/contact',
      'POST /profile/:slug/contact',
      'GET /profile/:slug/availability'
    ]
  });
});

module.exports = router;