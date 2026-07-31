import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { loadReconciliationOverview, runWeeklyReconciliation } from "@/lib/finance/freee-reconciliation-client";

export const runtime = "nodejs";
export const maxDuration = 300;

const REVIEW_DECISIONS = new Set(["approved", "rejected"]);

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const db = createAdminClient();
  try {
    const overview = await loadReconciliationOverview(db);
    return NextResponse.json({ ok: true, overview });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const db = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "run") {
    const dryRun = body.dryRun !== false; // 明示的に false を渡した場合のみ実runにする。既定はdry-run。
    try {
      const result = await runWeeklyReconciliation(db, { triggeredBy: "admin_manual", dryRun });
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  if (action === "review") {
    // このrouteはfindingの承認/却下を「監査記録として保存する」だけ。freeeへの即時書込みは
    // 一切行わない（安全な公式書込みendpointが確認・実装されるまでの意図的な制約。
    // pwa/manual/6-10-freee-accounting-reconciliation-spec.md 参照）。
    const findingId = String(body.findingId ?? "");
    const decision = String(body.decision ?? "");
    if (!findingId || !REVIEW_DECISIONS.has(decision)) {
      return NextResponse.json({ ok: false, error: "findingId and decision(approved|rejected) are required" }, { status: 400 });
    }
    const { data: updated, error: updateError } = await db
      .from("freee_reconciliation_findings")
      .update({
        review_status: decision,
        reviewed_by: auth.user.email,
        reviewed_at: new Date().toISOString(),
        review_note: typeof body.note === "string" ? body.note : null,
      })
      .eq("id", findingId)
      .select("*")
      .single();
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, finding: updated });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
