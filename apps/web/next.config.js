/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@moongate/config', '@moongate/types', '@moongate/utils'],
  images: {
    domains: ['images.unsplash.com', 'localhost'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
