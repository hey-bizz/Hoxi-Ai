/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Ensure proper asset handling
  assetPrefix: '',
  // Basic compiler settings
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Ensure proper headers for static files
  async headers() {
    return [
      {
        source: '/_next/static/css/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/css; charset=utf-8',
          },
        ],
      },
    ]
  },
  trailingSlash: false,
  poweredByHeader: false,
}

export default nextConfig
