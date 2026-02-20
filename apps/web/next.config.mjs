/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT_EXPORT === "1" ? "export" : undefined,
  typedRoutes: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  turbopack: {}
};

export default nextConfig;
