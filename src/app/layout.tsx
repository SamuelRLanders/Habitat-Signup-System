import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  openGraphDefaults,
  SITE_DESCRIPTION,
  SITE_NAME,
  twitterDefaults,
} from "@/lib/site-metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Shared links need full URLs for the page and its preview image.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: {
    default: SITE_NAME,
    template: "%s · Purdue Habitat",
  },
  description: SITE_DESCRIPTION,
  openGraph: { ...openGraphDefaults, title: SITE_NAME, description: SITE_DESCRIPTION },
  twitter: twitterDefaults,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
