// Models a virtual drone with realistic behavior
export class MockDrone {
  id: string;
  model: string;
  status: 'ACTIVE' | 'STANDBY' | 'MAINTENANCE' | 'OFFLINE';
  
  // Position data
  latitude: number;
  longitude: number;
  altitudeMSL: number;
  altitudeRelative: number;
  
  // State data
  armed: boolean;
  flightMode: string;
  connected: boolean;
  
  // GPS data
  gpsFix: string;
  satellites: number;
  hdop: number;
  positionError: number;
  
  // Battery data
  voltage: number;
  current: number;
  percentage: number;
  
  // Orientation data (in radians)
  orientation: {
    x: number; // roll
    y: number; // pitch
    z: number; // yaw
  };
  
  // Velocity data
  linear: {
    x: number;
    y: number;
    z: number;
  };
  
  // Additional data
  latency: number;
  teensyConnected: boolean;
  latchStatus: string;
  
  // Timestamp
  timestamp: Date;
  
  constructor(id: string, initialLatitude = 0, initialLongitude = 0) {
    this.id = id;
    this.model = `FlyOS-MQ${Math.floor(Math.random() * 5) + 5}`;
    this.status = 'ACTIVE';
    
    // Position data - random starting position near provided coordinates
    this.latitude = initialLatitude + (Math.random() - 0.5) * 0.01;
    this.longitude = initialLongitude + (Math.random() - 0.5) * 0.01;
    this.altitudeMSL = 100 + Math.random() * 100;
    this.altitudeRelative = 50 + Math.random() * 50;
    
    // State data
    this.armed = true;
    this.flightMode = 'AUTO';
    this.connected = true;
    
    // GPS data
    this.gpsFix = '3D';
    this.satellites = 8 + Math.floor(Math.random() * 8);
    this.hdop = 0.8 + Math.random() * 0.4;
    this.positionError = 0.5 + Math.random() * 1.5;
    
    // Battery data
    this.voltage = 12 + Math.random() * 2;
    this.current = 10 + Math.random() * 5;
    this.percentage = 80 + Math.random() * 20;
    
    // Orientation data (in radians)
    this.orientation = {
      x: (Math.random() - 0.5) * 0.1, // roll
      y: (Math.random() - 0.5) * 0.1, // pitch
      z: Math.random() * 2 * Math.PI, // yaw (0-2π)
    };
    
    // Velocity data
    this.linear = {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 0.5,
    };
    
    // Additional data
    this.latency = 15 + Math.random() * 10;
    this.teensyConnected = true;
    this.latchStatus = 'CLOSED';
    
    // Timestamp
    this.timestamp = new Date();
  }
  
  // Update drone state with realistic movement and status changes
  update() {
    // Update timestamp
    this.timestamp = new Date();
    
    // Simulate realistic movement
    this.latitude += (Math.random() - 0.5) * 0.0001;
    this.longitude += (Math.random() - 0.5) * 0.0001;
    this.altitudeMSL += (Math.random() - 0.5) * 0.5;
    this.altitudeRelative += (Math.random() - 0.5) * 0.5;
    
    // Update orientation with small changes
    this.orientation.x += (Math.random() - 0.5) * 0.02; // roll drift
    this.orientation.y += (Math.random() - 0.5) * 0.02; // pitch drift
    this.orientation.z += (Math.random() - 0.5) * 0.02; // yaw drift
    
    // Limit orientation to realistic values
    this.orientation.x = Math.max(-0.5, Math.min(0.5, this.orientation.x));
    this.orientation.y = Math.max(-0.5, Math.min(0.5, this.orientation.y));
    this.orientation.z = this.orientation.z % (2 * Math.PI); // keep yaw in 0-2π range
    
    // Update velocity with small changes
    this.linear.x += (Math.random() - 0.5) * 0.2;
    this.linear.y += (Math.random() - 0.5) * 0.2;
    this.linear.z += (Math.random() - 0.5) * 0.1;
    
    // Limit velocity to realistic values
    this.linear.x = Math.max(-5, Math.min(5, this.linear.x));
    this.linear.y = Math.max(-5, Math.min(5, this.linear.y));
    this.linear.z = Math.max(-2, Math.min(2, this.linear.z));
    
    // Slowly drain battery
    this.percentage -= 0.01;
    this.voltage -= 0.001;
    this.current = 10 + (Math.random() - 0.5) * 2; // current fluctuates
    
    // Ensure battery doesn't go below realistic values
    this.percentage = Math.max(0, this.percentage);
    this.voltage = Math.max(9, this.voltage);
    
    // Fluctuate latency
    this.latency = 15 + Math.random() * 10;
    
    // Occasionally change satellites
    if (Math.random() < 0.05) {
      this.satellites = Math.max(4, Math.min(16, this.satellites + (Math.random() > 0.5 ? 1 : -1)));
    }
    
    // Occasionally change HDOP
    this.hdop = Math.max(0.5, Math.min(3, this.hdop + (Math.random() - 0.5) * 0.1));
    
    // Return the current state
    return this.getState();
  }
  
  // Get current drone state
  getState() {
    return {
      id: this.id,
      model: this.model,
      status: this.status,
      
      // Position data
      latitude: this.latitude,
      longitude: this.longitude,
      altitudeMSL: this.altitudeMSL,
      altitudeRelative: this.altitudeRelative,
      
      // State data
      armed: this.armed,
      flight_mode: this.flightMode,
      connected: this.connected,
      
      // GPS data
      gps_fix: this.gpsFix,
      satellites: this.satellites,
      hdop: this.hdop,
      position_error: this.positionError,
      
      // Battery data
      voltage: this.voltage,
      current: this.current,
      percentage: this.percentage,
      
      // Orientation data
      orientation: this.orientation,
      
      // Velocity data
      linear: this.linear,
      
      // Additional data
      latency: this.latency,
      teensy_connected: this.teensyConnected,  // Changed from connected to teensy_connected
      latch_status: this.latchStatus,
      
      // Timestamp
      timestamp: this.timestamp.toISOString()
    };
  }
  
  // Process a command
  processCommand(commandType: string, parameters: any) {
    switch (commandType) {
      case 'ARM':
        this.armed = true;
        return { success: true, message: 'Drone armed' };
        
      case 'DISARM':
        this.armed = false;
        return { success: true, message: 'Drone disarmed' };
        
      case 'SET_MODE':
        this.flightMode = parameters.mode || 'MANUAL';
        return { success: true, message: `Mode set to ${this.flightMode}` };
        
      case 'GOTO':
        if (parameters.latitude && parameters.longitude) {
          // Start moving toward the target
          this.latitude = parameters.latitude;
          this.longitude = parameters.longitude;
          if (parameters.altitude) {
            this.altitudeRelative = parameters.altitude;
          }
          return { success: true, message: 'Moving to location' };
        }
        return { success: false, message: 'Invalid coordinates' };
        
      case 'RTL': // Return to Launch
        return { success: true, message: 'Returning to launch point' };
        
      case 'LAND':
        return { success: true, message: 'Landing' };
        
      default:
        return { success: false, message: `Unknown command: ${commandType}` };
    }
  }
}