/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@restaurant/types', '@restaurant/utils'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;
