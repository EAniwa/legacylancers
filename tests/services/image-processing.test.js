/**
 * Image Processing Service Tests
 * Tests for image processing functionality
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const imageProcessingService = require('../../src/services/image-processing');
const cdnConfig = require('../../src/config/cdn');

describe('Image Processing Service', () => {
  let testImageBuffer;
  let testImagePath;
  let testOutputDir;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create a test image using Sharp
    testImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer();

    // Set up test output directory
    testOutputDir = path.join(process.cwd(), 'test-image-output');
    
    // Override CDN config for testing
    const originalBaseDir = cdnConfig.local.baseDir;
    cdnConfig.local.baseDir = testOutputDir;
    
    // Initialize test storage
    await cdnConfig.initializeLocalStorage();
  });

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Image Validation', () => {
    test('should validate a valid JPEG image', async () => {
      const result = await imageProcessingService.validateImage(
        testImageBuffer,
        'test.jpg',
        'image/jpeg'
      );

      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('width', 800);
      expect(result.metadata).toHaveProperty('height', 600);
      expect(result.metadata).toHaveProperty('format', 'jpeg');
      expect(result.metadata).toHaveProperty('size');
      expect(typeof result.metadata.size).toBe('number');
    });

    test('should reject invalid MIME type', async () => {
      await expect(
        imageProcessingService.validateImage(
          testImageBuffer,
          'test.txt',
          'text/plain'
        )
      ).rejects.toThrow(/Unsupported image type/);
    });

    test('should reject images that are too small', async () => {
      // Create a very small image
      const smallImageBuffer = await sharp({
        create: {
          width: 20,
          height: 20,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      await expect(
        imageProcessingService.validateImage(
          smallImageBuffer,
          'small.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow(/Image too small/);
    });

    test('should reject images that are too large', async () => {
      // Create an image that exceeds maximum dimensions
      const largeImageBuffer = await sharp({
        create: {
          width: 15000,
          height: 15000,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg({ quality: 10 }) // Low quality to reduce buffer size
      .toBuffer();

      await expect(
        imageProcessingService.validateImage(
          largeImageBuffer,
          'large.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow(/Image too large/);
    }, 15000);

    test('should reject files that are too large by size', async () => {
      // Mock a buffer that exceeds size limits
      const originalMaxSize = cdnConfig.limits.maxFileSize;
      cdnConfig.limits.maxFileSize = 100; // Very small limit
      
      await expect(
        imageProcessingService.validateImage(
          testImageBuffer,
          'test.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow(/File too large/);
      
      // Restore original limit
      cdnConfig.limits.maxFileSize = originalMaxSize;
    });

    test('should handle corrupted image data', async () => {
      const corruptBuffer = Buffer.from('invalid image data');
      
      await expect(
        imageProcessingService.validateImage(
          corruptBuffer,
          'corrupt.jpg',
          'image/jpeg'
        )
      ).rejects.toThrow(/Failed to validate image/);
    });
  });

  describe('Image Processing', () => {
    test('should process image and generate all sizes', async () => {
      const userId = 'test-user-123';
      const options = {
        userId,
        imageType: 'profile',
        generateSizes: ['thumbnail', 'medium'],
        quality: 85,
        format: 'jpeg'
      };

      const result = await imageProcessingService.processImage(
        testImageBuffer,
        'test-image.jpg',
        options
      );

      expect(result).toHaveProperty('originalMetadata');
      expect(result).toHaveProperty('sizes');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('type', 'profile');
      expect(result).toHaveProperty('userId', userId);

      // Check that both sizes were generated
      expect(Object.keys(result.sizes)).toEqual(expect.arrayContaining(['thumbnail', 'medium']));

      // Verify thumbnail size
      const thumbnail = result.sizes.thumbnail;
      expect(thumbnail).toHaveProperty('width', 150);
      expect(thumbnail).toHaveProperty('height', 150);
      expect(thumbnail).toHaveProperty('url');
      expect(thumbnail).toHaveProperty('size');

      // Verify medium size
      const medium = result.sizes.medium;
      expect(medium).toHaveProperty('width', 600);
      expect(medium).toHaveProperty('height', 600);
      expect(medium).toHaveProperty('url');
      expect(medium).toHaveProperty('size');

      // Check that files were actually created
      expect(await fs.access(thumbnail.fullPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(medium.fullPath).then(() => true).catch(() => false)).toBe(true);
    }, 15000);

    test('should handle different image types', async () => {
      const userId = 'test-user-456';
      const options = {
        userId,
        imageType: 'document',
        generateSizes: ['small'],
        quality: 90,
        format: 'png'
      };

      const result = await imageProcessingService.processImage(
        testImageBuffer,
        'document.png',
        options
      );

      expect(result.type).toBe('document');
      expect(result.sizes).toHaveProperty('small');
    });

    test('should generate unique filenames', async () => {
      const userId = 'test-user-789';
      const options = {
        userId,
        imageType: 'general',
        generateSizes: ['thumbnail'],
        quality: 80
      };

      const result1 = await imageProcessingService.processImage(
        testImageBuffer,
        'same-name.jpg',
        options
      );

      const result2 = await imageProcessingService.processImage(
        testImageBuffer,
        'same-name.jpg',
        options
      );

      expect(result1.filename).not.toBe(result2.filename);
    });

    test('should handle processing errors gracefully', async () => {
      const corruptBuffer = Buffer.from('not an image');
      const userId = 'test-user-error';
      
      await expect(
        imageProcessingService.processImage(
          corruptBuffer,
          'corrupt.jpg',
          { userId, imageType: 'general' }
        )
      ).rejects.toThrow();
    });
  });

  describe('Image Resizing', () => {
    test('should resize image to exact dimensions', async () => {
      const sizeConfig = { width: 200, height: 200, quality: 80 };
      const resizedBuffer = await imageProcessingService.resizeImage(
        testImageBuffer,
        sizeConfig,
        'jpeg'
      );

      const metadata = await sharp(resizedBuffer).metadata();
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
      expect(metadata.format).toBe('jpeg');
    });

    test('should handle different output formats', async () => {
      const sizeConfig = { width: 100, height: 100, quality: 90 };
      
      // Test PNG output
      const pngBuffer = await imageProcessingService.resizeImage(
        testImageBuffer,
        sizeConfig,
        'png'
      );
      const pngMetadata = await sharp(pngBuffer).metadata();
      expect(pngMetadata.format).toBe('png');

      // Test WebP output
      const webpBuffer = await imageProcessingService.resizeImage(
        testImageBuffer,
        sizeConfig,
        'webp'
      );
      const webpMetadata = await sharp(webpBuffer).metadata();
      expect(webpMetadata.format).toBe('webp');
    });

    test('should handle resize errors', async () => {
      const invalidBuffer = Buffer.from('invalid');
      const sizeConfig = { width: 100, height: 100, quality: 80 };
      
      await expect(
        imageProcessingService.resizeImage(invalidBuffer, sizeConfig, 'jpeg')
      ).rejects.toThrow();
    });
  });

  describe('Image Information', () => {
    test('should get image information without processing', async () => {
      const info = await imageProcessingService.getImageInfo(testImageBuffer);
      
      expect(info).toHaveProperty('width', 800);
      expect(info).toHaveProperty('height', 600);
      expect(info).toHaveProperty('format', 'jpeg');
      expect(info).toHaveProperty('size');
      expect(info).toHaveProperty('channels');
      expect(typeof info.size).toBe('number');
    });

    test('should handle invalid image data', async () => {
      const invalidBuffer = Buffer.from('not an image');
      
      await expect(
        imageProcessingService.getImageInfo(invalidBuffer)
      ).rejects.toThrow();
    });
  });

  describe('Image Optimization', () => {
    test('should optimize image without resizing', async () => {
      const optimized = await imageProcessingService.optimizeImage(
        testImageBuffer,
        { quality: 50, format: 'jpeg' }
      );

      const originalMetadata = await sharp(testImageBuffer).metadata();
      const optimizedMetadata = await sharp(optimized).metadata();

      // Should maintain dimensions
      expect(optimizedMetadata.width).toBe(originalMetadata.width);
      expect(optimizedMetadata.height).toBe(originalMetadata.height);

      // Should be smaller in size (due to lower quality)
      expect(optimized.length).toBeLessThan(testImageBuffer.length);
    });

    test('should handle different optimization formats', async () => {
      const pngOptimized = await imageProcessingService.optimizeImage(
        testImageBuffer,
        { quality: 80, format: 'png' }
      );

      const metadata = await sharp(pngOptimized).metadata();
      expect(metadata.format).toBe('png');
    });

    test('should handle optimization errors', async () => {
      const invalidBuffer = Buffer.from('invalid');
      
      await expect(
        imageProcessingService.optimizeImage(invalidBuffer)
      ).rejects.toThrow();
    });
  });

  describe('Image Deletion', () => {
    test('should delete processed images', async () => {
      // First, process an image
      const userId = 'test-delete-user';
      const result = await imageProcessingService.processImage(
        testImageBuffer,
        'to-delete.jpg',
        {
          userId,
          imageType: 'general',
          generateSizes: ['thumbnail', 'small']
        }
      );

      // Verify files exist
      for (const sizeData of Object.values(result.sizes)) {
        expect(await fs.access(sizeData.fullPath).then(() => true).catch(() => false)).toBe(true);
      }

      // Delete images
      await imageProcessingService.deleteImages(result);

      // Verify files are deleted
      for (const sizeData of Object.values(result.sizes)) {
        expect(await fs.access(sizeData.fullPath).then(() => true).catch(() => false)).toBe(false);
      }
    });

    test('should handle deletion of non-existent files gracefully', async () => {
      const mockImageRecord = {
        sizes: {
          thumbnail: { fullPath: '/non/existent/path.jpg' },
          medium: { fullPath: '/another/fake/path.jpg' }
        }
      };

      // Should not throw even if files don't exist
      await expect(
        imageProcessingService.deleteImages(mockImageRecord)
      ).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should throw ImageProcessingError with proper properties', async () => {
      try {
        await imageProcessingService.validateImage(
          testImageBuffer,
          'test.txt',
          'text/plain'
        );
      } catch (error) {
        expect(error.name).toBe('ImageProcessingError');
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('statusCode');
        expect(typeof error.message).toBe('string');
      }
    });

    test('should handle Sharp errors gracefully', async () => {
      const invalidBuffer = Buffer.alloc(0); // Empty buffer
      
      await expect(
        imageProcessingService.getImageInfo(invalidBuffer)
      ).rejects.toThrow();
    });
  });
});