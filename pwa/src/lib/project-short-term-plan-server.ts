import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKSPACE_DOCUMENT_FIELDS, type WorkspaceDocumentRow } from "./workspace-documents-server";
import { loadWorkspaceDocumentText } from "./workspace-document-text";
import { isUuid } from "./dd-package-core";
import { createDdReferenceCache } from "./dd-reference-cache";
const planHtmlCache = createDdReferenceCache<string>({ ttlMs: 5 * 60_000, maxEntries: 32 });
type PlanKind = "short_term" | "long_term";
async function loadPlanDocument(db: SupabaseClient, projectId: string, kind: PlanKind) {
  const label = kind === "short_term" ? "短期計画" : "長期計画";
  const config = await db.from("project_config").select("value").eq("project_id", projectId).eq("key", `${kind}_plan_document_id`).maybeSingle();
  if (config.error) throw new Error(`${label}の参照を読み込めなかった`);
  if (!config.data?.value) return null;
  if (!isUuid(config.data.value)) throw new Error(`${label}の参照が正しくない`);
  const document = await db.from("workspace_documents").select(WORKSPACE_DOCUMENT_FIELDS).eq("project_id", projectId).eq("document_id", config.data.value).eq("scope_kind", "project").eq("upload_status", "active").maybeSingle();
  const row = document.data as unknown as WorkspaceDocumentRow | null;
  if (document.error || !row || row.mime_type !== "text/html") throw new Error(`${label}の資料を確認できない`);
  return row;
}
async function loadPlanHtml(db: SupabaseClient, projectId: string, kind: PlanKind) {
  const label = kind === "short_term" ? "短期計画" : "長期計画";
  const document = await loadPlanDocument(db, projectId, kind);
  if (!document) return null;
  // 参照先・PJ・有効状態は毎回検証し、同じ資料版の本文取得だけをまとめる。
  const key = JSON.stringify([projectId, kind, document.document_id, document.updated_at, document.content_sha256, document.storage_bucket, document.storage_path, document.source_ref, document.external_url]);
  return planHtmlCache.load(key, async () => {
    const loaded = await loadWorkspaceDocumentText(db, document, 5 * 1024 * 1024);
    if (!loaded.ok) throw new Error(`${label}の本文を読み込めなかった`);
    // 原本の全社実施計画（静的SVGガント）を使い、DD内の冒頭余白だけ調整する。
    const section = loaded.text.match(/<section\b[^>]*\bid=["']work["'][^>]*>[\s\S]*?<\/section>/i)?.[0];
    if (!section) throw new Error(`${label}のガントを確認できない`);
    const styles = loaded.text.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi)?.join("\n") ?? "";
    const ddLayout = `<style>@media screen { body[data-dd-plan] > main { padding: 8px 12px 24px; } body[data-dd-plan] > main > #work { margin-top: 0; } }</style>`;
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}${ddLayout}</head><body data-dd-plan><main>${section}</main></body></html>`;
  });
}

export const loadShortTermPlanDocument = (db: SupabaseClient, projectId: string) => loadPlanDocument(db, projectId, "short_term");
export const loadLongTermPlanDocument = (db: SupabaseClient, projectId: string) => loadPlanDocument(db, projectId, "long_term");
export const loadShortTermPlanHtml = (db: SupabaseClient, projectId: string) => loadPlanHtml(db, projectId, "short_term");
export const loadLongTermPlanHtml = (db: SupabaseClient, projectId: string) => loadPlanHtml(db, projectId, "long_term");
