export type ManagementSignalStatus = "healthy" | "mostly_good" | "watch" | "intervention_needed" | "critical";

export type ManagementSignalReason = {
  axis: string;
  text: string;
  source_refs?: Array<Record<string, unknown>>;
};

export type ManagementMonthlySignalEvaluation = {
  id?: string;
  ym: string;
  version: number;
  status: ManagementSignalStatus;
  icon: string;
  label: string;
  headline: string;
  reasons: ManagementSignalReason[];
  next_watch: string[];
  source_refs_json: Array<Record<string, unknown>>;
  payload_json: Record<string, unknown>;
  is_current: boolean;
  superseded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  generated_from?: "persisted" | "preview";
};

export type ManagementSignalScoreInput = {
  id?: string | null;
  ym: string;
  total_score: number | string | null;
  initiative_score: number | string | null;
  finance_score: number | string | null;
  retention_score: number | string | null;
  pipeline_score: number | string | null;
  direction_score: number | string | null;
  confidence?: number | string | null;
  summary?: string | null;
};

export type ManagementSignalEvidenceInput = {
  id?: string | null;
  axis: string | null;
  summary: string | null;
  impact?: number | string | null;
  confidence?: number | string | null;
  source_type?: string | null;
  source_ref?: string | null;
};

export type ManagementSignalBudgetInput = {
  ym: string;
  category: string | null;
  budget_amount_yen?: number | string | null;
  actual_amount_yen?: number | string | null;
  variance_yen?: number | string | null;
  cash_amount_yen?: number | string | null;
  runway_months?: number | string | null;
};

export type ManagementSignalBuildInput = {
  ym: string;
  score: ManagementSignalScoreInput | null;
  previousScore?: ManagementSignalScoreInput | null;
  evidenceRows?: ManagementSignalEvidenceInput[];
  budgetRows?: ManagementSignalBudgetInput[];
  varianceNotes?: Array<{ id?: string | null; note: string | null; category?: string | null }>;
  financeAlerts?: string[];
  version?: number;
};

const STATUS_META: Record<ManagementSignalStatus, { icon: string; label: string }> = {
  healthy: { icon: "🟢", label: "良好" },
  mostly_good: { icon: "🟩", label: "概ね良い" },
  watch: { icon: "🟡", label: "注意" },
  intervention_needed: { icon: "🟠", label: "要介入" },
  critical: { icon: "🔴", label: "危険" },
};

const AXIS_LABELS: Record<string, string> = {
  initiative: "先手力",
  finance: "財務",
  retention: "既存PJ継続",
  pipeline: "新規案件",
  direction: "戦略接近",
};

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function axisScores(score: ManagementSignalScoreInput | null) {
  return [
    { axis: "initiative", value: num(score?.initiative_score) },
    { axis: "finance", value: num(score?.finance_score) },
    { axis: "retention", value: num(score?.retention_score) },
    { axis: "pipeline", value: num(score?.pipeline_score) },
    { axis: "direction", value: num(score?.direction_score) },
  ];
}

function weakestAxis(score: ManagementSignalScoreInput | null) {
  return axisScores(score)
    .filter((item): item is { axis: string; value: number } => item.value != null)
    .sort((a, b) => a.value - b.value)[0] ?? null;
}

function strongestAxis(score: ManagementSignalScoreInput | null) {
  return axisScores(score)
    .filter((item): item is { axis: string; value: number } => item.value != null)
    .sort((a, b) => b.value - a.value)[0] ?? null;
}

function chooseStatus(input: ManagementSignalBuildInput): ManagementSignalStatus {
  const total = num(input.score?.total_score);
  const finance = num(input.score?.finance_score);
  const pipeline = num(input.score?.pipeline_score);
  const runway = input.budgetRows?.map((row) => num(row.runway_months)).find((value) => value != null) ?? null;
  const alertCount = input.financeAlerts?.length ?? 0;

  if ((total != null && total < 45) || (finance != null && finance < 35) || (runway != null && runway < 2)) {
    return "critical";
  }
  if ((total != null && total < 55) || (finance != null && finance < 45) || alertCount >= 3) {
    return "intervention_needed";
  }
  if ((total != null && total < 68) || (pipeline != null && pipeline < 45) || alertCount > 0) {
    return "watch";
  }
  if ((total != null && total < 78) || (pipeline != null && pipeline < 58)) {
    return "mostly_good";
  }
  return "healthy";
}

function headlineFor(status: ManagementSignalStatus, input: ManagementSignalBuildInput): string {
  const weak = weakestAxis(input.score);
  if (weak?.axis === "pipeline" && (status === "mostly_good" || status === "watch")) {
    return "まあ悪くない。ただ、新規案件の厚みがもう少しあると安心できる。";
  }
  if (weak?.axis === "finance" && status !== "healthy") {
    return "足元は見えているけど、財務の余裕を先に確認したい状態。";
  }
  if (status === "healthy") {
    return "かなり良い状態。足元の動きと経営判断が噛み合っていて、攻めの判断をしやすい。";
  }
  if (status === "mostly_good") {
    return "概ね良い状態。大きく崩れてはいないが、次の安心材料をもう少し積みたい。";
  }
  if (status === "watch") {
    return "悪くはないけど注意が必要。弱い軸を放置すると来月の判断が重くなる。";
  }
  if (status === "intervention_needed") {
    return "少し手を打った方がいい状態。経営上の詰まりを今月中にほどきたい。";
  }
  return "危険寄りの状態。cash、売上見込み、支出のどれを先に締めるか決めたい。";
}

function evidenceReason(axis: string, rows: ManagementSignalEvidenceInput[]): ManagementSignalReason | null {
  const row = rows
    .filter((item) => item.axis === axis && item.summary)
    .sort((a, b) => Math.abs(num(b.impact) ?? 0) - Math.abs(num(a.impact) ?? 0))[0];
  if (!row?.summary) return null;
  return {
    axis,
    text: row.summary,
    source_refs: row.source_ref ? [{ source_type: row.source_type ?? null, source_ref: row.source_ref }] : undefined,
  };
}

function buildReasons(input: ManagementSignalBuildInput): ManagementSignalReason[] {
  const reasons: ManagementSignalReason[] = [];
  const evidenceRows = input.evidenceRows ?? [];
  const weak = weakestAxis(input.score);
  const strong = strongestAxis(input.score);

  if (input.financeAlerts?.[0]) {
    reasons.push({ axis: "finance", text: input.financeAlerts[0] });
  }

  if (weak) {
    reasons.push(
      evidenceReason(weak.axis, evidenceRows) ?? {
        axis: weak.axis,
        text: `${AXIS_LABELS[weak.axis] ?? weak.axis}が相対的に弱い。ここが翌月の見張りどころ。`,
      }
    );
  }

  if (strong && strong.axis !== weak?.axis) {
    reasons.push(
      evidenceReason(strong.axis, evidenceRows) ?? {
        axis: strong.axis,
        text: `${AXIS_LABELS[strong.axis] ?? strong.axis}は支えになっている。今の状態を崩さず伸ばしたい。`,
      }
    );
  }

  const note = input.varianceNotes?.find((item) => item.note)?.note;
  if (note && reasons.length < 3) {
    reasons.push({ axis: "finance", text: note });
  }

  return reasons.slice(0, 3);
}

function buildNextWatch(input: ManagementSignalBuildInput): string[] {
  const weak = weakestAxis(input.score);
  const items: string[] = [];

  if (weak?.axis === "pipeline") items.push("新規案件の相談・紹介・提案前進が増えているか");
  if (weak?.axis === "finance") items.push("入金予定と支出予定のズレが広がっていないか");
  if (weak?.axis === "retention") items.push("既存PJの継続・拡大・停止リスクに変化があるか");
  if (weak?.axis === "initiative") items.push("AMD起点の提案や先回りが増えているか");
  if (weak?.axis === "direction") items.push("AMDの勝ち筋に近い案件・外部シグナルが増えているか");

  if ((input.financeAlerts?.length ?? 0) > 0) items.push("cash / runway / 支払通知書 / 入金確認の未反映が残っていないか");
  items.push("月末断面でManagement Scoreの弱い軸が改善しているか");

  return Array.from(new Set(items)).slice(0, 3);
}

export function buildManagementMonthlySignalEvaluation(
  input: ManagementSignalBuildInput
): ManagementMonthlySignalEvaluation {
  const status = chooseStatus(input);
  const meta = STATUS_META[status];
  const score = input.score;
  const evidenceRows = input.evidenceRows ?? [];
  const sourceRefs: Array<Record<string, unknown>> = [];

  if (score?.id) sourceRefs.push({ table: "amd_management_score_snapshots", id: score.id, ym: score.ym });
  evidenceRows.slice(0, 8).forEach((row) => {
    if (row.id) sourceRefs.push({ table: "amd_management_score_evidence", id: row.id, axis: row.axis });
    else if (row.source_ref) sourceRefs.push({ source_type: row.source_type ?? null, source_ref: row.source_ref });
  });
  input.budgetRows?.slice(0, 12).forEach((row) => {
    sourceRefs.push({ table: "company_budget_actual_monthly", ym: row.ym, category: row.category });
  });

  return {
    ym: input.ym,
    version: input.version ?? 1,
    status,
    icon: meta.icon,
    label: meta.label,
    headline: headlineFor(status, input),
    reasons: buildReasons(input),
    next_watch: buildNextWatch(input),
    source_refs_json: sourceRefs,
    payload_json: {
      snapshot_id: score?.id ?? null,
      score_axis_summary: score
        ? {
            total: num(score.total_score),
            initiative: num(score.initiative_score),
            finance: num(score.finance_score),
            retention: num(score.retention_score),
            pipeline: num(score.pipeline_score),
            direction: num(score.direction_score),
            confidence: num(score.confidence),
          }
        : null,
      finance_alert_count: input.financeAlerts?.length ?? 0,
      omitted_numbers_policy: "do_not_repeat_budget_table_numbers",
      generated_by: "management_monthly_signal_v1_non_llm",
    },
    is_current: true,
    generated_from: "preview",
  };
}

export function normalizeManagementSignalRow(row: Record<string, unknown>): ManagementMonthlySignalEvaluation {
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    ym: String(row.ym ?? ""),
    version: Number(row.version ?? 1),
    status: (row.status as ManagementSignalStatus) ?? "watch",
    icon: String(row.icon ?? STATUS_META.watch.icon),
    label: String(row.label ?? STATUS_META.watch.label),
    headline: String(row.headline ?? ""),
    reasons: Array.isArray(row.reason_items_json) ? (row.reason_items_json as ManagementSignalReason[]) : [],
    next_watch: Array.isArray(row.next_watch_json) ? (row.next_watch_json as string[]) : [],
    source_refs_json: Array.isArray(row.source_refs_json) ? (row.source_refs_json as Array<Record<string, unknown>>) : [],
    payload_json: typeof row.payload_json === "object" && row.payload_json ? (row.payload_json as Record<string, unknown>) : {},
    is_current: Boolean(row.is_current),
    superseded_at: typeof row.superseded_at === "string" ? row.superseded_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    generated_from: "persisted",
  };
}
