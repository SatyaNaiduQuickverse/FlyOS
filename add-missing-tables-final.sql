-- Add the missing tables that match your existing schema structure
-- Execute this in your existing TimescaleDB

-- Create regions table (matches your existing naming convention)
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    commanderName TEXT,
    status TEXT DEFAULT 'ACTIVE',
    area TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create drones table (matches your existing naming convention)  
CREATE TABLE IF NOT EXISTS drones (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    status TEXT DEFAULT 'STANDBY' CHECK (status IN ('ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE')),
    regionId TEXT REFERENCES regions(id),
    operatorId UUID REFERENCES "Users"(id),
    lastMaintenance TIMESTAMPTZ,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drones_regionId ON drones(regionId);
CREATE INDEX IF NOT EXISTS idx_drones_operatorId ON drones(operatorId);
CREATE INDEX IF NOT EXISTS idx_drones_status ON drones(status);

-- Insert initial regions data
INSERT INTO regions (id, name, area) VALUES
    ('east', 'Eastern Region', 'Eastern Command Zone'),
    ('west', 'Western Region', 'Western Command Zone'),
    ('north', 'Northern Region', 'Northern Command Zone'),
    ('south', 'Southern Region', 'Southern Command Zone')
ON CONFLICT (id) DO NOTHING;

-- Get a sample user ID to assign drones to
DO $$
DECLARE
    sample_user_id UUID;
BEGIN
    -- Get the first user ID from Users table
    SELECT id INTO sample_user_id FROM "Users" LIMIT 1;
    
    -- Insert sample drones with actual user assignment
    IF sample_user_id IS NOT NULL THEN
        INSERT INTO drones (id, model, status, regionId, operatorId) VALUES
            ('drone-001', 'MQ-9 Reaper', 'ACTIVE', 'east', sample_user_id),
            ('drone-002', 'MQ-1 Predator', 'STANDBY', 'west', NULL),
            ('drone-003', 'MQ-9 Reaper', 'MAINTENANCE', 'north', NULL),
            ('drone-004', 'MQ-1 Predator', 'ACTIVE', 'south', NULL),
            ('drone-005', 'MQ-9 Reaper', 'STANDBY', 'east', sample_user_id)
        ON CONFLICT (id) DO NOTHING;
    ELSE
        -- Insert drones without operator assignment if no users exist
        INSERT INTO drones (id, model, status, regionId) VALUES
            ('drone-001', 'MQ-9 Reaper', 'ACTIVE', 'east'),
            ('drone-002', 'MQ-1 Predator', 'STANDBY', 'west'),
            ('drone-003', 'MQ-9 Reaper', 'MAINTENANCE', 'north'),
            ('drone-004', 'MQ-1 Predator', 'ACTIVE', 'south'),
            ('drone-005', 'MQ-9 Reaper', 'STANDBY', 'east')
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Verify the tables were created
SELECT 'regions' as table_name, count(*) as row_count FROM regions
UNION ALL
SELECT 'drones' as table_name, count(*) as row_count FROM drones;

-- Show sample data
SELECT 'Sample drones:' as info;
SELECT id, model, status, regionId, operatorId FROM drones LIMIT 3;
