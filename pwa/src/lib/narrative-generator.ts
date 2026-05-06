/**
 * PJ 沿革 (narrative) を Gemini 2.5 Flash で生成する純粋関数。
 *
 * 入力: project_ventures + project_xrl_log + project_events + project_venture_members + project_partners
 * 出力: NarrativeItem[] (年月 + 一行タイトル + 詳細)
 *
 * cron (`/api/cron/venture-narrative-refresh`) と単体エンドポイント両方から呼ばれる。
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface NarrativeItem {
  date: string;     // 'YYYY-MM' or 'YYYY-MM-DD'
  title: string;
  detail: string;
}

export interface NarrativeInput {
  display_name: string;
  lane: string;
  founded_at: string | null;
  outcome_pattern: string;
  origin_org: string | null;
  origin_pi: string | null;
  amd_role: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
  short_description: string | null;
  long_description: string | null;
  xrl: Array<{
    observed_at: string;
    trl: number | null;
    brl: number | null;
    hrl: number | null;
    bottleneck: string | null;
    milestone_label: string | null;
    source: string;
  }>;
  events: Array<{
    occurred_on: string;
    kind: string;
    label: string;
    meta: Record<string, unknown>;
  }>;
  members: Array<{
    full_name: string;
    role: string;
    started_at: string | null;
    ended_at: string | null;
    note: string | null;
  }>;
  partners: Array<{
    partner_name: string;
    partner_type: string;
    partner_role: string | null;
    sales_target_date: string | null;
    is_sold: boolean;
  }>;
}

export async function generateNarrativeItems(
  geminiApiKey: string,
  input: NarrativeInput
): Promise<NarrativeItem[]> {
  const prompt = `AMD (株式会社チームアルマダ) のディープテック PJ「${input.display_name}」の沿革を、
一般的な会社の「沿革」のように、年月とそのときに起きたことを並べたリストとして書いてください。

PJ メタ:
- レーン: ${input.lane}
- 起源: ${input.origin_org ?? "?"} / 代表 / PI: ${input.origin_pi ?? "?"}
- AMD 関わり方: ${input.amd_role ?? "?"}
- AMD 支援期間: ${input.amd_support_started_at ?? "?"} 〜 ${input.amd_support_ended_at ?? "現在"}
- 設立日: ${input.founded_at ?? "未設立"}
- アウトカム: ${input.outcome_pattern}
- short: ${input.short_description ?? ""}
- long: ${input.long_description ?? ""}

XRL 観測 (時系列):
${JSON.stringify(input.xrl, null, 2)}

イベント (採用 / 資金調達 / 事業契約 / ガバナンス / メモ etc):
${JSON.stringify(input.events, null, 2)}

関連メンバー (参画期間):
${JSON.stringify(input.members, null, 2)}

事業会社 (協業先 / 顧客候補):
${JSON.stringify(input.partners, null, 2)}

出力ルール:
- 年月は古い順
- 1 件 = { date: 'YYYY-MM' or 'YYYY-MM-DD', title: '一行サマリ', detail: '2-5 行の詳細' }
- title は 30〜50 字。「○○ 採用」「シードクローズ」「PoC 契約」「TRL3 到達」など端的に
- detail はその出来事の経緯・背景・影響を簡潔に。データから読み取れる範囲で
- 関連メンバーの参画開始 / 離脱もイベントとして含める (例: "山田太郎 (CTO) 参画")
- 顧客候補の販売予定が明確になった時点もイベントに
- 設立 (founded_at) は必ず 1 件入れる
- AMD 支援開始 / 終了も入れる (該当があれば)
- 推測はしない。データに無いものは書かない
- 単位ルール: SU は「PJ」と書く。「社」「ventures」「会社」と書かない
- 出力は \`\`\`json\`\`\` で囲んだ JSON 配列のみ。前置き・後書き不要`;

  const gen = new GoogleGenerativeAI(geminiApiKey);
  const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });
  const r = await model.generateContent(prompt);
  const text = r.response.text();
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
  if (!m) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (it): it is NarrativeItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as NarrativeItem).date === "string" &&
        typeof (it as NarrativeItem).title === "string"
    )
    .map((it) => ({
      date: it.date,
      title: it.title,
      detail: typeof it.detail === "string" ? it.detail : "",
    }));
}
