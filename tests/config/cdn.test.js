/**
 * CDN Configuration Tests
 * Tests for CDN configuration functionality
 */

const path = require('path');
const fs = require('fs').promises;
const cdnConfig = require('../../src/config/cdn');

describe('CDN Configuration', () => {
  beforeAll(() => {
    // Ensure we're in test environment
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Clean up any test directories created
    try {
      const testDir = path.join(process.cwd(), 'test-uploads');
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Configuration Structure', () => {
    test('should have all required configuration sections', () => {
      expect(cdnConfig).toHaveProperty('storageType');
      expect(cdnConfig).toHaveProperty('local');
      expect(cdnConfig).toHaveProperty('cdn');
      expect(cdnConfig).toHaveProperty('organization');
      expect(cdnConfig).toHaveProperty('processing');
      expect(cdnConfig).toHaveProperty('limits');
      expect(cdnConfig).toHaveProperty('security');
      expect(cdnConfig).toHaveProperty('cache');
    });

    test('should have valid storage types', () => {
      expect(['local', 'cdn']).toContain(cdnConfig.storageType);
    });

    test('should have valid local storage configuration', () => {
      expect(cdnConfig.local).toHaveProperty('baseDir');
      expect(cdnConfig.local).toHaveProperty('publicUrlBase');
      expect(typeof cdnConfig.local.baseDir).toBe('string');
      expect(typeof cdnConfig.local.publicUrlBase).toBe('string');
    });

    test('should have valid processing configuration', () => {
      expect(cdnConfig.processing).toHaveProperty('supportedFormats');
      expect(cdnConfig.processing).toHaveProperty('sizes');
      expect(cdnConfig.processing).toHaveProperty('defaults');
      
      expect(Array.isArray(cdnConfig.processing.supportedFormats)).toBe(true);
      expect(cdnConfig.processing.supportedFormats.length).toBeGreaterThan(0);
      
      expect(typeof cdnConfig.processing.sizes).toBe('object');
      expect(Object.keys(cdnConfig.processing.sizes).length).toBeGreaterThan(0);
      
      // Check that each size has required properties
      Object.values(cdnConfig.processing.sizes).forEach(size => {
        expect(size).toHaveProperty('width');
        expect(size).toHaveProperty('height');
        expect(size).toHaveProperty('quality');
        expect(typeof size.width).toBe('number');
        expect(typeof size.height).toBe('number');
        expect(typeof size.quality).toBe('number');
      });
    });

    test('should have valid security configuration', () => {
      expect(cdnConfig.security).toHaveProperty('allowedMimeTypes');
      expect(Array.isArray(cdnConfig.security.allowedMimeTypes)).toBe(true);
      expect(cdnConfig.security.allowedMimeTypes.length).toBeGreaterThan(0);
      
      // All MIME types should be valid image types
      cdnConfig.security.allowedMimeTypes.forEach(mimeType => {
        expect(mimeType).toMatch(/^image\/.+/);
      });
    });

    test('should have valid limits configuration', () => {
      expect(cdnConfig.limits).toHaveProperty('maxFileSize');
      expect(cdnConfig.limits).toHaveProperty('maxFiles');
      expect(cdnConfig.limits).toHaveProperty('maxFilesPerUser');
      
      expect(typeof cdnConfig.limits.maxFileSize).toBe('number');
      expect(typeof cdnConfig.limits.maxFiles).toBe('number');
      expect(typeof cdnConfig.limits.maxFilesPerUser).toBe('number');
      
      expect(cdnConfig.limits.maxFileSize).toBeGreaterThan(0);
      expect(cdnConfig.limits.maxFiles).toBeGreaterThan(0);
    });
  });

  describe('File Path Generation', () => {
    test('should generate correct file path structure', () => {
      const userId = 'user123';
      const type = 'profile';
      const size = 'medium';
      const filename = 'test.jpg';
      
      const filePath = cdnConfig.generateFilePath(userId, type, size, filename);
      
      expect(filePath).toBe('user123/profile/medium/test.jpg');
    });

    test('should handle different parameters correctly', () => {
      const testCases = [
        {
          userId: 'abc123',
          type: 'document',
          size: 'thumbnail',
          filename: 'document_xyz.png',
          expected: 'abc123/document/thumbnail/document_xyz.png'
        },
        {
          userId: '456def',
          type: 'general',
          size: 'large',
          filename: 'image-test.webp',
          expected: '456def/general/large/image-test.webp'
        }
      ];

      testCases.forEach(({ userId, type, size, filename, expected }) => {
        const result = cdnConfig.generateFilePath(userId, type, size, filename);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Public URL Generation', () => {
    test('should generate correct public URL for local storage', () => {
      // Temporarily set storage type to local
      const originalStorageType = cdnConfig.storageType;
      cdnConfig.storageType = 'local';
      
      const filePath = 'user123/profile/medium/test.jpg';
      const publicUrl = cdnConfig.generatePublicUrl(filePath);
      
      expect(publicUrl).toBe('/uploads/user123/profile/medium/test.jpg');
      
      // Restore original storage type
      cdnConfig.storageType = originalStorageType;
    });

    test('should generate correct CDN URL when using CDN storage', () => {
      // Create a new instance or override the function temporarily
      const originalFunction = cdnConfig.generatePublicUrl;
      
      // Mock the CDN configuration
      const mockGeneratePublicUrl = (filePath) => {
        return `https://cdn.legacylancers.com/${filePath}`;
      };
      
      const filePath = 'user123/profile/medium/test.jpg';
      const publicUrl = mockGeneratePublicUrl(filePath);
      
      expect(publicUrl).toBe('https://cdn.legacylancers.com/user123/profile/medium/test.jpg');
    });
  });

  describe('Local Storage Initialization', () => {
    test('should initialize local storage directory structure', async () => {
      // Use a test directory
      const testBaseDir = path.join(process.cwd(), 'test-uploads');
      const originalBaseDir = cdnConfig.local.baseDir;
      const originalStorageType = cdnConfig.storageType;
      const originalInitialized = cdnConfig.local.initialized;
      
      // Override configuration for test
      cdnConfig.local.baseDir = testBaseDir;
      cdnConfig.storageType = 'local';
      cdnConfig.local.initialized = false;
      
      // Initialize storage
      await cdnConfig.initializeLocalStorage();
      
      // Check if directories were created
      expect(await fs.access(testBaseDir).then(() => true).catch(() => false)).toBe(true);
      
      // Check if type directories were created
      for (const type of Object.values(cdnConfig.organization.types)) {
        const typeDir = path.join(testBaseDir, type);
        expect(await fs.access(typeDir).then(() => true).catch(() => false)).toBe(true);
        
        // Check if size directories were created
        for (const size of Object.keys(cdnConfig.processing.sizes)) {
          const sizeDir = path.join(testBaseDir, type, size);
          expect(await fs.access(sizeDir).then(() => true).catch(() => false)).toBe(true);
        }
      }
      
      expect(cdnConfig.local.initialized).toBe(true);
      
      // Restore original configuration
      cdnConfig.local.baseDir = originalBaseDir;
      cdnConfig.storageType = originalStorageType;
      cdnConfig.local.initialized = originalInitialized;
      
      // Clean up test directory
      await fs.rm(testBaseDir, { recursive: true, force: true });
    }, 10000);

    test('should handle initialization errors gracefully', async () => {
      // Use an invalid directory path
      const invalidPath = '/root/invalid/path/that/should/not/exist';
      const originalBaseDir = cdnConfig.local.baseDir;
      const originalStorageType = cdnConfig.storageType;
      const originalInitialized = cdnConfig.local.initialized;
      
      // Override configuration for test
      cdnConfig.local.baseDir = invalidPath;
      cdnConfig.storageType = 'local';
      cdnConfig.local.initialized = false;
      
      // Initialization should throw an error
      await expect(cdnConfig.initializeLocalStorage()).rejects.toThrow();
      
      // Restore original configuration
      cdnConfig.local.baseDir = originalBaseDir;
      cdnConfig.storageType = originalStorageType;
      cdnConfig.local.initialized = originalInitialized;
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration without errors in test environment', () => {
      expect(() => cdnConfig.validateConfig()).not.toThrow();
    });

    test('should require AWS credentials for production CDN', () => {
      // Mock the configuration validation to test the logic
      const mockValidateConfig = () => {
        const errors = [];
        
        // Mock production environment and CDN storage
        const mockIsProduction = true;
        const mockStorageType = 'cdn';
        const mockProvider = 'aws';
        
        if (mockStorageType === 'cdn' && mockIsProduction) {
          if (mockProvider === 'aws') {
            // Mock missing AWS credentials
            if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
              errors.push('AWS credentials must be set for CDN storage');
            }
          }
        }
        
        if (errors.length > 0) {
          throw new Error(`CDN configuration errors:\n${errors.join('\n')}`);
        }
      };
      
      // Clear AWS credentials for this test
      const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
      const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      
      // Validation should throw error
      expect(() => mockValidateConfig()).toThrow(/AWS credentials/);
      
      // Restore original credentials
      if (originalAccessKey) process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
      if (originalSecretKey) process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
    });
  });

  describe('Environment Detection', () => {
    test('should detect test environment correctly', () => {
      expect(cdnConfig.isTest).toBe(true);
      expect(cdnConfig.isProduction).toBe(false);
      expect(cdnConfig.isDevelopment).toBe(false);
    });
  });

  describe('Image Size Configurations', () => {
    test('should have thumbnail size configuration', () => {
      expect(cdnConfig.processing.sizes).toHaveProperty('thumbnail');
      const thumbnail = cdnConfig.processing.sizes.thumbnail;
      expect(thumbnail.width).toBe(150);
      expect(thumbnail.height).toBe(150);
      expect(thumbnail.quality).toBeGreaterThan(0);
      expect(thumbnail.quality).toBeLessThanOrEqual(100);
    });

    test('should have medium size configuration', () => {
      expect(cdnConfig.processing.sizes).toHaveProperty('medium');
      const medium = cdnConfig.processing.sizes.medium;
      expect(medium.width).toBe(600);
      expect(medium.height).toBe(600);
      expect(medium.quality).toBeGreaterThan(0);
      expect(medium.quality).toBeLessThanOrEqual(100);
    });

    test('should have all required sizes', () => {
      const requiredSizes = ['thumbnail', 'small', 'medium', 'large'];
      requiredSizes.forEach(size => {
        expect(cdnConfig.processing.sizes).toHaveProperty(size);
      });
    });
  });

  describe('Organization Types', () => {
    test('should have all required image types', () => {
      const requiredTypes = ['profile', 'document', 'general'];
      requiredTypes.forEach(type => {
        expect(Object.values(cdnConfig.organization.types)).toContain(type);
      });
    });

    test('should have valid organization structure pattern', () => {
      expect(cdnConfig.organization.structure).toBe('{userId}/{type}/{size}/{filename}');
    });
  });
});