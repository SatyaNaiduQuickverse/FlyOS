# services/drone-connection-service/src/clients/python-mock/multi_drone_prod.py
import asyncio
import argparse
import logging
import random
import uuid
import statistics
import json
import time
from typing import List, Dict
from drone_simulator_prod import ProductionMockDrone, DroneConfig, LatencyStats

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MultiDroneProductionLatencySimulator:
    def __init__(self, server_url: str, num_drones: int = 5):
        self.server_url = server_url
        self.num_drones = num_drones
        self.drones: List[ProductionMockDrone] = []
        
        self.base_locations = [
            (18.5204, 73.8567),  # Pune
            (19.0760, 72.8777),  # Mumbai
            (28.7041, 77.1025),  # Delhi
            (12.9716, 77.5946),  # Bangalore
            (22.5726, 88.3639),  # Kolkata
        ]
        
        self.drone_models = [
            'FlyOS_MQ5_Production_Latency',
            'FlyOS_MQ7_Production_Latency', 
            'FlyOS_MQ9_Production_Latency'
        ]

    def create_drone_configs(self) -> List[DroneConfig]:
        """Create drone configurations with latency measurement enabled"""
        configs = []
        
        for i in range(self.num_drones):
            lat, lng = self.base_locations[i % len(self.base_locations)]
            lat += random.uniform(-0.01, 0.01)
            lng += random.uniform(-0.01, 0.01)
            
            config = DroneConfig(
                drone_id=f"prod-latency-{i+1:03d}",
                model=random.choice(self.drone_models),
                base_lat=lat,
                base_lng=lng,
                jetson_serial=f"JETSON-PROD-LAT-{uuid.uuid4().hex[:8].upper()}",
                capabilities=[
                    'telemetry', 'camera', 'mavros', 'precision_landing',
                    'webrtc', 'commands', 'mission_planning', 'latency_measurement'
                ],
                telemetry_rate=random.uniform(8.0, 12.0),
                heartbeat_rate=random.uniform(0.08, 0.15),
                mavros_rate=random.uniform(0.8, 1.5),
                enable_latency_measurement=True
            )
            
            configs.append(config)
            
        return configs

    def create_drones(self) -> List[ProductionMockDrone]:
        """Create production mock drone instances"""
        configs = self.create_drone_configs()
        return [ProductionMockDrone(config, self.server_url) for config in configs]

    async def start_drone_batch(self, drones: List[ProductionMockDrone], batch_size: int = 3):
        """Start drones in batches"""
        for i in range(0, len(drones), batch_size):
            batch = drones[i:i + batch_size]
            logger.info(f"🚀 Starting production latency batch {i//batch_size + 1}: {len(batch)} drones")
            
            tasks = [asyncio.create_task(drone.run()) for drone in batch]
            
            if i + batch_size < len(drones):
                await asyncio.sleep(2)
                
        return tasks

    async def run_production_latency_simulation(self, duration_minutes: int = 5):
        """Run production multi-drone latency simulation"""
        logger.info(f"🎯 Production Multi-Drone Latency Simulation: {self.num_drones} drones")
        logger.info(f"📡 Target server: {self.server_url}")
        logger.info(f"⏱️ Duration: {duration_minutes} minutes")
        
        self.drones = self.create_drones()
        
        logger.info(f"✅ Created {len(self.drones)} production latency measurement drones")
        
        self.display_production_drone_summary()
        
        try:
            await self.start_drone_batch(self.drones, batch_size=3)
            logger.info(f"🎬 All {len(self.drones)} production drones started")
            
            # Monitor simulation for specified duration
            await self.monitor_production_latency_simulation(duration_minutes)
            
        except KeyboardInterrupt:
            logger.info("🛑 Production latency simulation stopped by user")
        finally:
            await self.cleanup()
            self.generate_production_fleet_latency_report()

    def display_production_drone_summary(self):
        """Display production drone summary"""
        logger.info("📋 Production Latency Measurement Drone Summary:")
        logger.info("=" * 80)
        
        model_counts = {}
        
        for drone in self.drones:
            model = drone.config.model
            model_counts[model] = model_counts.get(model, 0) + 1
            
            logger.info(f"  {drone.config.drone_id:<25} | {model:<25} | "
                       f"({drone.config.base_lat:.4f}, {drone.config.base_lng:.4f}) | "
                       f"Telemetry: {drone.config.telemetry_rate:.1f}Hz")
                       
        logger.info("=" * 80)
        logger.info("📊 Production Model Distribution:")
        for model, count in model_counts.items():
            logger.info(f"  {model}: {count} drones")
            
        logger.info("🔧 Production Latency Features:")
        logger.info(f"  Telemetry latency: ALL drones")
        logger.info(f"  Heartbeat latency: ALL drones")
        logger.info(f"  Command latency: ALL drones")
        logger.info(f"  Discovery/Registration latency: ALL drones")
        logger.info("=" * 80)

    async def monitor_production_latency_simulation(self, duration_minutes: int):
        """Monitor production latency simulation"""
        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        
        update_interval = 30
        last_update = start_time
        
        while time.time() < end_time:
            await asyncio.sleep(1)
            
            current_time = time.time()
            if current_time - last_update >= update_interval:
                await self.print_production_interim_report()
                last_update = current_time
                
                remaining_time = end_time - current_time
                logger.info(f"⏰ Time remaining: {remaining_time/60:.1f} minutes")

    async def print_production_interim_report(self):
        """Print interim production latency statistics"""
        connected_count = sum(1 for drone in self.drones if drone.registered)
        total_measurements = sum(len(drone.latency_measurements) for drone in self.drones)
        
        logger.info(f"📊 Production Interim Status:")
        logger.info(f"   Connected: {connected_count}/{len(self.drones)} drones")
        logger.info(f"   Total measurements: {total_measurements}")
        
        # Sample latency from production drones
        sample_drones = [drone for drone in self.drones[:3] if drone.registered and drone.latency_measurements]
        
        for drone in sample_drones:
            recent_telemetry = [m for m in drone.latency_measurements[-10:] if m.measurement_type == 'telemetry']
            recent_heartbeat = [m for m in drone.latency_measurements[-10:] if m.measurement_type == 'heartbeat']
            
            if recent_telemetry:
                avg_telemetry = statistics.mean([m.latency_ms for m in recent_telemetry])
                logger.info(f"   {drone.config.drone_id}: Telemetry avg: {avg_telemetry:.2f}ms")
            
            if recent_heartbeat:
                avg_heartbeat = statistics.mean([m.latency_ms for m in recent_heartbeat])
                logger.info(f"   {drone.config.drone_id}: Heartbeat avg: {avg_heartbeat:.2f}ms")

    def generate_production_fleet_latency_report(self):
        """Generate comprehensive production fleet latency report"""
        print(f"\n🚁 PRODUCTION FLEET LATENCY ANALYSIS REPORT")
        print("=" * 80)
        
        connected_drones = [drone for drone in self.drones if drone.latency_measurements]
        
        if not connected_drones:
            print("No latency data collected from any production drone")
            return
        
        print(f"Analyzed {len(connected_drones)} production drones with latency data")
        print(f"Total measurements: {sum(len(drone.latency_measurements) for drone in connected_drones)}")
        
        # Aggregate production statistics by measurement type
        fleet_stats = self.calculate_production_fleet_statistics(connected_drones)
        
        # Print production fleet-wide statistics
        print(f"\n📊 PRODUCTION FLEET-WIDE LATENCY STATISTICS:")
        print("-" * 50)
        
        for measurement_type, stats in fleet_stats.items():
            print(f"\n{measurement_type.upper()}:")
            print(f"  Participating drones: {stats['drone_count']}")
            print(f"  Total measurements: {stats['total_measurements']}")
            print(f"  Fleet avg latency: {stats['fleet_avg']:.2f}ms")
            print(f"  Fleet median: {stats['fleet_median']:.2f}ms")
            print(f"  Fleet P95: {stats['fleet_p95']:.2f}ms")
            print(f"  Fleet P99: {stats['fleet_p99']:.2f}ms")
            print(f"  Best drone avg: {stats['best_drone_avg']:.2f}ms")
            print(f"  Worst drone avg: {stats['worst_drone_avg']:.2f}ms")
            print(f"  Avg payload size: {stats['avg_payload_size']} bytes")
        
        # Print per-drone breakdown for production
        print(f"\n📋 PRODUCTION PER-DRONE LATENCY BREAKDOWN:")
        print("-" * 50)
        
        for drone in connected_drones:
            drone_stats = drone.get_latency_statistics()
            if drone_stats:
                print(f"\n{drone.config.drone_id} ({drone.config.model}):")
                for measurement_type, stat in drone_stats.items():
                    status = self.evaluate_production_latency(measurement_type, stat.avg_ms)
                    print(f"  {measurement_type}: {stat.avg_ms:.2f}ms avg, {stat.count} samples ({status})")
        
        # Production network performance analysis
        self.analyze_production_network_performance(connected_drones)
        
        # Production recommendations
        self.generate_production_recommendations(fleet_stats)
        
        print("=" * 80)

    def calculate_production_fleet_statistics(self, connected_drones: List[ProductionMockDrone]) -> Dict:
        """Calculate production fleet-wide latency statistics"""
        fleet_stats = {}
        
        all_measurements_by_type = {}
        
        for drone in connected_drones:
            for measurement in drone.latency_measurements:
                measurement_type = measurement.measurement_type
                if measurement_type not in all_measurements_by_type:
                    all_measurements_by_type[measurement_type] = []
                all_measurements_by_type[measurement_type].append(measurement)
        
        for measurement_type, measurements in all_measurements_by_type.items():
            if not measurements:
                continue
            
            latencies = [m.latency_ms for m in measurements]
            payload_sizes = [m.payload_size_bytes for m in measurements]
            
            drone_averages = []
            participating_drones = set()
            
            for drone in connected_drones:
                drone_measurements = [m for m in drone.latency_measurements if m.measurement_type == measurement_type]
                if drone_measurements:
                    drone_avg = statistics.mean([m.latency_ms for m in drone_measurements])
                    drone_averages.append(drone_avg)
                    participating_drones.add(drone.config.drone_id)
            
            fleet_stats[measurement_type] = {
                'drone_count': len(participating_drones),
                'total_measurements': len(measurements),
                'fleet_avg': statistics.mean(latencies),
                'fleet_median': statistics.median(latencies),
                'fleet_p95': self.percentile(latencies, 95),
                'fleet_p99': self.percentile(latencies, 99),
                'best_drone_avg': min(drone_averages) if drone_averages else 0,
                'worst_drone_avg': max(drone_averages) if drone_averages else 0,
                'avg_payload_size': int(statistics.mean(payload_sizes)) if payload_sizes else 0
            }
        
        return fleet_stats

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

    def evaluate_production_latency(self, measurement_type: str, latency_ms: float) -> str:
        """Evaluate production latency performance"""
        production_thresholds = {
            'telemetry': {'excellent': 30, 'good': 50, 'acceptable': 100},
            'heartbeat': {'excellent': 50, 'good': 100, 'acceptable': 200},
            'discovery': {'excellent': 100, 'good': 200, 'acceptable': 500},
            'registration': {'excellent': 200, 'good': 400, 'acceptable': 800},
            'command': {'excellent': 100, 'good': 200, 'acceptable': 500}
        }
        
        if measurement_type not in production_thresholds:
            thresholds = {'excellent': 50, 'good': 100, 'acceptable': 200}
        else:
            thresholds = production_thresholds[measurement_type]
        
        if latency_ms <= thresholds['excellent']:
            return 'EXCELLENT'
        elif latency_ms <= thresholds['good']:
            return 'GOOD'
        elif latency_ms <= thresholds['acceptable']:
            return 'ACCEPTABLE'
        else:
            return 'POOR'

    def analyze_production_network_performance(self, connected_drones: List[ProductionMockDrone]):
        """Analyze production network performance"""
        print(f"\n🌐 PRODUCTION NETWORK PERFORMANCE ANALYSIS:")
        print("-" * 50)
        
        all_telemetry = []
        all_discovery = []
        all_registration = []
        
        for drone in connected_drones:
            all_telemetry.extend([m for m in drone.latency_measurements if m.measurement_type == 'telemetry'])
            all_discovery.extend([m for m in drone.latency_measurements if m.measurement_type == 'discovery'])
            all_registration.extend([m for m in drone.latency_measurements if m.measurement_type == 'registration'])
        
        if all_telemetry:
            latencies = [m.latency_ms for m in all_telemetry]
            payload_sizes = [m.payload_size_bytes for m in all_telemetry]
            
            total_data_bytes = sum(payload_sizes)
            measurement_duration = max([m.receive_timestamp for m in all_telemetry]) - min([m.send_timestamp for m in all_telemetry])
            throughput_bps = (total_data_bytes * 8) / measurement_duration if measurement_duration > 0 else 0
            
            print(f"  Production telemetry analysis:")
            print(f"    Total data transmitted: {total_data_bytes:,} bytes")
            print(f"    Average throughput: {throughput_bps/1000:.2f} kbps")
            print(f"    Average packet size: {statistics.mean(payload_sizes):.0f} bytes")
            
            print(f"  Production latency distribution:")
            print(f"    < 30ms: {len([l for l in latencies if l < 30])} ({len([l for l in latencies if l < 30])/len(latencies)*100:.1f}%)")
            print(f"    30-50ms: {len([l for l in latencies if 30 <= l < 50])} ({len([l for l in latencies if 30 <= l < 50])/len(latencies)*100:.1f}%)")
            print(f"    50-100ms: {len([l for l in latencies if 50 <= l < 100])} ({len([l for l in latencies if 50 <= l < 100])/len(latencies)*100:.1f}%)")
            print(f"    > 100ms: {len([l for l in latencies if l >= 100])} ({len([l for l in latencies if l >= 100])/len(latencies)*100:.1f}%)")
        
        if all_discovery:
            discovery_avg = statistics.mean([m.latency_ms for m in all_discovery])
            print(f"  Production server discovery avg: {discovery_avg:.2f}ms")
            
        if all_registration:
            registration_avg = statistics.mean([m.latency_ms for m in all_registration])
            print(f"  Production registration avg: {registration_avg:.2f}ms")

    def generate_production_recommendations(self, fleet_stats: Dict):
        """Generate production performance recommendations"""
        print(f"\n💡 PRODUCTION PERFORMANCE RECOMMENDATIONS:")
        print("-" * 50)
        
        recommendations = []
        
        if 'telemetry' in fleet_stats:
            telemetry_avg = fleet_stats['telemetry']['fleet_avg']
            if telemetry_avg > 100:
                recommendations.append("HIGH PRODUCTION TELEMETRY LATENCY: Optimize network or reduce rate")
            elif telemetry_avg < 30:
                recommendations.append("EXCELLENT PRODUCTION TELEMETRY: Current settings optimal")
        
        if 'heartbeat' in fleet_stats:
            heartbeat_avg = fleet_stats['heartbeat']['fleet_avg']
            if heartbeat_avg > 200:
                recommendations.append("HIGH PRODUCTION HEARTBEAT LATENCY: Network congestion detected")
        
        if 'discovery' in fleet_stats:
            discovery_avg = fleet_stats['discovery']['fleet_avg']
            if discovery_avg > 500:
                recommendations.append("SLOW PRODUCTION DISCOVERY: Check server load or network")
        
        if 'registration' in fleet_stats:
            registration_avg = fleet_stats['registration']['fleet_avg']
            if registration_avg > 800:
                recommendations.append("SLOW PRODUCTION REGISTRATION: Optimize registration process")
        
        if not recommendations:
            recommendations.append("PRODUCTION PERFORMANCE: All systems operating within acceptable parameters")
        
        for i, recommendation in enumerate(recommendations, 1):
            print(f"  {i}. {recommendation}")

    async def cleanup(self):
        """Clean up production drone connections"""
        logger.info("🧹 Cleaning up production drone connections...")
        
        cleanup_tasks = []
        for drone in self.drones:
            if drone.registered:
                task = asyncio.create_task(drone.disconnect())
                cleanup_tasks.append(task)
                
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
            
        logger.info("✅ Production cleanup completed")

    def export_production_latency_data(self, filename: str = None):
        """Export production latency data to JSON"""
        if not filename:
            filename = f"production_latency_data_{int(time.time())}.json"
        
        export_data = {
            'metadata': {
                'timestamp': time.time(),
                'server_url': self.server_url,
                'num_drones': self.num_drones,
                'connected_drones': len([d for d in self.drones if d.latency_measurements]),
                'test_type': 'production_fleet_latency'
            },
            'drone_data': []
        }
        
        for drone in self.drones:
            if drone.latency_measurements:
                drone_data = {
                    'drone_id': drone.config.drone_id,
                    'model': drone.config.model,
                    'location': [drone.config.base_lat, drone.config.base_lng],
                    'jetson_serial': drone.config.jetson_serial,
                    'measurements': [
                        {
                            'type': m.measurement_type,
                            'latency_ms': m.latency_ms,
                            'payload_bytes': m.payload_size_bytes,
                            'timestamp': m.send_timestamp,
                            'sequence_id': m.sequence_id
                        }
                        for m in drone.latency_measurements
                    ]
                }
                export_data['drone_data'].append(drone_data)
        
        with open(filename, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        logger.info(f"📁 Production latency data exported to {filename}")

def main():
    parser = argparse.ArgumentParser(description='Production Multi-Drone Latency Simulator')
    parser.add_argument('--server', default='http://localhost:4005', 
                       help='Production server URL (default: http://localhost:4005)')
    parser.add_argument('--drones', type=int, default=5, 
                       help='Number of drones to simulate (default: 5)')
    parser.add_argument('--duration', type=int, default=5,
                       help='Test duration in minutes (default: 5)')
    parser.add_argument('--export', action='store_true',
                       help='Export latency data to JSON file')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                       default='INFO', help='Log level (default: INFO)')
    
    args = parser.parse_args()
    
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    if args.drones <= 0:
        logger.error("❌ Number of drones must be positive")
        return
        
    if args.drones > 50:
        logger.warning(f"⚠️ {args.drones} production drones is a lot!")
        response = input("Continue? (y/N): ")
        if response.lower() != 'y':
            return
    
    if args.duration <= 0:
        logger.error("❌ Duration must be positive")
        return
    
    simulator = MultiDroneProductionLatencySimulator(args.server, args.drones)
    
    try:
        asyncio.run(simulator.run_production_latency_simulation(args.duration))
        
        if args.export:
            simulator.export_production_latency_data()
            
    except KeyboardInterrupt:
        logger.info("🛑 Production latency simulator stopped by user")
    except Exception as e:
        logger.error(f"❌ Production simulator failed: {e}")

if __name__ == "__main__":
    main()