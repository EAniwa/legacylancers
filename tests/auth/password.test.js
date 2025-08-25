/**
 * Password Utilities Test Suite
 * Comprehensive tests for password hashing and validation
 */

const {
  hashPassword,
  verifyPassword,
  validatePassword,
  calculatePasswordStrength,
  generateSecurePassword,
  needsRehash,
  PasswordError
} = require('../../src/auth/password');

describe('Password Utilities', () => {
  const validPassword = 'SecurePass123!';
  const weakPassword = '123';
  const commonPassword = 'password123';

  describe('hashPassword', () => {
    test('should hash valid password successfully', async () => {
      const hash = await hashPassword(validPassword);
      
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(validPassword);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt format
    });

    test('should create different hashes for same password', async () => {
      const hash1 = await hashPassword(validPassword);
      const hash2 = await hashPassword(validPassword);
      
      expect(hash1).not.toBe(hash2); // Due to salt
      expect(hash1.length).toBe(hash2.length);
    });

    test('should throw error for missing password', async () => {
      await expect(hashPassword()).rejects.toThrow(PasswordError);
      await expect(hashPassword('')).rejects.toThrow('Password is required');
    });

    test('should throw error for non-string password', async () => {
      await expect(hashPassword(123)).rejects.toThrow(PasswordError);
      await expect(hashPassword(null)).rejects.toThrow('Password must be a string');
    });

    test('should throw error for password that fails validation', async () => {
      await expect(hashPassword(weakPassword)).rejects.toThrow(PasswordError);
      await expect(hashPassword(weakPassword)).rejects.toThrow('Password validation failed');
    });

    test('should reject common passwords', async () => {
      await expect(hashPassword('password')).rejects.toThrow(PasswordError);
      await expect(hashPassword('123456')).rejects.toThrow('Password is too common');
    });
  });

  describe('verifyPassword', () => {
    test('should verify correct password', async () => {
      const hash = await hashPassword(validPassword);
      const isValid = await verifyPassword(validPassword, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const hash = await hashPassword(validPassword);
      const isValid = await verifyPassword('WrongPassword123!', hash);
      
      expect(isValid).toBe(false);
    });

    test('should throw error for missing password', async () => {
      const hash = await hashPassword(validPassword);
      
      await expect(verifyPassword('', hash)).rejects.toThrow(PasswordError);
      await expect(verifyPassword(undefined, hash)).rejects.toThrow('Password is required');
    });

    test('should throw error for missing hash', async () => {
      await expect(verifyPassword(validPassword, '')).rejects.toThrow(PasswordError);
      await expect(verifyPassword(validPassword, null)).rejects.toThrow('Hash is required');
    });

    test('should throw error for non-string inputs', async () => {
      const hash = await hashPassword(validPassword);
      
      await expect(verifyPassword(123, hash)).rejects.toThrow('Password must be a string');
      await expect(verifyPassword(validPassword, 123)).rejects.toThrow('Hash must be a string');
    });

    test('should handle invalid hash format gracefully', async () => {
      const isValid = await verifyPassword(validPassword, 'invalid-hash');
      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('should validate strong password', () => {
      const result = validatePassword(validPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBeDefined();
      expect(result.strength.level).toBe('strong');
    });

    test('should reject password too short', () => {
      const result = validatePassword('Sh0rt!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should require uppercase letters', () => {
      const result = validatePassword('lowercase123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('should require lowercase letters', () => {
      const result = validatePassword('UPPERCASE123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('should require numbers', () => {
      const result = validatePassword('NoNumbers!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('should require special characters', () => {
      const result = validatePassword('NoSpecialChars123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    test('should reject common passwords', () => {
      const result = validatePassword('password');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common and easily guessed');
    });

    test('should reject sequential characters', () => {
      const result = validatePassword('Abcdef123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password contains sequential characters');
    });

    test('should reject repeated characters', () => {
      const result = validatePassword('Passssword123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password contains too many repeated characters');
    });

    test('should handle null/undefined password', () => {
      const result1 = validatePassword(null);
      const result2 = validatePassword(undefined);
      
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result1.errors).toContain('Password is required');
    });

    test('should handle non-string password', () => {
      const result = validatePassword(123);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be a string');
    });
  });

  describe('calculatePasswordStrength', () => {
    test('should calculate strength for strong password', () => {
      const strength = calculatePasswordStrength('VeryStrong123!@#');
      
      expect(strength.score).toBeGreaterThan(6);
      expect(strength.level).toBe('strong');
      expect(strength.maxScore).toBe(8);
      expect(strength.checks.length).toBe(true);
      expect(strength.checks.uppercase).toBe(true);
      expect(strength.checks.lowercase).toBe(true);
      expect(strength.checks.numbers).toBe(true);
      expect(strength.checks.specialChars).toBe(true);
    });

    test('should calculate strength for weak password', () => {
      const strength = calculatePasswordStrength('weak');
      
      expect(strength.score).toBeLessThan(4);
      expect(strength.level).toBe('very-weak');
    });

    test('should handle empty password', () => {
      const strength = calculatePasswordStrength('');
      
      expect(strength.score).toBe(0);
      expect(strength.level).toBe('very-weak');
    });

    test('should give higher scores for longer passwords', () => {
      const short = calculatePasswordStrength('Short1!');
      const long = calculatePasswordStrength('VeryLongPassword1!');
      
      expect(long.score).toBeGreaterThan(short.score);
    });

    test('should reward character variety', () => {
      const repetitive = calculatePasswordStrength('Aaaaaaa1!');
      const varied = calculatePasswordStrength('Complex1!@#');
      
      expect(varied.score).toBeGreaterThanOrEqual(repetitive.score);
    });
  });

  describe('generateSecurePassword', () => {
    test('should generate password of specified length', () => {
      const password = generateSecurePassword(12);
      
      expect(password.length).toBe(12);
      expect(typeof password).toBe('string');
    });

    test('should generate different passwords each time', () => {
      const password1 = generateSecurePassword();
      const password2 = generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });

    test('should include specified character types', () => {
      const password = generateSecurePassword(16, {
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSpecialChars: true
      });
      
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    test('should exclude similar characters when requested', () => {
      const password = generateSecurePassword(100, { excludeSimilar: true });
      
      expect(password).not.toContain('0');
      expect(password).not.toContain('O');
      expect(password).not.toContain('l');
      expect(password).not.toContain('1');
      expect(password).not.toContain('I');
    });

    test('should generate only lowercase when other types disabled', () => {
      const password = generateSecurePassword(12, {
        includeUppercase: false,
        includeNumbers: false,
        includeSpecialChars: false,
        includeLowercase: true
      });
      
      expect(/^[a-z]+$/.test(password)).toBe(true);
    });

    test('should throw error for invalid length', () => {
      expect(() => {
        generateSecurePassword(3);
      }).toThrow(PasswordError);
      
      expect(() => {
        generateSecurePassword(0);
      }).toThrow('Password length must be at least 4 characters');
    });

    test('should throw error when no character types selected', () => {
      expect(() => {
        generateSecurePassword(12, {
          includeUppercase: false,
          includeLowercase: false,
          includeNumbers: false,
          includeSpecialChars: false
        });
      }).toThrow(PasswordError);
      
      expect(() => {
        generateSecurePassword(12, {
          includeUppercase: false,
          includeLowercase: false,
          includeNumbers: false,
          includeSpecialChars: false
        });
      }).toThrow('At least one character type must be included');
    });

    test('should generate valid passwords that pass validation', () => {
      const password = generateSecurePassword(12);
      const validation = validatePassword(password);
      
      expect(validation.isValid).toBe(true);
      expect(validation.strength.level).not.toBe('very-weak');
    });
  });

  describe('needsRehash', () => {
    test('should return false for current salt rounds', async () => {
      const hash = await hashPassword(validPassword);
      const needs = await needsRehash(hash);
      
      expect(needs).toBe(false);
    });

    test('should throw error for missing hash', async () => {
      await expect(needsRehash()).rejects.toThrow(PasswordError);
      await expect(needsRehash('')).rejects.toThrow('Hash is required');
    });

    test('should handle invalid hash format', async () => {
      await expect(needsRehash('invalid-hash')).rejects.toThrow(PasswordError);
    });

    // Note: Testing the case where rehashing is needed would require
    // manipulating the bcrypt configuration or creating hashes with different rounds,
    // which is complex to do in a unit test without mocking
  });

  describe('PasswordError', () => {
    test('should create error with message and code', () => {
      const error = new PasswordError('Test message', 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('PasswordError');
      expect(error instanceof Error).toBe(true);
    });

    test('should use default code if not provided', () => {
      const error = new PasswordError('Test message');
      
      expect(error.code).toBe('PASSWORD_ERROR');
    });
  });

  describe('Integration Tests', () => {
    test('should work together for complete password flow', async () => {
      // Generate a secure password
      const generatedPassword = generateSecurePassword(12);
      
      // Validate it meets requirements
      const validation = validatePassword(generatedPassword);
      expect(validation.isValid).toBe(true);
      
      // Hash the password
      const hash = await hashPassword(generatedPassword);
      
      // Verify the password
      const isValid = await verifyPassword(generatedPassword, hash);
      expect(isValid).toBe(true);
      
      // Check if rehashing is needed
      const needsRehashing = await needsRehash(hash);
      expect(needsRehashing).toBe(false);
      
      // Verify wrong password fails
      const wrongVerification = await verifyPassword('WrongPassword123!', hash);
      expect(wrongVerification).toBe(false);
    });
  });
});