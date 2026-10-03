import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The admin Volunteers tab was renamed People.
      { source: "/admin/volunteers", destination: "/admin/people", permanent: true },
      // Volunteers used to sign in, see their signups and share group join
      // links, and each build had its own signup page. Volunteers now sign
      // up through the forms listed on the home page. Not permanent, so
      // these paths can be used again.
      { source: "/me/:path*", destination: "/", permanent: false },
      { source: "/join/:token", destination: "/", permanent: false },
      { source: "/builds/:buildId", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
