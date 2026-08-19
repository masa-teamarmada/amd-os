"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Link2,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  externalWorkspaceRoleCapabilityLabel,
  type ExternalWorkspaceRole,
} from "@/lib/workspace-capabilities";
import {
  isWorkspaceDocumentHtml,
  isWorkspaceDocumentMarkdown,
  documentBaseName,
  WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES,
  workspaceDocumentFinderCopyName,
  workspaceDocumentHtmlSourceByteLength,
  workspaceDocumentNameKey,
  workspaceDocumentPdfDownloadName,
} from "@/lib/workspace-documents-core";
import type {
  WorkspaceDocumentEntryKind,
  WorkspaceDocumentScopeKind,
  WorkspaceDocumentVisibility,
} from "@/lib/workspace-documents-core";
import styles from "./workspace-document-room.module.css";

type DocumentItem = {
  documentId: string;
  entryKind: WorkspaceDocumentEntryKind;
  visibility: WorkspaceDocumentVisibility;
  folderPath: string;
  displayName: string;
  mimeType: string;
  fileSizeBytes: number;
  sourceKind: string;
  createdAt: string;
  updatedAt: string;
};

type Permissions = {
  principal: "internal_member" | "workspace_account";
  role: string;
  canReadInternal: boolean;
  canUpload: boolean;
  canManage: boolean;
};

type ListResponse = {
  ok?: boolean;
  documents?: DocumentItem[];
  permissions?: Permissions;
  error?: string;
};

type DialogKind =
  "create_folder" | "create_link" | "edit_html" | "organize" | "archive" | "upload_conflict" | null;

type UploadQueueItem = {
  file: File;
  displayName: string;
  conflict: DocumentItem | "queued" | null;
  replaceDocumentId: string | null;
};

const kindOrder: Record<WorkspaceDocumentEntryKind, number> = {
  folder: 0,
  file: 1,
  link: 2,
};

type WorkspaceDocumentSurface = "cockpit" | "workspace";

function apiUrl(
  scopeKind: WorkspaceDocumentScopeKind,
  scopeId: string,
  surface: WorkspaceDocumentSurface,
) {
  return `/api/workspace-documents?scope_kind=${encodeURIComponent(scopeKind)}&scope_id=${encodeURIComponent(scopeId)}&surface=${surface}`;
}

function fullPath(item: DocumentItem) {
  return item.folderPath
    ? `${item.folderPath}/${item.displayName}`
    : item.displayName;
}

function workspaceDocumentViewHref(item: DocumentItem) {
  const encodedId = encodeURIComponent(item.documentId);
  if (isWorkspaceDocumentHtml(item.mimeType, item.displayName)) {
    return `/api/workspace-documents/${encodedId}/render`;
  }
  if (isWorkspaceDocumentMarkdown(item.mimeType, item.displayName)) {
    return `/workspace-document/${encodedId}`;
  }
  return `/api/workspace-documents/${encodedId}/open?download=0`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新日不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function permissionRoleLabel(role: string) {
  if (["manager", "contributor", "readonly", "owner", "member"].includes(role)) {
    return externalWorkspaceRoleCapabilityLabel(role as ExternalWorkspaceRole);
  }
  return role;
}

function EntryIcon({ item }: { item: DocumentItem }) {
  if (item.entryKind === "folder")
    return (
      <Folder
        className={cn(
          "h-5 w-5",
          item.visibility === "amd_internal"
            ? styles.internalFolderIcon
            : "text-blue-700",
        )}
        aria-hidden
      />
    );
  if (item.entryKind === "link")
    return <Link2 className="h-5 w-5 text-cyan-700" aria-hidden />;
  if (item.mimeType.startsWith("image/"))
    return <FileImage className="h-5 w-5 text-sky-700" aria-hidden />;
  if (item.mimeType.includes("pdf") || item.mimeType.startsWith("text/"))
    return <FileText className="h-5 w-5 text-blue-900" aria-hidden />;
  return <File className="h-5 w-5 text-slate-600" aria-hidden />;
}

function VisibilityBadge({
  visibility,
  entryKind,
}: {
  visibility: WorkspaceDocumentVisibility;
  entryKind: WorkspaceDocumentEntryKind;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        visibility === "workspace_shared"
          ? styles.sharedBadge
          : styles.internalBadge,
      )}
    >
      {visibility === "workspace_shared"
        ? entryKind === "folder"
          ? "PJ全体"
          : "外部共有"
        : "AMD内部"}
    </span>
  );
}

export function WorkspaceDocumentRoom({
  scopeKind,
  scopeId,
  scopeName,
  scopeTrail,
  returnHref,
  returnLabel = "概要へ戻る",
  presentation = "page",
  surface = "cockpit",
}: {
  scopeKind: WorkspaceDocumentScopeKind;
  scopeId: string;
  scopeName: string;
  scopeTrail?: string[];
  returnHref?: string;
  returnLabel?: string;
  presentation?: "page" | "modal";
  /** workspace面ではAMD内部資料を一覧へ出さず、共有範囲を操作させない。 */
  surface?: WorkspaceDocumentSurface;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [breadcrumbDropPath, setBreadcrumbDropPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftFolderPath, setDraftFolderPath] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<WorkspaceDocumentVisibility>("workspace_shared");
  const [draftHtmlSource, setDraftHtmlSource] = useState("");
  const [htmlSourceLoading, setHtmlSourceLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[] | null>(null);
  const [uploadConflictIndex, setUploadConflictIndex] = useState<number | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(scopeKind, scopeId, surface), {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as ListResponse;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || `HTTP ${response.status}`);
      setDocuments(payload.documents ?? []);
      setPermissions(payload.permissions ?? null);
    } catch (cause) {
      setDocuments([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "資料一覧を読み込めなかったよ。",
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId, scopeKind, surface]);

  // workspace面は、内部memberであっても公開済みのPJ共有資料だけを扱う。
  // cockpit面だけがAMD内部の共有範囲を管理できる。
  const canManageVisibility = surface === "cockpit" && Boolean(permissions?.canReadInternal);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const folders = useMemo(
    () =>
      documents
        .filter((item) => item.entryKind === "folder")
        .map(fullPath)
        .sort((a, b) => a.localeCompare(b, "ja")),
    [documents],
  );

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ja");
    return documents
      .filter((item) =>
        normalizedQuery
          ? fullPath(item).toLocaleLowerCase("ja").includes(normalizedQuery)
          : item.folderPath === currentFolder,
      )
      .sort(
        (a, b) =>
          kindOrder[a.entryKind] - kindOrder[b.entryKind] ||
          a.displayName.localeCompare(b.displayName, "ja"),
      );
  }, [currentFolder, documents, query]);

  const counts = useMemo(
    () => ({
      all: documents.length,
      shared: documents.filter((item) => item.visibility === "workspace_shared")
        .length,
      internal: documents.filter((item) => item.visibility === "amd_internal")
        .length,
    }),
    [documents],
  );
  const draftHtmlByteLength = useMemo(
    () => workspaceDocumentHtmlSourceByteLength(draftHtmlSource),
    [draftHtmlSource],
  );

  const breadcrumbs = currentFolder ? currentFolder.split("/") : [];
  const ownerTrail = scopeTrail?.length ? scopeTrail : [scopeName];

  function eligibleMoveTarget(path: string) {
    if (!selected || selected.entryKind !== "folder") return true;
    const selectedPath = fullPath(selected);
    return path !== selectedPath && !path.startsWith(`${selectedPath}/`);
  }

  function openDialog(
    kind: Exclude<DialogKind, null>,
    item: DocumentItem | null = null,
  ) {
    setSelected(item);
    setDialog(kind);
    setDraftName(item?.displayName ?? "");
    setDraftUrl("");
    setDraftFolderPath(item?.folderPath ?? currentFolder);
    setDraftVisibility(item?.visibility ?? "workspace_shared");
    setError(null);
    setNotice(null);
  }

  async function moveEntryToFolder(item: DocumentItem, destinationPath: string) {
    if (!permissions?.canManage || busy) return;
    if (item.folderPath === destinationPath) {
      setNotice(`${item.displayName} はすでにこの場所にあるよ。`);
      return;
    }
    if (item.entryKind === "folder" && !eligibleMoveTarget(destinationPath)) {
      setError("フォルダは自分自身または配下へ移動できないよ。");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(item.documentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "organize",
            displayName: item.displayName,
            folderPath: destinationPath,
            visibility: item.visibility,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "資料を移動できなかったよ。");
      }
      setNotice(
        destinationPath
          ? `${item.displayName} を「${documentBaseName(destinationPath)}」へ移動したよ。`
          : `${item.displayName} を資料直下へ移動したよ。`,
      );
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "資料を移動できなかったよ。");
    } finally {
      setBusy(false);
      setDraggedDocumentId(null);
      setBreadcrumbDropPath(null);
    }
  }

  function startEntryDrag(event: DragEvent<HTMLElement>, item: DocumentItem) {
    if (!permissions?.canManage || busy) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-amd-workspace-document", item.documentId);
    event.dataTransfer.setData("text/plain", item.displayName);
    setDraggedDocumentId(item.documentId);
    setError(null);
    setNotice(null);
  }

  function allowBreadcrumbDrop(event: DragEvent<HTMLElement>, destinationPath: string) {
    if (!permissions?.canManage || !draggedDocumentId || busy) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setBreadcrumbDropPath(destinationPath);
  }

  function finishBreadcrumbDrop(event: DragEvent<HTMLElement>, destinationPath: string) {
    event.preventDefault();
    const documentId = event.dataTransfer.getData("application/x-amd-workspace-document") || draggedDocumentId;
    const item = documents.find((candidate) => candidate.documentId === documentId);
    setBreadcrumbDropPath(null);
    if (item) void moveEntryToFolder(item, destinationPath);
  }

  async function openHtmlEditor(item: DocumentItem) {
    if (busy) return;
    setSelected(item);
    setDraftHtmlSource("");
    setDialog("edit_html");
    setError(null);
    setHtmlSourceLoading(true);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(item.documentId)}/source`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        source?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || typeof payload.source !== "string") {
        throw new Error(payload.error || "HTML資料を読み込めなかったよ。");
      }
      setDraftHtmlSource(payload.source);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "HTML資料を読み込めなかったよ。",
      );
      setDialog(null);
    } finally {
      setHtmlSourceLoading(false);
    }
  }

  async function createEntry(event: FormEvent) {
    event.preventDefault();
    if (dialog !== "create_folder" && dialog !== "create_link") return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(scopeKind, scopeId, surface), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dialog,
          displayName: draftName,
          folderPath: currentFolder,
          visibility: draftVisibility,
          ...(dialog === "create_link" ? { externalUrl: draftUrl } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || `HTTP ${response.status}`);
      setDialog(null);
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "追加できなかったよ。");
    } finally {
      setBusy(false);
    }
  }

  async function downloadHtmlAsPdf(item: DocumentItem) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(item.documentId)}/pdf`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        downloadUrl?: string;
        fileName?: string;
      };
      if (!response.ok || !payload.ok || !payload.downloadUrl) {
        throw new Error(payload.error || "PDFを生成できなかったよ。");
      }
      // 署名URL(Supabase Storage)がContent-Dispositionを既に設定するので、
      // blob/objectURL変換はせず直接遷移させる。
      const link = document.createElement("a");
      link.href = payload.downloadUrl;
      link.download = payload.fileName || workspaceDocumentPdfDownloadName(item.displayName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "PDFを生成できなかったよ。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadQueuedFiles(queue: UploadQueueItem[]) {
    if (!permissions?.canUpload || busy || queue.some((item) => item.conflict)) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const item of queue) {
        const { file } = item;
        const prepareResponse = await fetch(apiUrl(scopeKind, scopeId, surface), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_upload",
            displayName: item.displayName,
            folderPath: currentFolder,
            visibility: draftVisibility,
            fileSizeBytes: file.size,
            mimeType: file.type || "application/octet-stream",
            ...(item.replaceDocumentId
              ? { replaceDocumentId: item.replaceDocumentId }
              : {}),
          }),
        });
        const prepared = (await prepareResponse.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          documentId?: string;
          storagePath?: string;
          uploadToken?: string;
          mimeType?: string;
          isReplacement?: boolean;
        };
        if (
          !prepareResponse.ok ||
          !prepared.ok ||
          !prepared.documentId ||
          !prepared.storagePath ||
          !prepared.uploadToken
        ) {
          throw new Error(
            prepared.error || `${file.name} の準備に失敗したよ。`,
          );
        }

        const { error: uploadError } = await supabase.storage
          .from("workspace-files")
          .uploadToSignedUrl(prepared.storagePath, prepared.uploadToken, file, {
            contentType:
              prepared.mimeType || file.type || "application/octet-stream",
            upsert: prepared.isReplacement === true,
          });
        if (uploadError) {
          if (!prepared.isReplacement) {
            await fetch(
              `/api/workspace-documents/${encodeURIComponent(prepared.documentId)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "fail_upload" }),
              },
            ).catch(() => undefined);
          }
          throw new Error(`${file.name}: ${uploadError.message}`);
        }

        const completeResponse = await fetch(
          `/api/workspace-documents/${encodeURIComponent(prepared.documentId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: prepared.isReplacement ? "complete_replace" : "complete_upload",
              ...(prepared.isReplacement ? { mimeType: prepared.mimeType } : {}),
            }),
          },
        );
        const completed = (await completeResponse.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!completeResponse.ok || !completed.ok)
          throw new Error(
            completed.error || `${file.name} を確定できなかったよ。`,
          );
      }
      if (inputRef.current) inputRef.current.value = "";
      await loadDocuments();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "アップロードできなかったよ。",
      );
    } finally {
      setBusy(false);
      setUploadQueue(null);
      setUploadConflictIndex(null);
    }
  }

  function uploadFiles(files: File[]) {
    if (!permissions?.canUpload || busy || files.length === 0) return;
    setError(null);
    const occupied = new Map<string, DocumentItem | "queued">(
      documents
        .filter((item) => item.folderPath === currentFolder)
        .map((item) => [workspaceDocumentNameKey(item.displayName), item]),
    );
    const queue = files.map<UploadQueueItem>((file) => {
      const nameKey = workspaceDocumentNameKey(file.name);
      const conflict = occupied.get(nameKey) ?? null;
      if (!conflict) occupied.set(nameKey, "queued");
      return {
        file,
        displayName: file.name,
        conflict,
        replaceDocumentId: null,
      };
    });
    const firstConflictIndex = queue.findIndex((item) => item.conflict !== null);
    setUploadQueue(queue);
    if (firstConflictIndex >= 0) {
      setUploadConflictIndex(firstConflictIndex);
      setDialog("upload_conflict");
      return;
    }
    void uploadQueuedFiles(queue);
  }

  function cancelQueuedUpload() {
    if (busy) return;
    setDialog(null);
    setUploadQueue(null);
    setUploadConflictIndex(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function decideDuplicateUpload(choice: "keep_both" | "replace") {
    if (!uploadQueue || uploadConflictIndex == null || busy) return;
    const current = uploadQueue[uploadConflictIndex];
    if (!current || !current.conflict) return;
    const existing = current.conflict === "queued" ? null : current.conflict;
    if (choice === "replace" && (!existing || existing.entryKind !== "file")) {
      setError(existing
        ? "同名のリンクやフォルダは、ファイルで置き換えられないよ。両方残すか中止してね。"
        : "同時に追加する資料どうしは置き換えられないよ。両方残すか中止してね。");
      return;
    }

    const next = uploadQueue.map((item, index) => {
      if (index !== uploadConflictIndex) return item;
      if (choice === "replace") {
        return { ...item, conflict: null, replaceDocumentId: existing!.documentId };
      }
      const occupiedNameKeys = new Set([
        ...documents
          .filter((document) => document.folderPath === currentFolder)
          .map((document) => workspaceDocumentNameKey(document.displayName)),
        ...uploadQueue
          .filter((_, queueIndex) => queueIndex !== uploadConflictIndex)
          .map((queueItem) => workspaceDocumentNameKey(queueItem.displayName)),
      ]);
      return {
        ...item,
        displayName: workspaceDocumentFinderCopyName(item.file.name, occupiedNameKeys),
        conflict: null,
      };
    });
    const nextConflictIndex = next.findIndex((item) => item.conflict !== null);
    setUploadQueue(next);
    setError(null);
    if (nextConflictIndex >= 0) {
      setUploadConflictIndex(nextConflictIndex);
      return;
    }
    setDialog(null);
    setUploadConflictIndex(null);
    void uploadQueuedFiles(next);
  }

  async function organizeEntry(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(selected.documentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "organize",
            displayName: draftName,
            folderPath: draftFolderPath,
            visibility: draftVisibility,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "資料を整理できなかったよ。");
      setDialog(null);
      await loadDocuments();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "資料を整理できなかったよ。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveHtmlSource(event: FormEvent) {
    event.preventDefault();
    if (!selected || dialog !== "edit_html") return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(selected.documentId)}/source`,
        {
          method: "PUT",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: draftHtmlSource,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "HTML資料を保存できなかったよ。");
      }
      setDialog(null);
      await loadDocuments();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "HTML資料を保存できなかったよ。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function archiveEntry() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(selected.documentId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "資料室から削除できなかったよ。");
      setDialog(null);
      await loadDocuments();
    } catch (cause) {
      setError(
          cause instanceof Error
            ? cause.message
            : "資料室から削除できなかったよ。",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  const activeUploadConflict = uploadQueue && uploadConflictIndex != null
    ? uploadQueue[uploadConflictIndex] ?? null
    : null;
  const conflictDocument = activeUploadConflict?.conflict && activeUploadConflict.conflict !== "queued"
    ? activeUploadConflict.conflict
    : null;
  const canReplaceConflict = conflictDocument?.entryKind === "file";
  const isModal = presentation === "modal";

  return (
    <div
      className={cn(
        styles.room,
        isModal ? styles.modalRoom : cn(styles.pageShell, "pb-24 sm:pb-10"),
      )}
    >
      {!isModal && (
        <header
          className={cn(
            styles.pageHeader,
            "sticky top-0 z-30 px-4 py-3 sm:px-6",
          )}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-cyan-200">
                AMD OS / 資料室
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-white">
                {scopeName}
              </h1>
            </div>
            <Link
              href={returnHref ?? "/dashboard"}
              className={cn(
                styles.secondaryAction,
                "inline-flex items-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              )}
            >
              {returnLabel}
            </Link>
          </div>
        </header>
      )}

      <main
        className={cn(
          "mx-auto max-w-6xl",
          isModal
            ? "space-y-2 p-3 sm:p-4"
            : "space-y-4 px-4 py-6 sm:px-6 sm:py-8",
        )}
      >
        <section
          className={cn(
            styles.scopeRail,
            scopeKind === "institution"
              ? styles.scopeBandInstitution
              : styles.scopeBandProject,
            "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-3 py-1.5",
          )}
          aria-label="資料の所属と共有範囲"
        >
          <nav
            className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-slate-600"
            aria-label="所属と現在のフォルダ"
          >
            {ownerTrail.map((label, index) => (
              <span key={`${label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
                <span className="truncate">{label}</span>
              </span>
            ))}
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            <button
              type="button"
              onClick={() => {
                setCurrentFolder("");
                setQuery("");
              }}
              onDragOver={(event) => allowBreadcrumbDrop(event, "")}
              onDragLeave={() => setBreadcrumbDropPath((path) => path === "" ? null : path)}
              onDrop={(event) => finishBreadcrumbDrop(event, "")}
              className={cn(
                "min-h-11 shrink-0 rounded px-1.5 font-semibold hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:min-h-8",
                breadcrumbDropPath === "" && styles.breadcrumbDropActive,
              )}
              aria-describedby={draggedDocumentId ? "workspace-document-move-hint" : undefined}
            >
              資料
            </button>
            {breadcrumbs.map((segment, index) => {
              const path = breadcrumbs.slice(0, index + 1).join("/");
              return (
                <span key={path} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentFolder(path);
                      setQuery("");
                    }}
                    onDragOver={(event) => allowBreadcrumbDrop(event, path)}
                    onDragLeave={() => setBreadcrumbDropPath((activePath) => activePath === path ? null : activePath)}
                    onDrop={(event) => finishBreadcrumbDrop(event, path)}
                    className={cn(
                      "min-h-11 max-w-[16ch] truncate rounded px-1.5 font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:min-h-8",
                      breadcrumbDropPath === path && styles.breadcrumbDropActive,
                    )}
                    aria-describedby={draggedDocumentId ? "workspace-document-move-hint" : undefined}
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
            {query && (
              <span className="ml-1 shrink-0 rounded-full border border-blue-200 px-2 py-0.5 text-blue-800">
                検索結果
              </span>
            )}
          </nav>
          {permissions?.canManage && currentFolder && (
            <p id="workspace-document-move-hint" className="sr-only">
              資料をパンくずのフォルダへドラッグすると移動できる。タッチ操作とキーボードでは各資料の整理から移動先を選ぶ。
            </p>
          )}
          <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-600">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5",
                scopeKind === "institution"
                  ? "border-cyan-300 text-cyan-800"
                  : "border-blue-300 text-blue-800",
              )}
            >
              {scopeKind === "institution" ? "機関共有" : "PJ共有"}
            </span>
            {permissions && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-700" aria-hidden />
                {permissionRoleLabel(permissions.role)}
              </span>
            )}
          </div>
        </section>

        <section
          className={cn(styles.panel, "overflow-hidden rounded-lg")}
          aria-label="資料一覧"
        >
          <div className="space-y-2 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="shrink-0 text-sm font-semibold tracking-[-0.02em]">
                資料一覧
              </h2>
              <p className="shrink-0 text-xs text-slate-500">
                {counts.all}件 ・ 外部共有 {counts.shared}件
                {canManageVisibility
                  ? ` ・ AMD内部 ${counts.internal}件`
                  : ""}
              </p>

              <label className="relative min-w-[160px] flex-1 basis-52">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  aria-label="資料名とフォルダを検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="資料名とフォルダを検索"
                  className={cn(
                    styles.railControl,
                    "w-full rounded-md py-1.5 pl-8 pr-3 text-xs",
                  )}
                />
              </label>

              {permissions?.canUpload && (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {canManageVisibility && (
                    <select
                      aria-label="追加時の共有範囲"
                      value={draftVisibility}
                      onChange={(event) =>
                        setDraftVisibility(
                          event.target.value as WorkspaceDocumentVisibility,
                        )
                      }
                      className={cn(styles.railControl, "rounded-md px-2 text-xs")}
                    >
                      <option value="workspace_shared">外部共有で追加</option>
                      <option value="amd_internal">AMD内部で追加</option>
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => openDialog("create_folder")}
                    title="フォルダを作る"
                    aria-label="フォルダを作る"
                    className={cn(
                      styles.secondaryAction,
                      styles.railButton,
                      "inline-flex items-center justify-center rounded-md px-2.5",
                    )}
                  >
                    <FolderPlus className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDialog("create_link")}
                    title="オンライン資料を追加"
                    aria-label="オンライン資料を追加"
                    className={cn(
                      styles.secondaryAction,
                      styles.railButton,
                      "inline-flex items-center justify-center rounded-md px-2.5",
                    )}
                  >
                    <Link2 className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    className={cn(
                      styles.primaryAction,
                      styles.railButton,
                      "inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold disabled:opacity-50",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="h-4 w-4" aria-hidden />
                    )}
                    追加
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) =>
                      void uploadFiles(Array.from(event.target.files ?? []))
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="border-t border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:px-5"
            >
              {notice}
            </div>
          )}

          {permissions?.canUpload && !query && (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={cn(
                styles.dropRail,
                "mx-3 mb-2 hidden min-h-9 items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-[11px] text-slate-500 sm:mx-4 sm:flex",
                dragActive && styles.dropActive,
              )}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  資料を保存中
                </span>
              ) : (
                "ここへファイルをドロップして追加"
              )}
            </div>
          )}

          <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_360px] gap-4 border-t border-slate-200 bg-slate-100 px-5 py-1.5 text-[10px] font-semibold tracking-[0.08em] text-slate-600 xl:grid">
            <span>名称</span>
            <span>共有範囲</span>
            <span>更新</span>
            <span className="text-right">操作</span>
          </div>

          <div className="space-y-2 p-4 pt-0 sm:space-y-0 sm:p-0">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                資料を読み込み中
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                <Folder className="h-8 w-8 text-slate-400" aria-hidden />
                <p className="mt-3 text-sm font-semibold">
                  {query ? "該当する資料はないよ" : "この場所はまだ空だよ"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {permissions?.canUpload && !query
                    ? "ファイル、フォルダ、オンライン資料を追加できる。"
                    : "別の場所か検索条件を確認してね。"}
                </p>
              </div>
            ) : (
              visibleDocuments.map((item) => (
                <article
                  key={item.documentId}
                  draggable={permissions?.canManage && !busy}
                  onDragStart={(event) => startEntryDrag(event, item)}
                  onDragEnd={() => {
                    setDraggedDocumentId(null);
                    setBreadcrumbDropPath(null);
                  }}
                  className={cn(
                    styles.fileRow,
                    draggedDocumentId === item.documentId && styles.fileRowDragging,
                    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 xl:grid-cols-[minmax(0,1fr)_120px_120px_360px] xl:gap-4 xl:px-5 xl:py-2",
                  )}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-2 xl:col-span-1">
                    {permissions?.canManage && (
                      <span
                        className="hidden shrink-0 text-slate-400 xl:inline"
                        title="パンくずへドラッグして移動"
                        aria-hidden
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    )}
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 xl:h-9 xl:w-9">
                      <EntryIcon item={item} />
                    </span>
                    <div className="min-w-0">
                      {item.entryKind === "folder" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentFolder(fullPath(item));
                            setQuery("");
                          }}
                          className="block min-h-11 max-w-full truncate py-2 text-left text-sm font-semibold hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 xl:min-h-0 xl:py-0.5"
                          title={item.displayName}
                        >
                          {item.displayName}
                        </button>
                      ) : (
                        <a
                          href={workspaceDocumentViewHref(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="block min-h-11 max-w-full truncate py-2 text-sm font-semibold hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 xl:min-h-0 xl:py-0.5"
                          title={item.displayName}
                        >
                          {item.displayName}
                        </a>
                      )}
                      <p className="truncate text-[10px] text-slate-500">
                        {query && item.folderPath
                          ? `${item.folderPath} ・ `
                          : ""}
                        {item.entryKind === "file"
                          ? formatBytes(item.fileSizeBytes)
                          : item.entryKind === "link"
                            ? "オンライン資料"
                            : "フォルダ"}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 xl:contents">
                    <div>
                      <VisibilityBadge
                        visibility={item.visibility}
                        entryKind={item.entryKind}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(item.updatedAt)}
                    </p>
                  </div>
                  <div className="col-span-2 flex min-h-11 flex-wrap items-center justify-start gap-1.5 xl:col-span-1 xl:min-h-0 xl:justify-end">
                    {(item.entryKind === "file" || item.entryKind === "link") && isWorkspaceDocumentHtml(item.mimeType, item.displayName) ? (
                      <button
                        type="button"
                        onClick={() => void downloadHtmlAsPdf(item)}
                        disabled={busy}
                        className={cn(
                          styles.secondaryAction,
                          "inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60 xl:h-9 xl:px-2.5",
                        )}
                        title="PDF化ダウンロード"
                        aria-label={`${item.displayName}をPDF化ダウンロード`}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        PDF化
                      </button>
                    ) : item.entryKind !== "folder" ? (
                      <a
                        href={item.entryKind === "link"
                          ? workspaceDocumentViewHref(item)
                          : `/api/workspace-documents/${encodeURIComponent(item.documentId)}/open?download=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-11 w-11 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 xl:h-9 xl:w-9"
                        aria-label={`${item.displayName}を${item.entryKind === "link" ? "開く" : "ダウンロード"}`}
                      >
                        {item.entryKind === "link" ? (
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        ) : (
                          <Download className="h-4 w-4" aria-hidden />
                        )}
                      </a>
                    ) : null}
                    {permissions?.canUpload && item.entryKind === "file" && isWorkspaceDocumentHtml(item.mimeType, item.displayName) && (
                      <button
                        type="button"
                        onClick={() => void openHtmlEditor(item)}
                        disabled={busy}
                        className={cn(
                          styles.secondaryAction,
                          "inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60 xl:h-9 xl:px-2.5",
                        )}
                        title="HTMLを編集"
                        aria-label={`${item.displayName}をHTMLで編集`}
                      >
                        <PencilLine className="h-4 w-4" aria-hidden />
                        HTMLを編集
                      </button>
                    )}
                    {permissions?.canManage && (
                      <button
                        type="button"
                        onClick={() => openDialog("organize", item)}
                        className="grid h-11 w-11 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 xl:h-9 xl:w-9"
                        aria-label={`${item.displayName}を整理・移動`}
                        title="資料を整理・移動"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                    {permissions?.canUpload && (
                      <button
                        type="button"
                        onClick={() => openDialog("archive", item)}
                        disabled={busy}
                        className={cn(
                          "inline-flex h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-60 xl:h-9 xl:px-2.5",
                          styles.dangerAction,
                        )}
                        title="資料室から削除"
                        aria-label={`${item.displayName}を資料室から削除`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        削除
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <Dialog
        open={dialog === "upload_conflict"}
        onOpenChange={(open) => !open && cancelQueuedUpload()}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-lg bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>同名のファイルがあります</DialogTitle>
            <DialogDescription className="break-words leading-6">
              <span className="font-semibold text-slate-800">{activeUploadConflict?.file.name}</span>
              {conflictDocument
                ? ` は、この場所にある${conflictDocument.entryKind === "file" ? "ファイル" : conflictDocument.entryKind === "link" ? "リンク" : "フォルダ"}と同じ名前だよ。`
                : " は、同時に追加する資料と同じ名前だよ。"}
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            {canReplaceConflict
              ? "置き換えると、今あるファイルの内容を新しいファイルへ差し替える。中止なら今回選んだ資料は追加しない。"
              : conflictDocument
                ? "リンクやフォルダは、ファイルで置き換えられない。両方残すと新しい資料へ番号を付けるよ。"
                : "同時に追加する資料どうしは置き換えられない。両方残すと新しい資料へ番号を付けるよ。"}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={cancelQueuedUpload}
            >
              中止
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={() => decideDuplicateUpload("keep_both")}
            >
              両方残す
            </Button>
            <Button
              type="button"
              className="h-11 w-full bg-red-700 hover:bg-red-800 sm:w-auto"
              disabled={busy || !canReplaceConflict}
              title={canReplaceConflict ? "今あるファイルを新しい内容に置き換える" : "リンク・フォルダ・同時追加中の資料は置き換えられない"}
              onClick={() => decideDuplicateUpload("replace")}
            >
              置き換える
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "create_folder" || dialog === "create_link"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-lg bg-white text-slate-950">
          <form onSubmit={(event) => void createEntry(event)}>
            <DialogHeader>
              <DialogTitle>
                {dialog === "create_folder"
                  ? "フォルダを作る"
                  : "オンライン資料を追加"}
              </DialogTitle>
              <DialogDescription>
                保存先: {currentFolder || "資料 直下"}
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 space-y-4">
              <label className="block text-xs font-semibold text-slate-700">
                名称
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="mt-2 h-11 bg-white"
                  autoFocus
                />
              </label>
              {dialog === "create_link" && (
                <label className="block text-xs font-semibold text-slate-700">
                  URL
                  <Input
                    type="url"
                    value={draftUrl}
                    onChange={(event) => setDraftUrl(event.target.value)}
                    className="mt-2 h-11 bg-white"
                    placeholder="https://"
                  />
                </label>
              )}
              {canManageVisibility && (
                <label className="block text-xs font-semibold text-slate-700">
                  共有範囲
                  <select
                    value={draftVisibility}
                    onChange={(event) =>
                      setDraftVisibility(
                        event.target.value as WorkspaceDocumentVisibility,
                      )
                    }
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <option value="workspace_shared">
                      {dialog === "create_folder" ? "PJ全体" : "外部共有"}
                    </option>
                    <option value="amd_internal">AMD内部</option>
                  </select>
                </label>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setDialog(null)}
              >
                閉じる
              </Button>
              <Button
                type="submit"
                className="h-11 bg-[#0066cc] hover:bg-[#004f9e]"
                disabled={busy || !draftName.trim()}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}追加
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "edit_html"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-4xl flex-col overflow-hidden bg-white p-0 text-slate-950">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void saveHtmlSource(event)}>
            <DialogHeader className="shrink-0 border-b-4 border-[#0066cc] bg-[#081b2b] px-5 py-4 text-white">
              <DialogTitle className="text-base text-white sm:text-lg">HTMLを編集</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5 text-cyan-100">
                {selected?.displayName}。ここはHTMLソースだけを編集する欄で、入力中のコードは実行しないよ。
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {htmlSourceLoading ? (
                <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  HTMLソースを読み込み中
                </div>
              ) : (
                <label className="block text-xs font-semibold text-slate-700">
                  HTMLソース
                  <Textarea
                    value={draftHtmlSource}
                    onChange={(event) => setDraftHtmlSource(event.target.value)}
                    className="mt-2 min-h-[min(52dvh,520px)] resize-y rounded-md border-slate-300 bg-white font-mono text-xs leading-5 text-slate-950 focus-visible:border-blue-700 focus-visible:ring-blue-700/20"
                    spellCheck={false}
                    autoFocus
                    aria-describedby="workspace-document-html-editor-note"
                  />
                </label>
              )}
              <p id="workspace-document-html-editor-note" className="mt-3 text-xs leading-5 text-slate-500">
                {formatBytes(draftHtmlByteLength)} / {formatBytes(WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES)}。保存後は資料名から安全な別タブ表示で確認できる。
              </p>
            </div>
            <DialogFooter className="shrink-0 border-t border-slate-200 px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setDialog(null)}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                className="h-11 bg-[#0066cc] hover:bg-[#004f9e]"
                disabled={busy || htmlSourceLoading || !draftHtmlSource.trim() || draftHtmlByteLength > WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                HTMLを保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "organize"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-lg bg-white text-slate-950">
          <form onSubmit={(event) => void organizeEntry(event)}>
            <DialogHeader>
              <DialogTitle>資料を整理</DialogTitle>
              <DialogDescription>
                {canManageVisibility
                  ? "名称・保存先・共有範囲を同じ画面で確認する。"
                  : "名称と保存先を同じ画面で確認する。"}
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 space-y-4">
              <label className="block text-xs font-semibold text-slate-700">
                名称
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="mt-2 h-11 bg-white"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                保存先
                <select
                  value={draftFolderPath}
                  onChange={(event) => setDraftFolderPath(event.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <option value="">資料 直下</option>
                  {folders.filter(eligibleMoveTarget).map((path) => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </select>
              </label>
              {canManageVisibility && (
                <label className="block text-xs font-semibold text-slate-700">
                  共有範囲
                  <select
                    value={draftVisibility}
                    onChange={(event) =>
                      setDraftVisibility(
                        event.target.value as WorkspaceDocumentVisibility,
                      )
                    }
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <option value="workspace_shared">
                      {selected?.entryKind === "folder" ? "PJ全体" : "外部共有"}
                    </option>
                    <option value="amd_internal">AMD内部</option>
                  </select>
                </label>
              )}
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className={cn("h-11", styles.dangerAction)}
                onClick={() => setDialog("archive")}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setDialog(null)}
                >
                  閉じる
                </Button>
                <Button
                  type="submit"
                  className="h-11 bg-[#0066cc] hover:bg-[#004f9e]"
                  disabled={busy || !draftName.trim()}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}保存
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "archive"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-md bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>資料室から削除する？</DialogTitle>
            <DialogDescription>
              {selected?.displayName}{" "}
              を資料室の通常一覧と共有画面から外す。ファイル本体や登録情報は保護された保管領域に残り、外部へ公開されないよ。今の資料室には戻す画面はない。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setDialog("organize")}
            >
              戻る
            </Button>
            <Button
              type="button"
              className="h-11 bg-red-700 hover:bg-red-800"
              disabled={busy}
              onClick={() => void archiveEntry()}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              資料室から削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkspaceDocumentLauncher({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.room}>
      <button
        type="button"
        data-testid="workspace-document-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          styles.launcher,
          "flex w-full items-center justify-between gap-3 rounded-lg px-4 text-left transition-colors",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <FolderOpen className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">資料室を開く</span>
            <span className="block truncate text-[10px] font-medium text-blue-100">
              {projectName}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-cyan-100">
          開く
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          data-testid="workspace-document-modal"
          className="!flex !h-[calc(100dvh-0.5rem)] !w-[calc(100vw-0.5rem)] !max-w-[1240px] !flex-col !gap-0 !overflow-hidden !rounded-lg !bg-white !p-0 !text-slate-950 shadow-[0_28px_90px_rgba(2,18,35,0.32)] sm:!h-[min(92dvh,900px)] sm:!w-[calc(100vw-2rem)] sm:!rounded-xl"
        >
          <DialogHeader className="shrink-0 border-b-2 border-[#0066cc] bg-[#081b2b] px-3 py-2 text-white sm:px-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-cyan-300/40 bg-[#0066cc] text-white">
                <FolderOpen className="h-4 w-4" aria-hidden />
              </span>
              <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.02em] text-white sm:text-base">
                {projectName} 資料室
              </DialogTitle>
              <DialogDescription className="sr-only">
                コックピットを離れずに、このPJの資料を確認・整理する。
              </DialogDescription>
              <DialogClose
                render={
                  <button
                    type="button"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 sm:h-9 sm:w-9"
                    aria-label="資料室を閉じる"
                  />
                }
              >
                <X className="h-4 w-4" aria-hidden />
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <WorkspaceDocumentRoom
              scopeKind="project"
              scopeId={projectId}
              scopeName={projectName}
              scopeTrail={[projectName]}
              presentation="modal"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
