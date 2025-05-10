-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create drone telemetry table (this will become a hypertable)
CREATE TABLE drone_telemetry (
    id SERIAL PRIMARY KEY,
    drone_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Position data
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude_msl DOUBLE PRECISION,
    altitude_relative DOUBLE PRECISION,
    
    -- State data
    armed BOOLEAN,
    flight_mode TEXT,
    connected BOOLEAN,
    
    -- GPS data
    gps_fix TEXT,
    satellites INTEGER,
    hdop DOUBLE PRECISION,
    position_error DOUBLE PRECISION,
    
    -- Battery data
    voltage DOUBLE PRECISION,
    current DOUBLE PRECISION,
    percentage DOUBLE PRECISION,
    
    -- Orientation data (in radians)
    roll DOUBLE PRECISION,
    pitch DOUBLE PRECISION,
    yaw DOUBLE PRECISION,
    
    -- Velocity data
    velocity_x DOUBLE PRECISION,
    velocity_y DOUBLE PRECISION,
    velocity_z DOUBLE PRECISION,
    
    -- Teensy data
    latency DOUBLE PRECISION,
    teensy_connected BOOLEAN,
    latch_status TEXT
);

-- Create indexes before conversion to hypertable
CREATE INDEX idx_drone_telemetry_drone_id ON drone_telemetry(drone_id);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('drone_telemetry', 'timestamp', 
                         chunk_time_interval => INTERVAL '1 day');

-- Set up compression (after 7 days, compress data)
ALTER TABLE drone_telemetry SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'drone_id'
);

SELECT add_compression_policy('drone_telemetry', INTERVAL '7 days');

-- Create retention policy (keep data for 30 days)
SELECT add_retention_policy('drone_telemetry', INTERVAL '30 days');

-- Create drone commands table
CREATE TABLE drone_commands (
    id SERIAL PRIMARY KEY,
    drone_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    command_type TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'SENT',
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    response_data JSONB
);

-- Create indexes for drone commands
CREATE INDEX idx_drone_commands_drone_id ON drone_commands(drone_id);
CREATE INDEX idx_drone_commands_timestamp ON drone_commands(timestamp);
CREATE INDEX idx_drone_commands_status ON drone_commands(status);

-- Create continuous aggregate view for hourly statistics
CREATE MATERIALIZED VIEW drone_telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    drone_id,
    AVG(altitude_relative) AS avg_altitude,
    MIN(altitude_relative) AS min_altitude,
    MAX(altitude_relative) AS max_altitude,
    AVG(percentage) AS avg_battery,
    MIN(percentage) AS min_battery
FROM drone_telemetry
GROUP BY bucket, drone_id;

-- Set refresh policy for the continuous aggregate
SELECT add_continuous_aggregate_policy('drone_telemetry_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
