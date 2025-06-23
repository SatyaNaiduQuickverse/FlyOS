# services/drone-connection-service/src/clients/python-mock/drone_simulator.py
import asyncio
import json
import time
import random
import math
import logging
import argparse
import uuid
from typing import Dict, Any, Optional
import socketio
import aiohttp
import cv2
import numpy as np
from dataclasses import dataclass, asdict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class DroneConfig:
    drone_id: str
    model: str
    base_lat: float
    base_lng: float
    jetson_serial: str
    capabilities: list
    telemetry_rate: float = 10.0  # Hz
    heartbeat_rate: float = 0.1   # Hz
    mavros_rate: float = 1.0      # Hz

@dataclass
class DroneState:
    latitude: float
    longitude: float
    altitude_msl: float
    altitude_relative: float
    armed: bool
    flight_mode: str
    connected: bool
    gps_fix: str
    satellites: int
    hdop: float
    position_error: float
    voltage: float
    current: float
    percentage: float
    roll: float
    pitch: float
    yaw: float
    velocity_x: float
    velocity_y: float
    velocity_z: float
    latency: float
    teensy_connected: bool
    latch_status: str
    
class MockDrone:
    def __init__(self, config: DroneConfig, server_url: str):
        self.config = config
        self.server_url = server_url
        self.ws_url = server_url.replace('http', 'ws') + ':4005'
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=10,
            reconnection_delay=5
        )
        
        # State variables
        self.state = DroneState(
            latitude=config.base_lat,
            longitude=config.base_lng,
            altitude_msl=500.0,
            altitude_relative=100.0,
            armed=True,
            flight_mode='AUTO',
            connected=False,
            gps_fix='GPS_OK',
            satellites=12,
            hdop=0.8,
            position_error=1.0,
            voltage=22.2,
            current=15.0,
            percentage=85.0,
            roll=0.0,
            pitch=0.0,
            yaw=0.0,
            velocity_x=0.0,
            velocity_y=0.0,
            velocity_z=0.0,
            latency=50.0,
            teensy_connected=True,
            latch_status='OK'
        )
        
        # Animation variables
        self.direction = random.uniform(0, 360)
        self.flight_time = 0
        self.mission_active = False
        self.precision_landing_active = False
        
        # Connection state
        self.registered = False
        self.session_token = None
        
        # Tasks
        self.tasks = []
        
        # Setup event handlers
        self.setup_event_handlers()
        
    def setup_event_handlers(self):
        @self.sio.event
        async def connect():
            logger.info(f"🔗 [{self.config.drone_id}] Connected to server")
            await self.register_drone()
            
        @self.sio.event
        async def disconnect():
            logger.warning(f"📴 [{self.config.drone_id}] Disconnected from server")
            self.state.connected = False
            self.registered = False
            
        @self.sio.event
        async def registration_success(data):
            logger.info(f"✅ [{self.config.drone_id}] Registration successful: {data}")
            self.registered = True
            self.state.connected = True
            await self.start_data_streams()
            
        @self.sio.event
        async def registration_failed(data):
            logger.error(f"❌ [{self.config.drone_id}] Registration failed: {data}")
            
        @self.sio.event
        async def command(data):
            await self.handle_command(data)
            
        @self.sio.event
        async def heartbeat_ack(data):
            if 'connectionQuality' in data:
                logger.debug(f"💗 [{self.config.drone_id}] Heartbeat ack - Quality: {data['connectionQuality']}%")
                
        @self.sio.event
        async def telemetry_ack(data):
            if 'latency' in data:
                self.state.latency = data['latency']
                
        @self.sio.event
        async def webrtc_request_offer(data):
            await self.handle_webrtc_offer_request(data)
            
        @self.sio.event
        async def webrtc_answer(data):
            await self.handle_webrtc_answer(data)
            
        @self.sio.event
        async def webrtc_ice_candidate(data):
            await self.handle_webrtc_ice_candidate(data)
            
    async def discover_server(self) -> bool:
        """Initial server discovery"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.server_url}/drone/discover") as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"🔍 [{self.config.drone_id}] Server discovered: {data['message']}")
                        return True
                    else:
                        logger.error(f"❌ [{self.config.drone_id}] Discovery failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Discovery error: {e}")
            return False
            
    async def register_with_server(self) -> bool:
        """Register with the server via HTTP"""
        try:
            registration_data = {
                'droneId': self.config.drone_id,
                'model': self.config.model,
                'version': '2.0-python-mock',
                'jetsonSerial': self.config.jetson_serial,
                'capabilities': self.config.capabilities,
                'systemInfo': {
                    'cpuCores': 4,
                    'ramGB': 4,
                    'storageGB': 32,
                    'gpuModel': 'Maxwell',
                    'osVersion': 'Ubuntu 18.04'
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.server_url}/drone/register",
                    json=registration_data
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.session_token = data['sessionToken']
                        logger.info(f"📝 [{self.config.drone_id}] HTTP registration successful")
                        return True
                    else:
                        logger.error(f"❌ [{self.config.drone_id}] HTTP registration failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] HTTP registration error: {e}")
            return False
            
    async def register_drone(self):
        """Register drone via WebSocket"""
        registration_data = {
            'droneId': self.config.drone_id,
            'model': self.config.model,
            'version': '2.0-python-mock',
            'capabilities': self.config.capabilities,
            'jetsonInfo': {
                'ip': '192.168.1.100',
                'serialNumber': self.config.jetson_serial,
                'gpuMemory': 4096
            }
        }
        
        await self.sio.emit('drone_register_real', registration_data)
        logger.info(f"📝 [{self.config.drone_id}] WebSocket registration sent")
        
    async def start_data_streams(self):
        """Start all data streaming tasks"""
        if not self.registered:
            return
            
        # Telemetry stream
        self.tasks.append(asyncio.create_task(self.telemetry_stream()))
        
        # Heartbeat stream
        self.tasks.append(asyncio.create_task(self.heartbeat_stream()))
        
        # MAVROS stream
        self.tasks.append(asyncio.create_task(self.mavros_stream()))
        
        # State animation
        self.tasks.append(asyncio.create_task(self.animate_state()))
        
        logger.info(f"🎬 [{self.config.drone_id}] All data streams started")
        
    async def telemetry_stream(self):
        """Send telemetry data at specified rate"""
        interval = 1.0 / self.config.telemetry_rate
        
        while self.registered:
            try:
                # Add some realistic noise
                telemetry_data = asdict(self.state)
                telemetry_data.update({
                    'timestamp': time.time() * 1000,  # milliseconds
                    'jetsonTimestamp': time.time() * 1000,
                    'droneType': 'REAL',
                    'sessionId': self.session_token
                })
                
                await self.sio.emit('telemetry_real', telemetry_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Telemetry error: {e}")
                await asyncio.sleep(interval)
                
    async def heartbeat_stream(self):
        """Send heartbeat at specified rate"""
        interval = 1.0 / self.config.heartbeat_rate
        
        while self.registered:
            try:
                heartbeat_data = {
                    'timestamp': time.time() * 1000,
                    'jetsonMetrics': {
                        'cpuUsage': random.uniform(20, 60),
                        'memoryUsage': random.uniform(40, 80),
                        'temperature': random.uniform(45, 65),
                        'diskUsage': random.uniform(30, 70)
                    },
                    'networkMetrics': {
                        'latency': random.uniform(10, 100),
                        'packetLoss': random.uniform(0, 0.5),
                        'bandwidth': random.uniform(50, 100)
                    }
                }
                
                await self.sio.emit('heartbeat_real', heartbeat_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Heartbeat error: {e}")
                await asyncio.sleep(interval)
                
    async def mavros_stream(self):
        """Send MAVROS messages at specified rate"""
        interval = 1.0 / self.config.mavros_rate
        
        mavros_messages = [
            "[INFO] MAVLink connection established",
            "[INFO] GPS position received",
            "[INFO] Battery status updated",
            "[WARN] Wind speed above normal",
            "[INFO] Mission waypoint reached",
            "[INFO] Altitude hold engaged",
            "[WARN] Signal strength low",
            "[INFO] Gimbal position updated"
        ]
        
        while self.registered:
            try:
                message = random.choice(mavros_messages)
                if random.random() < 0.05:  # 5% chance of error message
                    message = "[ERROR] Communication timeout detected"
                    
                mavros_data = {
                    'message': message,
                    'rawMessage': f"[{time.strftime('%H:%M:%S')}] {message}",
                    'source': 'jetson_mavros',
                    'timestamp': time.time() * 1000,
                    'sessionId': self.session_token or 'default'
                }
                
                await self.sio.emit('mavros_real', mavros_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] MAVROS error: {e}")
                await asyncio.sleep(interval)
                
    async def animate_state(self):
        """Animate drone state for realistic movement"""
        while self.registered:
            try:
                self.flight_time += 0.1
                
                # Simulate circular flight pattern
                radius_km = 0.001  # 1km radius
                angular_speed = 0.1  # radians per update
                
                # Update position
                angle = self.flight_time * angular_speed
                self.state.latitude = self.config.base_lat + math.sin(angle) * radius_km
                self.state.longitude = self.config.base_lng + math.cos(angle) * radius_km
                
                # Update altitude with small variations
                self.state.altitude_relative = 100 + math.sin(self.flight_time * 0.5) * 10
                self.state.altitude_msl = self.state.altitude_relative + 500
                
                # Update orientation
                self.state.yaw = angle
                self.state.roll = math.sin(self.flight_time) * 0.1
                self.state.pitch = math.cos(self.flight_time * 0.7) * 0.1
                
                # Update velocity
                speed = 5.0  # m/s
                self.state.velocity_x = speed * math.cos(angle)
                self.state.velocity_y = speed * math.sin(angle)
                self.state.velocity_z = math.sin(self.flight_time * 0.3) * 0.5
                
                # Simulate battery drain
                self.state.percentage = max(20, self.state.percentage - 0.001)
                self.state.voltage = 22.2 * (self.state.percentage / 100)
                
                # Add some noise to GPS
                self.state.hdop = 0.8 + random.uniform(-0.2, 0.2)
                self.state.position_error = 1.0 + random.uniform(-0.3, 0.3)
                
                await asyncio.sleep(0.1)  # 10Hz animation
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Animation error: {e}")
                await asyncio.sleep(0.1)
                
    async def handle_command(self, data):
        """Handle incoming commands"""
        command_type = data.get('type') or data.get('commandType')
        parameters = data.get('parameters', {})
        command_id = data.get('id')
        
        logger.info(f"📡 [{self.config.drone_id}] Received command: {command_type}")
        
        # Simulate command processing delay
        await asyncio.sleep(random.uniform(0.1, 0.5))
        
        # Handle specific commands
        if command_type == 'arm':
            self.state.armed = True
            self.state.flight_mode = 'GUIDED'
        elif command_type == 'disarm':
            self.state.armed = False
            self.state.flight_mode = 'STABILIZE'
        elif command_type == 'takeoff':
            self.state.flight_mode = 'GUIDED'
            self.state.altitude_relative = parameters.get('altitude', 50)
        elif command_type == 'land':
            self.state.flight_mode = 'LAND'
        elif command_type == 'rtl':
            self.state.flight_mode = 'RTL'
        elif command_type == 'precision_land':
            await self.start_precision_landing()
        elif command_type == 'abort_precision_land':
            await self.abort_precision_landing()
            
        # Send command response
        response = {
            'commandId': command_id,
            'command': command_type,
            'status': 'executed',
            'result': 'success',
            'timestamp': time.time() * 1000
        }
        
        await self.sio.emit('command_response', response)
        
    async def start_precision_landing(self):
        """Simulate precision landing sequence"""
        if self.precision_landing_active:
            return
            
        self.precision_landing_active = True
        logger.info(f"🎯 [{self.config.drone_id}] Starting precision landing sequence")
        
        stages = ['APPROACH', 'DESCENT', 'FINAL', 'LANDED']
        
        for stage in stages:
            if not self.precision_landing_active:
                break
                
            precision_data = {
                'output': f"Precision landing {stage.lower()} phase initiated",
                'stage': stage,
                'altitude': self.state.altitude_relative,
                'target_detected': random.random() > 0.2,  # 80% detection rate
                'target_confidence': random.uniform(0.7, 0.95),
                'lateral_error': random.uniform(0, 2.0),
                'vertical_error': random.uniform(0, 1.0),
                'battery_level': self.state.percentage,
                'wind_speed': random.uniform(0, 5.0)
            }
            
            await self.sio.emit('precision_land_real', precision_data)
            
            # Simulate altitude descent
            if stage in ['DESCENT', 'FINAL']:
                self.state.altitude_relative *= 0.7
                
            await asyncio.sleep(2.0)  # Each stage takes 2 seconds
            
        self.precision_landing_active = False
        self.state.flight_mode = 'LAND'
        
    async def abort_precision_landing(self):
        """Abort precision landing"""
        if self.precision_landing_active:
            self.precision_landing_active = False
            logger.info(f"🚫 [{self.config.drone_id}] Precision landing aborted")
            
            abort_data = {
                'output': 'Precision landing aborted by command',
                'stage': 'ABORTED',
                'altitude': self.state.altitude_relative
            }
            
            await self.sio.emit('precision_land_real', abort_data)
            self.state.flight_mode = 'LOITER'
            
    async def handle_webrtc_offer_request(self, data):
        """Handle WebRTC offer request"""
        session_id = data.get('sessionId')
        session_type = data.get('sessionType', 'camera')
        
        logger.info(f"📹 [{self.config.drone_id}] WebRTC offer requested for {session_type}")
        
        # Simulate WebRTC offer creation
        mock_offer = {
            'type': 'offer',
            'sdp': f'v=0\r\no=drone {session_id} 1 IN IP4 192.168.1.100\r\n...'
        }
        
        await self.sio.emit('webrtc_offer', {
            'offer': mock_offer,
            'droneId': self.config.drone_id,
            'sessionId': session_id
        })
        
        # Start mock camera stream if camera session
        if session_type == 'camera':
            asyncio.create_task(self.mock_camera_stream(session_id))
            
    async def handle_webrtc_answer(self, data):
        """Handle WebRTC answer"""
        session_id = data.get('sessionId')
        answer = data.get('answer')
        
        logger.info(f"📹 [{self.config.drone_id}] WebRTC answer received for session {session_id}")
        
        # Simulate ICE candidates
        for i in range(3):
            candidate = {
                'candidate': f'candidate:{i} 1 UDP 2113667326 192.168.1.{100+i} {5000+i} typ host',
                'sdpMLineIndex': 0,
                'sdpMid': 'video'
            }
            
            await self.sio.emit('webrtc_ice_candidate', {
                'candidate': candidate,
                'droneId': self.config.drone_id,
                'sessionId': session_id
            })
            
            await asyncio.sleep(0.1)
            
    async def handle_webrtc_ice_candidate(self, data):
        """Handle ICE candidate"""
        logger.debug(f"🧊 [{self.config.drone_id}] ICE candidate received")
        
    async def mock_camera_stream(self, session_id):
        """Mock camera streaming simulation"""
        logger.info(f"📸 [{self.config.drone_id}] Starting mock camera stream for session {session_id}")
        
        frame_count = 0
        while self.registered and self.precision_landing_active or frame_count < 100:
            try:
                # Generate mock frame data
                frame_data = {
                    'sessionId': session_id,
                    'frameNumber': frame_count,
                    'timestamp': time.time() * 1000,
                    'width': 1920,
                    'height': 1080,
                    'format': 'H264',
                    'data': f'mock_frame_data_{frame_count}'
                }
                
                # Simulate frame transmission (we'd use WebRTC data channel in real implementation)
                logger.debug(f"📽️ [{self.config.drone_id}] Frame {frame_count} generated")
                
                frame_count += 1
                await asyncio.sleep(1/30)  # 30 FPS
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Camera stream error: {e}")
                break
                
    async def connect(self):
        """Connect to the server"""
        try:
            # Step 1: Discover server
            if not await self.discover_server():
                return False
                
            # Step 2: Register via HTTP
            if not await self.register_with_server():
                return False
                
            # Step 3: Connect WebSocket
            await self.sio.connect(self.ws_url)
            return True
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Connection failed: {e}")
            return False
            
    async def disconnect(self):
        """Disconnect from server"""
        try:
            # Cancel all tasks
            for task in self.tasks:
                task.cancel()
                
            await self.sio.disconnect()
            logger.info(f"👋 [{self.config.drone_id}] Disconnected")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Disconnect error: {e}")
            
    async def run(self):
        """Main run loop"""
        connected = await self.connect()
        if not connected:
            logger.error(f"❌ [{self.config.drone_id}] Failed to connect")
            return
            
        try:
            # Keep running until interrupted
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info(f"🛑 [{self.config.drone_id}] Shutdown requested")
        finally:
            await self.disconnect()

def main():
    parser = argparse.ArgumentParser(description='Python Mock Drone Simulator')
    parser.add_argument('--server', default='http://localhost:4005', help='Server URL')
    parser.add_argument('--drone-id', default='python-drone-001', help='Drone ID')
    parser.add_argument('--model', default='FlyOS_MQ7_Python', help='Drone model')
    parser.add_argument('--lat', type=float, default=18.5204, help='Base latitude')
    parser.add_argument('--lng', type=float, default=73.8567, help='Base longitude')
    
    args = parser.parse_args()
    
    # Create drone configuration
    config = DroneConfig(
        drone_id=args.drone_id,
        model=args.model,
        base_lat=args.lat,
        base_lng=args.lng,
        jetson_serial=f"JETSON-{uuid.uuid4().hex[:8].upper()}",
        capabilities=[
            'telemetry',
            'camera',
            'mavros',
            'precision_landing',
            'webrtc',
            'commands'
        ]
    )
    
    # Create and run drone
    drone = MockDrone(config, args.server)
    
    try:
        asyncio.run(drone.run())
    except KeyboardInterrupt:
        logger.info("🛑 Simulator stopped by user")

if __name__ == "__main__":
    main()