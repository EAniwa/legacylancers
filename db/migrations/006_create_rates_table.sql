-- Migration: Create rates table  
-- Description: Creates rates table for hourly and project-based pricing by engagement type
-- Date: 2025-08-25

CREATE TABLE rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Engagement and pricing type
    engagement_type VARCHAR(30) NOT NULL CHECK (engagement_type IN ('freelance', 'consulting', 'project', 'keynote', 'mentoring')),
    pricing_model VARCHAR(20) NOT NULL CHECK (pricing_model IN ('hourly', 'daily', 'weekly', 'monthly', 'project', 'flat_fee')),
    
    -- Rate amounts and currency
    base_rate DECIMAL(10,2) NOT NULL, -- Base rate amount
    currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- ISO currency code
    
    -- Hourly rate specifics
    hourly_rate DECIMAL(10,2), -- Hourly rate
    minimum_hours DECIMAL(4,2), -- Minimum billable hours per engagement
    hourly_increment DECIMAL(3,2) DEFAULT 1.0, -- Billing increment (e.g., 0.25 for 15-minute increments)
    
    -- Daily/Weekly/Monthly rates
    daily_rate DECIMAL(10,2),
    weekly_rate DECIMAL(10,2), 
    monthly_rate DECIMAL(10,2),
    
    -- Project-based pricing
    project_min_rate DECIMAL(10,2), -- Minimum project rate
    project_max_rate DECIMAL(10,2), -- Maximum project rate
    project_rate_type VARCHAR(20) CHECK (project_rate_type IN ('fixed', 'range', 'negotiable')),
    
    -- Keynote and speaking fees
    keynote_base_fee DECIMAL(10,2),
    keynote_travel_fee DECIMAL(10,2),
    keynote_virtual_fee DECIMAL(10,2),
    keynote_duration_hours DECIMAL(3,1), -- Duration in hours
    
    -- Mentoring rates
    mentoring_session_rate DECIMAL(8,2), -- Per session rate
    mentoring_monthly_rate DECIMAL(8,2), -- Monthly mentoring rate
    mentoring_session_duration INTEGER, -- Duration in minutes
    
    -- Rate modifiers and premiums
    rush_rate_multiplier DECIMAL(3,2) DEFAULT 1.5, -- Multiplier for rush jobs
    weekend_rate_multiplier DECIMAL(3,2) DEFAULT 1.25, -- Weekend premium
    evening_rate_multiplier DECIMAL(3,2) DEFAULT 1.15, -- Evening hours premium
    holiday_rate_multiplier DECIMAL(3,2) DEFAULT 2.0, -- Holiday premium
    
    -- Geographic and experience modifiers
    remote_rate_discount DECIMAL(3,2) DEFAULT 0.0, -- Discount for remote work (0.0-1.0)
    onsite_rate_premium DECIMAL(3,2) DEFAULT 0.15, -- Premium for on-site work
    international_rate_multiplier DECIMAL(3,2) DEFAULT 1.1, -- International work multiplier
    
    -- Experience and skill premiums
    expertise_level VARCHAR(20) CHECK (expertise_level IN ('junior', 'mid', 'senior', 'expert', 'thought_leader')),
    complexity_premium DECIMAL(3,2) DEFAULT 0.0, -- Premium for complex work
    specialty_premium DECIMAL(3,2) DEFAULT 0.0, -- Premium for specialized skills
    
    -- Payment terms and conditions
    payment_terms VARCHAR(30) DEFAULT 'net_30' CHECK (payment_terms IN ('immediate', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60')),
    requires_upfront_payment BOOLEAN NOT NULL DEFAULT FALSE,
    upfront_payment_percentage DECIMAL(3,0) DEFAULT 0 CHECK (upfront_payment_percentage >= 0 AND upfront_payment_percentage <= 100),
    
    -- Rate validity and scheduling
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE, -- When this rate expires
    is_negotiable BOOLEAN NOT NULL DEFAULT TRUE,
    auto_quote BOOLEAN NOT NULL DEFAULT FALSE, -- Can this rate be used for automatic quotes
    
    -- Availability and capacity settings
    max_hours_per_week DECIMAL(4,1), -- Maximum hours available per week at this rate
    max_projects_concurrent INTEGER, -- Maximum concurrent projects at this rate
    preferred_project_duration VARCHAR(20) CHECK (preferred_project_duration IN ('short', 'medium', 'long', 'ongoing')),
    
    -- Package deals and bulk pricing
    bulk_discount_threshold INTEGER, -- Minimum hours/projects for bulk discount
    bulk_discount_percentage DECIMAL(3,2), -- Bulk discount rate (0.0-1.0)
    package_deal_available BOOLEAN NOT NULL DEFAULT FALSE,
    package_description TEXT,
    
    -- Display and marketing
    display_rate_publicly BOOLEAN NOT NULL DEFAULT TRUE,
    display_rate_range BOOLEAN NOT NULL DEFAULT FALSE, -- Show as range instead of exact amount
    marketing_rate DECIMAL(10,2), -- Rate to display for marketing (may be different from actual)
    rate_description TEXT, -- Description of what's included in this rate
    
    -- Status and approval
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_approval', 'expired')),
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE, -- Does this rate require admin approval
    approved_by_admin UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete support
);

-- Indexes for performance
CREATE INDEX idx_rates_user_id ON rates(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rates_engagement_type ON rates(engagement_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_rates_pricing_model ON rates(pricing_model) WHERE deleted_at IS NULL;
CREATE INDEX idx_rates_status ON rates(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rates_currency ON rates(currency) WHERE deleted_at IS NULL;
CREATE INDEX idx_rates_effective_date ON rates(effective_date) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_rates_user_engagement_active ON rates(user_id, engagement_type, status) 
    WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_rates_engagement_pricing_public ON rates(engagement_type, pricing_model, display_rate_publicly) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_rates_auto_quote ON rates(user_id, engagement_type, auto_quote) 
    WHERE auto_quote = TRUE AND deleted_at IS NULL;

-- Unique constraint to prevent multiple active rates of same type per user
CREATE UNIQUE INDEX idx_rates_user_engagement_pricing_unique ON rates(user_id, engagement_type, pricing_model) 
    WHERE status = 'active' AND deleted_at IS NULL;

-- Index for rate searches by range
CREATE INDEX idx_rates_hourly_range ON rates(engagement_type, hourly_rate) 
    WHERE hourly_rate IS NOT NULL AND status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_rates_project_range ON rates(engagement_type, project_min_rate, project_max_rate) 
    WHERE project_min_rate IS NOT NULL AND status = 'active' AND deleted_at IS NULL;

-- Update trigger for updated_at
CREATE TRIGGER update_rates_updated_at 
    BEFORE UPDATE ON rates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Check constraint to ensure effective_date is before expiry_date
ALTER TABLE rates ADD CONSTRAINT chk_rates_date_order 
    CHECK (expiry_date IS NULL OR expiry_date > effective_date);

-- Check constraint for project rate ranges
ALTER TABLE rates ADD CONSTRAINT chk_rates_project_range 
    CHECK (
        project_min_rate IS NULL OR project_max_rate IS NULL OR 
        project_max_rate >= project_min_rate
    );

-- Check constraint for bulk discount validation
ALTER TABLE rates ADD CONSTRAINT chk_rates_bulk_discount 
    CHECK (
        (bulk_discount_threshold IS NULL AND bulk_discount_percentage IS NULL) OR
        (bulk_discount_threshold IS NOT NULL AND bulk_discount_percentage IS NOT NULL AND 
         bulk_discount_percentage >= 0 AND bulk_discount_percentage <= 1)
    );

-- Check constraint for upfront payment
ALTER TABLE rates ADD CONSTRAINT chk_rates_upfront_payment 
    CHECK (
        (requires_upfront_payment = FALSE AND upfront_payment_percentage = 0) OR
        (requires_upfront_payment = TRUE AND upfront_payment_percentage > 0)
    );

-- Check constraint to ensure at least one rate type is specified
ALTER TABLE rates ADD CONSTRAINT chk_rates_rate_specified 
    CHECK (
        hourly_rate IS NOT NULL OR daily_rate IS NOT NULL OR weekly_rate IS NOT NULL OR 
        monthly_rate IS NOT NULL OR project_min_rate IS NOT NULL OR keynote_base_fee IS NOT NULL OR 
        mentoring_session_rate IS NOT NULL OR base_rate IS NOT NULL
    );

-- Comments
COMMENT ON TABLE rates IS 'User pricing rates for different engagement types and pricing models';
COMMENT ON COLUMN rates.user_id IS 'Reference to the user who owns these rates';
COMMENT ON COLUMN rates.engagement_type IS 'Type of engagement this rate applies to';
COMMENT ON COLUMN rates.pricing_model IS 'Pricing model (hourly, project, etc.)';
COMMENT ON COLUMN rates.base_rate IS 'Base rate amount - serves as fallback when specific rates not set';
COMMENT ON COLUMN rates.hourly_increment IS 'Billing increment for hourly work (e.g., 0.25 for 15-min increments)';
COMMENT ON COLUMN rates.rush_rate_multiplier IS 'Multiplier for rush jobs (e.g., 1.5 = 50% premium)';
COMMENT ON COLUMN rates.remote_rate_discount IS 'Discount for remote work (0.0-1.0)';
COMMENT ON COLUMN rates.upfront_payment_percentage IS 'Percentage of payment required upfront (0-100)';
COMMENT ON COLUMN rates.auto_quote IS 'Whether this rate can be used for automatic quote generation';
COMMENT ON COLUMN rates.display_rate_publicly IS 'Whether to display this rate on public profile';
COMMENT ON COLUMN rates.marketing_rate IS 'Rate to display for marketing purposes (may differ from actual rate)';