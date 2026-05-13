/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@restaurant/types', '@restaurant/utils'],
};

module.exports = nextConfig;
