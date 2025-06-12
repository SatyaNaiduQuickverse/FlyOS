// lib/socketClient.ts
import io, { Socket } from 'socket.io-client';

/**
 * Socket.io client singleton for managing WebSocket connections
 * This helps prevent multiple WebSocket connections when using the client in different components
 */
class SocketClient {
  private static instance: SocketClient;
  private socket: Socket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private token: string | null = null;
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }
  
  /**
   * Initialize the socket connection
   * @param token Auth token for WebSocket authentication
   */
  public init(token: string): void {
    this.token = token;
    
    if (this.socket?.connected) {
      return; // Already connected
    }
    
    // FIXED: Use secure routing through port 3001
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    
    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket']
    });
    
    this.socket.on('connect', () => {
      console.log('Socket connected');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Set up handlers for various message types
    this.setupHandlers();
  }
  
  /**
   * Set up handlers for various message types
   */
  private setupHandlers(): void {
    if (!this.socket) return;
    
    // Handle drone state updates
    this.socket.on('drone_state', (data) => {
      const subscribers = this.subscribers.get(`drone:${data.droneId}:state`) || new Set();
      subscribers.forEach(callback => callback(data));
    });
    
    // Handle subscription status updates
    this.socket.on('subscription_status', (data) => {
      const subscribers = this.subscribers.get(`drone:${data.droneId}:subscription`) || new Set();
      subscribers.forEach(callback => callback(data));
    });
    
    // Handle pong responses
    this.socket.on('pong', (data) => {
      const subscribers = this.subscribers.get('pong') || new Set();
      subscribers.forEach(callback => callback(data));
    });
  }
  
  /**
   * Subscribe to drone updates
   * @param droneId The ID of the drone to subscribe to
   */
  public subscribeToDrone(droneId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot subscribe to drone');
      return;
    }
    
    this.socket.emit('subscribe_drone', droneId);
  }
  
  /**
   * Unsubscribe from drone updates
   * @param droneId The ID of the drone to unsubscribe from
   */
  public unsubscribeFromDrone(droneId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot unsubscribe from drone');
      return;
    }
    
    this.socket.emit('unsubscribe_drone', droneId);
  }
  
  /**
   * Send a ping to measure latency
   */
  public ping(): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot ping');
      return;
    }
    
    this.socket.emit('ping', { timestamp: Date.now() });
  }
  
  /**
   * Register a callback for drone state updates
   * @param droneId The ID of the drone to listen for
   * @param callback The callback to call when updates are received
   * @returns A function to unregister the callback
   */
  public onDroneUpdate(droneId: string, callback: (data: any) => void): () => void {
    const key = `drone:${droneId}:state`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)?.add(callback);
    
    return () => {
      this.subscribers.get(key)?.delete(callback);
      
      // If no more subscribers, unsubscribe from drone updates
      if (this.subscribers.get(key)?.size === 0) {
        this.unsubscribeFromDrone(droneId);
      }
    };
  }
  
  /**
   * Register a callback for subscription status updates
   * @param droneId The ID of the drone to listen for
   * @param callback The callback to call when subscription status changes
   * @returns A function to unregister the callback
   */
  public onSubscriptionStatus(droneId: string, callback: (data: any) => void): () => void {
    const key = `drone:${droneId}:subscription`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)?.add(callback);
    
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }
  
  /**
   * Register a callback for pong responses
   * @param callback The callback to call when a pong is received
   * @returns A function to unregister the callback
   */
  public onPong(callback: (data: any) => void): () => void {
    const key = 'pong';
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)?.add(callback);
    
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }
  
  /**
   * Check if the socket is connected
   */
  public isConnected(): boolean {
    return !!this.socket?.connected;
  }
  
  /**
   * Disconnect the socket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default SocketClient;