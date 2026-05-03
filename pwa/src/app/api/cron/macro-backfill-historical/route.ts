import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const LANES = ["gx_energy", "gx_circular", "materials", "life", "robo"] as const;
type LaneId = (typeof LANES)[number];

interface MonthlyPoint {
  year: number;
  month: number; // 1-12
  index_value: number;    // 0-1
  policy_density: number; // 0-1
}

/**
 * 過去マクロ指数バックフィル cron (Sonnet 駆動)
 *
 * Atlas が 2026-01 以降しかカバーできない期間 (2010-2025) を
 * Sonnet に日本の政策マイルストーン・NEDO/AMED/METI予算トレンドを与え、
 * 各レーン × 月 (180ヶ月) の macro index (0-1) を推定させて macro_index_log に INSERT。
 *
 * 既存行は ON CONFLICT DO NOTHING で保護。
 * Bearer ${CRON_SECRET} 認証 + 手動キック対応。
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not set, skipping" }, { status: 200 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }

  const db = createClient(url, key);
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // どの月がまだ存在しないか確認（バッチを lanes × year 単位で投入）
  const { data: existing } = await db
    .from("macro_index_log")
    .select("lane, observed_at")
    .lt("observed_at", "2026-01-01");

  const existingSet = new Set<string>(
    (existing || []).map((r) => `${r.lane}_${r.observed_at}`)
  );

  // レーンごとにプロンプト発行 (5回)
  const allInserts: {
    lane: string;
    observed_at: string;
    index_value: number;
    policy_density: number;
    raw_signal_count: number;
  }[] = [];

  for (const lane of LANES) {
    const prompt = buildPrompt(lane);
    let parsed: Record<string, MonthlyPoint[]>;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`[macro-backfill] no JSON for lane ${lane}`, text.slice(0, 200));
        continue;
      }
      const arr = JSON.parse(jsonMatch[0]) as MonthlyPoint[];
      parsed = { [lane]: arr };
    } catch (e) {
      console.error(`[macro-backfill] error for lane ${lane}`, e);
      continue;
    }

    for (const pt of parsed[lane] || []) {
      const mm = String(pt.month).padStart(2, "0");
      const dateStr = `${pt.year}-${mm}-01`;
      const key = `${lane}_${dateStr}`;
      if (existingSet.has(key)) continue;

      allInserts.push({
        lane,
        observed_at: dateStr,
        index_value: Math.max(0, Math.min(1, pt.index_value)),
        policy_density: Math.max(0, Math.min(1, pt.policy_density)),
        raw_signal_count: 0, // 推定値のためシグナル数は0
      });
    }
  }

  if (allInserts.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "already filled or nothing new" });
  }

  // バッチ INSERT (200件ずつ)
  let inserted = 0;
  for (let i = 0; i < allInserts.length; i += 200) {
    const batch = allInserts.slice(i, i + 200);
    const { error } = await db.from("macro_index_log").insert(batch);
    if (!error) inserted += batch.length;
    else console.error("[macro-backfill] insert error", error.message);
  }

  return NextResponse.json({ ok: true, inserted, total: allInserts.length });
}

function buildPrompt(lane: LaneId): string {
  const LANE_CONTEXT: Record<LaneId, string> = {
    gx_energy: `
Lane: gx_energy (再生可能エネルギー、水素、蓄電池、DC冷却、核融合)
Japan policy milestones:
- 2010: FIT法議論開始、太陽光補助金
- 2012-07: FIT法施行 → 急激な太陽光設置ブーム
- 2014: エネルギー基本計画 (再エネ優先度は中程度)
- 2015-12: COP21 パリ協定採択 → 目標引き上げ機運
- 2016-11: パリ協定発効
- 2020-10: 菅カーボンニュートラル宣言 → 指数急騰
- 2021: グリーン成長戦略 (水素/洋上風力重点)
- 2022-07: GX実行会議設置 → 政策加速
- 2023-05: GX推進法施行 → カーボンプライシング開始
- 2024: GX-ETS試行開始、DC冷却投資急増
- 2025: 水素基本戦略改定、洋上風力大型化
注: FIT後(2013-2015)は一時的に政策密度が落ち着いた後、パリ協定→菅宣言で再加速。`,

    gx_circular: `
Lane: gx_circular (廃棄物処理、リサイクル、ESG、水処理)
Japan policy milestones:
- 2010: 循環型社会推進基本法継続、希少金属回収義務
- 2013: 廃棄物処理法改正
- 2015: SDGs採択 → ESG投資機運
- 2018: 海洋プラスチック問題 (G7) → 規制圧力
- 2019: プラスチック資源循環戦略
- 2020: カーボンニュートラル宣言 → リサイクル再評価
- 2022: プラスチック資源循環促進法施行 → 急加速
- 2023: GX推進法 → サーキュラーエコノミー組み込み
- 2024: EU CBAM段階導入 → 輸出企業がサーキュラーに注力
- 2025: EU CBAM完全適用 / AMED生分解プラ助成
注: 2022年プラ法施行が最大の政策イベント、2024 CBAM で再度急騰。`,

    materials: `
Lane: materials (レアアース、半導体、ナノ材料、透明断熱素材)
Japan policy milestones:
- 2010-09: 中国レアアース禁輸 → 材料自給戦略急浮上
- 2013: 革新的研究開発推進プログラム (ImPACT) 開始
- 2016: 次世代半導体材料 NEDOロードマップ
- 2017-2019: 米中貿易摩擦 → 半導体材料の地政学リスク
- 2020: 半導体サプライチェーン強化閣議決定
- 2021: 経済安保戦略 → 半導体・電池材料を重要物資指定
- 2022: 半導体・デジタル産業戦略 → NEDO大型補助
- 2023: 経済安保推進法 → サプライチェーン強靭化
- 2024: NIMS・産総研への重点投資拡大
- 2025: ペロブスカイト太陽電池・全固体電池材料急拡大
注: レアアース禁輸(2010)と半導体安保(2021以降)の2つの大波。間の2016-2019は相対的低迷。`,

    life: `
Lane: life (創薬、再生医療、AMED優先疾患、バイオ)
Japan policy milestones:
- 2010: 創薬支援ネットワーク構築
- 2013: 再生医療等安全性確保法 議論開始
- 2014-11: 再生医療等安全性確保法・薬事法改正 → iPS実用化加速
- 2015: AMED設立 → 医療研究予算一元管理
- 2016: AMED予算本格化 (認知症・がん・難病重点)
- 2018: ゲノム医療推進法
- 2020: COVID-19 → ワクチン/治療薬開発緊急予算
- 2021: AMED予算過去最高 (COVID含む)
- 2022: COVID後、創薬モダリティ多様化 (siRNA, mRNA, ADC)
- 2023: 認知症基本法 → AMED認知症重点化
- 2024: 先進医療加算制度改革 → 治験加速
- 2025: mRNA創薬基盤整備 AMED重点採択
注: AMED設立(2015)が最大の政策転換点。COVID(2020)でさらに急騰。`,

    robo: `
Lane: robo (農業ロボ、建設DX、ドローン、自動化)
Japan policy milestones:
- 2010: 農業IT化 総務省補助
- 2013: 日本再興戦略 → ロボット革命
- 2015: ロボット新戦略 → 産業・農業ロボ重点化
- 2016: ドローン規制整備開始 (航空法改正)
- 2017: Society 5.0 → スマート農業・建設DX組み込み
- 2019: スマート農業加速化実証 全国展開
- 2020: 建設DX推進ガイドライン / コロナで無人化需要
- 2021: 農水省スマート農業目標設定、ドローン飛行規制緩和
- 2022: ドローン国家資格化 / Level4自律飛行解禁
- 2023: 農業ロボット補助金拡充 / 建設DX標準化
- 2024: 農業人手不足 深刻化 → ロボット需要急増
- 2025: 自律農機安全基準策定 / スマート農業普及目標
注: ロボット新戦略(2015)とドローン規制緩和(2021-2022)が2大政策ジャンプ。`,
  };

  return `You are a quantitative policy analyst modeling Japan's macro trend index for deep-tech venture investment.

For lane "${lane}", estimate the monthly macro trend index from January 2010 to December 2025 (180 months).

Context:
${LANE_CONTEXT[lane]}

Output requirements:
- Return a JSON ARRAY of 180 objects (no other text, no code fences)
- Each object: { "year": 2010, "month": 1, "index_value": 0.12, "policy_density": 0.08 }
- index_value: 0-1, represents overall macro trend strength for venture founding suitability
- policy_density: 0-1, represents density of policy signals in that month
- Values should smoothly interpolate between policy milestones
- Incorporate gradual baseline growth in each lane's research maturity
- Policy events cause sudden jumps (0.05-0.15 step increase over 1-3 months)
- Between events, values drift slightly up or down based on momentum

Important: Start the array with January 2010 (month 1) and end with December 2025 (month 12).
Output ONLY the JSON array, nothing else.`;
}
