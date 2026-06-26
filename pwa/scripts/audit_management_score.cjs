#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function currentYmJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function truncate(value, max = 140) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function average(values, fallback = 0) {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupBy(rows, getKey) {
  return rows.reduce((acc, row) => {
    const key = getKey(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sourceRef(row) {
  return `${row.source_table}:${row.source_id}:${row.signal_key}`;
}

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function fetchAll(queryBuilder) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryBuilder().range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function fetchByIn(supabase, table, select, column, values) {
  const uniqueValues = uniq(values);
  const rows = [];
  for (let i = 0; i < uniqueValues.length; i += 100) {
    const chunk = uniqueValues.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase.from(table).select(select).in(column, chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function priorityRank(priority) {
  return { P0: 0, P1: 1, P2: 2, info: 3 }[priority] ?? 9;
}

function makeFinding(priority, title, detail, rows = [], suggestion = "") {
  return {
    priority,
    title,
    detail,
    count: rows.length,
    examples: rows.slice(0, 5),
    suggestion,
  };
}

function parseProgressSourceRef(ref) {
  const parts = String(ref || "").split(":");
  if (parts[0] !== "milestone_monthly_progress") return null;
  return { sourceId: parts[1], signalKey: parts.slice(2).join(":") };
}

async function main() {
  const ym = argValue("ym") || currentYmJST();
  const jsonMode = hasFlag("json");
  const failOnP0 = hasFlag("fail-on-p0");
  const failOnActionable = hasFlag("fail-on-actionable");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const [rawRows, evidenceRows, snapshotResult] = await Promise.all([
    fetchAll(() => supabase
      .from("amd_management_score_raw_signals")
      .select("id,ym,axis,source_kind,source_table,source_id,signal_key,signal_value_numeric,signal_value_text,project_id,observed_at,confidence,weight_hint,payload,source_hash")
      .eq("ym", ym)
      .order("id", { ascending: true })),
    fetchAll(() => supabase
      .from("amd_management_score_evidence")
      .select("id,snapshot_id,ym,axis,evidence_kind,summary,source_type,source_ref,impact,confidence,payload,created_at")
      .eq("ym", ym)
      .order("axis", { ascending: true })),
    supabase
      .from("amd_management_score_snapshots")
      .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence,inputs_json,updated_at")
      .eq("ym", ym)
      .maybeSingle(),
  ]);
  if (snapshotResult.error) throw snapshotResult.error;
  const snapshot = snapshotResult.data || null;

  const progressRawRows = rawRows.filter((row) => row.axis === "retention" && row.source_kind === "progress");
  const progressIds = uniq([
    ...progressRawRows.map((row) => row.payload?.milestone_key),
    ...evidenceRows
      .filter((row) => row.source_type === "milestone_monthly_progress")
      .map((row) => row.payload?.milestone_key),
  ]);
  const milestones = await fetchByIn(
    supabase,
    "value_milestones",
    "milestone_id,plan_cycle_id,title,points,tag,goal_level,is_active,success_criteria,period_start_ym,target_ym",
    "milestone_id",
    progressIds
  );
  const milestoneById = new Map(milestones.map((row) => [String(row.milestone_id), row]));
  const planCycles = await fetchByIn(
    supabase,
    "value_plan_cycles",
    "plan_cycle_id,project_id,status,budget_yen,total_points,period_start_ym,period_end_ym",
    "plan_cycle_id",
    milestones.map((row) => row.plan_cycle_id)
  );
  const planById = new Map(planCycles.map((row) => [String(row.plan_cycle_id), row]));

  const findings = [];
  const rawBySourceRef = new Map(rawRows.map((row) => [sourceRef(row), row]));
  const rawById = new Map(rawRows.map((row) => [String(row.source_id), row]));

  const progressEvidence = evidenceRows.filter((row) => row.axis === "retention" && row.evidence_kind === "progress_strong");
  const progressEvidenceExpanded = progressEvidence.map((ev) => {
    const parsed = parseProgressSourceRef(ev.source_ref);
    const raw = rawBySourceRef.get(ev.source_ref) || (parsed ? rawById.get(parsed.sourceId) : null);
    const milestoneKey = String(raw?.payload?.milestone_key || ev.payload?.milestone_key || "");
    const milestone = milestoneById.get(milestoneKey);
    const plan = milestone ? planById.get(String(milestone.plan_cycle_id)) : null;
    return { ev, raw, milestoneKey, milestone, plan };
  });

  const routineConfirmed = progressRawRows.filter((row) =>
    row.payload?.source === "routine_auto"
    && row.payload?.confirmed_at
    && row.signal_key === "milestone:confirmed_progress"
  ).map((row) => ({
    milestone_key: row.payload?.milestone_key,
    progress_pct: row.signal_value_numeric,
    source: row.payload?.source,
    confirmed_at: row.payload?.confirmed_at,
    source_ref: sourceRef(row),
  }));
  if (routineConfirmed.length > 0) {
    findings.push(makeFinding(
      "P0",
      "routine_auto が確認済として扱われている",
      "非LLMの自動按分値なのに confirmed_at が入り、Management Scoreでは確認済進捗として扱われている。",
      routineConfirmed,
      "routine_auto の confirmed_at を null にし、確認済判定は source がPM lockedかどうかで行う。"
    ));
  }

  const internalProgressEvidence = progressEvidenceExpanded.filter(({ milestoneKey, milestone, plan, raw }) => {
    const title = String(milestone?.title || "");
    return (
      String(plan?.project_id || "").toLowerCase() === "p00"
      || milestoneKey.startsWith("MS-p00-")
      || number(milestone?.points, 0) === 0
      || raw?.payload?.source === "routine_auto"
      || /月次ルーティン|monthly-routine|内部|AMD OS/.test(title)
    );
  }).map(({ ev, raw, milestoneKey, milestone, plan }) => ({
    milestone_key: milestoneKey,
    title: milestone?.title,
    project_id: plan?.project_id,
    points: milestone?.points,
    source: raw?.payload?.source,
    impact: ev.impact,
    summary: ev.summary,
    source_ref: ev.source_ref,
  }));
  if (internalProgressEvidence.length > 0) {
    findings.push(makeFinding(
      "P0",
      "内部運用MSや自動按分MSが継続根拠に表示されている",
      "p00、points=0、routine_auto、内部OS運用MSは、既存PJ継続の根拠として表示すべきではない。",
      internalProgressEvidence,
      "継続軸のprogress evidenceに会社継続スコープ判定を追加する。"
    ));
  }

  const progressValues = progressRawRows.map((row) => number(row.signal_value_numeric)).filter((value) => value >= 0);
  const progressAvg = average(progressValues, 55);
  const inflatedProgressImpact = progressEvidenceExpanded.map(({ ev, milestoneKey }) => {
    const without = progressRawRows
      .filter((row) => row.payload?.milestone_key !== milestoneKey)
      .map((row) => number(row.signal_value_numeric))
      .filter((candidate) => candidate >= 0);
    const withoutAvg = average(without, progressAvg);
    const approxContribution = (progressAvg - withoutAvg) * 0.35;
    return {
      milestone_key: milestoneKey,
      displayed_impact: number(ev.impact),
      approx_retention_contribution: Math.round(approxContribution * 100) / 100,
      summary: ev.summary,
    };
  }).filter((row) => Math.abs(row.displayed_impact) > Math.abs(row.approx_retention_contribution) + 2);
  if (inflatedProgressImpact.length > 0) {
    findings.push(makeFinding(
      "P1",
      "progress evidence の impact が実寄与より大きく見える",
      "固定impactのため、実際の継続score寄与より根拠カードが強く見える。",
      inflatedProgressImpact,
      "progress evidenceのimpactを実寄与で計算するか、継続根拠からMS進捗を外す。"
    ));
  }

  const initiative = snapshot?.inputs_json?.axisInputs?.initiative || {};
  const totalEvents = number(initiative.totalEvents);
  const unknownCount = number(initiative.unknownCount);
  const initiativeScore = number(snapshot?.initiative_score);
  const initiativeConfidence = number(snapshot?.inputs_json?.axisConfidence?.initiative ?? snapshot?.confidence);
  const initiativeModifier = number(snapshot?.inputs_json?.initiative_modifier, 1);
  const unknownRatio = totalEvents > 0 ? unknownCount / totalEvents : 0;
  if (totalEvents > 0 && unknownRatio >= 0.5 && initiativeModifier < 1) {
    findings.push(makeFinding(
      "P0",
      "起点不明が多い先手力で不可逆ペナルティが発動している",
      `unknown ${unknownCount}/${totalEvents} 件なのに initiative_modifier=${initiativeModifier}。分類不足を経営危機として総合点へ掛けている。`,
      [{ unknownCount, totalEvents, initiativeScore, initiativeModifier }],
      "起点不明は点数低下ではなく判定信頼度低下として扱い、分類不足の月は不可逆ペナルティを発動しない。"
    ));
  }
  if (totalEvents > 0 && unknownRatio >= 0.5 && initiativeConfidence >= 0.6) {
    findings.push(makeFinding(
      "P1",
      "起点不明が多い先手力の判定信頼度が高すぎる",
      `unknown ${unknownCount}/${totalEvents} 件なのに判定信頼度 ${initiativeConfidence.toFixed(2)}。分類不足を低信頼として表示できていない。`,
      [{ unknownCount, totalEvents, initiativeScore, initiativeConfidence }],
      "unknown比率が高い場合は、scoreではなく判定信頼度を下げて「暫定/要確認」と表示する。"
    ));
  }
  if (totalEvents > 0 && unknownRatio >= 0.5 && initiativeModifier >= 1 && initiativeConfidence < 0.6) {
    findings.push(makeFinding(
      "info",
      "先手力の起点不明は判定信頼度低下に分離済み",
      "起点不明の多さは会社の後手化ではなく分類不足として扱われ、総合点への不可逆ペナルティは発動していない。",
      [{ unknownCount, totalEvents, initiativeScore, initiativeConfidence, initiativeModifier }],
      "起点分類の抽出品質を上げる。"
    ));
  }

  const directionRows = rawRows.filter((row) => row.axis === "direction");
  const unimplementedDirection = directionRows.filter((row) =>
    row.source_kind === "amd_os_install"
    || (row.source_kind === "direction_data_missing" && row.signal_value_numeric != null)
  ).map((row) => ({
    source_kind: row.source_kind,
    signal_key: row.signal_key,
    value: row.signal_value_numeric,
    text: row.signal_value_text,
  }));
  if (unimplementedDirection.length > 0 && number(snapshot?.direction_score) < 30) {
    findings.push(makeFinding(
      "P1",
      "未実装入力が方向性スコアの低下に混ざっている",
      "未実装テーブルや未取得sourceの0件は、悪い状態ではなく不明として扱うべき。",
      unimplementedDirection,
      "未実装入力はscore計算から外し、confidenceや要実装メモに分離する。"
    ));
  }
  const directionMissingEvidence = evidenceRows.filter((row) =>
    row.axis === "direction"
    && (row.evidence_kind === "amd_os_install" || row.evidence_kind === "data_missing")
    && row.source_type === "amd_os_installations"
  );
  const directionMissingPenalty = directionMissingEvidence.filter((row) => number(row.impact) < 0);
  if (directionMissingPenalty.length > 0) {
    findings.push(makeFinding(
      "P1",
      "未実装のAMD OS導入入力が悪化根拠として表示されている",
      "amd_os_installations 未作成は data_missing であり、方向性の悪化impactを持たせない。",
      directionMissingPenalty.map((row) => ({ impact: row.impact, summary: row.summary, source_ref: row.source_ref })),
      "data_missing evidence は impact=0 にし、score は実装済みsourceだけで再配分する。"
    ));
  }
  const directionMissingInfo = directionRows.filter((row) => row.source_kind === "direction_data_missing").map((row) => ({
    source_kind: row.source_kind,
    signal_key: row.signal_key,
    text: row.signal_value_text,
    confidence: row.confidence,
  }));
  if (directionMissingInfo.length > 0) {
    findings.push(makeFinding(
      "info",
      "方向性の未実装sourceはdata_missingとして分離済み",
      "未実装テーブルや未取得sourceをscore悪化ではなく信頼度低下として扱っている。",
      directionMissingInfo,
      "amd_os_installations を実装したら raw source_kind を amd_os_install に戻し、実測件数で評価する。"
    ));
  }

  const revenueZeroEvidence = evidenceRows.filter((row) =>
    row.axis === "finance"
    && row.evidence_kind === "budget_variance"
    && number(row.impact) <= -10
    && /実績 0円|実績 0/.test(String(row.summary))
    && row.payload?.data_state !== "data_missing"
    && row.payload?.actual_data_state !== "actual_synced"
  ).map((row) => ({
    impact: row.impact,
    summary: row.summary,
    source_ref: row.source_ref,
  }));
  if (revenueZeroEvidence.length > 0) {
    findings.push(makeFinding(
      "P1",
      "実績0円が強い悪化根拠として出ている",
      "本当に売上未達なのか、freee/OS同期未完了なのかが分離されていない可能性がある。",
      revenueZeroEvidence,
      "未同期は data_missing として分け、悪化根拠にする前にsource鮮度を確認する。"
    ));
  }

  const commercialEvidence = evidenceRows.filter((row) => row.axis === "pipeline" && row.evidence_kind === "commercial_progress");
  const duplicateGroups = Object.entries(groupBy(commercialEvidence, (row) => {
    const payload = row.payload || {};
    return `${payload.project_id || payload.project_name || "unknown"}:${payload.expected_contract_ym || ""}:${payload.stage || ""}`;
  })).filter(([, count]) => count >= 2);
  if (duplicateGroups.length > 0) {
    findings.push(makeFinding(
      "P2",
      "同一案件らしきpipeline根拠が複数出ている",
      "同じPJ・同じ契約見込月・同じstageの商談根拠が複数あり、重複加点の可能性がある。",
      duplicateGroups.map(([key, count]) => ({ key, count })),
      "案件単位のdeal idまたは正規化キーでまとめてから加点する。"
    ));
  }

  const contextRows = rawRows.filter((row) => row.source_kind === "meeting_summary" && row.signal_key === "meeting:context");
  if (contextRows.length > 0) {
    findings.push(makeFinding(
      "info",
      "MTG contextがrawに残っている",
      "スコア対象外として保存されているMTG文脈。表示や加減点には使わない前提。",
      [{ count: contextRows.length }],
      "raw保存は可。ただし表示対象になったらP0扱い。"
    ));
  }

  const summary = {
    ym,
    snapshot: snapshot ? {
      total: snapshot.total_score,
      initiative: snapshot.initiative_score,
      finance: snapshot.finance_score,
      retention: snapshot.retention_score,
      pipeline: snapshot.pipeline_score,
      direction: snapshot.direction_score,
      updated_at: snapshot.updated_at,
    } : null,
    rawCount: rawRows.length,
    evidenceCount: evidenceRows.length,
    rawByAxisAndKind: groupBy(rawRows, (row) => `${row.axis}:${row.source_kind}`),
    evidenceByAxisAndKind: groupBy(evidenceRows, (row) => `${row.axis}:${row.evidence_kind}`),
    findings: findings.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
  };

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printJapaneseReport(summary);
  }

  const hasP0 = findings.some((finding) => finding.priority === "P0");
  const hasActionable = findings.some((finding) => ["P0", "P1", "P2"].includes(finding.priority));
  if ((failOnP0 && hasP0) || (failOnActionable && hasActionable)) {
    process.exit(2);
  }
}

function printJapaneseReport(summary) {
  console.log(`# 経営スコア現状点検 ${summary.ym}`);
  console.log("");
  if (summary.snapshot) {
    const s = summary.snapshot;
    console.log(`総合 ${s.total} / 先手力 ${s.initiative} / 財務 ${s.finance} / 継続 ${s.retention} / 新規 ${s.pipeline} / 方向 ${s.direction}`);
    console.log(`更新: ${s.updated_at}`);
  } else {
    console.log("snapshotなし");
  }
  console.log(`raw ${summary.rawCount}件 / evidence ${summary.evidenceCount}件`);
  console.log("");

  const byPriority = { P0: [], P1: [], P2: [], info: [] };
  for (const finding of summary.findings) {
    (byPriority[finding.priority] || byPriority.info).push(finding);
  }

  for (const [priority, label] of [
    ["P0", "今すぐ止める"],
    ["P1", "式を直す"],
    ["P2", "設計確認"],
    ["info", "参考"],
  ]) {
    const rows = byPriority[priority] || [];
    console.log(`## ${priority} ${label}: ${rows.length}件`);
    if (rows.length === 0) {
      console.log("- なし");
      console.log("");
      continue;
    }
    for (const finding of rows) {
      console.log(`- ${finding.title} (${finding.count}件)`);
      console.log(`  - ${finding.detail}`);
      if (finding.suggestion) console.log(`  - 対応: ${finding.suggestion}`);
      for (const example of finding.examples) {
        console.log(`  - 例: ${truncate(JSON.stringify(example), 220)}`);
      }
    }
    console.log("");
  }

  console.log("## raw内訳");
  for (const [key, count] of Object.entries(summary.rawByAxisAndKind).sort()) {
    console.log(`- ${key}: ${count}`);
  }
  console.log("");
  console.log("## evidence内訳");
  for (const [key, count] of Object.entries(summary.evidenceByAxisAndKind).sort()) {
    console.log(`- ${key}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
