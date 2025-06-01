// services/drone-connection-service/src/mockData.ts
import { io as Client } from 'socket.io-client';
import { logger } from './utils/logger';

interface MockDrone {
  id: string;
  model: string;
  baseLocation: { lat: number; lng: number };
  socket?: any;
  telemetryInterval?: NodeJS.Timeout;
}

const MOCK_DRONES: MockDrone[] = [
  { id: 'drone-001', model: 'FlyOS_MQ7', baseLocation: { lat: 18.5204, lng: 73.8567 } }, // Pune
  { id: 'drone-002', model: 'FlyOS_MQ5', baseLocation: { lat: 19.0760, lng: 72.8777 } }, // Mumbai
  { id: 'drone-003', model: 'FlyOS_MQ9', baseLocation: { lat: 28.7041, lng: 77.1025 } }, // Delhi
  { id: 'drone-004', model: 'FlyOS_MQ7', baseLocation: { lat: 12.9716, lng: 77.5946 } }, // Bangalore
  { id: 'drone-005', model: 'FlyOS_MQ5', baseLocation: { lat: 22.5726, lng: 88.3639 } }, // Kolkata
  { id: 'drone-006', model: 'FlyOS_MQ9', baseLocation: { lat: 13.0827, lng: 80.2707 } }, // Chennai
  { id: 'drone-007', model: 'FlyOS_MQ7', baseLocation: { lat: 23.0225, lng: 72.5714 } }, // Ahmedabad
  { id: 'drone-008', model: 'FlyOS_MQ5', baseLocation: { lat: 26.9124, lng: 75.7873 } }, // Jaipur
  { id: 'drone-009', model: 'FlyOS_MQ9', baseLocation: { lat: 17.3850, lng: 78.4867 } }, // Hyderabad
  { id: 'drone-010', model: 'FlyOS_MQ7', baseLocation: { lat: 15.2993, lng: 74.1240 } }  // Goa
];

class MockDroneSimulator {
  private connectionUrl: string;
  private activeDrones: Map<string, MockDrone> = new Map();

  constructor(connectionUrl = 'http://localhost:4005') {
    this.connectionUrl = connectionUrl;
  }

  async startSimulation() {
    logger.info('🚁 Starting mock drone simulation...');

    for (const drone of MOCK_DRONES) {
      await this.connectDrone(drone);
      // Stagger connections
      await this.sleep(500);
    }

    logger.info(`✅ ${MOCK_DRONES.length} mock drones connected and transmitting`);
  }

  private async connectDrone(drone: MockDrone) {
    try {
      const socket = Client(this.connectionUrl, {
        transports: ['websocket']
      });

      socket.on('connect', () => {
        logger.info(`🔗 ${drone.id} connected`);
        
        // Register drone
        socket.emit('drone_register', {
          droneId: drone.id,
          model: drone.model,
          version: '1.0-mock'
        });
      });

      socket.on('registration_success', () => {
        logger.info(`✅ ${drone.id} registered successfully`);
        this.startTelemetryTransmission(drone, socket);
      });

      socket.on('command', (command) => {
        logger.info(`📡 ${drone.id} received command:`, command);
        this.handleCommand(drone, socket, command);
      });

      socket.on('disconnect', () => {
        logger.info(`📴 ${drone.id} disconnected`);
        this.stopTelemetryTransmission(drone);
      });

      drone.socket = socket;
      this.activeDrones.set(drone.id, drone);

    } catch (error) {
      logger.error(`❌ Failed to connect ${drone.id}:`, error);
    }
  }

  private startTelemetryTransmission(drone: MockDrone, socket: any) {
    let altitude = 100; // Starting altitude
    let direction = 0; // Direction in degrees
    let speed = 0; // Speed in m/s
    let battery = 100; // Battery percentage

    drone.telemetryInterval = setInterval(() => {
      // Simulate movement
      const radiusKm = 0.001; // Small radius for realistic movement
      const offsetLat = (Math.sin(direction * Math.PI / 180) * radiusKm);
      const offsetLng = (Math.cos(direction * Math.PI / 180) * radiusKm);

      // Update position
      const currentLat = drone.baseLocation.lat + offsetLat;
      const currentLng = drone.baseLocation.lng + offsetLng;

      // Simulate realistic changes
      direction += (Math.random() - 0.5) * 10; // Small direction changes
      altitude += (Math.random() - 0.5) * 5; // Small altitude changes
      speed = Math.max(0, Math.min(15, speed + (Math.random() - 0.5) * 2)); // 0-15 m/s
      battery = Math.max(0, battery - 0.001); // Slow battery drain

      const telemetryData = {
        timestamp: new Date().toISOString(),
        
        // Position
        latitude: currentLat,
        longitude: currentLng,
        altitude_msl: altitude + 500, // MSL = relative + ground elevation
        altitude_relative: altitude,
        
        // State
        armed: true,
        flight_mode: ['AUTO', 'GUIDED', 'LOITER'][Math.floor(Math.random() * 3)],
        connected: true,
        
        // GPS
        gps_fix: 'GPS_OK',
        satellites: 12 + Math.floor(Math.random() * 6),
        hdop: 0.8 + Math.random() * 0.4,
        position_error: Math.random() * 2,
        
        // Battery
        voltage: 22.2 + (Math.random() - 0.5) * 2,
        current: 15 + Math.random() * 10,
        percentage: Math.floor(battery),
        
        // Orientation (radians)
        roll: (Math.random() - 0.5) * 0.2,
        pitch: (Math.random() - 0.5) * 0.2,
        yaw: direction * Math.PI / 180,
        
        // Velocity
        velocity_x: speed * Math.cos(direction * Math.PI / 180),
        velocity_y: speed * Math.sin(direction * Math.PI / 180),
        velocity_z: (Math.random() - 0.5) * 2,
        
        // Meta
        latency: 50 + Math.random() * 100,
        teensy_connected: true,
        latch_status: 'OK'
      };

      socket.emit('telemetry', telemetryData);

      // Send heartbeat every 5 transmissions
      if (Math.random() < 0.2) {
        socket.emit('heartbeat');
      }

    }, 100); // 10Hz (every 100ms)
  }

  private stopTelemetryTransmission(drone: MockDrone) {
    if (drone.telemetryInterval) {
      clearInterval(drone.telemetryInterval);
      drone.telemetryInterval = undefined;
    }
  }

  private handleCommand(drone: MockDrone, socket: any, command: any) {
    // Simulate command execution delay
    setTimeout(() => {
      socket.emit('command_response', {
        commandId: command.id || Date.now(),
        command: command.type || command.commandType,
        status: 'executed',
        result: 'success',
        timestamp: new Date().toISOString()
      });
    }, 100 + Math.random() * 500);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stopSimulation() {
    logger.info('🛑 Stopping mock drone simulation...');
    
    for (const drone of this.activeDrones.values()) {
      this.stopTelemetryTransmission(drone);
      if (drone.socket) {
        drone.socket.disconnect();
      }
    }
    
    this.activeDrones.clear();
    logger.info('✅ Mock simulation stopped');
  }
}

// Run simulation if file is executed directly
if (require.main === module) {
  const simulator = new MockDroneSimulator();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await simulator.stopSimulation();
    process.exit(0);
  });
  
  simulator.startSimulation().catch(console.error);
}

export { MockDroneSimulator };