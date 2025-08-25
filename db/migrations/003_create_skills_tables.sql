-- Migration: Create skills tables
-- Description: Creates skills taxonomy and profile-skills junction tables
-- Date: 2025-08-25

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

-- Indexes for skill_categories
CREATE INDEX idx_skill_categories_active ON skill_categories(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_skill_categories_sort ON skill_categories(sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_skill_categories_slug ON skill_categories(slug) WHERE deleted_at IS NULL;

-- Indexes for skills
CREATE INDEX idx_skills_category ON skills(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_active ON skills(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_trending ON skills(is_trending) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_parent ON skills(parent_skill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_demand ON skills(demand_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_profile_count ON skills(profile_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_slug ON skills(slug) WHERE deleted_at IS NULL;

-- Unique constraint for skills within category
CREATE UNIQUE INDEX idx_skills_category_name_unique ON skills(category_id, lower(name)) 
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_skills_category_slug_unique ON skills(category_id, slug) 
    WHERE deleted_at IS NULL;

-- Indexes for profile_skills
CREATE INDEX idx_profile_skills_profile ON profile_skills(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_skill ON profile_skills(skill_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_proficiency ON profile_skills(proficiency_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_primary ON profile_skills(is_primary_skill) WHERE deleted_at IS NULL AND is_primary_skill = TRUE;
CREATE INDEX idx_profile_skills_verified ON profile_skills(is_verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_skills_display ON profile_skills(display_on_profile, sort_order) WHERE deleted_at IS NULL;

-- Unique constraint to prevent duplicate profile-skill combinations
CREATE UNIQUE INDEX idx_profile_skills_unique ON profile_skills(profile_id, skill_id) 
    WHERE deleted_at IS NULL;

-- Update triggers for updated_at
CREATE TRIGGER update_skill_categories_updated_at 
    BEFORE UPDATE ON skill_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at 
    BEFORE UPDATE ON skills 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_skills_updated_at 
    BEFORE UPDATE ON profile_skills 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update skill profile counts
CREATE OR REPLACE FUNCTION update_skill_profile_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE skills 
        SET profile_count = profile_count + 1 
        WHERE id = NEW.skill_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE skills 
        SET profile_count = GREATEST(profile_count - 1, 0) 
        WHERE id = OLD.skill_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain skill profile counts
CREATE TRIGGER update_skill_profile_count_insert
    AFTER INSERT ON profile_skills
    FOR EACH ROW 
    WHEN (NEW.deleted_at IS NULL AND NEW.display_on_profile = TRUE)
    EXECUTE FUNCTION update_skill_profile_count();

CREATE TRIGGER update_skill_profile_count_delete
    AFTER DELETE ON profile_skills
    FOR EACH ROW 
    EXECUTE FUNCTION update_skill_profile_count();

CREATE TRIGGER update_skill_profile_count_update
    AFTER UPDATE ON profile_skills
    FOR EACH ROW 
    WHEN (OLD.display_on_profile != NEW.display_on_profile OR 
          OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
    EXECUTE FUNCTION update_skill_profile_count();

-- Function to generate skill slugs
CREATE OR REPLACE FUNCTION generate_skill_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from name
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;
    
    -- Ensure uniqueness within category
    WHILE EXISTS (
        SELECT 1 FROM skills 
        WHERE slug = final_slug 
        AND category_id = NEW.category_id 
        AND id != NEW.id 
        AND deleted_at IS NULL
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate skill category slugs
CREATE OR REPLACE FUNCTION generate_skill_category_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from name
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;
    
    -- Ensure uniqueness
    WHILE EXISTS (
        SELECT 1 FROM skill_categories 
        WHERE slug = final_slug 
        AND id != NEW.id 
        AND deleted_at IS NULL
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-generate slugs
CREATE TRIGGER generate_skill_category_slug_trigger
    BEFORE INSERT OR UPDATE OF name ON skill_categories
    FOR EACH ROW 
    WHEN (NEW.slug IS NULL OR OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION generate_skill_category_slug();

CREATE TRIGGER generate_skill_slug_trigger
    BEFORE INSERT OR UPDATE OF name ON skills
    FOR EACH ROW 
    WHEN (NEW.slug IS NULL OR OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION generate_skill_slug();

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

-- Comments
COMMENT ON TABLE skill_categories IS 'Top-level categorization of skills for organization and filtering';
COMMENT ON TABLE skills IS 'Individual skills within categories, supports hierarchical relationships';
COMMENT ON TABLE profile_skills IS 'Junction table linking profiles to skills with proficiency and verification';
COMMENT ON COLUMN skills.parent_skill_id IS 'Self-referencing foreign key for skill hierarchies (e.g., Python -> Programming)';
COMMENT ON COLUMN skills.demand_score IS 'Market demand indicator 0-100 for prioritizing popular skills';
COMMENT ON COLUMN profile_skills.is_primary_skill IS 'Indicates if this is one of the profile top/featured skills';
COMMENT ON COLUMN profile_skills.verification_method IS 'How the skill was verified: linkedin, certification, peer_review, etc.';
COMMENT ON COLUMN profile_skills.portfolio_examples IS 'Array of URLs or descriptions showcasing this skill';