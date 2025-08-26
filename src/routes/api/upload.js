/**
 * Image Upload API Routes
 * Defines all image upload and processing endpoints
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requiredAuthenticate, requireEmailVerification } = require('../../middleware/auth');
const { 
  singleFileUpload, 
  multipleFilesUpload, 
  validateImages, 
  validateUserQuota 
} = require('../../middleware/file-upload');
const imageUploadController = require('../../controllers/image-upload');

const router = express.Router();

// Rate limiting for upload endpoints
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: {
    success: false,
    error: 'Too many upload attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health check
  skip: (req) => req.path === '/health'
});

// Health check endpoint (no authentication required)
router.get('/health', imageUploadController.getHealth);

// Apply authentication and rate limiting to all other routes
router.use(requiredAuthenticate);
router.use(requireEmailVerification());
router.use(uploadRateLimit);

/**
 * @route POST /api/upload/image
 * @desc Upload and process a single image
 * @access Private (authenticated users with verified email)
 * @body {File} image - Image file to upload
 * @body {String} [imageType=general] - Type of image (profile, document, general)
 * @body {Array|String} [generateSizes] - Sizes to generate (comma-separated or array)
 * @body {Number} [quality] - Image quality (1-100)
 * @body {String} [format] - Output format (jpeg, png, webp)
 * @returns {Object} Upload result with image URLs and metadata
 */
router.post('/image', 
  validateUserQuota(),
  singleFileUpload('image'),
  validateImages(),
  imageUploadController.uploadImage
);

/**
 * @route POST /api/upload/images
 * @desc Upload and process multiple images
 * @access Private (authenticated users with verified email)
 * @body {File[]} images - Array of image files to upload
 * @body {String} [imageType=general] - Type of images (profile, document, general)
 * @body {Array|String} [generateSizes] - Sizes to generate (comma-separated or array)
 * @body {Number} [quality] - Image quality (1-100)
 * @body {String} [format] - Output format (jpeg, png, webp)
 * @returns {Object} Batch upload results with success/failure details
 */
router.post('/images',
  validateUserQuota(),
  multipleFilesUpload('images', 10), // Max 10 files
  validateImages(),
  imageUploadController.uploadImages
);

/**
 * @route GET /api/upload/image/:id/:size?
 * @desc Get processed image by ID and size
 * @access Private (authenticated users with verified email)
 * @param {String} id - Image ID (UUID from upload response)
 * @param {String} [size=medium] - Image size (thumbnail, small, medium, large)
 * @returns {File} Image file with appropriate headers
 */
router.get('/image/:id/:size?', imageUploadController.getImage);

/**
 * @route DELETE /api/upload/image/:id
 * @desc Delete image and all its processed sizes
 * @access Private (authenticated users with verified email - own images only)
 * @param {String} id - Image ID to delete
 * @returns {Object} Deletion confirmation
 */
router.delete('/image/:id', imageUploadController.deleteImage);

/**
 * Error handling middleware for upload routes
 */
router.use((error, req, res, next) => {
  console.error('Upload API error:', error);
  
  // Handle specific error types
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
      code: 'ENTITY_TOO_LARGE'
    });
  }
  
  if (error.type === 'request.aborted') {
    return res.status(400).json({
      success: false,
      error: 'Upload was aborted',
      code: 'UPLOAD_ABORTED'
    });
  }
  
  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';
  const code = error.code || 'INTERNAL_ERROR';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    code: code
  });
});

module.exports = router;