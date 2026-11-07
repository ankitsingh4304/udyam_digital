/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native/worker-based packages must load from node_modules at runtime, not be bundled.
  experimental: { serverComponentsExternalPackages: ["sharp", "tesseract.js"] },
};

export default nextConfig;
