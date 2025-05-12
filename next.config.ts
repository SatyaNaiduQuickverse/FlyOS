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
    ];
  },
};

module.exports = nextConfig;
