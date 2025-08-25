/**
 * OAuth Authentication Routes
 * Express routes for OAuth 2.0 authentication flows
 */

const express = require('express');
const { oauth, OAuthError } = require('../../auth/oauth');
const LinkedInProvider = require('../../auth/oauth/providers/linkedin');
const oauthConfig = require('../../config/oauth');
const { User } = require('../../models/User');
const {
  validateProvider,
  validateCallback,
  oauthSecurityHeaders,
  oauthInitiateRateLimit,
  oauthCallbackRateLimit,
  validateRedirectURL,
  oauthErrorHandler,
  logOAuthEvent,
  requireAuthForLinking
} = require('../../auth/oauth/middleware');

const router = express.Router();

// Apply security headers to all OAuth routes
router.use(oauthSecurityHeaders);

// Register OAuth providers
oauth.registerProvider('linkedin', new LinkedInProvider());

/**
 * GET /api/auth/oauth/providers
 * List available OAuth providers
 */
router.get('/providers', (req, res) => {
  try {
    const providers = oauth.getAvailableProviders();
    
    res.json({
      success: true,
      providers,
      count: providers.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'PROVIDERS_FETCH_FAILED',
      message: 'Failed to fetch available providers'
    });
  }
});

/**
 * GET /api/auth/oauth/:provider
 * Initiate OAuth flow for a specific provider
 */
router.get('/:provider',
  oauthInitiateRateLimit,
  validateProvider,
  validateRedirectURL,
  logOAuthEvent('oauth_initiate'),
  async (req, res) => {
    try {
      const { provider } = req.params;
      const redirectURL = req.validatedRedirectURL || oauthConfig.redirects.success;
      const userId = req.user?.id || null; // For account linking if user is authenticated

      // Initiate OAuth flow
      const oauthResult = await oauth.initiateOAuth(provider, {
        redirectURL,
        userId,
        additionalParams: req.query // Pass through any additional OAuth parameters
      });

      // Redirect user to OAuth provider
      res.redirect(oauthResult.authorizationURL);

    } catch (error) {
      console.error('OAuth initiation error:', error);
      
      if (error instanceof OAuthError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message,
          provider: error.provider
        });
      }

      res.status(500).json({
        success: false,
        error: 'OAUTH_INITIATION_FAILED',
        message: 'Failed to initiate OAuth flow'
      });
    }
  }
);

/**
 * GET /api/auth/oauth/:provider/callback
 * Handle OAuth callback from provider
 */
router.get('/:provider/callback',
  oauthCallbackRateLimit,
  validateProvider,
  validateCallback,
  logOAuthEvent('oauth_callback'),
  async (req, res) => {
    try {
      const { provider } = req.params;
      const { code, state, error } = req.query;

      // Handle OAuth callback
      const callbackResult = await oauth.handleCallback(provider, {
        code,
        state,
        error
      });

      const { tokens, profile, stateData, linkedUserId } = callbackResult;

      let userResult;

      if (linkedUserId) {
        // Account linking flow - link OAuth profile to existing user
        userResult = await oauth.linkProfileToUser(linkedUserId, provider, profile, tokens);
      } else {
        // New user flow - create or find user from OAuth profile
        userResult = await oauth.createOrUpdateUser(provider, profile, tokens);
      }

      // Set authentication cookies/session
      if (userResult.tokens) {
        // Set JWT token as HTTP-only cookie
        res.cookie('auth_token', userResult.tokens.accessToken, {
          httpOnly: true,
          secure: oauthConfig.isProduction,
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.cookie('refresh_token', userResult.tokens.refreshToken, {
          httpOnly: true,
          secure: oauthConfig.isProduction,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      // Determine redirect URL
      let redirectURL = stateData.redirectURL || oauthConfig.redirects.success;

      // Add query parameters for frontend handling
      const redirectParams = new URLSearchParams({
        oauth_success: 'true',
        provider: provider,
        new_user: userResult.isNewUser ? 'true' : 'false'
      });

      if (linkedUserId) {
        redirectParams.set('linked', 'true');
      }

      // Redirect to success page
      res.redirect(`${redirectURL}?${redirectParams.toString()}`);

    } catch (error) {
      console.error('OAuth callback error:', error);
      
      // Determine error redirect URL
      let errorRedirectURL = oauthConfig.redirects.error;
      
      if (error instanceof OAuthError) {
        const errorParams = new URLSearchParams({
          oauth_error: error.code,
          error_message: error.message,
          provider: error.provider || req.params.provider
        });
        
        errorRedirectURL = `${errorRedirectURL}&${errorParams.toString()}`;
      } else {
        const errorParams = new URLSearchParams({
          oauth_error: 'CALLBACK_FAILED',
          error_message: 'OAuth authentication failed'
        });
        
        errorRedirectURL = `${errorRedirectURL}&${errorParams.toString()}`;
      }

      res.redirect(errorRedirectURL);
    }
  }
);

/**
 * POST /api/auth/oauth/:provider/link
 * Link OAuth account to existing user account (requires authentication)
 */
router.post('/:provider/link',
  oauthInitiateRateLimit,
  requireAuthForLinking,
  validateProvider,
  validateRedirectURL,
  logOAuthEvent('oauth_link_initiate'),
  async (req, res) => {
    try {
      const { provider } = req.params;
      const userId = req.user.id;
      const redirectURL = req.validatedRedirectURL || oauthConfig.redirects.success;

      // Initiate OAuth flow for account linking
      const oauthResult = await oauth.initiateOAuth(provider, {
        redirectURL,
        userId, // This marks it as an account linking flow
        additionalParams: req.body // Allow additional OAuth parameters
      });

      res.json({
        success: true,
        authorizationURL: oauthResult.authorizationURL,
        provider: provider,
        linkingFlow: true
      });

    } catch (error) {
      console.error('OAuth linking initiation error:', error);
      
      if (error instanceof OAuthError) {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message,
          provider: error.provider
        });
      }

      res.status(500).json({
        success: false,
        error: 'OAUTH_LINKING_FAILED',
        message: 'Failed to initiate OAuth account linking'
      });
    }
  }
);

/**
 * DELETE /api/auth/oauth/:provider/unlink
 * Unlink OAuth account from user account (requires authentication)
 */
router.delete('/:provider/unlink',
  requireAuthForLinking,
  validateProvider,
  logOAuthEvent('oauth_unlink_attempt'),
  async (req, res) => {
    try {
      const { provider } = req.params;
      const userId = req.user.id;

      // Get user's OAuth profiles to find the specific profile to unlink
      const oauthProfiles = await User.getOAuthProfiles(userId);
      const profileToUnlink = oauthProfiles.find(profile => profile.provider === provider);

      if (!profileToUnlink) {
        return res.status(404).json({
          success: false,
          error: 'OAUTH_PROFILE_NOT_FOUND',
          message: `No ${provider} account linked to this user`
        });
      }

      // Unlink OAuth profile
      const updatedUser = await User.unlinkOAuthProfile(userId, provider, profileToUnlink.providerId);
      
      res.json({
        success: true,
        message: `${provider} account unlinked successfully`,
        provider,
        userId,
        unlinkedProfile: {
          provider: profileToUnlink.provider,
          email: profileToUnlink.email,
          unlinkedAt: new Date().toISOString()
        },
        remainingOAuthProfiles: updatedUser.oauthProfiles?.length || 0
      });

    } catch (error) {
      console.error('OAuth unlinking error:', error);
      
      if (error.code === 'LAST_AUTH_METHOD') {
        return res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }

      if (error.code === 'OAUTH_PROFILE_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: error.code,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'OAUTH_UNLINKING_FAILED',
        message: 'Failed to unlink OAuth account'
      });
    }
  }
);

/**
 * GET /api/auth/oauth/debug/stats
 * Get OAuth system statistics (development/debug only)
 */
router.get('/debug/stats', (req, res) => {
  try {
    // Only enable in development/test environments
    if (oauthConfig.isProduction) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Endpoint not available in production'
      });
    }

    const stats = oauth.getStats();
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'STATS_FETCH_FAILED',
      message: 'Failed to fetch OAuth statistics'
    });
  }
});

/**
 * POST /api/auth/oauth/debug/cleanup
 * Cleanup expired OAuth states (development/debug only)
 */
router.post('/debug/cleanup', (req, res) => {
  try {
    // Only enable in development/test environments
    if (oauthConfig.isProduction) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Endpoint not available in production'
      });
    }

    const cleanedCount = oauth.stateManager.cleanupExpired();
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired OAuth states`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'CLEANUP_FAILED',
      message: 'Failed to cleanup OAuth states'
    });
  }
});

/**
 * GET /api/auth/oauth/health
 * OAuth system health check
 */
router.get('/health', (req, res) => {
  try {
    const enabledProviders = oauth.getAvailableProviders();
    const stats = oauth.getStats();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      enabledProviders: enabledProviders.length,
      registeredProviders: stats.registeredProviders.length,
      stateManagerActive: !!oauth.stateManager
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Apply OAuth error handler
router.use(oauthErrorHandler);

module.exports = router;