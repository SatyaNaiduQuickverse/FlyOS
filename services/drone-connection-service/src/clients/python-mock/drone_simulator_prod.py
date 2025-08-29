# services/drone-connection-service/src/clients/python-mock/drone_simulator_prod.py
import asyncio
import json
import time
import random
import math
import logging
import argparse
import uuid
import statistics
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
import socketio
import aiohttp

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
class LatencyStats:
    measurement_type: str
    count: int
    min_ms: float
    max_ms: float
    avg_ms: float
    median_ms: float
    p95_ms: float
    p99_ms: float
    payload_avg_bytes: int

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
    enable_latency_measurement: bool = True

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

class ProductionMockDrone:
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
        
        # Latency measurement variables
        self.latency_measurements: List[LatencyMeasurement] = []
        self.sequence_counters = {
            'telemetry': 0,
            'camera': 0,
            'webrtc': 0,
            'command': 0,
            'heartbeat': 0
        }
        self.pending_measurements = {}
        self.webrtc_session_start = None
        
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
            
        @self.sio.event
        async def registration_success(data):
            logger.info(f"✅ [{self.config.drone_id}] Production registration successful")
            self.registered = True
            self.state.connected = True
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

    async def measure_telemetry_latency(self, ack_data):
        """Measure telemetry round-trip latency"""
        try:
            if 'timestamp' in ack_data:
                send_time = float(ack_data['timestamp']) / 1000
                receive_time = time.time()
                latency_ms = (receive_time - send_time) * 1000
                
                measurement = LatencyMeasurement(
                    measurement_type='telemetry',
                    send_timestamp=send_time,
                    receive_timestamp=receive_time,
                    latency_ms=latency_ms,
                    payload_size_bytes=self.calculate_telemetry_size(),
                    sequence_id=self.sequence_counters['telemetry'],
                    additional_data={'ack_data': ack_data}
                )
                
                self.latency_measurements.append(measurement)
                self.state.latency = latency_ms
                
        except Exception as e:
            logger.error(f"Error measuring telemetry latency: {e}")

    async def measure_heartbeat_latency(self, ack_data):
        """Measure heartbeat round-trip latency"""
        try:
            if 'serverTimestamp' in ack_data:
                server_time = float(ack_data['serverTimestamp']) / 1000
                receive_time = time.time()
                latency_ms = (receive_time - server_time) * 1000
                
                measurement = LatencyMeasurement(
                    measurement_type='heartbeat',
                    send_timestamp=server_time,
                    receive_timestamp=receive_time,
                    latency_ms=latency_ms,
                    payload_size_bytes=len(json.dumps(ack_data).encode()),
                    sequence_id=self.sequence_counters['heartbeat'],
                    additional_data={'connection_quality': ack_data.get('connectionQuality')}
                )
                
                self.latency_measurements.append(measurement)
                
        except Exception as e:
            logger.error(f"Error measuring heartbeat latency: {e}")

    def calculate_telemetry_size(self):
        """Calculate approximate telemetry payload size"""
        sample_data = asdict(self.state)
        sample_data['timestamp'] = time.time() * 1000
        return len(json.dumps(sample_data).encode())

    def get_latency_statistics(self) -> Dict[str, LatencyStats]:
        """Calculate latency statistics by measurement type"""
        stats = {}
        
        by_type = {}
        for measurement in self.latency_measurements:
            if measurement.measurement_type not in by_type:
                by_type[measurement.measurement_type] = []
            by_type[measurement.measurement_type].append(measurement)
        
        for measurement_type, measurements in by_type.items():
            if not measurements:
                continue
                
            latencies = [m.latency_ms for m in measurements]
            payload_sizes = [m.payload_size_bytes for m in measurements]
            
            stats[measurement_type] = LatencyStats(
                measurement_type=measurement_type,
                count=len(measurements),
                min_ms=min(latencies),
                max_ms=max(latencies),
                avg_ms=statistics.mean(latencies),
                median_ms=statistics.median(latencies),
                p95_ms=self.percentile(latencies, 95),
                p99_ms=self.percentile(latencies, 99),
                payload_avg_bytes=int(statistics.mean(payload_sizes))
            )
        
        return stats

    def percentile(self, data: List[float], p: float) -> float:
        """Calculate percentile"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = (len(sorted_data) - 1) * p / 100
        lower = int(index)
        upper = min(lower + 1, len(sorted_data) - 1)
        weight = index - lower
        return sorted_data[lower] * (1 - weight) + sorted_data[upper] * weight

    async def discover_server(self) -> bool:
        """Discover production server with latency measurement"""
        try:
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.server_url}/drone/discover") as response:
                    end_time = time.time()
                    
                    if response.status == 200:
                        data = await response.json()
                        discovery_latency = (end_time - start_time) * 1000
                        
                        if self.config.enable_latency_measurement:
                            measurement = LatencyMeasurement(
                                measurement_type='discovery',
                                send_timestamp=start_time,
                                receive_timestamp=end_time,
                                latency_ms=discovery_latency,
                                payload_size_bytes=len(json.dumps(data).encode()),
                                sequence_id=0,
                                additional_data={'http_status': response.status}
                            )
                            self.latency_measurements.append(measurement)
                        
                        logger.info(f"🔍 [{self.config.drone_id}] Production server discovered ({discovery_latency:.2f}ms)")
                        return True
                    else:
                        logger.error(f"❌ [{self.config.drone_id}] Discovery failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Discovery error: {e}")
            return False

    async def register_with_server(self) -> bool:
        """Register with production server via HTTP with latency measurement"""
        try:
            registration_data = {
                'droneId': self.config.drone_id,
                'model': self.config.model,
                'version': '2.0-production-mock-latency',
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
                        
                        if self.config.enable_latency_measurement:
                            measurement = LatencyMeasurement(
                                measurement_type='registration',
                                send_timestamp=start_time,
                                receive_timestamp=end_time,
                                latency_ms=registration_latency,
                                payload_size_bytes=len(json.dumps(registration_data).encode()),
                                sequence_id=0,
                                additional_data={'session_token': self.session_token[:8] + '...'}
                            )
                            self.latency_measurements.append(measurement)
                        
                        logger.info(f"📝 [{self.config.drone_id}] Production HTTP registration successful ({registration_latency:.2f}ms)")
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
            'version': '2.0-production-mock-latency',
            'capabilities': self.config.capabilities,
            'jetsonInfo': {
                'ip': '192.168.1.100',
                'serialNumber': self.config.jetson_serial,
                'gpuMemory': 4096
            }
        }
        
        await self.sio.emit('drone_register_real', registration_data)
        logger.info(f"📝 [{self.config.drone_id}] Production WebSocket registration sent")

    async def start_data_streams(self):
        """Start all production data streams"""
        if not self.registered:
            return
            
        self.tasks.append(asyncio.create_task(self.telemetry_stream()))
        self.tasks.append(asyncio.create_task(self.heartbeat_stream()))
        self.tasks.append(asyncio.create_task(self.mavros_stream()))
        self.tasks.append(asyncio.create_task(self.animate_state()))
        
        logger.info(f"🎬 [{self.config.drone_id}] Production data streams started")

    async def telemetry_stream(self):
        """Send production telemetry data with latency measurement"""
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
                    'sequence_id': self.sequence_counters['telemetry']
                })
                
                await self.sio.emit('telemetry_real', telemetry_data)
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"❌ [{self.config.drone_id}] Telemetry error: {e}")
                await asyncio.sleep(interval)

    async def heartbeat_stream(self):
        """Send production heartbeat with latency measurement"""
        interval = 1.0 / self.config.heartbeat_rate
        
        while self.registered:
            try:
                self.sequence_counters['heartbeat'] += 1
                
                heartbeat_data = {
                    'timestamp': time.time() * 1000,
                    'sequence_id': self.sequence_counters['heartbeat'],
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
        """Handle production commands with latency measurement"""
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
        
        # Measure command latency if enabled
        if self.config.enable_latency_measurement:
            await self.measure_command_latency(data, response)
        
        await self.sio.emit('command_response', response)

    async def measure_command_latency(self, command_data, response_data):
        """Measure command execution latency"""
        try:
            if 'timestamp' in command_data and 'timestamp' in response_data:
                send_time = float(command_data['timestamp']) / 1000
                receive_time = float(response_data['timestamp']) / 1000
                latency_ms = (receive_time - send_time) * 1000
                
                measurement = LatencyMeasurement(
                    measurement_type='command',
                    send_timestamp=send_time,
                    receive_timestamp=receive_time,
                    latency_ms=latency_ms,
                    payload_size_bytes=len(json.dumps(command_data).encode()),
                    sequence_id=self.sequence_counters['command'],
                    additional_data={
                        'command_type': command_data.get('type'),
                        'status': response_data.get('status')
                    }
                )
                
                self.latency_measurements.append(measurement)
                
        except Exception as e:
            logger.error(f"Error measuring command latency: {e}")

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
        """Simulate precision landing for production system"""
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
            for task in self.tasks:
                task.cancel()
                
            await self.sio.disconnect()
            logger.info(f"👋 [{self.config.drone_id}] Disconnected from production")
            
        except Exception as e:
            logger.error(f"❌ [{self.config.drone_id}] Disconnect error: {e}")

    async def run(self):
        """Main run loop for production"""
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

    def print_latency_report(self):
        """Print comprehensive latency report"""
        stats = self.get_latency_statistics()
        
        print(f"\n📊 PRODUCTION LATENCY REPORT - {self.config.drone_id}")
        print("=" * 60)
        
        if not stats:
            print("No latency measurements collected")
            return
        
        for measurement_type, stat in stats.items():
            print(f"\n{measurement_type.upper()} LATENCY:")
            print(f"  Count: {stat.count}")
            print(f"  Min: {stat.min_ms:.2f}ms")
            print(f"  Avg: {stat.avg_ms:.2f}ms")
            print(f"  Median: {stat.median_ms:.2f}ms")
            print(f"  P95: {stat.p95_ms:.2f}ms")
            print(f"  P99: {stat.p99_ms:.2f}ms")
            print(f"  Max: {stat.max_ms:.2f}ms")
            print(f"  Avg Payload: {stat.payload_avg_bytes} bytes")
        
        all_measurements = [m.latency_ms for m in self.latency_measurements]
        if all_measurements:
            print(f"\nOVERALL STATISTICS:")
            print(f"  Total measurements: {len(all_measurements)}")
            print(f"  Overall avg latency: {statistics.mean(all_measurements):.2f}ms")
            print(f"  Overall median: {statistics.median(all_measurements):.2f}ms")
        
        print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description='Enhanced Production Mock Drone Simulator with Latency')
    parser.add_argument('--server', default='http://65.1.63.189:4005', help='Production server URL')
    parser.add_argument('--drone-id', default='prod-drone-001', help='Drone ID')
    parser.add_argument('--model', default='FlyOS_MQ7_Production', help='Drone model')
    parser.add_argument('--lat', type=float, default=18.5204, help='Base latitude')
    parser.add_argument('--lng', type=float, default=73.8567, help='Base longitude')
    parser.add_argument('--disable-latency', action='store_true', help='Disable latency measurement')
    
    args = parser.parse_args()
    
    config = DroneConfig(
        drone_id=args.drone_id,
        model=args.model,
        base_lat=args.lat,
        base_lng=args.lng,
        jetson_serial=f"JETSON-PROD-{uuid.uuid4().hex[:8].upper()}",
        capabilities=[
            'telemetry', 'camera', 'mavros', 'precision_landing',
            'webrtc', 'commands', 'mission_planning', 'latency_measurement'
        ],
        enable_latency_measurement=not args.disable_latency
    )
    
    drone = ProductionMockDrone(config, args.server)
    
    try:
        asyncio.run(drone.run())
    except KeyboardInterrupt:
        logger.info("🛑 Production simulator stopped by user")
    finally:
        if config.enable_latency_measurement:
            drone.print_latency_report()

if __name__ == "__main__":
    main()