/**
 * 卒業フェーズ検出 (= まさ #84 確定 2026-05-26)
 *
 * 各 PJ × 月で 6 シグナルを集計し、 readiness_score を 0-100 で算出。
 * 70% 以上で project_strategy_signals に candidate insert され、 まさえいMTG 議題に上がる。
 *
 * 6 シグナル (= manual/39-graduation-detection-spec.md):
 *  1. MTG main talker の遷移 (LLM、 llm_prompts.graduation_detection.talker_ratio is_active=TRUE で稼働)
 *  2. AMD member events 減少 (= member_activities 月次推移 線形回帰)
 *  3. monthly_reports の AMD 寄与文言減少 (LLM、 llm_prompts.graduation_detection.report_attribution is_active=TRUE で稼働)
 *  4. CEO 候補の milestone 主導比率 (= milestone_responsibility 集計)
 *  5. 経営判断の起点シフト (= protocols 集計)
 *  6. 「もう大丈夫」キーワード検知 (= project_meeting_summaries grep)
 *
 * LLM signal (1, 3) は llm_prompts が is_active=FALSE / 空のとき 0 を返す (= AGENTS 絶対ルール: 空なら抽出 skip)。
 * 詳細 prompt は migration 095_graduation_detection_llm_prompts.sql。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

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

interface PromptRow {
  body: string;
  model: string | null;
  max_tokens: number | null;
}

async function loadPrompt(supabase: SupabaseClient, promptKey: string): Promise<PromptRow | null> {
  const { data } = await supabase
    .from("llm_prompts")
    .select("body, model, max_tokens, is_active")
    .eq("prompt_key", promptKey)
    .limit(1)
    .single();
  if (!data) return null;
  if (!data.is_active || !data.body || !String(data.body).trim()) return null;
  return { body: data.body, model: data.model, max_tokens: data.max_tokens };
}

function parseJsonFromLlm(text: string): Record<string, unknown> | null {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function computeSignal1_TalkerRatioLlm(
  supabase: SupabaseClient,
  anthropic: Anthropic | null,
  prompt: PromptRow | null,
  projectId: string,
  projectName: string,
  ym: string,
): Promise<{ score: number; inputs: Record<string, unknown> }> {
  if (!anthropic || !prompt) {
    return { score: 0, inputs: { note: "LLM prompt is_active=FALSE / ANTHROPIC_API_KEY 未設定、 signal 1 skip" } };
  }
  // 過去 3 ヶ月の MTG サマリを集める
  const sinceYm = ymAddMonths(ym, -2);
  const { data: meetings } = await supabase
    .from("project_meeting_summaries")
    .select("ym,meeting_date,title,summary_short,decided,next_actions,risks")
    .eq("project_id", projectId)
    .gte("ym", sinceYm)
    .order("meeting_date", { ascending: true })
    .limit(60);
  const rows = (meetings ?? []) as Array<{
    ym: string;
    meeting_date: string;
    title: string;
    summary_short: string;
    decided: unknown;
    next_actions: unknown;
    risks: unknown;
  }>;
  if (rows.length === 0) {
    return { score: 0, inputs: { note: "MTG サマリなし、 signal 1 skip" } };
  }
  // 関連メンバー (= CEO 候補同定用)
  const { data: founders } = await supabase
    .from("project_founding_members")
    .select("person_name,role,role_label_jp,category,affiliation")
    .eq("project_id", projectId)
    .eq("status", "active")
    .limit(30);
  type Founder = {
    person_name: string;
    role: string | null;
    role_label_jp: string | null;
    category: string | null;
    affiliation: string | null;
  };
  const founderRows = (founders ?? []) as Founder[];
  const external = founderRows.filter((f) => f.category !== "amd");
  const amd = founderRows.filter((f) => f.category === "amd");
  const fmt = (f: Founder) => `- ${f.person_name} / ${f.role_label_jp ?? f.role ?? "?"} / ${f.affiliation ?? ""}`;
  const founderBlock =
    `### 外部 CEO 候補 (= 主導比率を測る側)\n${external.map(fmt).join("\n") || "（未抽出）"}\n\n` +
    `### AMD member (= 主導比率を測る側)\n${amd.map(fmt).join("\n") || "（未抽出）"}`;

  const meetingBlock = rows
    .map((m) => {
      const dec = Array.isArray(m.decided) ? (m.decided as string[]).filter(Boolean) : [];
      const nxt = Array.isArray(m.next_actions) ? (m.next_actions as string[]).filter(Boolean) : [];
      const rsk = Array.isArray(m.risks) ? (m.risks as string[]).filter(Boolean) : [];
      const parts = [
        `### ${m.meeting_date} ${m.title}`,
        m.summary_short ? `要約: ${m.summary_short}` : "",
        dec.length ? `決定: ${dec.join(" / ")}` : "",
        nxt.length ? `次アクション: ${nxt.join(" / ")}` : "",
        rsk.length ? `リスク: ${rsk.join(" / ")}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n")
    .slice(0, 10000);

  const userPrompt =
    `## PJ 情報\n- projectId: ${projectId}\n- PJ 名: ${projectName}\n- 期間: 過去 3 ヶ月 (since ${sinceYm}, target ${ym})\n\n` +
    `## 関連メンバー\n${founderBlock}\n\n` +
    `## MTG サマリ集 (過去 3 ヶ月分、 全 ${rows.length} 件)\n${meetingBlock}\n\n` +
    `上記から talker_ratio_score を 0-100 で評価してください。 JSON のみで返答。`;

  try {
    const response = await anthropic.messages.create({
      model: prompt.model || "claude-sonnet-4-6",
      max_tokens: prompt.max_tokens || 2048,
      system: prompt.body,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = parseJsonFromLlm(text);
    if (!parsed) {
      return { score: 0, inputs: { note: "LLM no JSON", raw: text.slice(0, 200) } };
    }
    const score = clamp(Number(parsed.talker_ratio_score ?? 0));
    return {
      score,
      inputs: {
        score,
        ceo_speakers: parsed.ceo_speakers ?? [],
        amd_speakers: parsed.amd_speakers ?? [],
        reasoning: String(parsed.reasoning ?? "").slice(0, 500),
        meetingCount: rows.length,
      },
    };
  } catch (err) {
    return { score: 0, inputs: { note: "LLM error", error: err instanceof Error ? err.message : String(err) } };
  }
}

async function computeSignal3_ReportAttributionLlm(
  supabase: SupabaseClient,
  anthropic: Anthropic | null,
  prompt: PromptRow | null,
  projectId: string,
  projectName: string,
  ym: string,
): Promise<{ score: number; inputs: Record<string, unknown> }> {
  if (!anthropic || !prompt) {
    return { score: 0, inputs: { note: "LLM prompt is_active=FALSE / ANTHROPIC_API_KEY 未設定、 signal 3 skip" } };
  }
  // 過去 6 ヶ月の monthly_reports
  const yms: string[] = [];
  for (let i = 5; i >= 0; i--) yms.push(ymAddMonths(ym, -i));
  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("ym,final_content,draft_content")
    .eq("project_id", projectId)
    .in("ym", yms)
    .order("ym", { ascending: true });
  const rows = (reports ?? []) as Array<{ ym: string; final_content: string | null; draft_content: string | null }>;
  const reportBlock = rows
    .map((r) => {
      const content = (r.final_content || r.draft_content || "").trim();
      if (!content) return "";
      return `### ${r.ym}\n${content.slice(0, 3000)}`;
    })
    .filter(Boolean)
    .join("\n\n");
  if (!reportBlock) {
    return { score: 0, inputs: { note: "monthly_reports 本文なし、 signal 3 skip", yms } };
  }

  const userPrompt =
    `## PJ 情報\n- projectId: ${projectId}\n- PJ 名: ${projectName}\n- 期間: 過去 6 ヶ月 (${yms.join(" → ")})\n\n` +
    `## monthly_reports 本文 (過去 6 ヶ月、 全 ${rows.filter((r) => r.final_content || r.draft_content).length} 件)\n${reportBlock}\n\n` +
    `上記から report_attribution_score を 0-100 で評価してください。 JSON のみで返答。`;

  try {
    const response = await anthropic.messages.create({
      model: prompt.model || "claude-sonnet-4-6",
      max_tokens: prompt.max_tokens || 2048,
      system: prompt.body,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = parseJsonFromLlm(text);
    if (!parsed) {
      return { score: 0, inputs: { note: "LLM no JSON", raw: text.slice(0, 200) } };
    }
    const score = clamp(Number(parsed.report_attribution_score ?? 0));
    return {
      score,
      inputs: {
        score,
        monthly_ratios: parsed.monthly_ratios ?? [],
        reasoning: String(parsed.reasoning ?? "").slice(0, 500),
        reportCount: rows.length,
      },
    };
  } catch (err) {
    return { score: 0, inputs: { note: "LLM error", error: err instanceof Error ? err.message : String(err) } };
  }
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
  anthropic: Anthropic | null,
  talkerPrompt: PromptRow | null,
  reportPrompt: PromptRow | null,
  projectId: string,
  projectName: string,
  ym: string,
  amdMemberIds: Set<string>,
): Promise<SignalResult> {
  const [signal1, signal2, signal3, signal4, signal5, signal6] = await Promise.all([
    computeSignal1_TalkerRatioLlm(supabase, anthropic, talkerPrompt, projectId, projectName, ym),
    computeSignal2_EventsDecline(supabase, projectId, ym, amdMemberIds),
    computeSignal3_ReportAttributionLlm(supabase, anthropic, reportPrompt, projectId, projectName, ym),
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

  const llmEnabled = anthropic && (talkerPrompt || reportPrompt);
  const evidence = [
    `${projectName} の卒業準備度 ${Math.round(readiness)}%。`,
    `主導比率 ${Math.round(signal1.score)}点、`,
    `events 推移 ${Math.round(signal2.score)}点、`,
    `寄与文言 ${Math.round(signal3.score)}点、`,
    `milestone CEO 主導 ${Math.round(signal4.score)}点、`,
    `経営判断 CEO 起点 ${Math.round(signal5.score)}点、`,
    signal6.matched.length > 0 ? `🚨 キーワード「${signal6.matched.join("/")}」検出。` : "キーワード未検出。",
    llmEnabled ? "" : "(LLM prompt is_active=FALSE → signal 1/3 は 0)",
  ].filter(Boolean).join(" ");

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

export async function runGraduationDetection(
  supabase: SupabaseClient,
  ym: string,
  anthropic: Anthropic | null = null,
): Promise<{ ok: boolean; processed: number; candidates: number; llm_enabled: boolean; results: Array<{ project_id: string; readiness: number; alert: string }> }> {
  // 対象 PJ: status='active' AND project_ventures.amd_support_ended_at IS NULL
  const [{ data: activeProjects }, { data: ventures }, talkerPrompt, reportPrompt] = await Promise.all([
    supabase.from("projects").select("project_id,project_name,status").eq("status", "active"),
    supabase.from("project_ventures").select("project_id,amd_support_ended_at"),
    loadPrompt(supabase, "graduation_detection.talker_ratio"),
    loadPrompt(supabase, "graduation_detection.report_attribution"),
  ]);
  const graduatedPjs = new Set(
    ((ventures ?? []) as Array<{ project_id: string; amd_support_ended_at: string | null }>)
      .filter((v) => v.amd_support_ended_at)
      .map((v) => String(v.project_id)),
  );
  const targets = ((activeProjects ?? []) as Array<{ project_id: string; project_name: string }>)
    .filter((p) => !graduatedPjs.has(String(p.project_id)) && p.project_id !== "p00");

  const llmEnabled = !!(anthropic && (talkerPrompt || reportPrompt));
  const amdMemberIds = await fetchAmdMemberIds(supabase);
  const results: Array<{ project_id: string; readiness: number; alert: string }> = [];
  let candidatesCreated = 0;

  for (const pj of targets) {
    const sig = await computeSignalsForProject(
      supabase,
      anthropic,
      talkerPrompt,
      reportPrompt,
      pj.project_id,
      pj.project_name,
      ym,
      amdMemberIds,
    );
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

  return { ok: true, processed: targets.length, candidates: candidatesCreated, llm_enabled: llmEnabled, results };
}
