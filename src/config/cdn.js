/**
 * CDN Configuration
 * Configuration for Content Delivery Network and file storage
 */

const path = require('path');
const fs = require('fs').promises;

const config = {
  // Storage type: 'local' or 'cdn'
  storageType: process.env.CDN_STORAGE_TYPE || 'local',

  // Local storage configuration
  local: {
    // Base directory for file storage
    baseDir: process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'uploads'),
    // Public URL base for serving files
    publicUrlBase: process.env.LOCAL_PUBLIC_URL_BASE || '/uploads',
    // Ensure directory exists
    initialized: false
  },

  // CDN configuration (for future implementation)
  cdn: {
    // CDN provider: 'aws', 'gcp', 'azure', 'cloudinary'
    provider: process.env.CDN_PROVIDER || 'aws',
    
    // AWS S3 Configuration
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucketName: process.env.AWS_S3_BUCKET || 'legacylancers-images',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      cloudFrontDistribution: process.env.AWS_CLOUDFRONT_DISTRIBUTION
    },

    // Google Cloud Storage Configuration
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
      bucketName: process.env.GCP_BUCKET_NAME || 'legacylancers-images',
      keyFilename: process.env.GCP_KEY_FILENAME
    },

    // Azure Blob Storage Configuration
    azure: {
      accountName: process.env.AZURE_ACCOUNT_NAME,
      accountKey: process.env.AZURE_ACCOUNT_KEY,
      containerName: process.env.AZURE_CONTAINER_NAME || 'legacylancers-images'
    },

    // Cloudinary Configuration
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    }
  },

  // File organization
  organization: {
    // Directory structure: user_id/type/size/filename
    structure: '{userId}/{type}/{size}/{filename}',
    types: {
      profile: 'profile',
      document: 'document',
      general: 'general'
    }
  },

  // Image processing settings
  processing: {
    // Supported image formats
    supportedFormats: ['jpeg', 'jpg', 'png', 'webp'],
    
    // Image sizes to generate
    sizes: {
      thumbnail: { width: 150, height: 150, quality: 85 },
      small: { width: 300, height: 300, quality: 90 },
      medium: { width: 600, height: 600, quality: 90 },
      large: { width: 1200, height: 1200, quality: 95 }
    },

    // Default processing options
    defaults: {
      quality: 90,
      format: 'jpeg',
      progressive: true,
      optimizeScans: true,
      mozjpeg: true
    }
  },

  // File limits
  limits: {
    // Maximum file size (5MB default)
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
    // Maximum files per upload
    maxFiles: parseInt(process.env.MAX_FILES_PER_UPLOAD) || 10,
    // Maximum files per user (0 = unlimited)
    maxFilesPerUser: parseInt(process.env.MAX_FILES_PER_USER) || 100
  },

  // Security settings
  security: {
    // Allowed MIME types
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ],
    // Virus scanning (if enabled)
    virusScanning: process.env.ENABLE_VIRUS_SCAN === 'true',
    // Generate secure random filenames
    secureFilenames: true
  },

  // Caching settings
  cache: {
    // Browser cache duration (1 year)
    maxAge: parseInt(process.env.CACHE_MAX_AGE) || 31536000,
    // Enable ETags
    etag: true,
    // Enable Last-Modified headers
    lastModified: true
  },

  // Environment checks
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test'
};

/**
 * Initialize local storage directory
 */
async function initializeLocalStorage() {
  if (config.storageType === 'local' && !config.local.initialized) {
    try {
      await fs.mkdir(config.local.baseDir, { recursive: true });
      
      // Create subdirectories for different image types
      for (const type of Object.values(config.organization.types)) {
        await fs.mkdir(path.join(config.local.baseDir, type), { recursive: true });
        
        // Create size subdirectories
        for (const size of Object.keys(config.processing.sizes)) {
          await fs.mkdir(path.join(config.local.baseDir, type, size), { recursive: true });
        }
      }
      
      config.local.initialized = true;
      console.log(`Local storage initialized at: ${config.local.baseDir}`);
    } catch (error) {
      console.error('Failed to initialize local storage:', error);
      throw new Error(`Local storage initialization failed: ${error.message}`);
    }
  }
}

/**
 * Generate file path based on configuration
 * @param {string} userId - User ID
 * @param {string} type - File type (profile, document, etc.)
 * @param {string} size - Image size (thumbnail, small, etc.)
 * @param {string} filename - Original filename
 * @returns {string} Generated file path
 */
function generateFilePath(userId, type, size, filename) {
  return config.organization.structure
    .replace('{userId}', userId)
    .replace('{type}', type)
    .replace('{size}', size)
    .replace('{filename}', filename);
}

/**
 * Generate public URL for file
 * @param {string} filePath - Relative file path
 * @returns {string} Public URL
 */
function generatePublicUrl(filePath) {
  if (config.storageType === 'local') {
    return `${config.local.publicUrlBase}/${filePath}`;
  }
  
  // For CDN implementations, this would return the CDN URL
  // This is a placeholder for future CDN integration
  return `https://cdn.legacylancers.com/${filePath}`;
}

/**
 * Validate CDN configuration
 */
function validateConfig() {
  const errors = [];

  if (config.storageType === 'cdn' && config.isProduction) {
    const provider = config.cdn[config.cdn.provider];
    
    if (config.cdn.provider === 'aws') {
      if (!provider.accessKeyId || !provider.secretAccessKey) {
        errors.push('AWS credentials must be set for CDN storage');
      }
      if (!provider.bucketName) {
        errors.push('AWS S3 bucket name must be set');
      }
    }
    
    if (config.cdn.provider === 'gcp') {
      if (!provider.projectId || !provider.keyFilename) {
        errors.push('GCP configuration must be set for CDN storage');
      }
    }
    
    if (config.cdn.provider === 'azure') {
      if (!provider.accountName || !provider.accountKey) {
        errors.push('Azure credentials must be set for CDN storage');
      }
    }
    
    if (config.cdn.provider === 'cloudinary') {
      if (!provider.cloudName || !provider.apiKey || !provider.apiSecret) {
        errors.push('Cloudinary credentials must be set for CDN storage');
      }
    }
  }

  if (config.limits.maxFileSize > 50 * 1024 * 1024) { // 50MB
    console.warn('Warning: Maximum file size is set above 50MB, this may cause performance issues');
  }

  if (errors.length > 0) {
    throw new Error(`CDN configuration errors:\n${errors.join('\n')}`);
  }
}

// Initialize local storage on module load (if using local storage)
if (config.storageType === 'local') {
  initializeLocalStorage().catch(error => {
    console.error('Failed to initialize local storage on module load:', error);
  });
}

// Validate configuration on module load
validateConfig();

module.exports = {
  ...config,
  initializeLocalStorage,
  generateFilePath,
  generatePublicUrl,
  validateConfig
};