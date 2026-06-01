import type { SupabaseClient } from "@supabase/supabase-js";

type Axis = "initiative" | "finance" | "retention" | "pipeline" | "direction";

interface RawSignal {
  id: string;
  ym: string;
  axis: Axis;
  source_kind: string;
  source_table: string;
  source_id: string;
  signal_key: string;
  signal_value_numeric: number | string | null;
  signal_value_text: string | null;
  project_id: string | null;
  observed_at: string | null;
  confidence: number | string;
  weight_hint: number | string;
  payload: Record<string, unknown>;
  source_hash: string;
}

interface ScoreContext {
  projectNames: Map<string, string>;
  memberNames: Map<string, string>;
  previousAxisScore: Record<Axis, number | null>;
}

interface AxisScore {
  score: number;
  confidence: number;
  inputs: Record<string, unknown>;
  evidence: EvidenceInput[];
}

interface EvidenceInput {
  axis: Axis;
  evidence_kind: string;
  summary: string;
  source_type: string;
  source_ref: string;
  source_hash?: string | null;
  impact: number;
  confidence: number;
  payload?: Record<string, unknown>;
}

interface CalculateResult {
  ok: boolean;
  ym: string;
  snapshotId: string;
  scores: Record<Axis | "total", number>;
  confidence: number;
  evidenceCount: number;
}

/**
 * バイタルサイン v4 計算式 (= 2026-05-26 まさ #82 確定)
 *
 *   total_score = base_total × initiative_modifier × death_clamp
 *
 *   base_total = 0.30 × finance + 0.30 × initiative + 0.20 × retention
 *              + ω_pipeline × pipeline + 0.15 × direction
 *
 *   ω_pipeline は現行 PJ 平均残期間で動的:
 *     残期間 > 12 ヶ月 → 0.05  (= 工数優先、新規不要)
 *     残期間 6〜12 ヶ月 → 0.10  (= 中間)
 *     残期間 < 6 ヶ月 → 0.20  (= 営業必須)
 *
 *   initiative_modifier (= 不可逆閾値):
 *     先手力 ≥ 90% → ×1.0  (= 健全)
 *     先手力 70-90% → ×0.7  (= 警告ゾーン)
 *     先手力 < 70% → ×0.3  (= 致命ゾーン、巻き返し困難)
 *
 *   death_clamp (= 死亡判定):
 *     net_assets < 0 (= 債務超過) → total = 0
 *     runway < 1 ヶ月 → total = min(total, 10)
 *
 * 詳細は pwa/manual/4-5-management-score-and-finance-simulation-spec.md 参照。
 */
const WEIGHTS_FIXED: Pick<Record<Axis, number>, "finance" | "initiative" | "retention" | "direction"> = {
  finance: 0.30,
  initiative: 0.30,
  retention: 0.20,
  direction: 0.15,
};

function computePipelineOmega(projects: Array<{ end_ym?: string | null }>, currentYm: string): { omega: number; remainingMonthsAvg: number | null; reasoning: string } {
  // status='active' で end_ym が設定されてる PJ を対象に残期間を計算
  // - end_ym 過去 → 「データ更新漏れ (= status 更新されてない)」 として残期間 0 で含める (= まさ #90)
  //   旧ロジックでは「既に終了」として除外していたが、 これだと残期間 0 の PJ がカウントされず
  //   「現行 PJ 全部終了」 のような誤判定が発生していた。
  // - end_ym 未設定 → 残期間不明、 平均計算から除外
  const withEnd = projects.filter((p) => p.end_ym && /^\d{6}$/.test(p.end_ym));
  if (withEnd.length === 0) {
    return { omega: 0.10, remainingMonthsAvg: null, reasoning: "現行 active PJ の end_ym がすべて未設定、 ω は中間値 0.10 で計算" };
  }
  const remainings = withEnd.map((p) => {
    const endY = Number(p.end_ym!.slice(0, 4));
    const endM = Number(p.end_ym!.slice(4, 6));
    const curY = Number(currentYm.slice(0, 4));
    const curM = Number(currentYm.slice(4, 6));
    const diff = (endY - curY) * 12 + (endM - curM);
    return Math.max(0, diff); // 過去 end_ym (= status 更新漏れ) は残期間 0 として含める
  });
  const avg = remainings.reduce((a, b) => a + b, 0) / remainings.length;
  if (avg > 12) return { omega: 0.05, remainingMonthsAvg: avg, reasoning: `現行 active PJ 平均残期間 ${avg.toFixed(1)} ヶ月 > 12、 ω 0.05 (= まさ工数優先、 新規取らなくていい)` };
  if (avg >= 6) return { omega: 0.10, remainingMonthsAvg: avg, reasoning: `現行 active PJ 平均残期間 ${avg.toFixed(1)} ヶ月、 ω 0.10 (= 中間)` };
  return { omega: 0.20, remainingMonthsAvg: avg, reasoning: `現行 active PJ 平均残期間 ${avg.toFixed(1)} ヶ月 < 6、 ω 0.20 (= 営業必須、 残期間枯渇)` };
}

function computeInitiativeModifier(initiativeScore: number): { modifier: number; zone: "healthy" | "warning" | "critical"; label: string } {
  if (initiativeScore >= 90) return { modifier: 1.0, zone: "healthy", label: "健全 (≥90%)" };
  if (initiativeScore >= 70) return { modifier: 0.7, zone: "warning", label: "警告ゾーン (70-90%、 早期対応推奨)" };
  return { modifier: 0.3, zone: "critical", label: "致命ゾーン (<70%、 巻き返し困難)" };
}

function computeDeathClamp(total: number, financeInputs: Record<string, unknown>): { clampedTotal: number; flag: string | null } {
  const netAssets = financeInputs.netAssets;
  if (typeof netAssets === "number" && netAssets < 0) {
    return { clampedTotal: 0, flag: "insolvent" };
  }
  const runway = num(financeInputs.runway, 999);
  if (runway < 1) {
    return { clampedTotal: Math.min(total, 10), flag: "runway_lt_1" };
  }
  return { clampedTotal: total, flag: null };
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function avg(values: number[], fallback = 0): number {
  if (values.length === 0) return fallback;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function topBy<T>(rows: T[], getValue: (row: T) => number, limit = 5): T[] {
  return [...rows].sort((a, b) => Math.abs(getValue(b)) - Math.abs(getValue(a))).slice(0, limit);
}

function sourceRef(row: RawSignal) {
  return `${row.source_table}:${row.source_id}:${row.signal_key}`;
}

function brief(row: RawSignal) {
  return String(row.signal_value_text || row.signal_key || sourceRef(row)).slice(0, 120);
}

function fmtYen(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億円`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(1)}万円`;
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function fmtDelta(delta: number | null | undefined, unit = "点"): string {
  if (delta == null || !Number.isFinite(delta)) return "";
  if (Math.abs(delta) < 0.5) return `±0${unit}`;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta)}${unit}`;
}

function deltaDesc(delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.5) return "横ばい";
  if (delta >= 8) return "大きく上昇";
  if (delta > 0) return "上昇";
  if (delta <= -8) return "大きく下降";
  return "下降";
}

function projectLabel(ctx: ScoreContext, projectId: string | null | undefined): string {
  if (!projectId) return "";
  return ctx.projectNames.get(projectId) || projectId;
}

function memberLabel(ctx: ScoreContext, payload: Record<string, unknown>): string {
  const memberId = payload?.member_id != null ? String(payload.member_id) : null;
  if (!memberId) return "誰か";
  return ctx.memberNames.get(memberId) || memberId;
}

function originLabel(origin: unknown): string {
  switch (String(origin || "unknown")) {
    case "amd_proposed": return "AMD起点";
    case "co_decided": return "共同決定";
    case "client_requested": return "クライアント要望";
    case "partner_proposed": return "パートナー起点";
    case "external": return "外部環境起点";
    default: return "起点不明";
  }
}

function categoryLabel(category: unknown): string {
  switch (String(category || "")) {
    case "revenue": return "売上";
    case "project_revenue": return "PJ売上";
    case "cost_member": return "メンバー原価";
    case "cost_closer": return "クローザー原価";
    case "gross_profit": return "粗利";
    case "fixed_cost": return "固定費";
    case "social_insurance": return "社保";
    case "operating_profit": return "営業利益";
    case "loan_payment": return "借入返済";
    case "loan_interest": return "支払利息";
    case "tax_payment_consumption": return "消費税";
    case "tax_payment_corporate": return "法人税";
    case "net_cash_flow": return "純CF";
    default: return String(category || "");
  }
}

/**
 * 予実 variance の好調 / 注意判定。 収益系か費用系かでフラグが反転する。
 *
 * - 収益系 (= 売上 / PJ売上 / 粗利 / 営業利益 / 純CF): variance > 0 (= 上振れ) が好調
 * - 費用系 (= メンバー原価 / 固定費 / 社保 / 借入返済 / 利息 / 税): variance < 0 (= 下振れ) が好調
 *
 * v3 までは `cat === "売上" || ...` の限定リストで判定していたため、
 * `project_revenue` (= categoryLabel で "PJ売上") が fallback 分岐に落ちて
 * 「下振れ 100% = 好調」と誤判定するバグがあった (= まさ #81)。
 */
function isFavorableVariance(category: string, variance: number): boolean {
  const revenueLike = new Set(["売上", "PJ売上", "粗利", "営業利益", "純CF"]);
  return revenueLike.has(category) ? variance > 0 : variance < 0;
}

/**
 * 先手力 v4 (= 減点方式)
 *
 * - デフォルトは 100。
 * - `partner_proposed` / `external` で **impact >= 3** の events のみ減点対象。
 * - `amd_proposed` / `co_decided` / `unknown` / `client_requested` / `impact<3` は減点しない。
 * - 卒業 PJ 除外は raw-data 側 (= Phase 3 で member_activities filter に追加) で実施。
 * - 入力 events が極端に少ない月 (= total < 5) は confidence を 0.3 まで落とし、UI で「データ不足」表示する。
 *
 * v3 までの加点方式 (= AMD起点率) は origin unknown 多発で破綻していた (= まさ #82 2026-05-26 確定)。
 */
function scoreInitiative(rows: RawSignal[], ctx: ScoreContext): AxisScore {
  const events = rows.filter((row) => row.source_table === "member_activities");
  const passiveEvents = events.filter((row) => {
    const isPassiveOrigin = row.signal_key.includes("partner_proposed") || row.signal_key.includes("external");
    if (!isPassiveOrigin) return false;
    const impact = num(row.payload?.impact, 0);
    return impact >= 3;
  });
  const totalEvents = events.length;
  const passiveRatio = totalEvents > 0 ? passiveEvents.length / totalEvents : 0;
  const score = clamp(100 - passiveRatio * 100, 0, 100);

  const amdProposedCount = events.filter((r) => r.signal_key.includes("amd_proposed")).length;
  const coDecidedCount = events.filter((r) => r.signal_key.includes("co_decided")).length;
  const unknownCount = events.filter((r) => r.signal_key.includes("unknown")).length;
  const lowConfidence = totalEvents < 5;
  const confidence = lowConfidence ? 0.3 : clamp(0.85 - (unknownCount / Math.max(1, totalEvents)) * 0.2, 0.4, 0.9);

  const prev = ctx.previousAxisScore.initiative;
  const delta = prev != null ? score - prev : null;
  const thresholdNote =
    score < 70 ? " 🚨 致命ゾーン (= 70% 未満、 巻き返し困難)。"
    : score < 90 ? " ⚠️ 警告ゾーン (= 90% 未満、 早期対応推奨)。"
    : "";
  const dataNote = lowConfidence ? ` events 件数 ${totalEvents} < 5、 データ不足 confidence 低下。` : "";
  const summarySentence = `先手力 ${Math.round(score)}点 (前月比 ${fmtDelta(delta)}, ${deltaDesc(delta)})。受身 events ${passiveEvents.length}/${totalEvents} 件 (= partner_proposed / external で impact≥3)、AMD起点 ${amdProposedCount} 件・共同決定 ${coDecidedCount} 件。${thresholdNote}${dataNote}`;

  const formulaEvidence = {
    axis: "initiative" as const,
    evidence_kind: "axis_summary",
    summary: summarySentence,
    source_type: "computed",
    source_ref: "member_activities (initiative_origin × impact、減点方式 v4)",
    source_hash: null,
    impact: delta ?? (score - 50) / 2,
    confidence,
    payload: { score, prev, delta, totalEvents, passiveEvents: passiveEvents.length, passiveRatio, amdProposedCount, coDecidedCount, unknownCount, scoreZone: score < 70 ? "critical" : score < 90 ? "warning" : "healthy" },
  };

  // 減点要因 (= 受身 events) を evidence として上位 6 件表示
  const passiveEvidence = passiveEvents.slice(0, 6).map((row) => {
    const origin = row.payload?.initiative_origin;
    const impact = num(row.payload?.impact, 0);
    const depth = num(row.payload?.depth, 0);
    const who = memberLabel(ctx, row.payload);
    const what = String(row.payload?.title || row.signal_value_text || "(タイトル無)").slice(0, 60);
    const pjLabel = projectLabel(ctx, row.project_id);
    const pjPart = pjLabel ? ` [${pjLabel}]` : "";
    const datePart = row.observed_at ? row.observed_at.slice(0, 10) : "";
    return {
      axis: "initiative" as const,
      evidence_kind: "passive_event",
      summary: `${datePart} ${who}: 「${what}」${pjPart} (${originLabel(origin)}, impact ${impact}) — 他人主導イベント、 先手力減点`,
      source_type: row.source_table,
      source_ref: sourceRef(row),
      source_hash: row.source_hash,
      impact: -10,
      confidence: num(row.confidence, 0.5),
      payload: { project_id: row.project_id, project_name: pjLabel, member: who, origin, impact, depth },
    };
  });

  // AMD 起点 events の上位 3 件も「健全な動き」 evidence として残す
  const proactiveEvidence = events
    .filter((row) => row.signal_key.includes("amd_proposed"))
    .slice(0, 3)
    .map((row) => {
      const who = memberLabel(ctx, row.payload);
      const what = String(row.payload?.title || row.signal_value_text || "(タイトル無)").slice(0, 60);
      const pjLabel = projectLabel(ctx, row.project_id);
      const pjPart = pjLabel ? ` [${pjLabel}]` : "";
      const datePart = row.observed_at ? row.observed_at.slice(0, 10) : "";
      const impact = num(row.payload?.impact, 0);
      return {
        axis: "initiative" as const,
        evidence_kind: "proactive_event",
        summary: `${datePart} ${who}: AMD起点で「${what}」${pjPart} (impact ${impact}) — 健全な先手`,
        source_type: row.source_table,
        source_ref: sourceRef(row),
        source_hash: row.source_hash,
        impact: 5,
        confidence: num(row.confidence, 0.5),
        payload: { project_id: row.project_id, project_name: pjLabel, member: who, impact },
      };
    });

  return {
    score,
    confidence,
    inputs: { totalEvents, passiveEvents: passiveEvents.length, passiveRatio, amdProposedCount, coDecidedCount, unknownCount, delta, summary: summarySentence, scoreZone: score < 70 ? "critical" : score < 90 ? "warning" : "healthy" },
    evidence: [formulaEvidence, ...passiveEvidence, ...proactiveEvidence],
  };
}

/**
 * budget_actual_view 由来の signals を `(scope, project_id, category)` 単位で集約する。
 *
 * 背景 (= 2026-05-27 バグ修正): `company_budget_actual_monthly` は VIEW で
 * `FULL JOIN ... ON ... AND b.account_key = a.account_key` のため、 予算側 (account_key=空)
 * と freee actual 側 (account_key='売上高') が **マッチせず 2 行に分裂**してた。
 * その結果 evidence で「売上: 予算 ¥1.82M 実績 ¥0 (下振れ)」 と表示され、 freee で売上を
 * 仕訳しても反映されてないように見える事故が発生した。
 *
 * 修正方針: VIEW は触らず、 calculate.ts 側で category 単位に集約 (= budget / actual を
 * それぞれ SUM)。 これで「同じ category 内に複数 account がある」 ケース (= 固定費の
 * 通信費 / 旅費 / 交際費 等) も自然に合算される。 ただし `topBy` で account 別の細かい
 * variance を上位表示する用途のため、 集約版とは別に元 rows も残す。
 */
type AggregatedBudgetRow = {
  scope: string;
  project_id: string | null;
  category: string;
  budget_amount_yen: number;
  actual_amount_yen: number;
  variance_yen: number;
  runway_months: number | null;
  cash_amount_yen: number | null;
  confidence: number;
  source_table: string;
  source_hash: string | null;
  source_ref: string;
};

function aggregateBudgetActualByCategory(budgetRows: RawSignal[]): AggregatedBudgetRow[] {
  const map = new Map<string, AggregatedBudgetRow>();
  for (const row of budgetRows) {
    const scope = String(row.payload?.scope ?? "company");
    const projectId = row.payload?.project_id ? String(row.payload.project_id) : null;
    const category = String(row.payload?.category ?? "");
    if (!category) continue;
    const key = `${scope}|${projectId ?? "-"}|${category}`;
    const cur = map.get(key) ?? {
      scope,
      project_id: projectId,
      category,
      budget_amount_yen: 0,
      actual_amount_yen: 0,
      variance_yen: 0,
      runway_months: null as number | null,
      cash_amount_yen: null as number | null,
      confidence: 0,
      source_table: row.source_table,
      source_hash: row.source_hash ?? null,
      source_ref: `company_budget_actual_monthly:${scope}:${projectId ?? "company"}:${category}`,
    };
    cur.budget_amount_yen += num(row.payload?.budget_amount_yen);
    cur.actual_amount_yen += num(row.payload?.actual_amount_yen);
    const rwm = row.payload?.runway_months;
    if (rwm != null && cur.runway_months == null) cur.runway_months = num(rwm);
    const cash = row.payload?.cash_amount_yen;
    if (cash != null && cur.cash_amount_yen == null) cur.cash_amount_yen = num(cash);
    cur.confidence = Math.max(cur.confidence, num(row.confidence, 0.5));
    map.set(key, cur);
  }
  for (const cur of map.values()) {
    cur.variance_yen = cur.actual_amount_yen - cur.budget_amount_yen;
  }
  return Array.from(map.values());
}

function scoreFinance(rows: RawSignal[], ctx: ScoreContext): AxisScore {
  const budgetRows = rows.filter((row) => row.source_kind === "budget_actual_view");
  const billingRows = rows.filter((row) => row.source_kind === "billing");
  const freeeRows = rows.filter((row) => row.source_kind === "freee_trial_pl" || row.source_kind === "freee_actual");

  // category 単位で集約 (= VIEW の account_key JOIN 分裂を吸収)
  const aggregated = aggregateBudgetActualByCategory(budgetRows);

  const runwayRows = budgetRows.filter((row) => row.payload?.runway_months != null);
  const runway = avg(runwayRows.map((row) => num(row.payload.runway_months)).filter((n) => n > 0 && n < 999), 12);
  const runwayScore = clamp((runway / 12) * 100);

  const comparable = aggregated.filter((row) => Math.abs(row.budget_amount_yen) > 0);
  const varianceRatios = comparable.map((row) => {
    const budget = Math.abs(row.budget_amount_yen);
    const variance = Math.abs(row.variance_yen);
    return budget > 0 ? Math.min(1.5, variance / budget) : 0;
  });
  const varianceScore = clamp(100 - avg(varianceRatios, 0.4) * 100);

  const billingDone = billingRows.filter((row) => row.signal_key.includes("paid") || row.signal_key.includes("payment") || row.signal_key.includes("done")).length;
  const billingSentUnpaid = billingRows.filter((row) => row.signal_key.includes("sent_unpaid")).length;
  const billingScore = billingRows.length ? clamp(((billingDone + 0.5 * (billingRows.length - billingDone - billingSentUnpaid)) / billingRows.length) * 100) : 50;

  const forecastRows = aggregated.filter((row) => ["revenue", "net_cash_flow", "operating_profit"].includes(row.category) && row.budget_amount_yen !== 0);
  const forecastScore = clamp(Math.min(1, forecastRows.length / 6) * 100);
  const freshnessScore = freeeRows.length > 0 ? 90 : 55;

  const score = clamp(runwayScore * 0.3 + varianceScore * 0.25 + billingScore * 0.2 + forecastScore * 0.15 + freshnessScore * 0.1);
  const prev = ctx.previousAxisScore.finance;
  const delta = prev != null ? score - prev : null;
  const billingTotal = billingRows.length;
  const freshnessNote = freeeRows.length === 0 ? "freee 実績未取得 (= 予算側だけで評価、確度低)" : `freee 同期済 (${freeeRows.length} 行)`;
  const billingNote = billingTotal > 0 ? `請求 ${billingTotal} 件中 入金確認 ${billingDone} 件・未入金 ${billingSentUnpaid} 件` : "当月請求 0 件";
  const summarySentence = `財務 ${Math.round(score)}点 (前月比 ${fmtDelta(delta)}, ${deltaDesc(delta)})。Runway ${runway.toFixed(1)} ヶ月、予実乖離スコア ${Math.round(varianceScore)}、${billingNote}、${freshnessNote}。`;
  const evidence: EvidenceInput[] = [
    {
      axis: "finance",
      evidence_kind: "axis_summary",
      summary: summarySentence,
      source_type: "computed",
      source_ref: "company_budget_actual_monthly+company_actual_monthly+billing_cycles+freee.trial_pl",
      impact: delta ?? (score - 50) / 2,
      confidence: freeeRows.length ? 0.8 : 0.55,
      payload: { score, prev, delta, runway, runwayScore, varianceScore, billingScore, forecastScore, freshnessScore, freeeRows: freeeRows.length, billingTotal, billingDone, billingSentUnpaid, aggregatedCount: aggregated.length },
    },
    ...topBy(aggregated, (row) => row.variance_yen, 6).map((row) => {
      const variance = row.variance_yen;
      const budget = row.budget_amount_yen;
      const actual = row.actual_amount_yen;
      const cat = categoryLabel(row.category);
      const sign = variance >= 0 ? "上振れ" : "下振れ";
      const pct = budget !== 0 ? Math.round((Math.abs(variance) / Math.abs(budget)) * 100) : null;
      const isFavorable = isFavorableVariance(cat, variance);
      return {
        axis: "finance" as const,
        evidence_kind: "budget_variance",
        summary: `${cat}: 予算 ${fmtYen(budget)} に対し実績 ${fmtYen(actual)} (${sign} ${fmtYen(Math.abs(variance))}${pct != null ? ` / ${pct}%` : ""})${isFavorable ? " — 好調" : " — 注意"}`,
        source_type: row.source_table,
        source_ref: row.source_ref,
        source_hash: row.source_hash,
        impact: isFavorable ? Math.min(15, Math.abs(variance) / 200000) : -Math.min(20, Math.abs(variance) / 100000),
        confidence: row.confidence,
        payload: { category: cat, scope: row.scope, project_id: row.project_id, budget, actual, variance, isFavorable, runway_months: row.runway_months },
      };
    }),
  ];
  return {
    score,
    confidence: freeeRows.length ? 0.78 : 0.55,
    inputs: { runway, runwayScore, varianceScore, billingScore, forecastScore, freshnessScore, budgetRows: budgetRows.length, aggregatedCategories: aggregated.length, freeeRows: freeeRows.length, billingTotal, billingDone, billingSentUnpaid, delta, summary: summarySentence },
    evidence,
  };
}

function scoreRetention(rows: RawSignal[], ctx: ScoreContext): AxisScore {
  const projectRows = rows.filter((row) => row.source_kind === "project_master");
  const activeProjects = projectRows.filter((row) => row.signal_key.includes("active_in_month")).length;
  const freezeRows = rows.filter((row) => row.signal_key.includes("active_freeze"));
  const progressRows = rows.filter((row) => row.source_kind === "progress");
  const meetingRows = rows.filter((row) => row.source_kind === "meeting_summary");
  const progressScore = avg(progressRows.map((row) => num(row.signal_value_numeric)).filter((n) => n >= 0), 55);
  const meetingSignal = meetingRows.length
    ? clamp(50 + avg(meetingRows.map((row) => num(row.signal_value_numeric)), 0) * 10)
    : 50;
  const activeScore = projectRows.length ? clamp((activeProjects / projectRows.length) * 100) : 50;
  const freezePenalty = Math.min(40, freezeRows.length * 18);
  const score = clamp(activeScore * 0.35 + progressScore * 0.35 + meetingSignal * 0.2 + 70 * 0.1 - freezePenalty);
  const riskMeetings = meetingRows.filter((row) => row.signal_key.includes("risk")).length;
  const prev = ctx.previousAxisScore.retention;
  const delta = prev != null ? score - prev : null;
  const summarySentence = `継続 ${Math.round(score)}点 (前月比 ${fmtDelta(delta)}, ${deltaDesc(delta)})。active PJ ${activeProjects}/${projectRows.length}、freeze ${freezeRows.length} 件 (-${freezePenalty.toFixed(0)}点 ペナルティ)、進捗平均 ${Math.round(progressScore)}%、MTG risk 言及 ${riskMeetings} 件。`;
  return {
    score,
    confidence: progressRows.length || meetingRows.length ? 0.72 : 0.45,
    inputs: { activeProjects, projectRows: projectRows.length, progressScore, meetingSignal, freezeCount: freezeRows.length, freezePenalty, riskMeetings, delta, summary: summarySentence },
    evidence: [
      {
        axis: "retention",
        evidence_kind: "axis_summary",
        summary: summarySentence,
        source_type: "computed",
        source_ref: "projects+milestone_monthly_progress+project_meeting_summaries+project_freeze_periods",
        impact: delta ?? (score - 50) / 2,
        confidence: 0.72,
        payload: { score, prev, delta, activeProjects, projectRows: projectRows.length, progressScore, meetingSignal, freezeCount: freezeRows.length, riskMeetings },
      },
      ...topBy(freezeRows, (row) => 1, 3).map((row) => {
        const pjLabel = projectLabel(ctx, row.project_id);
        const reason = String(row.signal_value_text || "理由未記録");
        const restart = row.payload?.restart_ym ? `、再開予定 ${row.payload.restart_ym}` : "";
        return {
          axis: "retention" as const,
          evidence_kind: "freeze",
          summary: `${pjLabel} freeze 中 (理由: ${reason}${restart}) — 継続評価を大きく下げる要因`,
          source_type: row.source_table,
          source_ref: sourceRef(row),
          source_hash: row.source_hash,
          impact: -18,
          confidence: num(row.confidence, 0.5),
          payload: { project_id: row.project_id, project_name: pjLabel, reason, restart_ym: row.payload?.restart_ym },
        };
      }),
      ...topBy(meetingRows.filter((row) => row.signal_key.includes("risk")), (row) => -num(row.signal_value_numeric, 0), 3).map((row) => {
        const pjLabel = projectLabel(ctx, row.project_id);
        const snippet = String(row.signal_value_text || "").slice(0, 80);
        return {
          axis: "retention" as const,
          evidence_kind: "meeting_risk",
          summary: `${pjLabel} 直近MTG で risk 言及: 「${snippet}」 — 継続確度を下げる兆候`,
          source_type: row.source_table,
          source_ref: sourceRef(row),
          source_hash: row.source_hash,
          impact: -10,
          confidence: num(row.confidence, 0.5),
          payload: { project_id: row.project_id, project_name: pjLabel, snippet, meeting_date: row.observed_at },
        };
      }),
      ...topBy(progressRows.filter((row) => num(row.signal_value_numeric, 0) >= 70), (row) => num(row.signal_value_numeric, 0), 3).map((row) => {
        const pct = num(row.signal_value_numeric, 0);
        const confirmed = row.signal_key.includes("confirmed");
        return {
          axis: "retention" as const,
          evidence_kind: "progress_strong",
          summary: `milestone ${row.payload?.milestone_key || "?"}: 進捗 ${Math.round(pct)}% ${confirmed ? "(確認済)" : "(推定)"} — 継続評価を支える`,
          source_type: row.source_table,
          source_ref: sourceRef(row),
          source_hash: row.source_hash,
          impact: 8,
          confidence: num(row.confidence, 0.5),
          payload: { milestone_key: row.payload?.milestone_key, progress_pct: pct, confirmed },
        };
      }),
    ],
  };
}

/**
 * 新規 pipeline v4 (= Gmail/Slack 案件追跡)
 *
 * 入力:
 * - `commercial_progress` (= project_strategy_signals signal_type='commercial_progress')、 decision_state を stage 相当として確度付き加点
 * - `registry_diff` (= project_registry_diffs、 OS 未反映の新規関係者/案件)
 * - `project_knowledge` (= pipeline 寄り、 紹介/新規/相談/案件等のキーワード)
 *
 * v3 までの seeds 在庫加点は廃止 (= まさ #79、 ネット拾いシーズが pipeline 点を上げる問題)。
 * seeds は AMD Score 側 (= 21 章) の入力としてのみ使う。
 */
function scorePipeline(rows: RawSignal[], ctx: ScoreContext): AxisScore {
  const commercials = rows.filter((row) => row.source_kind === "commercial_progress");
  const diffs = rows.filter((row) => row.source_kind === "registry_diff");
  const knowledge = rows.filter((row) => row.source_kind === "project_knowledge");

  // decision_state を stage 相当の probability にマッピング
  const stageProbability = (signalKey: string): number => {
    if (signalKey.includes("observed")) return 0.05;
    if (signalKey.includes("prospect")) return 0.35;
    if (signalKey.includes("proposed")) return 0.20;
    if (signalKey.includes("decided")) return 0.60;
    if (signalKey.includes("high_confidence")) return 0.85;
    if (signalKey.includes("contracting")) return 0.90;
    if (signalKey.includes("executing")) return 0.85;
    if (signalKey.includes("contracted")) return 1.00;
    if (signalKey.includes("revised")) return 1.00;
    if (signalKey.includes("deferred")) return 0.10;
    if (signalKey.includes("lost")) return 0.00;
    return 0.15;
  };
  const impactWeightFromHint = (row: RawSignal): number => {
    const w = num(row.weight_hint, 1);
    return Math.max(0.5, Math.min(3, w));
  };

  const pipelineValue = commercials.reduce((sum, row) => sum + stageProbability(row.signal_key) * impactWeightFromHint(row), 0);
  const commercialScore = clamp(Math.min(1, pipelineValue / 10) * 100); // value 10 で満点目安
  const diffScore = clamp(Math.min(1, diffs.length / 8) * 100);
  const knowledgeScore = clamp(Math.min(1, knowledge.length / 25) * 100);
  const score = clamp(commercialScore * 0.50 + diffScore * 0.25 + knowledgeScore * 0.25);

  const prev = ctx.previousAxisScore.pipeline;
  const delta = prev != null ? score - prev : null;

  // stage 別件数 (= 表示用)
  const stageCount = {
    observed: commercials.filter((r) => r.signal_key.includes("observed")).length,
    proposed: commercials.filter((r) => r.signal_key.includes("proposed")).length,
    decided: commercials.filter((r) => r.signal_key.includes("decided")).length,
    executing: commercials.filter((r) => r.signal_key.includes("executing")).length,
    revised: commercials.filter((r) => r.signal_key.includes("revised")).length,
  };
  const summarySentence = `新規 ${Math.round(score)}点 (前月比 ${fmtDelta(delta)}, ${deltaDesc(delta)})。 案件追跡 ${commercials.length} 件 (proposed ${stageCount.proposed} / decided ${stageCount.decided} / executing ${stageCount.executing})、 OS未反映 diff ${diffs.length} 件、 PJ派生 knowledge ${knowledge.length} 件。 pipeline_value=${pipelineValue.toFixed(1)}/10。`;

  return {
    score,
    confidence: commercials.length || knowledge.length ? 0.7 : 0.4,
    inputs: { commercials: commercials.length, stageCount, pipelineValue, commercialScore, diffScore, knowledgeScore, diffs: diffs.length, knowledge: knowledge.length, delta, summary: summarySentence },
    evidence: [
      {
        axis: "pipeline" as const,
        evidence_kind: "axis_summary",
        summary: summarySentence,
        source_type: "computed",
        source_ref: "project_strategy_signals(commercial_progress)+project_registry_diffs+project_knowledge",
        impact: delta ?? (score - 50) / 2,
        confidence: commercials.length || knowledge.length ? 0.7 : 0.4,
        payload: { score, prev, delta, commercials: commercials.length, stageCount, pipelineValue, diffs: diffs.length, knowledge: knowledge.length },
      },
      ...topBy(commercials, (row) => stageProbability(row.signal_key) * impactWeightFromHint(row), 6).map((row) => {
        const title = String(row.signal_value_text || "(無題案件)").slice(0, 60);
        const stage = row.signal_key.replace("commercial:", "");
        const pjLabel = projectLabel(ctx, row.project_id);
        const pjPart = pjLabel ? ` [${pjLabel}]` : "";
        const payloadProb = num(row.payload?.pipeline_probability, NaN);
        const prob = Number.isFinite(payloadProb) && payloadProb > 0 ? payloadProb : stageProbability(row.signal_key);
        const expectedYm = row.payload?.expected_contract_ym ? ` / 見込み ${row.payload.expected_contract_ym}` : "";
        return {
          axis: "pipeline" as const,
          evidence_kind: "commercial_progress",
          summary: `案件「${title}」${pjPart} (${stage}、 確度 ${Math.round(prob * 100)}%${expectedYm}) — 新規 pipeline 形成`,
          source_type: row.source_table,
          source_ref: sourceRef(row),
          source_hash: row.source_hash,
          impact: Math.round(prob * 15),
          confidence: num(row.confidence, 0.5),
          payload: { project_id: row.project_id, project_name: pjLabel, title, stage, probability: prob, expected_contract_ym: row.payload?.expected_contract_ym ?? null, expected_amount_yen: row.payload?.expected_amount_yen ?? null, scope_reason: row.payload?.scope_reason ?? null },
        };
      }),
      ...topBy(diffs, (row) => num(row.weight_hint, 1), 3).map((row) => {
        const pjLabel = projectLabel(ctx, row.project_id);
        return {
          axis: "pipeline" as const,
          evidence_kind: "registry_diff",
          summary: `OS未反映の新規 ${String(row.signal_value_text || "")} ${pjLabel ? `(${pjLabel})` : ""} — 案件候補が見えてきている`,
          source_type: row.source_table,
          source_ref: sourceRef(row),
          source_hash: row.source_hash,
          impact: 6,
          confidence: num(row.confidence, 0.5),
          payload: { project_id: row.project_id, project_name: pjLabel, target_key: row.signal_value_text },
        };
      }),
    ],
  };
}

/**
 * 戦略接近度 v4 (= 2026-05-26 まさ #82 で 6 入力に全面差し替え)
 *
 * 入力:
 * 1. ファンド設立進捗 (= funding_aggregate) — 20%
 * 2. 連携研究機関数 (= partner_growth) — 15%
 * 3. AMD OS 導入進捗 (= amd_os_install) — 25%  (= 当面 0、 amd_os_installations テーブル未実装)
 * 4. マネタイズ仮説の前進 (= monetization_aggregate) — 15%
 * 5. 属人脱却率 (= non_masa_initiative) — 15%
 * 6. PJ 成功卒業進捗 (= graduation) — 10%
 *
 * v3 までの amd_score / protocol / venture / atlas / macro は廃止 (= まさ「方向接近度の判定として弱い」)。
 */
function scoreDirection(rows: RawSignal[], _ctx: ScoreContext): AxisScore {
  const fundingAgg = rows.find((row) => row.source_kind === "funding_aggregate");
  const partnerAgg = rows.find((row) => row.source_kind === "partner_growth");
  const amdOsInstall = rows.find((row) => row.source_kind === "amd_os_install");
  const monetizationAgg = rows.find((row) => row.source_kind === "monetization_aggregate");
  const nonMasa = rows.find((row) => row.source_kind === "non_masa_initiative");
  const graduation = rows.find((row) => row.source_kind === "graduation");

  const fundCount = num(fundingAgg?.signal_value_numeric, 0);
  const partnerCount = num(partnerAgg?.signal_value_numeric, 0);
  const osInstallCount = num(amdOsInstall?.signal_value_numeric, 0);
  const monetCount = num(monetizationAgg?.signal_value_numeric, 0);
  const nonMasaRatio = num(nonMasa?.signal_value_numeric, 0);
  const graduationCount = num(graduation?.signal_value_numeric, 0);

  // 0-100 正規化 (= 各入力の「満点目安」 で割って 100 倍)
  const fundScore = clamp(Math.min(1, fundCount / 5) * 100); // 5 件 confirmed funding で満点
  const partnerScore = clamp(Math.min(1, partnerCount / 5) * 100); // 5 件 research/university partners で満点
  const osInstallScore = clamp(Math.min(1, osInstallCount / 3) * 100); // 3 件導入で満点 (= 当面 0)
  const monetScore = clamp(Math.min(1, monetCount / 3) * 100); // 3 件 decided/executing で満点
  const nonMasaScore = clamp(nonMasaRatio * 100); // 比率 0-1 → 0-100
  const graduationScore = clamp(Math.min(1, graduationCount / 3) * 100); // 3 件成功卒業で満点

  const score = clamp(
    fundScore * 0.20
    + partnerScore * 0.15
    + osInstallScore * 0.25
    + monetScore * 0.15
    + nonMasaScore * 0.15
    + graduationScore * 0.10,
  );

  const prev = _ctx.previousAxisScore.direction;
  const delta = prev != null ? score - prev : null;
  const summarySentence = `方向 ${Math.round(score)}点 (前月比 ${fmtDelta(delta)}, ${deltaDesc(delta)})。 ファンド ${fundCount} / 研究機関 ${partnerCount} / OS導入 ${osInstallCount} / マネタイズ ${monetCount} / 属人脱却率 ${Math.round(nonMasaRatio * 100)}% / 成功卒業 ${graduationCount} 件。`;

  return {
    score,
    confidence: 0.65,
    inputs: { fundCount, partnerCount, osInstallCount, monetCount, nonMasaRatio, graduationCount, fundScore, partnerScore, osInstallScore, monetScore, nonMasaScore, graduationScore, delta, summary: summarySentence },
    evidence: [
      {
        axis: "direction" as const,
        evidence_kind: "axis_summary",
        summary: summarySentence,
        source_type: "computed",
        source_ref: "project_strategy_signals(funding/commercial)+project_partners+amd_os_installations+member_activities(non-masa)+project_ventures(graduation)",
        impact: delta ?? (score - 50) / 2,
        confidence: 0.65,
        payload: { score, prev, delta, fundCount, partnerCount, osInstallCount, monetCount, nonMasaRatio, graduationCount },
      },
      {
        axis: "direction" as const,
        evidence_kind: "fund_setup",
        summary: `ファンド設立進捗: ${fundCount} 件 confirmed funding → ${Math.round(fundScore)}点 (重み 20%)`,
        source_type: "project_strategy_signals",
        source_ref: "signal_type='funding' AND status='confirmed'",
        impact: fundScore >= 50 ? 8 : -2,
        confidence: 0.75,
        payload: { count: fundCount, score: fundScore, weight: 0.20 },
      },
      {
        axis: "direction" as const,
        evidence_kind: "partner_growth",
        summary: `連携研究機関数: ${partnerCount} 件 (research/university partners) → ${Math.round(partnerScore)}点 (重み 15%)`,
        source_type: "project_partners",
        source_ref: "partner_type contains research/university",
        impact: partnerScore >= 50 ? 6 : -1,
        confidence: 0.75,
        payload: { count: partnerCount, score: partnerScore, weight: 0.15 },
      },
      {
        axis: "direction" as const,
        evidence_kind: "amd_os_install",
        summary: `AMD OS 導入進捗: ${osInstallCount} 件 → ${Math.round(osInstallScore)}点 (重み 25%、 ⚠️ amd_os_installations テーブル未実装)`,
        source_type: "amd_os_installations",
        source_ref: "TODO Phase 4",
        impact: osInstallScore >= 30 ? 6 : -5,
        confidence: 0.2,
        payload: { count: osInstallCount, score: osInstallScore, weight: 0.25, note: "テーブル未実装" },
      },
      {
        axis: "direction" as const,
        evidence_kind: "monetization",
        summary: `マネタイズ仮説の前進: ${monetCount} 件 decided/executing commercial → ${Math.round(monetScore)}点 (重み 15%)`,
        source_type: "project_strategy_signals",
        source_ref: "signal_type='commercial_progress' AND decision_state in (decided,executing)",
        impact: monetScore >= 50 ? 6 : -1,
        confidence: 0.75,
        payload: { count: monetCount, score: monetScore, weight: 0.15 },
      },
      {
        axis: "direction" as const,
        evidence_kind: "non_masa_initiative",
        summary: `属人脱却率: AMD起点 events のうち ${Math.round(nonMasaRatio * 100)}% がまさ以外 → ${Math.round(nonMasaScore)}点 (重み 15%)`,
        source_type: "member_activities",
        source_ref: "member_id != ID001 AND initiative_origin = 'amd_proposed'",
        impact: nonMasaScore >= 30 ? 5 : -3,
        confidence: 0.7,
        payload: { ratio: nonMasaRatio, score: nonMasaScore, weight: 0.15 },
      },
      {
        axis: "direction" as const,
        evidence_kind: "graduation",
        summary: `PJ 成功卒業進捗: ${graduationCount} 件 (rocket/lifted/smb 成功卒業) → ${Math.round(graduationScore)}点 (重み 10%)`,
        source_type: "project_ventures",
        source_ref: "outcome_pattern IN (rocket,lifted,smb) AND amd_support_ended_at IS NOT NULL",
        impact: graduationScore >= 30 ? 4 : 0,
        confidence: 0.85,
        payload: { count: graduationCount, score: graduationScore, weight: 0.10, projects: graduation?.payload?.projects },
      },
    ],
  };
}

function buildSnapshotSummary(
  ym: string,
  totalScore: number,
  totalDelta: number | null,
  axisScores: Record<Axis, AxisScore>,
  modifierZone: "healthy" | "warning" | "critical",
  modifierLabel: string,
  omegaReasoning: string,
  deathFlag: string | null,
  _rawSignalCount: number
): string {
  const parts: string[] = [];
  const totalDeltaStr = fmtDelta(totalDelta);
  parts.push(`${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月 総合 ${totalScore}点 (前月比 ${totalDeltaStr || "前月データなし"}, ${deltaDesc(totalDelta)})。`);

  const axisOrder: { axis: Axis; label: string; score: number; delta: number | null }[] = (["initiative", "finance", "retention", "pipeline", "direction"] as Axis[]).map((axis) => {
    const labels: Record<Axis, string> = { initiative: "先手力", finance: "財務", retention: "継続", pipeline: "新規", direction: "方向" };
    const inputs = axisScores[axis].inputs as { delta?: number | null };
    return { axis, label: labels[axis], score: axisScores[axis].score, delta: inputs?.delta ?? null };
  });

  const movers = axisOrder
    .filter((a) => a.delta != null && Math.abs(a.delta) >= 2)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
  if (movers.length > 0) {
    const moverStr = movers.slice(0, 3).map((m) => `${m.label} ${fmtDelta(m.delta)}`).join(" / ");
    parts.push(`主な動き: ${moverStr}。`);
  } else if (totalDelta != null) {
    parts.push("各軸ほぼ横ばい。");
  }

  if (modifierZone === "critical") {
    parts.push(`🚨 先手力 ${Math.round(axisScores.initiative.score)}点 = ${modifierLabel}。 total に ×0.3 ペナルティ適用中。`);
  } else if (modifierZone === "warning") {
    parts.push(`⚠️ 先手力 ${Math.round(axisScores.initiative.score)}点 = ${modifierLabel}。 total に ×0.7 ペナルティ。`);
  }

  if (deathFlag === "insolvent") {
    parts.push(`🚨🚨 死亡判定: 債務超過、 total = 0 強制。`);
  } else if (deathFlag === "runway_lt_1") {
    parts.push(`🚨 死亡判定: runway < 1 ヶ月、 total を 10 でキャップ。`);
  }

  const weakAxes = axisOrder.filter((a) => a.score < 50).sort((a, b) => a.score - b.score);
  if (weakAxes.length > 0) {
    parts.push(`要注意軸: ${weakAxes.slice(0, 2).map((a) => `${a.label} ${Math.round(a.score)}点`).join(" / ")}。`);
  }

  parts.push(`新規軸重み: ${omegaReasoning}。`);

  return parts.join(" ");
}

export async function calculateManagementScore(
  supabase: SupabaseClient,
  ym: string
): Promise<CalculateResult> {
  const rows: RawSignal[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("amd_management_score_raw_signals")
      .select("id,ym,axis,source_kind,source_table,source_id,signal_key,signal_value_numeric,signal_value_text,project_id,observed_at,confidence,weight_hint,payload,source_hash")
      .eq("ym", ym)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`raw signal select failed: ${error.message}`);
    rows.push(...((data ?? []) as RawSignal[]));
    if (!data || data.length < 1000) break;
  }
  if (rows.length === 0) throw new Error(`no raw signals for ym=${ym}`);

  const [{ data: projectsData }, { data: membersData }, { data: prevSnapshotData }] = await Promise.all([
    supabase.from("projects").select("project_id,project_name,status,end_ym"),
    supabase.from("members").select("member_id,code_name").limit(500),
    supabase
      .from("amd_management_score_snapshots")
      .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score")
      .lt("ym", ym)
      .order("ym", { ascending: false })
      .limit(1),
  ]);

  const projectNames = new Map<string, string>();
  const activeProjects: Array<{ end_ym?: string | null }> = [];
  for (const row of (projectsData ?? []) as Array<{ project_id: string; project_name: string | null; status?: string | null; end_ym?: string | null }>) {
    if (row.project_id) projectNames.set(String(row.project_id), String(row.project_name || row.project_id));
    if (row.status === "active") activeProjects.push({ end_ym: row.end_ym });
  }
  const memberNames = new Map<string, string>();
  for (const row of (membersData ?? []) as Array<{ member_id: string; code_name?: string | null }>) {
    if (row.member_id) memberNames.set(String(row.member_id), String(row.code_name || row.member_id));
  }
  const previousSnapshot = (prevSnapshotData ?? [])[0] as
    | { ym: string; total_score: number | null; initiative_score: number | null; finance_score: number | null; retention_score: number | null; pipeline_score: number | null; direction_score: number | null }
    | undefined;
  const ctx: ScoreContext = {
    projectNames,
    memberNames,
    previousAxisScore: {
      initiative: previousSnapshot?.initiative_score != null ? Number(previousSnapshot.initiative_score) : null,
      finance: previousSnapshot?.finance_score != null ? Number(previousSnapshot.finance_score) : null,
      retention: previousSnapshot?.retention_score != null ? Number(previousSnapshot.retention_score) : null,
      pipeline: previousSnapshot?.pipeline_score != null ? Number(previousSnapshot.pipeline_score) : null,
      direction: previousSnapshot?.direction_score != null ? Number(previousSnapshot.direction_score) : null,
    },
  };

  const byAxis: Record<Axis, RawSignal[]> = {
    initiative: rows.filter((row) => row.axis === "initiative"),
    finance: rows.filter((row) => row.axis === "finance"),
    retention: rows.filter((row) => row.axis === "retention"),
    pipeline: rows.filter((row) => row.axis === "pipeline"),
    direction: rows.filter((row) => row.axis === "direction"),
  };

  const axisScores: Record<Axis, AxisScore> = {
    initiative: scoreInitiative(byAxis.initiative, ctx),
    finance: scoreFinance(byAxis.finance, ctx),
    retention: scoreRetention(byAxis.retention, ctx),
    pipeline: scorePipeline(byAxis.pipeline, ctx),
    direction: scoreDirection(byAxis.direction, ctx),
  };

  // v4 計算: base_total + initiative_modifier + death_clamp の混合方式 (= まさ #82)
  const omegaResult = computePipelineOmega(activeProjects, ym);
  const weights: Record<Axis, number> = {
    finance: WEIGHTS_FIXED.finance,
    initiative: WEIGHTS_FIXED.initiative,
    retention: WEIGHTS_FIXED.retention,
    pipeline: omegaResult.omega,
    direction: WEIGHTS_FIXED.direction,
  };
  const baseTotal = Math.min(
    100,
    (Object.keys(weights) as Axis[]).reduce((sum, axis) => sum + axisScores[axis].score * weights[axis], 0),
  );
  const modifierResult = computeInitiativeModifier(axisScores.initiative.score);
  const totalAfterModifier = baseTotal * modifierResult.modifier;
  const deathResult = computeDeathClamp(totalAfterModifier, axisScores.finance.inputs as Record<string, unknown>);
  const totalScore = Math.round(deathResult.clampedTotal);
  const totalDelta = previousSnapshot?.total_score != null ? totalScore - Number(previousSnapshot.total_score) : null;
  const confidence = avg((Object.keys(axisScores) as Axis[]).map((axis) => axisScores[axis].confidence), 0.5);
  const summary = buildSnapshotSummary(ym, totalScore, totalDelta, axisScores, modifierResult.zone, modifierResult.label, omegaResult.reasoning, deathResult.flag, rows.length);
  const inputs = {
    rawSignalCount: rows.length,
    byAxis: Object.fromEntries((Object.keys(byAxis) as Axis[]).map((axis) => [axis, byAxis[axis].length])),
    axisInputs: Object.fromEntries((Object.keys(axisScores) as Axis[]).map((axis) => [axis, axisScores[axis].inputs])),
    weights,
    omega_pipeline: omegaResult.omega,
    omega_remaining_months_avg: omegaResult.remainingMonthsAvg,
    omega_reasoning: omegaResult.reasoning,
    initiative_modifier: modifierResult.modifier,
    initiative_zone: modifierResult.zone,
    initiative_modifier_label: modifierResult.label,
    base_total: Math.round(baseTotal),
    total_after_modifier: Math.round(totalAfterModifier),
    death_flag: deathResult.flag,
    previousYm: previousSnapshot?.ym ?? null,
    previousTotal: previousSnapshot?.total_score ?? null,
    totalDelta,
  };

  const { data: snapshot, error: snapshotError } = await supabase
    .from("amd_management_score_snapshots")
    .upsert({
      ym,
      total_score: totalScore,
      initiative_score: Math.round(axisScores.initiative.score),
      finance_score: Math.round(axisScores.finance.score),
      retention_score: Math.round(axisScores.retention.score),
      pipeline_score: Math.round(axisScores.pipeline.score),
      direction_score: Math.round(axisScores.direction.score),
      weights_json: weights,
      inputs_json: inputs,
      next_actions_json: [],
      confidence,
      summary,
      finance_cap_applied: deathResult.flag,
      created_by: "management_score_calculator_v4",
      updated_at: new Date().toISOString(),
    }, { onConflict: "ym" })
    .select("id")
    .single();
  if (snapshotError || !snapshot) throw new Error(`snapshot upsert failed: ${snapshotError?.message || "no snapshot"}`);

  const snapshotId = String(snapshot.id);
  await supabase.from("amd_management_score_evidence").delete().eq("snapshot_id", snapshotId);
  const evidenceRows = (Object.values(axisScores).flatMap((score) => score.evidence) as EvidenceInput[]).slice(0, 40).map((row) => ({
    snapshot_id: snapshotId,
    ym,
    axis: row.axis,
    evidence_kind: row.evidence_kind,
    summary: row.summary,
    source_type: row.source_type,
    source_ref: row.source_ref,
    source_hash: row.source_hash ?? null,
    impact: row.impact,
    confidence: row.confidence,
    payload: row.payload ?? {},
  }));
  if (evidenceRows.length > 0) {
    const { error: evidenceError } = await supabase.from("amd_management_score_evidence").insert(evidenceRows);
    if (evidenceError) throw new Error(`evidence insert failed: ${evidenceError.message}`);
  }

  return {
    ok: true,
    ym,
    snapshotId,
    scores: {
      total: totalScore,
      initiative: Math.round(axisScores.initiative.score),
      finance: Math.round(axisScores.finance.score),
      retention: Math.round(axisScores.retention.score),
      pipeline: Math.round(axisScores.pipeline.score),
      direction: Math.round(axisScores.direction.score),
    },
    confidence,
    evidenceCount: evidenceRows.length,
  };
}
