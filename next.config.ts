import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Which sources pages may load from, as Next.js suggests for apps without
// nonces (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Everything comes from this site: fonts are bundled by next/font. Inline
// scripts are allowed because Next.js uses them; the rest still stops
// pages loading scripts from elsewhere, or being shown inside another
// site's frame to trick an admin into clicking. upgrade-insecure-requests
// would break http://localhost, so it's left out in development.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // frame-ancestors, for browsers too old to know it.
  { key: "X-Frame-Options", value: "DENY" },
  // Files are only ever treated as the type the server says.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites linked from a page learn only this site's address, not
  // the page's full URL.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browser features the app never uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Room for Purdue's approved driver spreadsheet, uploaded on the
      // Drivers page. (Vercel accepts request bodies up to 4.5MB.)
      bodySizeLimit: "4mb",
    },
  },
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
