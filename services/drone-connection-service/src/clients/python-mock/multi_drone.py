# services/drone-connection-service/src/clients/python-mock/multi_drone.py
import asyncio
import argparse
import logging
import random
import uuid
from typing import List
from drone_simulator import MockDrone, DroneConfig

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MultiDroneSimulator:
    def __init__(self, server_url: str, num_drones: int = 5):
        self.server_url = server_url
        self.num_drones = num_drones
        self.drones: List[MockDrone] = []
        
        # Base locations for different regions
        self.base_locations = [
            (18.5204, 73.8567),  # Pune, India
            (19.0760, 72.8777),  # Mumbai, India
            (28.7041, 77.1025),  # Delhi, India
            (12.9716, 77.5946),  # Bangalore, India
            (22.5726, 88.3639),  # Kolkata, India
            (13.0827, 80.2707),  # Chennai, India
            (23.0225, 72.5714),  # Ahmedabad, India
            (26.9124, 75.7873),  # Jaipur, India
            (17.3850, 78.4867),  # Hyderabad, India
            (15.2993, 74.1240),  # Goa, India
        ]
        
        # Drone models
        self.drone_models = [
            'FlyOS_MQ5_Python',
            'FlyOS_MQ7_Python', 
            'FlyOS_MQ9_Python'
        ]
        
        # Capabilities sets
        self.capability_sets = [
            ['telemetry', 'camera', 'mavros', 'commands'],
            ['telemetry', 'camera', 'mavros', 'precision_landing', 'commands'],
            ['telemetry', 'camera', 'mavros', 'precision_landing', 'webrtc', 'commands', 'mission_planning']
        ]
        
    def create_drone_configs(self) -> List[DroneConfig]:
        """Create configurations for multiple drones"""
        configs = []
        
        for i in range(self.num_drones):
            # Select base location
            lat, lng = self.base_locations[i % len(self.base_locations)]
            
            # Add some random offset to spread drones around
            lat += random.uniform(-0.01, 0.01)
            lng += random.uniform(-0.01, 0.01)
            
            config = DroneConfig(
                drone_id=f"python-drone-{i+1:03d}",
                model=random.choice(self.drone_models),
                base_lat=lat,
                base_lng=lng,
                jetson_serial=f"JETSON-PY-{uuid.uuid4().hex[:8].upper()}",
                capabilities=random.choice(self.capability_sets),
                telemetry_rate=random.uniform(5.0, 15.0),  # Vary rates
                heartbeat_rate=random.uniform(0.05, 0.2),
                mavros_rate=random.uniform(0.5, 2.0)
            )
            
            configs.append(config)
            
        return configs
        
    def create_drones(self) -> List[MockDrone]:
        """Create mock drone instances"""
        configs = self.create_drone_configs()
        drones = []
        
        for config in configs:
            drone = MockDrone(config, self.server_url)
            drones.append(drone)
            
        return drones
        
    async def start_drone_batch(self, drones: List[MockDrone], batch_size: int = 3, delay: float = 2.0):
        """Start drones in batches to avoid overwhelming the server"""
        
        for i in range(0, len(drones), batch_size):
            batch = drones[i:i + batch_size]
            
            logger.info(f"🚀 Starting batch {i//batch_size + 1}: {len(batch)} drones")
            
            # Start batch concurrently
            batch_tasks = []
            for drone in batch:
                task = asyncio.create_task(drone.run())
                batch_tasks.append(task)
                
            # Small delay between drone connections within batch
            for j, task in enumerate(batch_tasks):
                if j > 0:
                    await asyncio.sleep(0.5)
                    
            # Wait before starting next batch
            if i + batch_size < len(drones):
                logger.info(f"⏳ Waiting {delay}s before next batch...")
                await asyncio.sleep(delay)
                
        return batch_tasks
        
    async def run_simulation(self):
        """Run the multi-drone simulation"""
        logger.info(f"🎯 Starting multi-drone simulation with {self.num_drones} drones")
        logger.info(f"📡 Target server: {self.server_url}")
        
        # Create all drones
        self.drones = self.create_drones()
        
        logger.info(f"✅ Created {len(self.drones)} mock drones")
        
        # Display drone summary
        self.display_drone_summary()
        
        # Start drones in batches
        try:
            tasks = await self.start_drone_batch(self.drones, batch_size=3, delay=3.0)
            
            logger.info(f"🎬 All {len(self.drones)} drones started")
            logger.info("📊 Simulation running... Press Ctrl+C to stop")
            
            # Monitor simulation
            await self.monitor_simulation()
            
        except KeyboardInterrupt:
            logger.info("🛑 Simulation stopped by user")
        except Exception as e:
            logger.error(f"❌ Simulation error: {e}")
        finally:
            await self.cleanup()
            
    def display_drone_summary(self):
        """Display summary of created drones"""
        logger.info("📋 Drone Summary:")
        logger.info("=" * 80)
        
        model_counts = {}
        capability_counts = {}
        
        for drone in self.drones:
            # Count models
            model = drone.config.model
            model_counts[model] = model_counts.get(model, 0) + 1
            
            # Count capabilities
            for cap in drone.config.capabilities:
                capability_counts[cap] = capability_counts.get(cap, 0) + 1
                
            # Display individual drone info
            logger.info(f"  {drone.config.drone_id:<20} | {model:<20} | "
                       f"({drone.config.base_lat:.4f}, {drone.config.base_lng:.4f}) | "
                       f"{len(drone.config.capabilities)} capabilities")
                       
        logger.info("=" * 80)
        logger.info("📊 Model Distribution:")
        for model, count in model_counts.items():
            logger.info(f"  {model}: {count} drones")
            
        logger.info("🔧 Capability Distribution:")
        for cap, count in capability_counts.items():
            logger.info(f"  {cap}: {count} drones")
        logger.info("=" * 80)
        
    async def monitor_simulation(self):
        """Monitor the simulation and provide periodic status updates"""
        start_time = asyncio.get_event_loop().time()
        
        while True:
            await asyncio.sleep(30)  # Status update every 30 seconds
            
            elapsed = asyncio.get_event_loop().time() - start_time
            
            # Count connected drones
            connected_count = sum(1 for drone in self.drones if drone.registered)
            
            logger.info(f"📊 Status Update (Runtime: {elapsed:.0f}s)")
            logger.info(f"   Connected: {connected_count}/{len(self.drones)} drones")
            
            # Display connection quality for a few drones
            for i, drone in enumerate(self.drones[:3]):  # Show first 3 drones
                if drone.registered:
                    logger.info(f"   {drone.config.drone_id}: ✅ Connected - "
                               f"Battery: {drone.state.percentage:.1f}% - "
                               f"Alt: {drone.state.altitude_relative:.1f}m")
                else:
                    logger.info(f"   {drone.config.drone_id}: ❌ Disconnected")
                    
    async def cleanup(self):
        """Clean up all drone connections"""
        logger.info("🧹 Cleaning up drone connections...")
        
        cleanup_tasks = []
        for drone in self.drones:
            if drone.registered:
                task = asyncio.create_task(drone.disconnect())
                cleanup_tasks.append(task)
                
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
            
        logger.info("✅ Cleanup completed")
        
    async def stress_test(self, duration: int = 300):
        """Run a stress test with dynamic drone connections"""
        logger.info(f"🔥 Starting stress test for {duration} seconds")
        
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < duration:
            try:
                # Randomly disconnect/reconnect drones
                for drone in random.sample(self.drones, min(2, len(self.drones))):
                    if drone.registered and random.random() < 0.1:  # 10% chance
                        logger.info(f"🔄 Stress test: Disconnecting {drone.config.drone_id}")
                        await drone.disconnect()
                        
                        # Reconnect after a delay
                        await asyncio.sleep(random.uniform(5, 15))
                        logger.info(f"🔄 Stress test: Reconnecting {drone.config.drone_id}")
                        asyncio.create_task(drone.run())
                        
                await asyncio.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                logger.error(f"❌ Stress test error: {e}")
                
        logger.info("🔥 Stress test completed")

def main():
    parser = argparse.ArgumentParser(description='Multi-Drone Simulator')
    parser.add_argument('--server', default='http://localhost:4005', 
                       help='Server URL (default: http://localhost:4005)')
    parser.add_argument('--drones', type=int, default=5, 
                       help='Number of drones to simulate (default: 5)')
    parser.add_argument('--mode', choices=['normal', 'stress'], default='normal',
                       help='Simulation mode (default: normal)')
    parser.add_argument('--stress-duration', type=int, default=300,
                       help='Stress test duration in seconds (default: 300)')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                       default='INFO', help='Log level (default: INFO)')
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Validate inputs
    if args.drones <= 0:
        logger.error("❌ Number of drones must be positive")
        return
        
    if args.drones > 50:
        logger.warning(f"⚠️ {args.drones} drones is a lot! This might overwhelm the server.")
        response = input("Continue? (y/N): ")
        if response.lower() != 'y':
            return
            
    # Create simulator
    simulator = MultiDroneSimulator(args.server, args.drones)
    
    try:
        if args.mode == 'stress':
            logger.info(f"🔥 Running stress test mode for {args.stress_duration} seconds")
            asyncio.run(simulator.stress_test(args.stress_duration))
        else:
            asyncio.run(simulator.run_simulation())
            
    except KeyboardInterrupt:
        logger.info("🛑 Simulator stopped by user")
    except Exception as e:
        logger.error(f"❌ Simulator failed: {e}")

if __name__ == "__main__":
    main()