"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface PreviewDocument {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  webViewLink: string;
}

interface PreviewResponse {
  ok: boolean;
  document?: PreviewDocument;
  markdown?: string;
  error?: string;
}

export function SeedMarkdownPreviewModal({
  open,
  seedId,
  seedTitle,
  driveUrl,
  onClose,
}: {
  open: boolean;
  seedId: string;
  seedTitle: string;
  driveUrl: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(open);
  const [markdown, setMarkdown] = useState("");
  const [document, setDocument] = useState<PreviewDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    fetch(`/api/seeds/${encodeURIComponent(seedId)}/deep-dive`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as PreviewResponse;
        if (!response.ok || !body.ok) {
          throw new Error(body.error || "深掘り資料を読み込めなかった");
        }
        setMarkdown(body.markdown ?? "");
        setDocument(body.document ?? null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "深掘り資料を読み込めなかった");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [driveUrl, open, seedId]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[92vh] !w-[96vw] !max-w-[1100px] grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-lg border border-slate-300 bg-white p-0 text-slate-950 shadow-2xl"
      >
        <header className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-sky-200 bg-sky-50">
              <FileText className="h-[18px] w-[18px] text-sky-700" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-[15px] font-semibold leading-tight text-slate-950">
                {document?.fileName || seedTitle}
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-[11px] text-slate-500">
                {document ? `${formatBytes(document.fileSizeBytes)} / Markdown` : "深掘り資料"}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={document?.webViewLink || driveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="Driveで開く"
                aria-label="Driveで開く"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="閉じる"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto bg-white px-5 py-5 sm:px-8 lg:px-10">
          {loading ? (
            <div className="flex h-full min-h-64 items-center justify-center text-[13px] text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              読み込み中
            </div>
          ) : error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {error}
            </div>
          ) : (
            <MarkdownView source={markdown || "（本文なし）"} tone="light" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "サイズ不明";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
