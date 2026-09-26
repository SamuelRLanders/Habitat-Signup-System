import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The admin Volunteers tab was renamed People.
      { source: "/admin/volunteers", destination: "/admin/people", permanent: true },
    ];
  },
};

export default nextConfig;
