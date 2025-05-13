import { Pool } from 'pg';
import { logger } from '../utils/logger';

// PostgreSQL connection for storing metrics
let pool: Pool | null = null;

// Initialize database connections and create tables if they don't exist
export const initDatabase = async () => {
  try {
    const connectionString = process.env.DATABASE_URL || 'postgresql://flyos_admin:secure_password@localhost:5432/flyos_db';
    
    // Create PostgreSQL connection pool
    pool = new Pool({
      connectionString,
    });
    
    // Test PostgreSQL connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info(`PostgreSQL connected: ${result.rows[0].now}`);
    
    // Create tables for metrics if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS performance_test_runs (
        id SERIAL PRIMARY KEY,
        start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        end_time TIMESTAMPTZ,
        drone_count INTEGER NOT NULL,
        update_frequency_ms INTEGER NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        notes TEXT
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        test_run_id INTEGER REFERENCES performance_test_runs(id),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metric_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        latency_ms FLOAT NOT NULL,
        success BOOLEAN NOT NULL,
        drone_id TEXT,
        details JSONB
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS drone_simulation_events (
        id SERIAL PRIMARY KEY,
        test_run_id INTEGER REFERENCES performance_test_runs(id),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        event_type TEXT NOT NULL,
        drone_id TEXT,
        details JSONB
      );
    `);
    
    client.release();
    logger.info('Performance metrics tables created or verified');
    
    return pool;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Start a new test run and return the run ID
export const startTestRun = async (droneCount: number, updateFrequencyMs: number, notes?: string) => {
  if (!pool) throw new Error('Database not initialized');
  
  try {
    const query = `
      INSERT INTO performance_test_runs (
        drone_count, update_frequency_ms, notes
      ) VALUES ($1, $2, $3) RETURNING id;
    `;
    
    const result = await pool.query(query, [droneCount, updateFrequencyMs, notes || null]);
    const testRunId = result.rows[0].id;
    
    logger.info(`Started test run #${testRunId} with ${droneCount} drones at ${updateFrequencyMs}ms interval`);
    return testRunId;
  } catch (error) {
    logger.error('Failed to start test run:', error);
    throw error;
  }
};

// Record a performance metric
export const recordMetric = async (
  testRunId: number,
  metricType: string,
  operation: string,
  latencyMs: number,
  success: boolean,
  droneId?: string,
  details?: any
) => {
  if (!pool) return; // Silently return if database is not initialized
  
  try {
    const query = `
      INSERT INTO performance_metrics (
        test_run_id, metric_type, operation, latency_ms, success, drone_id, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7);
    `;
    
    await pool.query(query, [
      testRunId, 
      metricType, 
      operation, 
      latencyMs, 
      success, 
      droneId || null, 
      details ? JSON.stringify(details) : null
    ]);
  } catch (error) {
    logger.error('Failed to record metric:', error);
    // Don't throw - we don't want to crash the app if metrics fail
  }
};

// Record a simulation event
export const recordEvent = async (
  testRunId: number,
  eventType: string,
  droneId?: string,
  details?: any
) => {
  if (!pool) return; // Silently return if database is not initialized
  
  try {
    const query = `
      INSERT INTO drone_simulation_events (
        test_run_id, event_type, drone_id, details
      ) VALUES ($1, $2, $3, $4);
    `;
    
    await pool.query(query, [
      testRunId, 
      eventType, 
      droneId || null, 
      details ? JSON.stringify(details) : null
    ]);
  } catch (error) {
    logger.error('Failed to record event:', error);
    // Don't throw - we don't want to crash the app if event recording fails
  }
};

// End a test run
export const endTestRun = async (testRunId: number) => {
  if (!pool) return; // Silently return if database is not initialized
  
  try {
    const query = `
      UPDATE performance_test_runs 
      SET end_time = NOW(), completed = true 
      WHERE id = $1;
    `;
    
    await pool.query(query, [testRunId]);
    logger.info(`Completed test run #${testRunId}`);
  } catch (error) {
    logger.error('Failed to end test run:', error);
    // Don't throw - we don't want to crash the app if this fails
  }
};

// Get metrics summary for a test run
export const getMetricsSummary = async (testRunId: number) => {
  if (!pool) return []; // Return empty array if database is not initialized
  
  try {
    const query = `
      SELECT 
        metric_type, 
        operation,
        COUNT(*) as count,
        AVG(latency_ms) as avg_latency,
        MIN(latency_ms) as min_latency,
        MAX(latency_ms) as max_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
      FROM performance_metrics
      WHERE test_run_id = $1
      GROUP BY metric_type, operation;
    `;
    
    const result = await pool.query(query, [testRunId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get metrics summary:', error);
    return [];
  }
};

export { pool };