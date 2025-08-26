/**
 * Main Application File
 * Sets up Express server with authentication middleware and routes
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/api/profiles');
const { 
  securityHeaders, 
  corsWithSecurity, 
  generalRateLimit,
  securityLogger,
  suspiciousActivityDetector 
} = require('./middleware/security');

const authConfig = require('./config/auth');

// Create Express application
const app = express();

// Trust proxy (for proper IP forwarding in production)
app.set('trust proxy', 1);

// Security middleware (apply early)
app.use(securityHeaders());
app.use(corsWithSecurity());
app.use(securityLogger());
app.use(suspiciousActivityDetector());

// Rate limiting
app.use('/api/', generalRateLimit());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (before auth routes for easy monitoring)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'LegacyLancers API Service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);

  // Don't leak internal errors in production
  const isDevelopment = authConfig.isDevelopment;
  
  res.status(error.status || 500).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Start server
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 LegacyLancers API started on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 JWT Algorithm: ${authConfig.jwt.algorithm}`);
    console.log(`👥 Profile API: /api/profiles`);
    console.log(`🔑 Auth API: /api/auth`);
    console.log(`⚡ Ready for requests`);
  });
}

module.exports = app;