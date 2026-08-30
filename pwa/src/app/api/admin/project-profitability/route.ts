// PJ別 利益構造ダッシュボード の読み取り API。
//
// シーズン(plan cycle)単位の集計を全件返す。シーズン数は十数件なので分割しない。
// 【体感速度】billing_cycles / value_plan_cycles は月次締めでしか動かない参照系。3層でキャッシュする。
//   1. サーバのプロセス内スナップショット (lib/project-profitability.ts, TTL 5分)
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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const force = new URL(req.url).searchParams.get("fresh") === "1";

  try {
    const snapshot = await loadProjectProfitabilitySnapshot({ force });
    return NextResponse.json(
      { ok: true, rows: snapshot.rows },
      {
        headers: {
          "Cache-Control": force ? "no-store" : CACHE_CONTROL,
          "x-project-profitability-cache-age-ms": String(projectProfitabilityCacheAgeMs() ?? -1),
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
