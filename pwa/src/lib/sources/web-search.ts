/**
 * Web 検索ソース — Anthropic 公式 web_search tool を Sonnet に呼ばせて、その結果を回収する。
 *
 * Sonnet は web_search を最大 N 回まで呼び出し可能。
 * ここでは「<会社名> + 資金調達 / 設立 / 本店移転 / 受賞 / メディア」のキーワードで
 * 1 度だけ Sonnet を呼んで、結果を要約してもらう。
 *
 * env: ANTHROPIC_API_KEY (既存)
 */

import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic } from "@/lib/anthropic-client";

const SYSTEM = `あなたは Web リサーチアシスタント。
渡されたスタートアップ名 (PJ) について、ネット上の以下情報をリサーチして要約してください:
- 設立日 / 本店移転 / 法人化情報
- 資金調達ラウンド (Pre-Seed / Seed / Series A/B/C など、金額 + 投資家)
- 受賞・採択 (政府助成金 / VC ピッチ / メディア露出)
- 重要な事業マイルストーン (PoC / 製品ローンチ / パートナーシップ)
- ガバナンス / 規制対応 (許認可 / 標準化)

# 出力フォーマット
時系列で 5-15 件、各エントリは "YYYY-MM-DD: <イベント> (出典)" の 1 行。
不確かな情報は「(推定)」と明記。
情報が見つからなければ "info_not_found" とだけ返す。`;

export async function fetchWebSearchContext(companyName: string, ventureKeywords: string[] = []): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[web-search] ANTHROPIC_API_KEY not set — skipping");
    return "";
  }
  const anthropic = getBackgroundAnthropic("lib/web-search");
  const userText = `# PJ 名\n${companyName}\n\n# 関連キーワード\n${ventureKeywords.join(", ")}\n\nこの PJ について Web リサーチして時系列にまとめてください。`;
  try {
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
      tools: [
        // 公式 web_search tool (SDK 型未対応のため as unknown)
        { type: "web_search_20250305", name: "web_search", max_uses: 5 } as unknown as Anthropic.Messages.Tool,
      ],
    });
    const textBlocks = r.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text);
    return textBlocks.join("\n").trim();
  } catch (e) {
    console.error("[web-search] anthropic web_search failed:", e);
    return "";
  }
}
