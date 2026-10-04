import type { Metadata, Viewport } from "next";
import { requireReaderAdmin } from "@/lib/bzm-reader/require-reader-admin";

/**
 * /bzm/read — 書斎は管理者限定の専用アプリ。
 * 棚には未投稿の論文と匿名化前の草稿が並ぶ。広げるかはまさが決めるまで管理者だけに絞る。
 * layout は他の segment を止めないので、各 page と generateMetadata でも requireReaderAdmin を呼ぶ。
 * 専用アプリとしてインストールできるよう、ルートの /manifest.json を書斎の配下でだけ別の manifest に差し替える。
 * アイコンは書斎専用の絵（public/icons/shosai-*。まさ提供の画像、2026-10-04）。
 * 題も「… - AMD OS」ではなく「書斎」にする（(app)/layout.tsx の題を、この layout が上書きする。アプリの窓の題に出る）。
 * 設計正本: pwa/design/bzm_reader.md §1
 */
export const metadata: Metadata = {
  title: "書斎",
  manifest: "/manifest-shosai.json",
  icons: {
    icon: [
      { url: "/icons/shosai-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/shosai-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/shosai-apple-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "書斎",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function BzmReaderLayout({ children }: { children: React.ReactNode }) {
  await requireReaderAdmin();
  return <>{children}</>;
}
