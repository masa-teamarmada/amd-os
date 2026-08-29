// PJ別 利益構造ダッシュボード の読み取り API。
//
// 【体感速度】billing_cycles は月次締め処理でしか動かない参照系データ。3層でキャッシュする。
//   1. サーバのプロセス内スナップショット (lib/project-profitability.ts, TTL 5分, 年単位)
//   2. この route の Cache-Control (ブラウザHTTPキャッシュ)
//   3. クライアントのモジュールキャッシュ (lib/project-profitability-client.ts)
// `?fresh=1` で 1 を強制再読込する (月次締め直後の確認用)。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  loadProjectProfitabilitySnapshot,
  projectProfitabilityCacheAgeMs,
} from "@/lib/project-profitability";

export const runtime = "nodejs";

const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

function parseYear(raw: string | null): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 2000 && n <= 2100) return Math.trunc(n);
  return new Date().getUTCFullYear();
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));
  const force = searchParams.get("fresh") === "1";

  try {
    const snapshot = await loadProjectProfitabilitySnapshot(year, { force });
    return NextResponse.json(
      { ok: true, year: snapshot.year, rows: snapshot.rows },
      {
        headers: {
          "Cache-Control": force ? "no-store" : CACHE_CONTROL,
          "x-project-profitability-cache-age-ms": String(projectProfitabilityCacheAgeMs(year) ?? -1),
        },
      },
    );
  } catch (err) {
    console.error("[admin project-profitability GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
