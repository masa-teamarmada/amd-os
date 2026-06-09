"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clipboard,
  FileText,
  Image as ImageIcon,
  MonitorUp,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import type { ProjectMeetingSummary } from "@/lib/supabase-data";

interface MeetingAsset {
  assetId: string;
  meetingId: string;
  projectId: string;
  fileName: string;
  mediaType: string;
  fileSizeBytes: number;
  assetKind: string;
  caption: string;
  extractedText: string;
  sourceUrl: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  signedUrl: string;
  fileUrl: string;
  driveFolderName: string | null;
  driveFolderUrl: string | null;
  folderDisplayPath: string | null;
  webViewLink: string | null;
}

interface Props {
  meeting: ProjectMeetingSummary;
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function kindLabel(kind: string): string {
  if (kind === "paste") return "Paste";
  if (kind === "screen_capture") return "Capture";
  if (kind === "notion_image") return "Notion";
  return "Upload";
}

function fileNameTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function MeetingAssetsPanel({ meeting, onMeetingUpdated }: Props) {
  const [assets, setAssets] = useState<MeetingAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);

  const imageCount = useMemo(() => assets.filter((asset) => asset.mediaType.startsWith("image/")).length, [assets]);
  const pdfCount = useMemo(() => assets.filter((asset) => asset.mediaType === "application/pdf").length, [assets]);
  const otherCount = assets.length - imageCount - pdfCount;
  const folderInfo = useMemo(() => {
    const asset = assets.find((item) => item.folderDisplayPath);
    return asset ? { label: asset.folderDisplayPath, url: asset.driveFolderUrl } : null;
  }, [assets]);

  useEffect(() => {
    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.meetingId]);

  async function loadAssets() {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch(`/api/meeting-assets?meeting_id=${encodeURIComponent(meeting.meetingId)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setNote(`添付の読み込み失敗: ${json.error || res.status}`);
        return;
      }
      setAssets(Array.isArray(json.assets) ? json.assets : []);
    } catch (error) {
      setNote(`添付の読み込み失敗: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: File[], assetKind: "upload" | "paste" | "screen_capture") {
    const targets = files.filter((file) => file.size > 0);
    if (targets.length === 0) return;
    setUploading(true);
    setNote(null);
    try {
      const form = new FormData();
      form.set("meeting_id", meeting.meetingId);
      form.set("asset_kind", assetKind);
      for (const file of targets) form.append("files", file);
      const res = await fetch("/api/meeting-assets", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setNote(`アップロード失敗: ${json.error || res.status}`);
        return;
      }
      setAssets(Array.isArray(json.assets) ? json.assets : []);
      setNote(`${targets.length}件追加したよ`);
      window.setTimeout(() => setNote(null), 1800);
    } catch (error) {
      setNote(`アップロード失敗: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(files: FileList | null) {
    if (!files) return;
    void uploadFiles(Array.from(files), "upload");
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.size > 0);
    if (files.length > 0) {
      event.preventDefault();
      void uploadFiles(files, "paste");
      return;
    }

    const itemFiles = Array.from(event.clipboardData.items)
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file && file.size > 0);
    if (itemFiles.length > 0) {
      event.preventDefault();
      void uploadFiles(itemFiles, "paste");
    }
  }

  async function readClipboardImages() {
    setNote(null);
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
        dropzoneRef.current?.focus();
        setNote("この枠にフォーカスして Cmd+V してね");
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const ext = imageType.split("/")[1] || "png";
        files.push(new File([blob], `clipboard-${fileNameTimestamp()}.${ext}`, { type: imageType }));
      }
      if (files.length === 0) {
        dropzoneRef.current?.focus();
        setNote("画像がなければ、この枠に Cmd+V してみて");
        return;
      }
      await uploadFiles(files, "paste");
    } catch (error) {
      dropzoneRef.current?.focus();
      setNote(error instanceof Error ? `クリップボード取得失敗: ${error.message}` : "クリップボード取得失敗");
    }
  }

  async function captureScreen() {
    setNote(null);
    const mediaDevices = navigator.mediaDevices as (Navigator["mediaDevices"] & {
      getDisplayMedia?: (constraints?: DisplayMediaStreamOptions) => Promise<MediaStream>;
    }) | undefined;
    if (!mediaDevices?.getDisplayMedia) {
      setNote("このブラウザは画面キャプチャに未対応みたい");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
        else video.onloadedmetadata = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1440;
      canvas.height = video.videoHeight || 900;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("capture failed"))), "image/png", 0.95);
      });
      const file = new File([blob], `screen-capture-${fileNameTimestamp()}.png`, { type: "image/png" });
      await uploadFiles([file], "screen_capture");
    } catch (error) {
      setNote(error instanceof Error ? `画面キャプチャ失敗: ${error.message}` : "画面キャプチャ失敗");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  async function patchAsset(assetId: string, patch: Record<string, unknown>) {
    const prev = assets;
    setAssets((items) => items.map((item) => item.assetId === assetId ? { ...item, ...patch } as MeetingAsset : item));
    try {
      const res = await fetch("/api/meeting-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: assetId, ...patch }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setAssets(prev);
        setNote(`保存失敗: ${json.error || res.status}`);
        return;
      }
      if (json.asset) {
        setAssets((items) => items.map((item) => item.assetId === assetId ? json.asset : item));
      }
    } catch (error) {
      setAssets(prev);
      setNote(`保存失敗: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  async function reorderAsset(index: number, delta: -1 | 1) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= assets.length) return;
    const reordered = [...assets];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    const withOrder = reordered.map((asset, i) => ({ ...asset, sortOrder: (i + 1) * 10 }));
    setAssets(withOrder);
    await Promise.all(withOrder.map((asset) => patchAsset(asset.assetId, { sort_order: asset.sortOrder })));
  }

  async function deleteAsset(asset: MeetingAsset) {
    if (!window.confirm(`${asset.fileName} を削除する?`)) return;
    const prev = assets;
    setAssets((items) => items.filter((item) => item.assetId !== asset.assetId));
    try {
      const res = await fetch(`/api/meeting-assets?asset_id=${encodeURIComponent(asset.assetId)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setAssets(prev);
        setNote(`削除失敗: ${json.error || res.status}`);
      }
    } catch (error) {
      setAssets(prev);
      setNote(`削除失敗: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  async function insertIntoNarrative() {
    setNote(null);
    try {
      const res = await fetch("/api/meeting-assets/insert-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: meeting.meetingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setNote(`本文挿入失敗: ${json.error || res.status}`);
        return;
      }
      if (json.meeting) onMeetingUpdated?.(json.meeting as ProjectMeetingSummary);
      setNote("本文に入れたよ");
      window.setTimeout(() => setNote(null), 1800);
    } catch (error) {
      setNote(`本文挿入失敗: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return (
    <section className="border-t border-[#e5e5e7] bg-white px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1d1d1f]">
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
            <span>添付資料</span>
          </h3>
          <div className="mt-0.5 text-[10.5px] text-[#86868b]">
            {assets.length > 0 ? `${assets.length}件 / 画像 ${imageCount} / PDF ${pdfCount} / 他 ${otherCount}` : "添付なし"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#d2d2d7] bg-white px-2.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            title="ファイルを選択"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>選択</span>
          </button>
          <button
            type="button"
            onClick={readClipboardImages}
            disabled={uploading}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#d2d2d7] bg-white px-2.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            title="クリップボード画像を追加"
          >
            <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ペースト</span>
          </button>
          <button
            type="button"
            onClick={captureScreen}
            disabled={uploading}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#d2d2d7] bg-white px-2.5 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            title="画面キャプチャを追加"
          >
            <MonitorUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>画面</span>
          </button>
          <button
            type="button"
            onClick={insertIntoNarrative}
            disabled={assets.length === 0 || uploading}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-[#1d1d1f] px-2.5 text-[11px] font-medium text-white disabled:opacity-40"
            title="添付を議事録本文に挿入"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>本文へ</span>
          </button>
          <button
            type="button"
            onClick={loadAssets}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#d2d2d7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            title="再読み込み"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          handleFileInput(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      <div
        ref={dropzoneRef}
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void uploadFiles(Array.from(event.dataTransfer.files), "upload");
        }}
        className={`mb-3 flex min-h-[74px] items-center justify-center rounded-md border border-dashed px-3 py-3 text-center outline-none transition-colors ${
          dragActive
            ? "border-[#007aff] bg-blue-50"
            : "border-[#d2d2d7] bg-[#fbfbfd] focus:border-[#007aff] focus:bg-blue-50/40"
        }`}
      >
        <div className="flex items-center gap-2 text-[12px] text-[#3c3c43]">
          <Upload className="h-4 w-4 text-[#86868b]" aria-hidden="true" />
          <span>{uploading ? "追加中..." : "ドロップ / Cmd+V / 選択"}</span>
        </div>
      </div>

      {folderInfo && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#3c3c43]">
          <span className="text-[#86868b]">保存先:</span>
          {folderInfo.url ? (
            <a
              href={folderInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full truncate font-medium text-[#1d1d1f] underline decoration-[#c7c7cc] underline-offset-2 hover:text-[#007aff]"
            >
              {folderInfo.label}
            </a>
          ) : (
            <span className="max-w-full truncate font-medium text-[#1d1d1f]">{folderInfo.label}</span>
          )}
        </div>
      )}
      {note && <div className="mb-2 text-[11px] text-[#3c3c43]">{note}</div>}
      {loading ? (
        <div className="text-[12px] text-[#86868b]">読み込み中...</div>
      ) : assets.length === 0 ? (
        <div className="rounded-md border border-[#f0f0f2] px-3 py-3 text-[12px] text-[#86868b]">
          MTGに紐づく添付はまだないよ
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {assets.map((asset, index) => (
            <AssetTile
              key={asset.assetId}
              asset={asset}
              index={index}
              count={assets.length}
              onCaptionChange={(caption) => setAssets((items) => items.map((item) => item.assetId === asset.assetId ? { ...item, caption } : item))}
              onCaptionBlur={() => patchAsset(asset.assetId, { caption: asset.caption })}
              onMoveUp={() => reorderAsset(index, -1)}
              onMoveDown={() => reorderAsset(index, 1)}
              onDelete={() => deleteAsset(asset)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AssetTile({
  asset,
  index,
  count,
  onCaptionChange,
  onCaptionBlur,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  asset: MeetingAsset;
  index: number;
  count: number;
  onCaptionChange: (value: string) => void;
  onCaptionBlur: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const isImage = asset.mediaType.startsWith("image/");
  const isPdf = asset.mediaType === "application/pdf";
  const fileLabel = isPdf ? "PDF" : asset.mediaType.split("/").pop()?.toUpperCase() || "FILE";
  return (
    <div className="overflow-hidden rounded-md border border-[#e5e5e7] bg-[#fbfbfd]">
      <div className="flex h-[150px] items-center justify-center overflow-hidden bg-[#f5f5f7]">
        {isImage ? (
          <img
            src={asset.signedUrl || asset.fileUrl}
            alt={asset.caption || asset.fileName}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <a
            href={asset.signedUrl || asset.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#3c3c43] hover:bg-[#eeeeef]"
          >
            <FileText className="h-8 w-8" aria-hidden="true" />
            <span className="max-w-[82%] truncate text-[12px] font-medium">{asset.fileName}</span>
          </a>
        )}
      </div>
      <div className="space-y-2 px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f]">
              {isImage ? <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{asset.fileName}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-[#86868b]">
              {kindLabel(asset.assetKind)} {fileLabel} {formatSize(asset.fileSizeBytes)}
            </div>
            {asset.folderDisplayPath && (
              <div className="mt-1 max-w-[210px] truncate text-[10px] text-[#6e6e73]">
                保存先: {asset.folderDisplayPath}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#d2d2d7] bg-white text-[#3c3c43] hover:bg-[#f5f5f7] disabled:opacity-35"
              title="上へ"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === count - 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#d2d2d7] bg-white text-[#3c3c43] hover:bg-[#f5f5f7] disabled:opacity-35"
              title="下へ"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
              title="削除"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <input
          value={asset.caption}
          onChange={(event) => onCaptionChange(event.target.value)}
          onBlur={onCaptionBlur}
          className="h-8 w-full rounded border border-[#d2d2d7] bg-white px-2 text-[11px] text-[#1d1d1f] outline-none focus:border-[#007aff]"
          placeholder="キャプション"
        />
      </div>
    </div>
  );
}
