import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  // Build a standalone output (useful when deploying to container-based platforms).
  // Vercel's Next builder handles deployments automatically, but this can
  // help when you export or run the app in a custom environment.
  output: "standalone",
};

export default nextConfig;
