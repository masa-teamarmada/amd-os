/**
 * 卒業フェーズ検出 (= まさ #84 確定 2026-05-26)
 *
 * 各 PJ × 月で 6 シグナルを集計し、 readiness_score を 0-100 で算出。
 * 70% 以上で project_strategy_signals に candidate insert され、 まさえいMTG 議題に上がる。
 *
 * 6 シグナル (= manual/39-graduation-detection-spec.md):
 *  1. MTG main talker の遷移 (LLM 必須 → MVP では 0)
 *  2. AMD member events 減少 (= member_activities 月次推移 線形回帰)
 *  3. monthly_reports の AMD 寄与文言減少 (LLM 必須 → MVP では 0)
 *  4. CEO 候補の milestone 主導比率 (= milestone_responsibility 集計)
 *  5. 経営判断の起点シフト (= protocols 集計)
 *  6. 「もう大丈夫」キーワード検知 (= project_meeting_summaries grep)
 *
 * Phase 2 で signal 1 / 3 を LLM 経由で実装する。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface SignalResult {
  signal_1_talker: number;
  signal_2_events: number;
  signal_3_reports: number;
  signal_4_milestones: number;
  signal_5_decisions: number;
  signal_6_keywords: number;
  readiness_score: number;
  inputs: Record<string, unknown>;
  matched_keywords: string[];
  evidence_text: string;
}

const SIGNAL_WEIGHTS = {
  signal_1_talker: 0.20,
  signal_2_events: 0.20,
  signal_3_reports: 0.15,
  signal_4_milestones: 0.20,
  signal_5_decisions: 0.15,
  signal_6_keywords: 0.10,
};

const KEYWORDS = ["卒業", "自走", "自走可能", "引き継ぎ", "撤退", "AMD 撤退", "自立", "独立運営"];

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function ymAddMonths(ym: string, delta: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  let total = y * 12 + (m - 1) + delta;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}${String(newM).padStart(2, "0")}`;
}

async function fetchAmdMemberIds(supabase: SupabaseClient): Promise<Set<string>> {
  // AMD member = members.role = 'amd' or 'amd_member' or 'admin' / is_admin=true
  // 簡易版: is_admin=true OR role が amd 系
  const { data } = await supabase
    .from("members")
    .select("member_id,role,is_admin")
    .or("is_admin.eq.true,role.like.%amd%");
  return new Set((data ?? []).map((r: { member_id: string }) => String(r.member_id)));
}

async function computeSignal2_EventsDecline(
  supabase: SupabaseClient,
  projectId: string,
  ym: string,
  amdMemberIds: Set<string>,
): Promise<{ score: number; inputs: Record<string, unknown> }> {
  // 過去 6 ヶ月の AMD member 起点 events 件数の月次推移
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(ymAddMonths(ym, -i));
  const counts: number[] = [];
  for (const m of months) {
    const { data } = await supabase
      .from("member_activities")
      .select("id,member_id")
      .eq("project_id", projectId)
      .eq("ym", m);
    const amdEvents = (data ?? []).filter((r: { member_id: string }) => amdMemberIds.has(String(r.member_id))).length;
    counts.push(amdEvents);
  }
  // 線形回帰の傾き (= 1 ヶ月あたりの減少率)
  const n = counts.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = counts.reduce((a, b) => a + b, 0);
  const sumXY = counts.reduce((s, y, i) => s + i * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const avgEvents = sumY / n;
  // slope が負 (= 減少傾向) で、 傾きの絶対値が大きいほど高得点
  // 目安: 月次で 50% 減 = avgEvents * 0.5 / month の傾き → 100 点
  // slope >= 0 (= 微増 or 横ばい) → 0 点
  const target = -Math.max(1, avgEvents * 0.5);
  const score = slope >= 0 ? 0 : clamp((slope / target) * 100);
  return { score, inputs: { months, counts, slope, avgEvents, target } };
}

async function computeSignal4_MilestoneShift(
  supabase: SupabaseClient,
  projectId: string,
  ym: string,
  amdMemberIds: Set<string>,
): Promise<{ score: number; inputs: Record<string, unknown> }> {
  // 直近 3 ヶ月の milestone_responsibility で AMD vs 非 AMD の比率
  const sinceYm = ymAddMonths(ym, -2);
  const { data: milestones } = await supabase
    .from("milestone_responsibility")
    .select("milestone_key,member_id,responsibility")
    .gte("milestone_key", `${projectId}:`)
    .lt("milestone_key", `${projectId}:zzzzz`);
  const rows = (milestones ?? []) as Array<{ member_id: string; responsibility: number }>;
  if (rows.length === 0) {
    return { score: 0, inputs: { note: "milestone_responsibility 該当なし", since_ym: sinceYm } };
  }
  let amdShare = 0;
  let nonAmdShare = 0;
  for (const r of rows) {
    const resp = Number(r.responsibility ?? 0);
    if (amdMemberIds.has(String(r.member_id))) amdShare += resp;
    else nonAmdShare += resp;
  }
  const total = amdShare + nonAmdShare;
  const nonAmdRatio = total > 0 ? nonAmdShare / total : 0;
  // 非 AMD 比率 70% で満点
  const score = clamp(Math.min(1, nonAmdRatio / 0.7) * 100);
  return { score, inputs: { amdShare, nonAmdShare, nonAmdRatio } };
}

async function computeSignal5_DecisionShift(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ score: number; inputs: Record<string, unknown> }> {
  // protocols の kind 集計 (= proactive_amd vs ceo_led)
  // 現状の protocols スキーマには kind 列があるが、 ceo_led は実データに無い可能性
  // MVP では status='confirmed' の protocol 数のうち、 source や tags に「ceo」「founder」が
  // 含まれる比率を ceo_led 相当として扱う
  const { data } = await supabase
    .from("protocols")
    .select("id,kind,status,source,tags,title")
    .eq("project_id", projectId)
    .eq("status", "confirmed");
  const rows = (data ?? []) as Array<{ kind: string | null; source: string | null; tags: string | null; title: string | null }>;
  if (rows.length === 0) {
    return { score: 0, inputs: { note: "confirmed protocols なし" } };
  }
  const ceoLed = rows.filter((r) => {
    const text = `${r.kind ?? ""} ${r.source ?? ""} ${r.tags ?? ""} ${r.title ?? ""}`.toLowerCase();
    return text.includes("ceo") || text.includes("founder") || text.includes("ceo_led");
  }).length;
  const proactiveAmd = rows.length - ceoLed;
  const ratio = rows.length > 0 ? ceoLed / rows.length : 0;
  // ceo_led 比率 70% で満点
  const score = clamp(Math.min(1, ratio / 0.7) * 100);
  return { score, inputs: { total: rows.length, ceoLed, proactiveAmd, ratio } };
}

async function computeSignal6_Keywords(
  supabase: SupabaseClient,
  projectId: string,
  ym: string,
): Promise<{ score: number; inputs: Record<string, unknown>; matched: string[] }> {
  // 直近 3 ヶ月の project_meeting_summaries で「卒業」 「自走」 「引き継ぎ」 等のキーワード検知
  const sinceYm = ymAddMonths(ym, -2);
  const { data } = await supabase
    .from("project_meeting_summaries")
    .select("meeting_id,ym,decided,progress,next_actions,risks,summary_short")
    .eq("project_id", projectId)
    .gte("ym", sinceYm);
  const rows = (data ?? []) as Array<{ meeting_id: string; ym: string; decided: unknown; progress: unknown; next_actions: unknown; risks: unknown; summary_short: string }>;
  const matched: string[] = [];
  const matchedMeetings: string[] = [];
  for (const r of rows) {
    const blob = JSON.stringify([r.decided, r.progress, r.next_actions, r.risks, r.summary_short]);
    for (const kw of KEYWORDS) {
      if (blob.includes(kw) && !matched.includes(kw)) matched.push(kw);
    }
    if (KEYWORDS.some((kw) => blob.includes(kw))) matchedMeetings.push(r.meeting_id);
  }
  const score = matched.length > 0 ? 100 : 0;
  return { score, inputs: { meetingCount: rows.length, matched, matchedMeetings }, matched };
}

async function computeSignalsForProject(
  supabase: SupabaseClient,
  projectId: string,
  projectName: string,
  ym: string,
  amdMemberIds: Set<string>,
): Promise<SignalResult> {
  // signal 1 / 3 は LLM 必須、 MVP では 0 で保存
  const signal1 = { score: 0, inputs: { note: "LLM 未実装、 Phase 2 で追加" } };
  const signal3 = { score: 0, inputs: { note: "LLM 未実装、 Phase 2 で追加" } };

  const [signal2, signal4, signal5, signal6] = await Promise.all([
    computeSignal2_EventsDecline(supabase, projectId, ym, amdMemberIds),
    computeSignal4_MilestoneShift(supabase, projectId, ym, amdMemberIds),
    computeSignal5_DecisionShift(supabase, projectId),
    computeSignal6_Keywords(supabase, projectId, ym),
  ]);

  const readiness = clamp(
    signal1.score * SIGNAL_WEIGHTS.signal_1_talker
    + signal2.score * SIGNAL_WEIGHTS.signal_2_events
    + signal3.score * SIGNAL_WEIGHTS.signal_3_reports
    + signal4.score * SIGNAL_WEIGHTS.signal_4_milestones
    + signal5.score * SIGNAL_WEIGHTS.signal_5_decisions
    + signal6.score * SIGNAL_WEIGHTS.signal_6_keywords,
  );

  const evidence = [
    `${projectName} の卒業準備度 ${Math.round(readiness)}%。`,
    `events 推移 ${Math.round(signal2.score)}点、`,
    `milestone CEO 主導 ${Math.round(signal4.score)}点、`,
    `経営判断 CEO 起点 ${Math.round(signal5.score)}点、`,
    signal6.matched.length > 0 ? `🚨 キーワード「${signal6.matched.join("/")}」検出。` : "キーワード未検出。",
    "(signal 1/3 は LLM 未実装、 Phase 2 で追加)",
  ].join(" ");

  return {
    signal_1_talker: signal1.score,
    signal_2_events: signal2.score,
    signal_3_reports: signal3.score,
    signal_4_milestones: signal4.score,
    signal_5_decisions: signal5.score,
    signal_6_keywords: signal6.score,
    readiness_score: readiness,
    inputs: { signal1, signal2, signal3, signal4, signal5, signal6, weights: SIGNAL_WEIGHTS },
    matched_keywords: signal6.matched,
    evidence_text: evidence,
  };
}

export async function runGraduationDetection(supabase: SupabaseClient, ym: string): Promise<{ ok: boolean; processed: number; candidates: number; results: Array<{ project_id: string; readiness: number; alert: string }> }> {
  // 対象 PJ: status='active' AND project_ventures.amd_support_ended_at IS NULL
  const [{ data: activeProjects }, { data: ventures }] = await Promise.all([
    supabase.from("projects").select("project_id,project_name,status").eq("status", "active"),
    supabase.from("project_ventures").select("project_id,amd_support_ended_at"),
  ]);
  const graduatedPjs = new Set(
    ((ventures ?? []) as Array<{ project_id: string; amd_support_ended_at: string | null }>)
      .filter((v) => v.amd_support_ended_at)
      .map((v) => String(v.project_id)),
  );
  const targets = ((activeProjects ?? []) as Array<{ project_id: string; project_name: string }>)
    .filter((p) => !graduatedPjs.has(String(p.project_id)) && p.project_id !== "p00");

  const amdMemberIds = await fetchAmdMemberIds(supabase);
  const results: Array<{ project_id: string; readiness: number; alert: string }> = [];
  let candidatesCreated = 0;

  for (const pj of targets) {
    const sig = await computeSignalsForProject(supabase, pj.project_id, pj.project_name, ym, amdMemberIds);
    await supabase
      .from("project_graduation_signals")
      .upsert(
        {
          project_id: pj.project_id,
          ym,
          readiness_score: sig.readiness_score,
          signal_1_talker: sig.signal_1_talker,
          signal_2_events: sig.signal_2_events,
          signal_3_reports: sig.signal_3_reports,
          signal_4_milestones: sig.signal_4_milestones,
          signal_5_decisions: sig.signal_5_decisions,
          signal_6_keywords: sig.signal_6_keywords,
          inputs_json: sig.inputs,
          evidence_text: sig.evidence_text,
          matched_keywords: sig.matched_keywords,
        },
        { onConflict: "project_id,ym" },
      );

    let alert = "観察継続";
    if (sig.readiness_score >= 70) {
      alert = sig.readiness_score >= 90 ? "急務 (= 通知優先度 critical)" : "卒業提案候補 (= まさえいMTG 議題)";
      // project_strategy_signals に candidate insert (= source_hash で重複防止)
      const sourceHash = `graduation_detection:${pj.project_id}:${ym}`;
      const { data: existing } = await supabase
        .from("project_strategy_signals")
        .select("signal_id")
        .eq("project_id", pj.project_id)
        .eq("ym", ym)
        .eq("source_hash", sourceHash)
        .maybeSingle();
      if (!existing) {
        await supabase.from("project_strategy_signals").insert({
          project_id: pj.project_id,
          ym,
          signal_type: "next_move",
          title: `卒業提案候補: ${pj.project_name} (readiness ${Math.round(sig.readiness_score)}%)`,
          summary: sig.evidence_text,
          polarity: "forward",
          impact_level: sig.readiness_score >= 90 ? "critical" : "high",
          decision_state: "proposed",
          status: "candidate",
          score_impact_summary: "成功卒業で direction.graduation_score に加点見込み (= 戦略接近度の 1 入力)",
          source_refs_json: [{ source: "graduation_detection", ym, readiness: sig.readiness_score }],
          source_hash: sourceHash,
          confidence: 0.7,
          created_by: "graduation_detector",
          extraction_run_id: `graduation_detection_${ym}`,
        });
        candidatesCreated++;
      }
    } else if (sig.readiness_score >= 40) {
      alert = "観察 (= 卒業準備度上昇中)";
    }
    results.push({ project_id: pj.project_id, readiness: sig.readiness_score, alert });
  }

  return { ok: true, processed: targets.length, candidates: candidatesCreated, results };
}
