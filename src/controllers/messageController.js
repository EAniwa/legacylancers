/**
 * Message Controller
 * Handles HTTP REST API endpoints for messaging functionality
 */

const { Conversation, ConversationError } = require('../models/Conversation');
const { Message, MessageError } = require('../models/Message');
const { User } = require('../models/User');
const validator = require('validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all conversations for the authenticated user
 * GET /api/conversations?limit=20&offset=0&status=active
 */
async function getConversations(req, res) {
  try {
    const userId = req.user.id;
    const { 
      limit = 20, 
      offset = 0, 
      status = 'active' 
    } = req.query;

    // Validate query parameters
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT'
      });
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        success: false,
        error: 'Offset must be 0 or greater',
        code: 'INVALID_OFFSET'
      });
    }

    if (!['active', 'archived', 'all'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be active, archived, or all',
        code: 'INVALID_STATUS'
      });
    }

    // Get conversations
    const conversations = await Conversation.findByUserId(userId, {
      limit: limitNum,
      offset: offsetNum,
      status: status === 'all' ? undefined : status
    });

    // Enrich conversations with participant details and unread counts
    const enrichedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        // Get other participant details
        const otherParticipantId = conversation.participant_1_id === userId ? 
          conversation.participant_2_id : conversation.participant_1_id;
        
        const otherParticipant = await User.findById(otherParticipantId);
        
        // Get unread message count
        const unreadCount = await Message.getUnreadCount(conversation.id, userId);
        
        // Get last message if exists
        let lastMessage = null;
        if (conversation.last_message_id) {
          lastMessage = await Message.findById(conversation.last_message_id);
          
          // Get sender details for last message
          if (lastMessage) {
            const sender = await User.findById(lastMessage.sender_id);
            lastMessage.sender = {
              id: sender.id,
              firstName: sender.firstName,
              lastName: sender.lastName
            };
          }
        }

        return {
          id: conversation.id,
          type: conversation.conversation_type,
          title: conversation.title,
          status: conversation.status,
          participant: {
            id: otherParticipant.id,
            firstName: otherParticipant.firstName,
            lastName: otherParticipant.lastName,
            profilePhoto: otherParticipant.profilePhoto || null
          },
          lastMessage,
          messageCount: conversation.message_count,
          unreadCount,
          lastActivity: conversation.last_message_at,
          createdAt: conversation.created_at,
          isArchived: userId === conversation.participant_1_id ? 
            conversation.is_archived_by_participant_1 : 
            conversation.is_archived_by_participant_2
        };
      })
    );

    res.json({
      success: true,
      conversations: enrichedConversations,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: enrichedConversations.length === limitNum
      }
    });

  } catch (error) {
    console.error('Error getting conversations:', error);
    
    if (error instanceof ConversationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get conversations',
      code: 'GET_CONVERSATIONS_FAILED'
    });
  }
}

/**
 * Create a new conversation
 * POST /api/conversations
 * Body: { participantId: string, type?: 'direct'|'booking', title?: string, bookingId?: string }
 */
async function createConversation(req, res) {
  try {
    const userId = req.user.id;
    const { 
      participantId, 
      type = 'direct',
      title,
      bookingId 
    } = req.body;

    // Validate required fields
    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: 'Participant ID is required',
        code: 'MISSING_PARTICIPANT_ID'
      });
    }

    if (participantId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create conversation with yourself',
        code: 'SAME_PARTICIPANT'
      });
    }

    // Validate participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found',
        code: 'PARTICIPANT_NOT_FOUND'
      });
    }

    // For direct conversations, check if one already exists
    if (type === 'direct') {
      const existingConversation = await Conversation.findByParticipants(userId, participantId);
      if (existingConversation) {
        return res.status(409).json({
          success: false,
          error: 'Direct conversation already exists with this participant',
          code: 'CONVERSATION_EXISTS',
          conversationId: existingConversation.id
        });
      }
    }

    // Create conversation
    const conversation = await Conversation.create({
      participant_1_id: userId,
      participant_2_id: participantId,
      conversation_type: type,
      title,
      booking_id: bookingId
    });

    // Get participant details for response
    const currentUser = await User.findById(userId);
    
    const response = {
      id: conversation.id,
      type: conversation.conversation_type,
      title: conversation.title,
      participants: [
        {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          profilePhoto: currentUser.profilePhoto || null
        },
        {
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          profilePhoto: participant.profilePhoto || null
        }
      ],
      messageCount: 0,
      unreadCount: 0,
      lastActivity: null,
      createdAt: conversation.created_at,
      bookingId: conversation.booking_id
    };

    res.status(201).json({
      success: true,
      conversation: response
    });

  } catch (error) {
    console.error('Error creating conversation:', error);
    
    if (error instanceof ConversationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
      code: 'CREATE_CONVERSATION_FAILED'
    });
  }
}

/**
 * Get conversation by ID
 * GET /api/conversations/:id
 */
async function getConversationById(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Get conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    // Check if user has access
    const hasAccess = await Conversation.hasAccess(conversationId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation',
        code: 'ACCESS_DENIED'
      });
    }

    // Get participant details
    const participant1 = await User.findById(conversation.participant_1_id);
    const participant2 = await User.findById(conversation.participant_2_id);

    // Get unread count for current user
    const unreadCount = await Message.getUnreadCount(conversationId, userId);

    // Get last message if exists
    let lastMessage = null;
    if (conversation.last_message_id) {
      lastMessage = await Message.findById(conversation.last_message_id);
      
      if (lastMessage) {
        const sender = await User.findById(lastMessage.sender_id);
        lastMessage.sender = {
          id: sender.id,
          firstName: sender.firstName,
          lastName: sender.lastName
        };
      }
    }

    const response = {
      id: conversation.id,
      type: conversation.conversation_type,
      title: conversation.title,
      status: conversation.status,
      participants: [
        {
          id: participant1.id,
          firstName: participant1.firstName,
          lastName: participant1.lastName,
          profilePhoto: participant1.profilePhoto || null
        },
        {
          id: participant2.id,
          firstName: participant2.firstName,
          lastName: participant2.lastName,
          profilePhoto: participant2.profilePhoto || null
        }
      ],
      lastMessage,
      messageCount: conversation.message_count,
      unreadCount,
      lastActivity: conversation.last_message_at,
      createdAt: conversation.created_at,
      isArchived: userId === conversation.participant_1_id ? 
        conversation.is_archived_by_participant_1 : 
        conversation.is_archived_by_participant_2,
      bookingId: conversation.booking_id,
      settings: {
        encryptionEnabled: conversation.encryption_enabled,
        fileSharingEnabled: conversation.file_sharing_enabled
      }
    };

    res.json({
      success: true,
      conversation: response
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    
    if (error instanceof ConversationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get conversation',
      code: 'GET_CONVERSATION_FAILED'
    });
  }
}

/**
 * Get messages for a conversation
 * GET /api/conversations/:id/messages?limit=50&before=messageId&after=messageId
 */
async function getMessages(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { 
      limit = 50, 
      before, 
      after 
    } = req.query;

    // Validate query parameters
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT'
      });
    }

    // Check if user has access to conversation
    const hasAccess = await Conversation.hasAccess(conversationId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation',
        code: 'ACCESS_DENIED'
      });
    }

    // Get messages
    const messages = await Message.findByConversationId(conversationId, {
      limit: limitNum,
      before,
      after
    });

    // Enrich messages with sender details and files
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        const sender = await User.findById(message.sender_id);
        const files = await Message.getFiles(message.id);

        return {
          id: message.id,
          content: message.content,
          type: message.message_type,
          status: message.status,
          sender: {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            profilePhoto: sender.profilePhoto || null
          },
          replyTo: message.reply_to_message_id,
          metadata: message.metadata,
          files: files.map(file => ({
            id: file.id,
            filename: file.original_filename,
            size: file.file_size,
            mimeType: file.mime_type,
            url: file.file_url,
            thumbnailUrl: file.thumbnail_url
          })),
          createdAt: message.created_at,
          editedAt: message.edited_at,
          isDeleted: message.is_deleted,
          readStatus: {
            participant1Read: message.read_by_participant_1,
            participant2Read: message.read_by_participant_2,
            participant1ReadAt: message.read_at_participant_1,
            participant2ReadAt: message.read_at_participant_2
          }
        };
      })
    );

    res.json({
      success: true,
      messages: enrichedMessages,
      pagination: {
        limit: limitNum,
        hasMore: enrichedMessages.length === limitNum,
        before,
        after
      }
    });

  } catch (error) {
    console.error('Error getting messages:', error);
    
    if (error instanceof MessageError || error instanceof ConversationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      code: 'GET_MESSAGES_FAILED'
    });
  }
}

/**
 * Archive a conversation
 * POST /api/conversations/:id/archive
 */
async function archiveConversation(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Archive the conversation
    const updatedConversation = await Conversation.archive(conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation archived successfully',
      conversation: {
        id: updatedConversation.id,
        isArchived: true
      }
    });

  } catch (error) {
    console.error('Error archiving conversation:', error);
    
    if (error instanceof ConversationError) {
      const statusCode = error.code === 'CONVERSATION_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to archive conversation',
      code: 'ARCHIVE_CONVERSATION_FAILED'
    });
  }
}

/**
 * Unarchive a conversation
 * POST /api/conversations/:id/unarchive
 */
async function unarchiveConversation(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Unarchive the conversation
    const updatedConversation = await Conversation.unarchive(conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation unarchived successfully',
      conversation: {
        id: updatedConversation.id,
        isArchived: false
      }
    });

  } catch (error) {
    console.error('Error unarchiving conversation:', error);
    
    if (error instanceof ConversationError) {
      const statusCode = error.code === 'CONVERSATION_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to unarchive conversation',
      code: 'UNARCHIVE_CONVERSATION_FAILED'
    });
  }
}

/**
 * Search messages in a conversation
 * GET /api/conversations/:id/search?q=query&limit=20
 */
async function searchMessages(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { q: query, limit = 20 } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'MISSING_QUERY'
      });
    }

    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 50',
        code: 'INVALID_LIMIT'
      });
    }

    // Check if user has access to conversation
    const hasAccess = await Conversation.hasAccess(conversationId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation',
        code: 'ACCESS_DENIED'
      });
    }

    // Search messages
    const messages = await Message.search(conversationId, query, { limit: limitNum });

    // Enrich messages with sender details
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        const sender = await User.findById(message.sender_id);

        return {
          id: message.id,
          content: message.content,
          type: message.message_type,
          sender: {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            profilePhoto: sender.profilePhoto || null
          },
          createdAt: message.created_at
        };
      })
    );

    res.json({
      success: true,
      messages: enrichedMessages,
      query: query.trim(),
      totalResults: enrichedMessages.length
    });

  } catch (error) {
    console.error('Error searching messages:', error);
    
    if (error instanceof MessageError || error instanceof ConversationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to search messages',
      code: 'SEARCH_MESSAGES_FAILED'
    });
  }
}

/**
 * Get conversation statistics for admin/debugging
 * GET /api/conversations/stats
 */
async function getConversationStats(req, res) {
  try {
    // Check if user is admin (basic check for now)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ACCESS_DENIED'
      });
    }

    const conversationStats = await Conversation.getStats();
    const messageStats = await Message.getStats();

    res.json({
      success: true,
      stats: {
        conversations: conversationStats,
        messages: messageStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      code: 'GET_STATS_FAILED'
    });
  }
}

/**
 * Configure multer for file uploads
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images, documents, and other common file types
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per upload
  }
});

/**
 * Upload files to a conversation
 * POST /api/conversations/:id/files
 */
const uploadFiles = upload.array('files', 5);

async function uploadConversationFiles(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Check if user has access to conversation
    const hasAccess = await Conversation.hasAccess(conversationId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation',
        code: 'ACCESS_DENIED'
      });
    }

    // Get conversation to check file sharing settings
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    if (!conversation.file_sharing_enabled) {
      return res.status(403).json({
        success: false,
        error: 'File sharing is disabled for this conversation',
        code: 'FILE_SHARING_DISABLED'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    // Process uploaded files
    const processedFiles = [];
    
    for (const file of req.files) {
      try {
        const fileData = {
          filename: file.filename,
          originalFilename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          filePath: file.path,
          fileUrl: `/uploads/messages/${file.filename}`,
          storageType: 'local'
        };

        // Generate thumbnail for images
        if (file.mimetype.startsWith('image/')) {
          try {
            const thumbnailPath = file.path.replace(path.extname(file.path), '_thumb.jpg');
            const metadata = await sharp(file.path)
              .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toFile(thumbnailPath);
            
            fileData.imageWidth = metadata.width;
            fileData.imageHeight = metadata.height;
            fileData.thumbnailUrl = `/uploads/messages/${path.basename(thumbnailPath)}`;
          } catch (thumbnailError) {
            console.error('Error generating thumbnail:', thumbnailError);
            // Continue without thumbnail
          }
        }

        processedFiles.push(fileData);
      } catch (fileError) {
        console.error('Error processing file:', fileError);
        // Clean up the file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }

    if (processedFiles.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to process uploaded files',
        code: 'FILE_PROCESSING_FAILED'
      });
    }

    // Create a message with the files
    const message = await Message.create({
      conversation_id: conversationId,
      sender_id: userId,
      message_type: processedFiles.some(f => f.mimeType.startsWith('image/')) ? 'image' : 'file',
      content: processedFiles.length > 1 ? 
        `Shared ${processedFiles.length} files` : 
        `Shared ${processedFiles[0].originalFilename}`,
      files: processedFiles
    });

    // Update conversation last message
    await Conversation.update(conversationId, {
      last_message_at: message.created_at,
      last_message_id: message.id,
      message_count: await getConversationMessageCount(conversationId)
    });

    // Get sender details
    const sender = await User.findById(userId);

    const responseData = {
      ...message,
      sender: {
        id: sender.id,
        firstName: sender.firstName,
        lastName: sender.lastName,
        profilePhoto: sender.profilePhoto || null
      },
      files: processedFiles.map(file => ({
        id: uuidv4(),
        filename: file.originalFilename,
        size: file.fileSize,
        mimeType: file.mimeType,
        url: file.fileUrl,
        thumbnailUrl: file.thumbnailUrl
      }))
    };

    res.status(201).json({
      success: true,
      message: responseData,
      filesUploaded: processedFiles.length
    });

  } catch (error) {
    console.error('Error uploading conversation files:', error);

    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }

    if (error instanceof ConversationError || error instanceof MessageError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload files',
      code: 'UPLOAD_FAILED'
    });
  }
}

/**
 * Download a file from a conversation
 * GET /api/conversations/:id/files/:fileId
 */
async function downloadConversationFile(req, res) {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const fileId = req.params.fileId;

    // Check if user has access to conversation
    const hasAccess = await Conversation.hasAccess(conversationId, userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation',
        code: 'ACCESS_DENIED'
      });
    }

    // For now, serve files directly from uploads directory
    // In production, you would validate the fileId and serve from secure storage
    const filePath = path.join(process.cwd(), 'uploads', 'messages', fileId);
    
    try {
      await fs.access(filePath);
      res.sendFile(path.resolve(filePath));
    } catch (fileError) {
      res.status(404).json({
        success: false,
        error: 'File not found',
        code: 'FILE_NOT_FOUND'
      });
    }

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file',
      code: 'DOWNLOAD_FAILED'
    });
  }
}

/**
 * Helper function to count messages in conversation
 */
async function getConversationMessageCount(conversationId) {
  try {
    const messages = await Message.findByConversationId(conversationId, { limit: 10000 });
    return messages.length;
  } catch (error) {
    console.error('Error getting conversation message count:', error);
    return 0;
  }
}

module.exports = {
  getConversations,
  createConversation,
  getConversationById,
  getMessages,
  archiveConversation,
  unarchiveConversation,
  searchMessages,
  getConversationStats,
  uploadFiles,
  uploadConversationFiles,
  downloadConversationFile
};