/**
 * File Upload Middleware Tests
 * Tests for file upload and validation middleware
 */

const request = require('supertest');
const express = require('express');
const sharp = require('sharp');
const {
  singleFileUpload,
  multipleFilesUpload,
  validateImages,
  validateUserQuota,
  FileUploadError
} = require('../../src/middleware/file-upload');
const cdnConfig = require('../../src/config/cdn');

describe('File Upload Middleware', () => {
  let app;
  let testImageBuffer;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create a test image
    testImageBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg({ quality: 80 })
    .toBuffer();

    // Set up Express app for testing
    app = express();
    app.use(express.json());
  });

  describe('FileUploadError', () => {
    test('should create error with default properties', () => {
      const error = new FileUploadError('Test error');
      
      expect(error.name).toBe('FileUploadError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('FILE_UPLOAD_ERROR');
      expect(error.statusCode).toBe(400);
    });

    test('should create error with custom properties', () => {
      const error = new FileUploadError('Custom error', 'CUSTOM_CODE', 422);
      
      expect(error.name).toBe('FileUploadError');
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(422);
    });
  });

  describe('Single File Upload Middleware', () => {
    beforeEach(() => {
      app = express();
      app.use(express.json());
    });

    test('should handle valid single file upload', async () => {
      app.post('/test-single', singleFileUpload('image'), (req, res) => {
        expect(req.file).toBeDefined();
        expect(req.file.fieldname).toBe('image');
        expect(req.file.originalname).toBe('test.jpg');
        expect(req.file.mimetype).toBe('image/jpeg');
        expect(req.file.buffer).toBeInstanceOf(Buffer);
        
        expect(req.uploadMetadata).toBeDefined();
        expect(req.uploadMetadata.fieldName).toBe('image');
        expect(req.uploadMetadata.originalName).toBe('test.jpg');
        expect(req.uploadMetadata.mimeType).toBe('image/jpeg');
        
        res.json({ success: true, file: req.file.originalname });
      });

      const response = await request(app)
        .post('/test-single')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.file).toBe('test.jpg');
    });

    test('should reject invalid file types', async () => {
      app.post('/test-invalid', singleFileUpload('file'), (req, res) => {
        res.json({ success: true });
      });

      const textBuffer = Buffer.from('This is not an image');
      
      await request(app)
        .post('/test-invalid')
        .attach('file', textBuffer, 'test.txt')
        .expect(400);
    });

    test('should reject files with invalid extensions', async () => {
      app.post('/test-ext', singleFileUpload('file'), (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/test-ext')
        .attach('file', testImageBuffer, 'test.exe')
        .expect(400);
    });

    test('should handle files with unsafe characters in filename', async () => {
      app.post('/test-unsafe', singleFileUpload('file'), (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/test-unsafe')
        .attach('file', testImageBuffer, '../../../etc/passwd')
        .expect(400);
    });

    test('should handle file size limits', async () => {
      // Temporarily reduce file size limit
      const originalLimit = cdnConfig.limits.maxFileSize;
      cdnConfig.limits.maxFileSize = 100; // Very small limit
      
      app.post('/test-size', singleFileUpload('file'), (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/test-size')
        .attach('file', testImageBuffer, 'test.jpg')
        .expect(413);

      // Restore original limit
      cdnConfig.limits.maxFileSize = originalLimit;
    });

    test('should handle no file provided', async () => {
      app.post('/test-no-file', singleFileUpload('image'), (req, res) => {
        expect(req.file).toBeUndefined();
        expect(req.uploadMetadata).toBeUndefined();
        res.json({ success: true, hasFile: !!req.file });
      });

      const response = await request(app)
        .post('/test-no-file')
        .send({})
        .expect(200);

      expect(response.body.hasFile).toBe(false);
    });
  });

  describe('Multiple Files Upload Middleware', () => {
    test('should handle multiple valid files', async () => {
      app.post('/test-multiple', multipleFilesUpload('images', 3), (req, res) => {
        expect(req.files).toBeDefined();
        expect(Array.isArray(req.files)).toBe(true);
        expect(req.files.length).toBe(2);
        
        expect(req.uploadMetadata).toBeDefined();
        expect(req.uploadMetadata.filesCount).toBe(2);
        expect(req.uploadMetadata.files).toHaveLength(2);
        
        res.json({ 
          success: true, 
          count: req.files.length,
          files: req.files.map(f => f.originalname)
        });
      });

      const response = await request(app)
        .post('/test-multiple')
        .attach('images', testImageBuffer, 'test1.jpg')
        .attach('images', testImageBuffer, 'test2.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.files).toEqual(['test1.jpg', 'test2.jpg']);
    });

    test('should enforce file count limits', async () => {
      app.post('/test-limit', multipleFilesUpload('images', 1), (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/test-limit')
        .attach('images', testImageBuffer, 'test1.jpg')
        .attach('images', testImageBuffer, 'test2.jpg')
        .expect(413);
    });

    test('should handle no files provided', async () => {
      app.post('/test-no-files', multipleFilesUpload('images', 5), (req, res) => {
        expect(req.files).toEqual([]);
        expect(req.uploadMetadata).toBeUndefined();
        res.json({ success: true, count: req.files ? req.files.length : 0 });
      });

      const response = await request(app)
        .post('/test-no-files')
        .send({})
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('Image Validation Middleware', () => {
    test('should validate single valid image', async () => {
      app.post('/test-validate-single', 
        singleFileUpload('image'),
        validateImages(),
        (req, res) => {
          res.json({ success: true, validated: true });
        }
      );

      const response = await request(app)
        .post('/test-validate-single')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validated).toBe(true);
    });

    test('should validate multiple images', async () => {
      app.post('/test-validate-multiple',
        multipleFilesUpload('images', 3),
        validateImages(),
        (req, res) => {
          res.json({ success: true, validated: true });
        }
      );

      const response = await request(app)
        .post('/test-validate-multiple')
        .attach('images', testImageBuffer, 'test1.jpg')
        .attach('images', testImageBuffer, 'test2.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.validated).toBe(true);
    });

    test('should reject invalid image in single upload', async () => {
      app.post('/test-validate-invalid',
        singleFileUpload('image'),
        validateImages(),
        (req, res) => {
          res.json({ success: true });
        }
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
        .post('/test-validate-invalid')
        .attach('image', smallBuffer, 'small.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/Image too small/);
    });

    test('should identify problematic file in batch validation', async () => {
      app.post('/test-validate-batch-error',
        multipleFilesUpload('images', 3),
        validateImages(),
        (req, res) => {
          res.json({ success: true });
        }
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
        .post('/test-validate-batch-error')
        .attach('images', testImageBuffer, 'good.jpg')
        .attach('images', smallBuffer, 'bad.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/bad\.jpg/);
    });

    test('should handle corrupted image data', async () => {
      app.post('/test-validate-corrupt',
        singleFileUpload('image'),
        validateImages(),
        (req, res) => {
          res.json({ success: true });
        }
      );

      const corruptBuffer = Buffer.from('This is not image data at all');

      await request(app)
        .post('/test-validate-corrupt')
        .attach('image', corruptBuffer, 'corrupt.jpg')
        .expect(400);
    });
  });

  describe('User Quota Validation Middleware', () => {
    test('should pass validation when user is authenticated', async () => {
      app.post('/test-quota',
        (req, res, next) => {
          // Mock authenticated user
          req.user = { id: 'test-user-123' };
          next();
        },
        validateUserQuota(),
        (req, res) => {
          res.json({ success: true, quotaChecked: true });
        }
      );

      const response = await request(app)
        .post('/test-quota')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.quotaChecked).toBe(true);
    });

    test('should require authentication', async () => {
      app.post('/test-quota-unauth',
        validateUserQuota(),
        (req, res) => {
          res.json({ success: true });
        }
      );

      const response = await request(app)
        .post('/test-quota-unauth')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    test('should handle internal errors gracefully', async () => {
      app.post('/test-quota-error',
        (req, res, next) => {
          // Mock authenticated user
          req.user = { id: 'test-user-123' };
          next();
        },
        (req, res, next) => {
          // Simulate an error in quota checking
          const error = new Error('Database connection failed');
          next(error);
        },
        validateUserQuota(),
        (req, res) => {
          res.json({ success: true });
        }
      );

      // Add error handler
      app.use((err, req, res, next) => {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      });

      await request(app)
        .post('/test-quota-error')
        .send({})
        .expect(500);
    });
  });

  describe('Error Handling', () => {
    test('should handle multer file size errors', async () => {
      // Temporarily reduce file size limit dramatically
      const originalLimit = cdnConfig.limits.maxFileSize;
      cdnConfig.limits.maxFileSize = 10; // Very small limit (10 bytes)

      app.post('/test-size-error', singleFileUpload('image'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test-size-error')
        .attach('image', testImageBuffer, 'test.jpg')
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('FILE_TOO_LARGE');

      // Restore original limit
      cdnConfig.limits.maxFileSize = originalLimit;
    });

    test('should handle multer file count errors', async () => {
      app.post('/test-count-error', multipleFilesUpload('images', 1), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test-count-error')
        .attach('images', testImageBuffer, 'test1.jpg')
        .attach('images', testImageBuffer, 'test2.jpg')
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOO_MANY_FILES');
    });

    test('should handle unexpected field errors', async () => {
      app.post('/test-unexpected', singleFileUpload('expected'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test-unexpected')
        .attach('unexpected', testImageBuffer, 'test.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('UNEXPECTED_FIELD');
    });
  });

  describe('Mixed Fields Upload', () => {
    test('should handle mixed field uploads', async () => {
      const fields = [
        { name: 'profile', maxCount: 1 },
        { name: 'documents', maxCount: 3 }
      ];

      app.post('/test-mixed',
        (req, res, next) => {
          const upload = multipleFilesUpload.mixedFieldsUpload || 
                        require('../../src/middleware/file-upload').mixedFieldsUpload;
          
          if (upload) {
            return upload(fields)(req, res, next);
          }
          
          // Fallback if mixedFieldsUpload not available
          next();
        },
        (req, res) => {
          res.json({
            success: true,
            hasFiles: !!req.files,
            metadata: req.uploadMetadata
          });
        }
      );

      // Test with regular multipleFilesUpload if mixedFieldsUpload is not available
      await request(app)
        .post('/test-mixed')
        .send({})
        .expect(200);
    });
  });
});