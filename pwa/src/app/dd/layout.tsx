import type { Metadata } from "next";

// DD（投資家・金融機関向け）の面。社内のアプリの枠（AppShell）を共有しない独立の面。
// タイトルに PJ 名やパッケージ名を出さない（権限の確認より先に描かれるため、存在を漏らさない）。
export const metadata: Metadata = {
  title: { absolute: "DD資料" },
  robots: { index: false, follow: false },
};

export default function DdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
