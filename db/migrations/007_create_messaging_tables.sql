-- Migration 007: Create Messaging System Tables
-- Real-time messaging infrastructure for client-retiree communication
-- Dependencies: Users table from migration 001

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CONVERSATIONS TABLE
-- =============================================================================
-- Chat rooms/conversations between users with metadata

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Conversation participants (for now, limit to 2 users)
    participant_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    conversation_type VARCHAR(20) NOT NULL DEFAULT 'direct' 
        CHECK (conversation_type IN ('direct', 'booking', 'group')),
    title VARCHAR(200), -- Optional conversation title
    description TEXT, -- Optional conversation description
    
    -- Booking integration (optional)
    booking_id UUID, -- Reference to booking system (to be implemented)
    
    -- Status and settings
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'archived', 'deleted')),
    is_archived_by_participant_1 BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived_by_participant_2 BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Last activity tracking
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_id UUID, -- Reference to messages table
    message_count INTEGER DEFAULT 0,
    
    -- Privacy and permissions
    encryption_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    file_sharing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
-- Individual messages within conversations

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' 
        CHECK (message_type IN ('text', 'file', 'image', 'system', 'booking_update')),
    content TEXT, -- Message text content (required for text messages)
    encrypted_content TEXT, -- Encrypted content for secure messages
    
    -- Rich content support
    metadata JSONB DEFAULT '{}', -- Additional message metadata
    reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- Message threading
    
    -- File attachment support
    file_count INTEGER DEFAULT 0,
    
    -- Message status
    status VARCHAR(20) NOT NULL DEFAULT 'sent' 
        CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed', 'deleted')),
    
    -- Read tracking
    read_by_participant_1 BOOLEAN NOT NULL DEFAULT FALSE,
    read_by_participant_2 BOOLEAN NOT NULL DEFAULT FALSE,
    read_at_participant_1 TIMESTAMP WITH TIME ZONE,
    read_at_participant_2 TIMESTAMP WITH TIME ZONE,
    
    -- Delivery tracking
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Message editing and deletion
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_for_participant_1 BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_for_participant_2 BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- =============================================================================
-- MESSAGE_FILES TABLE
-- =============================================================================
-- File attachments associated with messages

CREATE TABLE message_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    
    -- File metadata
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(10),
    
    -- Storage information
    file_path VARCHAR(1000) NOT NULL, -- Path to file in storage
    file_url VARCHAR(1000), -- CDN URL for file access
    storage_type VARCHAR(20) DEFAULT 'local' CHECK (storage_type IN ('local', 'cdn', 's3')),
    
    -- File processing
    is_processed BOOLEAN NOT NULL DEFAULT TRUE,
    processing_status VARCHAR(20) DEFAULT 'completed' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Image-specific metadata
    image_width INTEGER,
    image_height INTEGER,
    thumbnail_url VARCHAR(1000), -- URL to thumbnail (for images)
    
    -- Security
    is_safe BOOLEAN NOT NULL DEFAULT TRUE, -- Virus scan result
    scan_status VARCHAR(20) DEFAULT 'completed' 
        CHECK (scan_status IN ('pending', 'scanning', 'completed', 'failed')),
    
    -- Access control
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional file expiration
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- =============================================================================
-- USER_PRESENCE TABLE
-- =============================================================================
-- Track user online/offline status and activity

CREATE TABLE user_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Presence status
    status VARCHAR(20) NOT NULL DEFAULT 'offline' 
        CHECK (status IN ('online', 'away', 'busy', 'invisible', 'offline')),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Activity tracking
    is_typing_in_conversation UUID REFERENCES conversations(id) ON DELETE SET NULL,
    typing_started_at TIMESTAMP WITH TIME ZONE,
    
    -- Connection metadata
    socket_id VARCHAR(100), -- Current socket.io connection ID
    user_agent TEXT, -- Client information
    ip_address INET, -- Client IP address
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CONVERSATION_PARTICIPANTS TABLE
-- =============================================================================
-- Extended participant information for future group chat support

CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Participant role and permissions
    role VARCHAR(20) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'member')),
    can_add_participants BOOLEAN NOT NULL DEFAULT FALSE,
    can_remove_participants BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit_conversation BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Participation status
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'left', 'removed', 'muted')),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification preferences
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    muted_until TIMESTAMP WITH TIME ZONE,
    
    -- Read tracking
    last_read_message_id UUID REFERENCES messages(id),
    last_read_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES AND CONSTRAINTS
-- =============================================================================

-- Conversations table indexes
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_status ON conversations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_booking ON conversations(booking_id) WHERE booking_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_conversations_participants_unique ON conversations(
    LEAST(participant_1_id, participant_2_id), 
    GREATEST(participant_1_id, participant_2_id), 
    conversation_type
) WHERE deleted_at IS NULL AND conversation_type = 'direct';

-- Messages table indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_sender ON messages(sender_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_status ON messages(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_type ON messages(message_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_reply_to ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_messages_read_status ON messages(conversation_id, read_by_participant_1, read_by_participant_2) WHERE deleted_at IS NULL;

-- Message files table indexes
CREATE INDEX idx_message_files_message ON message_files(message_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_message_files_processing ON message_files(processing_status) WHERE processing_status != 'completed' AND deleted_at IS NULL;
CREATE INDEX idx_message_files_scan ON message_files(scan_status) WHERE scan_status != 'completed' AND deleted_at IS NULL;
CREATE INDEX idx_message_files_expires ON message_files(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

-- User presence table indexes
CREATE UNIQUE INDEX idx_user_presence_user ON user_presence(user_id);
CREATE INDEX idx_user_presence_status ON user_presence(status);
CREATE INDEX idx_user_presence_last_seen ON user_presence(last_seen_at DESC);
CREATE INDEX idx_user_presence_typing ON user_presence(is_typing_in_conversation) WHERE is_typing_in_conversation IS NOT NULL;
CREATE INDEX idx_user_presence_socket ON user_presence(socket_id) WHERE socket_id IS NOT NULL;

-- Conversation participants table indexes
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_status ON conversation_participants(status);
CREATE INDEX idx_conversation_participants_unread ON conversation_participants(unread_count) WHERE unread_count > 0;
CREATE UNIQUE INDEX idx_conversation_participants_unique ON conversation_participants(conversation_id, user_id);

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Updated_at triggers
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_files_updated_at 
    BEFORE UPDATE ON message_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at 
    BEFORE UPDATE ON user_presence 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_participants_updated_at 
    BEFORE UPDATE ON conversation_participants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations 
        SET 
            last_message_at = NEW.created_at,
            last_message_id = NEW.id,
            message_count = message_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation when new message is added
CREATE TRIGGER update_conversation_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Function to update unread counts
CREATE OR REPLACE FUNCTION update_unread_counts()
RETURNS TRIGGER AS $$
DECLARE
    participant_1 UUID;
    participant_2 UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get conversation participants
        SELECT participant_1_id, participant_2_id 
        INTO participant_1, participant_2
        FROM conversations 
        WHERE id = NEW.conversation_id;
        
        -- Update unread count for the recipient
        IF NEW.sender_id = participant_1 THEN
            UPDATE conversation_participants 
            SET unread_count = unread_count + 1
            WHERE conversation_id = NEW.conversation_id AND user_id = participant_2;
        ELSE
            UPDATE conversation_participants 
            SET unread_count = unread_count + 1
            WHERE conversation_id = NEW.conversation_id AND user_id = participant_1;
        END IF;
        
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update unread counts when new message is added
CREATE TRIGGER update_unread_counts_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_unread_counts();

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE conversations IS 'Chat rooms/conversations between users with metadata and settings';
COMMENT ON TABLE messages IS 'Individual messages within conversations with rich content support';
COMMENT ON TABLE message_files IS 'File attachments associated with messages including metadata and security info';
COMMENT ON TABLE user_presence IS 'Track user online/offline status and real-time activity';
COMMENT ON TABLE conversation_participants IS 'Extended participant information for conversations with permissions and read tracking';

-- Column comments for key fields
COMMENT ON COLUMN conversations.participant_1_id IS 'First participant in direct conversation (for ordering consistency)';
COMMENT ON COLUMN conversations.participant_2_id IS 'Second participant in direct conversation (for ordering consistency)';
COMMENT ON COLUMN conversations.booking_id IS 'Optional reference to booking system for booking-linked conversations';
COMMENT ON COLUMN messages.metadata IS 'JSON field for rich message data (mentions, formatting, etc.)';
COMMENT ON COLUMN messages.reply_to_message_id IS 'Reference for message threading and replies';
COMMENT ON COLUMN message_files.file_url IS 'CDN URL for optimized file delivery';
COMMENT ON COLUMN user_presence.socket_id IS 'Current WebSocket connection identifier for real-time features';
COMMENT ON COLUMN conversation_participants.unread_count IS 'Cached count of unread messages for this participant';