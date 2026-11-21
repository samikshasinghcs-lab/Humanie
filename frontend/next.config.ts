import type {NextConfig} from 'next';

// Python engine (FastAPI) URL, e.g. https://humanie-api.onrender.com  (no trailing slash).
// Must be set at build time on Vercel. Browser calls go to /engine-api/* and are proxied here.
const BACKEND_URL = (process.env.HUMANIE_BACKEND_URL || '').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [{source: '/engine-api/:path*', destination: `${BACKEND_URL}/:path*`}];
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
