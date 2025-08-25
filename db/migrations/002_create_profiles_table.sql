-- Migration: Create profiles table
-- Description: Creates the retiree profiles table with experience, availability, and engagement details
-- Date: 2025-08-25

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Profile Display Information
    display_name VARCHAR(150), -- Optional display name different from legal name
    headline VARCHAR(200), -- Professional headline/title
    bio TEXT, -- Professional biography/summary
    profile_photo_url VARCHAR(500), -- URL to profile photo
    cover_photo_url VARCHAR(500), -- URL to cover/banner photo
    
    -- Professional Details
    years_of_experience INTEGER,
    industry VARCHAR(100),
    previous_company VARCHAR(200),
    previous_title VARCHAR(200),
    linkedin_url VARCHAR(300),
    portfolio_url VARCHAR(300),
    resume_url VARCHAR(500),
    
    -- Availability & Engagement Preferences
    availability_status VARCHAR(20) NOT NULL DEFAULT 'available' 
        CHECK (availability_status IN ('available', 'busy', 'unavailable', 'retired')),
    timezone VARCHAR(50), -- e.g., 'America/New_York'
    
    -- Engagement Types (JSON array for multiple selections)
    engagement_types JSONB NOT NULL DEFAULT '[]', -- ['freelance', 'consulting', 'project', 'keynote', 'mentoring']
    
    -- Rates and Pricing
    hourly_rate_min DECIMAL(10,2), -- Minimum hourly rate in USD
    hourly_rate_max DECIMAL(10,2), -- Maximum hourly rate in USD
    project_rate_min DECIMAL(10,2), -- Minimum project rate in USD
    project_rate_max DECIMAL(10,2), -- Maximum project rate in USD
    keynote_rate DECIMAL(10,2), -- Keynote speaking rate
    mentoring_rate DECIMAL(10,2), -- Mentoring rate
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Verification and Trust
    profile_completeness_score INTEGER DEFAULT 0 CHECK (profile_completeness_score >= 0 AND profile_completeness_score <= 100),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified' 
        CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    linkedin_verified BOOLEAN DEFAULT FALSE,
    background_check_status VARCHAR(20) DEFAULT 'not_required'
        CHECK (background_check_status IN ('not_required', 'pending', 'completed', 'failed')),
    
    -- Public Profile Settings
    is_profile_public BOOLEAN NOT NULL DEFAULT FALSE,
    profile_slug VARCHAR(100) UNIQUE, -- URL-friendly profile identifier
    show_hourly_rates BOOLEAN DEFAULT TRUE,
    show_project_rates BOOLEAN DEFAULT TRUE,
    
    -- Search and Discovery
    searchable BOOLEAN NOT NULL DEFAULT TRUE,
    featured BOOLEAN NOT NULL DEFAULT FALSE, -- For featured profiles
    
    -- Statistics
    total_engagements INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2), -- 1.00 to 5.00
    total_reviews INTEGER DEFAULT 0,
    
    -- GDPR and Privacy
    data_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    public_profile_consent BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- Indexes for performance and search
CREATE INDEX idx_profiles_user_id ON profiles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_availability ON profiles(availability_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_verification ON profiles(verification_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_public ON profiles(is_profile_public) WHERE deleted_at IS NULL AND is_profile_public = TRUE;
CREATE INDEX idx_profiles_searchable ON profiles(searchable) WHERE deleted_at IS NULL AND searchable = TRUE;
CREATE INDEX idx_profiles_featured ON profiles(featured) WHERE deleted_at IS NULL AND featured = TRUE;
CREATE INDEX idx_profiles_industry ON profiles(industry) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_slug ON profiles(profile_slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_completeness ON profiles(profile_completeness_score) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_rating ON profiles(average_rating) WHERE deleted_at IS NULL;

-- GIN index for JSON engagement_types for efficient querying
CREATE INDEX idx_profiles_engagement_types ON profiles USING GIN (engagement_types) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_profiles_search_main ON profiles(availability_status, verification_status, is_profile_public, searchable) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_rates ON profiles(hourly_rate_min, hourly_rate_max) 
    WHERE deleted_at IS NULL AND (hourly_rate_min IS NOT NULL OR hourly_rate_max IS NOT NULL);

-- Update trigger for updated_at
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate profile slug
CREATE OR REPLACE FUNCTION generate_profile_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from display_name or user's first/last name
    IF NEW.display_name IS NOT NULL THEN
        base_slug := lower(regexp_replace(NEW.display_name, '[^a-zA-Z0-9]+', '-', 'g'));
    ELSE
        -- Get user's name from users table
        SELECT lower(regexp_replace(first_name || '-' || last_name, '[^a-zA-Z0-9]+', '-', 'g'))
        INTO base_slug
        FROM users 
        WHERE id = NEW.user_id;
    END IF;
    
    -- Remove leading/trailing hyphens
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM profiles WHERE profile_slug = final_slug AND id != NEW.id AND deleted_at IS NULL) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.profile_slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate profile slug
CREATE TRIGGER generate_profile_slug_trigger
    BEFORE INSERT OR UPDATE OF display_name ON profiles
    FOR EACH ROW 
    WHEN (NEW.profile_slug IS NULL OR OLD.display_name IS DISTINCT FROM NEW.display_name)
    EXECUTE FUNCTION generate_profile_slug();

-- Function to calculate profile completeness
CREATE OR REPLACE FUNCTION calculate_profile_completeness()
RETURNS TRIGGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Basic information (40 points)
    IF NEW.bio IS NOT NULL AND length(trim(NEW.bio)) > 50 THEN score := score + 15; END IF;
    IF NEW.headline IS NOT NULL AND length(trim(NEW.headline)) > 10 THEN score := score + 10; END IF;
    IF NEW.profile_photo_url IS NOT NULL THEN score := score + 15; END IF;
    
    -- Professional details (30 points)
    IF NEW.years_of_experience IS NOT NULL THEN score := score + 10; END IF;
    IF NEW.industry IS NOT NULL THEN score := score + 10; END IF;
    IF NEW.previous_company IS NOT NULL AND NEW.previous_title IS NOT NULL THEN score := score + 10; END IF;
    
    -- Engagement preferences (20 points)
    IF NEW.engagement_types IS NOT NULL AND jsonb_array_length(NEW.engagement_types) > 0 THEN score := score + 10; END IF;
    IF (NEW.hourly_rate_min IS NOT NULL OR NEW.project_rate_min IS NOT NULL) THEN score := score + 10; END IF;
    
    -- Verification and links (10 points)
    IF NEW.linkedin_url IS NOT NULL THEN score := score + 5; END IF;
    IF NEW.linkedin_verified = TRUE THEN score := score + 5; END IF;
    
    NEW.profile_completeness_score := score;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate completeness score
CREATE TRIGGER calculate_profile_completeness_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW 
    EXECUTE FUNCTION calculate_profile_completeness();

-- Comments
COMMENT ON TABLE profiles IS 'Retiree profiles with professional details, availability, and engagement preferences';
COMMENT ON COLUMN profiles.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN profiles.engagement_types IS 'JSON array of engagement types: freelance, consulting, project, keynote, mentoring';
COMMENT ON COLUMN profiles.profile_completeness_score IS 'Auto-calculated score 0-100 based on profile completeness';
COMMENT ON COLUMN profiles.profile_slug IS 'URL-friendly unique identifier for public profile pages';
COMMENT ON COLUMN profiles.verification_status IS 'Profile verification status for trust and credibility';
COMMENT ON COLUMN profiles.deleted_at IS 'Soft delete timestamp for GDPR compliance and data recovery';