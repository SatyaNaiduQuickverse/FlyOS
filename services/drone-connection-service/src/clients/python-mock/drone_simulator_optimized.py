# services/drone-connection-service/src/clients/python-mock/drone_simulator_optimized.py
import asyncio
import json
import time
import random
import math
import logging
import argparse
import uuid
import struct
import gzip
import base64
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
import socketio
import aiohttp
import numpy as np

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
    enable_camera_streaming: bool = True
    enable_binary_frames: bool = True
    enable_compression: bool = True
    frame_skip_threshold: int = 3

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

class OptimizedProductionDrone:
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
        
        # Optimized camera streaming state
        self.camera_streams_active = {'front': False, 'bottom': False}
        self.camera_frame_counter = {'front': 0, 'bottom': 0}
        self.camera_performance_metrics = {
            'front': self._init_camera_metrics(),
            'bottom': self._init_camera_metrics()
        }
        
        # Frame generation optimization
        self.frame_sequence = 0
        self.last_frame_time = {'front': 0, 'bottom': 0}
        self.frame_queue_status = {'front': 0, 'bottom': 0}  # Server queue size feedback
        
        self.setup_event_handlers()
        
    def _init_camera_metrics(self):
        return {
            'frames_sent': 0,
            'frames_skipped': 0,
            'bytes_sent': 0,
            'bytes_compressed': 0,
            'compression_ratio': 1.0,
            'avg_generation_time': 0.0,
            'last_ack_time': 0
        }
        
    def setup_event_handlers(self):
        @self.sio.event
        async def connect():
            logger.info(f"🔗 [{self.config.drone_id}] Connected to optimized system")
            await self.register_drone()
            
        @self.sio.event
        async def disconnect():
            logger.warning(f"📴 [{self.config.drone_id}] Disconnected from optimized system")
            self.state.connected = False
            self.registered = False
            
        @self.sio.event
        async def registration_success(data):
            logger.info(f"✅ [{self.config.drone_id}] Optimized registration successful")
            self.registered = True
            self.state.connected = True
            await self.start_data_streams()
            
        @self.sio.event
        async def registration_failed(data):
            logger.error(f"❌ [{self.config.drone_id}] Optimized registration failed: {data}")
            
        @self.sio.event
        async def command(data):
            await self.handle_command(data)
            
        # Enhanced camera acknowledgment handler with queue feedback
        @self.sio.event
        async def camera_frame_ack(data):
            try:
                camera = data.get('camera')
                if camera in self.camera_performance_metrics:
                    metrics = self.camera_performance_metrics[camera]
                    metrics['last_ack_time'] = time.time()
                    
                    # Update compression ratio from server feedback
                    if 'compressionRatio' in data:
                        metrics['compression_ratio'] = data['compressionRatio']
                    
                    # Update queue size for adaptive frame skipping
                    if 'queueSize' in data:
                        self.frame_queue_status[camera] = data['queueSize']
                        
                        # Adaptive FPS based on queue size
                        if data['queueSize'] > 2:
                            logger.debug(f"🔄 High queue size for {camera}: {data['queueSize']}, reducing FPS")
                    
                    logger.debug(f"📹 Camera ack received: {self.config.drone_id}:{camera} "
                               f"(queue: {data.get('queueSize', 'unknown')}, "
                               f"compression: {data.get('compressionRatio', 'unknown')})")
                    
            except Exception as e:
                logger.error(f"Error processing camera ack: {e}")

    async def register_drone(self):
        """Register with optimized system capabilities"""
        registration_data = {
            'droneId': self.config.drone_id,
            'model': self.config.model,
            'version': '2.0-optimized-binary-compression',
            'capabilities': self.config.capabilities + [
                'binary_frames', 
                'frame_compression', 
                'adaptive_quality',
                'queue_feedback'
            ],
            'jetsonInfo': {
                'ip': '192.168.1.100',
                'serialNumber': self.config.jetson_serial,
                'gpuMemory': 4096,
                'optimizationSupport': {
                    'binaryFrames': self.config.enable_binary_frames,
                    'compression': self.config.enable_compression,
                    'adaptiveFPS': True,
                    'frameSkipping': True
                }
            }
        }
        
        await self.sio.emit('drone_register_real', registration_data)
        logger.info(f"📝 [{self.config.drone_id}] Optimized registration sent")

    async def start_data_streams(self):
        """Start all optimized data streams"""
        if not self.registered:
            return
            
        self.tasks.append(asyncio.create_task(self.telemetry_stream()))
        self.tasks.append(asyncio.create_task(self.heartbeat_stream()))
        self.tasks.append(asyncio.create_task(self.mavros_stream()))
        self.tasks.append(asyncio.create_task(self.animate_state()))
        
        if self.config.enable_camera_streaming:
            self.tasks.append(asyncio.create_task(self.optimized_camera_stream()))
        
        logger.info(f"🎬 [{self.config.drone_id}] Optimized data streams started")

    async def optimized_camera_stream(self):
        """Optimized camera streaming with binary frames and compression"""
        # Start camera streams with optimization settings
        for camera in ['front', 'bottom']:
            await self.sio.emit('camera_stream_start', {
                'droneId': self.config.drone_id,
                'camera': camera,
                'config': {
                    'resolution': '1920x1080',
                    'fps': int(self.config.camera_fps),
                    'quality': 'high',
                    'transport': 'websocket_binary',
                    'optimization': {
                        'compression': self.config.enable_compression,
                        'frameSkipping': True,
                        'maxQueueSize': self.config.frame_skip_threshold
                    }
                }
            })
            
            self.camera_streams_active[camera] = True
            logger.info(f"📹 [{self.config.drone_id}] Optimized camera stream started: {camera}")
        
        # Send frames with adaptive FPS and optimization
        base_frame_interval = 1.0 / self.config.camera_fps
        
        while self.registered and any(self.camera_streams_active.values()):
            try:
                for camera in ['front', 'bottom']:
                    if self.camera_streams_active[camera]:
                        # Adaptive frame rate based on queue feedback
                        queue_size = self.frame_queue_status[camera]
                        adaptive_interval = self.calculate_adaptive_interval(base_frame_interval, queue_size)
                        
                        # Check if enough time has passed for this camera
                        current_time = time.time()
                        if current_time - self.last_frame_time[camera] >= adaptive_interval:
                            await self.send_optimized_frame(camera)
                            self.last_frame_time[camera] = current_time
                
                # Short sleep to prevent busy waiting
                await asyncio.sleep(0.010)  # 10ms
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Optimized camera stream error: {e}")
                await asyncio.sleep(base_frame_interval)

    def calculate_adaptive_interval(self, base_interval: float, queue_size: int) -> float:
        """Calculate adaptive frame interval based on server queue size"""
        if queue_size > 2:
            # Slow down when queue is backing up
            return base_interval * (1.5 + queue_size * 0.3)
        elif queue_size == 0:
            # Speed up slightly when queue is empty (if network allows)
            return base_interval * 0.8
        else:
            return base_interval

    async def send_optimized_frame(self, camera: str):
        """Send optimized binary frame with compression"""
        try:
            start_time = time.time()
            
            self.camera_frame_counter[camera] += 1
            self.frame_sequence += 1
            
            # Generate realistic binary frame data
            frame_data = self.generate_realistic_binary_frame(camera)
            original_size = len(frame_data)
            
            # Apply compression if enabled
            compressed_data = frame_data
            if self.config.enable_compression:
                try:
                    compressed_data = gzip.compress(frame_data, compresslevel=6)
                except Exception as comp_error:
                    logger.warning(f"Compression failed for {camera}: {comp_error}")
                    compressed_data = frame_data
            
            compressed_size = len(compressed_data)
            compression_ratio = original_size / compressed_size if compressed_size > 0 else 1.0
            
            # Send binary frame
            if self.config.enable_binary_frames:
                await self.sio.emit('camera_frame_binary', {
                    'droneId': self.config.drone_id,
                    'camera': camera,
                    'timestamp': time.time() * 1000,
                    'frameNumber': self.camera_frame_counter[camera],
                    'frameData': compressed_data,
                    'metadata': {
                        'resolution': '1920x1080',
                        'fps': int(self.config.camera_fps),
                        'quality': 85,
                        'frameNumber': self.camera_frame_counter[camera],
                        'originalSize': original_size,
                        'compressedSize': compressed_size,
                        'compressionRatio': compression_ratio,
                        'transport': 'websocket_binary'
                    }
                })
            else:
                # Fallback to base64 for compatibility
                frame_b64 = base64.b64encode(compressed_data).decode()
                await self.sio.emit('camera_frame', {
                    'droneId': self.config.drone_id,
                    'camera': camera,
                    'timestamp': time.time() * 1000,
                    'frame': frame_b64,
                    'metadata': {
                        'resolution': '1920x1080',
                        'fps': int(self.config.camera_fps),
                        'quality': 85,
                        'frameNumber': self.camera_frame_counter[camera],
                        'compressionRatio': compression_ratio,
                        'transport': 'websocket_json'
                    }
                })
            
            # Update performance metrics
            metrics = self.camera_performance_metrics[camera]
            metrics['frames_sent'] += 1
            metrics['bytes_sent'] += original_size
            metrics['bytes_compressed'] += compressed_size
            metrics['compression_ratio'] = compression_ratio
            
            generation_time = (time.time() - start_time) * 1000
            metrics['avg_generation_time'] = (
                (metrics['avg_generation_time'] * (metrics['frames_sent'] - 1) + generation_time) / 
                metrics['frames_sent']
            )
            
            logger.debug(f"📸 [{self.config.drone_id}] Optimized frame sent: {camera} "
                        f"({original_size}→{compressed_size} bytes, {compression_ratio:.2f}x, {generation_time:.1f}ms)")
                        
        except Exception as e:
            logger.error(f"❌ Error sending optimized frame for {camera}: {e}")
            metrics = self.camera_performance_metrics[camera]
            metrics['frames_skipped'] += 1

    def generate_realistic_binary_frame(self, camera: str) -> bytes:
        """Generate realistic binary H.264-like frame data"""
        try:
            # Simulate realistic frame with varying content
            timestamp = int(time.time() * 1000)
            frame_number = self.camera_frame_counter[camera]
            
            # Create header (32 bytes)
            header = struct.pack('>IIHHIIFF', 
                0x12345678,                    # Magic number
                timestamp,                     # Timestamp
                1 if camera == 'front' else 2, # Camera ID
                frame_number,                  # Frame number
                0,                            # Reserved
                self.frame_sequence,          # Global sequence
                self.state.latitude,          # GPS lat
                self.state.longitude          # GPS lng
            )
            
            # Generate realistic video data patterns
            frame_type = 'I' if frame_number % 30 == 0 else 'P'  # I-frame every 30 frames
            
            if frame_type == 'I':
                # I-frame: larger, more complex data
                data_size = random.randint(15000, 25000)
                base_pattern = self._generate_iframe_pattern()
            else:
                # P-frame: smaller, simpler data
                data_size = random.randint(3000, 8000)
                base_pattern = self._generate_pframe_pattern()
            
            # Create frame payload with realistic variation
            payload = bytearray()
            pattern_len = len(base_pattern)
            
            for i in range(data_size):
                if i % 1000 == 0:
                    # Periodic sync patterns
                    payload.extend(b'\x00\x00\x01')
                elif i % 100 == 0:
                    # Motion vector-like data
                    payload.append(random.randint(0x80, 0xFF))
                else:
                    # Use base pattern with noise
                    pattern_idx = i % pattern_len
                    base_byte = base_pattern[pattern_idx]
                    noise = random.randint(-10, 10)
                    final_byte = max(0, min(255, base_byte + noise))
                    payload.append(final_byte)
            
            # Combine header and payload
            return header + bytes(payload)
            
        except Exception as e:
            logger.error(f"Error generating binary frame: {e}")
            # Fallback: simple frame
            return b'FALLBACK_FRAME_DATA' + struct.pack('>I', int(time.time()))

    def _generate_iframe_pattern(self) -> bytes:
        """Generate I-frame base pattern"""
        # Simulate H.264 I-frame with DCT coefficients
        pattern = bytearray()
        
        # Quantization table simulation
        for i in range(64):
            pattern.append(16 + (i % 32))
        
        # DCT coefficients simulation
        for block in range(50):
            for coeff in range(64):
                if coeff == 0:
                    # DC coefficient
                    pattern.append(128 + random.randint(-20, 20))
                else:
                    # AC coefficients (mostly zeros with some values)
                    if random.random() < 0.3:
                        pattern.append(random.randint(1, 50))
                    else:
                        pattern.append(0)
        
        return bytes(pattern)

    def _generate_pframe_pattern(self) -> bytes:
        """Generate P-frame base pattern"""
        # Simulate H.264 P-frame with motion vectors
        pattern = bytearray()
        
        # Motion vectors
        for mv in range(100):
            # X component
            pattern.append(128 + random.randint(-30, 30))
            # Y component  
            pattern.append(128 + random.randint(-30, 30))
        
        # Residual data (sparse)
        for i in range(200):
            if random.random() < 0.4:
                pattern.append(random.randint(1, 30))
            else:
                pattern.append(0)
        
        return bytes(pattern)

    async def telemetry_stream(self):
        """Send optimized telemetry data"""
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
                    'optimizations': {
                        'binaryFrames': self.config.enable_binary_frames,
                        'compression': self.config.enable_compression,
                        'frameSkipThreshold': self.config.frame_skip_threshold
                    },
                    'cameraMetrics': self.get_camera_metrics_summary()
                })
                
                await self.sio.emit('telemetry_real', telemetry_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Telemetry error: {e}")
                await asyncio.sleep(interval)

    def get_camera_metrics_summary(self) -> dict:
        """Get summary of camera performance metrics"""
        summary = {}
        for camera, metrics in self.camera_performance_metrics.items():
            if metrics['frames_sent'] > 0:
                summary[camera] = {
                    'framesSent': metrics['frames_sent'],
                    'framesSkipped': metrics['frames_skipped'],
                    'compressionRatio': round(metrics['compression_ratio'], 2),
                    'avgGenerationTime': round(metrics['avg_generation_time'], 1),
                    'bandwidth': round(metrics['bytes_sent'] / 1024 / 1024, 2),  # MB
                    'skipRate': round(metrics['frames_skipped'] / (metrics['frames_sent'] + metrics['frames_skipped']) * 100, 1)
                }
        return summary

    async def heartbeat_stream(self):
        """Send heartbeat with optimization metrics"""
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
                        'latency': random.uniform(10, 50),
                        'packetLoss': random.uniform(0, 0.2),
                        'bandwidth': random.uniform(80, 100)
                    },
                    'optimizationMetrics': {
                        'totalFramesSent': sum(m['frames_sent'] for m in self.camera_performance_metrics.values()),
                        'totalFramesSkipped': sum(m['frames_skipped'] for m in self.camera_performance_metrics.values()),
                        'avgCompressionRatio': sum(m['compression_ratio'] for m in self.camera_performance_metrics.values()) / 2,
                        'totalBytesSaved': sum(m['bytes_sent'] - m['bytes_compressed'] for m in self.camera_performance_metrics.values())
                    }
                }
                
                await self.sio.emit('heartbeat_real', heartbeat_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Heartbeat error: {e}")
                await asyncio.sleep(interval)

    async def mavros_stream(self):
        """Send MAVROS messages"""
        interval = 1.0 / self.config.mavros_rate
        
        mavros_messages = [
            "[INFO] MAVLink connection established",
            "[INFO] GPS position received", 
            "[INFO] Battery status updated",
            "[WARN] Wind speed above normal",
            "[INFO] Mission waypoint reached",
            "[INFO] Optimized camera streaming active",
            "[INFO] Frame compression enabled",
            "[INFO] Binary transport active"
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
        """Handle commands with optimization feedback"""
        command_type = data.get('type') or data.get('commandType')
        parameters = data.get('parameters', {})
        command_id = data.get('id')
        
        logger.info(f"📡 [{self.config.drone_id}] Command: {command_type}")
        
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
            'optimizationStatus': {
                'binaryFramesActive': self.config.enable_binary_frames,
                'compressionActive': self.config.enable_compression,
                'cameraMetrics': self.get_camera_metrics_summary()
            }
        }
        
        await self.sio.emit('command_response', response)

    async def connect(self):
        """Connect to optimized system"""
        try:
            await self.sio.connect(self.ws_url)
            return True
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Connection failed: {e}")
            return False

    async def disconnect(self):
        """Disconnect from optimized system"""
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
                        logger.info(f"📹 [{self.config.drone_id}] Camera stream stopped: {camera}")
            
            for task in self.tasks:
                task.cancel()
                
            await self.sio.disconnect()
            logger.info(f"👋 [{self.config.drone_id}] Disconnected from optimized system")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Disconnect error: {e}")

    async def run(self):
        """Main run loop for optimized system"""
        connected = await self.connect()
        if not connected:
            logger.error(f"❌ [{self.config.drone_id}] Failed to connect to optimized system")
            return
            
        try:
            while True:
                await asyncio.sleep(1)
                
                # Log performance metrics every 30 seconds
                if int(time.time()) % 30 == 0:
                    self.log_performance_metrics()
                
        except KeyboardInterrupt:
            logger.info(f"🛑 [{self.config.drone_id}] Shutdown requested")
        finally:
            await self.disconnect()

    def log_performance_metrics(self):
        """Log comprehensive performance metrics"""
        logger.info(f"📊 OPTIMIZATION METRICS - {self.config.drone_id}")
        logger.info("=" * 60)
        
        for camera, metrics in self.camera_performance_metrics.items():
            if metrics['frames_sent'] > 0:
                skip_rate = metrics['frames_skipped'] / (metrics['frames_sent'] + metrics['frames_skipped']) * 100
                bandwidth_saved = (metrics['bytes_sent'] - metrics['bytes_compressed']) / 1024 / 1024
                
                logger.info(f"  {camera.upper()} CAMERA:")
                logger.info(f"    Frames sent: {metrics['frames_sent']}")
                logger.info(f"    Frames skipped: {metrics['frames_skipped']} ({skip_rate:.1f}%)")
                logger.info(f"    Compression ratio: {metrics['compression_ratio']:.2f}x")
                logger.info(f"    Avg generation time: {metrics['avg_generation_time']:.1f}ms")
                logger.info(f"    Bandwidth saved: {bandwidth_saved:.2f} MB")
                logger.info(f"    Queue feedback: {self.frame_queue_status[camera]}")
        
        logger.info("=" * 60)

def main():
    parser = argparse.ArgumentParser(description='Optimized Production Drone with Binary Frames & Compression')
    parser.add_argument('--server', default='http://localhost:4005', help='Server URL')
    parser.add_argument('--drone-id', default='opt-drone-001', help='Drone ID')
    parser.add_argument('--model', default='FlyOS_MQ7_Optimized', help='Drone model')
    parser.add_argument('--lat', type=float, default=18.5204, help='Base latitude')
    parser.add_argument('--lng', type=float, default=73.8567, help='Base longitude')
    parser.add_argument('--disable-binary', action='store_true', help='Disable binary frames')
    parser.add_argument('--disable-compression', action='store_true', help='Disable compression')
    parser.add_argument('--disable-camera', action='store_true', help='Disable camera streaming')
    parser.add_argument('--camera-fps', type=float, default=30.0, help='Camera FPS (default: 30)')
    parser.add_argument('--skip-threshold', type=int, default=3, help='Frame skip threshold (default: 3)')
    
    args = parser.parse_args()
    
    config = DroneConfig(
        drone_id=args.drone_id,
        model=args.model,
        base_lat=args.lat,
        base_lng=args.lng,
        jetson_serial=f"JETSON-OPT-{uuid.uuid4().hex[:8].upper()}",
        capabilities=[
            'telemetry', 'camera', 'mavros', 'precision_landing',
            'commands', 'mission_planning', 'binary_frames',
            'frame_compression', 'adaptive_quality', 'queue_feedback'
        ],
        camera_fps=args.camera_fps,
        enable_binary_frames=not args.disable_binary,
        enable_compression=not args.disable_compression,
        enable_camera_streaming=not args.disable_camera,
        frame_skip_threshold=args.skip_threshold
    )
    
    drone = OptimizedProductionDrone(config, args.server)
    
    logger.info(f"🚁 Starting optimized drone: {config.drone_id}")
    logger.info(f"📹 Camera streaming: {config.enable_camera_streaming}")
    logger.info(f"🗜️ Binary frames: {config.enable_binary_frames}")
    logger.info(f"📦 Compression: {config.enable_compression}")
    logger.info(f"🎥 Camera FPS: {config.camera_fps}")
    logger.info(f"⏭️ Skip threshold: {config.frame_skip_threshold}")
    
    try:
        asyncio.run(drone.run())
    except KeyboardInterrupt:
        logger.info("🛑 Optimized drone simulator stopped by user")

if __name__ == "__main__":
    main()