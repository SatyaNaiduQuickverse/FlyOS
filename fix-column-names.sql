-- Fix column names to match what your drone-db-service expects
ALTER TABLE drones RENAME COLUMN regionId TO region_id;
ALTER TABLE drones RENAME COLUMN operatorId TO operator_id;
ALTER TABLE drones RENAME COLUMN lastMaintenance TO last_maintenance;
ALTER TABLE drones RENAME COLUMN createdAt TO created_at;
ALTER TABLE drones RENAME COLUMN updatedAt TO updated_at;

-- Fix regions table too
ALTER TABLE regions RENAME COLUMN commanderName TO commander_name;
ALTER TABLE regions RENAME COLUMN createdAt TO created_at;
ALTER TABLE regions RENAME COLUMN updatedAt TO updated_at;

-- Check the fixed structure
\d drones
\d regions
