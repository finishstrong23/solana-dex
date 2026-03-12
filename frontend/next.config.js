/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
    };
    // pino-pretty is an optional dep of pino (used by WalletConnect)
    // and is not available at build time — mark it as external
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "pino-pretty": false,
      };
    }
    config.externals = [...(config.externals || []), "pino-pretty"];
    return config;
  },
};

module.exports = nextConfig;
