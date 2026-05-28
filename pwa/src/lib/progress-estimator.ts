/**
 * progress-estimator.ts
 * MSごとの進捗%をLLMで推定し、milestone_monthly_progress に書き込む。
 *
 * ソース: monthly_reports.final_content / draft_content
 *   （source_cache は L1 cron 廃止で空なので使わない。
 *    レポート本文は MMO マシンの Claude Code scheduled task で生成済み。）
 *
 * 設計:
 *   - progressPct はLLMが返す「対象月時点の累積進捗率」。
 *   - AI推定値は絶対値として保存し、delta 加算で 100% に吸い寄せない。
 *   - routineタグのMSは、手動確定がなければMS期間で月割り自動進捗にする
 *   - PMが確定・修正・却下した行は上書きしない
 *   - AI推定値は過大推定を補正するため、AI由来の既存値なら下方修正も許可する
 *   - upsert conflict: milestone_key, ym
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { syncRewardSummaryForCycle } from "@/lib/reward-summary";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const PM_LOCKED_PROGRESS_SOURCES = new Set([
  "pm_manual",
  "pm_confirmed",
  "pm_rejected",
  "criteria_toggle",
  "tsukuyomi_revision",
]);

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

type EstimateMilestoneRow = {
  milestone_id: string;
  title: string | null;
  points: number | null;
  tag: string | null;
  goal_level: string | null;
  period_start_ym: string | null;
  target_ym: string | null;
  success_criteria: string | null;
};

type EstimateDetail = {
  milestoneKey: string;
  delta: number;
  cumulative: number;
  reason: string;
  skipped?: boolean;
  skipReason?: string;
};

type CurrentProgressMap = Record<string, { pct: number; source: string }>;

type ConfirmedRevisionLock = {
  milestone_id: string;
  revised_pct: number | null;
  revised_note: string | null;
  confirmed_at: string | null;
};

const ROUTINE_AUTO_PROGRESS_SOURCE = "routine_auto";
const ESTIMATOR_LOGIC_VERSION = "absolute_cumulative_v1";
const HIGH_PROGRESS_DIRECT_EVIDENCE_THRESHOLD = 80;
const MAX_AHEAD_WITHOUT_DIRECT_EVIDENCE = 15;
const MAX_PROGRESS_WITHOUT_DIRECT_EVIDENCE = 75;
const AI_MUTABLE_PROGRESS_SOURCES = new Set(["", "tsukuyomi_estimate"]);
const COMPLETION_EVIDENCE_TERMS = [
  "完成",
  "完了",
  "確定",
  "提出",
  "作成済",
  "策定済",
  "レビュー可能",
  "合意済",
  "承認",
  "採択",
  "納品",
  "契約締結",
  "出願完了",
  "submitted",
  "completed",
  "finalized",
  "approved",
];
const NEGATIVE_COMPLETION_TERMS = [
  "未完了",
  "未着手",
  "未提出",
  "未確定",
  "至っていない",
  "完了物なし",
  "新規完了物なし",
  "まだ",
];
const CRITERIA_STOPWORDS = new Set([
  "こと",
  "状態",
  "可能",
  "レビュー",
  "方針",
  "道筋",
  "まで",
  "いる",
  "なる",
  "できる",
]);

function isYm(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

function ymToIndex(ym: string): number | null {
  if (!isYm(ym)) return null;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return y * 12 + (m - 1);
}

function indexToYm(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function expectedCumPctForYm(asOfYm: string, periodStartYm: string, targetYm: string): number {
  const asOf = ymToIndex(asOfYm);
  const start = ymToIndex(periodStartYm);
  const end = ymToIndex(targetYm);
  if (asOf == null || start == null || end == null) return 0;
  if (asOf < start) return 0;
  if (asOf >= end) return 100;
  const totalMonths = Math.max(1, end - start + 1);
  const elapsedMonths = Math.max(0, asOf - start + 1);
  return Math.min(100, Math.round((elapsedMonths / totalMonths) * 1000) / 10);
}

function milestonePeriod(
  ms: EstimateMilestoneRow,
  planCycle: { period_start_ym: string | null; period_end_ym: string | null }
) {
  const startYm = isYm(ms.period_start_ym) ? ms.period_start_ym : (isYm(planCycle.period_start_ym) ? planCycle.period_start_ym : null);
  const endYm = isYm(ms.target_ym) ? ms.target_ym : (isYm(planCycle.period_end_ym) ? planCycle.period_end_ym : startYm);
  return { startYm, endYm };
}

function milestoneSchedule(
  ms: EstimateMilestoneRow,
  planCycle: { period_start_ym: string | null; period_end_ym: string | null },
  ym: string
) {
  const { startYm, endYm } = milestonePeriod(ms, planCycle);
  const asOfIndex = ymToIndex(ym);
  const startIndex = startYm ? ymToIndex(startYm) : null;
  const endIndex = endYm ? ymToIndex(endYm) : null;
  const expectedPct = startYm && endYm ? expectedCumPctForYm(ym, startYm, endYm) : 0;
  const totalMonths = startIndex != null && endIndex != null ? Math.max(1, endIndex - startIndex + 1) : 1;
  const elapsedMonths = asOfIndex != null && startIndex != null ? Math.max(0, asOfIndex - startIndex + 1) : 0;
  return {
    startYm,
    endYm,
    expectedPct,
    totalMonths,
    elapsedMonths,
    isBeforeStart: asOfIndex != null && startIndex != null && asOfIndex < startIndex,
    isAfterEnd: asOfIndex != null && endIndex != null && asOfIndex > endIndex,
  };
}

async function syncRewardIfProgressChanged(supabase: ServiceClient, projectId: string, ym: string) {
  try {
    await syncRewardSummaryForCycle(supabase, projectId, ym);
  } catch (e) {
    console.warn("[progress-estimator] reward_summary_json sync failed:", e);
  }
}

async function applyRoutineAutoProgress(
  supabase: ServiceClient,
  milestones: EstimateMilestoneRow[],
  planCycle: { period_start_ym: string | null; period_end_ym: string | null },
  ym: string
): Promise<{
  saved: number;
  skipped: number;
  total: number;
  details: EstimateDetail[];
  savedRows: Array<{ milestoneKey: string; ym: string; progressPct: number; source: string }>;
}> {
  const routineMilestones = milestones.filter((m) => String(m.tag || "").toLowerCase() === "routine");
  if (routineMilestones.length === 0) {
    return { saved: 0, skipped: 0, total: 0, details: [], savedRows: [] };
  }

  const asOfIndex = ymToIndex(ym);
  if (asOfIndex == null) {
    return { saved: 0, skipped: 0, total: 0, details: [], savedRows: [] };
  }

  const msKeys = routineMilestones.map((m) => m.milestone_id);
  const { data: existingRows } = await supabase
    .from("milestone_monthly_progress")
    .select("milestone_key, ym, progress_pct, source")
    .in("milestone_key", msKeys)
    .lte("ym", ym);

  const existingByKey = new Map<string, { pct: number; source: string }>();
  for (const row of existingRows || []) {
    existingByKey.set(`${row.milestone_key}|${row.ym}`, {
      pct: Number(row.progress_pct || 0),
      source: String(row.source || ""),
    });
  }

  const details: EstimateDetail[] = [];
  const rowsToUpsert: Array<{
    milestone_key: string;
    ym: string;
    progress_pct: number;
    consumed_pt: number;
    source: string;
    confirmed_at: string;
    note: string;
  }> = [];
  const savedRows: Array<{ milestoneKey: string; ym: string; progressPct: number; source: string }> = [];
  let total = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const ms of routineMilestones) {
    const periodStartYm = isYm(ms.period_start_ym) ? ms.period_start_ym : (isYm(planCycle.period_start_ym) ? planCycle.period_start_ym : ym);
    const targetYm = isYm(ms.target_ym) ? ms.target_ym : (isYm(planCycle.period_end_ym) ? planCycle.period_end_ym : periodStartYm);
    const startIndex = ymToIndex(periodStartYm);
    const endIndex = ymToIndex(targetYm);
    if (startIndex == null || endIndex == null || asOfIndex < startIndex) continue;

    const lastIndex = Math.min(asOfIndex, Math.max(startIndex, endIndex));
    for (let idx = startIndex; idx <= lastIndex; idx += 1) {
      const rowYm = indexToYm(idx);
      const expectedPct = expectedCumPctForYm(rowYm, periodStartYm, targetYm);
      if (expectedPct <= 0) continue;
      total++;

      const existing = existingByKey.get(`${ms.milestone_id}|${rowYm}`);
      if (existing && PM_LOCKED_PROGRESS_SOURCES.has(existing.source)) {
        skipped++;
        details.push({
          milestoneKey: ms.milestone_id,
          delta: 0,
          cumulative: existing.pct,
          reason: "",
          skipped: true,
          skipReason: `source=${existing.source}`,
        });
        continue;
      }
      if (existing && expectedPct <= existing.pct) {
        skipped++;
        details.push({
          milestoneKey: ms.milestone_id,
          delta: 0,
          cumulative: expectedPct,
          reason: "",
          skipped: true,
          skipReason: `notIncreasing(cur=${existing.pct})`,
        });
        continue;
      }

      const consumed = Math.round((Number(ms.points || 0) * expectedPct) / 100 * 100) / 100;
      const prevExpected = idx > startIndex ? expectedCumPctForYm(indexToYm(idx - 1), periodStartYm, targetYm) : 0;
      rowsToUpsert.push({
        milestone_key: ms.milestone_id,
        ym: rowYm,
        progress_pct: expectedPct,
        consumed_pt: consumed,
        source: ROUTINE_AUTO_PROGRESS_SOURCE,
        confirmed_at: now,
        note: `定常業務の月次按分: ${periodStartYm}〜${targetYm}`,
      });
      savedRows.push({
        milestoneKey: ms.milestone_id,
        ym: rowYm,
        progressPct: expectedPct,
        source: ROUTINE_AUTO_PROGRESS_SOURCE,
      });
      details.push({
        milestoneKey: ms.milestone_id,
        delta: Math.max(0, Math.round((expectedPct - prevExpected) * 10) / 10),
        cumulative: expectedPct,
        reason: `定常業務の月次按分: ${periodStartYm}〜${targetYm}`,
      });
    }
  }

  if (rowsToUpsert.length === 0) {
    return { saved: 0, skipped, total, details, savedRows: [] };
  }

  const { error } = await supabase
    .from("milestone_monthly_progress")
    .upsert(rowsToUpsert, { onConflict: "milestone_key,ym" });

  if (error) {
    return {
      saved: 0,
      skipped: skipped + rowsToUpsert.length,
      total,
      details: rowsToUpsert.map((row) => ({
        milestoneKey: row.milestone_key,
        delta: 0,
        cumulative: Number(row.progress_pct || 0),
        reason: "",
        skipped: true,
        skipReason: `dbError: ${error.message}`,
      })),
      savedRows: [],
    };
  }

  return { saved: rowsToUpsert.length, skipped, total, details, savedRows };
}

async function loadConfirmedRevisionLocks(
  supabase: ServiceClient,
  projectId: string,
  ym: string,
  milestoneIds: string[]
): Promise<ConfirmedRevisionLock[]> {
  const { data, error } = await supabase
    .from("ms_progress_revisions")
    .select("milestone_id, revised_pct, revised_note, confirmed_at")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .eq("status", "confirmed")
    .in("milestone_id", milestoneIds.length > 0 ? milestoneIds : ["__none__"])
    .order("confirmed_at", { ascending: false });

  if (error) {
    console.warn("[progress-estimator] confirmed revision lock lookup failed:", error.message);
    return [];
  }

  const byMilestone = new Map<string, ConfirmedRevisionLock>();
  for (const row of data || []) {
    if (!byMilestone.has(row.milestone_id)) {
      byMilestone.set(row.milestone_id, row as ConfirmedRevisionLock);
    }
  }
  return Array.from(byMilestone.values());
}

async function applyConfirmedRevisionLocks(
  supabase: ServiceClient,
  projectId: string,
  ym: string,
  milestones: EstimateMilestoneRow[],
  currMap: CurrentProgressMap
): Promise<{ saved: number; skipped: number; details: EstimateDetail[] }> {
  const milestoneById = new Map(milestones.map((m) => [m.milestone_id, m]));
  const locks = await loadConfirmedRevisionLocks(
    supabase,
    projectId,
    ym,
    milestones.map((m) => m.milestone_id)
  );
  const details: EstimateDetail[] = [];
  let saved = 0;
  let skipped = 0;

  for (const lock of locks) {
    const ms = milestoneById.get(lock.milestone_id);
    if (!ms) continue;

    const revisedPct = Math.max(0, Math.min(100, Math.round(Number(lock.revised_pct || 0))));
    const consumed = Math.round((Number(ms.points || 0) * revisedPct) / 100 * 100) / 100;
    const note = String(lock.revised_note || "").substring(0, 500);
    const cur = currMap[lock.milestone_id];
    const needsRepair = !cur || cur.pct !== revisedPct || cur.source !== "tsukuyomi_revision";

    if (needsRepair) {
      const { error } = await supabase
        .from("milestone_monthly_progress")
        .upsert(
          {
            milestone_key: lock.milestone_id,
            ym,
            progress_pct: revisedPct,
            consumed_pt: consumed,
            source: "tsukuyomi_revision",
            confirmed_at: lock.confirmed_at || new Date().toISOString(),
            note,
          },
          { onConflict: "milestone_key,ym" }
        );

      if (error) {
        details.push({
          milestoneKey: lock.milestone_id,
          delta: 0,
          cumulative: revisedPct,
          reason: note,
          skipped: true,
          skipReason: `confirmedRevisionRepairError: ${error.message}`,
        });
        skipped++;
      } else {
        details.push({
          milestoneKey: lock.milestone_id,
          delta: 0,
          cumulative: revisedPct,
          reason: note || "confirmed revision reapplied",
        });
        saved++;
      }
    } else {
      details.push({
        milestoneKey: lock.milestone_id,
        delta: 0,
        cumulative: revisedPct,
        reason: note || "confirmed revision lock",
        skipped: true,
        skipReason: "confirmedRevisionLock",
      });
      skipped++;
    }

    currMap[lock.milestone_id] = { pct: revisedPct, source: "tsukuyomi_revision" };
  }

  return { saved, skipped, details };
}

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

const MS_PROGRESS_PROJECT_CATEGORIES = new Set(["dtsu", "ecosystem", "new_business"]);

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

function normalizeCriteriaText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ \t\r\n"'「」『』（）()[\]【】]/g, "");
}

function splitEvidenceSentences(text: string): string[] {
  return text
    .split(/[\n。！？!?]+/)
    .map((part) => normalizeCriteriaText(part.trim()))
    .filter(Boolean);
}

function extractCriterionKeywords(ms: EstimateMilestoneRow): string[] {
  const criteria = String(ms.success_criteria || "").trim();
  const keywords = criteria
    .split(/[、。・／/|｜\s]+|および|及び|ならびに|並びに|と|が|を|に|へ|で|の|は/)
    .map((part) => normalizeCriteriaText(part))
    .filter((part) => part.length >= 3 && !CRITERIA_STOPWORDS.has(part));
  return Array.from(new Set(keywords)).slice(0, 12);
}

function extractMilestoneEvidenceKeywords(
  ms: EstimateMilestoneRow,
  subItems: Array<{ title: string | null }> = []
): string[] {
  const keywords = [
    ...extractCriterionKeywords(ms),
    normalizeCriteriaText(ms.title || ""),
    ...subItems.map((item) => normalizeCriteriaText(item.title || "")),
  ].filter((part) => part.length >= 3 && !CRITERIA_STOPWORDS.has(part));
  return Array.from(new Set(keywords)).slice(0, 16);
}

function hasDirectCriteriaEvidence(
  ms: EstimateMilestoneRow,
  evidenceText: string,
  subItems: Array<{ title: string | null }> = []
): boolean {
  const keywords = extractMilestoneEvidenceKeywords(ms, subItems);
  if (keywords.length === 0) return false;
  const sentences = splitEvidenceSentences(evidenceText);
  return sentences.some((sentence) => {
    const hasKeyword = keywords.some((keyword) => sentence.includes(keyword));
    const hasCompletion = COMPLETION_EVIDENCE_TERMS.some((term) => sentence.includes(normalizeCriteriaText(term)));
    const hasNegative = NEGATIVE_COMPLETION_TERMS.some((term) => sentence.includes(normalizeCriteriaText(term)));
    return hasKeyword && hasCompletion && !hasNegative;
  });
}

function capScheduleBasedEstimate(input: {
  proposedPct: number;
  expectedPct: number;
  hasDirectEvidence: boolean;
}) {
  const proposedPct = Math.max(0, Math.min(100, Math.round(input.proposedPct)));
  const expectedPct = Math.max(0, Math.min(100, input.expectedPct));
  if (input.hasDirectEvidence) return proposedPct;
  if (proposedPct < HIGH_PROGRESS_DIRECT_EVIDENCE_THRESHOLD && proposedPct <= expectedPct + MAX_AHEAD_WITHOUT_DIRECT_EVIDENCE) {
    return proposedPct;
  }
  return Math.min(proposedPct, MAX_PROGRESS_WITHOUT_DIRECT_EVIDENCE, Math.round(expectedPct + MAX_AHEAD_WITHOUT_DIRECT_EVIDENCE));
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
  /** 実際にLLMを呼んだとき true。routine自動補完やsource_hash skipは false。 */
  llmCalled?: boolean;
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
  details?: EstimateDetail[];
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
    .select("plan_cycle_id, total_points, period_start_ym, period_end_ym")
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
    .select("milestone_id, title, points, tag, goal_level, period_start_ym, target_ym, success_criteria")
    .eq("plan_cycle_id", pc.plan_cycle_id)
    .eq("is_active", true)
    .order("sort_order");

  const milestones = ((msRows || []) as EstimateMilestoneRow[]).filter((m) => m.goal_level !== "monthly");
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
  const scheduleByMs = new Map(milestones.map((m) => [m.milestone_id, milestoneSchedule(m, pc, ym)]));
  const estimateMilestones = milestones.filter((m) => {
    const schedule = scheduleByMs.get(m.milestone_id);
    return String(m.tag || "").toLowerCase() !== "routine" && !schedule?.isBeforeStart;
  });

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
  const { data: subItemRows } = await supabase
    .from("milestone_sub_items")
    .select("milestone_id, title, weight, status, assignee")
    .in("milestone_id", msKeys.length > 0 ? msKeys : ["__none__"])
    .order("created_at", { ascending: true });
  const subItemsByMs = new Map<string, Array<{
    title: string | null;
    weight: number | null;
    status: string | null;
    assignee: string | null;
  }>>();
  for (const item of subItemRows || []) {
    const key = String(item.milestone_id || "");
    const list = subItemsByMs.get(key) || [];
    list.push({
      title: item.title || null,
      weight: item.weight == null ? null : Number(item.weight),
      status: item.status || null,
      assignee: item.assignee || null,
    });
    subItemsByMs.set(key, list);
  }

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
  const currMap: CurrentProgressMap = {};
  for (const p of currProgRes.data || []) {
    currMap[p.milestone_key] = { pct: Number(p.progress_pct || 0), source: p.source || "" };
  }

  const revisionLocks = await applyConfirmedRevisionLocks(supabase, projectId, ym, milestones, currMap);
  const routineAuto = await applyRoutineAutoProgress(supabase, milestones, pc, ym);
  for (const row of routineAuto.savedRows) {
    if (row.ym === ym) {
      currMap[row.milestoneKey] = { pct: row.progressPct, source: row.source };
    } else if (row.ym <= pym) {
      prevMap[row.milestoneKey] = Math.max(prevMap[row.milestoneKey] || 0, row.progressPct);
    }
  }

  if (estimateMilestones.length === 0) {
    if (revisionLocks.saved + routineAuto.saved > 0) await syncRewardIfProgressChanged(supabase, projectId, ym);
    await touchEstimateState(
      supabase,
      projectId,
      ym,
      sha256(JSON.stringify({ logic: ESTIMATOR_LOGIC_VERSION, projectId, ym, estimateMilestones: 0 })),
      "対象月に自動推定対象のMSなし"
    );
    return {
      ok: revisionLocks.saved + routineAuto.saved > 0,
      saved: revisionLocks.saved + routineAuto.saved,
      total: revisionLocks.details.length + routineAuto.total,
      skipped: revisionLocks.skipped + routineAuto.skipped,
      unchanged: false,
      llmCalled: false,
      message: "対象月に自動推定対象のMSなし",
      diagnostics: {
        planCycleFound: true,
        milestoneCount: milestones.length,
        sourceItemCount: 0,
        sourceItemCountRaw: 0,
        usingServiceRole,
      },
      details: [...revisionLocks.details, ...routineAuto.details],
    };
  }

  // 4. monthly_reports + project_meeting_summaries から当月ソースを取得
  let monthlySources: MonthlyProgressSources;
  try {
    monthlySources = await loadMonthlyProgressSources(supabase, projectId, ym);
  } catch (err) {
    if (revisionLocks.saved + routineAuto.saved > 0) await syncRewardIfProgressChanged(supabase, projectId, ym);
    return {
      ok: revisionLocks.saved + routineAuto.saved > 0,
      saved: revisionLocks.saved + routineAuto.saved,
      total: revisionLocks.details.length + routineAuto.total,
      skipped: revisionLocks.skipped + routineAuto.skipped,
      message: err instanceof Error ? err.message : "月次ソース取得エラー",
      diagnostics: { planCycleFound: true, milestoneCount: milestones.length, sourceItemCount: 0, sourceItemCountRaw: 0, usingServiceRole },
      details: [...revisionLocks.details, ...routineAuto.details],
    };
  }

  const sourceLines = monthlySources.sourceLines;
  const sourceItemCountRaw = monthlySources.sourceItemCountRaw;
  const sourceBreakdown = monthlySources.sourceBreakdown;

  if (sourceLines.length === 0 || monthlySources.sourceTextLength < 50) {
    if (revisionLocks.saved + routineAuto.saved > 0) await syncRewardIfProgressChanged(supabase, projectId, ym);
    return {
      ok: revisionLocks.saved + routineAuto.saved > 0,
      saved: revisionLocks.saved + routineAuto.saved,
      total: revisionLocks.details.length + routineAuto.total,
      skipped: revisionLocks.skipped + routineAuto.skipped,
      message: revisionLocks.saved > 0
        ? `確定済みMS修正を再適用（LLM推定ソースなし: project_id=${projectId}, ym=${ym}）`
        : routineAuto.saved > 0
          ? `定常業務を月次按分で補完（LLM推定ソースなし: project_id=${projectId}, ym=${ym}）`
          : `推定ソースなし（monthly_reports / project_meeting_summaries に本文なし: project_id=${projectId}, ym=${ym}）`,
      diagnostics: {
        planCycleFound: true,
        milestoneCount: milestones.length,
        sourceItemCount: 0,
        sourceItemCountRaw,
        sourceBreakdown,
        usingServiceRole,
      },
      details: [...revisionLocks.details, ...routineAuto.details],
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
      : "各MSの対象月時点の累積進捗率（0〜100の整数）を推定し、JSON形式で回答してください。フォーマット: { \"progress\": [{ \"milestoneKey\": \"id\", \"progressPct\": 整数, \"reason\": \"根拠\" }] }";
  const effectiveSystemPrompt =
    `${systemPrompt}\n\n` +
    `## AMD OS progress-estimator 強制ルール (${ESTIMATOR_LOGIC_VERSION})\n` +
    `- progressPct は今月の追加分ではなく、対象月時点の累積進捗率です。\n` +
    `- 期間按分の期待累積を基準にして、実績に応じて上下させてください。\n` +
    `- 完成・提出・確定・承認・レビュー可能な成果物がない限り、80%以上や100%にしないでください。`;

  // 5.5 source_hash 差分検知 (毎時 polling 用)。
  //   force=false (cron 経由) かつ前回と source_hash 一致なら LLM 呼ばずスキップ。
  //   hash 入力 = 月次ソース + milestones メタ + 前月累計 + system prompt + 現在登録値。
  const hashInput = JSON.stringify({
    logic: ESTIMATOR_LOGIC_VERSION,
    sourceHash: monthlySources.sourceHash,
    rs: monthlySources.reportStatus,
    ms: estimateMilestones.map((m) => ({
      schedule: scheduleByMs.get(m.milestone_id),
      id: m.milestone_id,
      ti: m.title,
      pt: m.points,
      tg: m.tag,
      gl: m.goal_level,
      sc: m.success_criteria,
      sub: (subItemsByMs.get(m.milestone_id) || []).map((item) => ({
        t: item.title,
        w: item.weight,
        s: item.status,
        a: item.assignee,
      })),
    })),
    prev: prevMap,
    curr: Object.fromEntries(Object.entries(currMap).map(([k, v]) => [k, { p: v.pct, s: v.source }])),
    sp: effectiveSystemPrompt,
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
    if (revisionLocks.saved + routineAuto.saved > 0) await syncRewardIfProgressChanged(supabase, projectId, ym);
    return {
      ok: true,
      saved: revisionLocks.saved + routineAuto.saved,
      total: revisionLocks.details.length + routineAuto.total,
      skipped: revisionLocks.skipped + routineAuto.skipped,
      unchanged: true,
      llmCalled: false,
      message: revisionLocks.saved + routineAuto.saved > 0 ? "confirmed/routine progress saved; source unchanged (LLM skipped)" : "source unchanged (LLM skipped)",
      diagnostics: {
        planCycleFound: true,
        milestoneCount: milestones.length,
        sourceItemCount: sourceLines.length,
        sourceItemCountRaw,
        sourceBreakdown,
        usingServiceRole,
        sourceHash: newHash,
      },
      details: [...revisionLocks.details, ...routineAuto.details],
    };
  }

  // 6. プロンプト組み立て
  const displayYm = formatDisplayYm(ym);
  const msListText = estimateMilestones
    .map((ms, i) => {
      const prev = prevMap[ms.milestone_id] || 0;
      const curr = currMap[ms.milestone_id]?.pct || 0;
      const schedule = scheduleByMs.get(ms.milestone_id);
      const tagLabel = ms.tag === "buffer" ? " [buffer]" : "";
      const criteria = ms.success_criteria ? `\n     成功条件: ${ms.success_criteria}` : "";
      const scheduleText = schedule
        ? `\n     期間: ${schedule.startYm || "unknown"}〜${schedule.endYm || "unknown"} / 期間按分の期待累積: ${schedule.expectedPct}% (${schedule.totalMonths}か月中${schedule.elapsedMonths}か月目)`
        : "";
      const subItems = (subItemsByMs.get(ms.milestone_id) || [])
        .filter((item) => item.title)
        .map((item) => `       - ${item.title}${item.status ? ` [${item.status}]` : ""}${item.weight != null ? ` weight=${item.weight}` : ""}`)
        .join("\n");
      const subItemBlock = subItems ? `\n     サブMS:\n${subItems}` : "";
      return `  ${i + 1}. [${ms.milestone_id}] ${ms.title}${tagLabel} (${ms.points}pt, 前月累計: ${prev}%, 現在登録値: ${curr}%)${scheduleText}${criteria}${subItemBlock}`;
    })
    .join("\n");

  const memberListText = members.map((m) => `  - ${m}`).join("\n");

  const userPrompt =
    `## 対象月: ${displayYm}\n\n` +
    `## マイルストーン一覧:\n${msListText}\n\n` +
    `## 判定ルール:\n` +
    `- progressPct は「対象月時点の累積進捗率」です。今月の増分ではありません。\n` +
    `- 基本値は期間按分の期待累積です。例: 5か月MSなら1か月目20%、2か月目40%、3か月目60%。\n` +
    `- 情報ソースから遅れが分かる場合は期待値より低く、少し先行している場合は期待値より少し高くしてください。\n` +
    `- 完成・提出・確定・承認・レビュー可能な成果物が確認できない限り、80%以上や100%にはしないでください。\n` +
    `- 面談、関心表明、DD開始、VCとの接点、資料作成予定、準備、着手、前向きな反応だけでは高進捗にしないでください。\n` +
    `- 特に事業計画・資本政策・知財戦略などの成果物MSは、実物またはレビュー可能なドラフトが確認できる場合だけ高進捗にしてください。\n\n` +
    `## PJメンバー:\n${memberListText}\n\n` +
    `## 情報ソース:\n---\n${sourceLines.join("\n")}\n---`;

  // 7. LLM呼び出し
  let raw = "";
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: effectiveSystemPrompt,
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
  const validMsIds = new Set(estimateMilestones.map((m) => m.milestone_id));
  const now = new Date().toISOString();
  let saved = revisionLocks.saved + routineAuto.saved;
  let skipped = revisionLocks.skipped + routineAuto.skipped;
  const details: EstimateDetail[] = [...revisionLocks.details, ...routineAuto.details];

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

    const prevCum = prevMap[msKey] || 0;
    const cur = currMap[msKey];
    const schedule = scheduleByMs.get(msKey);
    const expectedPct = schedule?.expectedPct ?? prevCum;
    const subItems = subItemsByMs.get(msKey) || [];
    const directEvidence = hasDirectCriteriaEvidence(ms, sourceLines.join("\n"), subItems);
    const rawPct = Math.max(0, Math.min(100, Math.round(Number(p.progressPct || 0))));
    const newCumPct = capScheduleBasedEstimate({
      proposedPct: rawPct,
      expectedPct,
      hasDirectEvidence: directEvidence,
    });
    const delta = Math.max(0, Math.round((newCumPct - prevCum) * 10) / 10);

    // PMが確定・修正・却下した行は推定で上書きしない。
    if (cur && PM_LOCKED_PROGRESS_SOURCES.has(cur.source)) {
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "", skipped: true, skipReason: `source=${cur.source}` });
      skipped++;
      continue;
    }

    if (rawPct >= HIGH_PROGRESS_DIRECT_EVIDENCE_THRESHOLD && !directEvidence && newCumPct < rawPct) {
      p.reason = `${p.reason || ""} / 期間按分基準 ${expectedPct}%・直接完了証拠なしのため ${rawPct}%→${newCumPct}% に補正`.trim();
    }

    if (newCumPct >= HIGH_PROGRESS_DIRECT_EVIDENCE_THRESHOLD && !directEvidence) {
      details?.push({
        milestoneKey: msKey,
        delta,
        cumulative: newCumPct,
        reason: p.reason || "",
        skipped: true,
        skipReason: "directCompletionEvidenceMissing",
      });
      skipped++;
      continue;
    }

    // AI由来の値は下方修正も許可する。PM/confirmed 系は上の lock で保護済み。
    if (cur && newCumPct === cur.pct) {
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "", skipped: true, skipReason: `unchanged(cur=${cur.pct})` });
      skipped++;
      continue;
    }
    if (cur && newCumPct < cur.pct && !AI_MUTABLE_PROGRESS_SOURCES.has(cur.source)) {
      details?.push({ milestoneKey: msKey, delta, cumulative: newCumPct, reason: p.reason || "", skipped: true, skipReason: `source=${cur.source || "unknown"} preventsDecrease` });
      skipped++;
      continue;
    }
    if (!cur && newCumPct === 0) {
      details?.push({ milestoneKey: msKey, delta: 0, cumulative: 0, reason: p.reason || "", skipped: true, skipReason: "zeroNoExistingRow" });
      skipped++;
      continue;
    }

    const consumed = Math.round((Number(ms.points || 0) * newCumPct) / 100 * 100) / 100;

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
  const totalCount = (parsed.progress || []).length + routineAuto.total + revisionLocks.details.length;
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

    await syncRewardIfProgressChanged(supabase, projectId, ym);
  }

  return {
    ok: true,
    saved,
    total: totalCount,
    skipped,
    llmCalled: true,
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
