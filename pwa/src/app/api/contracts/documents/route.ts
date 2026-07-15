import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { CONTRACT_DOCUMENT_KINDS, type ContractDocumentKind } from "@/lib/contracts";

export const runtime = "nodejs";

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength = 240) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function validKind(value: string): value is ContractDocumentKind {
  return CONTRACT_DOCUMENT_KINDS.includes(value as ContractDocumentKind);
}

function driveFileIdFromLink(link: string) {
  const fromPath = link.match(/\/d\/([^/?#]+)/)?.[1];
  if (fromPath) return fromPath;
  const fromQuery = link.match(/[?&]id=([^&#]+)/)?.[1];
  if (fromQuery) return fromQuery;
  return "";
}

function fileNameFromLink(link: string) {
  try {
    const url = new URL(link);
    const segments = url.pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments.at(-1) || "contract-document");
  } catch {
    return "contract-document";
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

  const contractId = text(body.contract_id ?? body.contractId, 80);
  const webViewLink = text(body.web_view_link ?? body.webViewLink, 1000);
  const driveFileId = text(body.drive_file_id ?? body.driveFileId, 220) || driveFileIdFromLink(webViewLink);
  if (!contractId || !webViewLink || !driveFileId) {
    return NextResponse.json({ ok: false, error: "contract_id, web_view_link and drive_file_id are required" }, { status: 400 });
  }

  const rawKind = text(body.document_kind ?? body.documentKind, 80) || "revision";
  const documentKind = validKind(rawKind) ? rawKind : "other";
  const isLatest = Boolean(body.is_latest ?? body.isLatest ?? true);
  const admin = createAdminClient();

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .select("contract_id,project_id,status")
    .eq("contract_id", contractId)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ ok: false, error: contractError?.message || "contract not found" }, { status: 404 });
  }

  if (isLatest) {
    const { error: clearLatestError } = await admin
      .from("contract_documents")
      .update({ is_latest: false, updated_at: new Date().toISOString() })
      .eq("contract_id", contractId);
    if (clearLatestError) {
      return NextResponse.json({ ok: false, error: clearLatestError.message }, { status: 500 });
    }
  }

  const { data: document, error } = await admin
    .from("contract_documents")
    .insert({
      contract_id: contractId,
      project_id: contract.project_id,
      document_kind: documentKind,
      version_label: text(body.version_label ?? body.versionLabel, 80) || (documentKind === "signed" ? "signed" : "v1"),
      drive_file_id: driveFileId,
      drive_folder_id: optionalText(body.drive_folder_id ?? body.driveFolderId, 220),
      web_view_link: webViewLink,
      file_name: text(body.file_name ?? body.fileName, 240) || fileNameFromLink(webViewLink),
      mime_type: text(body.mime_type ?? body.mimeType, 160) || "application/octet-stream",
      file_size_bytes: Math.max(0, Number(body.file_size_bytes ?? body.fileSizeBytes) || 0),
      source_kind: text(body.source_kind ?? body.sourceKind, 80) || "manual_drive_link",
      received_at: optionalText(body.received_at ?? body.receivedAt, 40) || new Date().toISOString(),
      uploaded_by: auth.user.email,
      is_latest: isLatest,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (documentKind === "signed") {
    const { error: updateContractError } = await admin
      .from("contracts")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signed_document_id: document.document_id,
        review_required: false,
        review_status: "not_needed",
        updated_by: auth.user.email,
        last_activity_at: new Date().toISOString(),
      })
      .eq("contract_id", contractId);
    if (updateContractError) {
      return NextResponse.json({ ok: false, error: updateContractError.message }, { status: 500 });
    }
  } else if (isLatest) {
    const nextStatus = documentKind === "revision" || documentKind === "redline"
      ? "under_review"
      : documentKind === "draft" || contract.status === "planned"
        ? "drafting"
        : contract.status;
    await admin
      .from("contracts")
      .update({
        status: nextStatus,
        ...(nextStatus !== "signed" ? { signed_at: null, signed_document_id: null } : {}),
        updated_by: auth.user.email,
        last_activity_at: new Date().toISOString(),
      })
      .eq("contract_id", contractId);
  }

  return NextResponse.json({ ok: true, document });
}
