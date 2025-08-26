-- Migration: Create verification table
-- Description: Creates verification table for tracking LinkedIn verification, KYC status, and verification badges
-- Date: 2025-08-25

CREATE TABLE verification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Verification type and category
    verification_type VARCHAR(30) NOT NULL CHECK (verification_type IN (
        'linkedin', 'identity', 'education', 'employment', 'skills', 'portfolio', 'references', 'background_check'
    )),
    verification_category VARCHAR(20) NOT NULL CHECK (verification_category IN ('professional', 'identity', 'trust_safety')),
    
    -- Verification status and timing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'verified', 'rejected', 'expired')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- For verifications that expire
    
    -- Verification data and metadata
    external_id VARCHAR(255), -- ID from external verification service (e.g., LinkedIn user ID)
    external_url VARCHAR(500), -- URL to external profile or verification source
    verification_data JSONB, -- Flexible storage for verification-specific data
    
    -- LinkedIn-specific fields
    linkedin_profile_url VARCHAR(500),
    linkedin_public_profile_url VARCHAR(500),
    linkedin_vanity_name VARCHAR(100),
    linkedin_headline TEXT,
    linkedin_industry VARCHAR(100),
    linkedin_location VARCHAR(200),
    linkedin_connections_count INTEGER,
    linkedin_verified BOOLEAN DEFAULT FALSE,
    
    -- Identity verification fields
    identity_document_type VARCHAR(30) CHECK (identity_document_type IN ('passport', 'drivers_license', 'national_id', 'other')),
    identity_document_number_hash VARCHAR(64), -- Hashed for privacy
    identity_full_name VARCHAR(255),
    identity_date_of_birth DATE,
    identity_address_verified BOOLEAN DEFAULT FALSE,
    
    -- Education verification
    education_institution VARCHAR(255),
    education_degree VARCHAR(255),
    education_field VARCHAR(255),
    education_graduation_year INTEGER,
    education_verified_by VARCHAR(100), -- Verification service or method
    
    -- Employment verification
    employment_company VARCHAR(255),
    employment_title VARCHAR(255),
    employment_start_date DATE,
    employment_end_date DATE,
    employment_verified_by VARCHAR(100),
    employment_reference_email VARCHAR(255),
    
    -- Skills and portfolio verification
    skills_verified JSONB, -- Array of verified skills with details
    portfolio_items_verified JSONB, -- Array of verified portfolio items
    
    -- References and testimonials
    references_count INTEGER DEFAULT 0,
    average_reference_rating DECIMAL(3,2), -- Average rating from references
    
    -- Background check fields
    background_check_provider VARCHAR(100),
    background_check_report_id VARCHAR(255),
    background_check_status VARCHAR(30) CHECK (background_check_status IN ('clear', 'flags', 'rejected', 'pending')),
    background_check_notes TEXT,
    
    -- Badge and display settings
    badge_level VARCHAR(20) CHECK (badge_level IN ('basic', 'verified', 'premium', 'expert')),
    display_publicly BOOLEAN NOT NULL DEFAULT TRUE,
    display_on_profile BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Verification confidence and scoring
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
    verification_method VARCHAR(50), -- How this verification was completed
    
    -- Admin and moderation
    verified_by_admin UUID REFERENCES users(id), -- Admin who approved verification
    rejection_reason TEXT,
    notes TEXT, -- Internal notes for admins
    requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- Indexes for performance
CREATE INDEX idx_verification_user_id ON verification(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_type ON verification(verification_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_status ON verification(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_category ON verification(verification_category) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_badge_level ON verification(badge_level) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_verification_user_type_status ON verification(user_id, verification_type, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_type_status_public ON verification(verification_type, status, display_publicly) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_linkedin ON verification(user_id, linkedin_verified) WHERE verification_type = 'linkedin' AND deleted_at IS NULL;

-- Unique constraint to prevent duplicate verifications of the same type per user
CREATE UNIQUE INDEX idx_verification_user_type_unique ON verification(user_id, verification_type) 
    WHERE status IN ('verified', 'in_progress', 'pending') AND deleted_at IS NULL;

-- Index for LinkedIn external IDs
CREATE INDEX idx_verification_linkedin_external ON verification(external_id) 
    WHERE verification_type = 'linkedin' AND deleted_at IS NULL;

-- Index for background checks
CREATE INDEX idx_verification_background_check ON verification(background_check_provider, background_check_status) 
    WHERE verification_type = 'background_check' AND deleted_at IS NULL;

-- Update trigger for updated_at
CREATE TRIGGER update_verification_updated_at 
    BEFORE UPDATE ON verification 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Check constraint to ensure verified_at is set when status is verified
ALTER TABLE verification ADD CONSTRAINT chk_verification_verified_at 
    CHECK (status != 'verified' OR verified_at IS NOT NULL);

-- Check constraint to ensure submitted_at is set when status is not pending
ALTER TABLE verification ADD CONSTRAINT chk_verification_submitted_at 
    CHECK (status = 'pending' OR submitted_at IS NOT NULL);

-- Check constraint for LinkedIn verification requirements
ALTER TABLE verification ADD CONSTRAINT chk_verification_linkedin_requirements 
    CHECK (
        verification_type != 'linkedin' OR 
        (verification_type = 'linkedin' AND linkedin_profile_url IS NOT NULL)
    );

-- Check constraint for identity verification requirements
ALTER TABLE verification ADD CONSTRAINT chk_verification_identity_requirements 
    CHECK (
        verification_type != 'identity' OR 
        (verification_type = 'identity' AND identity_document_type IS NOT NULL AND identity_full_name IS NOT NULL)
    );

-- Comments
COMMENT ON TABLE verification IS 'User verification tracking for LinkedIn, identity, education, employment, and other trust signals';
COMMENT ON COLUMN verification.user_id IS 'Reference to the user being verified';
COMMENT ON COLUMN verification.verification_type IS 'Type of verification being performed';
COMMENT ON COLUMN verification.verification_category IS 'Category of verification for grouping and filtering';
COMMENT ON COLUMN verification.verification_data IS 'JSONB field for storing verification-specific data and metadata';
COMMENT ON COLUMN verification.linkedin_profile_url IS 'Full LinkedIn profile URL for LinkedIn verification';
COMMENT ON COLUMN verification.identity_document_number_hash IS 'Hashed identity document number for privacy compliance';
COMMENT ON COLUMN verification.confidence_score IS 'Confidence level of the verification (0-100)';
COMMENT ON COLUMN verification.trust_score IS 'Overall trust score based on verification (0-100)';
COMMENT ON COLUMN verification.badge_level IS 'Badge level to display based on verification completeness';
COMMENT ON COLUMN verification.requires_manual_review IS 'Flag indicating if manual admin review is required';