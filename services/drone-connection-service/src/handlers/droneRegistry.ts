// services/drone-connection-service/src/handlers/droneRegistry.ts
import express from 'express';
import { redisClient } from '../redis';
import { logger } from '../utils/logger';

interface DroneDiscoveryInfo {
  droneId: string;
  model: string;
  version: string;
  jetsonSerial: string;
  ipAddress: string;
  capabilities: string[];
  lastSeen: string;
}

interface ServerInfo {
  serverUrl: string;
  websocketUrl: string;
  webrtcConfig: {
    stunServers: string[];
    turnServers?: any[];
  };
  apiVersion: string;
  supportedFeatures: string[];
  recommendedSettings: {
    telemetryRate: string;
    heartbeatInterval: string;
    reconnectDelay: string;
  };
}

// In-memory registry for fast lookups
const droneRegistry = new Map<string, DroneDiscoveryInfo>();

export const setupDroneRegistry = (app: express.Application) => {
  logger.info('📋 Setting up drone registry endpoints...');

  // Drone discovery endpoint - first contact point
  app.post('/drone/discover', async (req, res) => {
    try {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      logger.info(`🔍 Drone discovery request from ${clientIP}`);
      
      // Basic server info for drone to determine compatibility
      const serverInfo: ServerInfo = {
        serverUrl: process.env.PUBLIC_SERVER_URL || `http://${req.get('host')}`,
        websocketUrl: process.env.PUBLIC_WS_URL || `ws://${req.get('host')}:4005`,
        webrtcConfig: {
          stunServers: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302'
          ]
        },
        apiVersion: '1.0',
        supportedFeatures: [
          'telemetry',
          'commands',
          'camera_webrtc',
          'mavros_logging',
          'precision_landing',
          'mission_planning',
          'real_time_control'
        ],
        recommendedSettings: {
          telemetryRate: '10Hz',
          heartbeatInterval: '10s',
          reconnectDelay: '5s'
        }
      };
      
      res.json({
        success: true,
        message: 'FlyOS Drone Connection Service',
        timestamp: new Date().toISOString(),
        serverInfo
      });
      
    } catch (error) {
      logger.error('❌ Discovery endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Discovery failed'
      });
    }
  });

  // Drone registration endpoint - detailed registration
  app.post('/drone/register', async (req, res) => {
    try {
      const {
        droneId,
        model,
        version,
        jetsonSerial,
        capabilities,
        systemInfo
      } = req.body;
      
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Validate required fields
      if (!droneId || !jetsonSerial) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: droneId, jetsonSerial'
        });
      }
      
      logger.info(`📝 Drone registration: ${droneId} (${model}) from ${clientIP}`);
      
      // Create drone registry entry
      const droneInfo: DroneDiscoveryInfo = {
        droneId,
        model: model || 'Unknown',
        version: version || '1.0',
        jetsonSerial,
        ipAddress: clientIP,
        capabilities: capabilities || [],
        lastSeen: new Date().toISOString()
      };
      
      // Store in memory and Redis
      droneRegistry.set(droneId, droneInfo);
      
      await redisClient.setex(
        `drone_registry:${droneId}`,
        86400, // 24 hours
        JSON.stringify({
          ...droneInfo,
          systemInfo: systemInfo || {}
        })
      );
      
      // Check if drone was previously connected
      const wasConnected = global.connectedDrones[droneId];
      
      // Generate unique session token for this registration
      const sessionToken = `${droneId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await redisClient.setex(
        `drone_session:${sessionToken}`,
        3600, // 1 hour
        JSON.stringify({
          droneId,
          jetsonSerial,
          registeredAt: new Date().toISOString(),
          ipAddress: clientIP
        })
      );
      
      const registrationResponse = {
        success: true,
        message: 'Registration successful',
        droneId,
        sessionToken,
        connectionInfo: {
          websocketUrl: process.env.PUBLIC_WS_URL || `ws://${req.get('host')}:4005`,
          authRequired: false, // For now, will be true later
          maxReconnectAttempts: 10,
          reconnectDelay: 5000,
          heartbeatInterval: 10000
        },
        serverCapabilities: [
          'telemetry_storage',
          'command_processing',
          'webrtc_signaling',
          'mavros_logging',
          'precision_landing',
          'mission_upload'
        ],
        dataChannels: {
          telemetry: { event: 'telemetry_real', rate: '10Hz' },
          heartbeat: { event: 'heartbeat_real', rate: '0.1Hz' },
          mavros: { event: 'mavros_real', rate: '1Hz' },
          precision_landing: { event: 'precision_land_real', rate: 'variable' },
          webrtc_signaling: { events: ['webrtc_offer', 'webrtc_ice_candidate'] }
        },
        previousConnection: wasConnected ? {
          lastSeen: wasConnected.connectedAt,
          status: wasConnected.status
        } : null
      };
      
      res.json(registrationResponse);
      
      logger.info(`✅ Drone ${droneId} registered successfully with session ${sessionToken}`);
      
    } catch (error) {
      logger.error('❌ Registration endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  });

  // Drone status update endpoint
  app.post('/drone/:droneId/status', async (req, res) => {
    try {
      const { droneId } = req.params;
      const { status, metrics } = req.body;
      
      const droneInfo = droneRegistry.get(droneId);
      if (!droneInfo) {
        return res.status(404).json({
          success: false,
          error: 'Drone not registered'
        });
      }
      
      // Update last seen
      droneInfo.lastSeen = new Date().toISOString();
      droneRegistry.set(droneId, droneInfo);
      
      // Store status update in Redis
      await redisClient.setex(
        `drone_status:${droneId}`,
        300, // 5 minutes
        JSON.stringify({
          status,
          metrics: metrics || {},
          timestamp: new Date().toISOString(),
          ipAddress: droneInfo.ipAddress
        })
      );
      
      logger.debug(`📊 Status update from ${droneId}: ${status}`);
      
      res.json({
        success: true,
        message: 'Status updated',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Status update error:', error);
      res.status(500).json({
        success: false,
        error: 'Status update failed'
      });
    }
  });

  // Get registered drones
  app.get('/drone/registry', async (req, res) => {
    try {
      const drones = Array.from(droneRegistry.values());
      
      // Add connection status
      const dronesWithStatus = drones.map(drone => ({
        ...drone,
        connected: !!global.connectedDrones[drone.droneId],
        connectionInfo: global.connectedDrones[drone.droneId] || null
      }));
      
      res.json({
        success: true,
        drones: dronesWithStatus,
        total: dronesWithStatus.length,
        connected: dronesWithStatus.filter(d => d.connected).length
      });
      
    } catch (error) {
      logger.error('❌ Registry fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch registry'
      });
    }
  });

  // Get specific drone info
  app.get('/drone/:droneId/info', async (req, res) => {
    try {
      const { droneId } = req.params;
      
      const droneInfo = droneRegistry.get(droneId);
      if (!droneInfo) {
        return res.status(404).json({
          success: false,
          error: 'Drone not found in registry'
        });
      }
      
      // Get additional info from Redis
      const [registryData, statusData, connectionData] = await Promise.all([
        redisClient.get(`drone_registry:${droneId}`),
        redisClient.get(`drone_status:${droneId}`),
        redisClient.get(`drone:${droneId}:state`)
      ]);
      
      const response = {
        success: true,
        droneInfo,
        registry: registryData ? JSON.parse(registryData) : null,
        status: statusData ? JSON.parse(statusData) : null,
        currentState: connectionData ? JSON.parse(connectionData) : null,
        connected: !!global.connectedDrones[droneId]
      };
      
      res.json(response);
      
    } catch (error) {
      logger.error('❌ Drone info fetch error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch drone info'
      });
    }
  });

  // Remove drone from registry
  app.delete('/drone/:droneId/registry', async (req, res) => {
    try {
      const { droneId } = req.params;
      
      // Remove from memory
      droneRegistry.delete(droneId);
      
      // Remove from Redis
      await Promise.all([
        redisClient.del(`drone_registry:${droneId}`),
        redisClient.del(`drone_status:${droneId}`),
        redisClient.del(`drone:${droneId}:state`)
      ]);
      
      // Disconnect if currently connected
      const connectedDrone = global.connectedDrones[droneId];
      if (connectedDrone) {
        // Find and disconnect socket
        // Note: This would be implemented based on your socket management
        delete global.connectedDrones[droneId];
      }
      
      logger.info(`🗑️ Drone ${droneId} removed from registry`);
      
      res.json({
        success: true,
        message: 'Drone removed from registry'
      });
      
    } catch (error) {
      logger.error('❌ Drone removal error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove drone'
      });
    }
  });

  // Health check for drones
  app.get('/drone/health', async (req, res) => {
    try {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      const healthStatus = Array.from(droneRegistry.values()).map(drone => {
        const lastSeenTime = new Date(drone.lastSeen).getTime();
        const isStale = now - lastSeenTime > staleThreshold;
        const isConnected = !!global.connectedDrones[drone.droneId];
        
        return {
          droneId: drone.droneId,
          model: drone.model,
          lastSeen: drone.lastSeen,
          connected: isConnected,
          healthy: isConnected && !isStale,
          stale: isStale,
          timeSinceLastSeen: now - lastSeenTime
        };
      });
      
      const summary = {
        total: healthStatus.length,
        connected: healthStatus.filter(d => d.connected).length,
        healthy: healthStatus.filter(d => d.healthy).length,
        stale: healthStatus.filter(d => d.stale).length
      };
      
      res.json({
        success: true,
        summary,
        drones: healthStatus
      });
      
    } catch (error) {
      logger.error('❌ Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  });

  // Cleanup stale registry entries
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [droneId, droneInfo] of droneRegistry.entries()) {
      const lastSeenTime = new Date(droneInfo.lastSeen).getTime();
      
      if (now - lastSeenTime > staleThreshold) {
        logger.info(`🧹 Removing stale drone from registry: ${droneId}`);
        droneRegistry.delete(droneId);
        
        // Clean up Redis
        redisClient.del(`drone_registry:${droneId}`).catch(() => {});
        redisClient.del(`drone_status:${droneId}`).catch(() => {});
      }
    }
  }, 60 * 60 * 1000); // Check every hour

  logger.info('✅ Drone registry endpoints configured successfully');
};