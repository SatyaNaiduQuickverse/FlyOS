// services/drone-connection-service/src/missionHandler.ts
import { Server } from 'socket.io';
import { redisClient } from './redis';
import { storeMissionData, getMissionData } from './missionStorage';
import { logger } from './utils/logger';

export interface Waypoint {
  seq: number;
  lat: number;
  lng: number;
  alt: number;
  command: number;
  frame: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
}

export interface MissionData {
  waypoints: Waypoint[];
  fileName: string;
  totalWaypoints: number;
  uploadedBy: string;
  uploadedAt: string;
  missionId?: string;
}

export const setupMissionHandler = (io: Server) => {
  logger.info('🗺️ Setting up mission handler...');
  
  // Subscribe to mission command channels
  const subscriber = redisClient.duplicate();
  
  subscriber.psubscribe('drone:*:commands');
  
  subscriber.on('pmessage', async (pattern: string, channel: string, message: string) => {
    try {
      const droneId = channel.split(':')[1];
      const command = JSON.parse(message);
      
      // Handle mission-related commands
      switch (command.commandType) {
        case 'upload_waypoints':
          await handleWaypointUpload(io, droneId, command);
          break;
        case 'start_mission':
          await handleStartMission(io, droneId, command);
          break;
        case 'cancel_mission':
          await handleCancelMission(io, droneId, command);
          break;
        case 'clear_waypoints':
          await handleClearWaypoints(io, droneId, command);
          break;
        default:
          // Non-mission commands are handled by existing command handler
          break;
      }
    } catch (error) {
      logger.error('❌ Error processing mission command:', error);
    }
  });

  return () => {
    subscriber.punsubscribe('drone:*:commands');
    subscriber.quit();
  };
};

const handleWaypointUpload = async (io: Server, droneId: string, command: any) => {
  try {
    logger.info(`🗺️ Uploading waypoints to drone ${droneId}`);
    
    const missionData: MissionData = command.parameters;
    const missionId = `mission_${Date.now()}_${droneId}`;
    
    // Store mission data for safety/audit
    await storeMissionData(missionId, {
      ...missionData,
      missionId,
      droneId,
      commandId: command.id,
      status: 'uploaded'
    });
    
    // Convert to ROS-compatible format
    const rosWaypoints = convertToROSFormat(missionData.waypoints);
    
    // Find drone connection
    const droneConnection = global.connectedDrones[droneId];
    if (!droneConnection) {
      logger.warn(`⚠️ Drone ${droneId} not connected for waypoint upload`);
      await publishCommandResponse(droneId, command.id, false, 'Drone not connected');
      return;
    }
    
    const socket = io.sockets.sockets.get(droneConnection.socketId);
    if (!socket) {
      logger.warn(`⚠️ Socket not found for drone ${droneId}`);
      await publishCommandResponse(droneId, command.id, false, 'Socket not found');
      return;
    }
    
    // Send waypoint file content to drone (ROS format)
    socket.emit('waypoint_mission', {
      id: command.id,
      action: 'upload',
      missionId: missionId,
      fileContent: generateQGCWaypointFile(rosWaypoints),
      waypointCount: rosWaypoints.length,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`✅ Waypoint upload sent to drone ${droneId}: ${rosWaypoints.length} waypoints`);
    
    // Store success response
    await publishCommandResponse(droneId, command.id, true, `Waypoints uploaded: ${rosWaypoints.length} points`);
    
  } catch (error) {
    logger.error(`❌ Error uploading waypoints to ${droneId}:`, error);
    await publishCommandResponse(droneId, command.id, false, error instanceof Error ? error.message : 'Upload failed');
  }
};

const handleStartMission = async (io: Server, droneId: string, command: any) => {
  try {
    logger.info(`🚀 Starting mission for drone ${droneId}`);
    
    const droneConnection = global.connectedDrones[droneId];
    if (!droneConnection) {
      await publishCommandResponse(droneId, command.id, false, 'Drone not connected');
      return;
    }
    
    const socket = io.sockets.sockets.get(droneConnection.socketId);
    if (!socket) {
      await publishCommandResponse(droneId, command.id, false, 'Socket not found');
      return;
    }
    
    // Send start mission command
    socket.emit('waypoint_mission', {
      id: command.id,
      action: 'start',
      missionId: command.parameters.missionId,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`✅ Start mission command sent to drone ${droneId}`);
    await publishCommandResponse(droneId, command.id, true, 'Mission start command sent');
    
  } catch (error) {
    logger.error(`❌ Error starting mission for ${droneId}:`, error);
    await publishCommandResponse(droneId, command.id, false, error instanceof Error ? error.message : 'Start failed');
  }
};

const handleCancelMission = async (io: Server, droneId: string, command: any) => {
  try {
    logger.info(`🛑 Cancelling mission for drone ${droneId}`);
    
    const droneConnection = global.connectedDrones[droneId];
    if (!droneConnection) {
      await publishCommandResponse(droneId, command.id, false, 'Drone not connected');
      return;
    }
    
    const socket = io.sockets.sockets.get(droneConnection.socketId);
    if (!socket) {
      await publishCommandResponse(droneId, command.id, false, 'Socket not found');
      return;
    }
    
    // Send cancel mission command
    socket.emit('waypoint_mission', {
      id: command.id,
      action: 'cancel',
      missionId: command.parameters.missionId,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`✅ Cancel mission command sent to drone ${droneId}`);
    await publishCommandResponse(droneId, command.id, true, 'Mission cancelled, drone will land safely');
    
  } catch (error) {
    logger.error(`❌ Error cancelling mission for ${droneId}:`, error);
    await publishCommandResponse(droneId, command.id, false, error instanceof Error ? error.message : 'Cancel failed');
  }
};

const handleClearWaypoints = async (io: Server, droneId: string, command: any) => {
  try {
    logger.info(`🧹 Clearing waypoints for drone ${droneId}`);
    
    const droneConnection = global.connectedDrones[droneId];
    if (!droneConnection) {
      await publishCommandResponse(droneId, command.id, false, 'Drone not connected');
      return;
    }
    
    const socket = io.sockets.sockets.get(droneConnection.socketId);
    if (!socket) {
      await publishCommandResponse(droneId, command.id, false, 'Socket not found');
      return;
    }
    
    // Send clear waypoints command
    socket.emit('waypoint_mission', {
      id: command.id,
      action: 'clear',
      missionId: command.parameters.missionId,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`✅ Clear waypoints command sent to drone ${droneId}`);
    await publishCommandResponse(droneId, command.id, true, 'Waypoints cleared successfully');
    
  } catch (error) {
    logger.error(`❌ Error clearing waypoints for ${droneId}:`, error);
    await publishCommandResponse(droneId, command.id, false, error instanceof Error ? error.message : 'Clear failed');
  }
};

// Convert frontend waypoints to ROS-compatible format
const convertToROSFormat = (waypoints: Waypoint[]) => {
  return waypoints.map((wp, index) => ({
    seq: index,
    frame: wp.frame || 3, // 3 = MAV_FRAME_GLOBAL_RELATIVE_ALT
    command: wp.command || 16, // 16 = MAV_CMD_NAV_WAYPOINT
    is_current: index === 0,
    autocontinue: true,
    param1: wp.param1 || 0, // Hold time
    param2: wp.param2 || 0, // Accept radius
    param3: wp.param3 || 0, // Pass radius
    param4: wp.param4 || 0, // Yaw
    x_lat: wp.lat,
    y_long: wp.lng,
    z_alt: wp.alt
  }));
};

// Generate QGC waypoint file format for ROS
const generateQGCWaypointFile = (waypoints: any[]): string => {
  let content = 'QGC WPL 110\n';
  
  waypoints.forEach((wp, index) => {
    const line = [
      index, // seq
      wp.is_current ? 1 : 0, // current
      wp.frame, // frame
      wp.command, // command
      wp.param1, // param1
      wp.param2, // param2
      wp.param3, // param3
      wp.param4, // param4
      wp.x_lat, // x/lat
      wp.y_long, // y/long
      wp.z_alt, // z/alt
      wp.autocontinue ? 1 : 0 // autocontinue
    ].join('\t');
    
    content += line + '\n';
  });
  
  return content;
};

// Publish command response back to Redis
const publishCommandResponse = async (droneId: string, commandId: any, success: boolean, message: string) => {
  try {
    await redisClient.publish(
      `drone:${droneId}:command_responses`,
      JSON.stringify({
        commandId,
        success,
        message,
        timestamp: new Date().toISOString()
      })
    );
  } catch (error) {
    logger.error(`Failed to publish command response for ${droneId}:`, error);
  }
};