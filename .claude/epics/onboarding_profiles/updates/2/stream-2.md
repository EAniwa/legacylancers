---
stream: 2
name: Availability & Verification Schema
status: completed
started: 2025-08-25T12:00:00Z
completed: 2025-08-25T12:30:00Z
---

# Stream 2: Availability & Verification Schema

## Tasks
- [x] Create availability table migration (004_create_availability_table.sql)
- [x] Create verification table migration (005_create_verification_table.sql)  
- [x] Create rates table migration (006_create_rates_table.sql)

## Progress
- ✅ Completed all three database migration files
- ✅ Designed comprehensive availability calendar system with time zone support
- ✅ Created verification system for LinkedIn, identity, education, and trust signals  
- ✅ Built flexible rates system supporting all engagement types and pricing models

## Implementation Details

### Availability Table (004_create_availability_table.sql)
- Calendar slots with time zone support (IANA format)
- Recurring availability patterns (daily, weekly, biweekly, monthly)
- Booking limits and buffer time management
- Support for all engagement types with location preferences
- Automatic approval and minimum notice settings

### Verification Table (005_create_verification_table.sql)  
- LinkedIn profile verification with connection tracking
- Identity verification with document hashing for privacy
- Education and employment verification
- Skills and portfolio verification with JSONB storage
- Background check integration with multiple providers
- Confidence and trust scoring system

### Rates Table (006_create_rates_table.sql)
- Hourly, daily, weekly, monthly, and project-based pricing
- Keynote speaking fees with travel and virtual options
- Mentoring session and monthly rates
- Rate modifiers for rush, weekend, evening, and holiday work
- Geographic premiums/discounts and experience-based pricing
- Payment terms and bulk discount support

## Notes
- All tables include proper PostgreSQL constraints and indexes
- Audit fields (created_at, updated_at, deleted_at) implemented for soft deletes
- Foreign key relationships established with users table from Stream 1
- Comprehensive commenting and documentation included
- Support for all required engagement types (freelance/consulting/project/keynote/mentoring)