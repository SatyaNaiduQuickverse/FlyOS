// services/drone-connection-service/src/mockData.ts - FIXED CAMERA STREAMING
import { io as Client } from 'socket.io-client';
import { logger } from './utils/logger';

interface MockDrone {
  id: string;
  model: string;
  baseLocation: { lat: number; lng: number };
  socket?: any;
  telemetryInterval?: NodeJS.Timeout;
  cameraInterval?: NodeJS.Timeout;
  cameraStreamActive: Map<string, boolean>; // Track stream status per camera
  streamStartSent: Map<string, boolean>; // FIXED: Track if start event was sent
}

const MOCK_DRONES: MockDrone[] = [
  { id: 'drone-001', model: 'FlyOS_MQ7', baseLocation: { lat: 18.5204, lng: 73.8567 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-002', model: 'FlyOS_MQ5', baseLocation: { lat: 19.0760, lng: 72.8777 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-003', model: 'FlyOS_MQ9', baseLocation: { lat: 28.7041, lng: 77.1025 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-004', model: 'FlyOS_MQ7', baseLocation: { lat: 12.9716, lng: 77.5946 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-005', model: 'FlyOS_MQ5', baseLocation: { lat: 22.5726, lng: 88.3639 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-006', model: 'FlyOS_MQ9', baseLocation: { lat: 13.0827, lng: 80.2707 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-007', model: 'FlyOS_MQ7', baseLocation: { lat: 23.0225, lng: 72.5714 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-008', model: 'FlyOS_MQ5', baseLocation: { lat: 26.9124, lng: 75.7873 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-009', model: 'FlyOS_MQ9', baseLocation: { lat: 17.3850, lng: 78.4867 }, cameraStreamActive: new Map(), streamStartSent: new Map() },
  { id: 'drone-010', model: 'FlyOS_MQ7', baseLocation: { lat: 15.2993, lng: 74.1240 }, cameraStreamActive: new Map(), streamStartSent: new Map() }
];

class MockDroneSimulator {
  private connectionUrl: string;
  private activeDrones: Map<string, MockDrone> = new Map();

  constructor(connectionUrl = 'http://localhost:4005') {
    this.connectionUrl = connectionUrl;
  }

  async startSimulation() {
    logger.info('🚁 Starting FIXED mock drone simulation (no camera spam)...');

    for (const drone of MOCK_DRONES) {
      await this.connectDrone(drone);
      await this.sleep(500); // Stagger connections
    }

    logger.info(`✅ ${MOCK_DRONES.length} mock drones connected with FIXED camera streaming`);
  }

  private async connectDrone(drone: MockDrone) {
    try {
      const socket = Client(this.connectionUrl, {
        transports: ['websocket']
      });

      socket.on('connect', () => {
        logger.info(`🔗 ${drone.id} connected`);
        
        socket.emit('drone_register', {
          droneId: drone.id,
          model: drone.model,
          version: '1.0-production'
        });
      });

      socket.on('registration_success', () => {
        logger.info(`✅ ${drone.id} registered successfully`);
        this.startTelemetryTransmission(drone, socket);
        this.startFixedCameraStreaming(drone, socket); // FIXED: New camera method
      });

      socket.on('command', (command) => {
        logger.info(`📡 ${drone.id} received command:`, command.type);
        this.handleCommand(drone, socket, command);
      });

      socket.on('disconnect', () => {
        logger.info(`📴 ${drone.id} disconnected`);
        this.stopTelemetryTransmission(drone);
        this.stopCameraStreaming(drone);
      });

      socket.on('error', (error) => {
        logger.error(`❌ Socket error for ${drone.id}:`, error);
      });

      drone.socket = socket;
      this.activeDrones.set(drone.id, drone);

    } catch (error) {
      logger.error(`❌ Failed to connect ${drone.id}:`, error);
    }
  }

  private startTelemetryTransmission(drone: MockDrone, socket: any) {
    let altitude = 100;
    let direction = 0;
    let speed = 0;
    let battery = 100;

    drone.telemetryInterval = setInterval(() => {
      const radiusKm = 0.001;
      const offsetLat = (Math.sin(direction * Math.PI / 180) * radiusKm);
      const offsetLng = (Math.cos(direction * Math.PI / 180) * radiusKm);

      const currentLat = drone.baseLocation.lat + offsetLat;
      const currentLng = drone.baseLocation.lng + offsetLng;

      direction += (Math.random() - 0.5) * 10;
      altitude += (Math.random() - 0.5) * 5;
      speed = Math.max(0, Math.min(15, speed + (Math.random() - 0.5) * 2));
      battery = Math.max(0, battery - 0.001);

      const telemetryData = {
        timestamp: new Date().toISOString(),
        latitude: currentLat,
        longitude: currentLng,
        altitude_msl: altitude + 500,
        altitude_relative: altitude,
        armed: true,
        flight_mode: ['AUTO', 'GUIDED', 'LOITER'][Math.floor(Math.random() * 3)],
        connected: true,
        gps_fix: 'GPS_OK',
        satellites: 12 + Math.floor(Math.random() * 6),
        hdop: 0.8 + Math.random() * 0.4,
        position_error: Math.random() * 2,
        voltage: 22.2 + (Math.random() - 0.5) * 2,
        current: 15 + Math.random() * 10,
        percentage: Math.floor(battery),
        roll: (Math.random() - 0.5) * 0.2,
        pitch: (Math.random() - 0.5) * 0.2,
        yaw: direction * Math.PI / 180,
        velocity_x: speed * Math.cos(direction * Math.PI / 180),
        velocity_y: speed * Math.sin(direction * Math.PI / 180),
        velocity_z: (Math.random() - 0.5) * 2,
        latency: 50 + Math.random() * 100,
        teensy_connected: true,
        latch_status: 'OK'
      };

      socket.emit('telemetry', telemetryData);

      if (Math.random() < 0.2) {
        socket.emit('heartbeat');
      }

    }, 100); // 10Hz telemetry
  }

  // FIXED: New camera streaming method that prevents spam
  private startFixedCameraStreaming(drone: MockDrone, socket: any) {
    logger.info(`📹 Starting FIXED camera streams for ${drone.id} (anti-spam)`);
    
    // Initialize cameras as inactive and not started
    ['front', 'bottom'].forEach(camera => {
      drone.cameraStreamActive.set(camera, false);
      drone.streamStartSent.set(camera, false); // FIXED: Track start events
    });
    
    // Send camera start events ONLY ONCE
    ['front', 'bottom'].forEach(camera => {
      if (!drone.streamStartSent.get(camera)) {
        socket.emit('camera_stream_start', {
          droneId: drone.id,
          camera: camera,
          config: {
            resolution: '1920x1080',
            fps: 30,
            quality: 'high'
          }
        });
        
        drone.cameraStreamActive.set(camera, true);
        drone.streamStartSent.set(camera, true); // FIXED: Mark as sent
        
        logger.info(`📹 Camera stream started: ${drone.id}:${camera} (ONCE ONLY)`);
      }
    });

    // Send frames at stable 15 FPS - NO MORE START EVENTS
    drone.cameraInterval = setInterval(() => {
      ['front', 'bottom'].forEach(camera => {
        // Only send frames if stream is active (no more start events)
        if (drone.cameraStreamActive.get(camera)) {
          const mockFrame = this.generateProfessionalFrame(drone.id, camera);
          socket.emit('camera_frame', {
            droneId: drone.id,
            camera: camera,
            timestamp: new Date().toISOString(),
            frame: mockFrame,
            metadata: {
              resolution: '1920x1080',
              fps: 15,
              quality: 85,
              frameNumber: Math.floor(Date.now() / 67),
              bandwidth: '2.5 Mbps'
            }
          });
        }
      });
    }, 67); // Stable 15 FPS (1000ms / 15 = 67ms)

    // Listen for camera control events (but don't send more start events)
    socket.on('camera_stream_ack', (data: any) => {
      if (data.droneId === drone.id) {
        logger.info(`📹 Camera stream ack: ${drone.id}:${data.camera} - ${data.status}`);
        
        if (data.status === 'stopped') {
          drone.cameraStreamActive.set(data.camera, false);
          // FIXED: Don't reset streamStartSent - prevents restart spam
        } else if (data.status === 'started') {
          drone.cameraStreamActive.set(data.camera, true);
          // FIXED: Don't send another start event
        }
      }
    });
  }

  private generateProfessionalFrame(droneId: string, camera: string): string {
    const timestamp = Date.now();
    const frameData = {
      type: 'production_camera_frame',
      droneId: droneId,
      camera: camera,
      timestamp: timestamp,
      frameNumber: Math.floor(timestamp / 67),
      
      // Realistic camera parameters
      exposure: camera === 'front' ? 1/500 : 1/250,
      iso: 100 + Math.random() * 200,
      focus_distance: 5 + Math.random() * 95,
      white_balance: 5600 + Math.random() * 400,
      
      // Simulate different views
      scene_brightness: camera === 'front' ? 180 + Math.random() * 40 : 120 + Math.random() * 60,
      contrast: 1.0 + (Math.random() - 0.5) * 0.2,
      saturation: 1.0 + (Math.random() - 0.5) * 0.1,
      
      // Motion simulation
      gimbal_roll: Math.sin(timestamp / 5000) * 2,
      gimbal_pitch: Math.cos(timestamp / 7000) * 3,
      gimbal_yaw: Math.sin(timestamp / 10000) * 5,
      
      // AI/CV features
      objects_detected: Math.floor(Math.random() * 3),
      faces_detected: camera === 'front' ? Math.floor(Math.random() * 2) : 0,
      motion_vectors: Array.from({length: 5}, () => ({
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 10
      })),
      
      // Quality metrics
      sharpness: 0.8 + Math.random() * 0.2,
      noise_level: Math.random() * 0.1,
      compression_ratio: 0.15 + Math.random() * 0.05
    };
    
    return Buffer.from(JSON.stringify(frameData)).toString('base64');
  }

  private stopCameraStreaming(drone: MockDrone) {
    if (drone.cameraInterval) {
      clearInterval(drone.cameraInterval);
      drone.cameraInterval = undefined;
      
      if (drone.socket) {
        ['front', 'bottom'].forEach(camera => {
          drone.socket.emit('camera_stream_stop', {
            droneId: drone.id,
            camera: camera
          });
          drone.cameraStreamActive.set(camera, false);
          // FIXED: Reset start tracking on stop
          drone.streamStartSent.set(camera, false);
        });
      }
      
      logger.info(`📹 Stopped camera streams for ${drone.id}`);
    }
  }

  private stopTelemetryTransmission(drone: MockDrone) {
    if (drone.telemetryInterval) {
      clearInterval(drone.telemetryInterval);
      drone.telemetryInterval = undefined;
    }
  }

  private handleCommand(drone: MockDrone, socket: any, command: any) {
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
    logger.info('🛑 Stopping FIXED mock drone simulation...');
    
    for (const drone of this.activeDrones.values()) {
      this.stopTelemetryTransmission(drone);
      this.stopCameraStreaming(drone);
      if (drone.socket) {
        drone.socket.disconnect();
      }
    }
    
    this.activeDrones.clear();
    logger.info('✅ FIXED simulation stopped');
  }
}

// Run simulation if executed directly
if (require.main === module) {
  const simulator = new MockDroneSimulator();
  
  process.on('SIGINT', async () => {
    await simulator.stopSimulation();
    process.exit(0);
  });
  
  simulator.startSimulation().catch(console.error);
}

export { MockDroneSimulator };