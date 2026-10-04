import type { Metadata } from "next";
import { headers } from "next/headers";
import { LoginAppProvider } from "@/components/auth/LoginAppContext";
import { isShosaiHost } from "@/lib/bzm-reader/hosts";

/**
 * /auth/login — 書斎のアドレスで開いたときは、題と manifest も書斎のものにする。
 * ログイン画面で「ホーム画面に追加」しても、AMD OS ではなく書斎のアプリとして入るように。設計正本 bzm_reader.md §2.1
 */
async function requestedOnShosaiHost(): Promise<boolean> {
  const h = await headers();
  return isShosaiHost(h.get("host"));
}

export async function generateMetadata(): Promise<Metadata> {
  if (!(await requestedOnShosaiHost())) return {};
  return {
    title: "書斎",
    manifest: "/manifest-shosai.json",
    appleWebApp: { capable: true, title: "書斎", statusBarStyle: "default" },
  };
}

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const app = (await requestedOnShosaiHost()) ? "shosai" : "amd-os";
  return <LoginAppProvider app={app}>{children}</LoginAppProvider>;
}
