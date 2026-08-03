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
  Archive,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Link2,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldCheck,
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
import { cn } from "@/lib/utils";
import { isWorkspaceDocumentHtml } from "@/lib/workspace-documents-core";
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
  "create_folder" | "create_link" | "organize" | "archive" | null;

const kindOrder: Record<WorkspaceDocumentEntryKind, number> = {
  folder: 0,
  file: 1,
  link: 2,
};

function apiUrl(scopeKind: WorkspaceDocumentScopeKind, scopeId: string) {
  return `/api/workspace-documents?scope_kind=${encodeURIComponent(scopeKind)}&scope_id=${encodeURIComponent(scopeId)}`;
}

function fullPath(item: DocumentItem) {
  return item.folderPath
    ? `${item.folderPath}/${item.displayName}`
    : item.displayName;
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
  return (
    (
      {
        manager: "マネージャー",
        contributor: "コントリビューター",
        readonly: "閲覧のみ",
        owner: "機関管理者",
        member: "機関メンバー",
      } as Record<string, string>
    )[role] ?? role
  );
}

function EntryIcon({ item }: { item: DocumentItem }) {
  if (item.entryKind === "folder")
    return <Folder className="h-5 w-5 text-blue-700" aria-hidden />;
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
}: {
  visibility: WorkspaceDocumentVisibility;
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
      {visibility === "workspace_shared" ? "外部共有" : "AMD内部"}
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
}: {
  scopeKind: WorkspaceDocumentScopeKind;
  scopeId: string;
  scopeName: string;
  scopeTrail?: string[];
  returnHref?: string;
  returnLabel?: string;
  presentation?: "page" | "modal";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [currentFolder, setCurrentFolder] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftFolderPath, setDraftFolderPath] = useState("");
  const [draftVisibility, setDraftVisibility] =
    useState<WorkspaceDocumentVisibility>("workspace_shared");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(scopeKind, scopeId), {
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
  }, [scopeId, scopeKind]);

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
  }

  async function createEntry(event: FormEvent) {
    event.preventDefault();
    if (dialog !== "create_folder" && dialog !== "create_link") return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(apiUrl(scopeKind, scopeId), {
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

  async function uploadFiles(files: File[]) {
    if (!permissions?.canUpload || busy || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const file of files) {
        const prepareResponse = await fetch(apiUrl(scopeKind, scopeId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_upload",
            displayName: file.name,
            folderPath: currentFolder,
            visibility: draftVisibility,
            fileSizeBytes: file.size,
            mimeType: file.type || "application/octet-stream",
          }),
        });
        const prepared = (await prepareResponse.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          documentId?: string;
          storagePath?: string;
          uploadToken?: string;
          mimeType?: string;
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
            upsert: false,
          });
        if (uploadError) {
          await fetch(
            `/api/workspace-documents/${encodeURIComponent(prepared.documentId)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "fail_upload" }),
            },
          ).catch(() => undefined);
          throw new Error(`${file.name}: ${uploadError.message}`);
        }

        const completeResponse = await fetch(
          `/api/workspace-documents/${encodeURIComponent(prepared.documentId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete_upload" }),
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
    }
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
        throw new Error(payload.error || "資料を保管済みにできなかったよ。");
      setDialog(null);
      await loadDocuments();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "資料を保管済みにできなかったよ。",
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
            ? "space-y-4 p-4 sm:p-5"
            : "space-y-6 px-4 py-6 sm:px-6 sm:py-8",
        )}
      >
        <section
          className={cn(
            styles.scopeBand,
            scopeKind === "institution"
              ? styles.scopeBandInstitution
              : styles.scopeBandProject,
            "rounded-lg p-4 sm:p-5",
          )}
          aria-label="資料の所属と共有範囲"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                {ownerTrail.map((label, index) => (
                  <span key={`${label}-${index}`} className="contents">
                    {index > 0 && (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    )}
                    <span>{label}</span>
                  </span>
                ))}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                <span>資料</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-1",
                    scopeKind === "institution"
                      ? "border-cyan-300 text-cyan-800"
                      : "border-blue-300 text-blue-800",
                  )}
                >
                  {scopeKind === "institution" ? "機関共有" : "PJ共有"}
                </span>
              </div>
              {!isModal && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  この場所に属する資料だけを表示してる。外部共有とAMD内部は同じ正本で管理し、見える範囲だけを切り替えるよ。
                </p>
              )}
            </div>
            {permissions && (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <ShieldCheck className="h-4 w-4 text-blue-700" aria-hidden />
                <span>{permissionRoleLabel(permissions.role)}</span>
              </div>
            )}
          </div>
        </section>

        <section
          className={cn(styles.panel, "overflow-hidden rounded-lg")}
          aria-label="資料一覧"
        >
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  資料一覧
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {counts.all}件 ・ 外部共有 {counts.shared}件
                  {permissions?.canReadInternal
                    ? ` ・ AMD内部 ${counts.internal}件`
                    : ""}
                </p>
              </div>
              {permissions?.canUpload && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openDialog("create_folder")}
                    className={cn(
                      styles.secondaryAction,
                      "inline-flex items-center gap-2 rounded-md px-3 text-xs font-semibold",
                    )}
                  >
                    <FolderPlus className="h-4 w-4" aria-hidden />
                    フォルダ
                  </button>
                  <button
                    type="button"
                    onClick={() => openDialog("create_link")}
                    className={cn(
                      styles.secondaryAction,
                      "inline-flex items-center gap-2 rounded-md px-3 text-xs font-semibold",
                    )}
                  >
                    <Link2 className="h-4 w-4" aria-hidden />
                    リンク
                  </button>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    className={cn(
                      styles.primaryAction,
                      "inline-flex items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-50",
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

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block min-w-0">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  aria-label="資料名とフォルダを検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="資料名とフォルダを検索"
                  className={cn(
                    styles.control,
                    "w-full rounded-md py-2 pl-10 pr-3 text-sm",
                  )}
                />
              </label>
              {permissions?.canReadInternal && (
                <label className="flex min-h-11 items-center gap-2 text-xs text-slate-600">
                  <span>追加時</span>
                  <select
                    value={draftVisibility}
                    onChange={(event) =>
                      setDraftVisibility(
                        event.target.value as WorkspaceDocumentVisibility,
                      )
                    }
                    className={cn(styles.control, "rounded-md px-3 text-xs")}
                  >
                    <option value="workspace_shared">外部共有</option>
                    <option value="amd_internal">AMD内部</option>
                  </select>
                </label>
              )}
            </div>

            <nav
              className="flex min-h-11 flex-wrap items-center gap-1 text-xs text-slate-600"
              aria-label="現在のフォルダ"
            >
              <button
                type="button"
                onClick={() => {
                  setCurrentFolder("");
                  setQuery("");
                }}
                className="min-h-11 rounded px-2 font-semibold hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                資料
              </button>
              {breadcrumbs.map((segment, index) => {
                const path = breadcrumbs.slice(0, index + 1).join("/");
                return (
                  <span key={path} className="flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentFolder(path);
                        setQuery("");
                      }}
                      className="min-h-11 rounded px-2 font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
              {query && (
                <span className="ml-2 rounded-full border border-blue-200 px-2 py-1 text-blue-800">
                  検索結果
                </span>
              )}
            </nav>
          </div>

          {error && (
            <div
              role="alert"
              className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5"
            >
              {error}
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
                "mx-4 mb-4 hidden min-h-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500 sm:mx-5 sm:mb-5 sm:flex",
                dragActive && styles.dropActive,
              )}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  資料を保存中
                </span>
              ) : (
                "ここへファイルをドロップして追加"
              )}
            </div>
          )}

          <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_96px] gap-4 border-t border-slate-200 bg-slate-100 px-5 py-2 text-[10px] font-semibold tracking-[0.08em] text-slate-600 sm:grid">
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
                  className={cn(
                    styles.fileRow,
                    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_96px] sm:gap-4 sm:px-5",
                  )}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100">
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
                          className="block min-h-11 max-w-full truncate py-2 text-left text-sm font-semibold hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                          title={item.displayName}
                        >
                          {item.displayName}
                        </button>
                      ) : (
                        <a
                          href={isWorkspaceDocumentHtml(item.mimeType, item.displayName)
                            ? `/api/workspace-documents/${encodeURIComponent(item.documentId)}/pdf`
                            : `/api/workspace-documents/${encodeURIComponent(item.documentId)}/open?download=0`}
                          target="_blank"
                          rel="noreferrer"
                          className="block min-h-11 max-w-full truncate py-2 text-sm font-semibold hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
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
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:contents">
                    <div>
                      <VisibilityBadge visibility={item.visibility} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDate(item.updatedAt)}
                    </p>
                  </div>
                  <div className="flex min-h-11 items-center justify-end gap-1">
                    {item.entryKind !== "folder" && (
                      <a
                        href={isWorkspaceDocumentHtml(item.mimeType, item.displayName)
                          ? `/api/workspace-documents/${encodeURIComponent(item.documentId)}/pdf`
                          : `/api/workspace-documents/${encodeURIComponent(item.documentId)}/open?download=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-11 w-11 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        title={isWorkspaceDocumentHtml(item.mimeType, item.displayName) ? "PDF化ダウンロード" : undefined}
                        aria-label={`${item.displayName}を${item.entryKind === "link" ? "開く" : isWorkspaceDocumentHtml(item.mimeType, item.displayName) ? "PDF化ダウンロード" : "ダウンロード"}`}
                      >
                        {item.entryKind === "link" ? (
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        ) : (
                          <Download className="h-4 w-4" aria-hidden />
                        )}
                      </a>
                    )}
                    {permissions?.canManage && (
                      <button
                        type="button"
                        onClick={() => openDialog("organize", item)}
                        className="grid h-11 w-11 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        aria-label={`${item.displayName}を整理`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
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
              {permissions?.canReadInternal && (
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
                    <option value="workspace_shared">外部共有</option>
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
        open={dialog === "organize"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-lg bg-white text-slate-950">
          <form onSubmit={(event) => void organizeEntry(event)}>
            <DialogHeader>
              <DialogTitle>資料を整理</DialogTitle>
              <DialogDescription>
                名称・保存先・共有範囲を同じ画面で確認する。
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
              {permissions?.canReadInternal && (
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
                    <option value="workspace_shared">外部共有</option>
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
                <Archive className="h-4 w-4" />
                保管済みにする
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
            <DialogTitle>保管済みにする？</DialogTitle>
            <DialogDescription>
              {selected?.displayName}{" "}
              を通常一覧から外す。ファイル本体は削除せず、保管領域に残すよ。
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
              保管済みにする
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
          <DialogHeader className="shrink-0 border-b-4 border-[#0066cc] bg-[#081b2b] px-4 py-3 text-white sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-cyan-300/40 bg-[#0066cc] text-white">
                <FolderOpen className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-cyan-200">
                  AMD OS / PJ資料
                </p>
                <DialogTitle className="mt-0.5 truncate text-base font-semibold tracking-[-0.02em] text-white sm:text-lg">
                  {projectName} 資料室
                </DialogTitle>
                <DialogDescription className="sr-only">
                  コックピットを離れずに、このPJの資料を確認・整理する。
                </DialogDescription>
              </div>
              <DialogClose
                render={
                  <button
                    type="button"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
                    aria-label="資料室を閉じる"
                  />
                }
              >
                <X className="h-5 w-5" aria-hidden />
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
