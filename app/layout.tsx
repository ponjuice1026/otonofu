import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { BottomNav } from "@/components/layout/BottomNav";
import { DataSourceBanner } from "@/components/layout/DataSourceBanner";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SiteBackdrop } from "@/components/layout/SiteBackdrop";
import { pageTitle, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: pageTitle(),
  description: SITE_DESCRIPTION,
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    title: pageTitle(),
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/brand/og-default.png",
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle(),
    description: SITE_DESCRIPTION,
    images: ["/brand/og-default.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="site-body">
        <SiteBackdrop />
        <div className="site-frame">
          <Header />
          <DataSourceBanner />
          <main className="flex-1">{children}</main>
          <Footer />
          <div className="mobile-nav-spacer md:hidden" aria-hidden />
          <BottomNav />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
