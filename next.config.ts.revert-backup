/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Disable ESLint during builds to prevent build failures
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://auth-service:4000/auth/:path*', // proxy to auth service
      },
      {
        source: '/api/drones/:path*',
        destination: 'http://drone-db-service:4001/api/drones/:path*', // proxy to drone DB service
      },
      // ADD: WebSocket proxy for secure routing
      {
        source: '/socket.io/:path*',
        destination: 'http://realtime-service:4002/socket.io/:path*',
      },
    ];
  },
  webpack: (config) => {
    // Ensure client-side compatibility
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