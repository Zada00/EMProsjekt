/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "no-referrer" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ],
            },
        ];
    },
    // Tillat større opplastinger til server actions/route handlers (tilstandsrapporter er store).
    experimental: {
        serverActions: { bodySizeLimit: "25mb" },
    },
};

export default nextConfig;
