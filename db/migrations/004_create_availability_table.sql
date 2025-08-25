-- Migration: Create availability table
-- Description: Creates the availability table for calendar management and time zone support
-- Date: 2025-08-25

CREATE TABLE availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Schedule type and engagement
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('one_time', 'recurring', 'blocked')),
    engagement_type VARCHAR(30) CHECK (engagement_type IN ('freelance', 'consulting', 'project', 'keynote', 'mentoring')),
    
    -- Date and time fields
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for single day availability
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    time_zone VARCHAR(50) NOT NULL DEFAULT 'UTC', -- IANA time zone format (e.g., 'America/New_York')
    
    -- Recurring availability settings
    recurrence_pattern VARCHAR(20) CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly')),
    recurrence_days INTEGER[], -- Array of day numbers: 0=Sunday, 1=Monday, etc.
    recurrence_end_date DATE, -- When the recurring pattern ends
    
    -- Availability status and limits
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked', 'tentative')),
    max_bookings INTEGER DEFAULT 1, -- How many bookings can be made in this slot
    current_bookings INTEGER NOT NULL DEFAULT 0,
    
    -- Duration and buffer settings
    slot_duration_minutes INTEGER, -- For recurring slots, how long each booking can be
    buffer_minutes INTEGER DEFAULT 0, -- Time buffer between bookings
    
    -- Pricing override for specific time slots
    override_rate_per_hour DECIMAL(10,2), -- Override standard rate for this availability
    override_project_rate DECIMAL(10,2), -- Override project rate for this availability
    
    -- Additional metadata
    title VARCHAR(255), -- Optional title for the availability slot
    description TEXT, -- Optional description or notes
    location_type VARCHAR(20) CHECK (location_type IN ('remote', 'in_person', 'hybrid')),
    location_details TEXT, -- Address or meeting details
    
    -- Booking preferences
    require_approval BOOLEAN NOT NULL DEFAULT FALSE,
    auto_confirm BOOLEAN NOT NULL DEFAULT TRUE,
    minimum_notice_hours INTEGER DEFAULT 24, -- Minimum hours before booking can be made
    maximum_advance_days INTEGER DEFAULT 90, -- Maximum days in advance for booking
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- Indexes for performance
CREATE INDEX idx_availability_user_id ON availability(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_date_range ON availability(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_time_range ON availability(start_time, end_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_status ON availability(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_engagement_type ON availability(engagement_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_schedule_type ON availability(schedule_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_time_zone ON availability(time_zone) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_availability_user_date_status ON availability(user_id, start_date, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_availability_date_engagement ON availability(start_date, engagement_type, status) WHERE deleted_at IS NULL;

-- Partial index for recurring availability
CREATE INDEX idx_availability_recurring ON availability(user_id, recurrence_pattern, recurrence_days) 
    WHERE schedule_type = 'recurring' AND deleted_at IS NULL;

-- Update trigger for updated_at
CREATE TRIGGER update_availability_updated_at 
    BEFORE UPDATE ON availability 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Check constraint to ensure end_date is after start_date
ALTER TABLE availability ADD CONSTRAINT chk_availability_date_order 
    CHECK (end_date IS NULL OR end_date >= start_date);

-- Check constraint to ensure end_time is after start_time for same-day availability
ALTER TABLE availability ADD CONSTRAINT chk_availability_time_order 
    CHECK (end_time > start_time OR end_date > start_date);

-- Check constraint to ensure current_bookings doesn't exceed max_bookings
ALTER TABLE availability ADD CONSTRAINT chk_availability_booking_limits 
    CHECK (current_bookings <= COALESCE(max_bookings, 1));

-- Check constraint for recurring pattern requirements
ALTER TABLE availability ADD CONSTRAINT chk_availability_recurring_requirements 
    CHECK (
        (schedule_type != 'recurring') OR 
        (schedule_type = 'recurring' AND recurrence_pattern IS NOT NULL)
    );

-- Comments
COMMENT ON TABLE availability IS 'User availability calendar for scheduling appointments and managing time slots';
COMMENT ON COLUMN availability.user_id IS 'Reference to the user who owns this availability slot';
COMMENT ON COLUMN availability.schedule_type IS 'Type of schedule: one_time for single slots, recurring for repeating patterns, blocked for unavailable time';
COMMENT ON COLUMN availability.engagement_type IS 'Type of engagement this availability is for - can be null for general availability';
COMMENT ON COLUMN availability.time_zone IS 'IANA time zone identifier for proper time handling across regions';
COMMENT ON COLUMN availability.recurrence_days IS 'Array of day numbers for recurring availability (0=Sunday, 1=Monday, etc.)';
COMMENT ON COLUMN availability.max_bookings IS 'Maximum number of concurrent bookings allowed in this slot';
COMMENT ON COLUMN availability.slot_duration_minutes IS 'Duration in minutes for each bookable slot in recurring availability';
COMMENT ON COLUMN availability.buffer_minutes IS 'Buffer time in minutes between consecutive bookings';
COMMENT ON COLUMN availability.minimum_notice_hours IS 'Minimum hours of advance notice required for booking';
COMMENT ON COLUMN availability.maximum_advance_days IS 'Maximum days in advance that bookings can be made';