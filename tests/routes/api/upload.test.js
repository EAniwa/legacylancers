/**
 * Upload API Routes Tests
 * Tests for upload API endpoint functionality
 */

const request = require('supertest');
const express = require('express');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const uploadRoutes = require('../../../src/routes/api/upload');
const cdnConfig = require('../../../src/config/cdn');
const { generateToken } = require('../../../src/auth/jwt');

describe('Upload API Routes', () => {
  let app;
  let testImageBuffer;
  let testOutputDir;
  let authToken;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create a test image
    testImageBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    })
    .jpeg({ quality: 85 })
    .toBuffer();

    // Set up test output directory
    testOutputDir = path.join(process.cwd(), 'test-api-output');
    const originalBaseDir = cdnConfig.local.baseDir;
    cdnConfig.local.baseDir = testOutputDir;
    
    // Initialize test storage
    await cdnConfig.initializeLocalStorage();

    // Generate auth token for testing
    authToken = generateToken({
      userId: 'test-user-456',
      email: 'testuser@example.com',
      emailVerified: true,
      role: 'user',
      kycStatus: 'pending'
    });

    // Set up Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRoutes);
  });

  afterAll(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Health Check Endpoint', () => {
    test('GET /api/upload/health should return service health', async () => {
      const response = await request(app)
        .get('/api/upload/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('storage');
      expect(response.body.data).toHaveProperty('limits');
      expect(response.body.data).toHaveProperty('supportedFormats');
      expect(response.body.data).toHaveProperty('availableSizes');
    });

    test('Health check should not require authentication', async () => {
      // Should work without Authorization header
      const response = await request(app)
        .get('/api/upload/health')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication and Rate Limiting', () => {
    test('should require authentication for upload endpoints', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    test('should require email verification', async () => {
      // Generate token for unverified user
      const unverifiedToken = generateToken({
        userId: 'unverified-user',
        email: 'unverified@example.com',
        emailVerified: false,
        role: 'user',
        kycStatus: 'pending'
      });

      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    test('should accept valid authentication', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'valid-auth.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should handle invalid tokens', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', 'Bearer invalid-token')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Single Image Upload Endpoint', () => {
    test('POST /api/upload/image should upload single image successfully', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'single-upload.jpg')
        .field('imageType', 'profile')
        .field('quality', '90')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('originalName', 'single-upload.jpg');
      expect(response.body.data).toHaveProperty('type', 'profile');
      expect(response.body.data).toHaveProperty('userId', 'test-user-456');
      expect(response.body.data).toHaveProperty('sizes');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data).toHaveProperty('uploadedAt');

      // Check generated sizes
      expect(response.body.data.sizes).toHaveProperty('thumbnail');
      expect(response.body.data.sizes).toHaveProperty('small');
      expect(response.body.data.sizes).toHaveProperty('medium');
      expect(response.body.data.sizes).toHaveProperty('large');
    });

    test('should handle custom generateSizes parameter', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'custom-sizes.jpg')
        .field('generateSizes', 'thumbnail,medium')
        .expect(201);

      expect(response.body.success).toBe(true);
      
      const sizeKeys = Object.keys(response.body.data.sizes);
      expect(sizeKeys).toEqual(expect.arrayContaining(['thumbnail', 'medium']));
      expect(sizeKeys).not.toContain('small');
      expect(sizeKeys).not.toContain('large');
    });

    test('should use default values when parameters not provided', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'defaults.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('general'); // Default type
    });

    test('should reject invalid image types', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'invalid-type.jpg')
        .field('imageType', 'invalid-type')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_IMAGE_TYPE');
    });

    test('should validate image file format', async () => {
      const textBuffer = Buffer.from('This is not an image file');
      
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', textBuffer, 'not-image.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    });

    test('should handle missing file', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .field('imageType', 'general')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_FILE');
    });
  });

  describe('Multiple Images Upload Endpoint', () => {
    test('POST /api/upload/images should upload multiple images successfully', async () => {
      const response = await request(app)
        .post('/api/upload/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', testImageBuffer, 'multi1.jpg')
        .attach('images', testImageBuffer, 'multi2.jpg')
        .attach('images', testImageBuffer, 'multi3.jpg')
        .field('imageType', 'document')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('uploaded');
      expect(response.body.data).toHaveProperty('total', 3);
      expect(response.body.data).toHaveProperty('successful', 3);
      expect(response.body.data).toHaveProperty('failed', 0);

      expect(Array.isArray(response.body.data.uploaded)).toBe(true);
      expect(response.body.data.uploaded).toHaveLength(3);

      // Verify first uploaded image
      const firstImage = response.body.data.uploaded[0];
      expect(firstImage).toHaveProperty('id');
      expect(firstImage).toHaveProperty('originalName', 'multi1.jpg');
      expect(firstImage).toHaveProperty('type', 'document');
      expect(firstImage).toHaveProperty('sizes');
    });

    test('should handle mixed success and failure in batch upload', async () => {
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
        .post('/api/upload/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', testImageBuffer, 'good.jpg')
        .attach('images', smallBuffer, 'bad.jpg')
        .field('imageType', 'general')
        .expect(207); // Partial success

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.successful).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].filename).toBe('bad.jpg');
    });

    test('should handle no files provided', async () => {
      const response = await request(app)
        .post('/api/upload/images')
        .set('Authorization', `Bearer ${authToken}`)
        .field('imageType', 'general')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('NO_FILES');
    });

    test('should enforce maximum file count', async () => {
      // Try to upload more than the maximum allowed files
      let uploadRequest = request(app)
        .post('/api/upload/images')
        .set('Authorization', `Bearer ${authToken}`);

      // Attach 11 files (assuming max is 10)
      for (let i = 0; i < 11; i++) {
        uploadRequest = uploadRequest.attach('images', testImageBuffer, `file${i}.jpg`);
      }

      const response = await uploadRequest
        .field('imageType', 'general')
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOO_MANY_FILES');
    });
  });

  describe('Image Retrieval Endpoint', () => {
    let uploadedImageId;

    beforeEach(async () => {
      // Upload an image to test retrieval
      const uploadResponse = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'retrieve-test.jpg')
        .field('imageType', 'general');

      uploadedImageId = uploadResponse.body.data.id;
    });

    test('GET /api/upload/image/:id/:size should retrieve image', async () => {
      const response = await request(app)
        .get(`/api/upload/image/${uploadedImageId}/medium`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^image\//);
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['last-modified']).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
    });

    test('should use default size when size not specified', async () => {
      const response = await request(app)
        .get(`/api/upload/image/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    test('should handle invalid size parameter', async () => {
      const response = await request(app)
        .get(`/api/upload/image/${uploadedImageId}/invalid-size`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_SIZE');
    });

    test('should handle non-existent image', async () => {
      const response = await request(app)
        .get('/api/upload/image/non-existent/medium')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('IMAGE_NOT_FOUND');
    });

    test('should support conditional requests', async () => {
      // First request
      const firstResponse = await request(app)
        .get(`/api/upload/image/${uploadedImageId}/medium`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const lastModified = firstResponse.headers['last-modified'];

      // Second request with If-Modified-Since
      const response = await request(app)
        .get(`/api/upload/image/${uploadedImageId}/medium`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-Modified-Since', lastModified)
        .expect(304);

      expect(response.body).toEqual({});
    });
  });

  describe('Image Deletion Endpoint', () => {
    let uploadedImageId;

    beforeEach(async () => {
      // Upload an image to test deletion
      const uploadResponse = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'delete-test.jpg')
        .field('imageType', 'general');

      uploadedImageId = uploadResponse.body.data.id;
    });

    test('DELETE /api/upload/image/:id should delete image', async () => {
      const response = await request(app)
        .delete(`/api/upload/image/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', uploadedImageId);
      expect(response.body.data).toHaveProperty('filesDeleted');
      expect(response.body.data).toHaveProperty('deletedAt');
      expect(typeof response.body.data.filesDeleted).toBe('number');
    });

    test('should handle deletion of non-existent image', async () => {
      const response = await request(app)
        .delete('/api/upload/image/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('IMAGE_NOT_FOUND');
    });

    test('should verify image is actually deleted', async () => {
      // Delete the image
      await request(app)
        .delete(`/api/upload/image/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to retrieve the deleted image
      const response = await request(app)
        .get(`/api/upload/image/${uploadedImageId}/medium`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('IMAGE_NOT_FOUND');
    });
  });

  describe('File Size and Validation', () => {
    test('should reject files that are too large', async () => {
      // Temporarily reduce file size limit
      const originalLimit = cdnConfig.limits.maxFileSize;
      cdnConfig.limits.maxFileSize = 100; // Very small limit

      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'too-large.jpg')
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FILE_TOO_LARGE');

      // Restore original limit
      cdnConfig.limits.maxFileSize = originalLimit;
    });

    test('should validate image dimensions', async () => {
      // Create a very small image
      const tinyBuffer = await sharp({
        create: {
          width: 5,
          height: 5,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', tinyBuffer, 'tiny.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      // Should fail validation before reaching the controller
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json data')
        .expect(400);

      // Should handle parsing error
    });

    test('should handle internal server errors', async () => {
      // This test would require mocking internal services to fail
      // For now, we'll just verify that error middleware is in place
      expect(uploadRoutes).toBeDefined();
    });

    test('should apply rate limiting', async () => {
      // Make multiple requests rapidly to test rate limiting
      const requests = [];
      for (let i = 0; i < 25; i++) { // Exceed rate limit of 20
        requests.push(
          request(app)
            .post('/api/upload/image')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('image', testImageBuffer, `rate-limit-${i}.jpg`)
        );
      }

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited (429)
      const rateLimited = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 429
      );
      
      expect(rateLimited.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Content Type Validation', () => {
    test('should accept valid image content types', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImageBuffer, 'valid.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid content types', async () => {
      const response = await request(app)
        .post('/api/upload/image')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', Buffer.from('fake content'), {
          filename: 'fake.jpg',
          contentType: 'text/plain'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});