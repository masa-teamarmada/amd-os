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

const WEIGHTS: Record<Axis, number> = {
  initiative: 0.25,
  finance: 0.25,
  retention: 0.2,
  pipeline: 0.15,
  direction: 0.15,
};

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

function scoreInitiative(rows: RawSignal[]): AxisScore {
  const events = rows.filter((row) => row.source_table === "member_activities");
  const known = events.filter((row) => !row.signal_key.includes("unknown"));
  const denominator = known.reduce((sum, row) => sum + Math.max(1, Math.abs(num(row.signal_value_numeric, 1))), 0);
  const numerator = known.reduce((sum, row) => {
    const value = Math.max(1, Math.abs(num(row.signal_value_numeric, 1)));
    if (row.signal_key.includes("amd_proposed")) return sum + value;
    if (row.signal_key.includes("co_decided")) return sum + value * 0.5;
    return sum;
  }, 0);
  const unknownRatio = events.length ? (events.length - known.length) / events.length : 1;
  const score = denominator > 0 ? clamp((numerator / denominator) * 100) : 45;
  const evidence = topBy(events, (row) => num(row.signal_value_numeric, 1), 6).map((row) => ({
    axis: "initiative" as const,
    evidence_kind: row.signal_key.includes("amd_proposed") ? "proactive_event" : "initiative_event",
    summary: `${row.signal_key.replace("initiative_origin:", "")}: ${brief(row)}`,
    source_type: row.source_table,
    source_ref: sourceRef(row),
    source_hash: row.source_hash,
    impact: row.signal_key.includes("amd_proposed") ? 20 : row.signal_key.includes("co_decided") ? 10 : -5,
    confidence: num(row.confidence, 0.5),
    payload: { project_id: row.project_id, value: row.signal_value_numeric },
  }));
  return {
    score,
    confidence: clamp(0.85 - unknownRatio * 0.35, 0.2, 0.9),
    inputs: { eventCount: events.length, knownCount: known.length, numerator, denominator, unknownRatio },
    evidence,
  };
}

function scoreFinance(rows: RawSignal[]): AxisScore {
  const budgetRows = rows.filter((row) => row.source_kind === "budget_actual_view");
  const billingRows = rows.filter((row) => row.source_kind === "billing");
  const freeeRows = rows.filter((row) => row.source_kind === "freee_trial_pl");

  const runwayRows = budgetRows.filter((row) => row.payload?.runway_months != null);
  const runway = avg(runwayRows.map((row) => num(row.payload.runway_months)).filter((n) => n > 0 && n < 999), 12);
  const runwayScore = clamp((runway / 12) * 100);

  const comparable = budgetRows.filter((row) => Math.abs(num(row.payload?.budget_amount_yen)) > 0);
  const varianceRatios = comparable.map((row) => {
    const budget = Math.abs(num(row.payload?.budget_amount_yen));
    const variance = Math.abs(num(row.payload?.variance_yen));
    return budget > 0 ? Math.min(1.5, variance / budget) : 0;
  });
  const varianceScore = clamp(100 - avg(varianceRatios, 0.4) * 100);

  const billingDone = billingRows.filter((row) => row.signal_key.includes("paid") || row.signal_key.includes("payment") || row.signal_key.includes("done")).length;
  const billingSentUnpaid = billingRows.filter((row) => row.signal_key.includes("sent_unpaid")).length;
  const billingScore = billingRows.length ? clamp(((billingDone + 0.5 * (billingRows.length - billingDone - billingSentUnpaid)) / billingRows.length) * 100) : 50;

  const forecastRows = budgetRows.filter((row) => ["revenue", "net_cash_flow", "operating_profit"].some((cat) => row.signal_key.endsWith(cat)));
  const forecastScore = clamp(Math.min(1, forecastRows.length / 6) * 100);
  const freshnessScore = freeeRows.length > 0 ? 90 : 55;

  const score = clamp(runwayScore * 0.3 + varianceScore * 0.25 + billingScore * 0.2 + forecastScore * 0.15 + freshnessScore * 0.1);
  const evidence: EvidenceInput[] = [
    {
      axis: "finance",
      evidence_kind: "finance_formula",
      summary: `runway=${runway.toFixed(1)}ヶ月 / 予実score=${Math.round(varianceScore)} / billing=${Math.round(billingScore)} / freee実績=${freeeRows.length}件`,
      source_type: "computed",
      source_ref: "company_budget_actual_monthly+company_actual_monthly+billing_cycles",
      impact: score - 50,
      confidence: freeeRows.length ? 0.8 : 0.55,
      payload: { runwayScore, varianceScore, billingScore, forecastScore, freshnessScore, freeeRows: freeeRows.length },
    },
    ...topBy(budgetRows, (row) => num(row.payload?.variance_yen), 5).map((row) => ({
      axis: "finance" as const,
      evidence_kind: "budget_variance",
      summary: `${row.signal_key}: variance=${num(row.payload?.variance_yen).toLocaleString("ja-JP")}円`,
      source_type: row.source_table,
      source_ref: sourceRef(row),
      source_hash: row.source_hash,
      impact: -Math.min(30, Math.abs(num(row.payload?.variance_yen)) / 100000),
      confidence: num(row.confidence, 0.5),
      payload: row.payload,
    })),
  ];
  return {
    score,
    confidence: freeeRows.length ? 0.78 : 0.55,
    inputs: { runway, runwayScore, varianceScore, billingScore, forecastScore, freshnessScore, budgetRows: budgetRows.length, freeeRows: freeeRows.length },
    evidence,
  };
}

function scoreRetention(rows: RawSignal[]): AxisScore {
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
  return {
    score,
    confidence: progressRows.length || meetingRows.length ? 0.72 : 0.45,
    inputs: { activeProjects, projectRows: projectRows.length, progressScore, meetingSignal, freezeCount: freezeRows.length },
    evidence: [
      {
        axis: "retention",
        evidence_kind: "retention_formula",
        summary: `active=${activeProjects}/${projectRows.length}, progress=${Math.round(progressScore)}, freeze=${freezeRows.length}`,
        source_type: "computed",
        source_ref: "projects+milestone_monthly_progress+project_meeting_summaries",
        impact: score - 50,
        confidence: 0.72,
        payload: { activeProjects, progressScore, meetingSignal, freezeCount: freezeRows.length },
      },
      ...topBy([...freezeRows, ...meetingRows, ...progressRows], (row) => num(row.signal_value_numeric, 1), 5).map((row) => ({
        axis: "retention" as const,
        evidence_kind: row.source_kind,
        summary: `${row.signal_key}: ${brief(row)}`,
        source_type: row.source_table,
        source_ref: sourceRef(row),
        source_hash: row.source_hash,
        impact: row.signal_key.includes("risk") || row.signal_key.includes("freeze") ? -15 : 8,
        confidence: num(row.confidence, 0.5),
        payload: { project_id: row.project_id, value: row.signal_value_numeric },
      })),
    ],
  };
}

function scorePipeline(rows: RawSignal[]): AxisScore {
  const seeds = rows.filter((row) => row.source_kind === "seed");
  const contacts = rows.filter((row) => row.source_kind === "seed_contact");
  const diffs = rows.filter((row) => row.source_kind === "registry_diff");
  const knowledge = rows.filter((row) => row.source_kind === "project_knowledge");
  const reviewedSeeds = seeds.filter((row) => !row.signal_key.includes("lost") && !row.signal_key.includes("dismiss")).length;
  const seedScore = clamp(Math.min(1, reviewedSeeds / 30) * 100);
  const contactScore = clamp(Math.min(1, contacts.length / 8) * 100);
  const diffScore = clamp(Math.min(1, diffs.length / 8) * 100);
  const knowledgeScore = clamp(Math.min(1, knowledge.length / 25) * 100);
  const score = clamp(seedScore * 0.35 + contactScore * 0.25 + diffScore * 0.2 + knowledgeScore * 0.2);
  return {
    score,
    confidence: seeds.length || knowledge.length ? 0.7 : 0.4,
    inputs: { seeds: seeds.length, reviewedSeeds, contacts: contacts.length, diffs: diffs.length, knowledge: knowledge.length, seedScore, contactScore, diffScore, knowledgeScore },
    evidence: topBy([...contacts, ...diffs, ...knowledge, ...seeds], (row) => num(row.weight_hint, 1), 8).map((row) => ({
      axis: "pipeline",
      evidence_kind: row.source_kind,
      summary: `${row.signal_key}: ${brief(row)}`,
      source_type: row.source_table,
      source_ref: sourceRef(row),
      source_hash: row.source_hash,
      impact: 8,
      confidence: num(row.confidence, 0.5),
      payload: { project_id: row.project_id, value: row.signal_value_numeric },
    })),
  };
}

function scoreDirection(rows: RawSignal[]): AxisScore {
  const amdScore = rows.filter((row) => row.source_kind === "amd_score");
  const protocols = rows.filter((row) => row.source_kind === "protocol");
  const ventures = rows.filter((row) => row.source_kind === "venture_portfolio");
  const atlas = rows.filter((row) => row.source_kind === "atlas");
  const macro = rows.filter((row) => row.source_kind === "macro_index");
  const amdScoreAvg = avg(amdScore.map((row) => num(row.signal_value_numeric)).filter((n) => n > 0), 5) * 10;
  const protocolScore = clamp(Math.min(1, protocols.length / 40) * 100);
  const ventureScore = clamp(Math.min(1, ventures.length / 10) * 100);
  const atlasScore = clamp(Math.min(1, (atlas.length + macro.length) / 80) * 100);
  const score = clamp(amdScoreAvg * 0.3 + protocolScore * 0.25 + ventureScore * 0.25 + atlasScore * 0.2);
  return {
    score,
    confidence: amdScore.length || ventures.length ? 0.68 : 0.45,
    inputs: { amdScoreAvg, protocolScore, ventureScore, atlasScore, amdScore: amdScore.length, protocols: protocols.length, ventures: ventures.length, atlas: atlas.length, macro: macro.length },
    evidence: topBy([...amdScore, ...protocols, ...ventures, ...atlas, ...macro], (row) => num(row.weight_hint, 1), 8).map((row) => ({
      axis: "direction",
      evidence_kind: row.source_kind,
      summary: `${row.signal_key}: ${brief(row)}`,
      source_type: row.source_table,
      source_ref: sourceRef(row),
      source_hash: row.source_hash,
      impact: 7,
      confidence: num(row.confidence, 0.5),
      payload: { project_id: row.project_id, value: row.signal_value_numeric },
    })),
  };
}

function applyFinanceCap(total: number, finance: AxisScore) {
  const runway = num(finance.inputs.runway, 999);
  if (runway < 2) return { total: Math.min(total, 45), cap: "runway_lt_2" };
  if (runway < 4) return { total: Math.min(total, 60), cap: "runway_lt_4" };
  return { total, cap: null };
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

  const byAxis: Record<Axis, RawSignal[]> = {
    initiative: rows.filter((row) => row.axis === "initiative"),
    finance: rows.filter((row) => row.axis === "finance"),
    retention: rows.filter((row) => row.axis === "retention"),
    pipeline: rows.filter((row) => row.axis === "pipeline"),
    direction: rows.filter((row) => row.axis === "direction"),
  };

  const axisScores: Record<Axis, AxisScore> = {
    initiative: scoreInitiative(byAxis.initiative),
    finance: scoreFinance(byAxis.finance),
    retention: scoreRetention(byAxis.retention),
    pipeline: scorePipeline(byAxis.pipeline),
    direction: scoreDirection(byAxis.direction),
  };

  const weighted = (Object.keys(WEIGHTS) as Axis[]).reduce((sum, axis) => sum + axisScores[axis].score * WEIGHTS[axis], 0);
  const capped = applyFinanceCap(weighted, axisScores.finance);
  const totalScore = Math.round(capped.total);
  const confidence = avg((Object.keys(axisScores) as Axis[]).map((axis) => axisScores[axis].confidence), 0.5);
  const inputs = {
    rawSignalCount: rows.length,
    byAxis: Object.fromEntries((Object.keys(byAxis) as Axis[]).map((axis) => [axis, byAxis[axis].length])),
    axisInputs: Object.fromEntries((Object.keys(axisScores) as Axis[]).map((axis) => [axis, axisScores[axis].inputs])),
    financeCap: capped.cap,
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
      weights_json: WEIGHTS,
      inputs_json: inputs,
      next_actions_json: [],
      confidence,
      created_by: "management_score_calculator_v1",
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
