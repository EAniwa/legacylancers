/**
 * User Model Tests
 * Comprehensive tests for User model functionality
 */

const { User, UserError } = require('../../src/models/User');

describe('User Model', () => {
  beforeEach(async () => {
    // Reset User model before each test
    await User.reset();
  });

  describe('create', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      privacyConsent: true,
      marketingConsent: false
    };

    test('should create a new user with valid data', async () => {
      const user = await User.create(validUserData);

      expect(user).toMatchObject({
        id: expect.any(String),
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: false,
        status: 'active',
        role: 'user',
        kycStatus: 'pending',
        privacyConsent: true,
        marketingConsent: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(user.verificationToken).toBeDefined();
      expect(user.verificationToken.length).toBeGreaterThan(30);
      expect(user.passwordHash).toBeUndefined(); // Should not include password hash in response
    });

    test('should normalize email address', async () => {
      const userData = { ...validUserData, email: 'Test@EXAMPLE.COM' };
      const user = await User.create(userData);

      expect(user.email).toBe('test@example.com');
    });

    test('should sanitize names', async () => {
      const userData = { 
        ...validUserData, 
        firstName: '  John <script>  ',
        lastName: '  Doe & Co  '
      };
      const user = await User.create(userData);

      expect(user.firstName).toBe('John &lt;script&gt;');
      expect(user.lastName).toBe('Doe &amp; Co');
    });

    test('should handle optional phone number', async () => {
      const userData = { ...validUserData, phone: '+1-234-567-8900' };
      const user = await User.create(userData);

      expect(user.phone).toBe('+1-234-567-8900');
    });

    test('should throw error for missing required fields', async () => {
      await expect(User.create({})).rejects.toThrow('Email, password, first name, and last name are required');
      
      await expect(User.create({
        email: 'test@example.com',
        password: 'password',
        firstName: 'John'
        // missing lastName
      })).rejects.toThrow(UserError);
    });

    test('should throw error for invalid email', async () => {
      const userData = { ...validUserData, email: 'invalid-email' };
      await expect(User.create(userData)).rejects.toThrow('Invalid email format');
    });

    test('should throw error for invalid phone', async () => {
      const userData = { ...validUserData, phone: 'invalid-phone' };
      await expect(User.create(userData)).rejects.toThrow('Invalid phone number format');
    });

    test('should throw error for missing privacy consent', async () => {
      const userData = { ...validUserData, privacyConsent: false };
      await expect(User.create(userData)).rejects.toThrow('Privacy consent is required');
    });

    test('should throw error for duplicate email', async () => {
      await User.create(validUserData);
      await expect(User.create(validUserData)).rejects.toThrow('User with this email already exists');
    });

    test('should validate password strength', async () => {
      const userData = { ...validUserData, password: 'weak' };
      await expect(User.create(userData)).rejects.toThrow(UserError);
    });

    test('should validate name lengths', async () => {
      const longName = 'a'.repeat(101);
      
      const userData1 = { ...validUserData, firstName: longName };
      await expect(User.create(userData1)).rejects.toThrow('First name must be between 1 and 100 characters');

      const userData2 = { ...validUserData, lastName: longName };
      await expect(User.create(userData2)).rejects.toThrow('Last name must be between 1 and 100 characters');

      const userData3 = { ...validUserData, firstName: '' };
      await expect(User.create(userData3)).rejects.toThrow('First name must be between 1 and 100 characters');
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const createdUser = await User.create(userData);
      const foundUser = await User.findByEmail('test@example.com');

      expect(foundUser).toMatchObject({
        id: createdUser.id,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
      expect(foundUser.passwordHash).toBeUndefined();
    });

    test('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    test('should normalize email when searching', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      await User.create(userData);
      const foundUser = await User.findByEmail('TEST@EXAMPLE.COM');

      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe('test@example.com');
    });
  });

  describe('findById', () => {
    test('should find user by ID', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const createdUser = await User.create(userData);
      const foundUser = await User.findById(createdUser.id);

      expect(foundUser).toMatchObject({
        id: createdUser.id,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
      expect(foundUser.passwordHash).toBeUndefined();
    });

    test('should return null for non-existent ID', async () => {
      const user = await User.findById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('findByEmailWithPassword', () => {
    test('should find user with password hash', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const createdUser = await User.create(userData);
      const foundUser = await User.findByEmailWithPassword('test@example.com');

      expect(foundUser).toMatchObject({
        id: createdUser.id,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
      expect(foundUser.passwordHash).toBeDefined();
      expect(typeof foundUser.passwordHash).toBe('string');
    });

    test('should return null for non-existent email', async () => {
      const user = await User.findByEmailWithPassword('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('update', () => {
    let userId;

    beforeEach(async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const user = await User.create(userData);
      userId = user.id;
    });

    test('should update allowed fields', async () => {
      const updates = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+15551234567',
        marketingConsent: true
      };

      const updatedUser = await User.update(userId, updates);

      expect(updatedUser).toMatchObject({
        id: userId,
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-123-4567',
        marketingConsent: true
      });
      expect(updatedUser.updatedAt).toBeInstanceOf(Date);
    });

    test('should ignore disallowed fields', async () => {
      const updates = {
        firstName: 'Jane',
        email: 'newemail@example.com', // Should be ignored
        passwordHash: 'hacked', // Should be ignored
        id: 'new-id' // Should be ignored
      };

      const updatedUser = await User.update(userId, updates);

      expect(updatedUser.firstName).toBe('Jane');
      expect(updatedUser.email).toBe('test@example.com'); // Should remain unchanged
    });

    test('should throw error for non-existent user', async () => {
      await expect(User.update('non-existent-id', { firstName: 'Jane' }))
        .rejects.toThrow('User not found');
    });

    test('should validate updated fields', async () => {
      const longName = 'a'.repeat(101);
      
      await expect(User.update(userId, { firstName: longName }))
        .rejects.toThrow('First name must be between 1 and 100 characters');

      await expect(User.update(userId, { phone: 'invalid-phone' }))
        .rejects.toThrow('Invalid phone number format');
    });

    test('should sanitize updated names', async () => {
      const updates = {
        firstName: '  Jane <script>  ',
        lastName: '  Smith & Co  '
      };

      const updatedUser = await User.update(userId, updates);

      expect(updatedUser.firstName).toBe('Jane &lt;script&gt;');
      expect(updatedUser.lastName).toBe('Smith &amp; Co');
    });
  });

  describe('verifyEmail', () => {
    let verificationToken;

    beforeEach(async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const user = await User.create(userData);
      verificationToken = user.verificationToken;
    });

    test('should verify email with valid token', async () => {
      const verifiedUser = await User.verifyEmail(verificationToken);

      expect(verifiedUser.emailVerified).toBe(true);
      expect(verifiedUser.email).toBe('test@example.com');
    });

    test('should throw error for invalid token', async () => {
      await expect(User.verifyEmail('invalid-token'))
        .rejects.toThrow('Invalid or expired verification token');
    });

    test('should throw error for expired token', async () => {
      // Create an expired token by manipulating the internal state
      // This is a bit hacky but necessary for testing
      User.verificationTokens.set('expired-token', {
        userId: 'some-id',
        email: 'test@example.com',
        type: 'email_verification',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date()
      });

      await expect(User.verifyEmail('expired-token'))
        .rejects.toThrow('Verification token has expired');
    });

    test('should remove token after successful verification', async () => {
      await User.verifyEmail(verificationToken);
      
      // Token should be removed, so second attempt should fail
      await expect(User.verifyEmail(verificationToken))
        .rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('resendEmailVerification', () => {
    let userEmail;

    beforeEach(async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const user = await User.create(userData);
      userEmail = user.email;
    });

    test('should generate new verification token', async () => {
      const newToken = await User.resendEmailVerification(userEmail);

      expect(newToken).toBeDefined();
      expect(typeof newToken).toBe('string');
      expect(newToken.length).toBeGreaterThan(30);
    });

    test('should throw error for non-existent user', async () => {
      await expect(User.resendEmailVerification('nonexistent@example.com'))
        .rejects.toThrow('User not found');
    });

    test('should throw error if email already verified', async () => {
      // First verify the email
      const user = await User.findByEmailWithPassword(userEmail);
      await User.update(user.id, { emailVerified: true });

      await expect(User.resendEmailVerification(userEmail))
        .rejects.toThrow('Email is already verified');
    });
  });

  describe('delete', () => {
    let userId;

    beforeEach(async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      };

      const user = await User.create(userData);
      userId = user.id;
    });

    test('should soft delete user', async () => {
      const result = await User.delete(userId);

      expect(result).toBe(true);

      // User should not be found after deletion
      const deletedUser = await User.findById(userId);
      expect(deletedUser).toBeNull();
    });

    test('should throw error for non-existent user', async () => {
      await expect(User.delete('non-existent-id'))
        .rejects.toThrow('User not found');
    });

    test('should clean up verification tokens on delete', async () => {
      // Create verification token
      const token = await User.createEmailVerificationToken(userId);
      
      // Delete user
      await User.delete(userId);

      // Token should be cleaned up
      await expect(User.verifyEmail(token))
        .rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('getStats', () => {
    test('should return user statistics', async () => {
      // Create multiple users with different states
      await User.create({
        email: 'user1@example.com',
        password: 'SecurePass123!',
        firstName: 'User',
        lastName: 'One',
        privacyConsent: true
      });

      const user2 = await User.create({
        email: 'user2@example.com',
        password: 'SecurePass123!',
        firstName: 'User',
        lastName: 'Two',
        privacyConsent: true
      });

      // Verify one user
      await User.update(user2.id, { emailVerified: true });

      const stats = await User.getStats();

      expect(stats).toMatchObject({
        totalUsers: 2,
        activeUsers: 2,
        verifiedUsers: 1,
        unverifiedUsers: 1,
        deletedUsers: 0,
        kycPendingUsers: 2,
        kycVerifiedUsers: 0
      });
    });

    test('should handle empty user base', async () => {
      const stats = await User.getStats();

      expect(stats).toMatchObject({
        totalUsers: 0,
        activeUsers: 0,
        verifiedUsers: 0,
        unverifiedUsers: 0,
        deletedUsers: 0,
        kycPendingUsers: 0,
        kycVerifiedUsers: 0
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    test('should clean up expired tokens', async () => {
      // Create user and get token
      const user = await User.create({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });

      // Manually create an expired token
      User.verificationTokens.set('expired-token', {
        userId: user.id,
        email: user.email,
        type: 'email_verification',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date()
      });

      const cleaned = await User.cleanupExpiredTokens();

      expect(cleaned).toBe(1);
    });

    test('should not clean up valid tokens', async () => {
      // Create user which creates a valid token
      await User.create({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        privacyConsent: true
      });

      const cleaned = await User.cleanupExpiredTokens();

      expect(cleaned).toBe(0);
    });
  });

  describe('utility methods', () => {
    test('sanitizeName should clean input', async () => {
      const result = User.sanitizeName('  John <script>alert("xss")</script>  ');
      expect(result).toContain('John');
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    test('sanitizePhone should clean phone input', async () => {
      expect(User.sanitizePhone('+1 (234) 567-8900 ext.123'))
        .toBe('+1 (234) 567-8900 123');
    });
  });

  describe('error handling', () => {
    test('should throw UserError for validation failures', async () => {
      try {
        await User.create({});
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.code).toBe('MISSING_REQUIRED_FIELDS');
        expect(error.name).toBe('UserError');
      }
    });

    test('should handle internal errors gracefully', async () => {
      // Mock validator to throw an unexpected error
      const validator = require('validator');
      const originalIsEmail = validator.isEmail;
      validator.isEmail = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      try {
        await User.create({
          email: 'test@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          privacyConsent: true
        });
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.code).toBe('CREATE_FAILED');
      }

      // Restore original method
      validator.isEmail = originalIsEmail;
    });
  });
});