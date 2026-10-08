"use client";
import { useMemo } from "react";
import { WorkspaceDocumentRoom, type DocumentItem } from "@/components/workspace-documents/WorkspaceDocumentRoom";
import type { DdViewItem } from "@/lib/dd-package-server";

/** ファイルの開示範囲と配送先だけをDDの認可に合わせ、ドライブ画面は共用する。 */
export function DdDocumentsPage({ projectId, projectName, slug, items, canDownload }: { projectId: string; projectName: string; slug: string; items: DdViewItem[]; canDownload: boolean }) {
  const documents = useMemo<DocumentItem[]>(() => items.flatMap(item => {
    if (item.live?.kind !== "document") return [];
    const href = `/dd/${encodeURIComponent(slug)}/items/${item.itemId}/file`;
    return [{ documentId: item.itemId, entryKind: "file", visibility: "workspace_shared", folderPath: "", displayName: item.live.fileName,
      mimeType: item.live.mimeType, fileSizeBytes: item.live.sizeBytes, sourceKind: "dd", createdAt: item.sourceAsOf ?? "", updatedAt: item.sourceAsOf ?? "", viewHref: href, downloadHref: `${href}?download=1` }];
  }), [items, slug]);
  return <><p className="mb-2 text-xs leading-5 text-[#6e6e73]">ダウンロードは原本と開示通知をまとめたZIPで受け取る。</p><WorkspaceDocumentRoom scopeKind="project" scopeId={projectId} scopeName={projectName} surface="workspace" presentation="modal" initialDocuments={documents} canDownload={canDownload} /></>;
}
