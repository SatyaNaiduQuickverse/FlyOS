# services/drone-connection-service/src/clients/python-mock/drone_simulator_prod_with_webrtc.py
# PRODUCTION READY - REAL WebRTC UDP DATA CHANNELS
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
import struct
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
import socketio
import aiohttp

# Real WebRTC imports for production
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCDataChannel, RTCConfiguration, RTCIceServer
from aiortc.contrib.signaling import object_from_string, object_to_string
import av

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
    telemetry_rate: float = 10.0
    heartbeat_rate: float = 0.1
    mavros_rate: float = 1.0
    camera_fps: float = 30.0
    enable_webrtc: bool = True
    enable_camera_streaming: bool = True

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

class ProductionWebRTCDrone:
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
        
        # REAL WebRTC components
        self.pc: Optional[RTCPeerConnection] = None
        self.data_channels: Dict[str, RTCDataChannel] = {}
        self.webrtc_connected = False
        self.signaling_complete = False
        
        # Camera streaming state
        self.camera_streams_active = {'front': False, 'bottom': False}
        self.camera_frame_counter = {'front': 0, 'bottom': 0}
        self.use_webrtc_for_camera = False
        
        # Frame generation
        self.frame_sequence = 0
        
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
            
            # Initialize WebRTC if supported
            if data.get('webrtcSupported') and self.config.enable_webrtc:
                logger.info(f"📡 [{self.config.drone_id}] Initializing REAL WebRTC...")
                await self.setup_real_webrtc()
            
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
            
        # REAL WebRTC signaling handlers
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

    async def setup_real_webrtc(self):
        """Setup REAL WebRTC peer connection with aiortc"""
        try:
            logger.info(f"🔧 [{self.config.drone_id}] Setting up REAL WebRTC peer connection...")
            
            # Create REAL peer connection with production config
            config = RTCConfiguration(
                iceServers=[
                    RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
                    RTCIceServer(urls=["stun:stun1.l.google.com:19302"])
                ]
            )
            
            self.pc = RTCPeerConnection(configuration=config)
            
            # Setup event handlers
            @self.pc.on("connectionstatechange")
            async def on_connectionstatechange():
                logger.info(f"📡 [{self.config.drone_id}] WebRTC connection state: {self.pc.connectionState}")
                if self.pc.connectionState == "connected":
                    self.webrtc_connected = True
                    await self.on_webrtc_connected()
                elif self.pc.connectionState in ["failed", "disconnected", "closed"]:
                    self.webrtc_connected = False
                    self.use_webrtc_for_camera = False
                    
            @self.pc.on("datachannel")
            def on_datachannel(channel):
                logger.info(f"📡 [{self.config.drone_id}] Data channel received: {channel.label}")
                self.data_channels[channel.label] = channel
                
            # Create camera data channel with UDP optimization
            if self.config.enable_camera_streaming:
                camera_channel = self.pc.createDataChannel(
                    "camera_frames",
                    ordered=False,        # Allow out-of-order delivery for video
                    maxRetransmits=0      # No retransmits for real-time data
                )
                
                @camera_channel.on("open")
                def on_camera_channel_open():
                    logger.info(f"📹 [{self.config.drone_id}] Camera data channel opened (UDP mode)")
                    self.data_channels["camera_frames"] = camera_channel
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
                                    'protocol': 'UDP'
                                }
                            }
                        ]
                    }))
                    
                @camera_channel.on("close")
                def on_camera_channel_close():
                    logger.info(f"📹 [{self.config.drone_id}] Camera data channel closed")
                    self.use_webrtc_for_camera = False
                    if "camera_frames" in self.data_channels:
                        del self.data_channels["camera_frames"]
                    
                @camera_channel.on("error")
                def on_camera_channel_error(error):
                    logger.error(f"❌ [{self.config.drone_id}] Camera data channel error: {error}")
                    self.use_webrtc_for_camera = False
                    
            logger.info(f"✅ [{self.config.drone_id}] REAL WebRTC setup completed")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebRTC setup failed: {e}")
            self.config.enable_webrtc = False

    async def handle_webrtc_offer_request(self, data):
        """Handle WebRTC offer request from server"""
        try:
            session_id = data.get('sessionId')
            logger.info(f"📡 [{self.config.drone_id}] Creating REAL WebRTC offer for session {session_id}")
            
            if not self.pc:
                logger.error(f"❌ [{self.config.drone_id}] No peer connection available")
                return
                
            # Create REAL offer using aiortc
            offer = await self.pc.createOffer()
            await self.pc.setLocalDescription(offer)
            
            # Send offer to server
            await self.sio.emit('webrtc_offer_received', {
                'sessionId': session_id,
                'offer': {
                    'type': offer.type,
                    'sdp': offer.sdp
                },
                'droneId': self.config.drone_id,
                'dataChannels': ['camera_frames'] if self.config.enable_camera_streaming else []
            })
            
            logger.info(f"📡 [{self.config.drone_id}] REAL WebRTC offer sent")
            
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
                
            # Set remote description using REAL WebRTC
            remote_desc = RTCSessionDescription(sdp=answer['sdp'], type=answer['type'])
            await self.pc.setRemoteDescription(remote_desc)
            
            self.signaling_complete = True
            logger.info(f"📡 [{self.config.drone_id}] WebRTC signaling completed")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Failed to handle WebRTC answer: {e}")

    async def handle_webrtc_ice_candidate(self, data):
        """Handle ICE candidate from server"""
        try:
            candidate = data.get('candidate')
            
            if not self.pc:
                return
                
            # Add ICE candidate using REAL WebRTC
            await self.pc.addIceCandidate(candidate)
            logger.debug(f"🧊 [{self.config.drone_id}] ICE candidate added")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Failed to add ICE candidate: {e}")

    async def on_webrtc_connected(self):
        """Called when WebRTC connection is established"""
        try:
            # Notify server of successful connection
            await self.sio.emit('webrtc_connection_state', {
                'sessionId': getattr(self, 'current_session_id', 'unknown'),
                'state': 'connected',
                'timestamp': time.time() * 1000
            })
            
            # Notify that WebRTC transport is ready for cameras
            if self.config.enable_camera_streaming:
                await self.sio.emit('webrtc_transport_ready', {
                    'droneId': self.config.drone_id,
                    'cameras': ['front', 'bottom']
                })
            
            logger.info(f"🎉 [{self.config.drone_id}] WebRTC UDP connection established!")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Error in WebRTC connected callback: {e}")

    async def cleanup_webrtc(self):
        """Clean up WebRTC resources"""
        try:
            if self.pc:
                await self.pc.close()
                self.pc = None
                
            self.data_channels.clear()
            self.webrtc_connected = False
            self.signaling_complete = False
            self.use_webrtc_for_camera = False
            
            logger.info(f"🧹 [{self.config.drone_id}] WebRTC resources cleaned up")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebRTC cleanup error: {e}")

    def generate_binary_camera_frame(self, camera: str) -> bytes:
        """Generate binary H.264-like camera frame with proper header"""
        try:
            self.frame_sequence += 1
            timestamp = int(time.time() * 1000)
            camera_id = 1 if camera == 'front' else 2
            
            # Generate realistic frame payload (simulated H.264 data)
            frame_payload = self.generate_h264_like_payload()
            frame_size = len(frame_payload)
            
            # Create binary header (16 bytes)
            # Magic: 0x12345678 (4 bytes)
            # Timestamp: uint32 (4 bytes)  
            # Camera ID: uint16 (2 bytes)
            # Frame Number: uint16 (2 bytes)
            # Frame Size: uint32 (4 bytes)
            header = struct.pack('>IIHHI', 
                0x12345678,           # Magic number (big endian)
                timestamp,            # Timestamp
                camera_id,            # Camera ID
                self.frame_sequence,  # Frame number
                frame_size            # Frame size
            )
            
            # Combine header + payload
            binary_frame = header + frame_payload
            
            logger.debug(f"📸 [{self.config.drone_id}] Generated binary frame: {camera} "
                        f"(seq={self.frame_sequence}, size={len(binary_frame)} bytes)")
            
            return binary_frame
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Error generating binary frame: {e}")
            return b''

    def generate_h264_like_payload(self) -> bytes:
        """Generate realistic H.264-like binary payload"""
        try:
            # Simulate H.264 NAL units with realistic patterns
            frame_data = bytearray()
            
            # H.264 start code
            frame_data.extend(b'\x00\x00\x00\x01')
            
            # SPS (Sequence Parameter Set) - simplified
            sps_data = bytes([
                0x67, 0x42, 0x00, 0x1e, 0x96, 0x54, 0x05, 0xa8,
                0xb8, 0x20, 0x20, 0x20, 0x40, 0x00, 0x00, 0x03,
                0x00, 0x40, 0x00, 0x00, 0x0f, 0x03, 0xc6, 0x0c, 0x44, 0x80
            ])
            frame_data.extend(sps_data)
            
            # Another start code
            frame_data.extend(b'\x00\x00\x00\x01')
            
            # PPS (Picture Parameter Set) - simplified  
            pps_data = bytes([0x68, 0xce, 0x3c, 0x80])
            frame_data.extend(pps_data)
            
            # Start code for slice
            frame_data.extend(b'\x00\x00\x00\x01')
            
            # Slice data (simulated with random data that looks realistic)
            slice_size = random.randint(5000, 15000)  # Realistic slice size
            slice_data = bytearray()
            
            # Slice header
            slice_data.extend(bytes([0x41, 0x9a, 0x24, 0x66]))
            
            # Simulated compressed video data with patterns
            for i in range(slice_size - 4):
                if i % 100 == 0:
                    # Periodic sync patterns
                    slice_data.append(0x00)
                elif i % 50 == 0:
                    # Motion vector-like data
                    slice_data.append(random.randint(0x80, 0xFF))
                else:
                    # Compressed texture data
                    slice_data.append(random.randint(0x20, 0x7F))
            
            frame_data.extend(slice_data)
            
            return bytes(frame_data)
            
        except Exception as e:
            logger.error(f"Error generating H.264 payload: {e}")
            return b'FALLBACK_FRAME_DATA'

    async def send_camera_frame_webrtc(self, camera: str) -> bool:
        """Send camera frame via WebRTC data channel (binary UDP)"""
        try:
            if not self.use_webrtc_for_camera or "camera_frames" not in self.data_channels:
                return False
                
            channel = self.data_channels["camera_frames"]
            if channel.readyState != "open":
                return False
                
            # Generate binary frame with proper header
            binary_frame = self.generate_binary_camera_frame(camera)
            
            if not binary_frame:
                return False
                
            # Send binary data via UDP data channel
            channel.send(binary_frame)
            
            logger.debug(f"📹 [{self.config.drone_id}] WebRTC UDP frame sent: {camera} "
                        f"({len(binary_frame)} bytes)")
            return True
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] WebRTC frame send failed: {e}")
            return False

    async def send_camera_frame_websocket(self, camera: str):
        """Send camera frame via WebSocket (fallback)"""
        try:
            # Generate fallback frame data as base64
            frame_data = self.generate_professional_frame(camera)
            
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

    def generate_professional_frame(self, camera: str) -> str:
        """Generate professional camera frame data for WebSocket fallback"""
        timestamp = time.time() * 1000
        frame_number = self.camera_frame_counter[camera]
        
        frame_data = {
            'type': 'production_camera_frame',
            'droneId': self.config.drone_id,
            'camera': camera,
            'timestamp': timestamp,
            'frameNumber': frame_number,
            'exposure': 1/500 if camera == 'front' else 1/250,
            'iso': 100 + random.random() * 200,
            'focus_distance': 5 + random.random() * 95,
            'white_balance': 5600 + random.random() * 400,
            'scene_brightness': 180 + random.random() * 40 if camera == 'front' else 120 + random.random() * 60,
            'contrast': 1.0 + (random.random() - 0.5) * 0.2,
            'saturation': 1.0 + (random.random() - 0.5) * 0.1,
            'gimbal_roll': math.sin(timestamp / 5000) * 2,
            'gimbal_pitch': math.cos(timestamp / 7000) * 3,
            'gimbal_yaw': math.sin(timestamp / 10000) * 5,
            'objects_detected': math.floor(random.random() * 3),
            'faces_detected': math.floor(random.random() * 2) if camera == 'front' else 0,
            'motion_vectors': [{'x': (random.random() - 0.5) * 10, 'y': (random.random() - 0.5) * 10} for _ in range(5)],
            'sharpness': 0.8 + random.random() * 0.2,
            'noise_level': random.random() * 0.1,
            'compression_ratio': 0.15 + random.random() * 0.05
        }
        
        frame_json = json.dumps(frame_data)
        return base64.b64encode(frame_json.encode()).decode()

    async def register_drone(self):
        """Register with production system via WebSocket"""
        registration_data = {
            'droneId': self.config.drone_id,
            'model': self.config.model,
            'version': '2.0-production-webrtc-udp',
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
        """Camera streaming with WebRTC UDP/WebSocket hybrid approach"""
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
                        self.camera_frame_counter[camera] += 1
                        
                        # Try WebRTC UDP first, fallback to WebSocket
                        if self.use_webrtc_for_camera and self.webrtc_connected:
                            success = await self.send_camera_frame_webrtc(camera)
                            if not success:
                                # Fallback to WebSocket
                                await self.send_camera_frame_websocket(camera)
                                logger.debug(f"📹 [{self.config.drone_id}] Fallback to WebSocket for {camera}")
                        else:
                            # Use WebSocket
                            await self.send_camera_frame_websocket(camera)
                
                await asyncio.sleep(frame_interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Camera stream error: {e}")
                await asyncio.sleep(frame_interval)

    async def telemetry_stream(self):
        """Send production telemetry data"""
        interval = 1.0 / self.config.telemetry_rate
        
        while self.registered:
            try:
                current_time = time.time() * 1000
                
                telemetry_data = asdict(self.state)
                telemetry_data.update({
                    'timestamp': current_time,
                    'jetsonTimestamp': current_time,
                    'droneType': 'REAL',
                    'sessionId': self.session_token,
                    'webrtcConnected': self.webrtc_connected,
                    'webrtcDataChannels': list(self.data_channels.keys()),
                    'cameraTransport': 'webrtc_udp' if self.use_webrtc_for_camera else 'websocket'
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
                heartbeat_data = {
                    'timestamp': time.time() * 1000,
                    'webrtcStatus': {
                        'connected': self.webrtc_connected,
                        'dataChannelsActive': len(self.data_channels),
                        'signalingComplete': self.signaling_complete,
                        'cameraTransport': 'webrtc_udp' if self.use_webrtc_for_camera else 'websocket',
                        'udpOptimized': self.use_webrtc_for_camera
                    },
                    'jetsonMetrics': {
                        'cpuUsage': random.uniform(20, 60),
                        'memoryUsage': random.uniform(40, 80),
                        'temperature': random.uniform(45, 65),
                        'diskUsage': random.uniform(30, 70)
                    },
                    'networkMetrics': {
                        'latency': random.uniform(5, 25) if self.webrtc_connected else random.uniform(10, 100),
                        'packetLoss': random.uniform(0, 0.1) if self.webrtc_connected else random.uniform(0, 0.5),
                        'bandwidth': random.uniform(80, 100) if self.webrtc_connected else random.uniform(50, 100)
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
            "[INFO] Gimbal position updated",
            "[INFO] WebRTC data channel active",
            "[INFO] Camera streaming via UDP"
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
            'timestamp': time.time() * 1000,
            'webrtcActive': self.webrtc_connected
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
                'wind_speed': random.uniform(0, 5.0),
                'webrtc_active': self.webrtc_connected
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
            'altitude': self.state.altitude_relative,
            'webrtc_active': self.webrtc_connected
        }
        
        await self.sio.emit('precision_land_real', abort_data)
        self.state.flight_mode = 'LOITER'

    async def connect(self):
        """Connect to production system"""
        try:
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
                
                # Monitor WebRTC connection health
                if self.config.enable_webrtc and self.pc:
                    if self.pc.connectionState == "failed":
                        logger.warning(f"⚠️ [{self.config.drone_id}] WebRTC connection failed, attempting recovery")
                        await self.setup_real_webrtc()
                
        except KeyboardInterrupt:
            logger.info(f"🛑 [{self.config.drone_id}] Shutdown requested")
        finally:
            await self.disconnect()

def main():
    parser = argparse.ArgumentParser(description='Production Mock Drone with REAL WebRTC UDP Data Channels')
    parser.add_argument('--server', default='http://localhost:4005', help='Production server URL')
    parser.add_argument('--drone-id', default='prod-webrtc-udp-001', help='Drone ID')
    parser.add_argument('--model', default='FlyOS_MQ7_Production_WebRTC_UDP', help='Drone model')
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
        jetson_serial=f"JETSON-WEBRTC-UDP-{uuid.uuid4().hex[:8].upper()}",
        capabilities=[
            'telemetry', 'camera', 'mavros', 'precision_landing',
            'webrtc', 'webrtc_udp_datachannel', 'commands', 
            'mission_planning', 'camera_webrtc_udp', 'binary_frames'
        ],
        telemetry_rate=args.telemetry_rate,
        camera_fps=args.camera_fps,
        enable_webrtc=not args.disable_webrtc,
        enable_camera_streaming=not args.disable_camera
    )
    
    drone = ProductionWebRTCDrone(config, args.server)
    
    logger.info(f"🚁 Starting production WebRTC UDP drone: {config.drone_id}")
    logger.info(f"📡 WebRTC UDP enabled: {config.enable_webrtc}")
    logger.info(f"📹 Camera streaming: {config.enable_camera_streaming}")
    logger.info(f"🎥 Camera FPS: {config.camera_fps}")
    logger.info(f"📊 Telemetry rate: {config.telemetry_rate}Hz")
    
    try:
        asyncio.run(drone.run())
    except KeyboardInterrupt:
        logger.info("🛑 Production WebRTC UDP drone simulator stopped by user")

if __name__ == "__main__":
    main()