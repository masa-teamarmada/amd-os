import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { CONTRACT_STATUSES, type ContractStatus } from "@/lib/contracts";

export const runtime = "nodejs";

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength = 240) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function validStatus(value: string): value is ContractStatus {
  return CONTRACT_STATUSES.includes(value as ContractStatus);
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ contractId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { contractId } = await context.params;
  if (!contractId) {
    return NextResponse.json({ ok: false, error: "contractId is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_by: auth.user.email,
  };
  let requestedRelationshipScope: string | null = null;

  const rawStatus = text(body.status, 80);
  if (rawStatus) {
    if (!validStatus(rawStatus)) {
      return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
    }
    patch.status = rawStatus;
    patch.last_activity_at = new Date().toISOString();
    if (rawStatus !== "signed") {
      patch.signed_at = null;
      patch.signed_document_id = null;
    }
  }

  const fields: Array<[string, string, number]> = [
    ["contract_title", "contractTitle", 240],
    ["canonical_title", "canonicalTitle", 240],
    ["canonical_contract_id", "canonicalContractId", 80],
    ["counterparty_name", "counterpartyName", 240],
    ["contract_type", "contractType", 80],
    ["amd_entity_name", "amdEntityName", 160],
    ["amd_party_role", "amdPartyRole", 120],
    ["party_confirmation_note", "partyConfirmationNote", 500],
    ["expected_signing_date", "expectedSigningDate", 20],
    ["effective_date", "effectiveDate", 20],
    ["expiration_date", "expirationDate", 20],
    ["renewal_notice_date", "renewalNoticeDate", 20],
    ["renewal_type", "renewalType", 80],
    ["business_owner", "businessOwner", 160],
    ["ledger_notes", "ledgerNotes", 1000],
    ["confidentiality_survival_note", "confidentialitySurvivalNote", 500],
    ["confidentiality_note", "confidentialityNote", 500],
    ["review_status", "reviewStatus", 40],
    ["source_summary", "sourceSummary", 1000],
    ["drive_folder_id", "driveFolderId", 220],
  ];
  for (const [snake, camel, maxLength] of fields) {
    if (snake in body || camel in body) {
      patch[snake] = optionalText(body[snake] ?? body[camel], maxLength);
    }
  }

  if ("review_required" in body || "reviewRequired" in body) {
    patch.review_required = Boolean(body.review_required ?? body.reviewRequired);
  }
  if ("relationship_scope" in body || "relationshipScope" in body) {
    const scope = text(body.relationship_scope ?? body.relationshipScope, 40) || "needs_review";
    if (!["amd_contract", "needs_review", "third_party", "template"].includes(scope)) {
      return NextResponse.json({ ok: false, error: "invalid relationship scope" }, { status: 400 });
    }
    requestedRelationshipScope = scope;
    patch.relationship_scope = scope;
    if (scope === "amd_contract") {
      patch.party_confirmed_at = new Date().toISOString();
      patch.party_confirmed_by = auth.user.email;
    } else {
      patch.party_confirmed_at = null;
      patch.party_confirmed_by = null;
      patch.is_current_for_project = false;
    }
  }
  if ("is_current_for_project" in body || "isCurrentForProject" in body) {
    const isCurrentForProject = Boolean(body.is_current_for_project ?? body.isCurrentForProject);
    if (isCurrentForProject && requestedRelationshipScope !== "amd_contract") {
      return NextResponse.json({ ok: false, error: "only an AMD contract can be current for a project" }, { status: 400 });
    }
    patch.is_current_for_project = isCurrentForProject;
  }
  if ("operational_terms_json" in body || "operationalTermsJson" in body) {
    const terms = body.operational_terms_json ?? body.operationalTermsJson;
    if (!terms || typeof terms !== "object" || Array.isArray(terms)) {
      return NextResponse.json({ ok: false, error: "invalid operational terms" }, { status: 400 });
    }
    patch.operational_terms_json = {
      ...(terms as Record<string, unknown>),
      verifiedAt: new Date().toISOString(),
      verifiedBy: auth.user.email,
    };
  }
  if ("contract_value_yen" in body || "contractValueYen" in body) {
    const raw = body.contract_value_yen ?? body.contractValueYen;
    const value = raw === null || raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ ok: false, error: "invalid contract value" }, { status: 400 });
    }
    patch.contract_value_yen = value;
  }
  if ("nudge_after_days" in body || "nudgeAfterDays" in body) {
    patch.nudge_after_days = Math.max(1, Math.min(120, Number(body.nudge_after_days ?? body.nudgeAfterDays) || 14));
  }
  if ("signed_at" in body || "signedAt" in body) {
    patch.signed_at = optionalText(body.signed_at ?? body.signedAt, 40);
  }
  if ("confidentiality_coverage" in body || "confidentialityCoverage" in body) {
    const coverage = text(body.confidentiality_coverage ?? body.confidentialityCoverage, 40) || "unknown";
    if (!["in_contract", "separate_nda", "not_included", "unknown"].includes(coverage)) {
      return NextResponse.json({ ok: false, error: "invalid confidentiality coverage" }, { status: 400 });
    }
    patch.confidentiality_coverage = coverage;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contracts")
    .update(patch)
    .eq("contract_id", contractId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contract: data });
}
