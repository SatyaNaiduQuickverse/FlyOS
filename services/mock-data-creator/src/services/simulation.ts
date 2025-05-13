import { MockDrone } from '../models/mock-drone';
import { createApiClient } from './api-client';
import { createRealtimeClient } from './realtime-client';
import { startTestRun, recordEvent, endTestRun, getMetricsSummary, recordMetric } from '../database/init';
import { 
  initTerminalUI, 
  updateHeader, 
  updateDroneStatus, 
  updateLatencyStats, 
  updateThroughput, 
  addEvent, 
  cleanupTerminalUI 
} from '../utils/terminal-ui';
import { logger } from '../utils/logger';

// Simulation configuration interface
interface SimulationConfig {
  droneCount: number;
  testDurationMinutes: number;
  telemetryIntervalMs: number;
  apiUrl: string;
  realtimeUrl: string;
  jwtToken: string;
  maxDroneCount: number;
  scaleIntervalMinutes: number;
}

// Start the simulation
export const startSimulation = async (config: SimulationConfig, dbInitialized: boolean = false) => {
  // Validate configuration
  if (!config.jwtToken) {
    logger.error('JWT token is required. Provide it via --jwt flag or JWT_TOKEN environment variable.');
    return;
  }
  
  // Initialize the terminal UI
  initTerminalUI();
  
  // Add initial status
  addEvent(`Starting simulation with ${config.droneCount} drones`);
  addEvent(`Telemetry interval: ${config.telemetryIntervalMs}ms`);
  updateDroneStatus(0, config.droneCount);
  
  // Start a new test run in the database
  let testRunId = 0;
  if (dbInitialized) {
    try {
      testRunId = await startTestRun(
        config.droneCount, 
        config.telemetryIntervalMs,
        `Manual test with ${config.droneCount} drones`
      );
      addEvent(`Started test run #${testRunId} in database`);
    } catch (error) {
      logger.warn('Failed to start test run in database:', error);
      addEvent('Failed to start test run in database, metrics will not be stored');
    }
  } else {
    addEvent('Database not initialized, metrics will not be stored');
  }
  
  // Safe wrapper for recordMetric
  const safeRecordMetric = async (
    metricType: string,
    operation: string,
    latencyMs: number,
    success: boolean,
    droneId?: string,
    details?: any
  ) => {
    if (dbInitialized && testRunId > 0) {
      try {
        await recordMetric(
          testRunId,
          metricType,
          operation,
          latencyMs,
          success,
          droneId,
          details
        );
      } catch (error) {
        // Silently fail to avoid disrupting the simulation
      }
    }
  };
  
  // Safe wrapper for recordEvent
  const safeRecordEvent = async (
    eventType: string,
    droneId?: string,
    details?: any
  ) => {
    if (dbInitialized && testRunId > 0) {
      try {
        await recordEvent(testRunId, eventType, droneId, details);
      } catch (error) {
        // Silently fail to avoid disrupting the simulation
      }
    }
  };
  
  // Initialize API client with safe record metric function
  const apiClient = createApiClient(config.apiUrl, config.jwtToken, testRunId, safeRecordMetric);
  
  // Initialize realtime client with safe record metric function
  const realtimeClient = createRealtimeClient(config.realtimeUrl, config.jwtToken, testRunId, safeRecordMetric);
  realtimeClient.connect();
  
  // Create drones
  const drones: MockDrone[] = [];
  
  // Get starting lat/lon - use different ranges for different drones
  const createDrone = (id: string) => {
    // Start in a semi-random location
    const baseLat = 40.7128; // New York
    const baseLon = -74.0060;
    return new MockDrone(id, baseLat, baseLon);
  };
  
  // Create initial drones
  for (let i = 0; i < config.droneCount; i++) {
    const droneId = `drone-${i.toString().padStart(3, '0')}`;
    const drone = createDrone(droneId);
    drones.push(drone);
    
    // Record event
    await safeRecordEvent('add_drone', droneId);
    addEvent(`Added drone ${droneId}`);
  }
  
  updateDroneStatus(drones.length, config.droneCount);
  
  // Track telemetry operations per second
  let operationsCount = 0;
  let lastOpsCountTime = Date.now();
  let opsPerSecond = 0;
  
  // Calculate operations per second every second
  const opsCounterInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastOpsCountTime;
    opsPerSecond = operationsCount / (elapsed / 1000);
    operationsCount = 0;
    lastOpsCountTime = now;
    
    // Update throughput display
    updateThroughput(opsPerSecond);
  }, 1000);
  
  // Variables for metrics display
  let latencyData = [
    { operation: 'Write', avgLatency: 0, p95Latency: 0, errorRate: 0 },
    { operation: 'Read', avgLatency: 0, p95Latency: 0, errorRate: 0 },
    { operation: 'Real-time', avgLatency: 0, p95Latency: 0, errorRate: 0 }
  ];
  
  // Update metrics display every 5 seconds
  const metricsUpdateInterval = setInterval(async () => {
    try {
      // Get metrics summary from database if available
      if (dbInitialized && testRunId > 0) {
        const metrics = await getMetricsSummary(testRunId);
        
        // Map to our display format
        latencyData = [
          {
            operation: 'Write',
            avgLatency: findMetric(metrics, 'http', 'POST /api/drones') || 0,
            p95Latency: findMetric(metrics, 'http', 'POST /api/drones', 'p95_latency') || 0,
            errorRate: 100 - (findMetric(metrics, 'http', 'POST /api/drones', 'success_rate') || 100)
          },
          {
            operation: 'Read',
            avgLatency: findMetric(metrics, 'http', 'GET /api/drones') || 0,
            p95Latency: findMetric(metrics, 'http', 'GET /api/drones', 'p95_latency') || 0,
            errorRate: 100 - (findMetric(metrics, 'http', 'GET /api/drones', 'success_rate') || 100)
          },
          {
            operation: 'Real-time',
            avgLatency: findMetric(metrics, 'realtime', 'drone_state_update') || 0,
            p95Latency: findMetric(metrics, 'realtime', 'drone_state_update', 'p95_latency') || 0,
            errorRate: 0 // Not tracking errors for realtime currently
          }
        ];
      }
      
      // Update latency stats display
      updateLatencyStats(latencyData);
    } catch (error) {
      logger.error('Failed to update metrics display:', error);
    }
  }, 5000);
  
  // Helper to find metric in metrics summary
  function findMetric(metrics: any[], type: string, operation: string, field: string = 'avg_latency') {
    const metric = metrics?.find?.(m => 
      m.metric_type === type && 
      m.operation?.includes(operation)
    );
    return metric ? metric[field] : 0;
  }
  
  // Track runtime
  let startTime = Date.now();
  
  // Update runtime display every second
  const runtimeInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    const runtime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    updateHeader(runtime);
  }, 1000);
  
  // Scale drone count at intervals if configured
  let scaleDirection = 'up';
  let nextScaleTime = config.scaleIntervalMinutes > 0 ? 
    Date.now() + config.scaleIntervalMinutes * 60 * 1000 : 
    Infinity;
  
  // Setup telemetry update interval
  let telemetryInterval = setInterval(async () => {
    try {
      // Check if we need to scale drone count
      if (config.scaleIntervalMinutes > 0 && Date.now() >= nextScaleTime) {
        if (scaleDirection === 'up' && drones.length < config.maxDroneCount) {
          // Add a drone
          const droneId = `drone-${drones.length.toString().padStart(3, '0')}`;
          const drone = createDrone(droneId);
          drones.push(drone);
          
          // Record event
          await safeRecordEvent('add_drone', droneId);
          addEvent(`Added drone ${droneId} (scaling up)`);
          
          // Check if we've reached max
          if (drones.length >= config.maxDroneCount) {
            scaleDirection = 'down';
            addEvent(`Reached maximum drone count (${config.maxDroneCount}), will scale down next`);
          }
        } else if (scaleDirection === 'down' && drones.length > 1) {
          // Remove a drone
          const drone = drones.pop();
          if (drone) {
            // Record event
            await safeRecordEvent('remove_drone', drone.id);
            addEvent(`Removed drone ${drone.id} (scaling down)`);
          }
          
          // Check if we've reached min
          if (drones.length <= Math.max(1, Math.floor(config.droneCount / 2))) {
            scaleDirection = 'up';
            addEvent(`Reached minimum drone count (${drones.length}), will scale up next`);
          }
        }
        
        // Update drone status display
        updateDroneStatus(drones.length, config.droneCount);
        
        // Set next scale time
        nextScaleTime = Date.now() + config.scaleIntervalMinutes * 60 * 1000;
      }
      
      // Update and send telemetry for each drone
      for (const drone of drones) {
        try {
          // Update drone state
          const telemetry = drone.update();
          
          // Send telemetry to API
          await apiClient.storeTelemetry(drone.id, telemetry);
          
          // Subscribe to drone in realtime service if needed
          realtimeClient.subscribeToDrone(drone.id);
          
          // Count operation
          operationsCount++;
        } catch (error) {
          logger.error(`Error processing drone ${drone.id}:`, error);
        }
      }
      
      // Check if test duration has elapsed
      if (config.testDurationMinutes > 0) {
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        if (elapsedMinutes >= config.testDurationMinutes) {
          // End the test
          addEvent(`Test duration (${config.testDurationMinutes} minutes) elapsed, stopping simulation`);
          await endSimulation();
        }
      }
    } catch (error) {
      logger.error('Error in telemetry interval:', error);
    }
  }, config.telemetryIntervalMs);
  
  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down simulation...');
    await endSimulation();
  };
  
  // Set up process handlers for graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Function to end the simulation
  const endSimulation = async () => {
    // Clear intervals
    clearInterval(telemetryInterval);
    clearInterval(opsCounterInterval);
    clearInterval(metricsUpdateInterval);
    clearInterval(runtimeInterval);
    
    // Disconnect realtime client
    realtimeClient.disconnect();
    
    // Record end of test run
    if (dbInitialized && testRunId > 0) {
      try {
        await endTestRun(testRunId);
        addEvent(`Completed test run #${testRunId}`);
        
        // Get final metrics summary
        const finalMetrics = await getMetricsSummary(testRunId);
        
        // Log final summary
        addEvent('Test complete! Final metrics:');
        finalMetrics.forEach((metric: any) => {
          addEvent(`${metric.metric_type} ${metric.operation}: avg=${metric.avg_latency.toFixed(2)}ms, p95=${metric.p95_latency.toFixed(2)}ms, success=${metric.success_rate.toFixed(2)}%`);
        });
      } catch (error) {
        logger.error('Error ending test run:', error);
        addEvent('Failed to record test completion in database');
      }
    } else {
      addEvent('Test complete!');
    }
    
    // Give user time to read final metrics
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Clean up terminal UI
    cleanupTerminalUI();
    
    // Exit process
    process.exit(0);
  };
};