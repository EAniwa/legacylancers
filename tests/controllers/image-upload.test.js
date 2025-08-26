/**
 * Image Upload Controller Tests
 * Tests for image upload controller functionality
 */

const request = require('supertest');
const express = require('express');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const imageUploadController = require('../../src/controllers/image-upload');
const cdnConfig = require('../../src/config/cdn');
const { singleFileUpload, multipleFilesUpload } = require('../../src/middleware/file-upload');

describe('Image Upload Controller', () => {
  let app;
  let testImageBuffer;
  let testOutputDir;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create a test image
    testImageBuffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer();

    // Set up test output directory
    testOutputDir = path.join(process.cwd(), 'test-upload-output');
    const originalBaseDir = cdnConfig.local.baseDir;
    cdnConfig.local.baseDir = testOutputDir;
    
    // Initialize test storage
    await cdnConfig.initializeLocalStorage();

    // Set up Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user-123',
        email: 'test@example.com',
        emailVerified: true
      };
      next();
    });
  });

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  beforeEach(() => {
    // Reset Express app for each test
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user-123',
        email: 'test@example.com',
        emailVerified: true
      };
      next();
    });
  });

  describe('Upload Single Image', () => {
    test('should successfully upload and process a single image', async () => {
      app.post('/upload',
        singleFileUpload('image'),
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload')
        .attach('image', testImageBuffer, 'test-image.jpg')
        .field('imageType', 'profile')
        .field('quality', '85')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('originalName', 'test-image.jpg');
      expect(response.body.data).toHaveProperty('type', 'profile');
      expect(response.body.data).toHaveProperty('userId', 'test-user-123');
      expect(response.body.data).toHaveProperty('sizes');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data).toHaveProperty('uploadedAt');

      // Check that sizes were generated
      expect(response.body.data.sizes).toHaveProperty('thumbnail');
      expect(response.body.data.sizes).toHaveProperty('small');
      expect(response.body.data.sizes).toHaveProperty('medium');
      expect(response.body.data.sizes).toHaveProperty('large');

      // Verify thumbnail properties
      const thumbnail = response.body.data.sizes.thumbnail;
      expect(thumbnail).toHaveProperty('url');
      expect(thumbnail).toHaveProperty('width', 150);
      expect(thumbnail).toHaveProperty('height', 150);
      expect(thumbnail).toHaveProperty('size');
      expect(typeof thumbnail.size).toBe('number');
    });

    test('should handle missing file', async () => {
      app.post('/upload-no-file',
        singleFileUpload('image'),
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload-no-file')
        .field('imageType', 'general')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No image file provided');
      expect(response.body.code).toBe('NO_FILE');
    });

    test('should handle invalid image type', async () => {
      app.post('/upload-invalid-type',
        singleFileUpload('image'),
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload-invalid-type')
        .attach('image', testImageBuffer, 'test.jpg')
        .field('imageType', 'invalid-type')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/Invalid image type/);
      expect(response.body.code).toBe('INVALID_IMAGE_TYPE');
    });

    test('should use default values for optional parameters', async () => {
      app.post('/upload-defaults',
        singleFileUpload('image'),
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload-defaults')
        .attach('image', testImageBuffer, 'default-test.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('general'); // Default image type
    });

    test('should handle custom generateSizes parameter', async () => {
      app.post('/upload-custom-sizes',
        singleFileUpload('image'),
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload-custom-sizes')
        .attach('image', testImageBuffer, 'custom-sizes.jpg')
        .field('generateSizes', 'thumbnail,medium')
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Should only have requested sizes
      const sizeKeys = Object.keys(response.body.data.sizes);
      expect(sizeKeys).toEqual(expect.arrayContaining(['thumbnail', 'medium']));
      expect(sizeKeys).not.toContain('small');
      expect(sizeKeys).not.toContain('large');
    });
  });

  describe('Upload Multiple Images', () => {
    test('should successfully upload and process multiple images', async () => {
      app.post('/upload-multiple',
        multipleFilesUpload('images', 5),
        imageUploadController.uploadImages
      );

      const response = await request(app)
        .post('/upload-multiple')
        .attach('images', testImageBuffer, 'image1.jpg')
        .attach('images', testImageBuffer, 'image2.jpg')
        .field('imageType', 'document')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('uploaded');
      expect(response.body.data).toHaveProperty('total', 2);
      expect(response.body.data).toHaveProperty('successful', 2);
      expect(response.body.data).toHaveProperty('failed', 0);

      expect(Array.isArray(response.body.data.uploaded)).toBe(true);
      expect(response.body.data.uploaded).toHaveLength(2);

      // Check first image
      const firstImage = response.body.data.uploaded[0];
      expect(firstImage).toHaveProperty('id');
      expect(firstImage).toHaveProperty('originalName', 'image1.jpg');
      expect(firstImage).toHaveProperty('type', 'document');
      expect(firstImage).toHaveProperty('sizes');
    });

    test('should handle no files provided', async () => {
      app.post('/upload-multiple-no-files',
        multipleFilesUpload('images', 5),
        imageUploadController.uploadImages
      );

      const response = await request(app)
        .post('/upload-multiple-no-files')
        .field('imageType', 'general')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No image files provided');
      expect(response.body.code).toBe('NO_FILES');
    });

    test('should handle mixed success and failure', async () => {
      app.post('/upload-mixed-results',
        multipleFilesUpload('images', 5),
        imageUploadController.uploadImages
      );

      // Create a small image that will fail validation
      const smallBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const response = await request(app)
        .post('/upload-mixed-results')
        .attach('images', testImageBuffer, 'good.jpg')
        .attach('images', smallBuffer, 'bad.jpg')
        .field('imageType', 'general')
        .expect(207); // Partial success

      expect(response.body.success).toBe(true); // Overall success because at least one succeeded
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.successful).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].filename).toBe('bad.jpg');
    });

    test('should handle all files failing', async () => {
      app.post('/upload-all-fail',
        multipleFilesUpload('images', 5),
        imageUploadController.uploadImages
      );

      // Create small images that will fail validation
      const smallBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const response = await request(app)
        .post('/upload-all-fail')
        .attach('images', smallBuffer, 'bad1.jpg')
        .attach('images', smallBuffer, 'bad2.jpg')
        .field('imageType', 'general')
        .expect(400); // All failed

      expect(response.body.success).toBe(false);
      expect(response.body.data.successful).toBe(0);
      expect(response.body.data.failed).toBe(2);
      expect(response.body.errors).toHaveLength(2);
    });
  });

  describe('Get Image', () => {
    let uploadedImageId;
    let uploadedImageData;

    beforeEach(async () => {
      // Upload an image to test retrieval
      const mockReq = {
        file: {
          buffer: testImageBuffer,
          originalname: 'test-get.jpg',
          mimetype: 'image/jpeg'
        },
        user: { id: 'test-user-123' },
        body: { imageType: 'general' }
      };
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await imageUploadController.uploadImage(mockReq, mockRes);
      
      // Get the response data
      const responseData = mockRes.json.mock.calls[0][0];
      uploadedImageId = responseData.data.id;
      uploadedImageData = responseData.data;
    });

    test('should retrieve image successfully', async () => {
      app.get('/get-image/:id/:size?',
        imageUploadController.getImage
      );

      const response = await request(app)
        .get(`/get-image/${uploadedImageId}/medium`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^image\//);
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
    });

    test('should use default size when not specified', async () => {
      app.get('/get-image/:id/:size?',
        imageUploadController.getImage
      );

      const response = await request(app)
        .get(`/get-image/${uploadedImageId}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    test('should handle invalid size parameter', async () => {
      app.get('/get-image/:id/:size?',
        imageUploadController.getImage
      );

      const response = await request(app)
        .get(`/get-image/${uploadedImageId}/invalid-size`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_SIZE');
    });

    test('should handle non-existent image', async () => {
      app.get('/get-image/:id/:size?',
        imageUploadController.getImage
      );

      const response = await request(app)
        .get('/get-image/non-existent-id/medium')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('IMAGE_NOT_FOUND');
    });

    test('should handle conditional requests with If-Modified-Since', async () => {
      app.get('/get-image/:id/:size?',
        imageUploadController.getImage
      );

      // First request to get the Last-Modified header
      const firstResponse = await request(app)
        .get(`/get-image/${uploadedImageId}/medium`)
        .expect(200);

      const lastModified = firstResponse.headers['last-modified'];

      // Second request with If-Modified-Since header
      const response = await request(app)
        .get(`/get-image/${uploadedImageId}/medium`)
        .set('If-Modified-Since', lastModified)
        .expect(304); // Not Modified

      expect(response.body).toEqual({});
    });
  });

  describe('Delete Image', () => {
    let uploadedImageId;

    beforeEach(async () => {
      // Upload an image to test deletion
      const mockReq = {
        file: {
          buffer: testImageBuffer,
          originalname: 'test-delete.jpg',
          mimetype: 'image/jpeg'
        },
        user: { id: 'test-user-123' },
        body: { imageType: 'general' }
      };
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await imageUploadController.uploadImage(mockReq, mockRes);
      const responseData = mockRes.json.mock.calls[0][0];
      uploadedImageId = responseData.data.id;
    });

    test('should delete image successfully', async () => {
      app.delete('/delete-image/:id',
        imageUploadController.deleteImage
      );

      const response = await request(app)
        .delete(`/delete-image/${uploadedImageId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', uploadedImageId);
      expect(response.body.data).toHaveProperty('filesDeleted');
      expect(response.body.data).toHaveProperty('deletedAt');
      expect(typeof response.body.data.filesDeleted).toBe('number');
      expect(response.body.data.filesDeleted).toBeGreaterThan(0);
    });

    test('should handle deletion of non-existent image', async () => {
      app.delete('/delete-image/:id',
        imageUploadController.deleteImage
      );

      const response = await request(app)
        .delete('/delete-image/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('IMAGE_NOT_FOUND');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      app.get('/health', imageUploadController.getHealth);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('storage');
      expect(response.body.data).toHaveProperty('limits');
      expect(response.body.data).toHaveProperty('supportedFormats');
      expect(response.body.data).toHaveProperty('availableSizes');

      // Check storage information
      expect(response.body.data.storage).toHaveProperty('type');
      expect(response.body.data.storage).toHaveProperty('accessible', true);

      // Check limits information
      expect(response.body.data.limits).toHaveProperty('maxFileSize');
      expect(response.body.data.limits).toHaveProperty('maxFiles');
      expect(response.body.data.limits).toHaveProperty('maxFilesPerUser');

      // Check supported formats
      expect(Array.isArray(response.body.data.supportedFormats)).toBe(true);
      expect(response.body.data.supportedFormats.length).toBeGreaterThan(0);

      // Check available sizes
      expect(Array.isArray(response.body.data.availableSizes)).toBe(true);
      expect(response.body.data.availableSizes.length).toBeGreaterThan(0);
    });

    test('should handle storage directory accessibility issues', async () => {
      // Temporarily change to a non-existent directory
      const originalBaseDir = cdnConfig.local.baseDir;
      cdnConfig.local.baseDir = '/non/existent/directory';

      app.get('/health-bad-storage', imageUploadController.getHealth);

      const response = await request(app)
        .get('/health-bad-storage')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('STORAGE_UNAVAILABLE');

      // Restore original directory
      cdnConfig.local.baseDir = originalBaseDir;
    });
  });

  describe('MIME Type Detection', () => {
    test('should detect JPEG MIME type correctly', () => {
      const mimeType = imageUploadController.getMimeTypeFromFile('test.jpg');
      expect(mimeType).toBe('image/jpeg');
    });

    test('should detect PNG MIME type correctly', () => {
      const mimeType = imageUploadController.getMimeTypeFromFile('test.png');
      expect(mimeType).toBe('image/png');
    });

    test('should detect WebP MIME type correctly', () => {
      const mimeType = imageUploadController.getMimeTypeFromFile('test.webp');
      expect(mimeType).toBe('image/webp');
    });

    test('should return default MIME type for unknown extensions', () => {
      const mimeType = imageUploadController.getMimeTypeFromFile('test.unknown');
      expect(mimeType).toBe('application/octet-stream');
    });
  });

  describe('Error Handling', () => {
    test('should handle processing errors gracefully', async () => {
      app.post('/upload-error',
        (req, res, next) => {
          // Mock a file that will cause processing to fail
          req.file = {
            buffer: Buffer.from('invalid image data'),
            originalname: 'corrupt.jpg',
            mimetype: 'image/jpeg'
          };
          next();
        },
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload-error')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });

    test('should handle internal server errors', async () => {
      // Mock imageProcessingService to throw an unexpected error
      const originalProcessImage = require('../../src/services/image-processing').processImage;
      require('../../src/services/image-processing').processImage = jest.fn()
        .mockRejectedValue(new Error('Unexpected error'));

      app.post('/upload-server-error',
        singleFileUpload('image'),
        imageUploadController.uploadImage
      );

      const response = await request(app)
        .post('/upload-server-error')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UPLOAD_ERROR');

      // Restore original function
      require('../../src/services/image-processing').processImage = originalProcessImage;
    });
  });
});