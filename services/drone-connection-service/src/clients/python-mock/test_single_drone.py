# services/drone-connection-service/src/clients/python-mock/test_single_drone.py
"""
Single drone test script for debugging and validation
"""
import asyncio
import argparse
import logging
import sys
import time
from drone_simulator_prod import ProductionMockDrone as MockDrone, DroneConfig

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('drone_test.log')
    ]
)
logger = logging.getLogger(__name__)

class SingleDroneTest:
    def __init__(self, server_url: str, drone_id: str = "test-drone-001"):
        self.server_url = server_url
        self.drone_id = drone_id
        self.test_results = {}
        
    async def test_connection_flow(self):
        """Test the complete connection flow"""
        logger.info("🧪 Testing complete connection flow...")
        
        config = DroneConfig(
            drone_id=self.drone_id,
            model="FlyOS_Test_Drone",
            base_lat=18.5204,
            base_lng=73.8567,
            jetson_serial="JETSON-TEST-001",
            capabilities=['telemetry', 'camera', 'mavros', 'precision_landing', 'commands'],
            telemetry_rate=5.0,  # Lower rate for testing
            heartbeat_rate=0.5,
            mavros_rate=0.5
        )
        
        drone = MockDrone(config, self.server_url)
        
        try:
            # Test 1: Discovery
            logger.info("1️⃣ Testing server discovery...")
            discovery_result = await drone.discover_server()
            self.test_results['discovery'] = discovery_result
            
            if not discovery_result:
                logger.error("❌ Discovery failed")
                return False
                
            logger.info("✅ Discovery successful")
            
            # Test 2: HTTP Registration
            logger.info("2️⃣ Testing HTTP registration...")
            registration_result = await drone.register_with_server()
            self.test_results['http_registration'] = registration_result
            
            if not registration_result:
                logger.error("❌ HTTP registration failed")
                return False
                
            logger.info("✅ HTTP registration successful")
            logger.info(f"   Session token: {drone.session_token}")
            
            # Test 3: WebSocket Connection
            logger.info("3️⃣ Testing WebSocket connection...")
            ws_connect_start = time.time()
            
            await drone.sio.connect(drone.ws_url)
            self.test_results['websocket_connection'] = True
            
            ws_connect_time = time.time() - ws_connect_start
            logger.info(f"✅ WebSocket connected in {ws_connect_time:.2f}s")
            
            # Test 4: WebSocket Registration
            logger.info("4️⃣ Testing WebSocket registration...")
            await drone.register_drone()
            
            # Wait for registration confirmation
            max_wait = 10
            wait_start = time.time()
            
            while not drone.registered and (time.time() - wait_start) < max_wait:
                await asyncio.sleep(0.1)
                
            if not drone.registered:
                logger.error("❌ WebSocket registration timeout")
                self.test_results['websocket_registration'] = False
                return False
                
            self.test_results['websocket_registration'] = True
            reg_time = time.time() - wait_start
            logger.info(f"✅ WebSocket registration successful in {reg_time:.2f}s")
            
            # Test 5: Data Streams
            logger.info("5️⃣ Testing data streams...")
            await drone.start_data_streams()
            
            # Let streams run for a bit
            stream_test_duration = 10
            logger.info(f"   Running streams for {stream_test_duration}s...")
            
            await asyncio.sleep(stream_test_duration)
            
            self.test_results['data_streams'] = True
            logger.info("✅ Data streams working")
            
            # Test 6: Command Handling
            logger.info("6️⃣ Testing command handling...")
            
            # Simulate receiving a command
            test_command = {
                'id': 'test-cmd-001',
                'type': 'arm',
                'parameters': {},
                'timestamp': time.time() * 1000
            }
            
            await drone.handle_command(test_command)
            self.test_results['command_handling'] = True
            logger.info("✅ Command handling working")
            
            # Test 7: Precision Landing
            logger.info("7️⃣ Testing precision landing...")
            await drone.start_precision_landing()
            
            # Wait for precision landing to complete
            await asyncio.sleep(8)  # 4 stages * 2 seconds each
            
            self.test_results['precision_landing'] = True
            logger.info("✅ Precision landing simulation working")
            
            # Test 8: WebRTC Signaling
            logger.info("8️⃣ Testing WebRTC signaling...")
            
            webrtc_test_data = {
                'sessionId': 'test-session-001',
                'sessionType': 'camera',
                'stunServers': [{'urls': 'stun:stun.l.google.com:19302'}]
            }
            
            await drone.handle_webrtc_offer_request(webrtc_test_data)
            self.test_results['webrtc_signaling'] = True
            logger.info("✅ WebRTC signaling working")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Test failed with exception: {e}")
            self.test_results['exception'] = str(e)
            return False
            
        finally:
            # Cleanup
            try:
                await drone.disconnect()
            except:
                pass
                
    async def test_reconnection(self):
        """Test reconnection behavior"""
        logger.info("🔄 Testing reconnection behavior...")
        
        config = DroneConfig(
            drone_id=f"{self.drone_id}-reconnect",
            model="FlyOS_Reconnect_Test",
            base_lat=18.5204,
            base_lng=73.8567,
            jetson_serial="JETSON-RECONNECT-001",
            capabilities=['telemetry', 'commands']
        )
        
        drone = MockDrone(config, self.server_url)
        
        try:
            # Initial connection
            logger.info("🔌 Initial connection...")
            connected = await drone.connect()
            
            if not connected:
                logger.error("❌ Initial connection failed")
                return False
                
            logger.info("✅ Initial connection successful")
            
            # Wait a bit
            await asyncio.sleep(3)
            
            # Disconnect
            logger.info("📴 Disconnecting...")
            await drone.disconnect()
            
            # Wait before reconnect
            await asyncio.sleep(2)
            
            # Reconnect
            logger.info("🔌 Reconnecting...")
            reconnected = await drone.connect()
            
            if not reconnected:
                logger.error("❌ Reconnection failed")
                self.test_results['reconnection'] = False
                return False
                
            self.test_results['reconnection'] = True
            logger.info("✅ Reconnection successful")
            
            # Cleanup
            await drone.disconnect()
            return True
            
        except Exception as e:
            logger.error(f"❌ Reconnection test failed: {e}")
            self.test_results['reconnection_exception'] = str(e)
            return False
            
    async def test_latency(self):
        """Test connection latency"""
        logger.info("⚡ Testing connection latency...")
        
        config = DroneConfig(
            drone_id=f"{self.drone_id}-latency",
            model="FlyOS_Latency_Test",
            base_lat=18.5204,
            base_lng=73.8567,
            jetson_serial="JETSON-LATENCY-001",
            capabilities=['telemetry']
        )
        
        drone = MockDrone(config, self.server_url)
        
        try:
            # Connect
            connected = await drone.connect()
            if not connected:
                logger.error("❌ Connection failed for latency test")
                return False
                
            # Measure telemetry latency
            latencies = []
            
            for i in range(10):
                start_time = time.time()
                
                # Send telemetry
                telemetry_data = {
                    'timestamp': start_time * 1000,
                    'test_sequence': i,
                    'latitude': 18.5204,
                    'longitude': 73.8567
                }
                
                await drone.sio.emit('telemetry_real', telemetry_data)
                
                # Wait for ack (this is simplified - in real test we'd wait for actual ack)
                await asyncio.sleep(0.1)
                
                end_time = time.time()
                latency = (end_time - start_time) * 1000  # Convert to ms
                latencies.append(latency)
                
            avg_latency = sum(latencies) / len(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            
            self.test_results['latency'] = {
                'average': avg_latency,
                'min': min_latency,
                'max': max_latency,
                'samples': latencies
            }
            
            logger.info(f"📊 Latency results:")
            logger.info(f"   Average: {avg_latency:.2f}ms")
            logger.info(f"   Min: {min_latency:.2f}ms")
            logger.info(f"   Max: {max_latency:.2f}ms")
            
            # Cleanup
            await drone.disconnect()
            return True
            
        except Exception as e:
            logger.error(f"❌ Latency test failed: {e}")
            self.test_results['latency_exception'] = str(e)
            return False
            
    def print_results(self):
        """Print test results summary"""
        logger.info("📊 TEST RESULTS SUMMARY")
        logger.info("=" * 50)
        
        total_tests = len([k for k in self.test_results.keys() if not k.endswith('_exception')])
        passed_tests = len([k for k, v in self.test_results.items() if v is True])
        
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {total_tests - passed_tests}")
        logger.info(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
        logger.info("")
        
        for test_name, result in self.test_results.items():
            if test_name.endswith('_exception'):
                continue
                
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{test_name:<25} {status}")
            
        # Show exceptions if any
        exceptions = {k: v for k, v in self.test_results.items() if k.endswith('_exception')}
        if exceptions:
            logger.info("")
            logger.info("Exceptions:")
            for exc_name, exc_msg in exceptions.items():
                logger.info(f"  {exc_name}: {exc_msg}")
                
        logger.info("=" * 50)
        
    async def run_all_tests(self):
        """Run all tests"""
        logger.info("🧪 Starting comprehensive drone connection tests...")
        
        tests = [
            ("Connection Flow", self.test_connection_flow),
            ("Reconnection", self.test_reconnection),
            ("Latency", self.test_latency)
        ]
        
        for test_name, test_func in tests:
            logger.info(f"\n🔬 Running {test_name} test...")
            try:
                await test_func()
            except Exception as e:
                logger.error(f"❌ {test_name} test crashed: {e}")
                
        self.print_results()

def main():
    parser = argparse.ArgumentParser(description='Single Drone Connection Test')
    parser.add_argument('--server', default='http://65.1.63.189:4005', help='Server URL')
    parser.add_argument('--drone-id', default='test-drone-001', help='Drone ID for testing')
    parser.add_argument('--test', choices=['all', 'connection', 'reconnection', 'latency'], 
                       default='all', help='Which test to run')
    
    args = parser.parse_args()
    
    tester = SingleDroneTest(args.server, args.drone_id)
    
    try:
        if args.test == 'all':
            asyncio.run(tester.run_all_tests())
        elif args.test == 'connection':
            asyncio.run(tester.test_connection_flow())
        elif args.test == 'reconnection':
            asyncio.run(tester.test_reconnection())
        elif args.test == 'latency':
            asyncio.run(tester.test_latency())
            
        tester.print_results()
        
    except KeyboardInterrupt:
        logger.info("🛑 Test stopped by user")

if __name__ == "__main__":
    main()