/**
 * /project/[projectId]/report/[ym]/print
 *
 * クライアント提出用 月次レポート印刷ページ (A4 縦)。
 *
 * 使い方: ブラウザで開いて Cmd+P → 「PDFとして保存」(余白なし / 背景画像オン)。
 * Vercel serverless で Puppeteer を回さない方針 (Vercel bundle/timeout で詰む)。
 * HTML は OS マニュアル「pwa/spec/3-2-monthly-reports-current-spec.md」§印刷出力 を正本とする。
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { MonthlyReportPrintClient } from "./print-client";

interface Params { params: Promise<{ projectId: string; ym: string }> }

async function fetchPrintData(projectId: string, ym: string) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host") || "amd-os-pwa.vercel.app";
  const cookie = h.get("cookie") || "";
  const res = await fetch(
    `${proto}://${host}/api/project/monthly-report-print?projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(ym)}`,
    { cache: "no-store", headers: { cookie } }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function MonthlyReportPrintPage({ params }: Params) {
  const { projectId, ym } = await params;
  const auth = await requireAdmin();
  if (!auth.ok) return <div className="p-8 text-sm">この月次報告書を表示する権限がありません。</div>;

  if (!/^\d{6}$/.test(ym)) notFound();

  const data = await fetchPrintData(projectId, ym);
  if (!data?.ok) notFound();

  return <MonthlyReportPrintClient data={data} />;
}
