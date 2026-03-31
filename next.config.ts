import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Fix for @mapbox/node-pre-gyp module type error
  webpack: (config, { isServer }) => {
    // Ignore .html files in node_modules
    config.module.rules.push({
      test: /\.html$/,
      type: 'asset/source',
    });
    return config;
  },
  // Exclude problematic packages from Turbopack
  transpilePackages: [],
  // Exclude server-only packages from client bundle
  serverExternalPackages: [
    '@mapbox/node-pre-gyp',
    'bcrypt',
    'pg',
    'pg-native',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    localPatterns: [
      {
        pathname: '/uploads/**',
      },
    ],
  },
  // Configuration for Replit environment
  // Allow all hosts for development server in Replit
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
