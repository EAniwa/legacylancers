-- LegacyLancers Database Schema (Core Tables - Stream 1)
-- Generated: 2025-08-25
-- Description: Core database schema for users, profiles, and skills management
-- 
-- This file contains the consolidated schema for the core user management,
-- profile creation, and skills taxonomy functionality.
-- 
-- Dependencies: PostgreSQL 12+ with uuid-ossp extension

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
-- Core users table for authentication and basic user information

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255), -- NULL for OAuth-only users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    
    -- OAuth/Social Login fields
    oauth_provider VARCHAR(50), -- 'linkedin', 'google', etc.
    oauth_id VARCHAR(255),
    
    -- Verification and KYC
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- GDPR Compliance
    privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    data_retention_consent BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================
-- Retiree profiles with professional details, availability, and engagement preferences

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

-- =============================================================================
-- SKILLS TAXONOMY TABLES
-- =============================================================================

-- Skills Categories Table (Top-level categorization)
CREATE TABLE skill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_name VARCHAR(50), -- For UI icons
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Skills Table (Individual skills within categories)
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Skill metadata
    skill_level_required VARCHAR(20) DEFAULT 'any' 
        CHECK (skill_level_required IN ('any', 'beginner', 'intermediate', 'advanced', 'expert')),
    is_trending BOOLEAN NOT NULL DEFAULT FALSE,
    demand_score INTEGER DEFAULT 0 CHECK (demand_score >= 0 AND demand_score <= 100), -- Market demand indicator
    
    -- Hierarchy support for sub-skills
    parent_skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
    
    -- Usage statistics
    profile_count INTEGER DEFAULT 0, -- Number of profiles with this skill
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    requires_verification BOOLEAN NOT NULL DEFAULT FALSE, -- Some skills may need verification
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Profile Skills Junction Table (Many-to-many relationship)
CREATE TABLE profile_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    
    -- Skill proficiency and experience
    proficiency_level VARCHAR(20) NOT NULL DEFAULT 'intermediate'
        CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    years_of_experience INTEGER CHECK (years_of_experience >= 0 AND years_of_experience <= 100),
    
    -- Endorsements and verification
    is_primary_skill BOOLEAN NOT NULL DEFAULT FALSE, -- Top skills for the profile
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES users(id), -- Who verified this skill
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50), -- 'linkedin', 'certification', 'peer_review', etc.
    
    -- Evidence and documentation
    certification_url VARCHAR(500), -- Link to certificate or proof
    portfolio_examples TEXT[], -- Array of URLs or descriptions
    notes TEXT, -- Additional context about the skill
    
    -- Display preferences
    display_on_profile BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0, -- For ordering skills on profile
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- INDEXES AND CONSTRAINTS
-- =============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_kyc_status ON users(kyc_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE UNIQUE INDEX idx_users_oauth_unique ON users(oauth_provider, oauth_id) 
    WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL AND deleted_at IS NULL;

-- Profiles table indexes
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
CREATE INDEX idx_profiles_engagement_types ON profiles USING GIN (engagement_types) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_search_main ON profiles(availability_status, verification_status, is_profile_public, searchable) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_rates ON profiles(hourly_rate_min, hourly_rate_max) 
    WHERE deleted_at IS NULL AND (hourly_rate_min IS NOT NULL OR hourly_rate_max IS NOT NULL);

-- Skills tables indexes
CREATE INDEX idx_skill_categories_active ON skill_categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_skill_categories_sort ON skill_categories(sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_skill_categories_slug ON skill_categories(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_category ON skills(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_active ON skills(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_trending ON skills(is_trending) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_parent ON skills(parent_skill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_demand ON skills(demand_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_profile_count ON skills(profile_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_slug ON skills(slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_skills_category_name_unique ON skills(category_id, lower(name)) 
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_skills_category_slug_unique ON skills(category_id, slug) 
    WHERE deleted_at IS NULL;

-- Profile skills indexes
CREATE INDEX idx_profile_skills_profile ON profile_skills(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_skill ON profile_skills(skill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_proficiency ON profile_skills(proficiency_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_primary ON profile_skills(is_primary_skill) WHERE deleted_at IS NULL AND is_primary_skill = TRUE;
CREATE INDEX idx_profile_skills_verified ON profile_skills(is_verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_display ON profile_skills(display_on_profile, sort_order) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_profile_skills_unique ON profile_skills(profile_id, skill_id) 
    WHERE deleted_at IS NULL;

-- =============================================================================
-- TRIGGERS AND FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated_at triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_categories_updated_at 
    BEFORE UPDATE ON skill_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at 
    BEFORE UPDATE ON skills 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_skills_updated_at 
    BEFORE UPDATE ON profile_skills 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA
-- =============================================================================

-- Insert initial skill categories
INSERT INTO skill_categories (name, description, sort_order) VALUES
('Technology', 'Software development, IT, and digital skills', 1),
('Business Strategy', 'Strategic planning, operations, and management', 2),
('Finance & Accounting', 'Financial planning, accounting, and analysis', 3),
('Marketing & Sales', 'Marketing strategy, sales, and customer relations', 4),
('Human Resources', 'HR management, recruiting, and organizational development', 5),
('Consulting', 'Advisory services and specialized consulting', 6),
('Education & Training', 'Teaching, training, and knowledge transfer', 7),
('Legal & Compliance', 'Legal expertise and regulatory compliance', 8),
('Healthcare', 'Medical and healthcare-related expertise', 9),
('Engineering', 'Various engineering disciplines', 10),
('Creative & Design', 'Design, creative, and artistic skills', 11),
('Project Management', 'Project and program management expertise', 12);

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE users IS 'Core users table for authentication and basic user information';
COMMENT ON TABLE profiles IS 'Retiree profiles with professional details, availability, and engagement preferences';
COMMENT ON TABLE skill_categories IS 'Top-level categorization of skills for organization and filtering';
COMMENT ON TABLE skills IS 'Individual skills within categories, supports hierarchical relationships';
COMMENT ON TABLE profile_skills IS 'Junction table linking profiles to skills with proficiency and verification';

-- Column comments for key fields
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp for GDPR compliance and data recovery';
COMMENT ON COLUMN profiles.engagement_types IS 'JSON array of engagement types: freelance, consulting, project, keynote, mentoring';
COMMENT ON COLUMN profiles.profile_completeness_score IS 'Auto-calculated score 0-100 based on profile completeness';
COMMENT ON COLUMN skills.parent_skill_id IS 'Self-referencing foreign key for skill hierarchies (e.g., Python -> Programming)';
COMMENT ON COLUMN profile_skills.is_primary_skill IS 'Indicates if this is one of the profile top/featured skills';