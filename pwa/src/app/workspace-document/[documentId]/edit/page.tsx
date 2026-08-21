import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkspaceDocumentEditorWorkbench } from "@/components/workspace-documents/WorkspaceDocumentEditorWorkbench";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import { loadEditableWorkspaceHtmlDocument } from "@/lib/workspace-document-editing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HTML資料を編集 | AMD OS",
};

/**
 * 戻り導線に使う相対パスだけを通す。
 *
 * `from` は資料室が付ける自分のパスだが、URLは誰でも書き換えられるので、
 * ここを素通しにすると外部サイトへ飛ばす踏み台になる。
 * `/` 始まりかつ `//`・`/\` 非始まりに限れば、必ず同一オリジン内に留まる。
 */
function safeBackHref(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw) return undefined;
  if (!raw.startsWith("/")) return undefined;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return undefined;
  return raw;
}

function EditorError({ message }: { message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f1ea] px-5 py-16 text-slate-900">
      <section className="w-full max-w-xl border border-slate-300 bg-white px-7 py-12 sm:px-12">
        <p className="text-xs font-bold tracking-[0.16em] text-blue-700">AMD OS / 資料室</p>
        <h1 className="mt-4 text-2xl font-bold">この資料は編集できない</h1>
        <p className="mt-4 text-base leading-8 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function WorkspaceDocumentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { documentId } = await params;
  const query = await searchParams;

  const loaded = await loadEditableWorkspaceHtmlDocument(documentId);
  if (!loaded.ok) {
    if (loaded.status === 404) notFound();
    return <EditorError message={loaded.error} />;
  }

  await recordWorkspaceAuditEvent(loaded.db, {
    eventType: "workspace_document_opened",
    userAccountId: loaded.access.accountId,
    email: loaded.access.accountId ? loaded.access.email : null,
    workspaceId: loaded.access.workspaceId,
    projectId: loaded.access.projectId,
    detail: { document_id: documentId, entry_kind: loaded.row.entry_kind, action: "open_editor" },
  });

  return (
    <WorkspaceDocumentEditorWorkbench
      documentId={documentId}
      displayName={loaded.row.display_name}
      backHref={safeBackHref(query.from)}
    />
  );
}
