import { formatDdBytes } from "@/lib/dd-format";
import type { DdLiveDocument } from "@/lib/dd-payload";

// DDの資料項目（ファイル）の表示。開く・ダウンロードは /dd/[slug]/items/[itemId]/file が、資料室の最新の実体を渡す。
// 技術台帳・資金計画・資本政策・採算は、ワークスペースと同じ部品で描く（DdLiveBodies.tsx）。

export function DdDocumentBody({
  payload,
  fileHref,
  canDownload,
  previewNote,
}: {
  payload: DdLiveDocument;
  fileHref: string | null;
  canDownload: boolean;
  previewNote?: string;
}) {
  const viewLabel = payload.preview === "html" ? "HTMLを別タブで開く" : payload.preview === "pdf" ? "PDFを別タブで開く" : null;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
        <dt className="text-[#6e6e73]">ファイル名</dt>
        <dd className="break-all text-[#1d1d1f]">{payload.fileName}</dd>
        <dt className="text-[#6e6e73]">形式・サイズ</dt>
        <dd className="text-[#1d1d1f]">
          {payload.mimeType}・{formatDdBytes(payload.sizeBytes)}
        </dd>
      </dl>
      {fileHref ? (
        <div className="flex flex-wrap gap-2">
          {viewLabel && (
            <a
              href={fileHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center rounded-md border border-[#027FDC] bg-[#027FDC] px-3 text-[12.5px] font-semibold text-white hover:bg-[#0267b2]"
            >
              {viewLabel}
            </a>
          )}
          {canDownload ? (
            <a
              href={`${fileHref}?download=1`}
              className="inline-flex min-h-9 items-center rounded-md border border-[#d2d2d7] bg-white px-3 text-[12.5px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              開示通知付きZIPをダウンロード
            </a>
          ) : (
            <span className="inline-flex min-h-9 items-center text-[12px] text-[#6e6e73]">ダウンロードの権限は付与されていない</span>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[#6e6e73]">{previewNote ?? "公開すると、ここから開ける。"}</p>
      )}
      {payload.preview === "image" && fileHref && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileHref} alt={payload.fileName} className="max-h-[70vh] max-w-full rounded border border-[#e5e5e7]" />
      )}
    </div>
  );
}
