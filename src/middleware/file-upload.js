/**
 * File Upload Middleware
 * Handles file upload validation, processing, and security using Multer
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cdnConfig = require('../config/cdn');
const imageProcessingService = require('../services/image-processing');

class FileUploadError extends Error {
  constructor(message, code = 'FILE_UPLOAD_ERROR', statusCode = 400) {
    super(message);
    this.name = 'FileUploadError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Memory storage configuration for Multer
 * Files are stored in memory for processing before saving to disk
 */
const storage = multer.memoryStorage();

/**
 * File filter function to validate uploads
 * @param {Object} req - Express request object
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback function
 */
function fileFilter(req, file, cb) {
  try {
    // Check MIME type
    if (!cdnConfig.security.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new FileUploadError(
        `Invalid file type: ${file.mimetype}. Allowed types: ${cdnConfig.security.allowedMimeTypes.join(', ')}`,
        'INVALID_FILE_TYPE',
        400
      ), false);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    if (!allowedExtensions.includes(ext)) {
      return cb(new FileUploadError(
        `Invalid file extension: ${ext}. Allowed extensions: ${allowedExtensions.join(', ')}`,
        'INVALID_FILE_EXTENSION',
        400
      ), false);
    }

    // Validate filename (basic security check)
    if (!/^[\w\-. ]+$/i.test(file.originalname)) {
      return cb(new FileUploadError(
        'Invalid filename: contains unsafe characters',
        'INVALID_FILENAME',
        400
      ), false);
    }

    cb(null, true);

  } catch (error) {
    cb(new FileUploadError(
      'File validation failed',
      'VALIDATION_ERROR',
      400
    ), false);
  }
}

/**
 * Base multer configuration
 */
const baseUploadConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: cdnConfig.limits.maxFileSize,
    files: cdnConfig.limits.maxFiles,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024, // 1MB for text fields
    parts: cdnConfig.limits.maxFiles + 10
  }
};

/**
 * Single file upload middleware
 * @param {string} fieldName - Form field name for the file
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function singleFileUpload(fieldName = 'image', options = {}) {
  const upload = multer(baseUploadConfig).single(fieldName);
  
  return (req, res, next) => {
    upload(req, res, (error) => {
      if (error) {
        return handleUploadError(error, res);
      }
      
      // Add upload metadata to request
      if (req.file) {
        req.uploadMetadata = {
          fieldName,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadTime: new Date().toISOString()
        };
      }
      
      next();
    });
  };
}

/**
 * Multiple files upload middleware
 * @param {string} fieldName - Form field name for the files
 * @param {number} maxCount - Maximum number of files
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function multipleFilesUpload(fieldName = 'images', maxCount = 5, options = {}) {
  const upload = multer(baseUploadConfig).array(fieldName, maxCount);
  
  return (req, res, next) => {
    upload(req, res, (error) => {
      if (error) {
        return handleUploadError(error, res);
      }
      
      // Add upload metadata to request
      if (req.files && req.files.length > 0) {
        req.uploadMetadata = {
          fieldName,
          filesCount: req.files.length,
          files: req.files.map(file => ({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          })),
          uploadTime: new Date().toISOString()
        };
      }
      
      next();
    });
  };
}

/**
 * Mixed fields upload middleware (for complex forms)
 * @param {Array} fields - Array of field configurations
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function mixedFieldsUpload(fields, options = {}) {
  const upload = multer(baseUploadConfig).fields(fields);
  
  return (req, res, next) => {
    upload(req, res, (error) => {
      if (error) {
        return handleUploadError(error, res);
      }
      
      // Add upload metadata to request
      if (req.files) {
        req.uploadMetadata = {
          fields: Object.keys(req.files),
          totalFiles: Object.values(req.files).flat().length,
          uploadTime: new Date().toISOString()
        };
      }
      
      next();
    });
  };
}

/**
 * Image validation middleware
 * Validates uploaded images using the image processing service
 */
function validateImages() {
  return async (req, res, next) => {
    try {
      // Handle single file
      if (req.file) {
        try {
          await imageProcessingService.validateImage(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
          );
        } catch (error) {
          return res.status(error.statusCode || 400).json({
            success: false,
            error: error.message,
            code: error.code || 'VALIDATION_ERROR'
          });
        }
      }
      
      // Handle multiple files
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          try {
            await imageProcessingService.validateImage(
              file.buffer,
              file.originalname,
              file.mimetype
            );
          } catch (error) {
            return res.status(error.statusCode || 400).json({
              success: false,
              error: `File "${file.originalname}": ${error.message}`,
              code: error.code || 'VALIDATION_ERROR'
            });
          }
        }
      }
      
      // Handle mixed fields (object with arrays)
      if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
        for (const fieldName in req.files) {
          const files = req.files[fieldName];
          for (const file of files) {
            try {
              await imageProcessingService.validateImage(
                file.buffer,
                file.originalname,
                file.mimetype
              );
            } catch (error) {
              return res.status(error.statusCode || 400).json({
                success: false,
                error: `Field "${fieldName}", File "${file.originalname}": ${error.message}`,
                code: error.code || 'VALIDATION_ERROR'
              });
            }
          }
        }
      }
      
      next();

    } catch (error) {
      console.error('Image validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR'
      });
    }
  };
}

/**
 * User quota validation middleware
 * Checks if user has exceeded their file upload quota
 */
function validateUserQuota() {
  return async (req, res, next) => {
    try {
      // Skip quota check if unlimited (maxFilesPerUser = 0)
      if (cdnConfig.limits.maxFilesPerUser === 0) {
        return next();
      }

      // This would typically check against a database
      // For now, we'll implement a basic check
      // In a real implementation, you'd query the database for user's file count
      
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required for quota check',
          code: 'AUTH_REQUIRED'
        });
      }

      // TODO: Implement actual database query to check user's current file count
      // const currentFileCount = await getUserFileCount(userId);
      // const filesBeingUploaded = getUploadFileCount(req);
      
      // if (currentFileCount + filesBeingUploaded > cdnConfig.limits.maxFilesPerUser) {
      //   return res.status(413).json({
      //     success: false,
      //     error: `File quota exceeded. Maximum ${cdnConfig.limits.maxFilesPerUser} files allowed per user`,
      //     code: 'QUOTA_EXCEEDED',
      //     currentCount: currentFileCount,
      //     maxAllowed: cdnConfig.limits.maxFilesPerUser
      //   });
      // }

      next();

    } catch (error) {
      console.error('Quota validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal quota validation error',
        code: 'QUOTA_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Handle upload errors with proper error responses
 * @param {Error} error - Upload error
 * @param {Object} res - Express response object
 */
function handleUploadError(error, res) {
  console.error('File upload error:', error);
  
  let statusCode = 400;
  let message = 'File upload failed';
  let code = 'UPLOAD_ERROR';

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        statusCode = 413;
        message = `File too large. Maximum size: ${Math.round(cdnConfig.limits.maxFileSize / 1024 / 1024)}MB`;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        statusCode = 413;
        message = `Too many files. Maximum: ${cdnConfig.limits.maxFiles} files`;
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_FIELD_KEY':
        statusCode = 400;
        message = 'Field name too long';
        code = 'FIELD_NAME_TOO_LONG';
        break;
      case 'LIMIT_FIELD_VALUE':
        statusCode = 400;
        message = 'Field value too long';
        code = 'FIELD_VALUE_TOO_LONG';
        break;
      case 'LIMIT_FIELD_COUNT':
        statusCode = 400;
        message = 'Too many fields';
        code = 'TOO_MANY_FIELDS';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        statusCode = 400;
        message = 'Unexpected field in form';
        code = 'UNEXPECTED_FIELD';
        break;
      default:
        statusCode = 400;
        message = error.message || 'Upload failed';
        code = 'MULTER_ERROR';
    }
  } else if (error instanceof FileUploadError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
  } else if (error.code) {
    // Custom errors with codes
    message = error.message;
    code = error.code;
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code: code
  });
}

/**
 * Get count of files being uploaded in current request
 * @param {Object} req - Express request object
 * @returns {number} Number of files
 */
function getUploadFileCount(req) {
  if (req.file) return 1;
  if (req.files && Array.isArray(req.files)) return req.files.length;
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files).flat().length;
  }
  return 0;
}

module.exports = {
  singleFileUpload,
  multipleFilesUpload,
  mixedFieldsUpload,
  validateImages,
  validateUserQuota,
  handleUploadError,
  FileUploadError
};