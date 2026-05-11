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
//
// favicon: 2026-05-11 まさ「相変わらず全く直ってない」第 3 ラウンド指摘:
// 旧構成は app/favicon.ico + app/icon.png + app/apple-icon.png (Next.js convention) で自動配信
// していたが、生成 HTML が `<link href="/favicon.ico?favicon.0x3dzn~oxb6tn.ico?dpl=...">` のように
// **`?` 2 重** の特殊 URL になっていて、シークレット 7 回でも反映されなかった。
// → public/ 配下に手動配置に切替 + metadata.icons で **シンプル URL** を明示。
export const metadata: Metadata = {
  title: "AMD OS",
  description: "Team ARMADA Business Operating System",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
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
