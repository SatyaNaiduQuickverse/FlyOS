-- services/drone-db-service/migrations/sql/mission-tables.sql
-- Mission tables for waypoint mission safety and audit

-- Create mission metadata table
CREATE TABLE IF NOT EXISTS drone_missions (
    id SERIAL PRIMARY KEY,
    mission_id TEXT NOT NULL UNIQUE,
    drone_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    total_waypoints INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    command_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create mission waypoints table
CREATE TABLE IF NOT EXISTS mission_waypoints (
    id SERIAL PRIMARY KEY,
    mission_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    frame INTEGER NOT NULL DEFAULT 3, -- MAV_FRAME_GLOBAL_RELATIVE_ALT
    command INTEGER NOT NULL DEFAULT 16, -- MAV_CMD_NAV_WAYPOINT
    param1 DOUBLE PRECISION DEFAULT 0, -- Hold time
    param2 DOUBLE PRECISION DEFAULT 0, -- Accept radius
    param3 DOUBLE PRECISION DEFAULT 0, -- Pass radius
    param4 DOUBLE PRECISION DEFAULT 0, -- Yaw
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION NOT NULL,
    autocontinue BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (mission_id) REFERENCES drone_missions(mission_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_drone_missions_drone_id ON drone_missions(drone_id);
CREATE INDEX IF NOT EXISTS idx_drone_missions_status ON drone_missions(status);
CREATE INDEX IF NOT EXISTS idx_drone_missions_uploaded_at ON drone_missions(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_drone_missions_mission_id ON drone_missions(mission_id);

CREATE INDEX IF NOT EXISTS idx_mission_waypoints_mission_id ON mission_waypoints(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_waypoints_sequence ON mission_waypoints(mission_id, sequence_number);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at (only if it doesn't exist)
DROP TRIGGER IF EXISTS update_drone_missions_updated_at ON drone_missions;
CREATE TRIGGER update_drone_missions_updated_at
    BEFORE UPDATE ON drone_missions
    FOR EACH ROW
    EXECUTE FUNCTION update_mission_updated_at();

-- Create view for mission summary with waypoint count
DROP VIEW IF EXISTS mission_summary;
CREATE VIEW mission_summary AS
SELECT 
    dm.mission_id,
    dm.drone_id,
    dm.user_id,
    dm.file_name,
    dm.status,
    dm.uploaded_at,
    dm.started_at,
    dm.completed_at,
    dm.failure_reason,
    COUNT(mw.id) as waypoint_count,
    CASE 
        WHEN dm.completed_at IS NOT NULL AND dm.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (dm.completed_at - dm.started_at))
        ELSE NULL 
    END as mission_duration_seconds
FROM drone_missions dm
LEFT JOIN mission_waypoints mw ON dm.mission_id = mw.mission_id
GROUP BY dm.mission_id, dm.drone_id, dm.user_id, dm.file_name, 
         dm.status, dm.uploaded_at, dm.started_at, dm.completed_at, dm.failure_reason
ORDER BY dm.uploaded_at DESC;

-- Comments for documentation
COMMENT ON TABLE drone_missions IS 'Stores metadata for waypoint missions uploaded to drones';
COMMENT ON TABLE mission_waypoints IS 'Stores individual waypoints for each mission';
COMMENT ON VIEW mission_summary IS 'Provides summary view of missions with calculated metrics';

COMMENT ON COLUMN drone_missions.status IS 'Mission status: uploaded, started, completed, cancelled, failed';
COMMENT ON COLUMN mission_waypoints.frame IS 'MAV_FRAME - coordinate frame (3 = global relative altitude)';
COMMENT ON COLUMN mission_waypoints.command IS 'MAV_CMD - waypoint command type (16 = nav waypoint)';
COMMENT ON COLUMN mission_waypoints.param1 IS 'Command parameter 1 - typically hold time in seconds';
COMMENT ON COLUMN mission_waypoints.param2 IS 'Command parameter 2 - typically accept radius in meters';
COMMENT ON COLUMN mission_waypoints.param3 IS 'Command parameter 3 - typically pass radius in meters';
COMMENT ON COLUMN mission_waypoints.param4 IS 'Command parameter 4 - typically yaw angle in degrees';