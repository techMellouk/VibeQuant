import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SDK ships as TypeScript source, so Next must transpile it.
  transpilePackages: ["@vibequant/sdk"],
};

export default nextConfig;
