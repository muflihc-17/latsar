import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["10.11.41.38", "192.168.1.119", "192.168.1.*"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
