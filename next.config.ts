import type { NextConfig } from "next";

function imageKitPattern() {
  const configured = process.env.IMAGEKIT_URL_ENDPOINT;
  const endpoint = configured ? new URL(configured) : new URL("https://ik.imagekit.io/book-my-room-unconfigured");
  if (endpoint.protocol !== "https:") throw new Error("IMAGEKIT_URL_ENDPOINT must use HTTPS");
  const basePath = endpoint.pathname.replace(/\/$/, "");
  return {
    protocol: "https" as const,
    hostname: endpoint.hostname,
    port: endpoint.port,
    pathname: `${basePath}/**`,
  };
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [imageKitPattern()],
    qualities: [75, 80],
  },
};

export default nextConfig;

