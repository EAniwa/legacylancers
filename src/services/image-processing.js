/**
 * Image Processing Service
 * Handles image processing, optimization, and thumbnail generation using Sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const cdnConfig = require('../config/cdn');

class ImageProcessingError extends Error {
  constructor(message, code = 'IMAGE_PROCESSING_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ImageProcessingService {
  constructor() {
    this.supportedFormats = cdnConfig.processing.supportedFormats;
    this.sizes = cdnConfig.processing.sizes;
    this.defaults = cdnConfig.processing.defaults;
  }

  /**
   * Validate image file
   * @param {Buffer} buffer - Image buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - MIME type
   * @returns {Promise<Object>} Validation result
   */
  async validateImage(buffer, originalName, mimeType) {
    try {
      // Check MIME type
      if (!cdnConfig.security.allowedMimeTypes.includes(mimeType)) {
        throw new ImageProcessingError(
          `Unsupported image type: ${mimeType}`,
          'INVALID_IMAGE_TYPE',
          400
        );
      }

      // Get image metadata using Sharp
      const metadata = await sharp(buffer).metadata();
      
      // Validate image format
      if (!this.supportedFormats.includes(metadata.format)) {
        throw new ImageProcessingError(
          `Unsupported image format: ${metadata.format}`,
          'INVALID_IMAGE_FORMAT',
          400
        );
      }

      // Check image dimensions (minimum requirements)
      const minWidth = 50;
      const minHeight = 50;
      if (metadata.width < minWidth || metadata.height < minHeight) {
        throw new ImageProcessingError(
          `Image too small: minimum ${minWidth}x${minHeight} pixels required`,
          'IMAGE_TOO_SMALL',
          400
        );
      }

      // Check image dimensions (maximum requirements)
      const maxWidth = 10000;
      const maxHeight = 10000;
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        throw new ImageProcessingError(
          `Image too large: maximum ${maxWidth}x${maxHeight} pixels allowed`,
          'IMAGE_TOO_LARGE',
          400
        );
      }

      // Check file size
      if (buffer.length > cdnConfig.limits.maxFileSize) {
        throw new ImageProcessingError(
          `File too large: maximum ${Math.round(cdnConfig.limits.maxFileSize / 1024 / 1024)}MB allowed`,
          'FILE_TOO_LARGE',
          400
        );
      }

      return {
        valid: true,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: buffer.length,
          density: metadata.density,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha
        }
      };

    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error;
      }
      
      throw new ImageProcessingError(
        'Failed to validate image',
        'VALIDATION_FAILED',
        400
      );
    }
  }

  /**
   * Process image into multiple sizes
   * @param {Buffer} buffer - Original image buffer
   * @param {string} originalName - Original filename
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing results
   */
  async processImage(buffer, originalName, options = {}) {
    try {
      const {
        userId,
        imageType = 'general',
        generateSizes = Object.keys(this.sizes),
        format = this.defaults.format,
        quality = this.defaults.quality,
        mimeType
      } = options;

      // Infer MIME type from file extension if not provided
      const inferredMimeType = mimeType || this.getMimeTypeFromExtension(originalName);

      // Validate image first
      const validation = await this.validateImage(buffer, originalName, inferredMimeType);
      
      // Generate unique filename
      const extension = path.extname(originalName).toLowerCase() || `.${format}`;
      const baseName = path.basename(originalName, extension);
      const uniqueId = uuidv4();
      const filename = `${baseName}_${uniqueId}${extension}`;

      const results = {
        originalMetadata: validation.metadata,
        sizes: {},
        filename: filename,
        type: imageType,
        userId: userId
      };

      // Process each requested size
      for (const sizeName of generateSizes) {
        if (!this.sizes[sizeName]) {
          console.warn(`Unknown image size: ${sizeName}, skipping`);
          continue;
        }

        const sizeConfig = this.sizes[sizeName];
        const processedBuffer = await this.resizeImage(buffer, sizeConfig, format);
        
        // Generate file path for this size
        const filePath = cdnConfig.generateFilePath(userId, imageType, sizeName, filename);
        const fullPath = path.join(cdnConfig.local.baseDir, filePath);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        
        // Save processed image
        await fs.writeFile(fullPath, processedBuffer);
        
        results.sizes[sizeName] = {
          path: filePath,
          fullPath: fullPath,
          size: processedBuffer.length,
          width: sizeConfig.width,
          height: sizeConfig.height,
          url: cdnConfig.generatePublicUrl(filePath)
        };
      }

      return results;

    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error;
      }
      
      console.error('Image processing failed:', error);
      throw new ImageProcessingError(
        'Failed to process image',
        'PROCESSING_FAILED',
        500
      );
    }
  }

  /**
   * Resize image to specific dimensions
   * @param {Buffer} buffer - Image buffer
   * @param {Object} sizeConfig - Size configuration
   * @param {string} format - Output format
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async resizeImage(buffer, sizeConfig, format = this.defaults.format) {
    try {
      let pipeline = sharp(buffer);

      // Resize with proper handling of aspect ratio
      pipeline = pipeline.resize({
        width: sizeConfig.width,
        height: sizeConfig.height,
        fit: 'cover', // Crop to exact dimensions
        position: 'centre'
      });

      // Apply format-specific optimizations
      switch (format) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({
            quality: sizeConfig.quality || this.defaults.quality,
            progressive: this.defaults.progressive,
            mozjpeg: this.defaults.mozjpeg,
            optimizeScans: this.defaults.optimizeScans
          });
          break;

        case 'png':
          pipeline = pipeline.png({
            quality: sizeConfig.quality || this.defaults.quality,
            progressive: this.defaults.progressive,
            compressionLevel: 9,
            adaptiveFiltering: true
          });
          break;

        case 'webp':
          pipeline = pipeline.webp({
            quality: sizeConfig.quality || this.defaults.quality,
            effort: 6 // Maximum compression effort
          });
          break;

        default:
          // Default to JPEG
          pipeline = pipeline.jpeg({
            quality: sizeConfig.quality || this.defaults.quality,
            progressive: this.defaults.progressive
          });
      }

      return await pipeline.toBuffer();

    } catch (error) {
      console.error('Image resize failed:', error);
      throw new ImageProcessingError(
        'Failed to resize image',
        'RESIZE_FAILED',
        500
      );
    }
  }

  /**
   * Delete processed images
   * @param {Object} imageRecord - Image record with file paths
   * @returns {Promise<void>}
   */
  async deleteImages(imageRecord) {
    try {
      const { sizes } = imageRecord;
      
      for (const sizeName in sizes) {
        const sizeData = sizes[sizeName];
        try {
          await fs.unlink(sizeData.fullPath);
        } catch (error) {
          // Log but don't throw - file might already be deleted
          console.warn(`Failed to delete image file: ${sizeData.fullPath}`, error.message);
        }
      }

    } catch (error) {
      console.error('Image deletion failed:', error);
      throw new ImageProcessingError(
        'Failed to delete images',
        'DELETION_FAILED',
        500
      );
    }
  }

  /**
   * Get image information without processing
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<Object>} Image metadata
   */
  async getImageInfo(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        density: metadata.density,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };

    } catch (error) {
      throw new ImageProcessingError(
        'Failed to get image information',
        'INFO_FAILED',
        400
      );
    }
  }

  /**
   * Get MIME type from file extension
   * @param {string} filename - Filename with extension
   * @returns {string} MIME type
   */
  getMimeTypeFromExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    
    return mimeTypes[ext] || 'image/jpeg'; // Default to JPEG
  }

  /**
   * Optimize existing image without resizing
   * @param {Buffer} buffer - Image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} Optimized image buffer
   */
  async optimizeImage(buffer, options = {}) {
    try {
      const {
        format = this.defaults.format,
        quality = this.defaults.quality
      } = options;

      let pipeline = sharp(buffer);

      // Apply format-specific optimizations without resizing
      switch (format) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({
            quality,
            progressive: this.defaults.progressive,
            mozjpeg: this.defaults.mozjpeg,
            optimizeScans: this.defaults.optimizeScans
          });
          break;

        case 'png':
          pipeline = pipeline.png({
            quality,
            progressive: this.defaults.progressive,
            compressionLevel: 9,
            adaptiveFiltering: true
          });
          break;

        case 'webp':
          pipeline = pipeline.webp({
            quality,
            effort: 6
          });
          break;

        default:
          pipeline = pipeline.jpeg({
            quality,
            progressive: this.defaults.progressive
          });
      }

      return await pipeline.toBuffer();

    } catch (error) {
      throw new ImageProcessingError(
        'Failed to optimize image',
        'OPTIMIZATION_FAILED',
        500
      );
    }
  }
}

// Export singleton instance
module.exports = new ImageProcessingService();