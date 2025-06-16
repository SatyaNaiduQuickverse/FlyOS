#!/usr/bin/env node
/**
 * FlyOS Camera Stream Comprehensive Test Script
 * Tests all camera streaming components and identifies issues
 * Uses only Node.js built-in modules
 */

const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');

// Test Configuration
const TEST_CONFIG = {
  // Services to test
  services: {
    frontend: 'http://localhost:3001',
    realtimeService: 'http://localhost:4002', 
    droneConnectionService: 'http://localhost:4005',
    redis: 'redis://localhost:6379'
  },
  
  // WebSocket URLs
  websockets: {
    realtime: 'ws://localhost:4002',
    realtimeSecure: 'wss://localhost:4002'
  },
  
  // Test drone and camera
  testDrone: 'drone-001',
  testCamera: 'front',
  
  // Authentication token (you'll need to get this from localStorage or login)
  authToken: process.env.FLYOS_TOKEN || null
};

class CameraStreamTester {
  constructor() {
    this.results = {
      services: {},
      websockets: {},
      redis: {},
      camera: {},
      errors: [],
      warnings: []
    };
    this.testStartTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
    
    if (level === 'error') {
      this.results.errors.push({ message, data, timestamp });
    } else if (level === 'warn') {
      this.results.warnings.push({ message, data, timestamp });
    }
  }

  async makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: data, headers: res.headers });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  async testServiceHealth() {
    this.log('info', '=== TESTING SERVICE HEALTH ===');
    
    for (const [serviceName, serviceUrl] of Object.entries(TEST_CONFIG.services)) {
      if (serviceName === 'redis') continue; // Skip Redis for HTTP test
      
      try {
        this.log('info', `Testing ${serviceName} at ${serviceUrl}`);
        
        const response = await this.makeHttpRequest(`${serviceUrl}/health`);
        
        this.results.services[serviceName] = {
          url: serviceUrl,
          status: response.status,
          response: response.data,
          healthy: response.status === 200
        };
        
        if (response.status === 200) {
          this.log('info', `✅ ${serviceName} is healthy`);
        } else {
          this.log('error', `❌ ${serviceName} returned status ${response.status}`, response.data);
        }
      } catch (error) {
        this.log('error', `❌ ${serviceName} connection failed`, error.message);
        this.results.services[serviceName] = {
          url: serviceUrl,
          status: 'error',
          error: error.message,
          healthy: false
        };
      }
    }
  }

  async testDroneConnectionService() {
    this.log('info', '=== TESTING DRONE CONNECTION SERVICE ===');
    
    try {
      // Test drone status endpoint
      const statusResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.droneConnectionService}/status`);
      this.log('info', 'Drone status response:', statusResponse.data);
      
      // Test Redis endpoint for specific drone
      const redisResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.droneConnectionService}/redis/${TEST_CONFIG.testDrone}`);
      this.log('info', 'Redis drone data response:', redisResponse.data);
      
      // Test camera stream status
      const cameraStreamsResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.droneConnectionService}/camera/streams`);
      this.log('info', 'Camera streams response:', cameraStreamsResponse.data);
      
      // Test specific camera status
      const cameraStatusResponse = await this.makeHttpRequest(
        `${TEST_CONFIG.services.droneConnectionService}/camera/${TEST_CONFIG.testDrone}/${TEST_CONFIG.testCamera}/status`
      );
      this.log('info', 'Camera status response:', cameraStatusResponse.data);
      
      this.results.camera.droneService = {
        status: statusResponse.data,
        redisData: redisResponse.data,
        streams: cameraStreamsResponse.data,
        cameraStatus: cameraStatusResponse.data
      };
      
    } catch (error) {
      this.log('error', 'Drone connection service test failed', error.message);
    }
  }

  async testRealtimeService() {
    this.log('info', '=== TESTING REALTIME SERVICE ===');
    
    try {
      // Test health endpoint
      const healthResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.realtimeService}/health`);
      this.log('info', 'Realtime service health:', healthResponse.data);
      
      this.results.websockets.realtimeHealth = healthResponse.data;
      
    } catch (error) {
      this.log('error', 'Realtime service test failed', error.message);
    }
  }

  async testSocketIOConnection() {
    this.log('info', '=== TESTING SOCKET.IO CONNECTION ===');
    
    if (!TEST_CONFIG.authToken) {
      this.log('error', 'No auth token provided. Set FLYOS_TOKEN environment variable or update TEST_CONFIG.authToken');
      return;
    }
    
    return new Promise((resolve) => {
      this.log('info', 'Testing Socket.IO connection to realtime service');
      
      // Test Socket.IO handshake endpoint
      const socketIOUrl = `${TEST_CONFIG.services.realtimeService}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
      
      this.makeHttpRequest(socketIOUrl, {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.authToken}`
        }
      }).then(response => {
        this.log('info', 'Socket.IO handshake response:', {
          status: response.status,
          hasData: !!response.data,
          data: typeof response.data === 'string' ? response.data.substring(0, 100) + '...' : response.data
        });
        
        this.results.websockets.socketIOHandshake = {
          status: response.status,
          successful: response.status === 200,
          data: response.data
        };
        
        if (response.status === 200) {
          this.log('info', '✅ Socket.IO handshake successful');
        } else {
          this.log('error', '❌ Socket.IO handshake failed');
        }
        
        resolve();
      }).catch(error => {
        this.log('error', 'Socket.IO handshake failed', error.message);
        this.results.websockets.socketIOHandshake = {
          status: 'error',
          successful: false,
          error: error.message
        };
        resolve();
      });
    });
  }

  async testTCPConnection() {
    this.log('info', '=== TESTING TCP CONNECTION TO REALTIME SERVICE ===');
    
    return new Promise((resolve) => {
      const port = 4002;
      const host = 'localhost';
      
      const socket = new net.Socket();
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          this.log('error', `TCP connection timeout to ${host}:${port}`);
          socket.destroy();
          resolve();
        }
      }, 5000);
      
      socket.connect(port, host, () => {
        connected = true;
        clearTimeout(timeout);
        this.log('info', `✅ TCP connection successful to ${host}:${port}`);
        
        this.results.websockets.tcpConnection = {
          host,
          port,
          successful: true,
          connectedAt: new Date().toISOString()
        };
        
        socket.end();
        resolve();
      });
      
      socket.on('error', (error) => {
        clearTimeout(timeout);
        this.log('error', `❌ TCP connection failed to ${host}:${port}`, error.message);
        
        this.results.websockets.tcpConnection = {
          host,
          port,
          successful: false,
          error: error.message
        };
        
        resolve();
      });
      
      socket.on('close', () => {
        this.log('info', `TCP connection closed to ${host}:${port}`);
      });
    });
  }

  async testFrontendAPI() {
    this.log('info', '=== TESTING FRONTEND API ROUTES ===');
    
    try {
      // Test drone telemetry API
      const telemetryResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.frontend}/api/drone-telemetry/${TEST_CONFIG.testDrone}`);
      this.log('info', 'Frontend telemetry API response:', {
        status: telemetryResponse.status,
        hasData: !!telemetryResponse.data,
        dataKeys: Object.keys(telemetryResponse.data || {})
      });
      
      // Test drone status API
      const droneStatusResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.frontend}/api/drone-status`);
      this.log('info', 'Frontend drone status API response:', {
        status: droneStatusResponse.status,
        totalConnected: droneStatusResponse.data?.totalConnected || 0
      });
      
      this.results.camera.frontendAPI = {
        telemetry: telemetryResponse,
        droneStatus: droneStatusResponse
      };
      
    } catch (error) {
      this.log('error', 'Frontend API test failed', error.message);
    }
  }

  async testCameraStreamFlow() {
    this.log('info', '=== TESTING CAMERA STREAM DATA FLOW ===');
    
    try {
      // Check if camera streams are active in drone-connection-service
      const streamsResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.droneConnectionService}/camera/streams`);
      
      if (streamsResponse.data?.streams) {
        this.log('info', `Found ${streamsResponse.data.streams.length} camera streams`, 
          streamsResponse.data.streams.map(s => `${s.droneId}:${s.camera} (${s.status})`));
      } else {
        this.log('warn', 'No camera streams found in drone-connection-service');
      }
      
      // Check latest frame availability
      const frameResponse = await this.makeHttpRequest(
        `${TEST_CONFIG.services.droneConnectionService}/camera/${TEST_CONFIG.testDrone}/${TEST_CONFIG.testCamera}/latest`
      );
      
      if (frameResponse.status === 200 && frameResponse.data?.frame) {
        this.log('info', '✅ Latest camera frame available', {
          hasFrame: !!frameResponse.data.frame,
          frameSize: frameResponse.data.frame?.length || 0,
          timestamp: frameResponse.data.timestamp,
          metadata: frameResponse.data.metadata
        });
      } else {
        this.log('warn', 'No latest camera frame available', frameResponse.data);
      }
      
      this.results.camera.streamFlow = {
        streams: streamsResponse.data,
        latestFrame: frameResponse.data
      };
      
    } catch (error) {
      this.log('error', 'Camera stream flow test failed', error.message);
    }
  }

  async testRedisConnectivity() {
    this.log('info', '=== TESTING REDIS CONNECTIVITY ===');
    
    // We can't directly test Redis without redis client, but we can test through the services
    try {
      // Test Redis through drone-connection-service
      const redisTestResponse = await this.makeHttpRequest(`${TEST_CONFIG.services.droneConnectionService}/redis/${TEST_CONFIG.testDrone}`);
      
      this.results.redis.connectivity = {
        throughDroneService: redisTestResponse.status === 200,
        data: redisTestResponse.data,
        error: redisTestResponse.status !== 200 ? redisTestResponse.data : null
      };
      
      if (redisTestResponse.status === 200) {
        this.log('info', '✅ Redis connectivity through drone service successful');
      } else {
        this.log('error', '❌ Redis connectivity issues detected', redisTestResponse.data);
      }
      
    } catch (error) {
      this.log('error', 'Redis connectivity test failed', error.message);
    }
  }

  generateReport() {
    this.log('info', '=== GENERATING COMPREHENSIVE TEST REPORT ===');
    
    const testDuration = Date.now() - this.testStartTime;
    const report = {
      summary: {
        testDuration: `${testDuration}ms`,
        totalErrors: this.results.errors.length,
        totalWarnings: this.results.warnings.length,
        servicesHealthy: Object.values(this.results.services).filter(s => s.healthy).length,
        totalServices: Object.keys(this.results.services).length
      },
      services: this.results.services,
      websockets: this.results.websockets,
      redis: this.results.redis,
      camera: this.results.camera,
      issues: {
        errors: this.results.errors,
        warnings: this.results.warnings
      }
    };
    
    // Identify critical issues
    const criticalIssues = [];
    
    if (!this.results.websockets.tcpConnection?.successful) {
      criticalIssues.push('TCP connection to realtime service failed');
    }
    
    if (!this.results.websockets.socketIOHandshake?.successful) {
      criticalIssues.push('Socket.IO handshake failed');
    }
    
    if (!this.results.camera.streamFlow?.latestFrame?.frame) {
      criticalIssues.push('No camera frames available');
    }
    
    if (this.results.errors.length > 0) {
      criticalIssues.push(`${this.results.errors.length} service errors detected`);
    }
    
    report.summary.criticalIssues = criticalIssues;
    
    console.log('\n' + '='.repeat(80));
    console.log('CAMERA STREAM TEST REPORT');
    console.log('='.repeat(80));
    console.log(JSON.stringify(report, null, 2));
    
    // Print actionable recommendations
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    if (criticalIssues.length === 0) {
      console.log('✅ All camera streaming components appear to be working correctly!');
    } else {
      console.log('❌ Issues found that need attention:');
      criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    if (!TEST_CONFIG.authToken) {
      console.log('\n⚠️  No auth token provided. Set FLYOS_TOKEN environment variable for full testing.');
    }
    
    return report;
  }

  async runAllTests() {
    this.log('info', 'Starting comprehensive FlyOS camera stream tests...');
    
    await this.testServiceHealth();
    await this.testRedisConnectivity();
    await this.testDroneConnectionService();
    await this.testRealtimeService();
    await this.testTCPConnection();
    await this.testSocketIOConnection();
    await this.testFrontendAPI();
    await this.testCameraStreamFlow();
    
    return this.generateReport();
  }
}

// Run the tests
async function main() {
  console.log('FlyOS Camera Stream Comprehensive Test');
  console.log('=====================================');
  console.log('This script will test all camera streaming components');
  console.log('');
  
  if (!TEST_CONFIG.authToken) {
    console.log('⚠️  WARNING: No auth token provided.');
    console.log('   To get full test results, set the FLYOS_TOKEN environment variable:');
    console.log('   export FLYOS_TOKEN="your_token_here"');
    console.log('   or edit TEST_CONFIG.authToken in this script');
    console.log('');
  }
  
  const tester = new CameraStreamTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CameraStreamTester, TEST_CONFIG };