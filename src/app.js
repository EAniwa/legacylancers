/**
 * Main Application File
 * Sets up Express server with authentication middleware and routes
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/api/profiles');
const skillsRoutes = require('./routes/api/skills');
const uploadRoutes = require('./routes/api/upload');
const availabilityRoutes = require('./routes/api/availability');
const bookingRoutes = require('./routes/api/bookings');
const notificationRoutes = require('./routes/api/notifications');
const publicProfileRoutes = require('./routes/public-profiles');

// Import message controller and socket initialization
const messageController = require('./controllers/messageController');
const { initializeMessageSocket } = require('./sockets/messageSocket');
const { requiredAuthenticate: authMiddleware } = require('./middleware/auth');
const { 
  securityHeaders, 
  corsWithSecurity, 
  generalRateLimit,
  securityLogger,
  suspiciousActivityDetector 
} = require('./middleware/security');

const authConfig = require('./config/auth');
const cdnConfig = require('./config/cdn');

// Create Express application
const app = express();

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Connection timeout
  connectTimeout: 45000,
  // Ping timeout
  pingTimeout: 30000
});

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

// Static file serving for uploads (with security headers)
if (cdnConfig.storageType === 'local') {
  app.use('/uploads', express.static(cdnConfig.local.baseDir, {
    maxAge: cdnConfig.cache.maxAge,
    etag: cdnConfig.cache.etag,
    lastModified: cdnConfig.cache.lastModified,
    // Security: prevent directory listing
    index: false,
    // Security: prevent access to dotfiles
    dotfiles: 'deny'
  }));

  // Serve message files with authentication protection
  // Note: In production, you'd want more granular access control
  const messagesPath = path.join(process.cwd(), 'uploads', 'messages');
  app.use('/uploads/messages', authMiddleware, express.static(messagesPath, {
    maxAge: cdnConfig.cache.maxAge,
    etag: cdnConfig.cache.etag,
    lastModified: cdnConfig.cache.lastModified,
    index: false,
    dotfiles: 'deny'
  }));
}

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
app.use('/api/skills', skillsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);

// Message routes (protected with auth)
app.get('/api/conversations/stats', authMiddleware, messageController.getConversationStats);
app.get('/api/conversations', authMiddleware, messageController.getConversations);
app.post('/api/conversations', authMiddleware, messageController.createConversation);
app.get('/api/conversations/:id', authMiddleware, messageController.getConversationById);
app.get('/api/conversations/:id/messages', authMiddleware, messageController.getMessages);
app.post('/api/conversations/:id/archive', authMiddleware, messageController.archiveConversation);
app.post('/api/conversations/:id/unarchive', authMiddleware, messageController.unarchiveConversation);
app.get('/api/conversations/:id/search', authMiddleware, messageController.searchMessages);
app.post('/api/conversations/:id/files', authMiddleware, messageController.uploadFiles, messageController.uploadConversationFiles);
app.get('/api/conversations/:id/files/:fileId', authMiddleware, messageController.downloadConversationFile);

// Public profile routes (SEO-friendly)
app.use('/', publicProfileRoutes);

// Initialize Socket.IO messaging
initializeMessageSocket(io);

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
  server.listen(PORT, () => {
    console.log(`🚀 LegacyLancers API started on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 JWT Algorithm: ${authConfig.jwt.algorithm}`);
    console.log(`👥 Profile API: /api/profiles`);
    console.log(`🎯 Skills API: /api/skills`);
    console.log(`🔑 Auth API: /api/auth`);
    console.log(`📸 Upload API: /api/upload`);
    console.log(`📅 Availability API: /api/availability`);
    console.log(`📋 Booking API: /api/bookings`);
    console.log(`🔔 Notification API: /api/notifications`);
    console.log(`💬 Messaging API: /api/conversations`);
    console.log(`⚡ Socket.IO: Real-time messaging enabled`);
    console.log(`📁 Storage: ${cdnConfig.storageType} (${cdnConfig.storageType === 'local' ? cdnConfig.local.baseDir : 'CDN'})`);
    console.log(`⚡ Ready for requests`);
  });
}

module.exports = { app, server, io };