import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ponytail: lets your phone hit the dev server over the LAN. Dev-only; ignored in prod.
  allowedDevOrigins: ["192.168.178.67"],
};

export default nextConfig;
