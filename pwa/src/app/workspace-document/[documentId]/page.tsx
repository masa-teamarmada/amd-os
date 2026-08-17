import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceMarkdownReader } from "@/components/workspace-documents/WorkspaceMarkdownReader";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import {
  isWorkspaceDocumentMarkdown,
  WORKSPACE_DOCUMENT_MARKDOWN_PREVIEW_MAX_BYTES,
} from "@/lib/workspace-documents-core";
import {
  resolveDocumentRowAccess,
  WORKSPACE_DOCUMENT_FIELDS,
  type WorkspaceDocumentRow,
} from "@/lib/workspace-documents-server";
import { loadWorkspaceDocumentText } from "@/lib/workspace-document-text";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markdown資料 | AMD OS",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export default async function WorkspaceDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .eq("upload_status", "active")
    .maybeSingle();
  if (error) throw new Error(`workspace markdown lookup failed: ${error.message}`);
  if (!data) notFound();

  const row = data as unknown as WorkspaceDocumentRow;
  const access = await resolveDocumentRowAccess(db, row);
  if (!access || (row.visibility === "amd_internal" && !access.canReadInternal)) notFound();
  if ((row.entry_kind !== "file" && row.entry_kind !== "link") || !isWorkspaceDocumentMarkdown(row.mime_type, row.display_name)) notFound();

  const loaded = await loadWorkspaceDocumentText(db, row, WORKSPACE_DOCUMENT_MARKDOWN_PREVIEW_MAX_BYTES);
  if (!loaded.ok) {
    return (
      <main className="min-h-screen bg-[#f4f1ea] px-5 py-16 text-slate-900 sm:px-8">
        <section className="mx-auto max-w-3xl border border-slate-300 bg-white px-7 py-12 sm:px-12">
          <p className="text-xs font-bold tracking-[0.16em] text-blue-700">AMD OS / 資料室</p>
          <h1 className="mt-4 text-2xl font-bold">資料を表示できなかった</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">{loaded.error}</p>
        </section>
      </main>
    );
  }

  await recordWorkspaceAuditEvent(db, {
    eventType: "workspace_document_opened",
    userAccountId: access.accountId,
    email: access.accountId ? access.email : null,
    workspaceId: access.workspaceId,
    projectId: access.projectId,
    detail: { document_id: documentId, entry_kind: row.entry_kind, action: "render_markdown" },
  });

  return (
    <main className="min-h-screen bg-[#f4f1ea] px-4 py-8 text-slate-900 sm:px-8 sm:py-12">
      <article className="mx-auto max-w-4xl border border-slate-300 bg-white px-6 py-8 sm:px-12 sm:py-11 lg:px-16">
        <header className="mb-10 border-b border-slate-300 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold tracking-[0.16em] text-blue-700">AMD OS / 資料室</p>
            <p className="text-xs text-slate-500">{formatBytes(loaded.byteLength)}</p>
          </div>
          <h1 className="mt-4 break-words text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{row.display_name}</h1>
          <p className="mt-2 text-xs text-slate-500">更新 {formatDate(row.updated_at)}</p>
        </header>
        <WorkspaceMarkdownReader source={loaded.text} />
      </article>
    </main>
  );
}
