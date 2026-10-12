import type { Metadata } from "next";

// What chat apps and social sites show when a link to the site is shared:
// a card with the page's title, description and image.
//
// A page that sets its own openGraph replaces these rather than adding to
// them (an opengraph-image file in app/ would be dropped too), so it should
// spread them into its own.

export const SITE_NAME = "Purdue Habitat Volunteering";
export const SITE_DESCRIPTION = "Sign up to volunteer with Purdue Habitat for Humanity.";

export const openGraphDefaults = {
  siteName: SITE_NAME,
  type: "website",
  locale: "en_US",
  // public/og-image.png. Cards are about 1.91:1 (1200 × 630 is typical),
  // and some apps crop wider or square images to fit.
  images: [{ url: "/og-image.png", alt: "Purdue Habitat for Humanity" }],
} satisfies Metadata["openGraph"];

// A large image above the title, rather than a small one beside it.
export const twitterDefaults = { card: "summary_large_image" } satisfies Metadata["twitter"];
