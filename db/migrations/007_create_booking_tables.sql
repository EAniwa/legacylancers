-- Booking System Database Schema
-- Migration: 007_create_booking_tables.sql
-- Description: Create tables for booking system with state machine workflow
-- Dependencies: Users and Profiles tables (migrations 001-002)

-- =============================================================================
-- BOOKINGS TABLE
-- =============================================================================
-- Core booking table with state machine management

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relationship fields
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    retiree_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    retiree_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Booking basic information
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    service_category VARCHAR(100),
    engagement_type VARCHAR(50) NOT NULL DEFAULT 'freelance' 
        CHECK (engagement_type IN ('freelance', 'consulting', 'project', 'keynote', 'mentoring')),
    
    -- State management
    status VARCHAR(20) NOT NULL DEFAULT 'request' 
        CHECK (status IN ('request', 'pending', 'accepted', 'rejected', 'active', 'delivered', 'completed', 'cancelled')),
    
    -- Pricing information
    proposed_rate DECIMAL(10,2),
    proposed_rate_type VARCHAR(20) DEFAULT 'hourly' 
        CHECK (proposed_rate_type IN ('hourly', 'project', 'daily', 'weekly')),
    agreed_rate DECIMAL(10,2),
    agreed_rate_type VARCHAR(20),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Scheduling information
    start_date DATE,
    end_date DATE,
    estimated_hours INTEGER,
    flexible_timing BOOLEAN NOT NULL DEFAULT FALSE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Delivery and completion
    delivery_date DATE,
    completion_date DATE,
    
    -- Messages and communication
    client_message TEXT, -- Initial message from client
    retiree_response TEXT, -- Response from retiree
    rejection_reason TEXT, -- Reason if rejected
    cancellation_reason TEXT, -- Reason if cancelled
    
    -- Metadata
    urgency_level VARCHAR(20) DEFAULT 'normal' 
        CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent')),
    remote_work BOOLEAN NOT NULL DEFAULT TRUE,
    location VARCHAR(200), -- If in-person work required
    
    -- State transition tracking
    status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status_changed_by UUID REFERENCES users(id),
    
    -- Ratings and feedback (filled after completion)
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),
    retiree_rating INTEGER CHECK (retiree_rating >= 1 AND retiree_rating <= 5),
    client_feedback TEXT,
    retiree_feedback TEXT,
    
    -- Payment tracking (for future integration)
    payment_status VARCHAR(20) DEFAULT 'pending' 
        CHECK (payment_status IN ('pending', 'authorized', 'captured', 'refunded', 'failed')),
    payment_reference VARCHAR(200),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- =============================================================================
-- BOOKING REQUIREMENTS TABLE
-- =============================================================================
-- Detailed requirements and specifications for the booking

CREATE TABLE booking_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Requirement details
    requirement_type VARCHAR(50) NOT NULL 
        CHECK (requirement_type IN ('skill', 'experience', 'certification', 'tool', 'deliverable', 'other')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- 0 = highest priority
    
    -- Skill-specific fields
    skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
    required_proficiency VARCHAR(20) 
        CHECK (required_proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
    min_years_experience INTEGER,
    
    -- Deliverable-specific fields
    deliverable_format VARCHAR(100), -- e.g., 'document', 'presentation', 'code', 'video'
    expected_quantity INTEGER DEFAULT 1,
    
    -- Status
    is_met BOOLEAN DEFAULT FALSE,
    met_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    verification_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- BOOKING HISTORY TABLE
-- =============================================================================
-- Track all state changes and important events in booking lifecycle

CREATE TABLE booking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- Change tracking
    event_type VARCHAR(50) NOT NULL 
        CHECK (event_type IN ('status_change', 'message', 'rate_change', 'schedule_change', 'requirement_change', 'payment_event')),
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    
    -- Event details
    event_title VARCHAR(200) NOT NULL,
    event_description TEXT,
    
    -- Actor information
    actor_id UUID NOT NULL REFERENCES users(id),
    actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('client', 'retiree', 'system', 'admin')),
    
    -- Additional data
    metadata JSONB DEFAULT '{}', -- Store additional event data
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- BOOKING ATTACHMENTS TABLE
-- =============================================================================
-- File attachments for bookings (briefs, deliverables, contracts, etc.)

CREATE TABLE booking_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    
    -- File information
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL, -- Size in bytes
    mime_type VARCHAR(100) NOT NULL,
    
    -- Attachment metadata
    attachment_type VARCHAR(50) NOT NULL 
        CHECK (attachment_type IN ('brief', 'reference', 'deliverable', 'contract', 'invoice', 'other')),
    title VARCHAR(200),
    description TEXT,
    
    -- Access control
    uploaded_by UUID NOT NULL REFERENCES users(id),
    is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
    is_retiree_visible BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- INDEXES AND CONSTRAINTS
-- =============================================================================

-- Bookings table indexes
CREATE INDEX idx_bookings_client ON bookings(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_retiree ON bookings(retiree_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_status ON bookings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_engagement_type ON bookings(engagement_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_service_category ON bookings(service_category) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_dates ON bookings(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_created_at ON bookings(created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_status_changed_at ON bookings(status_changed_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_urgency ON bookings(urgency_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_bookings_client_status ON bookings(client_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_retiree_status ON bookings(retiree_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_active_dates ON bookings(status, start_date, end_date) 
    WHERE deleted_at IS NULL AND status IN ('accepted', 'active');

-- Booking requirements indexes
CREATE INDEX idx_booking_requirements_booking ON booking_requirements(booking_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_requirements_type ON booking_requirements(requirement_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_requirements_skill ON booking_requirements(skill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_requirements_mandatory ON booking_requirements(is_mandatory) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_requirements_priority ON booking_requirements(priority) WHERE deleted_at IS NULL;

-- Booking history indexes
CREATE INDEX idx_booking_history_booking ON booking_history(booking_id);
CREATE INDEX idx_booking_history_event_type ON booking_history(event_type);
CREATE INDEX idx_booking_history_actor ON booking_history(actor_id);
CREATE INDEX idx_booking_history_created_at ON booking_history(created_at DESC);

-- Composite index for history queries
CREATE INDEX idx_booking_history_booking_date ON booking_history(booking_id, created_at DESC);

-- Booking attachments indexes
CREATE INDEX idx_booking_attachments_booking ON booking_attachments(booking_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_attachments_type ON booking_attachments(attachment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_attachments_uploader ON booking_attachments(uploaded_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_attachments_active ON booking_attachments(is_active) WHERE deleted_at IS NULL;

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Updated_at triggers for booking tables
CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON bookings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_requirements_updated_at 
    BEFORE UPDATE ON booking_requirements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_history_updated_at 
    BEFORE UPDATE ON booking_history 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_attachments_updated_at 
    BEFORE UPDATE ON booking_attachments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update booking status timestamp
CREATE OR REPLACE FUNCTION update_booking_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_changed_at = CURRENT_TIMESTAMP;
        
        -- Set status_changed_by if not explicitly set
        IF NEW.status_changed_by IS NULL THEN
            NEW.status_changed_by = NEW.client_id; -- Default to client, should be overridden in application
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for booking status changes
CREATE TRIGGER update_booking_status_timestamp 
    BEFORE UPDATE ON bookings 
    FOR EACH ROW EXECUTE FUNCTION update_booking_status_timestamp();

-- Function to automatically create booking history entries on status change
CREATE OR REPLACE FUNCTION create_booking_history_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create history entry if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO booking_history (
            booking_id,
            event_type,
            from_status,
            to_status,
            event_title,
            event_description,
            actor_id,
            actor_role
        ) VALUES (
            NEW.id,
            'status_change',
            OLD.status,
            NEW.status,
            'Booking status changed from ' || OLD.status || ' to ' || NEW.status,
            CASE 
                WHEN NEW.status = 'rejected' THEN NEW.rejection_reason
                WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason
                ELSE 'Status automatically updated'
            END,
            COALESCE(NEW.status_changed_by, NEW.client_id),
            CASE 
                WHEN NEW.status_changed_by = NEW.client_id THEN 'client'
                WHEN NEW.status_changed_by = NEW.retiree_id THEN 'retiree'
                ELSE 'system'
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for automatic booking history creation
CREATE TRIGGER create_booking_history_on_status_change 
    AFTER UPDATE ON bookings 
    FOR EACH ROW EXECUTE FUNCTION create_booking_history_entry();

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE bookings IS 'Core booking table with state machine workflow management';
COMMENT ON TABLE booking_requirements IS 'Detailed requirements and specifications for each booking';
COMMENT ON TABLE booking_history IS 'Audit trail of all booking state changes and events';
COMMENT ON TABLE booking_attachments IS 'File attachments for bookings (briefs, deliverables, contracts)';

-- Key column comments
COMMENT ON COLUMN bookings.status IS 'Booking state: request -> pending -> accepted/rejected -> active -> delivered -> completed';
COMMENT ON COLUMN bookings.engagement_type IS 'Type of engagement: freelance, consulting, project, keynote, mentoring';
COMMENT ON COLUMN bookings.status_changed_at IS 'Timestamp when status was last changed, updated automatically';
COMMENT ON COLUMN bookings.flexible_timing IS 'Whether the booking has flexible start/end dates';
COMMENT ON COLUMN booking_requirements.requirement_type IS 'Type of requirement: skill, experience, certification, tool, deliverable, other';
COMMENT ON COLUMN booking_requirements.is_mandatory IS 'Whether this requirement is mandatory for the booking';
COMMENT ON COLUMN booking_history.event_type IS 'Type of event: status_change, message, rate_change, schedule_change, requirement_change, payment_event';
COMMENT ON COLUMN booking_history.metadata IS 'Additional event data stored as JSON';