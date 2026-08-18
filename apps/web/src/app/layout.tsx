import type { Metadata, Viewport } from "next";
import "./styles.css";

const siteUrl = "https://anycol.aurict.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Anycol — Dağınık sinyaller, net kararlar",
    template: "%s · Anycol",
  },
  description:
    "Instagram, Facebook, Meta Ads, TikTok, YouTube Shorts, Google Ads, GA4 ve Search Console verilerini tek karar yüzeyinde birleştirin.",
  keywords: [
    "pazarlama analitiği",
    "sosyal medya raporlama",
    "Meta Ads raporlama",
    "TikTok analytics",
    "YouTube Shorts analytics",
    "Google Ads dashboard",
    "çok kanallı pazarlama",
  ],
  authors: [{ name: "Anycol" }],
  creator: "Anycol",
  publisher: "Anycol",
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: siteUrl,
    siteName: "Anycol",
    title: "Anycol — Dağınık sinyaller, net kararlar",
    description:
      "Reklamı, aramayı ve sosyal videoyu tek bir pazarlama karar sisteminde okuyun.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Anycol pazarlama karar sistemi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anycol — Dağınık sinyaller, net kararlar",
    description: "Tüm pazarlama kanallarınız için tek karar yüzeyi.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2efe7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
