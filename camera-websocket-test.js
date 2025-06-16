#!/usr/bin/env node
// camera-websocket-test.js - Comprehensive Camera WebSocket Testing Script
// Run with: node camera-websocket-test.js

const { io } = require('socket.io-client');
const axios = require('axios');

// Test Configuration
const CONFIG = {
  FRONTEND_URL: 'http://localhost:3001',
  REALTIME_SERVICE_URL: 'http://localhost:4002',
  DRONE_CONNECTION_SERVICE_URL: 'http://localhost:4005',
  REDIS_URL: 'redis://localhost:6379',
  TEST_DRONE_ID: 'drone-001',
  TEST_CAMERA: 'front',
  TEST_TOKEN: null, // Will be populated during login
  TIMEOUT: 10000 // 10 seconds
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  debug: (msg) => console.log(`${colors.cyan}[DEBUG]${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.magenta}=== ${msg} ===${colors.reset}`)
};

// Test Results Collector
const testResults = {
  authentication: { passed: false, errors: [] },
  frontendAPI: { passed: false, errors: [] },
  droneConnectionService: { passed: false, errors: [] },
  realtimeService: { passed: false, errors: [] },
  cameraWebSocket: { passed: false, errors: [] },
  cameraStreaming: { passed: false, errors: [] },
  dataFlow: { passed: false, errors: [] },
  errorHandling: { passed: false, errors: [] }
};

// Helper function to make HTTP requests with timeout
async function makeRequest(url, options = {}) {
  try {
    const response = await axios({
      url,
      timeout: CONFIG.TIMEOUT,
      ...options
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data 
    };
  }
}

// Test 1: Authentication and Token Generation
async function testAuthentication() {
  log.header('Testing Authentication');
  
  try {
    // Test login to get valid token
    log.info('Attempting login to get authentication token...');
    
    const loginData = {
      email: 'main@flyos.mil',
      password: 'admin123'
    };
    
    const loginResponse = await makeRequest(`${CONFIG.FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: loginData
    });
    
    if (loginResponse.success && loginResponse.data.token) {
      CONFIG.TEST_TOKEN = loginResponse.data.token;
      log.success(`Login successful. Token obtained: ${CONFIG.TEST_TOKEN.substring(0, 20)}...`);
      log.debug(`User role: ${loginResponse.data.user.role}`);
      testResults.authentication.passed = true;
      return true;
    } else {
      const error = `Login failed: ${loginResponse.error || 'Unknown error'}`;
      log.error(error);
      testResults.authentication.errors.push(error);
      return false;
    }
  } catch (error) {
    const errorMsg = `Authentication test failed: ${error.message}`;
    log.error(errorMsg);
    testResults.authentication.errors.push(errorMsg);
    return false;
  }
}

// Test 2: Frontend API Endpoints
async function testFrontendAPI() {
  log.header('Testing Frontend API Endpoints');
  
  if (!CONFIG.TEST_TOKEN) {
    const error = 'No authentication token available';
    log.error(error);
    testResults.frontendAPI.errors.push(error);
    return false;
  }
  
  const headers = {
    'Authorization': `Bearer ${CONFIG.TEST_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  // Test drone telemetry endpoint
  log.info(`Testing drone telemetry endpoint: /api/drone-telemetry/${CONFIG.TEST_DRONE_ID}`);
  const telemetryResponse = await makeRequest(
    `${CONFIG.FRONTEND_URL}/api/drone-telemetry/${CONFIG.TEST_DRONE_ID}`,
    { headers }
  );
  
  if (telemetryResponse.success) {
    log.success(`Telemetry endpoint responded: ${telemetryResponse.status}`);
    log.debug(`Telemetry data keys: ${Object.keys(telemetryResponse.data || {}).join(', ')}`);
  } else {
    const error = `Telemetry endpoint failed: ${telemetryResponse.error}`;
    log.error(error);
    testResults.frontendAPI.errors.push(error);
  }
  
  // Test drone status endpoint
  log.info('Testing drone status endpoint: /api/drone-status');
  const statusResponse = await makeRequest(
    `${CONFIG.FRONTEND_URL}/api/drone-status`,
    { headers }
  );
  
  if (statusResponse.success) {
    log.success(`Drone status endpoint responded: ${statusResponse.status}`);
    log.debug(`Connected drones: ${statusResponse.data.totalConnected || 0}`);
  } else {
    const error = `Drone status endpoint failed: ${statusResponse.error}`;
    log.error(error);
    testResults.frontendAPI.errors.push(error);
  }
  
  testResults.frontendAPI.passed = testResults.frontendAPI.errors.length === 0;
  return testResults.frontendAPI.passed;
}

// Test 3: Drone Connection Service
async function testDroneConnectionService() {
  log.header('Testing Drone Connection Service');
  
  // Test health endpoint
  log.info('Testing drone-connection-service health...');
  const healthResponse = await makeRequest(`${CONFIG.DRONE_CONNECTION_SERVICE_URL}/health`);
  
  if (healthResponse.success) {
    log.success(`Drone connection service healthy: ${healthResponse.status}`);
    log.debug(`Service features: ${healthResponse.data.features?.join(', ') || 'none'}`);
  } else {
    const error = `Drone connection service health check failed: ${healthResponse.error}`;
    log.error(error);
    testResults.droneConnectionService.errors.push(error);
  }
  
  // Test Redis data endpoint
  log.info(`Testing Redis data endpoint for drone: ${CONFIG.TEST_DRONE_ID}`);
  const redisResponse = await makeRequest(
    `${CONFIG.DRONE_CONNECTION_SERVICE_URL}/redis/${CONFIG.TEST_DRONE_ID}`
  );
  
  if (redisResponse.success) {
    log.success(`Redis data endpoint responded: ${redisResponse.status}`);
    log.debug(`Redis data keys: ${Object.keys(redisResponse.data || {}).join(', ')}`);
  } else {
    const error = `Redis data endpoint failed: ${redisResponse.error}`;
    log.error(error);
    testResults.droneConnectionService.errors.push(error);
  }
  
  // Test camera endpoints
  log.info('Testing camera stream endpoints...');
  const cameraResponse = await makeRequest(`${CONFIG.DRONE_CONNECTION_SERVICE_URL}/camera/streams`);
  
  if (cameraResponse.success) {
    log.success(`Camera streams endpoint responded: ${cameraResponse.status}`);
    log.debug(`Available streams: ${cameraResponse.data.streams?.length || 0}`);
  } else {
    const error = `Camera streams endpoint failed: ${cameraResponse.error}`;
    log.error(error);
    testResults.droneConnectionService.errors.push(error);
  }
  
  testResults.droneConnectionService.passed = testResults.droneConnectionService.errors.length === 0;
  return testResults.droneConnectionService.passed;
}

// Test 4: Realtime Service WebSocket
async function testRealtimeService() {
  log.header('Testing Realtime Service WebSocket');
  
  return new Promise((resolve) => {
    if (!CONFIG.TEST_TOKEN) {
      const error = 'No authentication token for realtime service test';
      log.error(error);
      testResults.realtimeService.errors.push(error);
      resolve(false);
      return;
    }
    
    log.info(`Connecting to realtime service: ${CONFIG.REALTIME_SERVICE_URL}`);
    
    const socket = io(CONFIG.REALTIME_SERVICE_URL, {
      auth: { token: CONFIG.TEST_TOKEN },
      extraHeaders: { Authorization: `Bearer ${CONFIG.TEST_TOKEN}` },
      query: { token: CONFIG.TEST_TOKEN },
      transports: ['websocket', 'polling'],
      timeout: CONFIG.TIMEOUT
    });
    
    let testComplete = false;
    const timeout = setTimeout(() => {
      if (!testComplete) {
        testComplete = true;
        const error = 'Realtime service connection timeout';
        log.error(error);
        testResults.realtimeService.errors.push(error);
        socket.disconnect();
        resolve(false);
      }
    }, CONFIG.TIMEOUT);
    
    socket.on('connect', () => {
      log.success('Connected to realtime service WebSocket');
      
      // Test connection status
      socket.on('connection_status', (data) => {
        log.success(`Connection status received: ${data.status}`);
        log.debug(`User ID: ${data.userId}`);
      });
      
      // Test drone subscription
      log.info(`Testing drone subscription for: ${CONFIG.TEST_DRONE_ID}`);
      socket.emit('subscribe_drone', CONFIG.TEST_DRONE_ID);
      
      socket.on('subscription_status', (data) => {
        if (data.droneId === CONFIG.TEST_DRONE_ID) {
          log.success(`Drone subscription status: ${data.status}`);
          
          if (!testComplete) {
            testComplete = true;
            clearTimeout(timeout);
            testResults.realtimeService.passed = true;
            socket.disconnect();
            resolve(true);
          }
        }
      });
      
      socket.on('drone_state', (data) => {
        if (data.droneId === CONFIG.TEST_DRONE_ID) {
          log.success(`Received drone state update: ${data.type}`);
          log.debug(`Data keys: ${Object.keys(data.data || {}).join(', ')}`);
        }
      });
    });
    
    socket.on('connect_error', (error) => {
      if (!testComplete) {
        testComplete = true;
        clearTimeout(timeout);
        const errorMsg = `Realtime service connection error: ${error.message}`;
        log.error(errorMsg);
        testResults.realtimeService.errors.push(errorMsg);
        resolve(false);
      }
    });
    
    socket.on('error', (error) => {
      const errorMsg = `Realtime service error: ${error.message || error}`;
      log.error(errorMsg);
      testResults.realtimeService.errors.push(errorMsg);
    });
  });
}

// Test 5: Camera WebSocket Specific Testing
async function testCameraWebSocket() {
  log.header('Testing Camera WebSocket Functionality');
  
  return new Promise((resolve) => {
    if (!CONFIG.TEST_TOKEN) {
      const error = 'No authentication token for camera WebSocket test';
      log.error(error);
      testResults.cameraWebSocket.errors.push(error);
      resolve(false);
      return;
    }
    
    log.info('Connecting to realtime service for camera streaming...');
    
    const socket = io(CONFIG.REALTIME_SERVICE_URL, {
      auth: { token: CONFIG.TEST_TOKEN },
      extraHeaders: { Authorization: `Bearer ${CONFIG.TEST_TOKEN}` },
      query: { token: CONFIG.TEST_TOKEN },
      transports: ['websocket'],
      timeout: CONFIG.TIMEOUT
    });
    
    let cameraFrameReceived = false;
    let cameraControlReceived = false;
    let testComplete = false;
    
    const timeout = setTimeout(() => {
      if (!testComplete) {
        testComplete = true;
        log.warning('Camera WebSocket test timeout - completing with partial results');
        testResults.cameraWebSocket.passed = cameraFrameReceived || cameraControlReceived;
        socket.disconnect();
        resolve(testResults.cameraWebSocket.passed);
      }
    }, CONFIG.TIMEOUT);
    
    socket.on('connect', () => {
      log.success('Connected for camera WebSocket testing');
      
      // Subscribe to camera stream
      log.info(`Subscribing to camera stream: ${CONFIG.TEST_DRONE_ID}:${CONFIG.TEST_CAMERA}`);
      socket.emit('subscribe_camera_stream', {
        droneId: CONFIG.TEST_DRONE_ID,
        camera: CONFIG.TEST_CAMERA,
        channels: [
          `camera:${CONFIG.TEST_DRONE_ID}:${CONFIG.TEST_CAMERA}:stream`,
          `camera:${CONFIG.TEST_DRONE_ID}:${CONFIG.TEST_CAMERA}:control`
        ]
      });
      
      // Listen for camera subscription status
      socket.on('camera_subscription_status', (data) => {
        log.success(`Camera subscription status: ${data.status} for ${data.droneId}:${data.camera}`);
      });
      
      socket.on('camera_subscription_error', (data) => {
        const error = `Camera subscription error: ${data.error}`;
        log.error(error);
        testResults.cameraWebSocket.errors.push(error);
      });
      
      // Listen for camera frames
      socket.on('camera_frame', (data) => {
        cameraFrameReceived = true;
        log.success(`Received camera frame from ${data.droneId}:${data.camera}`);
        log.debug(`Frame timestamp: ${data.timestamp}`);
        log.debug(`Frame metadata: ${JSON.stringify(data.metadata || {})}`);
      });
      
      // Listen for camera control messages
      socket.on('camera_control', (data) => {
        cameraControlReceived = true;
        log.success(`Received camera control message: ${data.action}`);
        log.debug(`Control data: ${JSON.stringify(data)}`);
      });
      
      // Test camera config change
      setTimeout(() => {
        log.info('Testing camera config change...');
        socket.emit('camera_config_change', {
          droneId: CONFIG.TEST_DRONE_ID,
          camera: CONFIG.TEST_CAMERA,
          config: { quality: 'high', fps: 30 }
        });
      }, 2000);
      
      // Complete test after some time
      setTimeout(() => {
        if (!testComplete) {
          testComplete = true;
          clearTimeout(timeout);
          testResults.cameraWebSocket.passed = cameraFrameReceived || cameraControlReceived;
          
          if (testResults.cameraWebSocket.passed) {
            log.success('Camera WebSocket test completed successfully');
          } else {
            const error = 'No camera frames or control messages received';
            log.error(error);
            testResults.cameraWebSocket.errors.push(error);
          }
          
          socket.disconnect();
          resolve(testResults.cameraWebSocket.passed);
        }
      }, 5000);
    });
    
    socket.on('connect_error', (error) => {
      if (!testComplete) {
        testComplete = true;
        clearTimeout(timeout);
        const errorMsg = `Camera WebSocket connection error: ${error.message}`;
        log.error(errorMsg);
        testResults.cameraWebSocket.errors.push(errorMsg);
        resolve(false);
      }
    });
  });
}

// Test 6: Camera Stream Data Flow
async function testCameraStreamingDataFlow() {
  log.header('Testing Camera Streaming Data Flow');
  
  // Test camera API endpoints
  log.info('Testing camera API endpoints...');
  
  // Test camera streams endpoint
  const streamsResponse = await makeRequest(`${CONFIG.DRONE_CONNECTION_SERVICE_URL}/camera/streams`);
  if (streamsResponse.success) {
    log.success(`Camera streams API working: ${streamsResponse.status}`);
    log.debug(`Available streams: ${JSON.stringify(streamsResponse.data)}`);
  } else {
    const error = `Camera streams API failed: ${streamsResponse.error}`;
    log.error(error);
    testResults.dataFlow.errors.push(error);
  }
  
  // Test latest frame endpoint
  const frameResponse = await makeRequest(
    `${CONFIG.DRONE_CONNECTION_SERVICE_URL}/camera/${CONFIG.TEST_DRONE_ID}/${CONFIG.TEST_CAMERA}/latest`
  );
  if (frameResponse.success) {
    log.success(`Latest frame API working: ${frameResponse.status}`);
    log.debug(`Frame data keys: ${Object.keys(frameResponse.data || {}).join(', ')}`);
  } else {
    log.warning(`Latest frame API failed (expected if no drone connected): ${frameResponse.error}`);
  }
  
  // Test camera status endpoint
  const statusResponse = await makeRequest(
    `${CONFIG.DRONE_CONNECTION_SERVICE_URL}/camera/${CONFIG.TEST_DRONE_ID}/${CONFIG.TEST_CAMERA}/status`
  );
  if (statusResponse.success) {
    log.success(`Camera status API working: ${statusResponse.status}`);
    log.debug(`Status: ${JSON.stringify(statusResponse.data)}`);
  } else {
    log.warning(`Camera status API failed (expected if no drone connected): ${statusResponse.error}`);
  }
  
  testResults.dataFlow.passed = testResults.dataFlow.errors.length === 0;
  return testResults.dataFlow.passed;
}

// Test 7: Error Handling and Edge Cases
async function testErrorHandling() {
  log.header('Testing Error Handling and Edge Cases');
  
  // Test invalid drone ID
  log.info('Testing invalid drone ID handling...');
  const invalidDroneResponse = await makeRequest(
    `${CONFIG.FRONTEND_URL}/api/drone-telemetry/invalid-drone-123`,
    { headers: { 'Authorization': `Bearer ${CONFIG.TEST_TOKEN}` } }
  );
  
  if (invalidDroneResponse.status >= 400 || !invalidDroneResponse.success) {
    log.success('Invalid drone ID properly handled with error response');
  } else {
    const error = 'Invalid drone ID should return error but didn\'t';
    log.error(error);
    testResults.errorHandling.errors.push(error);
  }
  
  // Test authentication without token
  log.info('Testing authentication without token...');
  const noTokenResponse = await makeRequest(`${CONFIG.FRONTEND_URL}/api/drone-status`);
  
  if (noTokenResponse.status === 401 || !noTokenResponse.success) {
    log.success('Missing authentication token properly handled');
  } else {
    const error = 'Missing token should return 401 but didn\'t';
    log.error(error);
    testResults.errorHandling.errors.push(error);
  }
  
  // Test WebSocket with invalid token
  log.info('Testing WebSocket with invalid token...');
  return new Promise((resolve) => {
    const socket = io(CONFIG.REALTIME_SERVICE_URL, {
      auth: { token: 'invalid-token-123' },
      transports: ['websocket'],
      timeout: 5000
    });
    
    socket.on('connect', () => {
      const error = 'WebSocket should reject invalid token but connected';
      log.error(error);
      testResults.errorHandling.errors.push(error);
      socket.disconnect();
      resolve(false);
    });
    
    socket.on('connect_error', (error) => {
      log.success(`Invalid token properly rejected: ${error.message}`);
      testResults.errorHandling.passed = testResults.errorHandling.errors.length === 0;
      resolve(true);
    });
    
    setTimeout(() => {
      testResults.errorHandling.passed = testResults.errorHandling.errors.length === 0;
      socket.disconnect();
      resolve(true);
    }, 3000);
  });
}

// Test 8: Additional Stream Types (MAVROS, Telemetry)
async function testOtherStreamTypes() {
  log.header('Testing Other Stream Types (MAVROS, Precision Landing, Telemetry)');
  
  return new Promise((resolve) => {
    if (!CONFIG.TEST_TOKEN) {
      log.error('No authentication token for other stream types test');
      resolve(false);
      return;
    }
    
    const socket = io(CONFIG.REALTIME_SERVICE_URL, {
      auth: { token: CONFIG.TEST_TOKEN },
      transports: ['websocket'],
      timeout: CONFIG.TIMEOUT
    });
    
    let mavrosReceived = false;
    let precisionLandingReceived = false;
    let telemetryReceived = false;
    
    const timeout = setTimeout(() => {
      log.info(`Other streams test results: MAVROS=${mavrosReceived}, PrecisionLanding=${precisionLandingReceived}, Telemetry=${telemetryReceived}`);
      socket.disconnect();
      resolve(true);
    }, 8000);
    
    socket.on('connect', () => {
      log.info('Testing MAVROS output subscription...');
      socket.emit('subscribe', `mavros:${CONFIG.TEST_DRONE_ID}:output`);
      
      log.info('Testing precision landing output subscription...');
      socket.emit('subscribe', `precision_land_output:${CONFIG.TEST_DRONE_ID}`);
      
      log.info('Testing precision landing status subscription...');
      socket.emit('subscribe', `precision_land_status:${CONFIG.TEST_DRONE_ID}`);
      
      socket.on('mavros_output', (data) => {
        mavrosReceived = true;
        log.success(`Received MAVROS output: ${data.message?.substring(0, 50) || 'unknown'}...`);
      });
      
      socket.on('precision_land_output', (data) => {
        precisionLandingReceived = true;
        log.success(`Received precision landing output: ${data.output?.substring(0, 50) || 'unknown'}...`);
      });
      
      socket.on('precision_land_status', (data) => {
        precisionLandingReceived = true;
        log.success(`Received precision landing status: ${data.status}`);
      });
      
      socket.on('drone_state', (data) => {
        if (data.droneId === CONFIG.TEST_DRONE_ID) {
          telemetryReceived = true;
          log.success(`Received drone telemetry state update`);
        }
      });
    });
    
    socket.on('connect_error', (error) => {
      log.error(`Other streams connection error: ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// Main test runner
async function runAllTests() {
  console.log(`${colors.bold}${colors.magenta}
╔══════════════════════════════════════════════════════════════════╗
║                    FlyOS Camera WebSocket Test Suite              ║
║                        Comprehensive Diagnostics                  ║
╚══════════════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  console.log(`\n${colors.cyan}Test Configuration:${colors.reset}`);
  console.log(`Frontend URL: ${CONFIG.FRONTEND_URL}`);
  console.log(`Realtime Service: ${CONFIG.REALTIME_SERVICE_URL}`);
  console.log(`Drone Connection Service: ${CONFIG.DRONE_CONNECTION_SERVICE_URL}`);
  console.log(`Test Drone: ${CONFIG.TEST_DRONE_ID}`);
  console.log(`Test Camera: ${CONFIG.TEST_CAMERA}`);
  console.log(`Timeout: ${CONFIG.TIMEOUT}ms\n`);
  
  const startTime = Date.now();
  
  // Run all tests sequentially
  await testAuthentication();
  await testFrontendAPI();
  await testDroneConnectionService();
  await testRealtimeService();
  await testCameraWebSocket();
  await testCameraStreamingDataFlow();
  await testErrorHandling();
  await testOtherStreamTypes();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Print comprehensive results
  log.header('TEST RESULTS SUMMARY');
  
  const tests = [
    'authentication',
    'frontendAPI',
    'droneConnectionService', 
    'realtimeService',
    'cameraWebSocket',
    'cameraStreaming',
    'dataFlow',
    'errorHandling'
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  tests.forEach(testName => {
    const result = testResults[testName];
    const status = result.passed ? 
      `${colors.green}PASSED${colors.reset}` : 
      `${colors.red}FAILED${colors.reset}`;
    
    console.log(`${testName.padEnd(25)} ${status}`);
    
    if (!result.passed && result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(`  ${colors.red}↳ ${error}${colors.reset}`);
      });
    }
    
    if (result.passed) passedTests++;
  });
  
  console.log(`\n${colors.bold}Overall Result: ${passedTests}/${totalTests} tests passed${colors.reset}`);
  console.log(`${colors.bold}Total Duration: ${duration}s${colors.reset}`);
  
  // Specific camera-related issues analysis
  log.header('CAMERA-SPECIFIC ISSUE ANALYSIS');
  
  if (!testResults.cameraWebSocket.passed) {
    log.error('Camera WebSocket Issues Detected:');
    console.log('1. Check if useCameraStream hook is properly initialized');
    console.log('2. Verify camera channels are correctly subscribed');
    console.log('3. Check if drone-connection-service is receiving camera frames');
    console.log('4. Verify Redis pub/sub channels for camera streams');
    console.log('5. Check authentication token in camera stream subscriptions');
  }
  
  if (!testResults.realtimeService.passed) {
    log.error('Realtime Service Issues Detected:');
    console.log('1. Check if realtime-service is running on port 4002');
    console.log('2. Verify WebSocket authentication middleware');
    console.log('3. Check Redis connection in realtime-service');
    console.log('4. Verify CORS configuration');
  }
  
  if (!testResults.droneConnectionService.passed) {
    log.error('Drone Connection Service Issues Detected:');
    console.log('1. Check if drone-connection-service is running on port 4005');
    console.log('2. Verify camera handler setup');
    console.log('3. Check Redis connection and camera stream storage');
    console.log('4. Verify camera API endpoints');
  }
  
  // Recommendations
  log.header('RECOMMENDATIONS');
  
  console.log('1. Check service logs:');
  console.log('   docker-compose logs realtime-service');
  console.log('   docker-compose logs drone-connection-service');
  console.log('   docker-compose logs frontend');
  
  console.log('\n2. Verify Redis connectivity:');
  console.log('   docker exec flyos-redis-1 redis-cli ping');
  console.log('   docker exec flyos-redis-1 redis-cli keys "camera:*"');
  
  console.log('\n3. Test WebSocket connection manually:');
  console.log('   Use browser dev tools to check WebSocket connections');
  console.log('   Verify authentication tokens are being passed correctly');
  
  console.log('\n4. Check environment variables:');
  console.log('   NEXT_PUBLIC_WS_URL in frontend');
  console.log('   REDIS_URL in all services');
  console.log('   CORS_ORIGIN configuration');
  
  if (passedTests === totalTests) {
    log.success('All tests passed! Camera WebSocket system appears to be working correctly.');
  } else {
    log.error(`${totalTests - passedTests} test(s) failed. Camera WebSocket system needs attention.`);
  }
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  log.error(`Unhandled rejection: ${error.message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the tests
runAllTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});