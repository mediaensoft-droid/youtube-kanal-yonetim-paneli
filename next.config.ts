import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Kategoriler and Konseptler moved under the Kanallar hub; keep old bookmarks working.
    return [
      { source: "/categories", destination: "/channels/categories", permanent: true },
      { source: "/concepts", destination: "/channels/concepts", permanent: true },
    ];
  },
};

export default nextConfig;
