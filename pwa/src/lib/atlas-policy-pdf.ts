/**
 * 重要度 high のシグナルだけ PDF まで取得して深掘り要約する。
 *
 * Anthropic SDK の document content block で PDF を直接 input できる
 * （base64 で送る）。pdf-parse などのライブラリは不要。
 *
 * Vercel Function の memory 制限を考えて 8MB 以下のPDFのみ対象。
 */
import Anthropic from "@anthropic-ai/sdk";
import type { PolicySignalDraft } from "./atlas-policy-extract";

const PDF_MAX_BYTES = 8 * 1024 * 1024; // 8MB

const COMMON_HEADERS = {
  "User-Agent":
    "AMD-Atlas-Bot/1.0 (Atlas policy collector; +https://amd-os-pwa.vercel.app)",
};

async function fetchPdfBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.warn(`[policy-pdf] ${url}: HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      console.warn(`[policy-pdf] ${url}: not a PDF (content-type=${ct})`);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > PDF_MAX_BYTES) {
      console.warn(
        `[policy-pdf] ${url}: too large (${buf.byteLength} bytes, skip)`
      );
      return null;
    }
    return Buffer.from(buf).toString("base64");
  } catch (e) {
    console.warn(`[policy-pdf] fetch err ${url}:`, e);
    return null;
  }
}

/**
 * draft の content/tags を PDF 内容で深化させる。
 * 既存 content をベースに、PDFから一次データ（数字・期限・対象範囲）を補強する。
 * 失敗したら元の draft をそのまま返す。
 */
export async function enrichWithPdf(
  draft: PolicySignalDraft,
  anthropic: Anthropic
): Promise<PolicySignalDraft> {
  const pdfUrl = draft.metadata.pdf_url;
  if (!pdfUrl) return draft;

  const b64 = await fetchPdfBase64(pdfUrl);
  if (!b64) return draft;

  const prompt = `次のPDFは日本政府の公式文書（${draft.metadata.ministry} / ${draft.metadata.doc_type}）。
AMD（armada — 新規事業開発・伴走支援）の事業判断視点で、HTMLから既に作った要約を強化してください。

【既存の要約（HTMLベース）】
タイトル: ${draft.title}
内容: ${draft.content}
タグ: ${draft.tags.join(", ")}

PDF を読んで、以下を JSON で返してください（前置き不要、\`\`\`json で囲む）:
{
  "content": "300-500字。PDF独自の数字・期限・対象範囲・予算規模・施行日などを織り込んだ、強化版の要約。AMDへの示唆も入れる",
  "additional_tags": ["PDFから読み取れる追加タグ", "1-6個"],
  "importance_revised": "high / medium / low — PDFを読んだ結果、調整したい場合のみ変更"
}`;

  try {
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: b64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const block = r.content[0];
    const text = block?.type === "text" ? block.text : "";
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (!m) return draft;
    const parsed = JSON.parse(m[1] || m[0]) as {
      content?: string;
      additional_tags?: unknown;
      importance_revised?: string;
    };

    const newTags = Array.isArray(parsed.additional_tags)
      ? parsed.additional_tags.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const mergedTags = Array.from(new Set([...draft.tags, ...newTags])).slice(0, 16);

    const importanceRevised = (["high", "medium", "low"] as const).includes(
      parsed.importance_revised as "high" | "medium" | "low"
    )
      ? (parsed.importance_revised as "high" | "medium" | "low")
      : draft.importance;

    return {
      ...draft,
      content: parsed.content || draft.content,
      tags: mergedTags,
      importance: importanceRevised,
    };
  } catch (e) {
    console.warn(`[policy-pdf] enrich err ${pdfUrl}:`, e);
    return draft;
  }
}
