// services/drone-db-service/src/services/mavrosService.ts
import { pool } from '../database';
import { logger } from '../utils/logger';

export interface MAVROSMessage {
  id?: number;
  droneId: string;
  timestamp: string;
  message: string;
  messageType: 'INFO' | 'WARN' | 'ERROR' | 'OTHER';
  rawMessage: string;
  source: string;
  severityLevel: number;
  parsedData?: any;
  sessionId: string;
}

export interface MAVROSSession {
  id?: number;
  sessionId: string;
  droneId: string;
  startedAt: string;
  endedAt?: string;
  status: 'ACTIVE' | 'DISCONNECTED' | 'ERROR';
  connectionInfo: any;
  messageCount: number;
  errorCount: number;
  lastMessageAt?: string;
}

export interface MAVROSLogQuery {
  droneId: string;
  startTime?: Date;
  endTime?: Date;
  messageType?: string;
  severityLevel?: number;
  sessionId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Store MAVROS message in TimescaleDB
 */
export const storeMAVROSMessage = async (messageData: MAVROSMessage): Promise<{ id: number }> => {
  try {
    const query = `
      INSERT INTO mavros_logs (
        drone_id, timestamp, message, message_type, raw_message, 
        source, severity_level, parsed_data, session_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id;
    `;
    
    const values = [
      messageData.droneId,
      messageData.timestamp,
      messageData.message,
      messageData.messageType,
      messageData.rawMessage,
      messageData.source,
      messageData.severityLevel,
      messageData.parsedData ? JSON.stringify(messageData.parsedData) : null,
      messageData.sessionId
    ];
    
    const result = await pool.query(query, values);
    
    logger.debug(`📝 MAVROS message stored: ${messageData.droneId} [${messageData.messageType}]`);
    return { id: result.rows[0].id };
    
  } catch (error) {
    logger.error(`❌ Error storing MAVROS message for ${messageData.droneId}:`, error);
    throw error;
  }
};

/**
 * Store MAVROS session in database
 */
export const storeMAVROSSession = async (sessionData: MAVROSSession): Promise<{ id: number }> => {
  try {
    const query = `
      INSERT INTO mavros_sessions (
        session_id, drone_id, started_at, ended_at, status, 
        connection_info, message_count, error_count, last_message_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) ON CONFLICT (session_id) 
      DO UPDATE SET
        ended_at = EXCLUDED.ended_at,
        status = EXCLUDED.status,
        message_count = EXCLUDED.message_count,
        error_count = EXCLUDED.error_count,
        last_message_at = EXCLUDED.last_message_at
      RETURNING id;
    `;
    
    const values = [
      sessionData.sessionId,
      sessionData.droneId,
      sessionData.startedAt,
      sessionData.endedAt || null,
      sessionData.status,
      JSON.stringify(sessionData.connectionInfo),
      sessionData.messageCount,
      sessionData.errorCount,
      sessionData.lastMessageAt || null
    ];
    
    const result = await pool.query(query, values);
    
    logger.debug(`📝 MAVROS session stored: ${sessionData.sessionId}`);
    return { id: result.rows[0].id };
    
  } catch (error) {
    logger.error(`❌ Error storing MAVROS session ${sessionData.sessionId}:`, error);
    throw error;
  }
};

/**
 * Get MAVROS logs with filtering and pagination
 */
export const getMAVROSLogs = async (queryParams: MAVROSLogQuery) => {
  try {
    let whereConditions = ['drone_id = $1'];
    let queryValues: any[] = [queryParams.droneId];
    let paramCount = 1;
    
    // Add time range filter
    if (queryParams.startTime) {
      whereConditions.push(`timestamp >= $${++paramCount}`);
      queryValues.push(queryParams.startTime);
    }
    
    if (queryParams.endTime) {
      whereConditions.push(`timestamp <= $${++paramCount}`);
      queryValues.push(queryParams.endTime);
    }
    
    // Add message type filter
    if (queryParams.messageType) {
      whereConditions.push(`message_type = $${++paramCount}`);
      queryValues.push(queryParams.messageType);
    }
    
    // Add severity filter
    if (queryParams.severityLevel !== undefined) {
      whereConditions.push(`severity_level >= $${++paramCount}`);
      queryValues.push(queryParams.severityLevel);
    }
    
    // Add session filter
    if (queryParams.sessionId) {
      whereConditions.push(`session_id = $${++paramCount}`);
      queryValues.push(queryParams.sessionId);
    }
    
    // Add search filter
    if (queryParams.search) {
      whereConditions.push(`(message ILIKE $${++paramCount} OR raw_message ILIKE $${++paramCount})`);
      const searchTerm = `%${queryParams.search}%`;
      queryValues.push(searchTerm, searchTerm);
    }
    
    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM mavros_logs
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await pool.query(countQuery, queryValues);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const limit = queryParams.limit || 100;
    const offset = queryParams.offset || 0;
    
    const dataQuery = `
      SELECT 
        id, drone_id, timestamp, message, message_type, raw_message,
        source, severity_level, parsed_data, session_id, created_at
      FROM mavros_logs
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryValues.push(limit, offset);
    
    const dataResult = await pool.query(dataQuery, queryValues);
    
    const logs = dataResult.rows.map(row => ({
      ...row,
      parsedData: row.parsed_data ? JSON.parse(row.parsed_data) : null
    }));
    
    logger.debug(`📖 Retrieved ${logs.length} MAVROS logs for ${queryParams.droneId}`);
    
    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
    
  } catch (error) {
    logger.error(`❌ Error retrieving MAVROS logs for ${queryParams.droneId}:`, error);
    throw error;
  }
};

/**
 * Get MAVROS session information
 */
export const getMAVROSSession = async (sessionId: string): Promise<MAVROSSession | null> => {
  try {
    const query = `
      SELECT 
        id, session_id, drone_id, started_at, ended_at, status,
        connection_info, message_count, error_count, last_message_at
      FROM mavros_sessions
      WHERE session_id = $1
    `;
    
    const result = await pool.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      ...row,
      connectionInfo: JSON.parse(row.connection_info)
    };
    
  } catch (error) {
    logger.error(`❌ Error retrieving MAVROS session ${sessionId}:`, error);
    throw error;
  }
};

/**
* Get current MAVROS status for a drone
*/
export const getMAVROSStatus = async (droneId: string) => {
 try {
   const query = `
     SELECT 
       drone_id,
       session_id,
       status,
       started_at,
       ended_at,
       message_count,
       error_count,
       last_message_at,
       connection_status
     FROM mavros_status_current
     WHERE drone_id = $1
   `;
   
   const result = await pool.query(query, [droneId]);
   
   if (result.rows.length === 0) {
     return {
       droneId,
       status: 'NEVER_CONNECTED',
       connectionStatus: 'DISCONNECTED',
       messageCount: 0,
       errorCount: 0
     };
   }
   
   return result.rows[0];
   
 } catch (error) {
   logger.error(`❌ Error retrieving MAVROS status for ${droneId}:`, error);
   throw error;
 }
};

/**
* Get MAVROS statistics for a time period
*/
export const getMAVROSStatistics = async (
 droneId: string, 
 startTime: Date, 
 endTime: Date
) => {
 try {
   const query = `
     SELECT 
       message_type,
       COUNT(*) as message_count,
       AVG(severity_level) as avg_severity,
       MAX(timestamp) as last_message,
       MIN(timestamp) as first_message
     FROM mavros_logs
     WHERE drone_id = $1 
       AND timestamp BETWEEN $2 AND $3
     GROUP BY message_type
     ORDER BY message_count DESC
   `;
   
   const result = await pool.query(query, [droneId, startTime, endTime]);
   
   // Get hourly statistics from continuous aggregate
   const hourlyQuery = `
     SELECT 
       bucket,
       message_type,
       message_count,
       error_count,
       avg_severity
     FROM mavros_logs_hourly
     WHERE drone_id = $1 
       AND bucket BETWEEN $2 AND $3
     ORDER BY bucket DESC, message_count DESC
   `;
   
   const hourlyResult = await pool.query(hourlyQuery, [droneId, startTime, endTime]);
   
   // Calculate summary statistics
   const totalMessages = result.rows.reduce((sum, row) => sum + parseInt(row.message_count), 0);
   const errorMessages = result.rows
     .filter(row => row.message_type === 'ERROR')
     .reduce((sum, row) => sum + parseInt(row.message_count), 0);
   
   return {
     summary: {
       totalMessages,
       errorMessages,
       errorRate: totalMessages > 0 ? (errorMessages / totalMessages) * 100 : 0,
       timeRange: { startTime, endTime }
     },
     byType: result.rows,
     hourlyData: hourlyResult.rows
   };
   
 } catch (error) {
   logger.error(`❌ Error retrieving MAVROS statistics for ${droneId}:`, error);
   throw error;
 }
};

/**
* Clean up old MAVROS data based on retention policy
*/
export const cleanupOldMAVROSData = async (retentionDays: number = 90) => {
 try {
   const cutoffDate = new Date();
   cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
   
   // Clean up old logs (TimescaleDB retention policy should handle this automatically)
   const logCleanupQuery = `
     DELETE FROM mavros_logs 
     WHERE timestamp < $1
   `;
   
   const logResult = await pool.query(logCleanupQuery, [cutoffDate]);
   
   // Clean up old sessions
   const sessionCleanupQuery = `
     DELETE FROM mavros_sessions 
     WHERE started_at < $1 AND status != 'ACTIVE'
   `;
   
   const sessionResult = await pool.query(sessionCleanupQuery, [cutoffDate]);
   
   logger.info(`🧹 MAVROS cleanup completed: ${logResult.rowCount} logs, ${sessionResult.rowCount} sessions removed`);
   
   return {
     logsRemoved: logResult.rowCount || 0,
     sessionsRemoved: sessionResult.rowCount || 0
   };
   
 } catch (error) {
   logger.error('❌ Error during MAVROS data cleanup:', error);
   throw error;
 }
};

/**
* Get MAVROS message types summary
*/
export const getMAVROSMessageTypes = async (droneId: string) => {
 try {
   const query = `
     SELECT 
       message_type,
       COUNT(*) as count,
       MAX(timestamp) as latest_message
     FROM mavros_logs
     WHERE drone_id = $1
       AND timestamp >= NOW() - INTERVAL '24 hours'
     GROUP BY message_type
     ORDER BY count DESC
   `;
   
   const result = await pool.query(query, [droneId]);
   
   return result.rows;
   
 } catch (error) {
   logger.error(`❌ Error retrieving MAVROS message types for ${droneId}:`, error);
   throw error;
 }
};

/**
* Search MAVROS logs with full-text search
*/
export const searchMAVROSLogs = async (
 droneId: string,
 searchTerm: string,
 limit: number = 50
) => {
 try {
   const query = `
     SELECT 
       id, drone_id, timestamp, message, message_type, 
       raw_message, source, severity_level, session_id,
       ts_rank(to_tsvector('english', message || ' ' || raw_message), plainto_tsquery('english', $2)) as rank
     FROM mavros_logs
     WHERE drone_id = $1
       AND (
         to_tsvector('english', message || ' ' || raw_message) @@ plainto_tsquery('english', $2)
         OR message ILIKE $3
         OR raw_message ILIKE $3
       )
     ORDER BY rank DESC, timestamp DESC
     LIMIT $4
   `;
   
   const searchPattern = `%${searchTerm}%`;
   const result = await pool.query(query, [droneId, searchTerm, searchPattern, limit]);
   
   logger.debug(`🔍 MAVROS search for "${searchTerm}" returned ${result.rows.length} results`);
   
   return result.rows;
   
 } catch (error) {
   logger.error(`❌ Error searching MAVROS logs for ${droneId}:`, error);
   throw error;
 }
};

/**
* Get real-time MAVROS buffer from Redis
*/
export const getMAVROSBuffer = async (droneId: string, count: number = 100) => {
 try {
   const { redisClient } = await import('../redis');
   const bufferKey = `mavros:${droneId}:buffer`;
   
   const messages = await redisClient.lrange(bufferKey, 0, count - 1);
   
   return messages.map(msg => JSON.parse(msg));
   
 } catch (error) {
   logger.error(`❌ Error retrieving MAVROS buffer for ${droneId}:`, error);
   return [];
 }
};