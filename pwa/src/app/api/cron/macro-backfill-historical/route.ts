import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ASPI_DOMAIN_IDS, type AspiDomainId } from "@/lib/aspi-lanes";

export const maxDuration = 300;

const LANES = ASPI_DOMAIN_IDS;
type LaneId = AspiDomainId;

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
  // ASPI Critical Technology Tracker 8 domain × Japan 政策マイルストーン (2010-2025)
  const LANE_CONTEXT: Record<LaneId, string> = {
    advanced_ict: `
Domain: advanced_ict (通信・ICT、HPC、暗号、cloud/edge computing、distributed ledger、cyber security)
Japan policy milestones:
- 2010-2013: 情報通信基盤整備 (光ファイバー / LTE)
- 2014: サイバーセキュリティ基本法成立
- 2015-09: サイバーセキュリティ戦略策定
- 2017: スーパーコンピュータ「京」後継機 (富岳) 予算化
- 2018: Society 5.0 → ICT 基盤の重要性上昇
- 2020-06: 富岳本格稼働 → HPC 国内優位
- 2021: デジタル庁発足 → クラウド/データ基盤政策加速
- 2022: 経済安保推進法 → ICT 重要インフラ指定
- 2023: 量子・ポスト量子暗号 標準化議論本格化
- 2024-2025: 生成 AI 基盤としての HPC/cloud 急需要、5G/6G 移行
注: 2021 年デジタル庁発足が最大の政策ジャンプ。2024 年以降の生成 AI 関連で再加速。`,

    advanced_materials_manufacturing: `
Domain: advanced_materials_manufacturing (ナノ材料、先端材料、希少金属、半導体、超電導、smart materials)
Japan policy milestones:
- 2010-09: 中国レアアース禁輸 → 材料自給戦略急浮上
- 2013: 革新的研究開発推進プログラム (ImPACT) 開始
- 2016: 次世代半導体材料 NEDOロードマップ
- 2017-2019: 米中貿易摩擦 → 半導体材料の地政学リスク
- 2020: 半導体サプライチェーン強化閣議決定
- 2021: 経済安保戦略 → 半導体・電池材料を重要物資指定
- 2022: 半導体・デジタル産業戦略 → NEDO 大型補助
- 2023: 経済安保推進法 → サプライチェーン強靭化
- 2024: NIMS・産総研への重点投資拡大
- 2025: ペロブスカイト太陽電池・全固体電池材料急拡大
注: レアアース禁輸 (2010) と半導体安保 (2021 以降) の 2 つの大波。`,

    ai_technologies: `
Domain: ai_technologies (機械学習、NLP、生成 AI、コンピュータビジョン、AI 半導体)
Japan policy milestones:
- 2010-2015: AI 第 3 次ブーム (深層学習)、産業活用は限定的
- 2016-03: 人工知能技術戦略会議 設置
- 2017-03: AI 技術戦略策定 (経産・総務・文科 連携)
- 2018: AI 戦略 2019 議論開始 → 量子・AI 統合
- 2019-06: AI 戦略 2019 閣議決定 → 教育・人材重点
- 2020: AI ガバナンス検討開始
- 2022-11: ChatGPT 登場 → 生成 AI 政策論議急加速
- 2023-05: G7 広島サミット AI ガバナンス議論主導
- 2023-08: 生成 AI 戦略 / AI 推進基本法議論開始
- 2024: AI 基盤モデル開発支援 (GENIAC 等) 大型予算化
- 2025: AI 推進基本法成立、政府生成 AI ガイドライン改訂
注: 2023 年生成 AI ブーム以降、政策密度急騰 (民間 VC も同期)。`,

    biotechnology: `
Domain: biotechnology (創薬、再生医療、AMED 優先疾患、合成生物学、ゲノム、ワクチン)
Japan policy milestones:
- 2010: 創薬支援ネットワーク構築
- 2013: 再生医療等安全性確保法 議論開始
- 2014-11: 再生医療等安全性確保法・薬事法改正 → iPS 実用化加速
- 2015: AMED 設立 → 医療研究予算一元管理
- 2016: AMED 予算本格化 (認知症・がん・難病重点)
- 2018: ゲノム医療推進法
- 2020: COVID-19 → ワクチン/治療薬開発緊急予算
- 2021: AMED 予算過去最高 (COVID 含む)
- 2022: COVID 後、創薬モダリティ多様化 (siRNA, mRNA, ADC)
- 2023: 認知症基本法 → AMED 認知症重点化
- 2024: 先進医療加算制度改革 → 治験加速
- 2025: mRNA 創薬基盤整備 AMED 重点採択
注: AMED 設立 (2015) が最大の政策転換点。COVID (2020) でさらに急騰。`,

    defence_space_robotics_transport: `
Domain: defence_space_robotics_transport (advanced robotics、drones、small satellites、hypersonic、宇宙、自律システム)
Japan policy milestones:
- 2010: 農業 IT 化 総務省補助 (ロボット)
- 2013: 日本再興戦略 → ロボット革命
- 2015: ロボット新戦略 → 産業・農業ロボ重点化
- 2016: ドローン規制整備開始 (航空法改正)
- 2017: Society 5.0 → スマート農業・建設 DX 組み込み
- 2018: 宇宙基本計画改定 → 商業宇宙加速
- 2020: 建設 DX 推進ガイドライン / コロナで無人化需要
- 2021: 防衛 3 文書改定議論開始、宇宙安全保障重視
- 2022-12: 安保 3 文書改定 → 防衛費 GDP 2% 目標 / ドローン Level4 自律飛行解禁
- 2023: 防衛技術基盤強化政策、宇宙戦略基金 創設
- 2024: 農業人手不足深刻化 → ロボット需要急増
- 2025: 自律農機安全基準策定 / 防衛装備品輸出緩和議論
注: 2022 年安保 3 文書 (防衛費 2%) が最大の政策ジャンプ。宇宙戦略基金 (2023) で宇宙加速。`,

    energy_environment: `
Domain: energy_environment (再生可能エネルギー、水素、蓄電池、核融合、circular economy、carbon capture、海洋・水資源)
Japan policy milestones:
- 2010: FIT 法議論開始、太陽光補助金
- 2012-07: FIT 法施行 → 急激な太陽光設置ブーム
- 2015-12: COP21 パリ協定採択 → 目標引き上げ機運
- 2018-19: プラスチック資源循環戦略
- 2020-10: 菅カーボンニュートラル宣言 → 指数急騰
- 2021: グリーン成長戦略 (水素/洋上風力重点)
- 2022: プラスチック資源循環促進法 / GX 実行会議設置
- 2023-05: GX 推進法施行 → カーボンプライシング開始
- 2024: EU CBAM 段階導入 / GX-ETS 試行
- 2025: 水素基本戦略改定、洋上風力大型化、EU CBAM 完全適用
注: 菅 CN 宣言 (2020-10) が最大の政策ジャンプ。GX 推進法 (2023) で加速、CBAM (2024+) で循環経済再加速。`,

    quantum: `
Domain: quantum (quantum computing / communication / sensors / post-quantum cryptography)
Japan policy milestones:
- 2010-2015: 量子基礎研究、特に光量子分野で論文先行
- 2018: ムーンショット型研究開発制度議論 (量子含む)
- 2020-01: 量子技術イノベーション戦略策定 (内閣府)
- 2020-04: ムーンショット目標 6「量子コンピュータ」設定
- 2021-09: 量子未来社会ビジョン (量子産業創出)
- 2022-04: 量子未来産業創出戦略
- 2023: G7 広島で量子・AI 統合議論
- 2023-12: 国産量子コンピュータ初号機 (理研) 稼働
- 2024: ポスト量子暗号 移行ガイドライン NIST 標準化と連動
- 2025: 量子人材育成 / Q-LEAP 拡大、産業応用フェーズへ
注: 量子戦略 (2020) が起点、国産量子コンピュータ稼働 (2023) でジャンプ。`,

    sensing_timing_navigation: `
Domain: sensing_timing_navigation (radar、photonic sensors、satellite positioning、atomic clocks、IoT センサー)
Japan policy milestones:
- 2010: 準天頂衛星初号機「みちびき」打ち上げ
- 2013: 準天頂衛星 4 機体制計画
- 2017-2018: 準天頂衛星 4 機体制完成 (cm 級測位サービス)
- 2018: Society 5.0 → IoT センサーの基盤整備
- 2020: スマート農業 / 自動運転で測位需要急増
- 2022: 準天頂衛星 7 機体制計画 (2024 から打ち上げ)
- 2023: 防衛宇宙関連でレーダー / 偵察衛星需要増
- 2024: 準天頂 5-7 号機打ち上げ開始
- 2025: 光格子時計国際標準化議論本格化
注: 準天頂衛星整備 (2010-2018) が連続的政策、防衛宇宙 (2022+) で再加速。`,
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
