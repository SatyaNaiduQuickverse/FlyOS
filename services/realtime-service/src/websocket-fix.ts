// WebSocket Configuration Fix
import { Server } from 'socket.io';

export const fixWebSocketConfig = (io: Server) => {
  // Add WebSocket upgrade handling
  io.engine.on('upgrade', (request, socket, head) => {
    console.log('WebSocket upgrade requested');
  });
  
  // Handle upgrade errors
  io.engine.on('upgrade_error', (error) => {
    console.error('WebSocket upgrade error:', error);
  });
  
  return io;
};
