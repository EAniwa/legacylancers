-- Migration 008: Calendar Events Table
-- Create calendar events table to link calendar events with bookings

CREATE TYPE event_source AS ENUM ('booking', 'availability', 'manual', 'external');
CREATE TYPE event_visibility AS ENUM ('public', 'private', 'internal');

CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Event details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    
    -- Time information
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    time_zone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    
    -- Event properties
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_pattern JSONB, -- {type: 'daily'|'weekly'|'monthly', interval: number, endDate?: string, count?: number}
    
    -- Integration fields
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    availability_id INTEGER REFERENCES availability(id) ON DELETE SET NULL,
    
    -- Event metadata
    source event_source NOT NULL DEFAULT 'manual',
    visibility event_visibility NOT NULL DEFAULT 'private',
    external_event_id VARCHAR(255), -- For external calendar sync
    external_calendar_id VARCHAR(255), -- External calendar identifier
    
    -- Meeting information
    meeting_url VARCHAR(500),
    meeting_id VARCHAR(255),
    meeting_password VARCHAR(100),
    
    -- Status and notifications
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed', -- confirmed, tentative, cancelled
    reminder_minutes INTEGER[], -- Array of minutes before event for reminders
    attendees JSONB, -- Array of attendee objects {email, name, status, role}
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_booking_id ON calendar_events(booking_id);
CREATE INDEX idx_calendar_events_availability_id ON calendar_events(availability_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_time_range ON calendar_events(start_time, end_time);
CREATE INDEX idx_calendar_events_source ON calendar_events(source);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_external ON calendar_events(external_event_id, external_calendar_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Add constraints
ALTER TABLE calendar_events ADD CONSTRAINT check_end_after_start 
    CHECK (end_time > start_time);

ALTER TABLE calendar_events ADD CONSTRAINT check_valid_time_zone 
    CHECK (time_zone ~ '^[A-Za-z_]+/[A-Za-z_]+$|^UTC$');

-- Comments
COMMENT ON TABLE calendar_events IS 'Calendar events linked to bookings and availability slots';
COMMENT ON COLUMN calendar_events.booking_id IS 'Links calendar event to a booking (nullable)';
COMMENT ON COLUMN calendar_events.availability_id IS 'Links calendar event to availability slot (nullable)';
COMMENT ON COLUMN calendar_events.source IS 'How this calendar event was created';
COMMENT ON COLUMN calendar_events.external_event_id IS 'ID from external calendar system (Google, Outlook, etc.)';
COMMENT ON COLUMN calendar_events.attendees IS 'JSON array of attendee information';
COMMENT ON COLUMN calendar_events.recurring_pattern IS 'JSON object defining recurring pattern for recurring events';