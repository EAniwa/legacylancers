-- Notification System Migration
-- Creates tables for multi-channel notification system with templates, preferences, and delivery tracking
-- Migration 007: Notification System for engagement_booking epic
-- Created: 2025-08-27

-- =============================================================================
-- NOTIFICATION TEMPLATES TABLE
-- =============================================================================
-- Stores reusable notification templates for different event types

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_key VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'booking_request', 'message_received'
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Template content for different channels
    email_subject VARCHAR(500),
    email_html_template TEXT,
    email_text_template TEXT,
    in_app_template TEXT NOT NULL, -- Required for in-app notifications
    sms_template VARCHAR(160), -- SMS character limit
    
    -- Template variables and metadata
    template_variables JSONB DEFAULT '[]', -- Array of variable names used in templates
    category VARCHAR(50) NOT NULL, -- 'booking', 'messaging', 'system', 'marketing'
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Template settings
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    supports_email BOOLEAN NOT NULL DEFAULT TRUE,
    supports_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    supports_sms BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- USER NOTIFICATION PREFERENCES TABLE
-- =============================================================================
-- Stores user preferences for notification delivery channels

CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Channel preferences
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    push_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Future mobile push notifications
    
    -- Category-specific preferences
    booking_notifications JSONB NOT NULL DEFAULT '{"email": true, "in_app": true, "sms": false}',
    message_notifications JSONB NOT NULL DEFAULT '{"email": true, "in_app": true, "sms": false}',
    system_notifications JSONB NOT NULL DEFAULT '{"email": true, "in_app": true, "sms": false}',
    marketing_notifications JSONB NOT NULL DEFAULT '{"email": false, "in_app": false, "sms": false}',
    
    -- Delivery timing preferences
    quiet_hours_start TIME, -- e.g., '22:00'
    quiet_hours_end TIME,   -- e.g., '08:00'
    timezone VARCHAR(50),   -- User's timezone for quiet hours
    
    -- Email digest preferences
    email_digest_frequency VARCHAR(20) DEFAULT 'daily' CHECK (email_digest_frequency IN ('immediate', 'hourly', 'daily', 'weekly', 'disabled')),
    last_digest_sent TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- NOTIFICATIONS TABLE
-- =============================================================================
-- Stores in-app notifications and tracks notification states

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_key VARCHAR(100) NOT NULL, -- References notification_templates.template_key
    
    -- Notification content
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional data for the notification (URLs, IDs, etc.)
    
    -- Notification context
    category VARCHAR(50) NOT NULL, -- 'booking', 'messaging', 'system', 'marketing'
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Related entities (optional)
    related_entity_type VARCHAR(50), -- 'booking', 'message', 'user', etc.
    related_entity_id UUID, -- ID of the related entity
    
    -- Notification state
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    
    -- Action tracking
    action_url VARCHAR(1000), -- URL to navigate to when notification is clicked
    action_taken BOOLEAN NOT NULL DEFAULT FALSE,
    action_taken_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- NOTIFICATION QUEUE TABLE
-- =============================================================================
-- Queue for background processing of notifications

CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_key VARCHAR(100) NOT NULL,
    
    -- Queue processing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 0, -- Higher numbers = higher priority
    
    -- Notification data
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    template_data JSONB NOT NULL DEFAULT '{}',
    
    -- Channel settings
    channels JSONB NOT NULL DEFAULT '["in_app"]', -- Array of channels to send to
    
    -- Processing metadata
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE, -- For scheduled notifications
    
    -- Results tracking
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- NOTIFICATION DELIVERY LOG TABLE
-- =============================================================================
-- Tracks delivery of notifications across all channels

CREATE TABLE notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    queue_item_id UUID REFERENCES notification_queue(id) ON DELETE SET NULL,
    template_key VARCHAR(100) NOT NULL,
    
    -- Delivery details
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'in_app', 'sms', 'push')),
    recipient VARCHAR(255) NOT NULL, -- Email, phone, or user ID
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
    
    -- Provider details
    provider VARCHAR(50), -- e.g., 'sendgrid', 'twilio', 'internal'
    provider_message_id VARCHAR(255), -- External provider's message ID
    provider_response TEXT, -- Full response from provider
    
    -- Delivery timing
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Notification templates indexes
CREATE INDEX idx_notification_templates_key ON notification_templates(template_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_templates_category ON notification_templates(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE deleted_at IS NULL;

-- User notification preferences indexes
CREATE UNIQUE INDEX idx_user_notification_preferences_user ON user_notification_preferences(user_id) WHERE deleted_at IS NULL;

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_template_key ON notifications(template_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_category ON notifications(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_priority ON notifications(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE deleted_at IS NULL AND read_at IS NULL;
CREATE INDEX idx_notifications_related_entity ON notifications(related_entity_type, related_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- Notification queue indexes
CREATE INDEX idx_notification_queue_status ON notification_queue(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority DESC, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_queue_pending ON notification_queue(status, next_attempt_at) WHERE deleted_at IS NULL AND status = 'pending';
CREATE INDEX idx_notification_queue_processing ON notification_queue(status, updated_at) WHERE deleted_at IS NULL AND status = 'processing';
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for) WHERE deleted_at IS NULL AND scheduled_for IS NOT NULL;
CREATE INDEX idx_notification_queue_user_id ON notification_queue(user_id) WHERE deleted_at IS NULL;

-- Notification delivery log indexes
CREATE INDEX idx_notification_delivery_log_user_id ON notification_delivery_log(user_id);
CREATE INDEX idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX idx_notification_delivery_log_queue_item_id ON notification_delivery_log(queue_item_id);
CREATE INDEX idx_notification_delivery_log_template_key ON notification_delivery_log(template_key);
CREATE INDEX idx_notification_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX idx_notification_delivery_log_status ON notification_delivery_log(status);
CREATE INDEX idx_notification_delivery_log_provider ON notification_delivery_log(provider);
CREATE INDEX idx_notification_delivery_log_sent_at ON notification_delivery_log(sent_at);
CREATE INDEX idx_notification_delivery_log_delivered_at ON notification_delivery_log(delivered_at);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at triggers for notification tables
CREATE TRIGGER update_notification_templates_updated_at 
    BEFORE UPDATE ON notification_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at 
    BEFORE UPDATE ON user_notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_queue_updated_at 
    BEFORE UPDATE ON notification_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_delivery_log_updated_at 
    BEFORE UPDATE ON notification_delivery_log 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DEFAULT NOTIFICATION TEMPLATES
-- =============================================================================

-- Insert default notification templates for booking and messaging events
INSERT INTO notification_templates (
    template_key, name, description, category, priority,
    email_subject, email_html_template, email_text_template, in_app_template,
    template_variables, supports_email, supports_in_app, supports_sms
) VALUES

-- Booking notification templates
(
    'booking_request_received', 
    'New Booking Request',
    'Notification sent when a retiree receives a booking request',
    'booking',
    'high',
    'New Booking Request from {{client_name}}',
    '<h2>You have a new booking request!</h2>
     <p>Hi {{retiree_name}},</p>
     <p><strong>{{client_name}}</strong> has requested to book you for <strong>{{service_type}}</strong>.</p>
     <p><strong>Details:</strong></p>
     <ul>
       <li>Date: {{booking_date}}</li>
       <li>Duration: {{duration}}</li>
       <li>Rate: {{rate}}</li>
       <li>Description: {{description}}</li>
     </ul>
     <p><a href="{{booking_url}}" style="background-color:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">View & Respond</a></p>',
    'You have a new booking request from {{client_name}} for {{service_type}} on {{booking_date}}. Rate: {{rate}}. Click to respond: {{booking_url}}',
    'New booking request from {{client_name}} for {{service_type}} on {{booking_date}}',
    '["retiree_name", "client_name", "service_type", "booking_date", "duration", "rate", "description", "booking_url"]',
    true, true, false
),

(
    'booking_request_accepted',
    'Booking Request Accepted',
    'Notification sent when a booking request is accepted',
    'booking',
    'high',
    'Great news! Your booking request was accepted by {{retiree_name}}',
    '<h2>Your booking request was accepted!</h2>
     <p>Hi {{client_name}},</p>
     <p><strong>{{retiree_name}}</strong> has accepted your booking request for <strong>{{service_type}}</strong>.</p>
     <p><strong>Confirmed Details:</strong></p>
     <ul>
       <li>Date: {{booking_date}}</li>
       <li>Duration: {{duration}}</li>
       <li>Rate: {{rate}}</li>
     </ul>
     <p><a href="{{booking_url}}" style="background-color:#28a745;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">View Booking Details</a></p>',
    'Great news! {{retiree_name}} accepted your booking request for {{service_type}} on {{booking_date}}. View details: {{booking_url}}',
    'Your booking with {{retiree_name}} for {{service_type}} was accepted',
    '["client_name", "retiree_name", "service_type", "booking_date", "duration", "rate", "booking_url"]',
    true, true, false
),

(
    'booking_request_rejected',
    'Booking Request Declined',
    'Notification sent when a booking request is rejected',
    'booking',
    'normal',
    'Booking request update from {{retiree_name}}',
    '<h2>Booking Request Update</h2>
     <p>Hi {{client_name}},</p>
     <p><strong>{{retiree_name}}</strong> is unable to accept your booking request for <strong>{{service_type}}</strong> on {{booking_date}}.</p>
     <p>{{rejection_reason}}</p>
     <p><a href="{{browse_url}}" style="background-color:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Browse Other Professionals</a></p>',
    'Unfortunately, {{retiree_name}} cannot accept your booking for {{service_type}} on {{booking_date}}. Browse other professionals: {{browse_url}}',
    'Your booking request with {{retiree_name}} was declined',
    '["client_name", "retiree_name", "service_type", "booking_date", "rejection_reason", "browse_url"]',
    true, true, false
),

-- Message notification templates
(
    'message_received',
    'New Message',
    'Notification sent when a user receives a new message',
    'messaging',
    'normal',
    'New message from {{sender_name}}',
    '<h2>You have a new message</h2>
     <p>Hi {{recipient_name}},</p>
     <p><strong>{{sender_name}}</strong> sent you a message:</p>
     <blockquote style="background-color:#f8f9fa;border-left:4px solid #007bff;padding:15px;margin:15px 0;">
       {{message_preview}}
     </blockquote>
     <p><a href="{{conversation_url}}" style="background-color:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reply</a></p>',
    'New message from {{sender_name}}: {{message_preview}}. Reply: {{conversation_url}}',
    'New message from {{sender_name}}: {{message_preview}}',
    '["recipient_name", "sender_name", "message_preview", "conversation_url"]',
    true, true, true
),

-- System notification templates
(
    'profile_verification_completed',
    'Profile Verification Complete',
    'Notification sent when profile verification is completed',
    'system',
    'normal',
    'Your LegacyLancers profile has been verified!',
    '<h2>Congratulations! Your profile is verified</h2>
     <p>Hi {{user_name}},</p>
     <p>Your LegacyLancers profile has been successfully verified. You can now:</p>
     <ul>
       <li>Receive booking requests from clients</li>
       <li>Apply to gig postings</li>
       <li>Access premium features</li>
     </ul>
     <p><a href="{{profile_url}}" style="background-color:#28a745;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">View Your Profile</a></p>',
    'Congratulations! Your LegacyLancers profile has been verified. You can now receive booking requests and apply to gigs. View profile: {{profile_url}}',
    'Your profile has been verified! You can now receive bookings.',
    '["user_name", "profile_url"]',
    true, true, false
),

(
    'booking_reminder_upcoming',
    'Upcoming Booking Reminder',
    'Reminder notification for upcoming bookings',
    'system',
    'normal',
    'Reminder: Your booking with {{other_party_name}} is tomorrow',
    '<h2>Booking Reminder</h2>
     <p>Hi {{user_name}},</p>
     <p>This is a friendly reminder that you have a booking with <strong>{{other_party_name}}</strong> coming up:</p>
     <ul>
       <li>Service: {{service_type}}</li>
       <li>Date: {{booking_date}}</li>
       <li>Time: {{booking_time}}</li>
       <li>Duration: {{duration}}</li>
     </ul>
     <p><a href="{{booking_url}}" style="background-color:#ffc107;color:black;padding:10px 20px;text-decoration:none;border-radius:5px;">View Booking Details</a></p>',
    'Reminder: Your booking with {{other_party_name}} for {{service_type}} is on {{booking_date}} at {{booking_time}}. Details: {{booking_url}}',
    'Reminder: Booking with {{other_party_name}} tomorrow at {{booking_time}}',
    '["user_name", "other_party_name", "service_type", "booking_date", "booking_time", "duration", "booking_url"]',
    true, true, true
);

-- =============================================================================
-- DEFAULT USER PREFERENCES
-- =============================================================================

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_notification_preferences (
        user_id,
        email_enabled,
        in_app_enabled,
        sms_enabled,
        booking_notifications,
        message_notifications,
        system_notifications,
        marketing_notifications,
        email_digest_frequency
    ) VALUES (
        NEW.id,
        true,
        true,
        false,
        '{"email": true, "in_app": true, "sms": false}',
        '{"email": true, "in_app": true, "sms": false}',
        '{"email": true, "in_app": true, "sms": false}',
        '{"email": false, "in_app": false, "sms": false}',
        'daily'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default preferences when a new user is created
CREATE TRIGGER create_user_notification_preferences_on_user_create
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE notification_templates IS 'Reusable templates for different types of notifications across multiple channels';
COMMENT ON TABLE user_notification_preferences IS 'User preferences for notification delivery channels and timing';
COMMENT ON TABLE notifications IS 'In-app notifications with read/dismiss state tracking';
COMMENT ON TABLE notification_queue IS 'Queue for background processing of notifications with retry logic';
COMMENT ON TABLE notification_delivery_log IS 'Comprehensive logging of notification deliveries across all channels';

-- Column comments for key fields
COMMENT ON COLUMN notification_templates.template_variables IS 'JSON array of variable names that can be used in template rendering';
COMMENT ON COLUMN user_notification_preferences.booking_notifications IS 'JSON object defining which channels are enabled for booking notifications';
COMMENT ON COLUMN notifications.data IS 'Additional metadata for the notification (URLs, entity IDs, custom data)';
COMMENT ON COLUMN notification_queue.channels IS 'JSON array of channels to deliver notification to (email, in_app, sms)';
COMMENT ON COLUMN notification_delivery_log.provider_response IS 'Full response from external service provider for debugging';