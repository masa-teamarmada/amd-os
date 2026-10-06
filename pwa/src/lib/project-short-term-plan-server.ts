import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKSPACE_DOCUMENT_FIELDS, type WorkspaceDocumentRow } from "./workspace-documents-server";
import { loadWorkspaceDocumentText } from "./workspace-document-text";
import { isUuid } from "./dd-package-core";
export async function loadShortTermPlanDocument(db: SupabaseClient, projectId: string) {
  const config = await db.from("project_config").select("value").eq("project_id", projectId).eq("key", "short_term_plan_document_id").maybeSingle();
  if (config.error) throw new Error("短期計画の参照を読み込めなかった");
  if (!config.data?.value) return null;
  if (!isUuid(config.data.value)) throw new Error("短期計画の参照が正しくない");
  const document = await db.from("workspace_documents").select(WORKSPACE_DOCUMENT_FIELDS).eq("project_id", projectId).eq("document_id", config.data.value).eq("scope_kind", "project").eq("upload_status", "active").maybeSingle();
  const row = document.data as unknown as WorkspaceDocumentRow | null;
  if (document.error || !row || row.mime_type !== "text/html") throw new Error("短期計画の資料を確認できない");
  return row;
}
export async function loadShortTermPlanHtml(db: SupabaseClient, projectId: string) {
  const document = await loadShortTermPlanDocument(db, projectId);
  if (!document) return null;
  const loaded = await loadWorkspaceDocumentText(db, document, 5 * 1024 * 1024);
  if (!loaded.ok) throw new Error("短期計画の本文を読み込めなかった");
  // 原本の全社実施計画（静的SVGガント）とスタイルをそのまま使う。
  const section = loaded.text.match(/<section\b[^>]*\bid=["']work["'][^>]*>[\s\S]*?<\/section>/i)?.[0];
  if (!section) throw new Error("短期計画のガントを確認できない");
  const styles = loaded.text.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi)?.join("\n") ?? "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><main>${section}</main></body></html>`;
}
