import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud VM browsers and the named tunnel use these hosts instead of localhost.
  // Without this, Next.js 16 blocks dev client bundles/HMR cross-origin and login
  // forms never hydrate (onSubmit never runs).
  allowedDevOrigins: ["127.0.0.1", "readbetter.rbouschery.de"],
};

export default nextConfig;
