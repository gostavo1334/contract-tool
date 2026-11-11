import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**/*": ["./templates/**/*"],
    "/**/*": ["./templates/**/*"],
  },
};

export default nextConfig;
