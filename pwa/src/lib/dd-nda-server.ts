import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DdViewerAccess } from "@/lib/dd-package-core";
import { DD_NDA_CONFIRMATION_VERSION, ddNdaPartyLabel, ddNdaPrompt } from "@/lib/dd-nda";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { DD_CONFIDENTIALITY_VERSION } from "@/lib/dd-confidentiality";

export type DdNdaContext = { partyLabel: string; prompt: string; promptHash: string; version: string };

/** 認可後だけ、現在の法人状態を読む。設立予定を契約相手へ昇格しない。 */
export async function loadDdNdaContext(access: DdViewerAccess): Promise<DdNdaContext> {
  const { data, error } = await createAdminClient().from("project_company_profiles").select("legal_status,legal_name").eq("project_id", access.projectId).maybeSingle<{ legal_status: string; legal_name: string | null }>();
  if (error) throw new Error("dd_nda_company_lookup_failed");
  const partyLabel = ddNdaPartyLabel(data), prompt = ddNdaPrompt(partyLabel);
  return { partyLabel, prompt, promptHash: createHash("sha256").update(prompt).digest("hex"), version: DD_NDA_CONFIRMATION_VERSION };
}
/** 個別DD認可後だけ呼ぶ。回答はユーザー×パッケージで一度。既存の監査記録も使う。 */
export async function hasDdNdaConfirmation(access: DdViewerAccess): Promise<boolean> {
  let query = createAdminClient().from("workspace_access_audit_logs")
    .select("id")
    .eq("event_type", "dd_nda_confirmed")
    .eq("project_id", access.projectId)
    .contains("detail", { package_id: access.packageId, answer: "yes" });
  query = access.principal === "workspace_account"
    ? query.eq("user_account_id", access.accountId)
    : query.is("user_account_id", null).contains("detail", { actor_member_id: access.memberId });
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error("dd_nda_confirmation_lookup_failed");
  return Boolean(data);
}
export async function recordDdNdaConfirmation(access: DdViewerAccess, context: DdNdaContext): Promise<void> {
  await recordWorkspaceAuditEvent(createAdminClient(), {
    eventType: "dd_nda_confirmed",
    userAccountId: access.principal === "workspace_account" ? access.accountId : null,
    email: access.email,
    projectId: access.projectId,
    detail: {
      package_id: access.packageId,
      grant_id: access.principal === "workspace_account" ? access.grantId : null,
      actor_member_id: access.principal === "workspace_account" ? null : access.memberId,
      actor_kind: access.principal,
      answer: "yes",
      confirmation_version: context.version,
      prompt_hash: context.promptHash,
      nda_party_label: context.partyLabel,
      notice_version: DD_CONFIDENTIALITY_VERSION,
    },
  });
}
