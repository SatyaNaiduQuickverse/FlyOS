# FlyOS Mock Data Creator

A mock data generation service for testing the FlyOS drone control system.

## Overview

This service simulates multiple drones sending telemetry data to the FlyOS backend services. It measures system performance, latency, and throughput while dynamically adding and removing drones from the system.

## Features

- Simulates multiple drones with realistic behavior
- Sends telemetry data to the drone-db-service
- Connects to the realtime-service to monitor updates
- Measures API latency and throughput
- Provides real-time performance metrics in the terminal
- Records all metrics to a database for later analysis
- Supports dynamic scaling of drone count for stress testing

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd flyos-mock-data-creator

# Install dependencies
npm install

# Build the application
npm run build
```

## Configuration

The service can be configured through command-line arguments or environment variables.

### Command-line Arguments

- `--drones <number>`: Number of drones to simulate (default: 10)
- `--duration <minutes>`: Test duration in minutes, 0 for continuous (default: 0)
- `--interval <ms>`: Telemetry update interval in milliseconds (default: 1000)
- `--api-url <url>`: Drone DB service URL (default: http://localhost:4001)
- `--realtime-url <url>`: Realtime service URL (default: http://localhost:4002)
- `--jwt <token>`: JWT token for authentication (required)
- `--max-drones <number>`: Maximum number of drones during scaling (default: 20)
- `--scale-interval <minutes>`: Interval for scaling drone count (default: 2)

### Environment Variables

- `JWT_TOKEN`: JWT token for authentication
- `DATABASE_URL`: PostgreSQL connection string for storing metrics
- `LOG_LEVEL`: Logging level (default: info)

## Usage

```bash
# Run with default settings
npm start -- --jwt <your-jwt-token>

# Run with specific configuration
npm start -- --drones 5 --duration 10 --interval 500 --jwt <your-jwt-token>

# Run with scaling enabled
npm start -- --drones 3 --max-drones 15 --scale-interval 2 --jwt <your-jwt-token>
```

## Obtaining a JWT Token

For testing, you'll need a valid JWT token from the FlyOS authentication service. You can obtain one by:

1. Using the login API: `POST /api/auth/login` with valid credentials
2. Extract the token from the response
3. Provide it to this service via the `--jwt` flag or `JWT_TOKEN` environment variable

## Database Schema

The service creates the following tables in PostgreSQL:

- `performance_test_runs`: Stores metadata about each test run
- `performance_metrics`: Stores detailed metrics collected during tests
- `drone_simulation_events`: Logs events like drone additions/removals

To view test results:

```sql
-- View test runs
SELECT * FROM performance_test_runs ORDER BY start_time DESC;

-- View metrics for a specific test run
SELECT * FROM performance_metrics WHERE test_run_id = <test_run_id>;

-- View events for a specific test run
SELECT * FROM drone_simulation_events WHERE test_run_id = <test_run_id>;

-- View performance summary for a test run
SELECT 
  metric_type, 
  operation,
  AVG(latency_ms) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
  COUNT(*) as count
FROM performance_metrics
WHERE test_run_id = <test_run_id>
GROUP BY metric_type, operation;
```

## Terminal UI

The service displays real-time metrics in the terminal:

- Active drone count
- Latency statistics (average, 95th percentile)
- System throughput (operations per second)
- Recent events (drone additions/removals, errors)

## License

ISC