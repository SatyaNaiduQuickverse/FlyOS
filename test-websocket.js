// WebSocket Connection Test Script
const io = require('socket.io-client');

console.log('🧪 Testing WebSocket Connection...');

// Test configuration
const WS_URL = 'ws://3.111.215.70:4002';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

console.log(`Connecting to: ${WS_URL}`);

const socket = io(WS_URL, {
  auth: { token: TEST_TOKEN },
  transports: ['websocket'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('Socket ID:', socket.id);
  
  // Test ping
  socket.emit('ping', { timestamp: Date.now() });
});

socket.on('connect_error', (error) => {
  console.error('❌ WebSocket connection failed:', error.message);
});

socket.on('pong', (data) => {
  console.log('🏓 Pong received:', data);
});

socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 WebSocket disconnected:', reason);
});

// Close after 10 seconds
setTimeout(() => {
  console.log('🔚 Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 10000);
