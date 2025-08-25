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

  describe('OAuth functionality', () => {
    const mockOAuthProfile = {
      id: 'linkedin-123',
      email: 'oauth@example.com',
      firstName: 'OAuth',
      lastName: 'User',
      profilePicture: 'https://example.com/pic.jpg',
      headline: 'Software Engineer',
      providerURL: 'https://linkedin.com/in/test',
      raw: {
        id: 'linkedin-123',
        localizedFirstName: 'OAuth',
        localizedLastName: 'User'
      }
    };

    describe('findByOAuthProvider', () => {
      test('should find user by OAuth provider and ID', async () => {
        const user = await User.createFromOAuth('linkedin', mockOAuthProfile);
        
        const foundUser = await User.findByOAuthProvider('linkedin', 'linkedin-123');
        
        expect(foundUser).toBeDefined();
        expect(foundUser.id).toBe(user.id);
        expect(foundUser.email).toBe('oauth@example.com');
      });

      test('should return null for non-existent OAuth profile', async () => {
        const foundUser = await User.findByOAuthProvider('linkedin', 'nonexistent');
        expect(foundUser).toBeNull();
      });

      test('should handle missing parameters', async () => {
        await expect(User.findByOAuthProvider(null, 'id')).rejects.toThrow(UserError);
        await expect(User.findByOAuthProvider('linkedin', null)).rejects.toThrow(UserError);
      });

      test('should find user in OAuth profiles array', async () => {
        // Create regular user first
        const regularUser = await User.create({
          email: 'regular@example.com',
          password: 'SecurePass123!',
          firstName: 'Regular',
          lastName: 'User',
          privacyConsent: true
        });

        // Link OAuth profile
        await User.linkOAuthProfile(regularUser.id, 'linkedin', mockOAuthProfile);

        // Should find by OAuth provider
        const foundUser = await User.findByOAuthProvider('linkedin', 'linkedin-123');
        expect(foundUser).toBeDefined();
        expect(foundUser.id).toBe(regularUser.id);
      });
    });

    describe('createFromOAuth', () => {
      test('should create new user from OAuth profile', async () => {
        const user = await User.createFromOAuth('linkedin', mockOAuthProfile);

        expect(user).toMatchObject({
          id: expect.any(String),
          email: 'oauth@example.com',
          firstName: 'OAuth',
          lastName: 'User',
          emailVerified: true,
          role: 'user',
          oauthProvider: 'linkedin',
          oauthId: 'linkedin-123',
          status: 'active',
          kycStatus: 'pending',
          isNewUser: true
        });

        expect(user.oauthProfiles).toHaveLength(1);
        expect(user.oauthProfiles[0]).toMatchObject({
          provider: 'linkedin',
          providerId: 'linkedin-123',
          email: 'oauth@example.com',
          firstName: 'OAuth',
          lastName: 'User',
          profilePicture: 'https://example.com/pic.jpg',
          headline: 'Software Engineer'
        });
      });

      test('should validate required fields', async () => {
        await expect(User.createFromOAuth(null, mockOAuthProfile)).rejects.toThrow(UserError);
        await expect(User.createFromOAuth('linkedin', null)).rejects.toThrow(UserError);
        
        const profileWithoutEmail = { ...mockOAuthProfile };
        delete profileWithoutEmail.email;
        await expect(User.createFromOAuth('linkedin', profileWithoutEmail)).rejects.toThrow(UserError);

        const profileWithoutId = { ...mockOAuthProfile };
        delete profileWithoutId.id;
        await expect(User.createFromOAuth('linkedin', profileWithoutId)).rejects.toThrow(UserError);
      });

      test('should handle duplicate email', async () => {
        // Create regular user with same email
        await User.create({
          email: 'oauth@example.com',
          password: 'SecurePass123!',
          firstName: 'Existing',
          lastName: 'User',
          privacyConsent: true
        });

        await expect(User.createFromOAuth('linkedin', mockOAuthProfile)).rejects.toThrow(UserError);
      });

      test('should handle duplicate OAuth profile', async () => {
        // Create OAuth user first
        await User.createFromOAuth('linkedin', mockOAuthProfile);

        // Try to create again with same OAuth profile
        await expect(User.createFromOAuth('linkedin', mockOAuthProfile)).rejects.toThrow(UserError);
      });

      test('should sanitize profile names', async () => {
        const profileWithBadNames = {
          ...mockOAuthProfile,
          firstName: '  <script>alert("xss")</script>John  ',
          lastName: '  Doe<img src=x onerror=alert(1)>  '
        };

        const user = await User.createFromOAuth('linkedin', profileWithBadNames);

        expect(user.firstName).toContain('&lt;script&gt;');
        expect(user.firstName).not.toContain('<script>');
        expect(user.lastName).toContain('&lt;img');
        expect(user.lastName).not.toContain('<img');
      });
    });

    describe('linkOAuthProfile', () => {
      let existingUser;

      beforeEach(async () => {
        existingUser = await User.create({
          email: 'existing@example.com',
          password: 'SecurePass123!',
          firstName: 'Existing',
          lastName: 'User',
          privacyConsent: true
        });
      });

      test('should link OAuth profile to existing user', async () => {
        const linkedUser = await User.linkOAuthProfile(existingUser.id, 'linkedin', mockOAuthProfile);

        expect(linkedUser.oauthProfiles).toHaveLength(1);
        expect(linkedUser.oauthProfiles[0]).toMatchObject({
          provider: 'linkedin',
          providerId: 'linkedin-123',
          email: 'oauth@example.com',
          linkedAt: expect.any(Date)
        });

        // Should update legacy fields for first OAuth profile
        expect(linkedUser.oauthProvider).toBe('linkedin');
        expect(linkedUser.oauthId).toBe('linkedin-123');
      });

      test('should handle linking multiple OAuth profiles', async () => {
        // Link first profile
        await User.linkOAuthProfile(existingUser.id, 'linkedin', mockOAuthProfile);

        // Create second OAuth profile
        const secondProfile = {
          ...mockOAuthProfile,
          id: 'github-456',
          email: 'github@example.com'
        };

        // Link second profile
        const linkedUser = await User.linkOAuthProfile(existingUser.id, 'github', secondProfile);

        expect(linkedUser.oauthProfiles).toHaveLength(2);
        expect(linkedUser.oauthProfiles.map(p => p.provider)).toContain('linkedin');
        expect(linkedUser.oauthProfiles.map(p => p.provider)).toContain('github');
      });

      test('should prevent duplicate OAuth profile linking', async () => {
        // Link profile once
        await User.linkOAuthProfile(existingUser.id, 'linkedin', mockOAuthProfile);

        // Try to link same profile again
        await expect(User.linkOAuthProfile(existingUser.id, 'linkedin', mockOAuthProfile))
          .rejects.toThrow(UserError);
      });

      test('should prevent linking OAuth profile already used by another user', async () => {
        // Create OAuth user
        await User.createFromOAuth('linkedin', mockOAuthProfile);

        // Try to link same OAuth profile to different user
        await expect(User.linkOAuthProfile(existingUser.id, 'linkedin', mockOAuthProfile))
          .rejects.toThrow(UserError);
      });

      test('should validate required parameters', async () => {
        await expect(User.linkOAuthProfile(null, 'linkedin', mockOAuthProfile)).rejects.toThrow(UserError);
        await expect(User.linkOAuthProfile(existingUser.id, null, mockOAuthProfile)).rejects.toThrow(UserError);
        await expect(User.linkOAuthProfile(existingUser.id, 'linkedin', null)).rejects.toThrow(UserError);
        
        const profileWithoutId = { ...mockOAuthProfile };
        delete profileWithoutId.id;
        await expect(User.linkOAuthProfile(existingUser.id, 'linkedin', profileWithoutId)).rejects.toThrow(UserError);
      });
    });

    describe('unlinkOAuthProfile', () => {
      let userWithOAuth;

      beforeEach(async () => {
        userWithOAuth = await User.createFromOAuth('linkedin', mockOAuthProfile);
      });

      test('should unlink OAuth profile from user', async () => {
        // This test should fail because it's the last auth method
        // But let's test the successful path by first adding a password
        
        // For this test, we'll create a user with password and then add OAuth
        const userWithPassword = await User.create({
          email: 'password@example.com',
          password: 'SecurePass123!',
          firstName: 'Password',
          lastName: 'User',
          privacyConsent: true
        });

        const uniqueProfile = {
          ...mockOAuthProfile,
          id: 'linkedin-unlink-test',
          email: 'unlink@example.com'
        };

        await User.linkOAuthProfile(userWithPassword.id, 'linkedin', uniqueProfile);
        
        const updatedUser = await User.unlinkOAuthProfile(userWithPassword.id, 'linkedin', 'linkedin-unlink-test');

        expect(updatedUser.oauthProfiles).toHaveLength(0);
        expect(updatedUser.oauthProvider).toBeNull();
        expect(updatedUser.oauthId).toBeNull();
      });

      test('should handle user with multiple OAuth profiles', async () => {
        // Add second OAuth profile
        const secondProfile = { ...mockOAuthProfile, id: 'github-456' };
        await User.linkOAuthProfile(userWithOAuth.id, 'github', secondProfile);

        // Unlink first profile
        const updatedUser = await User.unlinkOAuthProfile(userWithOAuth.id, 'linkedin', 'linkedin-123');

        expect(updatedUser.oauthProfiles).toHaveLength(1);
        expect(updatedUser.oauthProfiles[0].provider).toBe('github');
        
        // Legacy fields should be updated to remaining profile
        expect(updatedUser.oauthProvider).toBe('github');
        expect(updatedUser.oauthId).toBe('github-456');
      });

      test('should prevent unlinking last authentication method', async () => {
        // OAuth user without password (passwordHash is not returned in user response)
        // But internally the user should have no password
        await expect(User.unlinkOAuthProfile(userWithOAuth.id, 'linkedin', 'linkedin-123'))
          .rejects.toThrow(UserError);
      });

      test('should allow unlinking when user has password', async () => {
        // Create user with both password and OAuth
        const userWithBoth = await User.create({
          email: 'both@example.com',
          password: 'SecurePass123!',
          firstName: 'Both',
          lastName: 'User',
          privacyConsent: true
        });

        // Create a unique OAuth profile for this test
        const uniqueOAuthProfile = {
          ...mockOAuthProfile,
          id: 'linkedin-unique-456',
          email: 'unique@example.com'
        };

        await User.linkOAuthProfile(userWithBoth.id, 'linkedin', uniqueOAuthProfile);
        
        // Should be able to unlink because user has password
        const updatedUser = await User.unlinkOAuthProfile(userWithBoth.id, 'linkedin', 'linkedin-unique-456');
        expect(updatedUser.oauthProfiles).toHaveLength(0);
      });

      test('should handle non-existent OAuth profile', async () => {
        await expect(User.unlinkOAuthProfile(userWithOAuth.id, 'github', 'nonexistent'))
          .rejects.toThrow(UserError);
      });
    });

    describe('getOAuthProfiles', () => {
      test('should return user OAuth profiles', async () => {
        const user = await User.createFromOAuth('linkedin', mockOAuthProfile);
        const profiles = await User.getOAuthProfiles(user.id);

        expect(profiles).toHaveLength(1);
        expect(profiles[0]).toMatchObject({
          provider: 'linkedin',
          providerId: 'linkedin-123',
          email: 'oauth@example.com'
        });
      });

      test('should return empty array for user without OAuth profiles', async () => {
        const user = await User.create({
          email: 'regular@example.com',
          password: 'SecurePass123!',
          firstName: 'Regular',
          lastName: 'User',
          privacyConsent: true
        });

        const profiles = await User.getOAuthProfiles(user.id);
        expect(profiles).toEqual([]);
      });

      test('should handle non-existent user', async () => {
        await expect(User.getOAuthProfiles('nonexistent')).rejects.toThrow(UserError);
      });
    });

    describe('updateOAuthProfile', () => {
      let userWithOAuth;

      beforeEach(async () => {
        userWithOAuth = await User.createFromOAuth('linkedin', mockOAuthProfile);
      });

      test('should update OAuth profile data', async () => {
        const updatedData = {
          firstName: 'Updated',
          lastName: 'Name',
          profilePicture: 'https://newpic.com/pic.jpg',
          headline: 'Senior Engineer'
        };

        const updatedUser = await User.updateOAuthProfile(
          userWithOAuth.id,
          'linkedin',
          'linkedin-123',
          updatedData
        );

        const profile = updatedUser.oauthProfiles[0];
        expect(profile.firstName).toBe('Updated');
        expect(profile.lastName).toBe('Name');
        expect(profile.profilePicture).toBe('https://newpic.com/pic.jpg');
        expect(profile.headline).toBe('Senior Engineer');
        expect(profile.lastSyncAt).toBeDefined();
      });

      test('should handle partial updates', async () => {
        const partialUpdate = {
          headline: 'New Headline Only'
        };

        const updatedUser = await User.updateOAuthProfile(
          userWithOAuth.id,
          'linkedin',
          'linkedin-123',
          partialUpdate
        );

        const profile = updatedUser.oauthProfiles[0];
        expect(profile.headline).toBe('New Headline Only');
        expect(profile.firstName).toBe('OAuth'); // Should preserve existing
        expect(profile.lastName).toBe('User');   // Should preserve existing
      });

      test('should handle non-existent OAuth profile', async () => {
        await expect(User.updateOAuthProfile(
          userWithOAuth.id,
          'github',
          'nonexistent',
          { headline: 'test' }
        )).rejects.toThrow(UserError);
      });

      test('should sanitize updated names', async () => {
        const maliciousUpdate = {
          firstName: '<script>alert("xss")</script>',
          lastName: '<img src=x onerror=alert(1)>'
        };

        const updatedUser = await User.updateOAuthProfile(
          userWithOAuth.id,
          'linkedin',
          'linkedin-123',
          maliciousUpdate
        );

        const profile = updatedUser.oauthProfiles[0];
        expect(profile.firstName).toContain('&lt;script&gt;');
        expect(profile.firstName).not.toContain('<script>');
        expect(profile.lastName).toContain('&lt;img');
        expect(profile.lastName).not.toContain('<img');
      });
    });
  });
});