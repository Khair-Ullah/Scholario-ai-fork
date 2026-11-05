/*
** @type {import('next').NextConfig} 
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
*/

/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;