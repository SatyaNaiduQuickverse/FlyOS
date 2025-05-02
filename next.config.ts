/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Remove swcMinify: true,
  experimental: {
    // Uncomment if needed for Next.js optimizations
    // optimizeCss: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://auth-service:4000/auth/:path*', // proxy to auth service
      },
    ];
  },
};
module.exports = nextConfig;
