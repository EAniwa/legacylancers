/**
 * Notification Worker
 * Background processor for queued notifications with retry logic and monitoring
 */

const { NotificationService } = require('../services/notificationService');

class NotificationWorkerError extends Error {
  constructor(message, code = 'WORKER_ERROR') {
    super(message);
    this.name = 'NotificationWorkerError';
    this.code = code;
  }
}

/**
 * NotificationWorker Class
 * Handles background processing of queued notifications
 */
class NotificationWorker {
  constructor(db, options = {}) {
    this.db = db;
    this.notificationService = new NotificationService(db);
    
    this.config = {
      batchSize: options.batchSize || 50,
      processInterval: options.processInterval || 30000, // 30 seconds
      maxConcurrentJobs: options.maxConcurrentJobs || 5,
      stuckItemTimeoutMinutes: options.stuckItemTimeoutMinutes || 30,
      cleanupIntervalMinutes: options.cleanupIntervalMinutes || 60,
      retentionDays: options.retentionDays || 30,
      ...options
    };

    this.isRunning = false;
    this.isProcessing = false;
    this.processTimer = null;
    this.cleanupTimer = null;
    this.stats = {
      totalProcessed: 0,
      successfulJobs: 0,
      failedJobs: 0,
      lastProcessedAt: null,
      lastCleanupAt: null,
      errors: []
    };
    
    // Graceful shutdown handling
    this.setupSignalHandlers();
  }

  /**
   * Start the notification worker
   */
  async start() {
    if (this.isRunning) {
      console.warn('Notification worker is already running');
      return;
    }

    console.log('Starting notification worker...');
    this.isRunning = true;
    
    try {
      // Initial cleanup of stuck items
      await this.resetStuckItems();
      
      // Start processing loop
      this.startProcessingLoop();
      
      // Start cleanup loop
      this.startCleanupLoop();
      
      console.log(`Notification worker started successfully`);
      console.log(`- Batch size: ${this.config.batchSize}`);
      console.log(`- Process interval: ${this.config.processInterval}ms`);
      console.log(`- Max concurrent jobs: ${this.config.maxConcurrentJobs}`);
      
    } catch (error) {
      this.isRunning = false;
      throw new NotificationWorkerError(`Failed to start worker: ${error.message}`, 'START_FAILED');
    }
  }

  /**
   * Stop the notification worker
   */
  async stop() {
    if (!this.isRunning) {
      console.warn('Notification worker is not running');
      return;
    }

    console.log('Stopping notification worker...');
    this.isRunning = false;

    // Clear timers
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Wait for current processing to complete
    if (this.isProcessing) {
      console.log('Waiting for current processing to complete...');
      await this.waitForProcessingComplete();
    }

    console.log('Notification worker stopped successfully');
    this.printStats();
  }

  /**
   * Start the main processing loop
   */
  startProcessingLoop() {
    const processNext = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        await this.processQueueBatch();
      } catch (error) {
        this.logError('Processing loop error', error);
      }

      // Schedule next processing cycle
      if (this.isRunning) {
        this.processTimer = setTimeout(processNext, this.config.processInterval);
      }
    };

    // Start immediately
    processNext();
  }

  /**
   * Start the cleanup loop
   */
  startCleanupLoop() {
    const cleanupNext = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        await this.performMaintenance();
      } catch (error) {
        this.logError('Cleanup loop error', error);
      }

      // Schedule next cleanup cycle
      if (this.isRunning) {
        const cleanupInterval = this.config.cleanupIntervalMinutes * 60 * 1000;
        this.cleanupTimer = setTimeout(cleanupNext, cleanupInterval);
      }
    };

    // Start after initial delay
    const initialDelay = 60000; // 1 minute
    this.cleanupTimer = setTimeout(cleanupNext, initialDelay);
  }

  /**
   * Process a batch of queued notifications
   */
  async processQueueBatch() {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      const startTime = Date.now();
      
      // Process the queue batch
      const result = await this.notificationService.processQueue(this.config.batchSize);
      
      const processingTime = Date.now() - startTime;
      
      // Update stats
      this.stats.totalProcessed += result.processedCount;
      this.stats.successfulJobs += result.successCount;
      this.stats.failedJobs += result.failureCount;
      this.stats.lastProcessedAt = new Date();

      // Log results if there was work done
      if (result.processedCount > 0) {
        console.log(`Processed ${result.processedCount} notifications in ${processingTime}ms`);
        console.log(`- Success: ${result.successCount}, Failed: ${result.failureCount}`);
        
        // Log any failures
        if (result.failureCount > 0) {
          result.results.filter(r => !r.success).forEach(failure => {
            console.warn(`Queue item ${failure.queueId} failed: ${failure.error}`);
          });
        }
      }

      // Get queue stats periodically
      if (this.stats.totalProcessed % 100 === 0 && this.stats.totalProcessed > 0) {
        try {
          const queueStats = await this.notificationService.getQueueStats();
          console.log('Queue Statistics:', {
            pending: queueStats.pending,
            processing: queueStats.processing,
            failed: queueStats.failed,
            total: queueStats.total
          });
        } catch (error) {
          console.warn('Failed to get queue stats:', error.message);
        }
      }

    } catch (error) {
      this.logError('Batch processing failed', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Perform maintenance tasks
   */
  async performMaintenance() {
    console.log('Performing maintenance tasks...');
    
    try {
      // Reset stuck items
      const resetCount = await this.resetStuckItems();
      if (resetCount > 0) {
        console.log(`Reset ${resetCount} stuck queue items`);
      }

      // Cleanup expired notifications
      const expiredCount = await this.notificationService.cleanupExpiredNotifications();
      if (expiredCount > 0) {
        console.log(`Cleaned up ${expiredCount} expired notifications`);
      }

      // Cleanup old queue items
      const cleanupCount = await this.notificationService.queue.cleanup(this.config.retentionDays);
      if (cleanupCount > 0) {
        console.log(`Cleaned up ${cleanupCount} old queue items`);
      }

      this.stats.lastCleanupAt = new Date();
      console.log('Maintenance completed successfully');

    } catch (error) {
      this.logError('Maintenance failed', error);
    }
  }

  /**
   * Reset stuck queue items
   */
  async resetStuckItems() {
    try {
      return await this.notificationService.resetStuckQueueItems();
    } catch (error) {
      this.logError('Failed to reset stuck items', error);
      return 0;
    }
  }

  /**
   * Wait for current processing to complete
   */
  async waitForProcessingComplete() {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 100; // 100ms
    let waitTime = 0;

    while (this.isProcessing && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
    }

    if (this.isProcessing) {
      console.warn('Processing did not complete within timeout, forcing shutdown');
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const gracefulShutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down notification worker gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in notification worker:', error);
      this.logError('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection in notification worker:', reason);
      this.logError('Unhandled rejection', new Error(reason));
    });
  }

  /**
   * Log error with details
   */
  logError(context, error) {
    const errorInfo = {
      context,
      message: error.message,
      code: error.code,
      timestamp: new Date(),
      stack: error.stack
    };

    console.error(`[NotificationWorker] ${context}:`, errorInfo);
    
    // Keep limited error history
    this.stats.errors.push(errorInfo);
    if (this.stats.errors.length > 100) {
      this.stats.errors.shift(); // Remove oldest error
    }
  }

  /**
   * Print worker statistics
   */
  printStats() {
    console.log('Notification Worker Statistics:');
    console.log(`- Total processed: ${this.stats.totalProcessed}`);
    console.log(`- Successful jobs: ${this.stats.successfulJobs}`);
    console.log(`- Failed jobs: ${this.stats.failedJobs}`);
    console.log(`- Success rate: ${this.stats.totalProcessed > 0 ? 
      ((this.stats.successfulJobs / this.stats.totalProcessed) * 100).toFixed(2) : 0}%`);
    console.log(`- Last processed: ${this.stats.lastProcessedAt || 'Never'}`);
    console.log(`- Last cleanup: ${this.stats.lastCleanupAt || 'Never'}`);
    console.log(`- Recent errors: ${this.stats.errors.length}`);
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      config: this.config,
      stats: { ...this.stats }
    };
  }

  /**
   * Process specific notification types with priority
   */
  async processUrgentNotifications() {
    try {
      console.log('Processing urgent notifications...');
      
      // Get urgent items from queue
      const urgentItems = await this.notificationService.queue.getNextToProcess(10, []);
      
      // Filter for urgent priority
      const urgentOnly = urgentItems.filter(item => {
        return item.priority >= this.notificationService.config.priorityWeights.urgent;
      });

      if (urgentOnly.length === 0) {
        return { processedCount: 0, message: 'No urgent notifications found' };
      }

      let successCount = 0;
      let failureCount = 0;

      for (const queueItem of urgentOnly) {
        try {
          const result = await this.notificationService.sendNotification({
            userId: queueItem.userId,
            templateKey: queueItem.templateKey,
            templateData: queueItem.templateData,
            options: {
              channels: queueItem.channels,
              recipientEmail: queueItem.recipientEmail,
              recipientPhone: queueItem.recipientPhone
            }
          });

          await this.notificationService.queue.markCompleted(queueItem.id, result);
          successCount++;

        } catch (error) {
          await this.notificationService.queue.markFailed(queueItem.id, error.message, 1); // Faster retry
          failureCount++;
        }
      }

      console.log(`Processed ${urgentOnly.length} urgent notifications - Success: ${successCount}, Failed: ${failureCount}`);
      
      return {
        processedCount: urgentOnly.length,
        successCount,
        failureCount
      };

    } catch (error) {
      this.logError('Urgent processing failed', error);
      return { processedCount: 0, error: error.message };
    }
  }

  /**
   * Process digest emails based on schedule
   */
  async processDigests() {
    try {
      console.log('Processing scheduled digests...');
      
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 = Sunday
      
      // Determine which digest frequency to process
      let frequency = null;
      if (hour === 9) { // 9 AM daily digests
        frequency = 'daily';
      } else if (hour === 9 && day === 1) { // 9 AM Monday weekly digests
        frequency = 'weekly';
      } else if (now.getMinutes() === 0) { // Top of every hour
        frequency = 'hourly';
      }

      if (!frequency) {
        return { message: 'No digests scheduled for this time' };
      }

      // Get users who need digests
      const userIds = await this.notificationService.preference.getUsersForDigest(frequency);
      
      if (userIds.length === 0) {
        return { message: `No users need ${frequency} digests` };
      }

      console.log(`Processing ${frequency} digests for ${userIds.length} users`);
      
      let successCount = 0;
      let failureCount = 0;

      for (const userId of userIds) {
        try {
          // Get user's unread notifications for digest
          const notifications = await this.notificationService.getUserNotifications(userId, {
            unreadOnly: true,
            limit: 50
          });

          if (notifications.notifications.length === 0) {
            continue; // Skip users with no notifications
          }

          // Get user profile
          const userProfile = await this.notificationService.getUserProfile(userId);
          
          // Send digest email via email service
          await this.notificationService.emailService.sendDigestEmail({
            userId,
            recipientEmail: userProfile.email,
            recipientName: userProfile.firstName,
            notifications: notifications.notifications,
            frequency
          });

          // Update last digest sent timestamp
          await this.notificationService.preference.updateLastDigestSent(userId);
          successCount++;

        } catch (error) {
          console.warn(`Failed to send ${frequency} digest to user ${userId}:`, error.message);
          failureCount++;
        }
      }

      console.log(`${frequency} digest processing completed - Success: ${successCount}, Failed: ${failureCount}`);
      
      return {
        frequency,
        eligibleUsers: userIds.length,
        successCount,
        failureCount
      };

    } catch (error) {
      this.logError('Digest processing failed', error);
      return { error: error.message };
    }
  }
}

module.exports = {
  NotificationWorker,
  NotificationWorkerError
};