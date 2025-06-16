/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      // Auth API routes
      {
        source: '/api/auth/:path*',
        destination: 'http://auth-service:4000/auth/:path*',
      },
      // Drone API routes
      {
        source: '/api/drones/:path*',
        destination: 'http://drone-db-service:4001/api/drones/:path*',
      },
      // FIXED: WebSocket proxy for production
      {
        source: '/socket.io/:path*',
        destination: 'http://realtime-service:4002/socket.io/:path*',
      },
      // ADDED: Catch-all for Socket.IO transport methods
      {
        source: '/socket.io',
        destination: 'http://realtime-service:4002/socket.io/',
      }
    ];
  },
  // ADDED: Custom server configuration for WebSocket support
  async headers() {
    return [
      {
        source: '/socket.io/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Connection',
            value: 'Upgrade',
          },
          {
            key: 'Upgrade',
            value: 'websocket',
          }
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      fs: false, 
      net: false, 
      tls: false 
    };
    return config;
  },
};

module.exports = nextConfig;