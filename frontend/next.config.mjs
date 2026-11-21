/** @type {import('next').NextConfig} */
const isVercel = process.env.VERCEL === "1";
const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
const backend = (process.env.BACKEND_URL ?? publicApiUrl ?? "http://localhost:8000").trim();

if (isVercel && (!backend || backend.includes("localhost"))) {
  throw new Error("BACKEND_URL must be set to the public FastAPI origin on Vercel.");
}
if (isVercel && publicApiUrl) {
  throw new Error("Leave NEXT_PUBLIC_API_URL empty on Vercel so /api stays same-origin.");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
