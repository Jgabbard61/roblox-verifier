import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tr.rbxcdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.rbxcdn.com',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/**',
      },
    ],
  },
}

export default nextConfig