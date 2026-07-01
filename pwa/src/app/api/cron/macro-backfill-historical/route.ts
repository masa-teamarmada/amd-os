import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
 * 2026-05-12 リライト (= まさ「P 以外 0 件」指摘):
 *   - 旧実装は 1 lane × 16 年 = 1 prompt で 180 オブジェクト要求 → max_tokens 8000 だが LLM が
 *     稀に途中切断 / JSON 失敗で silent continue (= 4 lane (advanced_ict / ai_technologies /
 *     quantum / sensing_timing_navigation) が一切 INSERT されてなかった真因)
 *   - 新: 1 lane × 4 年 chunk × 4 回 = 16 prompts、各 chunk = 48 オブジェクト → max_tokens 4000
 *     で安全。retry max 2 回 + chunk 単位の成否を return JSON に含める
 *   - "?lane=advanced_ict" / "?startYear=2010&endYear=2025" で個別キック可能
 *
 * Atlas が 2026-01 以降しかカバーできない期間 (2010-2025) を Sonnet に日本の政策マイルストーン
 * NEDO/AMED/METI 予算トレンドを与え、各レーン × 月 (180ヶ月) の macro index (0-1) を推定 →
 * macro_index_log に INSERT。
 *
 * 既存行は (lane, observed_at) でスキップ (= 重複保護)。
 * Bearer ${CRON_SECRET} 認証 + 手動キック対応。
 */

const CHUNK_SIZE_YEARS = 4; // 1 chunk = 4 年 = 48 ヶ月 ≈ 1500-2000 token
const DEFAULT_START_YEAR = 2010;
const DEFAULT_END_YEAR = 2025;
const MAX_RETRIES_PER_CHUNK = 2;

interface ChunkResult {
  lane: string;
  startYear: number;
  endYear: number;
  attempted: number;
  parsed: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

async function runChunk(
  db: SupabaseClient,
  anthropic: Anthropic,
  lane: LaneId,
  startYear: number,
  endYear: number,
  existingSet: Set<string>
): Promise<ChunkResult> {
  const result: ChunkResult = {
    lane,
    startYear,
    endYear,
    attempted: 0,
    parsed: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  let parsedPoints: MonthlyPoint[] = [];
  let lastErr = "";
  for (let attempt = 0; attempt < MAX_RETRIES_PER_CHUNK + 1; attempt++) {
    result.attempted = attempt + 1;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: buildPrompt(lane, startYear, endYear) }],
      });
      const text = resp.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        lastErr = `no JSON in response (preview=${text.slice(0, 120)})`;
        continue;
      }
      const arr = JSON.parse(jsonMatch[0]) as MonthlyPoint[];
      if (!Array.isArray(arr) || arr.length === 0) {
        lastErr = `empty array`;
        continue;
      }
      parsedPoints = arr;
      lastErr = "";
      break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  if (lastErr) result.errors.push(`lane=${lane} ${startYear}-${endYear}: ${lastErr}`);
  if (parsedPoints.length === 0) return result;

  result.parsed = parsedPoints.length;

  const toInsert: Array<{
    lane: string;
    observed_at: string;
    index_value: number;
    policy_density: number;
    raw_signal_count: number;
  }> = [];

  for (const pt of parsedPoints) {
    if (typeof pt.year !== "number" || typeof pt.month !== "number") continue;
    if (pt.year < startYear || pt.year > endYear) continue;
    const mm = String(pt.month).padStart(2, "0");
    const dateStr = `${pt.year}-${mm}-01`;
    const k = `${lane}_${dateStr}`;
    if (existingSet.has(k)) {
      result.skipped += 1;
      continue;
    }
    toInsert.push({
      lane,
      observed_at: dateStr,
      index_value: Math.max(0, Math.min(1, Number(pt.index_value) || 0)),
      policy_density: Math.max(0, Math.min(1, Number(pt.policy_density) || 0)),
      raw_signal_count: 0,
    });
    existingSet.add(k);
  }

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200);
      const { error } = await db.from("macro_index_log").insert(batch);
      if (error) result.errors.push(`insert ${batch.length} rows: ${error.message}`);
      else result.inserted += batch.length;
    }
  }

  return result;
}

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
  let anthropic: Anthropic;
  try {
    anthropic = getBackgroundAnthropic("cron/macro-backfill-historical");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  // パラメータ
  const laneParam = req.nextUrl.searchParams.get("lane");
  const startYearParam = req.nextUrl.searchParams.get("startYear");
  const endYearParam = req.nextUrl.searchParams.get("endYear");

  const targetLanes: LaneId[] = laneParam
    ? LANES.filter((l) => l === laneParam)
    : ([...LANES] as LaneId[]);
  if (targetLanes.length === 0) {
    return NextResponse.json({ error: `invalid lane=${laneParam}` }, { status: 400 });
  }

  const startYear = startYearParam ? parseInt(startYearParam, 10) : DEFAULT_START_YEAR;
  const endYear = endYearParam ? parseInt(endYearParam, 10) : DEFAULT_END_YEAR;

  // 既存行の (lane, observed_at) を全部取得 (= 重複保護)
  const { data: existing } = await db
    .from("macro_index_log")
    .select("lane, observed_at")
    .in("lane", targetLanes)
    .gte("observed_at", `${startYear}-01-01`)
    .lte("observed_at", `${endYear}-12-31`);
  const existingSet = new Set<string>(
    (existing ?? []).map((r) => `${r.lane}_${String(r.observed_at).slice(0, 10)}`)
  );

  // chunk = 4 年単位
  const chunks: Array<{ startYear: number; endYear: number }> = [];
  for (let y = startYear; y <= endYear; y += CHUNK_SIZE_YEARS) {
    chunks.push({ startYear: y, endYear: Math.min(y + CHUNK_SIZE_YEARS - 1, endYear) });
  }

  const results: ChunkResult[] = [];
  for (const lane of targetLanes) {
    for (const c of chunks) {
      // 既に該当 chunk が完全 (= 48 件全部存在) なら skip して LLM 呼び出さない
      let coverCount = 0;
      for (let y = c.startYear; y <= c.endYear; y++) {
        for (let m = 1; m <= 12; m++) {
          const k = `${lane}_${y}-${String(m).padStart(2, "0")}-01`;
          if (existingSet.has(k)) coverCount += 1;
        }
      }
      const expected = (c.endYear - c.startYear + 1) * 12;
      if (coverCount >= expected) {
        results.push({
          lane,
          startYear: c.startYear,
          endYear: c.endYear,
          attempted: 0,
          parsed: 0,
          inserted: 0,
          skipped: expected,
          errors: [],
        });
        continue;
      }
      const r = await runChunk(db, anthropic, lane, c.startYear, c.endYear, existingSet);
      results.push(r);
    }
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  return NextResponse.json({
    ok: totalErrors === 0,
    targetLanes,
    chunkSizeYears: CHUNK_SIZE_YEARS,
    totalChunks: results.length,
    totalInserted,
    totalErrors,
    results,
  });
}

function buildPrompt(lane: LaneId, startYear: number, endYear: number): string {
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

  const monthCount = (endYear - startYear + 1) * 12;
  return `You are a quantitative policy analyst modeling Japan's macro trend index for deep-tech venture investment.

For lane "${lane}", estimate the monthly macro trend index from January ${startYear} to December ${endYear} (${monthCount} months).

Context:
${LANE_CONTEXT[lane]}

Output requirements:
- Return a JSON ARRAY of EXACTLY ${monthCount} objects (no other text, no code fences)
- Each object: { "year": ${startYear}, "month": 1, "index_value": 0.12, "policy_density": 0.08 }
- index_value: 0-1, represents overall macro trend strength for venture founding suitability
- policy_density: 0-1, represents density of policy signals in that month
- Values should smoothly interpolate between policy milestones
- Incorporate gradual baseline growth in each lane's research maturity
- Policy events cause sudden jumps (0.05-0.15 step increase over 1-3 months)
- Between events, values drift slightly up or down based on momentum

Important: Start the array with January ${startYear} (month 1) and end with December ${endYear} (month 12).
Output ONLY the JSON array, nothing else.`;
}
