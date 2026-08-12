import { createHash } from "node:crypto";

export const VERIFIED_ORIGINAL_SOURCE_TABLE = "verified_contract_original";

export type VerifiedOriginalExpenseCandidateInput = {
  projectId: string;
  sourceId: string;
  sourceUrl: string;
  sourceTitle: string;
  contractTitle?: string | null;
  counterpartyName?: string | null;
  expenseReimbursementAllowed: boolean;
  expenseReimbursementNote: string;
  executionEvidence: string;
};

export type VerifiedOriginalExpenseCandidate = {
  project_id: string;
  source_kind: "drive";
  source_table: typeof VERIFIED_ORIGINAL_SOURCE_TABLE;
  source_id: string;
  source_term_hash: string;
  source_url: string;
  source_title: string;
  contract_title: string | null;
  counterparty_name: string | null;
  currency: "JPY";
  billing_distribution: "review_required";
  billing_distribution_json: Record<string, never>;
  fee_type_hint: "unknown";
  confidence: 1;
  review_required: true;
  review_status: "pending";
  status: "candidate";
  source_refs_json: Array<Record<string, string>>;
  extracted_terms_json: {
    expense_reimbursement_allowed: boolean;
    expense_reimbursement_note: string;
  };
  created_by: string;
  updated_by: string;
};

function compactText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function driveFileIdFromUrl(url: string) {
  return url.match(/\/d\/([^/]+)/)?.[1] || new URL(url).searchParams.get("id") || "";
}

export function buildVerifiedOriginalExpenseCandidate(
  input: VerifiedOriginalExpenseCandidateInput,
  actor: string,
): VerifiedOriginalExpenseCandidate {
  const projectId = compactText(input.projectId, 80);
  const sourceId = compactText(input.sourceId, 220);
  const sourceUrl = compactText(input.sourceUrl, 1000);
  const sourceTitle = compactText(input.sourceTitle, 240);
  const contractTitle = compactText(input.contractTitle, 240) || null;
  const counterpartyName = compactText(input.counterpartyName, 240) || null;
  const note = compactText(input.expenseReimbursementNote, 1000);
  const executionEvidence = compactText(input.executionEvidence, 500);
  const normalizedActor = compactText(actor, 240) || "admin";

  if (!projectId || !sourceId || !sourceUrl || !sourceTitle || !note || !executionEvidence) {
    throw new Error("projectId, sourceId, sourceUrl, sourceTitle, expenseReimbursementNote, executionEvidence are required");
  }
  if (typeof input.expenseReimbursementAllowed !== "boolean") {
    throw new Error("expenseReimbursementAllowed must be boolean");
  }
  let driveFileId = "";
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(parsed.hostname)) {
      throw new Error("sourceUrl must be a Google Drive URL");
    }
    driveFileId = driveFileIdFromUrl(sourceUrl);
  } catch {
    throw new Error("sourceUrl must be a Google Drive URL");
  }
  if (!driveFileId || driveFileId !== sourceId) {
    throw new Error("sourceId must match the Google Drive URL");
  }

  const canonical = JSON.stringify({
    projectId,
    sourceId,
    expenseReimbursementAllowed: input.expenseReimbursementAllowed,
    expenseReimbursementNote: note,
  });
  const sourceTermHash = createHash("sha256").update(canonical).digest("hex");

  return {
    project_id: projectId,
    source_kind: "drive",
    source_table: VERIFIED_ORIGINAL_SOURCE_TABLE,
    source_id: sourceId,
    source_term_hash: sourceTermHash,
    source_url: sourceUrl,
    source_title: sourceTitle,
    contract_title: contractTitle,
    counterparty_name: counterpartyName,
    currency: "JPY",
    billing_distribution: "review_required",
    billing_distribution_json: {},
    fee_type_hint: "unknown",
    confidence: 1,
    review_required: true,
    review_status: "pending",
    status: "candidate",
    source_refs_json: [{
      source_kind: "drive",
      source_id: sourceId,
      source_title: sourceTitle,
      source_url: sourceUrl,
      document_kind: "signed",
      execution_evidence: executionEvidence,
    }],
    extracted_terms_json: {
      expense_reimbursement_allowed: input.expenseReimbursementAllowed,
      expense_reimbursement_note: note,
    },
    created_by: normalizedActor,
    updated_by: normalizedActor,
  };
}

export type ContractTermReviewDecision = "approved" | "rejected";

export function contractTermReviewPatch(decision: ContractTermReviewDecision, actor: string, now: string) {
  const normalizedActor = compactText(actor, 240) || "admin";
  if (decision === "approved") {
    return {
      status: "applied",
      review_status: "applied",
      review_required: false,
      updated_by: normalizedActor,
      updated_at: now,
    } as const;
  }
  return {
    status: "rejected",
    review_status: "rejected",
    review_required: false,
    updated_by: normalizedActor,
    updated_at: now,
  } as const;
}
