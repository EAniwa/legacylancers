/**
 * Password Hashing Utilities
 * Handles password hashing, verification, and validation using bcrypt
 */

const bcrypt = require('bcrypt');
const authConfig = require('../config/auth');

class PasswordError extends Error {
  constructor(message, code = 'PASSWORD_ERROR') {
    super(message);
    this.name = 'PasswordError';
    this.code = code;
  }
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  try {
    if (typeof password !== 'string') {
      throw new PasswordError('Password must be a string', 'INVALID_PASSWORD_TYPE');
    }

    if (!password) {
      throw new PasswordError('Password is required for hashing', 'MISSING_PASSWORD');
    }

    // Validate password meets requirements
    const validation = validatePassword(password);
    if (!validation.isValid) {
      throw new PasswordError(`Password validation failed: ${validation.errors.join(', ')}`, 'VALIDATION_FAILED');
    }

    const saltRounds = authConfig.password.saltRounds;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return hashedPassword;

  } catch (error) {
    if (error instanceof PasswordError) {
      throw error;
    }
    throw new PasswordError(`Password hashing failed: ${error.message}`, 'HASH_FAILED');
  }
}

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyPassword(password, hash) {
  try {
    if (!password) {
      throw new PasswordError('Password is required for verification', 'MISSING_PASSWORD');
    }

    if (!hash) {
      throw new PasswordError('Hash is required for verification', 'MISSING_HASH');
    }

    if (typeof password !== 'string') {
      throw new PasswordError('Password must be a string', 'INVALID_PASSWORD_TYPE');
    }

    if (typeof hash !== 'string') {
      throw new PasswordError('Hash must be a string', 'INVALID_HASH_TYPE');
    }

    const isValid = await bcrypt.compare(password, hash);
    return isValid;

  } catch (error) {
    if (error instanceof PasswordError) {
      throw error;
    }
    throw new PasswordError(`Password verification failed: ${error.message}`, 'VERIFY_FAILED');
  }
}

/**
 * Validate password meets security requirements
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validatePassword(password) {
  const errors = [];
  const config = authConfig.password;

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  if (typeof password !== 'string') {
    errors.push('Password must be a string');
    return { isValid: false, errors };
  }

  // Check minimum length
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  // Check for uppercase letters
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letters
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters
  if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common patterns (optional enhancement)
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common and easily guessed');
  }

  // Check for sequential characters
  if (/123456|abcdef|qwerty/i.test(password)) {
    errors.push('Password contains sequential characters');
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
}

/**
 * Calculate password strength score
 * @param {string} password - Password to analyze
 * @returns {Object} Strength analysis with score and level
 */
function calculatePasswordStrength(password) {
  if (!password) {
    return { score: 0, level: 'very-weak' };
  }

  let score = 0;
  const checks = {
    length: false,
    uppercase: false,
    lowercase: false,
    numbers: false,
    specialChars: false,
    longLength: false,
    mixedCase: false,
    variety: false
  };

  // Length checks
  if (password.length >= 8) {
    score += 1;
    checks.length = true;
  }
  if (password.length >= 12) {
    score += 1;
    checks.longLength = true;
  }

  // Character type checks
  if (/[A-Z]/.test(password)) {
    score += 1;
    checks.uppercase = true;
  }
  if (/[a-z]/.test(password)) {
    score += 1;
    checks.lowercase = true;
  }
  if (/\d/.test(password)) {
    score += 1;
    checks.numbers = true;
  }
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
    checks.specialChars = true;
  }

  // Pattern checks
  if (checks.uppercase && checks.lowercase) {
    score += 1;
    checks.mixedCase = true;
  }

  // Character variety (unique characters)
  const uniqueChars = new Set(password.split('')).size;
  if (uniqueChars >= password.length * 0.6) {
    score += 1;
    checks.variety = true;
  }

  // Determine strength level
  let level;
  if (score <= 2) {
    level = 'very-weak';
  } else if (score <= 4) {
    level = 'weak';
  } else if (score <= 6) {
    level = 'fair';
  } else if (score <= 7) {
    level = 'good';
  } else {
    level = 'strong';
  }

  return {
    score,
    level,
    maxScore: 8,
    checks
  };
}

/**
 * Generate a secure random password
 * @param {number} length - Desired password length (default: 12)
 * @param {Object} options - Options for password generation
 * @returns {string} Generated password
 */
function generateSecurePassword(length = 12, options = {}) {
  const defaults = {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
    excludeSimilar: true // Exclude similar-looking characters (0, O, l, 1, I)
  };

  const config = { ...defaults, ...options };

  let charset = '';
  
  if (config.includeLowercase) {
    charset += config.excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (config.includeUppercase) {
    charset += config.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (config.includeNumbers) {
    charset += config.excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (config.includeSpecialChars) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (charset === '') {
    throw new PasswordError('At least one character type must be included', 'INVALID_CHARSET');
  }

  if (length < 4) {
    throw new PasswordError('Password length must be at least 4 characters', 'INVALID_LENGTH');
  }

  // Build character sets for guaranteed inclusion
  const charSets = [];
  if (config.includeLowercase) {
    charSets.push(config.excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz');
  }
  if (config.includeUppercase) {
    charSets.push(config.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  }
  if (config.includeNumbers) {
    charSets.push(config.excludeSimilar ? '23456789' : '0123456789');
  }
  if (config.includeSpecialChars) {
    charSets.push('!@#$%^&*()_+-=[]{}|;:,.<>?');
  }

  // Start with one character from each required type
  let password = '';
  for (const set of charSets) {
    password += set.charAt(Math.floor(Math.random() * set.length));
  }

  // Fill the rest randomly from the full charset
  for (let i = password.length; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

/**
 * Check if a password hash needs rehashing (e.g., due to updated salt rounds)
 * @param {string} hash - Current password hash
 * @returns {Promise<boolean>} True if rehashing is needed
 */
async function needsRehash(hash) {
  try {
    if (!hash) {
      throw new PasswordError('Hash is required for rehash check', 'MISSING_HASH');
    }

    const currentRounds = authConfig.password.saltRounds;
    const hashRounds = bcrypt.getRounds(hash);

    return hashRounds !== currentRounds;

  } catch (error) {
    if (error instanceof PasswordError) {
      throw error;
    }
    throw new PasswordError(`Rehash check failed: ${error.message}`, 'REHASH_CHECK_FAILED');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
  calculatePasswordStrength,
  generateSecurePassword,
  needsRehash,
  PasswordError
};