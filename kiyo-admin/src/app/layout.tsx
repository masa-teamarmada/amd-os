import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: {
    default: "きよ専用 AMD OS",
    template: "%s | きよ専用 AMD OS",
  },
  description: "AMD OS 管理業務 — きよ専用",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "きよAMD OS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
