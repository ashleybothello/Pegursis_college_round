const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.snarkjs = path.resolve(__dirname, 'node_modules/snarkjs/build/browser.esm.js');
    }

    return config;
  },
};

module.exports = nextConfig;
