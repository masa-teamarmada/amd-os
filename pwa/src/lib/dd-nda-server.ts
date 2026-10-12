import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DdViewerAccess } from "@/lib/dd-package-core";
import { DD_NDA_CONFIRMATION_VERSION, ddNdaPartyLabel, ddNdaPrompt } from "@/lib/dd-nda";
import { signDdNdaSession, verifyDdNdaSession, type DdNdaSessionScope } from "@/lib/dd-nda-session-core";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { DD_CONFIDENTIALITY_VERSION } from "@/lib/dd-confidentiality";

export type DdNdaContext = { partyLabel: string; prompt: string; promptHash: string; version: string };
export const ddNdaCookieName = (access: DdViewerAccess) => `amd_os_dd_nda_${access.packageId}`;
const actor = (access: DdViewerAccess) => access.principal === "workspace_account" ? `account:${access.accountId}:${access.grantId}` : `member:${access.memberId}`;
function secret(): string {
  const value = process.env.WORKSPACE_SESSION_SECRET;
  if (!value) throw new Error("dd_nda_secret_missing");
  return value;
}
const scope = (access: DdViewerAccess, context: DdNdaContext): DdNdaSessionScope => ({ actor: actor(access), packageId: access.packageId, promptHash: context.promptHash, version: context.version });

/** 認可後だけ、現在の法人状態を読む。設立予定を契約相手へ昇格しない。 */
export async function loadDdNdaContext(access: DdViewerAccess): Promise<DdNdaContext> {
  const { data, error } = await createAdminClient().from("project_company_profiles").select("legal_status,legal_name").eq("project_id", access.projectId).maybeSingle<{ legal_status: string; legal_name: string | null }>();
  if (error) throw new Error("dd_nda_company_lookup_failed");
  const partyLabel = ddNdaPartyLabel(data), prompt = ddNdaPrompt(partyLabel);
  return { partyLabel, prompt, promptHash: createHash("sha256").update(prompt).digest("hex"), version: DD_NDA_CONFIRMATION_VERSION };
}
export async function hasDdNdaConfirmation(access: DdViewerAccess, context?: DdNdaContext): Promise<boolean> {
  const current = context ?? await loadDdNdaContext(access);
  const jar = await cookies();
  return verifyDdNdaSession(jar.get(ddNdaCookieName(access))?.value, scope(access, current), secret());
}
export function createDdNdaSession(access: DdViewerAccess, context: DdNdaContext): string {
  return signDdNdaSession(scope(access, context), secret());
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
