/** @type {import('next').NextConfig} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  output: 'standalone',
  // pnpm workspace：从 monorepo 根追踪依赖，避免 standalone 缺文件
  outputFileTracingRoot: path.join(__dirname, '..'),
  reactStrictMode: true,
  typedRoutes: false,
  turbopack: {
    root: path.join(__dirname, '..')
  },
  async rewrites() {
    return [
      {
        source: '/api/feed/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000'}/api/feed/:path*`
      }
    ];
  },
  async redirects() {
    return [
      { source: '/daily-json', destination: '/daily', permanent: true },
      { source: '/daily-json/:date', destination: '/daily/:date', permanent: true }
    ];
  }
};

export default nextConfig;
