/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Remove swcMinify: true,
  experimental: {
    // Uncomment if needed for Next.js optimizations
    // optimizeCss: true,
  }
};
module.exports = nextConfig;
