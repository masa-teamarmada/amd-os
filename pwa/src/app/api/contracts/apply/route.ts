import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyContractTerms, deriveContractApplyPlan } from "@/lib/contracts-apply";
import { requireContractTermsOperator } from "@/lib/contract-terms-operator-auth";

export const runtime = "nodejs";

/**
 * Contract Apply API。
 *
 * - GET ?termId=... &dryRun=1  : applied term の反映プランをプレビュー (DB write なし)
 * - POST { termId }            : 3 層へ実反映
 *
 * 正本 spec: pwa/spec/5-6-contracts-management-current-spec.md。
 * applied にするのは人 (admin レビュー) なので、ここでは applied term の値を機械的に流すだけ。
 */

export async function GET(req: Request) {
  const auth = await requireContractTermsOperator(req);
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const termId = url.searchParams.get("termId") || "";
  if (!termId) return NextResponse.json({ ok: false, error: "termId is required" }, { status: 400 });

  const db = createAdminClient();
  const { data: term, error } = await db
    .from("contract_terms")
    .select(
      "term_id, contract_id, project_id, contract_title, counterparty_name, source_title, source_url, contract_no, quote_no, period_start_ym, period_end_ym, amount_tax_excl, amount_tax_incl, billing_distribution, fee_type_hint, billing_distribution_json, extracted_terms_json, status",
    )
    .eq("term_id", termId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!term) return NextResponse.json({ ok: false, error: "term not found" }, { status: 404 });

  const plan = deriveContractApplyPlan(term);
  if ("error" in plan) return NextResponse.json({ ok: false, error: plan.error }, { status: 422 });

  return NextResponse.json({ ok: true, dryRun: true, plan });
}

export async function POST(req: Request) {
  const auth = await requireContractTermsOperator(req);
  if (!auth.ok) return auth.errorResponse;

  let body: { termId?: string } = {};
  try {
    body = (await req.json()) as { termId?: string };
  } catch {
    body = {};
  }
  const termId = (body.termId || "").trim();
  if (!termId) return NextResponse.json({ ok: false, error: "termId is required" }, { status: 400 });

  const db = createAdminClient();
  try {
    const result = await applyContractTerms(db, termId, auth.actor);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
