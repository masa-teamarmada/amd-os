// /institutions「支援プログラム比較」の読み取り API。
//
// 制度比較マトリクスの証拠台帳 (`institution_policy_assessments`) は内部資料パスや入力者を持つため
// RLS は admin 限定のまま。この route が service client で読み、会員へは表示に要る列だけ返す
// (source_path / evaluator は返さない)。
//   1. サーバのプロセス内スナップショット (lib/institution-support-programs.ts, TTL 5分)
//   2. この route の Cache-Control (ブラウザHTTPキャッシュ)
//   3. クライアントのモジュールキャッシュ (lib/institution-support-programs-client.ts)
// `?fresh=1` で 1 を強制再読込する (セル保存直後の確認用)。
//
// 規範: pwa/spec/5-10-reference-data-caching-current-spec.md
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import {
  getSupportProgramSnapshot,
  supportProgramCacheAgeMs,
} from "@/lib/institution-support-programs";

export const runtime = "nodejs";

/** 制度の整備状況は日〜週単位でしか変わらないので、ブラウザには短時間の再利用 + 背面での更新を許す。 */
const CACHE_CONTROL = "private, max-age=60, stale-while-revalidate=600";

export async function GET(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  // service client を使う前に portfolio scope を確定する。PJ限定の外部メンバーへ横断母集団を返さない。
  const access = await getCurrentMemberAccess();
  if (!access || access.scope !== "portfolio") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const force = new URL(req.url).searchParams.get("fresh") === "1";

  try {
    const [snapshot, memberResult] = await Promise.all([
      getSupportProgramSnapshot(createAdminClient(), { force }),
      auth.supabase
        .from("members")
        .select("is_admin")
        .eq("email", auth.user.email.toLowerCase())
        .maybeSingle(),
    ]);
    return NextResponse.json(
      {
        ok: true,
        columns: snapshot.columns,
        cells: snapshot.cells,
        recommendations: snapshot.recommendations,
        generatedAt: snapshot.generatedAt,
        canEdit: Boolean(memberResult.data?.is_admin),
      },
      {
        headers: {
          "Cache-Control": force ? "no-store" : CACHE_CONTROL,
          "x-support-programs-cache-age-ms": String(supportProgramCacheAgeMs() ?? -1),
        },
      },
    );
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "support programs lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
