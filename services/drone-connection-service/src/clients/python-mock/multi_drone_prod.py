# services/drone-connection-service/src/clients/python-mock/multi_drone_prod.py
import asyncio
import argparse
import logging
import random
import uuid
from typing import List
from drone_simulator_prod import ProductionMockDrone, DroneConfig

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MultiDroneProductionSimulator:
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
            'FlyOS_MQ5_Production',
            'FlyOS_MQ7_Production', 
            'FlyOS_MQ9_Production'
        ]

    def create_drone_configs(self) -> List[DroneConfig]:
        configs = []
        
        for i in range(self.num_drones):
            lat, lng = self.base_locations[i % len(self.base_locations)]
            lat += random.uniform(-0.01, 0.01)
            lng += random.uniform(-0.01, 0.01)
            
            config = DroneConfig(
                drone_id=f"prod-multi-{i+1:03d}",
                model=random.choice(self.drone_models),
                base_lat=lat,
                base_lng=lng,
                jetson_serial=f"JETSON-MULTI-{uuid.uuid4().hex[:8].upper()}",
                capabilities=[
                    'telemetry', 'camera', 'mavros', 'precision_landing',
                    'webrtc', 'commands', 'mission_planning'
                ],
                telemetry_rate=random.uniform(8.0, 12.0),
                heartbeat_rate=random.uniform(0.08, 0.15),
                mavros_rate=random.uniform(0.8, 1.5)
            )
            
            configs.append(config)
            
        return configs

    def create_drones(self) -> List[ProductionMockDrone]:
        configs = self.create_drone_configs()
        return [ProductionMockDrone(config, self.server_url) for config in configs]

    async def start_drone_batch(self, drones: List[ProductionMockDrone], batch_size: int = 3):
        for i in range(0, len(drones), batch_size):
            batch = drones[i:i + batch_size]
            logger.info(f"🚀 Starting batch {i//batch_size + 1}: {len(batch)} drones")
            
            tasks = [asyncio.create_task(drone.run()) for drone in batch]
            
            if i + batch_size < len(drones):
                await asyncio.sleep(2)
                
        return tasks

    async def run_simulation(self):
        logger.info(f"🎯 Production multi-drone simulation: {self.num_drones} drones")
        logger.info(f"📡 Target server: {self.server_url}")
        
        self.drones = self.create_drones()
        
        try:
            await self.start_drone_batch(self.drones, batch_size=3)
            logger.info(f"🎬 All {len(self.drones)} drones started")
            
            while True:
                await asyncio.sleep(10)
                
        except KeyboardInterrupt:
            logger.info("🛑 Simulation stopped")
        finally:
            await self.cleanup()

    async def cleanup(self):
        logger.info("🧹 Cleaning up...")
        cleanup_tasks = [drone.disconnect() for drone in self.drones if drone.registered]
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)
        logger.info("✅ Cleanup completed")

def main():
    parser = argparse.ArgumentParser(description='Production Multi-Drone Simulator')
    parser.add_argument('--server', default='http://localhost:4005', help='Server URL')
    parser.add_argument('--drones', type=int, default=5, help='Number of drones')
    
    args = parser.parse_args()
    
    simulator = MultiDroneProductionSimulator(args.server, args.drones)
    
    try:
        asyncio.run(simulator.run_simulation())
    except KeyboardInterrupt:
        logger.info("🛑 Simulator stopped")

if __name__ == "__main__":
    main()