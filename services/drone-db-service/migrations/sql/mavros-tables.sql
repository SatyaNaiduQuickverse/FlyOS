-- services/drone-db-service/migrations/sql/mavros-tables.sql
-- MAVROS message logging tables for comprehensive drone communication monitoring

-- Create MAVROS logs table as TimescaleDB hypertable
CREATE TABLE IF NOT EXISTS mavros_logs (
    id SERIAL PRIMARY KEY,
    drone_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'OTHER', -- INFO, WARN, ERROR, OTHER
    raw_message TEXT NOT NULL,
    source TEXT DEFAULT 'mavros',
    severity_level INTEGER DEFAULT 0, -- 0=info, 1=warn, 2=error, 3=critical
    parsed_data JSONB, -- For structured data extraction
    session_id TEXT, -- To group related messages
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mavros_logs_drone_id ON mavros_logs(drone_id);
CREATE INDEX IF NOT EXISTS idx_mavros_logs_timestamp ON mavros_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_mavros_logs_message_type ON mavros_logs(message_type);
CREATE INDEX IF NOT EXISTS idx_mavros_logs_severity ON mavros_logs(severity_level);
CREATE INDEX IF NOT EXISTS idx_mavros_logs_session ON mavros_logs(session_id);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('mavros_logs', 'timestamp', 
                         chunk_time_interval => INTERVAL '1 day',
                         if_not_exists => TRUE);

-- Set up compression (after 7 days, compress data)
ALTER TABLE mavros_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'drone_id,message_type'
);

SELECT add_compression_policy('mavros_logs', INTERVAL '7 days', if_not_exists => TRUE);

-- Create retention policy (keep data for 90 days)
SELECT add_retention_policy('mavros_logs', INTERVAL '90 days', if_not_exists => TRUE);

-- Create MAVROS sessions table for connection tracking
CREATE TABLE IF NOT EXISTS mavros_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    drone_id TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISCONNECTED, ERROR
    connection_info JSONB,
    message_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ
);

-- Create indexes for sessions
CREATE INDEX IF NOT EXISTS idx_mavros_sessions_drone_id ON mavros_sessions(drone_id);
CREATE INDEX IF NOT EXISTS idx_mavros_sessions_status ON mavros_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mavros_sessions_started_at ON mavros_sessions(started_at);

-- Create continuous aggregate view for MAVROS statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mavros_logs_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    drone_id,
    message_type,
    COUNT(*) AS message_count,
    COUNT(*) FILTER (WHERE severity_level >= 2) AS error_count,
    AVG(severity_level) AS avg_severity
FROM mavros_logs
GROUP BY bucket, drone_id, message_type;

-- Set refresh policy for the continuous aggregate
SELECT add_continuous_aggregate_policy('mavros_logs_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- Create function to parse message type from MAVROS message
CREATE OR REPLACE FUNCTION parse_mavros_message_type(message_text TEXT)
RETURNS TEXT AS $$
BEGIN
    IF message_text ILIKE '%[ERROR]%' OR message_text ILIKE '%ERROR:%' THEN
        RETURN 'ERROR';
    ELSIF message_text ILIKE '%[WARN]%' OR message_text ILIKE '%WARNING:%' THEN
        RETURN 'WARN';
    ELSIF message_text ILIKE '%[INFO]%' OR message_text ILIKE '%INFO:%' THEN
        RETURN 'INFO';
    ELSE
        RETURN 'OTHER';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to extract severity level
CREATE OR REPLACE FUNCTION parse_mavros_severity(message_text TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF message_text ILIKE '%CRITICAL%' OR message_text ILIKE '%FATAL%' THEN
        RETURN 3;
    ELSIF message_text ILIKE '%ERROR%' THEN
        RETURN 2;
    ELSIF message_text ILIKE '%WARN%' THEN
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-update session message counts
CREATE OR REPLACE FUNCTION update_mavros_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE mavros_sessions 
    SET 
        message_count = message_count + 1,
        error_count = CASE WHEN NEW.severity_level >= 2 THEN error_count + 1 ELSE error_count END,
        last_message_at = NEW.timestamp
    WHERE session_id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mavros_session_stats
    AFTER INSERT ON mavros_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_mavros_session_stats();

-- Create view for latest MAVROS status per drone
CREATE OR REPLACE VIEW mavros_status_current AS
SELECT DISTINCT ON (drone_id)
    drone_id,
    session_id,
    status,
    started_at,
    ended_at,
    message_count,
    error_count,
    last_message_at,
    CASE 
        WHEN status = 'ACTIVE' AND last_message_at > NOW() - INTERVAL '30 seconds' THEN 'CONNECTED'
        WHEN status = 'ACTIVE' AND last_message_at <= NOW() - INTERVAL '30 seconds' THEN 'STALE'
        ELSE 'DISCONNECTED'
    END as connection_status
FROM mavros_sessions
ORDER BY drone_id, started_at DESC;

-- Comments for documentation
COMMENT ON TABLE mavros_logs IS 'Stores all MAVROS messages for comprehensive drone communication logging';
COMMENT ON TABLE mavros_sessions IS 'Tracks MAVROS connection sessions for each drone';
COMMENT ON VIEW mavros_logs_hourly IS 'Hourly aggregated MAVROS message statistics';
COMMENT ON VIEW mavros_status_current IS 'Current MAVROS connection status for each drone';

COMMENT ON COLUMN mavros_logs.message_type IS 'Parsed message type: INFO, WARN, ERROR, OTHER';
COMMENT ON COLUMN mavros_logs.severity_level IS 'Numeric severity: 0=info, 1=warn, 2=error, 3=critical';
COMMENT ON COLUMN mavros_logs.parsed_data IS 'Structured data extracted from message (JSONB format)';
COMMENT ON COLUMN mavros_logs.session_id IS 'Links messages to MAVROS connection session';

-- Grant permissions (adjust as needed for your user)
-- GRANT SELECT, INSERT, UPDATE ON mavros_logs TO flyos_user;
-- GRANT SELECT, INSERT, UPDATE ON mavros_sessions TO flyos_user;
-- GRANT SELECT ON mavros_logs_hourly TO flyos_user;
-- GRANT SELECT ON mavros_status_current TO flyos_user;

-- Create sample data for testing (remove in production)
-- INSERT INTO mavros_sessions (session_id, drone_id, connection_info) 
-- VALUES ('test-session-1', 'drone-001', '{"version": "1.0", "protocol": "mavlink"}');

-- INSERT INTO mavros_logs (drone_id, message, message_type, raw_message, session_id, severity_level)
-- VALUES 
--     ('drone-001', '[INFO] MAVROS started successfully', 'INFO', '[INFO] [mavros]: MAVROS started successfully', 'test-session-1', 0),
--     ('drone-001', '[WARN] GPS signal weak', 'WARN', '[WARN] [mavros.gps]: GPS signal weak', 'test-session-1', 1),
--     ('drone-001', '[ERROR] Connection timeout', 'ERROR', '[ERROR] [mavros.connection]: Connection timeout', 'test-session-1', 2);