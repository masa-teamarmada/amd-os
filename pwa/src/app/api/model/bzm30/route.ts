// BZM 3.0 のモデル定義（式・係数・型×規制×証拠水準ごとの計算結果）の読み取り API。
//
// 中身はモデル正本（model/MODEL_VERSION_LEDGER.md）と、参照実装が書き出した係数表。
// シーズにも PJ にも依存しない**純粋な参照系**なので、長めにキャッシュしてよい。
// 正本は model/LOCK.json の sha256 で凍結されており、まさの承認を経た relock のときしか変わらない。
//
// 【体感速度】3層でキャッシュする（規範: pwa/spec/5-10-reference-data-caching-current-spec.md）
//   1. サーバのプロセス内スナップショット（lib/model-canon-source.ts、正本 md の読み込み）
//   2. この route の Cache-Control
//   3. クライアントのモジュールキャッシュ（lib/bzm30-model-client.ts）
import { NextResponse } from "next/server";
import { requireMember } from "@/lib/supabase/api-auth";
import { loadBzm30Formulas } from "@/lib/bzm30/formulas";
import { BZM30_TIER0 } from "@/lib/bzm30/tier0";

export const runtime = "nodejs";

/** 正本は承認を経た relock のときしか変わらない。ブラウザには長めの再利用を許す。 */
const CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=3600";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  try {
    return NextResponse.json(
      {
        ok: true as const,
        model: {
          model_version: BZM30_TIER0.model_version,
          approval_ref: BZM30_TIER0.approval_ref,
          canon: BZM30_TIER0.canon,
          reference_impl: BZM30_TIER0.reference_impl,
          note: BZM30_TIER0.note,
          approximations: BZM30_TIER0.approximations,
          numeric_error: BZM30_TIER0.numeric_error,
          stages: BZM30_TIER0.stages,
          params: BZM30_TIER0.params,
          grid: BZM30_TIER0.grid,
          formulas: loadBzm30Formulas(),
        },
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (cause) {
    return NextResponse.json(
      { ok: false, error: cause instanceof Error ? cause.message : "bzm30 model lookup failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
