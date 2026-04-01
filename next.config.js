/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '30mb',
    },
  },
};

module.exports = nextConfig;
