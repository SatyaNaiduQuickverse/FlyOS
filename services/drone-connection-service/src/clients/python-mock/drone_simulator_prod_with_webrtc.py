# services/drone-connection-service/src/clients/python-mock/drone_simulator_prod_with_webrtc.py
import asyncio
import json
import time
import random
import math
import logging
import argparse
import uuid
import statistics
import base64
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
import socketio
import aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCDataChannel
from aiortc.contrib.signaling import object_from_string, object_to_string

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class LatencyMeasurement:
    measurement_type: str
    send_timestamp: float
    receive_timestamp: float
    latency_ms: float
    payload_size_bytes: int
    sequence_id: int
    additional_data: dict = None

@dataclass
class DroneConfig:
    drone_id: str
    model: str
    base_lat: float
    base_lng: float
    jetson_serial: str
    capabilities: list
    telemetry_rate: float = 10.0
    heartbeat_rate: float = 0.1
    mavros_rate: float = 1.0
    camera_fps: float = 30.0
    enable_latency_measurement: bool = True
    enable_camera_streaming: bool = True
    enable_webrtc: bool = True

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

class ProductionMockDroneWithWebRTC:
    def __init__(self, config: DroneConfig, server_url: str):
        self.config = config
        self.server_url = server_url
        self.ws_url = server_url.replace('http', 'ws')
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=10,
            reconnection_delay=5
        )
        
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
        
        self.direction = random.uniform(0, 360)
        self.flight_time = 0
        self.registered = False
        self.session_token = None
        self.tasks = []
        
        # WebRTC components
        self.pc: Optional[RTCPeerConnection] = None
        self.camera_data_channel: Optional[RTCDataChannel] = None
        self.webrtc_connected = False
        self.data_channel_ready = False
        
        # Camera streaming state
        self.camera_streams_active = {'front': False, 'bottom': False}
        self.camera_frame_counter = {'front': 0, 'bottom': 0}
        self.use_webrtc_for_camera = False
        
        # Latency measurement
        self.latency_measurements: List[LatencyMeasurement] = []
        self.sequence_counters = {
            'telemetry': 0,
            'camera': 0,
            'webrtc': 0,
            'command': 0,
            'heartbeat': 0
        }
        
        self.setup_event_handlers()
        
    def setup_event_handlers(self):
        @self.sio.event
        async def connect():
            logger.info(f"🔗 [{self.config.drone_id}] Connected to production system")
            await self.register_drone()
            
        @self.sio.event
        async def disconnect():
            logger.warning(f"📴 [{self.config.drone_id}] Disconnected from production system")
            self.state.connected = False
            self.registered = False
            await self.cleanup_webrtc()
            
        @self.sio.event
        async def registration_success(data):
            logger.info(f"✅ [{self.config.drone_id}] Production registration successful")
            self.registered = True
            self.state.connected = True
            
            # Check if WebRTC is supported by server
            if data.get('webrtcSupported') and self.config.enable_webrtc:
                logger.info(f"📡 [{self.config.drone_id}] Server supports WebRTC, initializing...")
                await self.setup_webrtc()
            else:
                logger.info(f"📡 [{self.config.drone_id}] Using WebSocket-only mode")
                
            await self.start_data_streams()
            
        @self.sio.event
        async def registration_failed(data):
            logger.error(f"❌ [{self.config.drone_id}] Production registration failed: {data}")
            
        @self.sio.event
        async def command(data):
            await self.handle_command(data)
            
        @self.sio.event
        async def precision_landing_command(data):
            await self.handle_precision_landing_command(data)
            
        @self.sio.event
        async def waypoint_mission(data):
            await self.handle_waypoint_mission(data)
            
        @self.sio.event
        async def heartbeat_ack(data):
            if self.config.enable_latency_measurement:
                await self.measure_heartbeat_latency(data)
                
        @self.sio.event
        async def telemetry_ack(data):
            if self.config.enable_latency_measurement:
                await self.measure_telemetry_latency(data)
                
        @self.sio.event
        async def camera_stream_ack(data):
            if self.config.enable_latency_measurement:
                await self.measure_camera_latency(data)
                
        # WebRTC signaling handlers
        @self.sio.event
        async def webrtc_request_offer(data):
            await self.handle_webrtc_offer_request(data)
            
        @self.sio.event
        async def webrtc_answer(data):
            await self.handle_webrtc_answer(data)
            
        @self.sio.event
        async def webrtc_ice_candidate(data):
            await self.handle_webrtc_ice_candidate(data)
            
        @self.sio.event
        async def webrtc_close(data):
            await self.cleanup_webrtc()

    async def setup_webrtc(self):
        """Setup WebRTC peer connection and data channels"""
        try:
            logger.info(f"🔧 [{self.config.drone_id}] Setting up WebRTC peer connection...")
            
            # Create peer connection
            self.pc = RTCPeerConnection()
            
            # Setup event handlers
            @self.pc.on("connectionstatechange")
            async def on_connectionstatechange():
                logger.info(f"📡 [{self.config.drone_id}] WebRTC connection state: {self.pc.connectionState}")
                if self.pc.connectionState == "connected":
                    self.webrtc_connected = True
                elif self.pc.connectionState in ["failed", "disconnected", "closed"]:
                    self.webrtc_connected = False
                    self.data_channel_ready = False
                    
            @self.pc.on("datachannel")
            def on_datachannel(channel):
                logger.info(f"📡 [{self.config.drone_id}] Data channel received: {channel.label}")
                
            # Create camera data channel
            if self.config.enable_camera_streaming:
                self.camera_data_channel = self.pc.createDataChannel(
                    "camera_frames",
                    ordered=False,  # Allow out-of-order delivery for video
                    maxRetransmits=0  # No retransmits for real-time data
                )
                
                @self.camera_data_channel.on("open")
                def on_camera_channel_open():
                    logger.info(f"📹 [{self.config.drone_id}] Camera data channel opened")
                    self.data_channel_ready = True
                    self.use_webrtc_for_camera = True
                    
                    # Notify server about data channel setup
                    asyncio.create_task(self.sio.emit('webrtc_datachannel_setup', {
                        'droneId': self.config.drone_id,
                        'channels': [
                            {
                                'label': 'camera_frames',
                                'config': {
                                    'ordered': False,
                                    'maxRetransmits': 0,
                                    'protocol': ''
                                }
                            }
                        ]
                    }))
                    
                @self.camera_data_channel.on("close")
                def on_camera_channel_close():
                    logger.info(f"📹 [{self.config.drone_id}] Camera data channel closed")
                    self.data_channel_ready = False
                    self.use_webrtc_for_camera = False
                    
                @self.camera_data_channel.on("error")
                def on_camera_channel_error(error):
                    logger.error(f"❌ [{self.config.drone_id}] Camera data channel error: {error}")
                    self.data_channel_ready = False
                    
            logger.info(f"✅ [{self.config.drone_id}] WebRTC setup completed")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebRTC setup failed: {e}")
            self.config.enable_webrtc = False

    async def handle_webrtc_offer_request(self, data):
        """Handle WebRTC offer request from server"""
        try:
            session_id = data.get('sessionId')
            logger.info(f"📡 [{self.config.drone_id}] Creating WebRTC offer for session {session_id}")
            
            if not self.pc:
                logger.error(f"❌ [{self.config.drone_id}] No peer connection available")
                return
                
            # Create offer
            offer = await self.pc.createOffer()
            await self.pc.setLocalDescription(offer)
            
            # Send offer to server
            await self.sio.emit('webrtc_offer', {
                'offer': {
                    'type': offer.type,
                    'sdp': offer.sdp
                },
                'droneId': self.config.drone_id,
                'dataChannels': ['camera_frames'] if self.config.enable_camera_streaming else []
            })
            
            logger.info(f"📡 [{self.config.drone_id}] WebRTC offer sent")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Failed to create WebRTC offer: {e}")

    async def handle_webrtc_answer(self, data):
        """Handle WebRTC answer from server"""
        try:
            session_id = data.get('sessionId')
            answer = data.get('answer')
            
            logger.info(f"📡 [{self.config.drone_id}] Received WebRTC answer for session {session_id}")
            
            if not self.pc:
                logger.error(f"❌ [{self.config.drone_id}] No peer connection available")
                return
                
            # Set remote description
            remote_desc = RTCSessionDescription(sdp=answer['sdp'], type=answer['type'])
            await self.pc.setRemoteDescription(remote_desc)
            
            logger.info(f"📡 [{self.config.drone_id}] WebRTC answer processed")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Failed to handle WebRTC answer: {e}")

    async def handle_webrtc_ice_candidate(self, data):
        """Handle ICE candidate from server"""
        try:
            candidate = data.get('candidate')
            
            if not self.pc:
                return
                
            # Add ICE candidate
            await self.pc.addIceCandidate(candidate)
            logger.debug(f"🧊 [{self.config.drone_id}] ICE candidate added")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Failed to add ICE candidate: {e}")

    async def cleanup_webrtc(self):
        """Clean up WebRTC resources"""
        try:
            if self.pc:
                await self.pc.close()
                self.pc = None
                
            self.camera_data_channel = None
            self.webrtc_connected = False
            self.data_channel_ready = False
            self.use_webrtc_for_camera = False
            
            logger.info(f"🧹 [{self.config.drone_id}] WebRTC resources cleaned up")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebRTC cleanup error: {e}")

    def send_camera_frame_webrtc(self, camera: str, frame_data: str):
        """Send camera frame via WebRTC data channel"""
        try:
            if not self.data_channel_ready or not self.camera_data_channel:
                return False
                
            # Prepare frame metadata
            metadata = {
                'droneId': self.config.drone_id,
                'camera': camera,
                'timestamp': time.time() * 1000,
                'frameNumber': self.camera_frame_counter[camera],
                'resolution': '1920x1080',
                'fps': int(self.config.camera_fps),
                'quality': 85,
                'transport': 'webrtc_datachannel',
                'latency': random.uniform(5, 25)  # Simulated WebRTC latency
            }
            
            # Create frame message
            frame_message = {
                'type': 'camera_frame',
                'metadata': metadata,
                'frameData': frame_data
            }
            
            # Send via data channel (binary)
            message_json = json.dumps(frame_message)
            self.camera_data_channel.send(message_json.encode('utf-8'))
            
            logger.debug(f"📹 [{self.config.drone_id}] WebRTC frame sent: {camera} ({len(frame_data)} bytes)")
            return True
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebRTC frame send failed: {e}")
            return False

    def generate_professional_frame(self, droneId: str, camera: str) -> str:
        """Generate realistic camera frame data"""
        timestamp = time.time() * 1000
        frame_number = self.camera_frame_counter[camera]
        
        frame_data = {
            'type': 'production_camera_frame',
            'droneId': droneId,
            'camera': camera,
            'timestamp': timestamp,
            'frameNumber': frame_number,
            
            # Realistic camera parameters
            'exposure': 1/500 if camera == 'front' else 1/250,
            'iso': 100 + random.random() * 200,
            'focus_distance': 5 + random.random() * 95,
            'white_balance': 5600 + random.random() * 400,
            
            # Scene simulation
            'scene_brightness': 180 + random.random() * 40 if camera == 'front' else 120 + random.random() * 60,
            'contrast': 1.0 + (random.random() - 0.5) * 0.2,
            'saturation': 1.0 + (random.random() - 0.5) * 0.1,
            
            # Motion simulation
            'gimbal_roll': math.sin(timestamp / 5000) * 2,
            'gimbal_pitch': math.cos(timestamp / 7000) * 3,
            'gimbal_yaw': math.sin(timestamp / 10000) * 5,
            
            # AI/CV features
            'objects_detected': math.floor(random.random() * 3),
            'faces_detected': math.floor(random.random() * 2) if camera == 'front' else 0,
            'motion_vectors': [{'x': (random.random() - 0.5) * 10, 'y': (random.random() - 0.5) * 10} for _ in range(5)],
            
            # Quality metrics
            'sharpness': 0.8 + random.random() * 0.2,
            'noise_level': random.random() * 0.1,
            'compression_ratio': 0.15 + random.random() * 0.05
        }
        
        # Convert to base64 for realistic frame size
        frame_json = json.dumps(frame_data)
        return base64.b64encode(frame_json.encode()).decode()

    async def discover_server(self) -> bool:
        """Discover production server"""
        try:
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.server_url}/drone/discover") as response:
                    end_time = time.time()
                    
                    if response.status == 200:
                        data = await response.json()
                        discovery_latency = (end_time - start_time) * 1000
                        
                        logger.info(f"🔍 [{self.config.drone_id}] Server discovered ({discovery_latency:.2f}ms)")
                        return True
                    else:
                        logger.error(f"❌ [{self.config.drone_id}] Discovery failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Discovery error: {e}")
            return False

    async def register_with_server(self) -> bool:
        """Register with production server via HTTP"""
        try:
            registration_data = {
                'droneId': self.config.drone_id,
                'model': self.config.model,
                'version': '2.0-production-webrtc',
                'jetsonSerial': self.config.jetson_serial,
                'capabilities': self.config.capabilities,
                'systemInfo': {
                    'cpuCores': 4,
                    'ramGB': 4,
                    'storageGB': 32,
                    'gpuModel': 'Maxwell',
                    'osVersion': 'Ubuntu 18.04',
                    'webrtcSupported': self.config.enable_webrtc
                }
            }
            
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.server_url}/drone/register",
                    json=registration_data
                ) as response:
                    end_time = time.time()
                    
                    if response.status == 200:
                        data = await response.json()
                        self.session_token = data.get('sessionToken')
                        
                        registration_latency = (end_time - start_time) * 1000
                        
                        logger.info(f"📝 [{self.config.drone_id}] HTTP registration successful ({registration_latency:.2f}ms)")
                        return True
                    else:
                        logger.error(f"❌ [{self.config.drone_id}] HTTP registration failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] HTTP registration error: {e}")
            return False

    async def register_drone(self):
        """Register with production system via WebSocket"""
        registration_data = {
            'droneId': self.config.drone_id,
            'model': self.config.model,
            'version': '2.0-production-webrtc',
            'capabilities': self.config.capabilities,
            'jetsonInfo': {
                'ip': '192.168.1.100',
                'serialNumber': self.config.jetson_serial,
                'gpuMemory': 4096,
                'webrtcSupported': self.config.enable_webrtc
            }
        }
        
        await self.sio.emit('drone_register_real', registration_data)
        logger.info(f"📝 [{self.config.drone_id}] WebSocket registration sent")

    async def start_data_streams(self):
        """Start all production data streams"""
        if not self.registered:
            return
            
        self.tasks.append(asyncio.create_task(self.telemetry_stream()))
        self.tasks.append(asyncio.create_task(self.heartbeat_stream()))
        self.tasks.append(asyncio.create_task(self.mavros_stream()))
        self.tasks.append(asyncio.create_task(self.animate_state()))
        
        if self.config.enable_camera_streaming:
            self.tasks.append(asyncio.create_task(self.camera_stream()))
        
        logger.info(f"🎬 [{self.config.drone_id}] Production data streams started")

    async def camera_stream(self):
        """Camera streaming with WebRTC/WebSocket hybrid approach"""
        # Start camera streams via WebSocket (control)
        for camera in ['front', 'bottom']:
            await self.sio.emit('camera_stream_start', {
                'droneId': self.config.drone_id,
                'camera': camera,
                'config': {
                    'resolution': '1920x1080',
                    'fps': int(self.config.camera_fps),
                    'quality': 'high',
                    'preferredTransport': 'webrtc' if self.config.enable_webrtc else 'websocket'
                }
            })
            
            self.camera_streams_active[camera] = True
            logger.info(f"📹 [{self.config.drone_id}] Camera stream started: {camera}")
        
        # Send frames at specified FPS
        frame_interval = 1.0 / self.config.camera_fps
        
        while self.registered and any(self.camera_streams_active.values()):
            try:
                for camera in ['front', 'bottom']:
                    if self.camera_streams_active[camera]:
                        self.sequence_counters['camera'] += 1
                        self.camera_frame_counter[camera] += 1
                        
                        frame_data = self.generate_professional_frame(self.config.drone_id, camera)
                        
                        # Try WebRTC first, fallback to WebSocket
                        if self.use_webrtc_for_camera and self.data_channel_ready:
                            success = self.send_camera_frame_webrtc(camera, frame_data)
                            if not success:
                                # Fallback to WebSocket
                                await self.send_camera_frame_websocket(camera, frame_data)
                        else:
                            # Use WebSocket
                            await self.send_camera_frame_websocket(camera, frame_data)
                
                await asyncio.sleep(frame_interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Camera stream error: {e}")
                await asyncio.sleep(frame_interval)

    async def send_camera_frame_websocket(self, camera: str, frame_data: str):
        """Send camera frame via WebSocket (fallback)"""
        try:
            await self.sio.emit('camera_frame', {
                'droneId': self.config.drone_id,
                'camera': camera,
                'timestamp': time.time() * 1000,
                'frame': frame_data,
                'metadata': {
                    'resolution': '1920x1080',
                    'fps': int(self.config.camera_fps),
                    'quality': 85,
                    'frameNumber': self.camera_frame_counter[camera],
                    'bandwidth': '2.5 Mbps',
                    'transport': 'websocket'
                }
            })
            
            logger.debug(f"📹 [{self.config.drone_id}] WebSocket frame sent: {camera}")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebSocket frame send failed: {e}")

    async def telemetry_stream(self):
        """Send production telemetry data"""
        interval = 1.0 / self.config.telemetry_rate
        
        while self.registered:
            try:
                self.sequence_counters['telemetry'] += 1
                current_time = time.time() * 1000
                
                telemetry_data = asdict(self.state)
                telemetry_data.update({
                    'timestamp': current_time,
                    'jetsonTimestamp': current_time,
                    'droneType': 'REAL',
                    'sessionId': self.session_token,
                    'sequence_id': self.sequence_counters['telemetry'],
                    'webrtcConnected': self.webrtc_connected,
                    'dataChannelReady': self.data_channel_ready
                })
                
                await self.sio.emit('telemetry_real', telemetry_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Telemetry error: {e}")
                await asyncio.sleep(interval)

    async def heartbeat_stream(self):
        """Send production heartbeat"""
        interval = 1.0 / self.config.heartbeat_rate
        
        while self.registered:
            try:
                self.sequence_counters['heartbeat'] += 1
                
                heartbeat_data = {
                    'timestamp': time.time() * 1000,
                    'sequence_id': self.sequence_counters['heartbeat'],
                    'webrtcStatus': {
                        'connected': self.webrtc_connected,
                        'dataChannelReady': self.data_channel_ready,
                        'preferredTransport': 'webrtc' if self.config.enable_webrtc else 'websocket'
                    },
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
        """Send production MAVROS messages"""
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
                if random.random() < 0.05:
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
                
                radius_km = 0.001
                angular_speed = 0.1
                
                angle = self.flight_time * angular_speed
                self.state.latitude = self.config.base_lat + math.sin(angle) * radius_km
                self.state.longitude = self.config.base_lng + math.cos(angle) * radius_km
                
                self.state.altitude_relative = 100 + math.sin(self.flight_time * 0.5) * 10
                self.state.altitude_msl = self.state.altitude_relative + 500
                
                self.state.yaw = angle
                self.state.roll = math.sin(self.flight_time) * 0.1
                self.state.pitch = math.cos(self.flight_time * 0.7) * 0.1
                
                speed = 5.0
                self.state.velocity_x = speed * math.cos(angle)
                self.state.velocity_y = speed * math.sin(angle)
                self.state.velocity_z = math.sin(self.flight_time * 0.3) * 0.5
                
                self.state.percentage = max(20, self.state.percentage - 0.001)
                self.state.voltage = 22.2 * (self.state.percentage / 100)
                
                self.state.hdop = 0.8 + random.uniform(-0.2, 0.2)
                self.state.position_error = 1.0 + random.uniform(-0.3, 0.3)
                
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Animation error: {e}")
                await asyncio.sleep(0.1)

    async def handle_command(self, data):
        """Handle production commands"""
        command_type = data.get('type') or data.get('commandType')
        parameters = data.get('parameters', {})
        command_id = data.get('id')
        
        logger.info(f"📡 [{self.config.drone_id}] Production command: {command_type}")
        
        await asyncio.sleep(random.uniform(0.1, 0.5))
        
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
            
        response = {
            'commandId': command_id,
            'command': command_type,
            'status': 'executed',
            'result': 'success',
            'timestamp': time.time() * 1000
        }
        
        await self.sio.emit('command_response', response)

    async def handle_precision_landing_command(self, data):
        """Handle precision landing commands"""
        action = data.get('action')
        command_id = data.get('id')
        
        logger.info(f"🎯 [{self.config.drone_id}] Precision landing: {action}")
        
        if action == 'start':
            await self.start_precision_landing()
        elif action == 'abort':
            await self.abort_precision_landing()

    async def handle_waypoint_mission(self, data):
        """Handle waypoint mission commands"""
        action = data.get('action')
        mission_id = data.get('missionId')
        
        logger.info(f"🗺️ [{self.config.drone_id}] Mission {action}: {mission_id}")
        
        if action == 'upload':
            logger.info(f"📥 [{self.config.drone_id}] Waypoints uploaded")
        elif action == 'start':
            logger.info(f"🚀 [{self.config.drone_id}] Mission started")
            self.state.flight_mode = 'AUTO'
        elif action == 'cancel':
            logger.info(f"🛑 [{self.config.drone_id}] Mission cancelled")
            self.state.flight_mode = 'LOITER'

    async def start_precision_landing(self):
        """Simulate precision landing"""
        logger.info(f"🎯 [{self.config.drone_id}] Starting precision landing")
        
        stages = ['APPROACH', 'DESCENT', 'FINAL', 'LANDED']
        
        for stage in stages:
            precision_data = {
                'output': f"Precision landing {stage.lower()} phase initiated",
                'stage': stage,
                'altitude': self.state.altitude_relative,
                'target_detected': random.random() > 0.2,
                'target_confidence': random.uniform(0.7, 0.95),
                'lateral_error': random.uniform(0, 2.0),
                'vertical_error': random.uniform(0, 1.0),
                'battery_level': self.state.percentage,
                'wind_speed': random.uniform(0, 5.0)
            }
            
            await self.sio.emit('precision_land_real', precision_data)
            
            if stage in ['DESCENT', 'FINAL']:
                self.state.altitude_relative *= 0.7
                
            await asyncio.sleep(2.0)
            
        self.state.flight_mode = 'LAND'

    async def abort_precision_landing(self):
        """Abort precision landing"""
        logger.info(f"🚫 [{self.config.drone_id}] Precision landing aborted")
        
        abort_data = {
            'output': 'Precision landing aborted by command',
            'stage': 'ABORTED',
            'altitude': self.state.altitude_relative
        }
        
        await self.sio.emit('precision_land_real', abort_data)
        self.state.flight_mode = 'LOITER'

    # Latency measurement methods (simplified for brevity)
    async def measure_telemetry_latency(self, ack_data):
        """Measure telemetry latency"""
        try:
            if 'timestamp' in ack_data:
                send_time = float(ack_data['timestamp']) / 1000
                receive_time = time.time()
                latency_ms = (receive_time - send_time) * 1000
                self.state.latency = latency_ms
        except Exception as e:
            logger.error(f"Error measuring telemetry latency: {e}")

    async def measure_heartbeat_latency(self, ack_data):
        """Measure heartbeat latency"""
        try:
            if 'serverTimestamp' in ack_data:
                server_time = float(ack_data['serverTimestamp']) / 1000
                receive_time = time.time()
                latency_ms = (receive_time - server_time) * 1000
        except Exception as e:
            logger.error(f"Error measuring heartbeat latency: {e}")

    async def measure_camera_latency(self, ack_data):
        """Measure camera latency"""
        try:
            if 'timestamp' in ack_data:
                send_time = float(ack_data['timestamp']) / 1000
                receive_time = time.time()
                latency_ms = (receive_time - send_time) * 1000
        except Exception as e:
            logger.error(f"Error measuring camera latency: {e}")

    async def connect(self):
        """Connect to production system"""
        try:
            if not await self.discover_server():
                return False
                
            if not await self.register_with_server():
                return False
                
            await self.sio.connect(self.ws_url)
            return True
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Production connection failed: {e}")
            return False

    async def disconnect(self):
        """Disconnect from production system"""
        try:
            # Stop camera streams
            if self.config.enable_camera_streaming:
                for camera in ['front', 'bottom']:
                    if self.camera_streams_active[camera]:
                        await self.sio.emit('camera_stream_stop', {
                            'droneId': self.config.drone_id,
                            'camera': camera
                        })
                        self.camera_streams_active[camera] = False
            
            # Cleanup WebRTC
            await self.cleanup_webrtc()
            
            for task in self.tasks:
                task.cancel()
                
            await self.sio.disconnect()
            logger.info(f"👋 [{self.config.drone_id}] Disconnected from production")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Disconnect error: {e}")

    async def run(self):
        """Main run loop"""
        connected = await self.connect()
        if not connected:
            logger.error(f"❌ [{self.config.drone_id}] Failed to connect to production system")
            return
            
        try:
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info(f"🛑 [{self.config.drone_id}] Shutdown requested")
        finally:
            await self.disconnect()

def main():
    parser = argparse.ArgumentParser(description='Production Mock Drone with WebRTC Support')
    parser.add_argument('--server', default='http://localhost:4005', help='Production server URL')
    parser.add_argument('--drone-id', default='prod-webrtc-001', help='Drone ID')
    parser.add_argument('--model', default='FlyOS_MQ7_Production_WebRTC', help='Drone model')
    parser.add_argument('--lat', type=float, default=18.5204, help='Base latitude')
    parser.add_argument('--lng', type=float, default=73.8567, help='Base longitude')
    parser.add_argument('--disable-webrtc', action='store_true', help='Disable WebRTC (WebSocket only)')
    parser.add_argument('--disable-camera', action='store_true', help='Disable camera streaming')
    parser.add_argument('--camera-fps', type=float, default=30.0, help='Camera FPS (default: 30)')
    parser.add_argument('--telemetry-rate', type=float, default=10.0, help='Telemetry rate Hz (default: 10)')
    
    args = parser.parse_args()
    
    config = DroneConfig(
        drone_id=args.drone_id,
        model=args.model,
        base_lat=args.lat,
        base_lng=args.lng,
        jetson_serial=f"JETSON-WEBRTC-{uuid.uuid4().hex[:8].upper()}",
        capabilities=[
            'telemetry', 'camera', 'mavros', 'precision_landing',
            'webrtc', 'commands', 'mission_planning', 'camera_webrtc'
        ],
        telemetry_rate=args.telemetry_rate,
        camera_fps=args.camera_fps,
        enable_webrtc=not args.disable_webrtc,
        enable_camera_streaming=not args.disable_camera
    )
    
    drone = ProductionMockDroneWithWebRTC(config, args.server)
    
    try:
        asyncio.run(drone.run())
    except KeyboardInterrupt:
        logger.info("🛑 Production WebRTC drone simulator stopped by user")

if __name__ == "__main__":
    main()