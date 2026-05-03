/**
 * 政府方針シグナルの一次フィルタ — Gemini 2.5 Flash で軽量判定。
 *
 * RawPolicyItem の配列を受け取り、AMD（armada — 新規事業開発・素材/エネルギー/モビリティ等）の
 * 事業判断に効くものだけ残す。バッチで複数件まとめて判定する（呼び出し回数を抑える）。
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RawPolicyItem } from "./atlas-policy-sources";

export interface FilteredPolicyItem extends RawPolicyItem {
  relevance: "high" | "medium" | "low";
  filter_reason: string;
}

const BATCH_SIZE = 30;

const INSTRUCTIONS = `あなたはAMD（armada）— 新規事業開発・インキュベーション・伴走支援を行う組織 — 向けの政策スカウトです。
日本政府の発表/プレスリリース一覧から、以下のいずれかに該当するものを「効く」と判定してください:

- 新規事業の参入領域や追い風/向かい風が変わる政策（戦略文書・基本計画・補助金公募・規制施行）
- 素材/エネルギー/モビリティ/AI/バイオ/建築/水/食農/サーキュラー など産業構造に関わるもの
- 法令改正・パブリックコメント・閣議決定（産業に効く範囲で）
- 大型予算・税制・国際協定（事業環境を変える可能性のあるもの）

逆に「効かない」と判定する例:
- 人事異動・受章・表彰・記者会見開催案内（中身に新規方針が無いもの）
- 通常の統計公表（変動なく継続的）
- 開催案内・会議資料の単なるアップロード
- 個別の補助金「採択結果」（全体方針より個別企業の話）— ただし大型・象徴的なら medium で残す
- 災害復旧の作業報告（方針性なし）

各項目について relevance を "high" / "medium" / "low" で返す:
- high: AMD の判断に直接影響しうる方針
- medium: 注目しておく価値がある
- low: ノイズ（投入しない）`;

/**
 * バッチごとに Gemini Flash に投げて relevance を判定。
 * low 判定のアイテムは捨てる。
 */
export async function filterRelevantPolicyItems(
  items: RawPolicyItem[],
  geminiKey: string
): Promise<FilteredPolicyItem[]> {
  if (items.length === 0) return [];

  const gen = new GoogleGenerativeAI(geminiKey);
  const model = gen.getGenerativeModel({ model: "gemini-2.5-flash" });

  // バッチを並列で投げる（Gemini Flash は無料枠 RPM が大きい）
  const batches: RawPolicyItem[][] = [];
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    batches.push(items.slice(offset, offset + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const list = batch
        .map(
          (it, i) =>
            `[${i}] (${it.ministry}) ${it.title}${it.raw_summary ? ` — ${it.raw_summary.slice(0, 200)}` : ""}`
        )
        .join("\n");

      const prompt = `${INSTRUCTIONS}

判定対象リスト:
${list}

JSON 配列のみで返す。各要素は { "i": 番号, "relevance": "high"|"medium"|"low", "reason": "30字以内" }。
\`\`\`json で囲んでください。`;

      try {
        const r = await model.generateContent(prompt);
        const text = r.response.text();
        const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
        if (!m) {
          console.warn("[policy-filter] no JSON in batch");
          return [] as FilteredPolicyItem[];
        }
        const arr = JSON.parse(m[1]) as Array<{ i: number; relevance: string; reason: string }>;
        const accepted: FilteredPolicyItem[] = [];
        for (const j of arr) {
          const item = batch[j.i];
          if (!item) continue;
          if (j.relevance === "high" || j.relevance === "medium") {
            accepted.push({
              ...item,
              relevance: j.relevance,
              filter_reason: j.reason || "",
            });
          }
        }
        return accepted;
      } catch (e) {
        console.warn("[policy-filter] batch err:", e);
        return [] as FilteredPolicyItem[];
      }
    })
  );
  return results.flat();
}
