/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@restaurant/ui', '@restaurant/types', '@restaurant/utils'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
};

module.exports = nextConfig;
