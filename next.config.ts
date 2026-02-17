import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      // Explicit rule for /user/me — backend requires trailing slash
      {
        source: '/api/v1/user/me',
        destination: `${apiUrl}/api/v1/user/me/`,
      },
      // Proxy all other API calls to backend
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
