/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tillat større opplastinger til server actions/route handlers (tilstandsrapporter er store).
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
