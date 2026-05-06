/**
 * 自由文 → 構造化 meta jsonb (Gemini 2.5 Flash)
 *
 * POST { kind, label, raw_text }
 * → { meta: { ...kind 別のフィールド } }
 *
 * 例:
 *   kind=funding, raw_text="シードラウンドで Build VC リード 3000 万円"
 *   → { amount_yen: 30000000, lead: "Build VC", round: "seed" }
 */

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const SCHEMA_HINTS: Record<string, string> = {
  hire: `{
  "name": "<人名>", "role": "<役職>", "employment_type": "full_time|part_time|advisor|board",
  "compensation_yen_monthly": <数値|省略>, "stock_option": <bool|省略>,
  "background": "<経歴サマリ>"
}`,
  funding: `{
  "round": "preseed|seed|seriesA|seriesB|grant|other",
  "amount_yen": <総額>, "lead": "<リード投資家|null>",
  "co_investors": ["<投資家>"], "valuation_yen": <数値|省略>,
  "instrument": "equity|safe|convertible|grant"
}`,
  deal: `{
  "partner": "<相手名>", "deal_type": "poc|nda|moa|sales|license|other",
  "amount_yen": <金額|省略>, "duration_months": <期間|省略>,
  "stage": "negotiation|signed|in_progress|closed"
}`,
  tech_progress: `{
  "summary": "<技術進捗のサマリ>",
  "trl_implication": <0-9|null>, "brl_implication": <0-9|null>, "hrl_implication": <0-9|null>,
  "metrics": { "<KPI 名>": "<値>" }
}`,
  governance: `{
  "topic": "<議題>", "decision": "<決議内容>",
  "participants": ["<出席者>"], "follow_up": "<フォロー事項|省略>"
}`,
  xrl_obs: `{
  "trl": <0-9|null>, "brl": <0-9|null>, "hrl": <0-9|null>,
  "bottleneck": "TRL|BRL|HRL|null",
  "evidence": "<根拠の要約>"
}`,
  amd_score_override: `{
  "delta": <スコア加減算>, "reason": "<理由>"
}`,
  note: `{
  "topics": ["<トピック>"], "summary": "<要約>"
}`,
};

export async function POST(req: Request) {
  let body: { kind?: string; label?: string; raw_text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { kind, label, raw_text } = body;
  if (!kind || !raw_text || typeof raw_text !== "string") {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const schema = SCHEMA_HINTS[kind] || SCHEMA_HINTS.note;
  const prompt = `あなたはディープテック・スタートアップスタジオ AMD の経営アシスタント。
PJ のイベントについて、まさが自由文で書いたメモを構造化してください。

イベント種別: ${kind}
ラベル: ${label || "(なし)"}
自由文:
"""
${raw_text}
"""

下記の JSON schema にできる限り埋めて、不明な値は省略すること。
無関係な追加フィールドは入れない。

スキーマ:
${schema}

出力ルール:
- \`\`\`json ... \`\`\` で囲んだ JSON オブジェクトのみ
- 値は数値・文字列・配列・bool のみ。null は省略 (undefined にする)
- 通貨は円単位 (例: "3000 万円" → 30000000)
- 不明・該当なしの項目はキー自体を出力しない`;

  try {
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!m) {
      return NextResponse.json({ meta: {} }, { status: 200 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      return NextResponse.json({ meta: {} }, { status: 200 });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ meta: {} }, { status: 200 });
    }
    return NextResponse.json({ meta: parsed }, { status: 200 });
  } catch (e) {
    console.error("[/api/project-events/parse]", e);
    return NextResponse.json({ error: "llm error" }, { status: 500 });
  }
}
