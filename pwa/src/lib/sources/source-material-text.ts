import crypto from "node:crypto";
import { strFromU8, unzipSync } from "fflate";

export type SourceTextMethod =
  | "native_text"
  | "pdf_text"
  | "office_text"
  | "plain_text"
  | "ocr"
  | "metadata_only"
  | "unavailable";

export type SourceTextStatus = "available" | "partial" | "missing";

export type SourcePageMarker = { page: number; text: string };

export type SourceTextResult = {
  text: string;
  method: SourceTextMethod;
  status: SourceTextStatus;
  contentSha256: string;
  pageMarkers: SourcePageMarker[];
  needsOcr: boolean;
  warning: string | null;
};

export type SourceOcr = (input: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  reason: "scanned_pdf" | "image";
}) => Promise<{ text: string; pageMarkers?: SourcePageMarker[] }>;

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const IMAGE_MIME_RE = /^image\/(?:png|jpe?g|webp|tiff?)$/i;
const PLAIN_MIME_RE = /^(?:text\/|application\/(?:json|xml|csv))/i;
const MIN_USEFUL_TEXT = 16;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 160;

/**
 * Drive等から取得した原本bytesを、重要度判定へ渡せる共通テキストへ変換する。
 * raw本文は返すだけで保存しない。OCRは呼び出し側から明示的に注入し、
 * 読めなかった場合も missing/needsOcr として残して「情報なし」にしない。
 */
export async function extractSourceText(input: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  ocr?: SourceOcr;
}): Promise<SourceTextResult> {
  const bytes = input.bytes;
  const mimeType = String(input.mimeType || "").toLowerCase();
  const contentSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength === 0) return missing(contentSha256, false, "empty_file");
  if (bytes.byteLength > MAX_BYTES) return missing(contentSha256, false, "file_too_large");

  try {
    if (mimeType === PDF_MIME || input.filename.toLowerCase().endsWith(".pdf")) {
      const pdf = await extractPdfText(bytes);
      if (isUseful(pdf.text)) {
        return {
          text: normalizeSourceText(pdf.text),
          method: "pdf_text",
          status: pdf.partial ? "partial" : "available",
          contentSha256,
          pageMarkers: pdf.pageMarkers,
          needsOcr: false,
          warning: pdf.warning,
        };
      }
      return ocrOrMissing(input, contentSha256, "scanned_pdf", pdf.warning || "pdf_text_missing");
    }
    if (mimeType === DOCX_MIME || input.filename.toLowerCase().endsWith(".docx")) {
      return available(extractDocxText(bytes), "office_text", contentSha256);
    }
    if (mimeType === XLSX_MIME || input.filename.toLowerCase().endsWith(".xlsx")) {
      return available(extractXlsxText(bytes), "office_text", contentSha256);
    }
    if (mimeType === PPTX_MIME || input.filename.toLowerCase().endsWith(".pptx")) {
      return available(extractPptxText(bytes), "office_text", contentSha256);
    }
    if (IMAGE_MIME_RE.test(mimeType)) {
      return ocrOrMissing(input, contentSha256, "image", "image_requires_ocr");
    }
    if (PLAIN_MIME_RE.test(mimeType) || /\.(?:txt|md|csv|json|xml|html?)$/i.test(input.filename)) {
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return available(/html/i.test(mimeType) || /\.html?$/i.test(input.filename) ? xmlToText(decoded) : decoded, "plain_text", contentSha256);
    }
    return missing(contentSha256, false, `unsupported_mime:${mimeType || "unknown"}`);
  } catch (error) {
    return missing(contentSha256, mimeType === PDF_MIME || IMAGE_MIME_RE.test(mimeType), `extract_failed:${safeError(error)}`);
  }
}

export function normalizeSourceText(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(bytes: Uint8Array): Promise<{
  text: string;
  pageMarkers: SourcePageMarker[];
  partial: boolean;
  warning: string | null;
}> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const proxy = await withTimeout(getDocumentProxy(bytes, { maxImageSize: 16_777_216 }), 15_000, "pdf_open_timeout");
  const totalPages = proxy.numPages;
  if (totalPages > MAX_PDF_PAGES) {
    const destroy = (proxy as unknown as { destroy?: () => Promise<void> }).destroy;
    if (typeof destroy === "function") await destroy.call(proxy);
    return { text: "", pageMarkers: [], partial: true, warning: `pdf_page_limit:${totalPages}` };
  }
  try {
    const extracted = await withTimeout(extractText(proxy, { mergePages: false }), 30_000, "pdf_text_timeout");
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    const pageMarkers = pages.map((text, index) => ({ page: index + 1, text: normalizeSourceText(text) }));
    return {
      text: pageMarkers.map((page) => page.text).filter(Boolean).join("\n\n"),
      pageMarkers,
      partial: false,
      warning: null,
    };
  } finally {
    const destroy = (proxy as unknown as { destroy?: () => Promise<void> }).destroy;
    if (typeof destroy === "function") await destroy.call(proxy);
  }
}

function extractDocxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const names = Object.keys(files)
    .filter((name) => /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name))
    .sort((a, b) => docxOrder(a) - docxOrder(b) || a.localeCompare(b));
  return names.map((name) => xmlToText(strFromU8(files[name]))).filter(Boolean).join("\n\n");
}

function extractPptxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const names = Object.keys(files)
    .filter((name) => /^ppt\/(?:slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(name))
    .sort(naturalNameSort);
  return names.map((name) => xmlToText(strFromU8(files[name]))).filter(Boolean).join("\n\n");
}

function extractXlsxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const shared = files["xl/sharedStrings.xml"]
    ? [...strFromU8(files["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => xmlToText(match[1]))
    : [];
  const sheetNames = Object.keys(files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort(naturalNameSort);
  const rows: string[] = [];
  for (const sheetName of sheetNames) {
    const xml = strFromU8(files[sheetName]);
    const cells: string[] = [];
    for (const cell of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cell[1];
      const body = cell[2];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "";
      const value = /\bt=["']s["']/.test(attrs) ? shared[Number(raw)] || "" : xmlToText(raw);
      if (value) cells.push(value);
    }
    if (cells.length > 0) rows.push(`${sheetName}\n${cells.join("\n")}`);
  }
  return rows.join("\n\n");
}

async function ocrOrMissing(
  input: { bytes: Uint8Array; mimeType: string; filename: string; ocr?: SourceOcr },
  contentSha256: string,
  reason: "scanned_pdf" | "image",
  warning: string,
): Promise<SourceTextResult> {
  if (!input.ocr) return missing(contentSha256, true, warning);
  const result = await input.ocr({ bytes: input.bytes, mimeType: input.mimeType, filename: input.filename, reason });
  const text = normalizeSourceText(result.text);
  if (!isUseful(text)) return missing(contentSha256, true, "ocr_text_missing");
  return {
    text,
    method: "ocr",
    status: "available",
    contentSha256,
    pageMarkers: result.pageMarkers || [],
    needsOcr: false,
    warning: null,
  };
}

function available(textValue: string, method: SourceTextMethod, contentSha256: string): SourceTextResult {
  const text = normalizeSourceText(textValue);
  return isUseful(text)
    ? { text, method, status: "available", contentSha256, pageMarkers: [], needsOcr: false, warning: null }
    : missing(contentSha256, false, "text_missing_after_extract");
}

function missing(contentSha256: string, needsOcr: boolean, warning: string): SourceTextResult {
  return { text: "", method: needsOcr ? "metadata_only" : "unavailable", status: "missing", contentSha256, pageMarkers: [], needsOcr, warning };
}

function isUseful(text: string): boolean {
  return normalizeSourceText(text).replace(/\s/g, "").length >= MIN_USEFUL_TEXT;
}

function xmlToText(xml: string): string {
  return normalizeSourceText(
    String(xml || "")
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<w:br\s*\/>/g, "\n")
      .replace(/<\/(?:w:p|a:p|row|tr|p|div|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_all, value) => String.fromCodePoint(Number(value)))
      .replace(/&#x([0-9a-f]+);/gi, (_all, value) => String.fromCodePoint(Number.parseInt(value, 16))),
  );
}

function naturalNameSort(a: string, b: string): number {
  const an = Number(a.match(/(\d+)(?=\.xml$)/)?.[1] || 0);
  const bn = Number(b.match(/(\d+)(?=\.xml$)/)?.[1] || 0);
  return an - bn || a.localeCompare(b);
}

function docxOrder(name: string): number {
  if (name.endsWith("document.xml")) return 0;
  if (name.includes("header")) return 1;
  if (name.includes("footer")) return 2;
  if (name.includes("footnotes")) return 3;
  return 4;
}

function safeError(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(/\s+/g, " ").slice(0, 120);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(label)), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
