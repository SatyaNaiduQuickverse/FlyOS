-- Add the missing tables that your Prisma schema expects
-- Execute this in your existing TimescaleDB

-- Create regions table (matches your Prisma schema)
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    commander_name TEXT,
    status TEXT DEFAULT 'ACTIVE',
    area TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create drones table (matches your Prisma schema)  
CREATE TABLE IF NOT EXISTS drones (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    status TEXT DEFAULT 'STANDBY' CHECK (status IN ('ACTIVE', 'STANDBY', 'MAINTENANCE', 'OFFLINE')),
    region_id TEXT REFERENCES regions(id),
    operator_id TEXT REFERENCES "Users"(id),
    last_maintenance TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drones_region_id ON drones(region_id);
CREATE INDEX IF NOT EXISTS idx_drones_operator_id ON drones(operator_id);
CREATE INDEX IF NOT EXISTS idx_drones_status ON drones(status);

-- Insert initial regions data
INSERT INTO regions (id, name, area) VALUES
    ('east', 'Eastern Region', 'Eastern Command Zone'),
    ('west', 'Western Region', 'Western Command Zone'),
    ('north', 'Northern Region', 'Northern Command Zone'),
    ('south', 'Southern Region', 'Southern Command Zone')
ON CONFLICT (id) DO NOTHING;

-- Insert some sample drones for testing
INSERT INTO drones (id, model, status, region_id) VALUES
    ('drone-001', 'MQ-9 Reaper', 'ACTIVE', 'east'),
    ('drone-002', 'MQ-1 Predator', 'STANDBY', 'west'),
    ('drone-003', 'MQ-9 Reaper', 'MAINTENANCE', 'north'),
    ('drone-004', 'MQ-1 Predator', 'ACTIVE', 'south'),
    ('drone-005', 'MQ-9 Reaper', 'STANDBY', 'east')
ON CONFLICT (id) DO NOTHING;

-- Verify the tables were created
SELECT 'regions' as table_name, count(*) as row_count FROM regions
UNION ALL
SELECT 'drones' as table_name, count(*) as row_count FROM drones;
