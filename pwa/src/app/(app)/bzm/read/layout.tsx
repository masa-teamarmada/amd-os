import type { Metadata, Viewport } from "next";
import { requireReaderAdmin } from "@/lib/bzm-reader/require-reader-admin";

/**
 * /bzm/read — 書斎は管理者限定の専用アプリ。
 * 棚には未投稿の論文と匿名化前の草稿が並ぶ。広げるかはまさが決めるまで管理者だけに絞る。
 * layout は他の segment を止めないので、各 page と generateMetadata でも requireReaderAdmin を呼ぶ。
 * 専用アプリとしてインストールできるよう、ルートの /manifest.json を書斎の配下でだけ別の manifest に差し替える。
 * 設計正本: pwa/design/bzm_reader.md §1
 */
export const metadata: Metadata = {
  manifest: "/manifest-shosai.json",
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
