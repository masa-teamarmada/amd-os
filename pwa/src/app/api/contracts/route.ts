import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { CONTRACT_STATUSES, type ContractStatus } from "@/lib/contracts";

export const runtime = "nodejs";

const CONTRACTS_LIST_LIMIT = 10000;
const CONTRACT_DOCUMENTS_LIST_LIMIT = 20000;
const CONTRACT_ACTIVITY_LIST_LIMIT = 5000;

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength = 240) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function numberOrNull(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function validStatus(value: string): value is ContractStatus {
  return CONTRACT_STATUSES.includes(value as ContractStatus);
}

function schemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /relation .*contracts|schema cache|does not exist/i.test(message);
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const admin = createAdminClient();
  try {
    const [contractsRes, documentsRes, signalsRes, nudgesRes, projectsRes] = await Promise.all([
      admin
        .from("contracts")
        .select("*,projects(project_name,slack_channel_id)")
        .order("last_activity_at", { ascending: false })
        .limit(CONTRACTS_LIST_LIMIT),
      admin
        .from("contract_documents")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(CONTRACT_DOCUMENTS_LIST_LIMIT),
      admin
        .from("contract_signals")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(CONTRACT_ACTIVITY_LIST_LIMIT),
      admin
        .from("contract_nudges")
        .select("*")
        .order("candidate_at", { ascending: false })
        .limit(CONTRACT_ACTIVITY_LIST_LIMIT),
      admin
        .from("projects")
        .select("project_id,project_name,status,slack_channel_id")
        .order("project_name", { ascending: true }),
    ]);

    const firstError = contractsRes.error || documentsRes.error || signalsRes.error || nudgesRes.error || projectsRes.error;
    if (firstError) throw firstError;

    return NextResponse.json({
      ok: true,
      contracts: contractsRes.data ?? [],
      documents: documentsRes.data ?? [],
      signals: signalsRes.data ?? [],
      nudges: nudgesRes.data ?? [],
      projects: projectsRes.data ?? [],
      driveDestination: {
        path: "共有ドライブ/ARMADA/a3_backoffice/契約",
        folderIdConfigured: Boolean(process.env.CONTRACTS_DRIVE_FOLDER_ID),
        folderIdEnv: "CONTRACTS_DRIVE_FOLDER_ID",
      },
      safety: {
        authority: "admin/backoffice/management only",
        slackWrite: "disabled: dry-run/review queue only",
        driveSharing: "no external sharing changes from PWA",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({
      ok: false,
      setupRequired: schemaError(error),
      error: message,
    }, { status: schemaError(error) ? 424 : 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = text(body.project_id ?? body.projectId, 80);
  const contractTitle = text(body.contract_title ?? body.contractTitle, 240);
  if (!projectId || !contractTitle) {
    return NextResponse.json({ ok: false, error: "project_id and contract_title are required" }, { status: 400 });
  }

  const rawStatus = text(body.status, 80) || "planned";
  const status = validStatus(rawStatus) ? rawStatus : "planned";
  const signalConfidence = numberOrNull(body.signal_confidence ?? body.signalConfidence);
  const nudgeAfterDays = Math.max(1, Math.min(120, Number(body.nudge_after_days ?? body.nudgeAfterDays ?? 14) || 14));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contracts")
    .insert({
      project_id: projectId,
      contract_title: contractTitle,
      counterparty_name: optionalText(body.counterparty_name ?? body.counterpartyName),
      contract_type: text(body.contract_type ?? body.contractType, 80) || "contract",
      status,
      expected_signing_date: optionalText(body.expected_signing_date ?? body.expectedSigningDate, 20),
      nudge_after_days: nudgeAfterDays,
      signal_confidence: signalConfidence,
      review_required: Boolean(body.review_required ?? body.reviewRequired ?? true),
      review_status: text(body.review_status ?? body.reviewStatus, 40) || "pending",
      source_summary: optionalText(body.source_summary ?? body.sourceSummary, 1000),
      source_refs_json: Array.isArray(body.source_refs_json ?? body.sourceRefsJson)
        ? body.source_refs_json ?? body.sourceRefsJson
        : [],
      drive_folder_id: optionalText(body.drive_folder_id ?? body.driveFolderId, 220),
      created_by: auth.user.email,
      updated_by: auth.user.email,
      last_activity_at: new Date().toISOString(),
      signed_at: status === "signed" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contract: data });
}
