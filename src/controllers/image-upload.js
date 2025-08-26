/**
 * Image Upload Controllers
 * Handles image upload, processing, retrieval, and deletion
 */

const imageProcessingService = require('../services/image-processing');
const cdnConfig = require('../config/cdn');
const fs = require('fs').promises;
const path = require('path');

class ImageUploadController {
  /**
   * Upload and process a single image
   * POST /api/upload/image
   */
  async uploadImage(req, res) {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided',
          code: 'NO_FILE'
        });
      }

      // Get user ID from authenticated request
      const userId = req.user.id;
      
      // Get processing options from request body
      const {
        imageType = 'general',
        generateSizes = Object.keys(cdnConfig.processing.sizes),
        quality = cdnConfig.processing.defaults.quality,
        format = cdnConfig.processing.defaults.format
      } = req.body;

      // Validate image type
      const validTypes = Object.values(cdnConfig.organization.types);
      if (!validTypes.includes(imageType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid image type. Allowed types: ${validTypes.join(', ')}`,
          code: 'INVALID_IMAGE_TYPE'
        });
      }

      // Process image
      const processingResult = await imageProcessingService.processImage(
        req.file.buffer,
        req.file.originalname,
        {
          userId,
          imageType,
          generateSizes: Array.isArray(generateSizes) ? generateSizes : generateSizes.split(','),
          quality: parseInt(quality),
          format
        }
      );

      // Create response with image information
      const response = {
        success: true,
        data: {
          id: processingResult.filename.split('_')[1]?.split('.')[0], // Extract UUID from filename
          filename: processingResult.filename,
          originalName: req.file.originalname,
          type: imageType,
          userId: userId,
          sizes: {},
          metadata: processingResult.originalMetadata,
          uploadedAt: new Date().toISOString()
        }
      };

      // Add size information to response
      for (const [sizeName, sizeData] of Object.entries(processingResult.sizes)) {
        response.data.sizes[sizeName] = {
          url: sizeData.url,
          width: sizeData.width,
          height: sizeData.height,
          size: sizeData.size
        };
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('Image upload error:', error);
      
      const statusCode = error.statusCode || 500;
      const message = error.message || 'Failed to upload image';
      const code = error.code || 'UPLOAD_ERROR';
      
      res.status(statusCode).json({
        success: false,
        error: message,
        code: code
      });
    }
  }

  /**
   * Upload and process multiple images
   * POST /api/upload/images
   */
  async uploadImages(req, res) {
    try {
      // Check if files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No image files provided',
          code: 'NO_FILES'
        });
      }

      const userId = req.user.id;
      const {
        imageType = 'general',
        generateSizes = Object.keys(cdnConfig.processing.sizes),
        quality = cdnConfig.processing.defaults.quality,
        format = cdnConfig.processing.defaults.format
      } = req.body;

      // Validate image type
      const validTypes = Object.values(cdnConfig.organization.types);
      if (!validTypes.includes(imageType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid image type. Allowed types: ${validTypes.join(', ')}`,
          code: 'INVALID_IMAGE_TYPE'
        });
      }

      const results = [];
      const errors = [];

      // Process each file
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        
        try {
          const processingResult = await imageProcessingService.processImage(
            file.buffer,
            file.originalname,
            {
              userId,
              imageType,
              generateSizes: Array.isArray(generateSizes) ? generateSizes : generateSizes.split(','),
              quality: parseInt(quality),
              format
            }
          );

          const imageData = {
            id: processingResult.filename.split('_')[1]?.split('.')[0],
            filename: processingResult.filename,
            originalName: file.originalname,
            type: imageType,
            userId: userId,
            sizes: {},
            metadata: processingResult.originalMetadata,
            uploadedAt: new Date().toISOString()
          };

          // Add size information
          for (const [sizeName, sizeData] of Object.entries(processingResult.sizes)) {
            imageData.sizes[sizeName] = {
              url: sizeData.url,
              width: sizeData.width,
              height: sizeData.height,
              size: sizeData.size
            };
          }

          results.push(imageData);

        } catch (error) {
          errors.push({
            filename: file.originalname,
            error: error.message,
            code: error.code || 'PROCESSING_ERROR'
          });
        }
      }

      // Determine response status
      const hasErrors = errors.length > 0;
      const hasSuccesses = results.length > 0;
      
      let statusCode = 201;
      if (hasErrors && !hasSuccesses) {
        statusCode = 400; // All failed
      } else if (hasErrors && hasSuccesses) {
        statusCode = 207; // Partial success
      }

      const response = {
        success: hasSuccesses,
        data: {
          uploaded: results,
          total: req.files.length,
          successful: results.length,
          failed: errors.length
        }
      };

      if (hasErrors) {
        response.errors = errors;
      }

      res.status(statusCode).json(response);

    } catch (error) {
      console.error('Multiple images upload error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to upload images',
        code: 'BATCH_UPLOAD_ERROR'
      });
    }
  }

  /**
   * Get processed image by ID and size
   * GET /api/upload/image/:id/:size?
   */
  async getImage(req, res) {
    try {
      const { id, size = 'medium' } = req.params;
      const userId = req.user.id;
      
      // Validate size parameter
      if (!cdnConfig.processing.sizes[size]) {
        return res.status(400).json({
          success: false,
          error: `Invalid size parameter. Available sizes: ${Object.keys(cdnConfig.processing.sizes).join(', ')}`,
          code: 'INVALID_SIZE'
        });
      }

      // In a real application, you would:
      // 1. Query database to find image record by ID
      // 2. Check if user has access to this image
      // 3. Get the file path from database record
      
      // For this implementation, we'll construct the path and check if file exists
      // This is a simplified approach for demonstration
      
      // Construct expected file path pattern
      const baseDir = cdnConfig.local.baseDir;
      
      // We need to find the file by scanning directories since we don't have a database
      // In production, you'd store this information in a database
      const typeDirectories = Object.values(cdnConfig.organization.types);
      let foundFile = null;
      
      for (const type of typeDirectories) {
        const searchPath = path.join(baseDir, userId, type, size);
        
        try {
          const files = await fs.readdir(searchPath);
          const matchingFile = files.find(file => file.includes(id));
          
          if (matchingFile) {
            foundFile = path.join(searchPath, matchingFile);
            break;
          }
        } catch (error) {
          // Directory doesn't exist or is empty, continue searching
          continue;
        }
      }

      if (!foundFile) {
        return res.status(404).json({
          success: false,
          error: 'Image not found',
          code: 'IMAGE_NOT_FOUND'
        });
      }

      // Check if file exists
      try {
        await fs.access(foundFile);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Image file not found',
          code: 'FILE_NOT_FOUND'
        });
      }

      // Get file stats
      const stats = await fs.stat(foundFile);
      const mimeType = this.getMimeTypeFromFile(foundFile);

      // Set appropriate headers
      res.set({
        'Content-Type': mimeType,
        'Content-Length': stats.size,
        'Cache-Control': `public, max-age=${cdnConfig.cache.maxAge}`,
        'Last-Modified': stats.mtime.toUTCString(),
        'ETag': `"${stats.size}-${stats.mtime.getTime()}"`
      });

      // Handle conditional requests
      const ifModifiedSince = req.headers['if-modified-since'];
      const ifNoneMatch = req.headers['if-none-match'];

      if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
        return res.status(304).end();
      }

      if (ifNoneMatch && ifNoneMatch === `"${stats.size}-${stats.mtime.getTime()}"`) {
        return res.status(304).end();
      }

      // Stream the file
      const fileBuffer = await fs.readFile(foundFile);
      res.end(fileBuffer);

    } catch (error) {
      console.error('Get image error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve image',
        code: 'RETRIEVAL_ERROR'
      });
    }
  }

  /**
   * Delete image and all its sizes
   * DELETE /api/upload/image/:id
   */
  async deleteImage(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Find and delete all sizes of the image
      const baseDir = cdnConfig.local.baseDir;
      const typeDirectories = Object.values(cdnConfig.organization.types);
      const sizes = Object.keys(cdnConfig.processing.sizes);
      
      let filesDeleted = 0;
      let foundImage = false;

      for (const type of typeDirectories) {
        for (const size of sizes) {
          const searchPath = path.join(baseDir, userId, type, size);
          
          try {
            const files = await fs.readdir(searchPath);
            const matchingFile = files.find(file => file.includes(id));
            
            if (matchingFile) {
              foundImage = true;
              const filePath = path.join(searchPath, matchingFile);
              await fs.unlink(filePath);
              filesDeleted++;
            }
          } catch (error) {
            // Directory doesn't exist or file already deleted, continue
            continue;
          }
        }
      }

      if (!foundImage) {
        return res.status(404).json({
          success: false,
          error: 'Image not found',
          code: 'IMAGE_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: {
          id: id,
          filesDeleted: filesDeleted,
          deletedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Delete image error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete image',
        code: 'DELETION_ERROR'
      });
    }
  }

  /**
   * Get service health status
   * GET /api/upload/health
   */
  async getHealth(req, res) {
    try {
      // Check if upload directory is accessible
      const uploadDir = cdnConfig.local.baseDir;
      
      try {
        await fs.access(uploadDir);
      } catch (error) {
        return res.status(503).json({
          success: false,
          error: 'Upload directory not accessible',
          code: 'STORAGE_UNAVAILABLE',
          details: {
            uploadDir: uploadDir,
            error: error.message
          }
        });
      }

      // Check available disk space (basic check)
      let diskInfo = {};
      try {
        const stats = await fs.stat(uploadDir);
        diskInfo = {
          uploadDir: uploadDir,
          accessible: true,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        diskInfo = {
          uploadDir: uploadDir,
          accessible: false,
          error: error.message
        };
      }

      const health = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          storage: {
            type: cdnConfig.storageType,
            ...diskInfo
          },
          limits: {
            maxFileSize: `${Math.round(cdnConfig.limits.maxFileSize / 1024 / 1024)}MB`,
            maxFiles: cdnConfig.limits.maxFiles,
            maxFilesPerUser: cdnConfig.limits.maxFilesPerUser || 'unlimited'
          },
          supportedFormats: cdnConfig.processing.supportedFormats,
          availableSizes: Object.keys(cdnConfig.processing.sizes)
        }
      };

      res.json(health);

    } catch (error) {
      console.error('Health check error:', error);
      
      res.status(503).json({
        success: false,
        error: 'Service health check failed',
        code: 'HEALTH_CHECK_ERROR'
      });
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} filePath - File path
   * @returns {string} MIME type
   */
  getMimeTypeFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = new ImageUploadController();