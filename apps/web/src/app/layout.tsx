import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ServiceWorkerRegistrar, StaticCacheResetScript } from "@/features/notifications";
import { ThemeInitScript } from "@/lib/theme/theme-init-script";

import "@/styles/globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  applicationName: "Evergreen",
  title: {
    default: "Evergreen Dashboard",
    template: "%s — Evergreen Dashboard"
  },
  description: "Персональное рабочее пространство для важных дел и актуальной информации.",
  appleWebApp: {
    capable: true,
    title: "Evergreen",
    statusBarStyle: "default"
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1410" }
  ]
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang="ru"
      suppressHydrationWarning
    >
      <head>
        <ThemeInitScript />
        <StaticCacheResetScript />
      </head>
      <body suppressHydrationWarning>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
