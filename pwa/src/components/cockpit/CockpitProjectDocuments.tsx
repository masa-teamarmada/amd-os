"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Eye, FileText, FileUp, FolderOpen, Loader2, Pencil, RefreshCw, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownView } from "./MarkdownView";

type ProjectDocument = {
  documentId: string;
  projectId: string;
  driveFileId: string;
  driveFolderId: string;
  webViewLink: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
};

type ProjectDocumentsResponse = {
  ok?: boolean;
  documents?: ProjectDocument[];
  driveConfigured?: boolean;
  documentsFolderName?: string;
  warning?: string | null;
  error?: string;
};

type MarkdownPreviewResponse = {
  ok?: boolean;
  markdown?: string;
  error?: string;
};

const DOCUMENT_QUERY_KEY = "document";

export function CockpitProjectDocuments({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastFiles, setLastFiles] = useState<File[] | null>(null);
  const [documentsFolderName, setDocumentsFolderName] = useState("AMD OS資料室");
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [urlDocumentId, setUrlDocumentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [savingMarkdown, setSavingMarkdown] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/project-documents?project_id=${encodeURIComponent(projectId)}`);
      const json = (await res.json().catch(() => ({}))) as ProjectDocumentsResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        setDocuments([]);
      } else {
        setDocuments(json.documents || []);
        setWarning(json.warning || null);
        setDocumentsFolderName(json.documentsFolderName || "AMD OS資料室");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch error");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    setWarning(null);
    setLastFiles(files);
    try {
      const form = new FormData();
      form.append("project_id", projectId);
      files.forEach((file) => form.append("files", file));
      const res = await fetch("/api/project-documents", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as ProjectDocumentsResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setDocuments(json.documents || []);
      setDocumentsFolderName(json.documentsFolderName || documentsFolderName);
      setLastFiles(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload error");
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    void uploadFiles(files);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!uploading) setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    void uploadFiles(files);
  }

  const closeMarkdownPreview = useCallback((options?: { syncUrl?: boolean; mode?: "push" | "replace" }) => {
    setPreviewDoc(null);
    setPreviewMarkdown("");
    setPreviewError(null);
    setPreviewLoading(false);
    setEditorOpen(false);
    setDraftMarkdown("");
    setSaveError(null);
    setSavingMarkdown(false);
    if (options?.syncUrl !== false) {
      writeDocumentIdToUrl(null, options?.mode ?? "replace");
      setUrlDocumentId(null);
    }
  }, []);

  const openMarkdownPreview = useCallback(async (
    doc: ProjectDocument,
    options?: { syncUrl?: boolean; mode?: "push" | "replace" },
  ) => {
    if (!isMarkdownDocument(doc)) return;
    if (options?.syncUrl !== false) {
      writeDocumentIdToUrl(doc.documentId, options?.mode ?? "push");
      setUrlDocumentId(doc.documentId);
    }
    setPreviewDoc(doc);
    setPreviewMarkdown("");
    setPreviewError(null);
    setPreviewLoading(true);
    setEditorOpen(false);
    setDraftMarkdown("");
    setSaveError(null);
    try {
      const res = await fetch(`/api/project-documents/${encodeURIComponent(doc.documentId)}/content`);
      const json = (await res.json().catch(() => ({}))) as MarkdownPreviewResponse;
      if (!res.ok || !json.ok) {
        setPreviewError(json.error || `HTTP ${res.status}`);
        return;
      }
      const markdown = json.markdown || "";
      setPreviewMarkdown(markdown);
      setDraftMarkdown(markdown);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "preview error");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  async function saveMarkdownEdit() {
    if (!previewDoc || savingMarkdown) return;
    setSavingMarkdown(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/project-documents/${encodeURIComponent(previewDoc.documentId)}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: draftMarkdown }),
      });
      const json = (await res.json().catch(() => ({}))) as MarkdownPreviewResponse;
      if (!res.ok || !json.ok) {
        setSaveError(json.error || `HTTP ${res.status}`);
        return;
      }
      const markdown = json.markdown ?? draftMarkdown;
      setPreviewMarkdown(markdown);
      setDraftMarkdown(markdown);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "save error");
    } finally {
      setSavingMarkdown(false);
    }
  }

  useEffect(() => {
    function syncFromUrl() {
      setUrlDocumentId(readDocumentIdFromUrl());
    }
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!urlDocumentId) {
      if (previewDoc) closeMarkdownPreview({ syncUrl: false });
      return;
    }
    if (previewDoc?.documentId === urlDocumentId) return;

    const target = documents.find((doc) => doc.documentId === urlDocumentId);
    if (!target || !isMarkdownDocument(target)) return;
    void openMarkdownPreview(target, { syncUrl: false });
  }, [closeMarkdownPreview, documents, loading, openMarkdownPreview, previewDoc, urlDocumentId]);

  const latest = documents.slice(0, 4);

  return (
    <>
      <section className="rounded-lg border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <FolderOpen className="h-4 w-4 text-slate-500" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold leading-tight">資料</h2>
            <p className="truncate text-[10px] text-muted-foreground">Drive / {documentsFolderName}</p>
          </div>
          <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {documents.length}件
          </span>
        </div>

        <div className="p-3">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-center transition-colors ${
              dragActive
                ? "border-sky-400 bg-sky-50"
                : "border-slate-300 bg-slate-50/60 hover:bg-slate-50"
            } ${uploading ? "pointer-events-none opacity-70" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileUp className="h-3.5 w-3.5" aria-hidden />}
              {uploading ? "保存中" : "資料を追加"}
            </button>
            <p className="text-[11px] text-muted-foreground">ファイルはPJ folder配下の専用folderに保存</p>
          </div>

          {(warning || error) && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="break-words">{error || warning}</p>
                {error && lastFiles && (
                  <button
                    type="button"
                    onClick={() => uploadFiles(lastFiles)}
                    className="mt-1 inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
                    disabled={uploading}
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden />
                    再試行
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="mt-3 h-16 rounded-md border border-border/60 bg-muted/20 animate-pulse" />
          ) : latest.length === 0 ? (
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 px-3 py-3 text-center text-[12px] text-muted-foreground">
              資料なし
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border/70">
              {latest.map((doc) => {
                const markdown = isMarkdownDocument(doc);
                return (
                  <li key={doc.documentId} className="flex items-center gap-2 bg-white px-2.5 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
                      {markdown ? (
                        <FileText className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                      ) : (
                        <FileUp className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {markdown ? (
                        <button
                          type="button"
                          onClick={() => openMarkdownPreview(doc)}
                          className="block max-w-full truncate text-left text-[12px] font-medium text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          {doc.fileName}
                        </button>
                      ) : (
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[12px] font-medium text-slate-900 hover:underline"
                        >
                          {doc.fileName}
                        </a>
                      )}
                      <p className="truncate text-[10px] text-muted-foreground">
                        {formatBytes(doc.fileSizeBytes)} / {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    {markdown && (
                      <button
                        type="button"
                        onClick={() => openMarkdownPreview(doc)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`${doc.fileName}をOS内で表示`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                    <a
                      href={doc.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`${doc.fileName}をDriveで開く`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={!!previewDoc} onOpenChange={(open) => {
        if (!open) {
          closeMarkdownPreview();
        }
      }}>
        <DialogContent className="grid h-[92vh] !w-[96vw] !max-w-[96vw] sm:!max-w-[96vw] xl:!max-w-[1400px] grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-lg border border-slate-300 bg-white p-0 text-slate-950 shadow-2xl">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3 pr-9">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-sky-200 bg-sky-50">
                <FileText className="h-[18px] w-[18px] text-sky-700" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-[15px] font-semibold leading-tight text-slate-950">
                  {previewDoc?.fileName || "Markdown"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-[11px] text-slate-500">
                  {previewDoc ? `${formatBytes(previewDoc.fileSizeBytes)} / ${formatDate(previewDoc.createdAt)}` : ""}
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftMarkdown(previewMarkdown);
                  setSaveError(null);
                  setEditorOpen((value) => !value);
                }}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50"
                disabled={previewLoading || !!previewError}
              >
                {editorOpen ? <X className="h-3.5 w-3.5" aria-hidden /> : <Pencil className="h-3.5 w-3.5" aria-hidden />}
                {editorOpen ? "閉じる" : "編集"}
              </button>
            </div>
          </div>
          <div className={editorOpen
            ? "grid min-h-0 grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]"
            : "min-h-0 overflow-y-auto bg-white px-6 py-5 sm:px-8"}
          >
            <div className={editorOpen ? "min-h-0 overflow-y-auto px-6 py-5 sm:px-8" : ""}>
              {previewLoading ? (
                <div className="flex h-full min-h-64 items-center justify-center text-[13px] text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  読み込み中
                </div>
              ) : previewError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  {previewError}
                </div>
              ) : (
                <MarkdownView source={(editorOpen ? draftMarkdown : previewMarkdown) || "（本文なし）"} tone="light" />
              )}
            </div>

            {editorOpen && (
              <aside className="grid min-h-0 grid-rows-[auto_1fr_auto] border-t border-slate-200 bg-slate-50 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-semibold text-slate-900">Markdown編集</h3>
                    <p className="truncate text-[10px] text-slate-500">Drive上のmd本体を更新</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftMarkdown(previewMarkdown);
                      setEditorOpen(false);
                      setSaveError(null);
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                    aria-label="編集を閉じる"
                    disabled={savingMarkdown}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <textarea
                  value={draftMarkdown}
                  onChange={(event) => setDraftMarkdown(event.target.value)}
                  className="min-h-0 resize-none border-0 bg-white px-4 py-3 font-mono text-[12px] leading-6 text-slate-900 outline-none ring-0 placeholder:text-slate-400"
                  spellCheck={false}
                />
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                  {saveError && (
                    <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                      {saveError}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftMarkdown(previewMarkdown);
                        setEditorOpen(false);
                        setSaveError(null);
                      }}
                      className="inline-flex h-8 items-center rounded border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
                      disabled={savingMarkdown}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={saveMarkdownEdit}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-sky-700 bg-sky-700 px-3 text-[12px] font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                      disabled={savingMarkdown || draftMarkdown === previewMarkdown}
                    >
                      {savingMarkdown ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
                      保存
                    </button>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isMarkdownDocument(doc: ProjectDocument) {
  const name = doc.fileName.toLowerCase();
  const mime = doc.mimeType.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown") || mime === "text/markdown";
}

function readDocumentIdFromUrl() {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get(DOCUMENT_QUERY_KEY);
}

function writeDocumentIdToUrl(documentId: string | null, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (documentId) {
    url.searchParams.set(DOCUMENT_QUERY_KEY, documentId);
  } else {
    url.searchParams.delete(DOCUMENT_QUERY_KEY);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;
  window.history[mode === "replace" ? "replaceState" : "pushState"](null, "", nextUrl);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "size不明";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日付不明";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
}
