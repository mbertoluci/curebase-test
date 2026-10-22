//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @org/contracts is shipped as TypeScript source (shared with the API), so
  // Next must transpile it like first-party code.
  transpilePackages: ['@org/contracts'],
};

module.exports = nextConfig;
