import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  buildVerifiedOriginalExpenseCandidate,
  contractTermReviewPatch,
  type ContractTermReviewDecision,
  type VerifiedOriginalExpenseCandidate,
  type VerifiedOriginalExpenseCandidateInput,
} from "@/lib/contract-terms-review";

export const runtime = "nodejs";

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function jsonBody(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 締結済み原本を人が確認した場合の terms-only 候補作成。
 * 原本本文は Drive に残し、DB には出典metadataと短い根拠注記だけを保存する。
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });

  let candidate: VerifiedOriginalExpenseCandidate;
  try {
    candidate = buildVerifiedOriginalExpenseCandidate({
      projectId: body.projectId,
      sourceId: body.sourceId,
      sourceUrl: body.sourceUrl,
      sourceTitle: body.sourceTitle,
      contractTitle: body.contractTitle,
      counterpartyName: body.counterpartyName,
      expenseReimbursementAllowed: body.expenseReimbursementAllowed,
      expenseReimbursementNote: body.expenseReimbursementNote,
      executionEvidence: body.executionEvidence,
    } as VerifiedOriginalExpenseCandidateInput, auth.user.email || "admin");
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("project_id")
    .eq("project_id", candidate.project_id)
    .maybeSingle();
  if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
  if (!project) return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });

  const { data: existing, error: existingError } = await db
    .from("contract_terms")
    .select("term_id,project_id,source_term_hash,status,review_status")
    .eq("source_kind", candidate.source_kind)
    .eq("source_table", candidate.source_table)
    .eq("source_id", candidate.source_id)
    .eq("source_term_hash", candidate.source_term_hash)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  if (existing && existing.project_id !== candidate.project_id) {
    return NextResponse.json({ ok: false, error: "source term is already linked to another project" }, { status: 409 });
  }
  if (existing) return NextResponse.json({ ok: true, created: false, term: existing });

  const { data, error } = await db.from("contract_terms").insert(candidate).select(
    "term_id,project_id,source_term_hash,status,review_status",
  ).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: true, term: data });
}

/** 候補hashを照合して、人のレビュー結果だけを確定する。正本反映は /api/contracts/apply が担う。 */
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await jsonBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  const termId = text(body.termId, 80);
  const expectedSourceHash = text(body.sourceTermHash, 128);
  const decision = text(body.decision, 20) as ContractTermReviewDecision;
  if (!termId || !expectedSourceHash || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ ok: false, error: "termId, sourceTermHash and valid decision are required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: term, error: termError } = await db.from("contract_terms")
    .select("term_id,source_term_hash,status,review_status")
    .eq("term_id", termId)
    .maybeSingle();
  if (termError) return NextResponse.json({ ok: false, error: termError.message }, { status: 500 });
  if (!term) return NextResponse.json({ ok: false, error: "term not found" }, { status: 404 });
  if (term.source_term_hash !== expectedSourceHash) {
    return NextResponse.json({ ok: false, error: "source hash mismatch" }, { status: 409 });
  }

  const expectedStatus = decision === "approved" ? "applied" : "rejected";
  if (term.status === expectedStatus && term.review_status === expectedStatus) {
    return NextResponse.json({ ok: true, updated: false, term });
  }
  if (term.status !== "candidate" || term.review_status !== "pending") {
    return NextResponse.json({ ok: false, error: "term is no longer pending review" }, { status: 409 });
  }

  const patch = contractTermReviewPatch(decision, auth.user.email || "admin", new Date().toISOString());
  const { data, error } = await db.from("contract_terms")
    .update(patch)
    .eq("term_id", termId)
    .eq("source_term_hash", expectedSourceHash)
    .eq("status", "candidate")
    .eq("review_status", "pending")
    .select("term_id,project_id,source_term_hash,status,review_status")
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "term changed during review" }, { status: 409 });
  return NextResponse.json({ ok: true, updated: true, term: data });
}
