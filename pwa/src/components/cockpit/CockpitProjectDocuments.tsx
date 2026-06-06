"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FileUp, FolderOpen, Loader2, RefreshCw } from "lucide-react";

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

export function CockpitProjectDocuments({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastFiles, setLastFiles] = useState<File[] | null>(null);
  const [documentsFolderName, setDocumentsFolderName] = useState("AMD OS 資料");

  async function loadDocuments() {
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
        setDocumentsFolderName(json.documentsFolderName || "AMD OS 資料");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch error");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, [projectId]);

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

  const latest = documents.slice(0, 4);

  return (
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
            {latest.map((doc) => (
              <li key={doc.documentId} className="flex items-center gap-2 bg-white px-2.5 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50">
                  <FileUp className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={doc.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[12px] font-medium text-slate-900 hover:underline"
                  >
                    {doc.fileName}
                  </a>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {formatBytes(doc.fileSizeBytes)} / {formatDate(doc.createdAt)}
                  </p>
                </div>
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
            ))}
          </ul>
        )}
      </div>
    </section>
  );
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
