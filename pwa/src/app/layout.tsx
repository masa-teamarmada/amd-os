import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// title.template が Next.js 16 で route group 配下で解決されない問題があるため、
// template は使わず各 page で absolute title を指定する。
// PageTitleSetter (client) が pathname → title を上書きするので、初期 HTML 経由 + client 動的の二段防御。
// favicon は app/icon.png + app/apple-icon.png (Next.js convention) で自動配信されるため
// metadata.icons は指定しない (= 二重 link を避けてキャッシュ衝突を防ぐ)。
export const metadata: Metadata = {
  title: "AMD OS",
  description: "Team ARMADA Business Operating System",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
