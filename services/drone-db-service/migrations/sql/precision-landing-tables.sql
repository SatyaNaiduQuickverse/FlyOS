-- services/drone-db-service/migrations/sql/precision-landing-tables.sql
-- Precision landing data storage for TimescaleDB

-- Create precision landing logs table
CREATE TABLE IF NOT EXISTS precision_landing_logs (
    id SERIAL PRIMARY KEY,
    drone_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    stage TEXT, -- APPROACH, DESCENT, FINAL, LANDED, ABORTED
    message TEXT NOT NULL,
    altitude DOUBLE PRECISION,
    target_detected BOOLEAN,
    target_confidence DOUBLE PRECISION,
    lateral_error DOUBLE PRECISION,
    vertical_error DOUBLE PRECISION,
    battery_level DOUBLE PRECISION,
    wind_speed DOUBLE PRECISION,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_precision_landing_logs_drone_id ON precision_landing_logs(drone_id);
CREATE INDEX IF NOT EXISTS idx_precision_landing_logs_timestamp ON precision_landing_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_precision_landing_logs_session_id ON precision_landing_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_precision_landing_logs_stage ON precision_landing_logs(stage);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('precision_landing_logs', 'timestamp', 
                         chunk_time_interval => INTERVAL '1 day',
                         if_not_exists => TRUE);

-- Set up compression after 7 days
ALTER TABLE precision_landing_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'drone_id,session_id'
);

SELECT add_compression_policy('precision_landing_logs', INTERVAL '7 days', if_not_exists => TRUE);

-- Create retention policy (keep data for 30 days)
SELECT add_retention_policy('precision_landing_logs', INTERVAL '30 days', if_not_exists => TRUE);

-- Create continuous aggregate for precision landing statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS precision_landing_stats_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    drone_id,
    session_id,
    COUNT(*) AS message_count,
    MAX(CASE WHEN stage = 'LANDED' THEN 1 ELSE 0 END) AS successful_landing,
    AVG(target_confidence) AS avg_confidence,
    AVG(lateral_error) AS avg_lateral_error,
    AVG(vertical_error) AS avg_vertical_error
FROM precision_landing_logs
GROUP BY bucket, drone_id, session_id;

-- Set refresh policy for the continuous aggregate
SELECT add_continuous_aggregate_policy('precision_landing_stats_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- Comments for documentation
COMMENT ON TABLE precision_landing_logs IS 'Stores all precision landing telemetry and log data';
COMMENT ON COLUMN precision_landing_logs.stage IS 'Landing stage: APPROACH, DESCENT, FINAL, LANDED, ABORTED';
COMMENT ON COLUMN precision_landing_logs.target_confidence IS 'AI confidence in target detection (0-1)';
COMMENT ON COLUMN precision_landing_logs.lateral_error IS 'Lateral error in meters from target center';
COMMENT ON COLUMN precision_landing_logs.vertical_error IS 'Vertical error in meters from target center';