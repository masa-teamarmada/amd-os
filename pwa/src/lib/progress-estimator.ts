/**
 * progress-estimator.ts
 * MSごとの進捗%をLLMで推定し、milestone_monthly_progress に書き込む。
 *
 * ソース: monthly_reports.final_content / draft_content
 *   （source_cache は L1 cron 廃止で空なので使わない。
 *    レポート本文は MMO マシンの Claude Code scheduled task で生成済み。）
 *
 * 設計:
 *   - progressPct はLLMが返す「今月の増分（delta）」。累積値ではない。
 *   - 累積値 = min(100, prevCum + delta)
 *   - routineタグのMSはスキップ
 *   - pm_manual / criteria_toggle は上書きしない
 *   - 前回登録値以下なら保存しない
 *   - upsert conflict: milestone_key, ym
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { syncRewardSummaryForCycle } from "@/lib/reward-summary";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function prevYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const pm = m - 1 < 1 ? 12 : m - 1;
  const py = m - 1 < 1 ? y - 1 : y;
  return `${py}${String(pm).padStart(2, "0")}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

type ServiceClient = ReturnType<typeof getServiceClient>;

type ProgressProjectRow = {
  project_name: string | null;
  project_category: string | null;
};

type MonthlyReportSourceRow = {
  final_content: string | null;
  draft_content: string | null;
  status: string | null;
};

type MeetingSummarySourceRow = {
  meeting_id: string;
  meeting_date: string | null;
  title: string | null;
  summary_short: string | null;
  decided: unknown;
  progress: unknown;
  next_actions: unknown;
  risks: unknown;
  source_hash: string | null;
  source_url?: string | null;
  notion_url?: string | null;
};

type MonthlyProgressSources = {
  reportBody: string;
  reportStatus: string;
  meetings: MeetingSummarySourceRow[];
  sourceLines: string[];
  sourceBreakdown: Record<string, number>;
  sourceItemCountRaw: number;
  sourceTextLength: number;
  sourceHash: string;
};

const MS_PROGRESS_PROJECT_CATEGORIES = new Set(["dtsu", "ecosystem"]);

function normalizedProjectCategory(project: ProgressProjectRow | null): string {
  return String(project?.project_category || "dtsu").trim().toLowerCase() || "dtsu";
}

function usesMsProgressCategory(project: ProgressProjectRow | null): boolean {
  return MS_PROGRESS_PROJECT_CATEGORIES.has(normalizedProjectCategory(project));
}

async function touchEstimateState(
  db: ServiceClient,
  projectId: string,
  ym: string,
  sourceHash: string,
  message: string
) {
  await db
    .from("progress_estimate_state")
    .upsert(
      {
        project_id: projectId,
        ym,
        source_hash: sourceHash,
        saved_count: 0,
        skipped_count: 0,
        total_count: 0,
        llm_model: null,
        message,
        last_processed_at: new Date().toISOString(),
      },
      { onConflict: "project_id,ym" }
    );
}

function formatDisplayYm(ym: string): string {
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

function truncateText(text: string, maxLength: number): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}...`;
}

function jsonTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const preferred =
          record.text ??
          record.content ??
          record.summary ??
          record.title ??
          record.action ??
          record.risk ??
          record.decision;
        if (typeof preferred === "string") return preferred.trim();
        try {
          return JSON.stringify(item);
        } catch {
          return "";
        }
      }
      return String(item ?? "").trim();
    })
    .filter(Boolean);
}

function meetingSourceText(meeting: MeetingSummarySourceRow): string {
  const parts = [
    meeting.summary_short?.trim() || "",
    ...jsonTextList(meeting.decided),
    ...jsonTextList(meeting.progress),
    ...jsonTextList(meeting.next_actions),
    ...jsonTextList(meeting.risks),
  ].filter(Boolean);
  return parts.join("\n");
}

function formatMeetingSource(meeting: MeetingSummarySourceRow): string {
  const title = meeting.title || meeting.meeting_id;
  const date = meeting.meeting_date || "date unknown";
  const sections = [
    meeting.summary_short?.trim() ? `summary: ${meeting.summary_short.trim()}` : "",
    jsonTextList(meeting.decided).length ? `decided:\n- ${jsonTextList(meeting.decided).join("\n- ")}` : "",
    jsonTextList(meeting.progress).length ? `progress:\n- ${jsonTextList(meeting.progress).join("\n- ")}` : "",
    jsonTextList(meeting.next_actions).length ? `next_actions:\n- ${jsonTextList(meeting.next_actions).join("\n- ")}` : "",
    jsonTextList(meeting.risks).length ? `risks:\n- ${jsonTextList(meeting.risks).join("\n- ")}` : "",
  ].filter(Boolean);
  return `## MTGサマリ: ${date} ${title}\n${sections.join("\n")}`;
}

async function loadMonthlyProgressSources(
  db: ServiceClient,
  projectId: string,
  ym: string
): Promise<MonthlyProgressSources> {
  const [reportRes, meetingRes] = await Promise.all([
    db
      .from("monthly_reports")
      .select("final_content, draft_content, status")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle(),
    db
      .from("project_meeting_summaries")
      .select("meeting_id, meeting_date, title, summary_short, decided, progress, next_actions, risks, source_hash, source_url, notion_url")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .order("meeting_date", { ascending: true }),
  ]);

  if (reportRes.error) throw new Error(`monthly_reports取得エラー: ${reportRes.error.message}`);
  if (meetingRes.error) throw new Error(`project_meeting_summaries取得エラー: ${meetingRes.error.message}`);

  const reportRow = (reportRes.data ?? null) as MonthlyReportSourceRow | null;
  const meetings = ((meetingRes.data ?? []) as MeetingSummarySourceRow[])
    .filter((meeting) => meetingSourceText(meeting).trim().length > 0);
  const reportBody = reportRow?.final_content || reportRow?.draft_content || "";
  const reportStatus = reportRow?.status || "unknown";
  const sourceLines: string[] = [];
  const sourceBreakdown: Record<string, number> = {};

  if (reportBody.trim()) {
    sourceLines.push(`## 当月の月次レポート本文（status=${reportStatus}）\n${reportBody.slice(0, 20000)}`);
    sourceBreakdown.monthly_report = 1;
  }
  if (meetings.length > 0) {
    sourceLines.push(...meetings.map(formatMeetingSource));
    sourceBreakdown.meeting_summary = meetings.length;
  }

  const hashMaterial = {
    reportBody,
    reportStatus,
    meetings: meetings.map((meeting) => ({
      meeting_id: meeting.meeting_id,
      meeting_date: meeting.meeting_date,
      title: meeting.title,
      source_hash: meeting.source_hash,
      text: meetingSourceText(meeting),
    })),
  };

  return {
    reportBody,
    reportStatus,
    meetings,
    sourceLines,
    sourceBreakdown,
    sourceItemCountRaw: (reportBody.trim() ? 1 : 0) + meetings.length,
    sourceTextLength: [reportBody, ...meetings.map(meetingSourceText)].join("\n").trim().length,
    sourceHash: sha256(JSON.stringify(hashMaterial)),
  };
}

function buildMonthlyNoteBody(projectName: string, ym: string, sources: MonthlyProgressSources): string {
  const displayYm = formatDisplayYm(ym);
  const lines = [
    `## OS自動取り込み (${displayYm})`,
    "",
    `${projectName} の ${displayYm} は対象月を覆うMS計画/有効なMS項目がないため、MS進捗ではなく月次ノートとして保存。`,
  ];

  if (sources.reportBody.trim()) {
    lines.push("", "### 月次レポート", truncateText(sources.reportBody, 4000));
  }

  if (sources.meetings.length > 0) {
    lines.push("", "### MTGサマリ");
    for (const meeting of sources.meetings.slice(0, 12)) {
      const title = meeting.title || meeting.meeting_id;
      const date = meeting.meeting_date || "日付不明";
      const text = truncateText(meetingSourceText(meeting), 1200);
      lines.push(`- ${date} ${title}`);
      if (text) lines.push(`  ${text.replace(/\n/g, "\n  ")}`);
    }
  }

  return lines.join("\n").trim().slice(0, 12000);
}

function mergeAutoMonthlyNote(existingBody: string, existingUpdatedBy: string | null | undefined, autoBody: string): string {
  const trimmed = existingBody.trim();
  if (!trimmed || existingUpdatedBy === "system:progress-estimator") return autoBody;
  const headerIndex = trimmed.indexOf("## OS自動取り込み");
  if (headerIndex >= 0) {
    return `${trimmed.slice(0, headerIndex).trimEnd()}\n\n${autoBody}`.trim();
  }
  return `${trimmed}\n\n---\n\n${autoBody}`;
}

async function clearMsConfigGapNotifications(db: ServiceClient, projectId: string, ym: string) {
  await db
    .from("l2_notifications")
    .delete()
    .eq("l2_kind", "project_config_gap")
    .eq("target_id", projectId)
    .in("scope_key", [`${ym}:config:missing_ms_plan`, `${ym}:config:missing_ms_items`]);
}

async function saveMonthlyNoteOnly(
  db: ServiceClient,
  args: {
    projectId: string;
    projectName: string;
    ym: string;
    force: boolean;
    usingServiceRole: boolean;
    planCycleFound: boolean;
    milestoneCount: number;
    messagePrefix: string;
  }
): Promise<EstimateResult> {
  let sources: MonthlyProgressSources;
  try {
    sources = await loadMonthlyProgressSources(db, args.projectId, args.ym);
  } catch (err) {
    return {
      ok: false,
      saved: 0,
      total: 0,
      skipped: 0,
      message: err instanceof Error ? err.message : "月次ソース取得エラー",
      diagnostics: {
        planCycleFound: args.planCycleFound,
        milestoneCount: args.milestoneCount,
        sourceItemCount: 0,
        sourceItemCountRaw: 0,
        usingServiceRole: args.usingServiceRole,
      },
    };
  }

  await clearMsConfigGapNotifications(db, args.projectId, args.ym);

  if (sources.sourceItemCountRaw === 0 || sources.sourceTextLength < 20) {
    const emptyHash = sha256(`monthly-note-empty:${args.projectId}:${args.ym}:${args.messagePrefix}`);
    await touchEstimateState(db, args.projectId, args.ym, emptyHash, `${args.messagePrefix}: 月次ノートに入れるソースなし`);
    return {
      ok: true,
      saved: 0,
      total: 0,
      skipped: 0,
      unchanged: true,
      message: `${args.messagePrefix}: 月次ノートに入れるソースなし`,
      diagnostics: {
        planCycleFound: args.planCycleFound,
        milestoneCount: args.milestoneCount,
        sourceItemCount: 0,
        sourceItemCountRaw: sources.sourceItemCountRaw,
        sourceBreakdown: sources.sourceBreakdown,
        usingServiceRole: args.usingServiceRole,
        sourceHash: emptyHash,
      },
    };
  }

  const { data: stateRow } = await db
    .from("progress_estimate_state")
    .select("source_hash, last_processed_at")
    .eq("project_id", args.projectId)
    .eq("ym", args.ym)
    .maybeSingle();

  if (!args.force && stateRow && String(stateRow.source_hash || "") === sources.sourceHash) {
    await db
      .from("progress_estimate_state")
      .update({ last_processed_at: new Date().toISOString() })
      .eq("project_id", args.projectId)
      .eq("ym", args.ym);
    return {
      ok: true,
      saved: 0,
      total: 0,
      skipped: 0,
      unchanged: true,
      message: `${args.messagePrefix}: source unchanged (月次ノート更新なし)`,
      diagnostics: {
        planCycleFound: args.planCycleFound,
        milestoneCount: args.milestoneCount,
        sourceItemCount: sources.sourceLines.length,
        sourceItemCountRaw: sources.sourceItemCountRaw,
        sourceBreakdown: sources.sourceBreakdown,
        usingServiceRole: args.usingServiceRole,
        sourceHash: sources.sourceHash,
      },
    };
  }

  const autoBody = buildMonthlyNoteBody(args.projectName, args.ym, sources);
  const { data: noteRow, error: noteLoadError } = await db
    .from("project_monthly_notes")
    .select("body, updated_by")
    .eq("project_id", args.projectId)
    .eq("ym", args.ym)
    .maybeSingle();

  if (noteLoadError) {
    return {
      ok: false,
      saved: 0,
      total: 0,
      skipped: 0,
      message: `project_monthly_notes取得エラー: ${noteLoadError.message}`,
      diagnostics: {
        planCycleFound: args.planCycleFound,
        milestoneCount: args.milestoneCount,
        sourceItemCount: sources.sourceLines.length,
        sourceItemCountRaw: sources.sourceItemCountRaw,
        sourceBreakdown: sources.sourceBreakdown,
        usingServiceRole: args.usingServiceRole,
        sourceHash: sources.sourceHash,
      },
    };
  }

  const existing = (noteRow ?? {}) as { body?: string | null; updated_by?: string | null };
  const noteBody = mergeAutoMonthlyNote(existing.body || "", existing.updated_by, autoBody);
  const { error: noteSaveError } = await db
    .from("project_monthly_notes")
    .upsert(
      {
        project_id: args.projectId,
        ym: args.ym,
        body: noteBody,
        updated_by: "system:progress-estimator",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,ym" }
    );

  if (noteSaveError) {
    return {
      ok: false,
      saved: 0,
      total: 0,
      skipped: 0,
      message: `project_monthly_notes保存エラー: ${noteSaveError.message}`,
      diagnostics: {
        planCycleFound: args.planCycleFound,
        milestoneCount: args.milestoneCount,
        sourceItemCount: sources.sourceLines.length,
        sourceItemCountRaw: sources.sourceItemCountRaw,
        sourceBreakdown: sources.sourceBreakdown,
        usingServiceRole: args.usingServiceRole,
        sourceHash: sources.sourceHash,
      },
    };
  }

  await touchEstimateState(db, args.projectId, args.ym, sources.sourceHash, `${args.messagePrefix}: 月次ノート保存済み`);
  return {
    ok: true,
    saved: 0,
    total: 0,
    skipped: 0,
    unchanged: true,
    message: `${args.messagePrefix}: 月次ノート保存済み`,
    diagnostics: {
      planCycleFound: args.planCycleFound,
      milestoneCount: args.milestoneCount,
      sourceItemCount: sources.sourceLines.length,
      sourceItemCountRaw: sources.sourceItemCountRaw,
      sourceBreakdown: sources.sourceBreakdown,
      usingServiceRole: args.usingServiceRole,
      sourceHash: sources.sourceHash,
    },
  };
}

export interface EstimateResult {
  ok: boolean;
  saved: number;
  total: number;
  skipped: number;
  message?: string;
  /** source_hash 一致でスキップしたとき true (毎時 polling 用) */
  unchanged?: boolean;
  diagnostics?: {
    planCycleFound: boolean;
    milestoneCount: number;
    sourceItemCount: number;
    sourceItemCountRaw: number;
    sourceBreakdown?: Record<string, number>;
    usingServiceRole: boolean;
    skipBreakdown?: Record<string, number>;
    writeErrors?: string[];
    beforeWriteCount?: number;
    afterWriteCount?: number;
    afterWriteSample?: Array<{ milestone_key: string; ym: string; progress_pct: number; source: string }>;
    sourceHash?: string;
  };
  details?: Array<{ milestoneKey: string; delta: number; cumulative: number; reason: string; skipped?: boolean; skipReason?: string }>;
}

export interface EstimateOptions {
  /**
   * true = 必ず LLM を呼んで再推定する (手動「AIで再推定」ボタン / report/generate 直後 fire-and-forget)。
   * false = source_hash 一致なら LLM 呼ばずスキップ (毎時 cron polling 用)。
   * 未指定なら true (= 既存呼び出し側の挙動を変えない)。
   */
  force?: boolean;
}

export async function estimateProgress(
  projectId: string,
  ym: string,
  opts: EstimateOptions = {}
): Promise<EstimateResult> {
  const force = opts.force !== false; // default true
  const supabase = getServiceClient();
  const pym = prevYm(ym);
  const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { data: projectRow, error: projectErr } = await supabase
    .from("projects")
    .select("project_name, project_category")
    .eq("project_id", projectId)
    .maybeSingle();

  if (projectErr) {
    return {
      ok: false,
      saved: 0,
      total: 0,
      skipped: 0,
      message: `projects取得エラー: ${projectErr.message}`,
      diagnostics: { planCycleFound: false, milestoneCount: 0, sourceItemCount: 0, sourceItemCountRaw: 0, usingServiceRole },
    };
  }

  const project = (projectRow ?? null) as ProgressProjectRow | null;
  const projectName = project?.project_name || projectId;
  const projectCategory = normalizedProjectCategory(project);
  if (!usesMsProgressCategory(project)) {
    return saveMonthlyNoteOnly(
      supabase,
      {
        projectId,
        projectName,
        ym,
        force,
        usingServiceRole,
        planCycleFound: false,
        milestoneCount: 0,
        messagePrefix: `non-MS-managed project (${projectCategory})`,
      }
    );
  }

  // 1. アクティブなPlanCycleとマイルストーンを取得
  const { data: pcRows, error: pcErr } = await supabase
    .from("value_plan_cycles")
    .select("plan_cycle_id, total_points")
    .eq("project_id", projectId)
    .in("status", ["active", "confirmed", "fixed", "draft"])
    .lte("period_start_ym", ym)
    .gte("period_end_ym", ym)
    .order("period_start_ym", { ascending: false })
    .limit(1);

  if (pcErr) {
    return {
      ok: false, saved: 0, total: 0, skipped: 0,
      message: `PlanCycle取得エラー: ${pcErr.message}`,
      diagnostics: { planCycleFound: false, milestoneCount: 0, sourceItemCount: 0, sourceItemCountRaw: 0, usingServiceRole },
    };
  }
  if (!pcRows || pcRows.length === 0) {
    return saveMonthlyNoteOnly(
      supabase,
      {
        projectId,
        projectName,
        ym,
        force,
        usingServiceRole,
        planCycleFound: false,
        milestoneCount: 0,
        messagePrefix: "MS計画なし",
      }
    );
  }
  const pc = pcRows[0];

  const { data: msRows } = await supabase
    .from("value_milestones")
    .select("milestone_id, title, points, tag, goal_level")
    .eq("plan_cycle_id", pc.plan_cycle_id)
    .eq("is_active", true)
    .order("sort_order");

  const milestones = (msRows || []).filter((m) => m.goal_level !== "monthly");
  if (milestones.length === 0) {
    return saveMonthlyNoteOnly(
      supabase,
      {
        projectId,
        projectName,
        ym,
        force,
        usingServiceRole,
        planCycleFound: true,
        milestoneCount: 0,
        messagePrefix: "MS項目なし",
      }
    );
  }

  // 2. メンバー取得
  const { data: pmRows } = await supabase
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_active", true);
  const memberIds = (pmRows || []).map((r) => r.member_id);
  const { data: memberRows } = await supabase
    .from("members")
    .select("member_id, code_name")
    .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"]);
  const members = (memberRows || []).map((m) => m.code_name || "PM");

  // 3. 前月・当月の進捗を取得
  const msKeys = milestones.map((m) => m.milestone_id);

  const [prevProgRes, currProgRes] = await Promise.all([
    supabase
      .from("milestone_monthly_progress")
      .select("milestone_key, progress_pct, source")
      .in("milestone_key", msKeys)
      .lte("ym", pym)
      .order("ym", { ascending: false }),
    supabase
      .from("milestone_monthly_progress")
      .select("milestone_key, progress_pct, source")
      .in("milestone_key", msKeys)
      .eq("ym", ym),
  ]);

  const prevMap: Record<string, number> = {};
  for (const p of prevProgRes.data || []) {
    if (prevMap[p.milestone_key] == null) {
      prevMap[p.milestone_key] = Number(p.progress_pct || 0);
    }
  }
  const currMap: Record<string, { pct: number; source: string }> = {};
  for (const p of currProgRes.data || []) {
    currMap[p.milestone_key] = { pct: Number(p.progress_pct || 0), source: p.source || "" };
  }

  // 4. monthly_reports + project_meeting_summaries から当月ソースを取得
  let monthlySources: MonthlyProgressSources;
  try {
    monthlySources = await loadMonthlyProgressSources(supabase, projectId, ym);
  } catch (err) {
    return {
      ok: false, saved: 0, total: 0, skipped: 0,
      message: err instanceof Error ? err.message : "月次ソース取得エラー",
      diagnostics: { planCycleFound: true, milestoneCount: milestones.length, sourceItemCount: 0, sourceItemCountRaw: 0, usingServiceRole },
    };
  }

  const sourceLines = monthlySources.sourceLines;
  const sourceItemCountRaw = monthlySources.sourceItemCountRaw;
  const sourceBreakdown = monthlySources.sourceBreakdown;

  if (sourceLines.length === 0 || monthlySources.sourceTextLength < 50) {
    return {
      ok: false, saved: 0, total: 0, skipped: 0,
      message: `推定ソースなし（monthly_reports / project_meeting_summaries に本文なし: project_id=${projectId}, ym=${ym}）`,
      diagnostics: {
        planCycleFound: true,
        milestoneCount: milestones.length,
        sourceItemCount: 0,
        sourceItemCountRaw,
        sourceBreakdown,
        usingServiceRole,
      },
    };
  }

  // 5. つくよみコンテキスト取得（reward_estimate タグ）
  const { data: ctxRows } = await supabase
    .from("tsukuyomi_context")
    .select("system_prompt")
    .eq("tags", "reward_estimate")
    .eq("status", "active")
    .order("priority", { ascending: false })
    .limit(1);

  const systemPrompt =
    ctxRows && ctxRows.length > 0
      ? ctxRows[0].system_prompt
      : "各MSの今月の追加進捗率（今月だけの増分、0〜100の整数）を推定し、JSON形式で回答してください。フォーマット: { \"progress\": [{ \"milestoneKey\": \"id\", \"progressPct\": 整数, \"reason\": \"根拠\" }] }";

  // 5.5 source_hash 差分検知 (毎時 polling 用)。
  //   force=false (cron 経由) かつ前回と source_hash 一致なら LLM 呼ばずスキップ。
  //   hash 入力 = 月次ソース + milestones メタ + 前月累計 + system prompt + 現在登録値。
  const hashInput = JSON.stringify({
    sourceHash: monthlySources.sourceHash,
    rs: monthlySources.reportStatus,
    ms: milestones.map((m) => ({
      id: m.milestone_id, ti: m.title, pt: m.points, tg: m.tag, gl: m.goal_level,
    })),
    prev: prevMap,
    curr: Object.fromEntries(Object.entries(currMap).map(([k, v]) => [k, { p: v.pct, s: v.source }])),
    sp: systemPrompt,
  });
  const newHash = sha256(hashInput);

  const { data: stateRow } = await supabase
    .from("progress_estimate_state")
    .select("source_hash, last_processed_at")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .maybeSingle();

  if (!force && stateRow && String(stateRow.source_hash || "") === newHash) {
    // 入力が変わってないので LLM 呼ばずスキップ。last_processed_at だけ touch して
    // 「いつ確認したか」の可視化を保つ。
    await supabase
      .from("progress_estimate_state")
      .update({ last_processed_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("ym", ym);
    return {
      ok: true,
      saved: 0,
      total: 0,
      skipped: 0,
      unchanged: true,
      message: "source unchanged (LLM skipped)",
      diagnostics: {
        planCycleFound: true,
        milestoneCount: milestones.length,
        sourceItemCount: sourceLines.length,
        sourceItemCountRaw,
        sourceBreakdown,
        usingServiceRole,
        sourceHash: newHash,
      },
    };
  }

  // 6. プロンプト組み立て
  const displayYm = formatDisplayYm(ym);
  const msListText = milestones
    .map((ms, i) => {
      const prev = prevMap[ms.milestone_id] || 0;
      const curr = currMap[ms.milestone_id]?.pct || 0;
      const tagLabel = ms.tag === "buffer" ? " [buffer]" : "";
      return `  ${i + 1}. [${ms.milestone_id}] ${ms.title}${tagLabel} (${ms.points}pt, 前月累計: ${prev}%, 現在登録値: ${curr}%)`;
    })
    .join("\n");

  const memberListText = members.map((m) => `  - ${m}`).join("\n");

  const userPrompt =
    `## 対象月: ${displayYm}\n\n` +
    `## マイルストーン一覧:\n${msListText}\n\n` +
    `## PJメンバー:\n${memberListText}\n\n` +
    `## 情報ソース:\n---\n${sourceLines.join("\n")}\n---`;

  // 7. LLM呼び出し
  let raw = "";
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = response.content
      .filter((c) => c.type === "text")
      .map((c) => ("text" in c ? c.text : ""))
      .join("");
  } catch (e) {
    return { ok: false, saved: 0, total: 0, skipped: 0, message: `LLM呼び出しエラー: ${e}` };
  }

  // 8. パース
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ok: false, saved: 0, total: 0, skipped: 0, message: "LLM応答のパース失敗" };
  }
  let parsed: { progress?: Array<{ milestoneKey: string; progressPct: number; reason?: string }> };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { ok: false, saved: 0, total: 0, skipped: 0, message: "JSON解析失敗" };
  }

  // 9. 保存
  const validMsIds = new Set(milestones.map((m) => m.milestone_id));
  const now = new Date().toISOString();
  let saved = 0;
  let skipped = 0;
  const details: EstimateResult["details"] = [];

  for (const p of parsed.progress || []) {
    const msKey = String(p.milestoneKey || "").trim();
    if (!validMsIds.has(msKey)) continue;

    const ms = milestones.find((m) => m.milestone_id === msKey);
    if (!ms) continue;

    // routineはスキップ
    if (ms.tag === "routine") {
      details?.push({ milestoneKey: msKey, delta: 0, cumulative: 0, reason: "", skipped: true, skipReason: "routine" });
      skipped++;
      continue;
    }

    const delta = Math.max(0, Math.min(100, Math.round(Number(p.progressPct || 0))));
    if (delta === 0) {
      details?.push({ milestoneKey: msKey, delta: 0, cumulative: 0, reason: p.reason || "", skipped: true, skipReason: "delta=0" });
      skipped++;
      continue;
    }

    const prevCum = prevMap[msKey] || 0;
    const newCumPct = Math.min(100, prevCum + delta);
    const cur = currMap[msKey];

    // pm_manual / criteria_toggle は上書きしない
    if (cur && (cur.source === "pm_manual" || cur.source === "criteria_toggle")) {
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "", skipped: true, skipReason: `source=${cur.source}` });
      skipped++;
      continue;
    }

    // 現在値以下なら保存しない
    if (cur && newCumPct <= cur.pct) {
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "", skipped: true, skipReason: `notIncreasing(cur=${cur.pct})` });
      skipped++;
      continue;
    }

    const consumed = Math.round((ms.points * newCumPct) / 100 * 100) / 100;

    const { error } = await supabase
      .from("milestone_monthly_progress")
      .upsert(
        {
          milestone_key: msKey,
          ym,
          progress_pct: newCumPct,
          consumed_pt: consumed,
          source: "tsukuyomi_estimate",
          confirmed_at: now,
          note: (p.reason || "").substring(0, 500),
        },
        { onConflict: "milestone_key,ym" }
      );

    if (error) {
      console.error(`[progress-estimator] upsert error for ${msKey}:`, error.message);
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "", skipped: true, skipReason: `dbError: ${error.message}` });
    } else {
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "" });
      saved++;
    }
  }

  // 書き込み後のDB確認 — 実際にSupabaseに保存されているかを診断
  const { data: afterWriteData } = await supabase
    .from("milestone_monthly_progress")
    .select("milestone_key, ym, progress_pct, source")
    .in("milestone_key", msKeys)
    .eq("ym", ym);

  // skipの内訳集計
  const skipBreakdown: Record<string, number> = {};
  const writeErrors: string[] = [];
  for (const d of details || []) {
    if (d.skipped) {
      const reason = (d.skipReason || "unknown").split(":")[0].split("(")[0].trim();
      skipBreakdown[reason] = (skipBreakdown[reason] || 0) + 1;
      if (d.skipReason?.startsWith("dbError")) {
        writeErrors.push(`${d.milestoneKey}: ${d.skipReason}`);
      }
    }
  }

  // 差分検知 state を更新 (LLM 呼んだ後は必ず更新)。
  // upsert: 同 (project_id, ym) は source_hash + counts + last_processed_at を更新。
  const totalCount = (parsed.progress || []).length;
  await supabase
    .from("progress_estimate_state")
    .upsert(
      {
        project_id: projectId,
        ym,
        source_hash: newHash,
        saved_count: saved,
        skipped_count: skipped,
        total_count: totalCount,
        llm_model: "claude-sonnet-4-5-20250929",
        message: null,
        last_processed_at: new Date().toISOString(),
      },
      { onConflict: "project_id,ym" }
    );

  // Swift APNs 通知用: saved > 0 のときだけ l2_notifications に upsert (l2_kind='ms_progress')。
  // 同 (l2_kind, target_id, scope_key) は trigger で saved_count 変化時に notified_at=NULL に戻り再通知される。
  // 仕様正本: ios/HANDOFF_l2_notifications.md
  if (saved > 0) {
    try {
      const { data: pjRow } = await supabase
        .from("projects")
        .select("project_name")
        .eq("project_id", projectId)
        .maybeSingle();
      const pjName = pjRow?.project_name || projectId;
      const topMs = (details || [])
        .filter((d) => !d.skipped)
        .slice(0, 3)
        .map((d) => `${d.milestoneKey}:+${d.delta}%`)
        .join(" / ");
      await supabase
        .from("l2_notifications")
        .upsert(
          {
            l2_kind: "ms_progress",
            target_id: projectId,
            scope_key: ym,
            title: `📈 ${pjName} (${ym}) MS進捗 更新 (${saved}件)`,
            summary: topMs.slice(0, 500),
            saved_count: saved,
            total_count: totalCount,
            importance: 1,
          },
          { onConflict: "l2_kind,target_id,scope_key" }
        );
    } catch (e) {
      console.warn("[progress-estimator] l2_notifications upsert failed:", e);
    }

    try {
      await syncRewardSummaryForCycle(supabase, projectId, ym);
    } catch (e) {
      console.warn("[progress-estimator] reward_summary_json sync failed:", e);
    }
  }

  return {
    ok: true,
    saved,
    total: totalCount,
    skipped,
    diagnostics: {
      planCycleFound: true,
      milestoneCount: milestones.length,
      sourceItemCount: sourceLines.length,
      sourceItemCountRaw,
      sourceBreakdown,
      usingServiceRole,
      skipBreakdown,
      writeErrors: writeErrors.length > 0 ? writeErrors : undefined,
      beforeWriteCount: Object.keys(currMap).length,
      afterWriteCount: (afterWriteData || []).length,
      afterWriteSample: (afterWriteData || []).slice(0, 5).map((r) => ({
        milestone_key: r.milestone_key,
        ym: r.ym,
        progress_pct: Number(r.progress_pct),
        source: r.source || "",
      })),
      sourceHash: newHash,
    },
    details,
  };
}
