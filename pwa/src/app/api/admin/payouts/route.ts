import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  candidateSourceYmsForPaymentYm,
  effectivePaymentYmForCycle,
  type PaymentProjectRow,
} from "@/lib/payment-groups";
import { syncRewardSummariesForBillingCycles, computeForwardCappedMemberCosts } from "@/lib/reward-summary";
import type { ExtraRevenueSourceRow } from "@/lib/finance/extra-revenue";

export const runtime = "nodejs";

const YM_RE = /^[0-9]{6}$/;
const MANUAL_REWARD_SOURCE = "admin_manual_payout";
const MANUAL_REWARD_VERSION = "admin_manual_override_v1";

// 一括PDF生成時の並列度。GAS payoutCreatePwaNoticePdf のスループットに配慮して 3 で固定。
// 上げすぎると Apps Script 側の同時実行制限 (project あたり 30) や freee 連携待ちで詰まる。
const BULK_NOTICE_CONCURRENCY = 3;

type BillingCycleRow = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | null;
  budget_reported_amount?: number | null;
  budget_buffer_amount?: number | null;
  invoice_ym: string | null;
  reward_summary_json: unknown;
  payout_notice_uploaded_at?: string | null;
  payment_confirmed_at?: string | null;
  reward_paid_at?: string | null;
};

type ForecastPlanCycleRow = {
  project_id: string;
  plan_cycle_id?: string | null;
  status: string | null;
  budget_yen: number | string | null;
  total_points?: number | string | null;
  period_start_ym: string;
  period_end_ym: string;
};

type RewardMemberRow = {
  [key: string]: unknown;
  memberId?: unknown;
  member_id?: unknown;
  memberName?: unknown;
  member_name?: unknown;
  earnedPt?: unknown;
  earned_pt?: unknown;
  basePay?: unknown;
  base_pay?: unknown;
  bonusPt?: unknown;
  bonus_pt?: unknown;
  totalPay?: unknown;
  total_pay?: unknown;
  source?: unknown;
  manualOverride?: unknown;
};

type RewardSummary = {
  members?: RewardMemberRow[];
  monthlyBudget65?: unknown;
  totalPaySum?: unknown;
  totalGrossDueYen?: unknown;
  capBudgetYen?: unknown;
  meta?: unknown;
};

type PayoutEntry = {
  project_id: string;
  ym: string;
  member_id: string;
  earned_pt: number;
  base_pay: number;
  bonus_pt: number;
  total_pay: number;
};

type MonthlyRewardPayoutRow = PayoutEntry & {
  created_at?: string | null;
};

type MemberRow = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
  contractor_name?: string | null;
  member_address?: string | null;
  invoice_registration_number?: string | null;
  bank_info?: string | null;
  email?: string | null;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

type ProjectMemberRow = {
  project_id: string;
  member_id: string;
  is_active?: boolean | null;
};

type PayoutNoticeRow = {
  member_id: string;
  ym: string;
  sent_at?: string | null;
  notice_no?: string | null;
  pdf_url?: string | null;
  total_yen?: number | string | null;
  last_generated_at?: string | null;
};

export type GenerateNoticeResult = {
  memberId: string;
  status: "generated" | "skipped" | "failed";
  reason?:
    | "no_member"
    | "no_entries"
    | "no_change"
    | "gas_error"
    | "db_error"
    | "preview_always_regen"
    | "force"
    | "no_existing"
    | "no_pdf_url"
    | "preview_notice_no"
    | "total_yen_changed";
  noticeNo?: string;
  pdfUrl?: string;
  totalYen?: number;
  lastGeneratedAt?: string;
  error?: string;
};

type LoadTargetDataOptions = {
  refreshRewards?: boolean;
};

function addMonths(ym: string, delta: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function cleanYm(value: string | null): string | null {
  const ym = (value ?? "").trim();
  return YM_RE.test(ym) ? ym : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRewardSummary(value: unknown): RewardSummary | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return asRewardSummary(JSON.parse(value));
    } catch {
      return null;
    }
  }
  const record = asRecord(value);
  if (!record) return null;
  const members = Array.isArray(record.members)
    ? (record.members as RewardMemberRow[])
    : [];
  return { members, monthlyBudget65: record.monthlyBudget65 };
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function yenValue(value: unknown): number {
  return Math.round(numberValue(value));
}

function boolValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function nullTextValue(value: unknown): string | null {
  const text = textValue(value);
  return text ? text : null;
}

function normalizePdfUrl(value: unknown): string | null {
  const url = nullTextValue(value);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("pdfUrl must start with http:// or https://");
  }
  return url;
}

function defaultNoticeNo(ym: string, memberId: string): string {
  return `AMD-PAY-${ym}-${memberId}`;
}

function generatedNoticeNo(ym: string, sequence: number): string {
  return `PN${ym}-${String(Math.max(1, sequence)).padStart(3, "0")}`;
}

function cycleKey(row: BillingCycleRow) {
  return `${row.project_id}:${row.ym}`;
}

function cycleSort(a: BillingCycleRow, b: BillingCycleRow) {
  if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
  return a.project_id.localeCompare(b.project_id);
}

function normalizeStatusAfterBudgetConfirm(status: string | null) {
  const current = (status ?? "").trim();
  if (!current || current === "not_started" || current === "draft" || current === "reported") {
    return "budget_confirmed";
  }
  return current;
}

// === 支払通知書メール送信 (まさ要件 2026-05-28): keiri@ from + PDF添付 + BCC ===

const PAYOUT_NOTICE_MAIL_FROM = "keiri@team-armada.jp";
const PAYOUT_NOTICE_MAIL_SUBJECT = "支払通知書のご案内";
const PAYOUT_NOTICE_MAIL_BCC = ["masa@team-armada.jp", "kyoko@team-armada.jp"];

function extractDriveFileId(url: string | null | undefined): string {
  if (!url) return "";
  const s = String(url);
  let m = s.match(/\/file\/d\/([^/?#]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([^&]+)/);
  if (m) return m[1];
  m = s.match(/\/d\/([^/?#]+)/);
  if (m) return m[1];
  return "";
}

function ymPayoutDate(ym: string): Date {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  // 翌月 0 日 = 当月末日
  return new Date(Date.UTC(y, m, 0));
}

function ymDueDate(ym: string): Date {
  const last = ymPayoutDate(ym);
  last.setUTCDate(last.getUTCDate() - 3);
  return last;
}

function formatDueDateTextJp(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}年${m}月${day}日 17:00まで`;
}

function composePayoutNoticeMailBody(memberName: string, dueDateText: string): string {
  return [
    `${memberName}様`,
    `いつもお世話になっております。`,
    `株式会社チームアルマダです。`,
    ``,
    `支払通知書を本メールにてお送りいたします。`,
    `内容をご確認のうえ、修正やご不明点がございましたら下記期日までにご連絡ください。`,
    ``,
    `--------`,
    `【内容確認・修正の締切】`,
    `${dueDateText}`,
    `--------`,
  ].join("\n");
}

async function callGasSendNoticeMail(payload: {
  to: string;
  memberName: string;
  ym: string;
  dueDateText: string;
  body: string;
  pdfDriveFileId: string;
  from: string;
  subject: string;
  bcc: string[];
}) {
  const baseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || process.env.CRON_SECRET || "";
  if (!baseUrl) throw new Error("NEXT_PUBLIC_GAS_WEBAPP_URL missing");
  if (!apiKey) throw new Error("NEXT_PUBLIC_GAS_API_KEY or CRON_SECRET missing");

  const url = new URL(baseUrl);
  url.searchParams.set("mode", "pwaApi");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("action", "runFunc");

  const res = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fn: "payout_sendNoticeMailV2_",
      args: [payload],
    }),
  });
  if (!res.ok) throw new Error(`GAS send notice mail failed: ${res.status}`);

  const json = (await res.json()) as Record<string, unknown>;
  if (json.ok === false) throw new Error(textValue(json.error) || "GAS send notice mail failed");

  const data = asRecord(json.data) ?? {};
  const result = asRecord(data.result) ?? {};
  if (result.ok === false) throw new Error(textValue(result.error) || textValue(result.message) || "GAS send notice mail failed");
  return result;
}

function rewardMemberId(member: RewardMemberRow): string {
  return textValue(member.memberId) || textValue(member.member_id);
}

function mergeManualRewardMember({
  existingSummary,
  projectId,
  sourceYm,
  memberId,
  memberName,
  totalPayYen,
  note,
  currentBudgetYen,
}: {
  existingSummary: unknown;
  projectId: string;
  sourceYm: string;
  memberId: string;
  memberName: string;
  totalPayYen: number;
  note: string;
  currentBudgetYen: number;
}) {
  const existingRecord = asRecord(existingSummary) ?? {};
  const existing = asRewardSummary(existingSummary);
  const now = new Date().toISOString();
  const manualMember: RewardMemberRow = {
    memberId,
    memberName,
    earnedPt: 0,
    basePay: totalPayYen,
    bonusPt: 0,
    totalPay: totalPayYen,
    grossDueYen: totalPayYen,
    carryInYen: 0,
    stockYen: 0,
    cappedFrom: totalPayYen,
    manualOverride: true,
    source: MANUAL_REWARD_SOURCE,
    note: note || undefined,
    breakdown: [
      {
        msKey: "admin-manual-payout",
        title: "admin強制確定",
        share: 1,
        earnedPt: 0,
        msConsumedPt: 0,
        payYen: totalPayYen,
        source: MANUAL_REWARD_SOURCE,
      },
    ],
  };
  const members = [
    ...(existing?.members ?? []).filter((member) => rewardMemberId(member) !== memberId),
    manualMember,
  ].sort((a, b) => {
    const aPay = yenValue(a.totalPay ?? a.total_pay);
    const bPay = yenValue(b.totalPay ?? b.total_pay);
    return bPay - aPay || rewardMemberId(a).localeCompare(rewardMemberId(b));
  });
  const totalPaySum = members.reduce((sum, member) => sum + yenValue(member.totalPay ?? member.total_pay), 0);
  const capBudgetYen = Math.max(currentBudgetYen, totalPaySum);
  const metaRecord = asRecord(existingRecord.meta) ?? {};

  return {
    ...existingRecord,
    members,
    totalPaySum,
    totalGrossDueYen: Math.max(totalPaySum, yenValue(existing?.totalGrossDueYen)),
    capBudgetYen,
    monthlyBudget65: capBudgetYen,
    manualOverride: true,
    manualOverrideSource: MANUAL_REWARD_SOURCE,
    meta: {
      ...metaRecord,
      version: MANUAL_REWARD_VERSION,
      source: MANUAL_REWARD_SOURCE,
      generatedAt: now,
      projectId,
      ym: sourceYm,
      planCycleId: textValue(metaRecord.planCycleId) || "manual",
    },
  };
}

function buildPayoutEntries(cycles: BillingCycleRow[], excludedMemberIds: Set<string> = new Set()): PayoutEntry[] {
  const entries: PayoutEntry[] = [];

  for (const cycle of cycles) {
    const cycleEntries: PayoutEntry[] = [];
    const summary = asRewardSummary(cycle.reward_summary_json);
    for (const member of summary?.members ?? []) {
      const memberId = textValue(member.memberId) || textValue(member.member_id);
      if (!memberId) continue;
      if (excludedMemberIds.has(memberId)) continue;
      const totalPay = yenValue(member.totalPay ?? member.total_pay);
      if (totalPay <= 0) continue;

      cycleEntries.push({
        project_id: cycle.project_id,
        ym: cycle.ym,
        member_id: memberId,
        earned_pt: numberValue(member.earnedPt ?? member.earned_pt),
        base_pay: yenValue(member.basePay ?? member.base_pay),
        bonus_pt: yenValue(member.bonusPt ?? member.bonus_pt),
        total_pay: totalPay,
      });
    }
    entries.push(...capPayoutEntriesToBudget(cycleEntries, cycle.budget_yen));
  }

  return entries;
}

function applySavedPayoutsForExistingRows(
  entries: PayoutEntry[],
  payouts: MonthlyRewardPayoutRow[],
  cycles: BillingCycleRow[],
  excludedMemberIds: Set<string> = new Set()
): PayoutEntry[] {
  const cycleKeys = new Set(cycles.map((cycle) => cycleKey(cycle)));
  const byKey = new Map(entries.map((entry) => [`${entry.project_id}:${entry.ym}:${entry.member_id}`, entry]));

  for (const payout of payouts) {
    if (!cycleKeys.has(`${payout.project_id}:${payout.ym}`)) continue;
    if (excludedMemberIds.has(payout.member_id)) continue;
    const totalPay = yenValue(payout.total_pay);
    if (totalPay <= 0) continue;
    byKey.set(`${payout.project_id}:${payout.ym}:${payout.member_id}`, {
      project_id: payout.project_id,
      ym: payout.ym,
      member_id: payout.member_id,
      earned_pt: numberValue(payout.earned_pt),
      base_pay: yenValue(payout.base_pay),
      bonus_pt: yenValue(payout.bonus_pt),
      total_pay: totalPay,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.ym !== b.ym) return a.ym.localeCompare(b.ym);
    if (a.member_id !== b.member_id) return a.member_id.localeCompare(b.member_id);
    return a.project_id.localeCompare(b.project_id);
  });
}

function capPayoutEntriesToBudget(entries: PayoutEntry[], budgetYen: unknown): PayoutEntry[] {
  const budget = yenValue(budgetYen);
  const total = entries.reduce((sum, entry) => sum + entry.total_pay, 0);
  if (budget <= 0 || total <= budget || entries.length === 0) return entries;

  let allocated = 0;
  return entries
    .map((entry, index) => {
      const cappedPay =
        index === entries.length - 1
          ? Math.max(0, budget - allocated)
          : Math.max(0, Math.round((entry.total_pay / total) * budget));
      allocated += cappedPay;
      return { ...entry, total_pay: cappedPay };
    })
    .filter((entry) => entry.total_pay > 0);
}

function findMissingBudgetCycles(cycles: BillingCycleRow[], entries: PayoutEntry[]) {
  const payoutByCycle = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.project_id}:${entry.ym}`;
    payoutByCycle.set(key, (payoutByCycle.get(key) ?? 0) + entry.total_pay);
  }
  return cycles.filter((cycle) => (payoutByCycle.get(cycleKey(cycle)) ?? 0) > 0 && yenValue(cycle.budget_yen) <= 0);
}

function aggregateNotices(ym: string, entries: PayoutEntry[], members: MemberRow[]) {
  const excludedMembers = new Set(
    members
      .filter((member) => member.exclude_from_payout_notice || member.is_officer)
      .map((member) => member.member_id)
  );
  const byMember = new Map<string, number>();
  for (const entry of entries) {
    if (excludedMembers.has(entry.member_id)) continue;
    byMember.set(entry.member_id, (byMember.get(entry.member_id) ?? 0) + entry.total_pay);
  }
  return [...byMember.entries()].map(([member_id, total_yen]) => ({
    member_id,
    ym,
    total_yen: Math.round(total_yen),
  }));
}

function ymShortLabel(ym: string): string {
  return YM_RE.test(ym) ? `${Number(ym.slice(4, 6))}月稼働分` : ym;
}

function projectLabel(project: PaymentProjectRow | undefined, projectId: string): string {
  const name = textValue(project?.project_name) || textValue(project?.client_name);
  return name || projectId;
}

function expectedNoticeEntriesForMember(
  memberId: string,
  data: Awaited<ReturnType<typeof loadTargetData>>
): Array<PayoutEntry & { project_name: string; description: string }> {
  const projectMap = new Map<string, PaymentProjectRow>();
  for (const project of data.projects as PaymentProjectRow[]) {
    projectMap.set(project.project_id, project);
  }
  return data.expectedEntries
    .filter((entry) => entry.member_id === memberId && entry.total_pay > 0)
    .map((entry) => {
      const name = projectLabel(projectMap.get(entry.project_id), entry.project_id);
      return {
        ...entry,
        project_name: name,
        description: `${name} ${ymShortLabel(entry.ym)}`,
      };
    });
}

function findMember(memberId: string, members: unknown[]): MemberRow | null {
  return ((members ?? []) as MemberRow[]).find((member) => member.member_id === memberId) ?? null;
}

function noticeNoIsPreview(noticeNo: string | null | undefined): boolean {
  const text = textValue(noticeNo);
  return text.startsWith("PREVIEW-");
}

/**
 * 既存の payout_notices と「今回計算した total_yen」を比較して、
 * GAS を再度叩いて PDF を作り直す必要があるかを判定する。
 *
 * - previewOnly: 確認用 PDF は毎回新規生成 (= notice_no も PREVIEW-... 固定で DB保存もしない)
 * - force: 強制再生成
 * - 既存 pdf_url が無い / notice_no が PREVIEW-... / total_yen が変わっている → 再生成
 * - それ以外 → スキップ
 */
export function shouldRegenerateNotice(
  existing: PayoutNoticeRow | null,
  expectedTotalYen: number,
  options: { previewOnly?: boolean; force?: boolean } = {}
): { regenerate: boolean; reason: GenerateNoticeResult["reason"] } {
  if (options.force) return { regenerate: true, reason: "force" };
  if (options.previewOnly) return { regenerate: true, reason: "preview_always_regen" };
  if (!existing) return { regenerate: true, reason: "no_existing" };
  if (!textValue(existing.pdf_url)) return { regenerate: true, reason: "no_pdf_url" };
  if (noticeNoIsPreview(existing.notice_no)) return { regenerate: true, reason: "preview_notice_no" };
  if (yenValue(existing.total_yen) !== Math.round(expectedTotalYen)) {
    return { regenerate: true, reason: "total_yen_changed" };
  }
  return { regenerate: false, reason: "no_change" };
}

/**
 * 1 メンバー分の支払通知書 PDF を生成して payout_notices に upsert する。
 * issue_notice_pdf / preview_notice_pdf / bulk_*_notice_pdf / cron payout-notice-prebuild
 * の共通実装。
 *
 * - data は呼び出し側で 1 回 loadTargetData() した結果を渡す (= bulk で N+1 を避けるため)
 * - previewOnly=true なら DB upsert を行わず、確認用 PDF URL だけ返す
 * - force=false (デフォルト) の場合は差分検出でスキップ可
 */
export async function generateNoticePdfForMember(
  db: SupabaseClient,
  data: Awaited<ReturnType<typeof loadTargetData>>,
  options: { memberId: string; previewOnly?: boolean; force?: boolean }
): Promise<GenerateNoticeResult> {
  const { memberId } = options;
  const previewOnly = Boolean(options.previewOnly);
  const force = Boolean(options.force);
  const ym = data.ym;

  const member = findMember(memberId, data.members);
  if (!member) {
    return {
      memberId,
      status: "failed",
      reason: "no_member",
      error: `member not found: ${memberId}`,
    };
  }

  const entries = expectedNoticeEntriesForMember(memberId, data);
  const totalYen = entries.reduce((sum, entry) => sum + entry.total_pay, 0);
  if (entries.length === 0 || totalYen <= 0) {
    return { memberId, status: "skipped", reason: "no_entries" };
  }

  const { data: existingRaw, error: existingError } = await db
    .from("payout_notices")
    .select("member_id, ym, sent_at, notice_no, pdf_url, total_yen, last_generated_at")
    .eq("member_id", memberId)
    .eq("ym", ym)
    .maybeSingle();
  if (existingError) {
    return {
      memberId,
      status: "failed",
      reason: "db_error",
      error: existingError.message,
    };
  }
  const existing = (existingRaw ?? null) as PayoutNoticeRow | null;

  const decision = shouldRegenerateNotice(existing, totalYen, { previewOnly, force });
  if (!decision.regenerate && existing) {
    return {
      memberId,
      status: "skipped",
      reason: decision.reason,
      noticeNo: textValue(existing.notice_no) || undefined,
      pdfUrl: textValue(existing.pdf_url) || undefined,
      totalYen: yenValue(existing.total_yen),
      lastGeneratedAt: textValue(existing.last_generated_at) || undefined,
    };
  }

  let noticeNo: string;
  if (previewOnly) {
    noticeNo = `PREVIEW-${ym}-${memberId}`;
  } else if (existing?.notice_no && !noticeNoIsPreview(existing.notice_no)) {
    noticeNo = textValue(existing.notice_no);
  } else {
    const { count, error: countError } = await db
      .from("payout_notices")
      .select("member_id", { count: "exact", head: true })
      .eq("ym", ym)
      .not("notice_no", "is", null)
      .not("notice_no", "like", "PREVIEW-%");
    if (countError) {
      return {
        memberId,
        status: "failed",
        reason: "db_error",
        error: countError.message,
      };
    }
    noticeNo = generatedNoticeNo(ym, (count ?? 0) + 1);
  }

  const payeeName = textValue(member.contractor_name) || textValue(member.member_name) || textValue(member.code_name) || memberId;
  const issuedAt = new Date().toISOString();

  let gasResult: Record<string, unknown>;
  try {
    gasResult = await callGasPayoutNoticePdf({
      ym,
      memberId,
      noticeNo,
      payeeName,
      payeeAddress: textValue(member.member_address),
      invoiceRegistrationNumber: textValue(member.invoice_registration_number),
      payeeEmail: textValue(member.email),
      bankInfo: textValue(member.bank_info),
      totalYen,
      issuedAt,
      breakdown: entries.map((entry) => ({
        projectId: entry.project_id,
        projectName: entry.project_name,
        sourceYm: entry.ym,
        description: entry.description,
        earnedPt: entry.earned_pt,
        basePay: entry.base_pay,
        bonusPt: entry.bonus_pt,
        totalYen: entry.total_pay,
      })),
    });
  } catch (err) {
    return {
      memberId,
      status: "failed",
      reason: "gas_error",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const pdfUrl = textValue(gasResult.pdfUrl) || textValue(gasResult.pdf_url);
  if (!pdfUrl) {
    return {
      memberId,
      status: "failed",
      reason: "gas_error",
      error: "GAS did not return pdfUrl",
    };
  }
  const actualNoticeNo = textValue(gasResult.noticeNo) || textValue(gasResult.freeeNoticeNo) || noticeNo;
  const generatedAt = new Date().toISOString();

  if (!previewOnly) {
    const { error: upsertError } = await db
      .from("payout_notices")
      .upsert(
        {
          member_id: memberId,
          ym,
          sent_at: existing?.sent_at ?? null,
          notice_no: actualNoticeNo,
          pdf_url: pdfUrl,
          total_yen: Math.round(totalYen),
          last_generated_at: generatedAt,
        },
        { onConflict: "member_id,ym" }
      );
    if (upsertError) {
      return {
        memberId,
        status: "failed",
        reason: "db_error",
        error: upsertError.message,
      };
    }
  }

  return {
    memberId,
    status: "generated",
    noticeNo: actualNoticeNo,
    pdfUrl,
    totalYen: Math.round(totalYen),
    lastGeneratedAt: generatedAt,
  };
}

/**
 * 与えられたメンバーリストに対して、concurrency 制限付きで並列に PDF 生成を実行する。
 * cron の payout-notice-prebuild と、admin/payouts の bulk_*_notice_pdf action の共通実装。
 */
export async function generateNoticePdfBulk(
  db: SupabaseClient,
  data: Awaited<ReturnType<typeof loadTargetData>>,
  options: {
    memberIds: string[];
    previewOnly?: boolean;
    force?: boolean;
    concurrency?: number;
  }
): Promise<GenerateNoticeResult[]> {
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? BULK_NOTICE_CONCURRENCY));
  const queue = [...options.memberIds];
  const results: GenerateNoticeResult[] = [];

  async function worker() {
    while (queue.length > 0) {
      const memberId = queue.shift();
      if (!memberId) return;
      const result = await generateNoticePdfForMember(db, data, {
        memberId,
        previewOnly: options.previewOnly,
        force: options.force,
      });
      results.push(result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, options.memberIds.length) }, () => worker()));
  return results.sort((a, b) => a.memberId.localeCompare(b.memberId));
}

/**
 * payout_notices.pdf_url を NULL クリアする。saveAll で「total_yen が変わったメンバー」だけ
 * クリアして、cron / bulk の差分検出を発火させる用途。
 */
export async function clearStalePayoutNoticePdfs(
  db: SupabaseClient,
  ym: string,
  staleMemberIds: string[]
): Promise<{ cleared: number }> {
  if (staleMemberIds.length === 0) return { cleared: 0 };
  const { data, error } = await db
    .from("payout_notices")
    .update({ pdf_url: null, last_generated_at: null })
    .eq("ym", ym)
    .in("member_id", staleMemberIds)
    .is("sent_at", null)
    .select("member_id");
  if (error) throw error;
  return { cleared: data?.length ?? 0 };
}

async function callGasPayoutNoticePdf(payload: Record<string, unknown>) {
  const baseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || process.env.CRON_SECRET || "";
  if (!baseUrl) throw new Error("NEXT_PUBLIC_GAS_WEBAPP_URL missing");
  if (!apiKey) throw new Error("NEXT_PUBLIC_GAS_API_KEY or CRON_SECRET missing");

  const url = new URL(baseUrl);
  url.searchParams.set("mode", "pwaApi");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("action", "runFunc");
  url.searchParams.set("fn", "payoutCreatePwaNoticePdf");
  url.searchParams.set("args", JSON.stringify([payload]));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`GAS payout notice PDF failed: ${res.status}`);

  const json = (await res.json()) as Record<string, unknown>;
  if (json.ok === false) throw new Error(textValue(json.error) || "GAS payout notice PDF failed");

  const data = asRecord(json.data) ?? {};
  const result = asRecord(data.result) ?? {};
  if (result.ok === false) throw new Error(textValue(result.message) || textValue(result.error) || "GAS payout notice PDF failed");
  return result;
}

export async function loadTargetData(ym: string, options: LoadTargetDataOptions = {}) {
  const db = createAdminClient();
  const cycleSelect =
    "project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, invoice_ym, reward_summary_json, payout_notice_uploaded_at, payment_confirmed_at, reward_paid_at";

  const candidateYms = candidateSourceYmsForPaymentYm(ym);
  const forecastEndYm = addMonths(ym, 11);
  const [membersRes, projectsRes, projectMembersRes, invoiceCyclesRes, unsetInvoiceCyclesRes, forecastCyclesRes, forecastPlanCyclesRes] = await Promise.all([
    db
      .from("members")
      .select("member_id, code_name, member_name, contractor_name, member_address, invoice_registration_number, bank_info, email, status, is_officer, exclude_from_payout_notice")
      .eq("status", "active")
      .order("code_name"),
    db
      .from("projects")
      .select("project_id, project_name, client_name, status, fee_type, fee_amount, start_ym, end_ym, freee_partner_id, payment_due_rule, payment_due_day")
      .order("project_name"),
    db
      .from("project_members")
      .select("project_id, member_id, is_active")
      .eq("is_active", true),
    db
      .from("billing_cycles")
      .select(cycleSelect)
      .eq("invoice_ym", ym),
    db
      .from("billing_cycles")
      .select(cycleSelect)
      .in("ym", candidateYms)
      .is("invoice_ym", null),
    db
      .from("billing_cycles")
      .select(cycleSelect)
      .gte("ym", ym)
      .lte("ym", forecastEndYm)
      .order("ym", { ascending: true }),
    db
      .from("value_plan_cycles")
      .select("project_id, plan_cycle_id, status, budget_yen, total_points, period_start_ym, period_end_ym")
      .lte("period_start_ym", forecastEndYm)
      .gte("period_end_ym", ym)
      .order("period_start_ym", { ascending: true }),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (projectMembersRes.error) throw projectMembersRes.error;
  if (invoiceCyclesRes.error) throw invoiceCyclesRes.error;
  if (unsetInvoiceCyclesRes.error) throw unsetInvoiceCyclesRes.error;
  if (forecastCyclesRes.error) throw forecastCyclesRes.error;
  if (forecastPlanCyclesRes.error) throw forecastPlanCyclesRes.error;

  const projectMap = new Map<string, PaymentProjectRow>();
  for (const project of (projectsRes.data ?? []) as PaymentProjectRow[]) {
    projectMap.set(project.project_id, project);
  }
  const cycleMap = new Map<string, BillingCycleRow>();
  for (const row of (invoiceCyclesRes.data ?? []) as BillingCycleRow[]) {
    cycleMap.set(cycleKey(row), row);
  }
  for (const row of (unsetInvoiceCyclesRes.data ?? []) as BillingCycleRow[]) {
    const project = projectMap.get(row.project_id);
    const effectiveYm = effectivePaymentYmForCycle(row, project);
    if (effectiveYm === ym) {
      cycleMap.set(cycleKey(row), { ...row, invoice_ym: effectiveYm });
    }
  }
  const cycles = [...cycleMap.values()].sort(cycleSort);
  const forecastCycles = ((forecastCyclesRes.data ?? []) as BillingCycleRow[]).sort(cycleSort);
  if (options.refreshRewards) {
    const cycleByKey = new Map<string, BillingCycleRow>();
    for (const cycle of [...cycles, ...forecastCycles]) cycleByKey.set(cycleKey(cycle), cycle);
    const syncedRewards = await syncRewardSummariesForBillingCycles(db, [...cycleByKey.values()]);
    for (const cycle of [...cycles, ...forecastCycles]) {
      const synced = syncedRewards.get(cycleKey(cycle));
      if (synced) {
        cycle.reward_summary_json = synced;
        if (Number(cycle.budget_yen ?? 0) <= 0 && Number(synced.monthlyBudget65 ?? 0) > 0) {
          cycle.budget_yen = Math.round(Number(synced.monthlyBudget65));
        }
      }
    }
  } else {
    for (const cycle of [...cycles, ...forecastCycles]) {
      const cached = asRewardSummary(cycle.reward_summary_json);
      const cachedBudget = numberValue(cached?.monthlyBudget65);
      if (Number(cycle.budget_yen ?? 0) <= 0 && cachedBudget > 0) {
        cycle.budget_yen = Math.round(cachedBudget);
      }
    }
  }
  const payoutExcludedMemberIds = new Set(
    ((membersRes.data ?? []) as MemberRow[])
      .filter((member) => member.is_officer || member.exclude_from_payout_notice)
      .map((member) => member.member_id)
  );

  const sourceYms = [...new Set(cycles.map((cycle) => cycle.ym))];
  const projectIds = [...new Set(cycles.map((cycle) => cycle.project_id))];

  const [payoutsRes, noticesRes, extraRevenueRes] = await Promise.all([
    sourceYms.length > 0 && projectIds.length > 0
      ? db
          .from("monthly_reward_payout")
          .select("*")
          .in("ym", sourceYms)
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("payout_notices").select("*").eq("ym", ym),
    // 別財布（別契約）売上の按分元行。period 按分先 (将来月) と按分元行の ym は別月に
    // なりうるので、forecast 期間で絞らず extra_revenue_json IS NOT NULL の全行を取る。
    // 表示期間での絞り込みはクライアントの expandExtraRevenue(minYm/maxYm) で行う。
    db
      .from("billing_cycles")
      .select("project_id, ym, extra_revenue_json")
      .not("extra_revenue_json", "is", null)
      .limit(2000),
  ]);

  if (payoutsRes.error) throw payoutsRes.error;
  if (noticesRes.error) throw noticesRes.error;
  if (extraRevenueRes.error) throw extraRevenueRes.error;

  // 将来月の「支払予定」(capped) を `/admin/payouts` 支払通知書と同じエンジンで投影する。
  // 支払予定 = 月次キャップ (budget_yen) + stock 繰越平準化を通した後の額 (spec 7-1 正本)。
  // 役員 (is_officer) / 支払対象外 (exclude_from_payout_notice) は computeForwardCappedMemberCosts 内で
  // payYen から落とす (i 案: 再配分しない)。
  // ※ v0.25.3 では誤って uncapped (キャップ・繰越を通さない生報酬) を支払予定に入れていたため、
  //   pt 消化が厚い月に budget_yen を超えて跳ね、マイナス月 / KUTE 巨額 / OkuDoor 超過が発生した
  //   (2026-06-17 まさ指摘 → v0.25.4 で capped へ修正)。
  const forecastProjectIds = [...new Set(forecastCycles.map((cycle) => cycle.project_id))];
  const forecastCapped: Array<{ projectId: string; ym: string; cappedTotalYen: number }> = [];
  const forecastCappedResults = await Promise.allSettled(
    forecastProjectIds.map((projectId) =>
      computeForwardCappedMemberCosts(db, projectId, ym)
    )
  );
  for (const result of forecastCappedResults) {
    if (result.status !== "fulfilled") continue;
    for (const month of result.value.months) {
      forecastCapped.push({
        projectId: result.value.projectId,
        ym: month.ym,
        cappedTotalYen: Math.round(month.cappedTotalYen),
      });
    }
  }

  return {
    ym,
    members: membersRes.data ?? [],
    projects: projectsRes.data ?? [],
    projectMembers: (projectMembersRes.data ?? []) as ProjectMemberRow[],
    cycles,
    forecastMonths: Array.from({ length: 12 }, (_, index) => addMonths(ym, index)),
    forecastCycles,
    extraRevenueRows: (extraRevenueRes.data ?? []) as ExtraRevenueSourceRow[],
    forecastPlanCycles: (forecastPlanCyclesRes.data ?? []) as ForecastPlanCycleRow[],
    forecastCapped,
    payouts: payoutsRes.data ?? [],
    notices: noticesRes.data ?? [],
    expectedEntries: applySavedPayoutsForExistingRows(
      buildPayoutEntries(cycles, payoutExcludedMemberIds),
      (payoutsRes.data ?? []) as MonthlyRewardPayoutRow[],
      cycles,
      payoutExcludedMemberIds
    ),
    refreshedRewards: Boolean(options.refreshRewards),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const ym = cleanYm(req.nextUrl.searchParams.get("ym"));
  if (!ym) {
    return NextResponse.json({ ok: false, error: "valid ym is required" }, { status: 400 });
  }

  try {
    const refreshRewards = req.nextUrl.searchParams.get("refreshRewards") === "1";
    const data = await loadTargetData(ym, { refreshRewards });
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[admin payouts GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const ym = cleanYm(typeof body.ym === "string" ? body.ym : null);

  if (body.action === "preview_notice_email" || body.action === "send_notice_email") {
    const memberId = textValue(body.memberId);
    if (!ym || !memberId) {
      return NextResponse.json({ ok: false, error: "ym and memberId are required" }, { status: 400 });
    }

    try {
      const db = createAdminClient();
      const [memberRes, noticeRes] = await Promise.all([
        db
          .from("members")
          .select("member_id, member_name, contractor_name, code_name, email, exclude_from_payout_notice, is_officer")
          .eq("member_id", memberId)
          .maybeSingle(),
        db
          .from("payout_notices")
          .select("member_id, ym, sent_at, notice_no, pdf_url, total_yen")
          .eq("member_id", memberId)
          .eq("ym", ym)
          .maybeSingle(),
      ]);
      if (memberRes.error) throw memberRes.error;
      if (noticeRes.error) throw noticeRes.error;

      const member = memberRes.data;
      const notice = noticeRes.data;
      if (!member) {
        return NextResponse.json({ ok: false, error: "member not found" }, { status: 404 });
      }
      if (member.exclude_from_payout_notice || member.is_officer) {
        return NextResponse.json({ ok: false, error: "this member is excluded from payout notice" }, { status: 409 });
      }
      const memberName = textValue(member.contractor_name) || textValue(member.member_name) || textValue(member.code_name) || memberId;
      const toEmail = textValue(member.email);
      if (!toEmail) {
        return NextResponse.json(
          { ok: false, error: `members.email が未設定: ${memberName} (${memberId})` },
          { status: 409 }
        );
      }
      const pdfUrl = textValue(notice?.pdf_url);
      const pdfDriveFileId = extractDriveFileId(pdfUrl);
      if (!pdfUrl || !pdfDriveFileId) {
        return NextResponse.json(
          { ok: false, error: "支払通知書PDFが未発行 / Drive fileId 抽出失敗" },
          { status: 409 }
        );
      }
      const dueDateText = formatDueDateTextJp(ymDueDate(ym));
      const defaultBody = composePayoutNoticeMailBody(memberName, dueDateText);

      if (body.action === "preview_notice_email") {
        return NextResponse.json({
          ok: true,
          preview: {
            memberId,
            memberName,
            to: toEmail,
            from: PAYOUT_NOTICE_MAIL_FROM,
            subject: PAYOUT_NOTICE_MAIL_SUBJECT,
            bcc: PAYOUT_NOTICE_MAIL_BCC,
            body: defaultBody,
            dueDateText,
            pdfUrl,
            pdfDriveFileId,
            totalYen: yenValue(notice?.total_yen),
            alreadySentAt: notice?.sent_at ?? null,
          },
        });
      }

      // send_notice_email
      const customBody = textValue(body.body) || defaultBody;
      const gasResult = await callGasSendNoticeMail({
        to: toEmail,
        memberName,
        ym,
        dueDateText,
        body: customBody,
        pdfDriveFileId,
        from: PAYOUT_NOTICE_MAIL_FROM,
        subject: PAYOUT_NOTICE_MAIL_SUBJECT,
        bcc: PAYOUT_NOTICE_MAIL_BCC,
      });

      const sentAt = new Date().toISOString();
      const { error: upsertError } = await db
        .from("payout_notices")
        .upsert(
          {
            member_id: memberId,
            ym,
            sent_at: sentAt,
            notice_no: notice?.notice_no ?? defaultNoticeNo(ym, memberId),
            pdf_url: pdfUrl,
            total_yen: yenValue(notice?.total_yen),
          },
          { onConflict: "member_id,ym" }
        );
      if (upsertError) throw upsertError;

      const after = await loadTargetData(ym);
      return NextResponse.json({
        ok: true,
        sentNoticeMail: {
          memberId,
          memberName,
          to: toEmail,
          bcc: PAYOUT_NOTICE_MAIL_BCC,
          subject: PAYOUT_NOTICE_MAIL_SUBJECT,
          sentAt,
          gas: gasResult,
        },
        ...after,
      });
    } catch (err) {
      console.error("[admin payouts PATCH notice_email]", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  if (body.action === "update_notice") {
    const memberId = textValue(body.memberId);
    if (!ym || !memberId) {
      return NextResponse.json({ ok: false, error: "ym and memberId are required" }, { status: 400 });
    }

    try {
      const db = createAdminClient();
      const { data: existing, error: existingError } = await db
        .from("payout_notices")
        .select("member_id, ym, sent_at, notice_no, pdf_url, total_yen")
        .eq("member_id", memberId)
        .eq("ym", ym)
        .maybeSingle();
      if (existingError) throw existingError;

      const issueNumber = boolValue(body.issueNumber);
      const markSent = boolValue(body.markSent);
      const clearSent = boolValue(body.clearSent);
      const noticeNoInput = nullTextValue(body.noticeNo);
      const pdfUrl =
        Object.prototype.hasOwnProperty.call(body, "pdfUrl")
          ? normalizePdfUrl(body.pdfUrl)
          : (existing?.pdf_url ?? null);
      const totalYen = yenValue(body.totalYen) || yenValue(existing?.total_yen);
      const sentAt = markSent ? new Date().toISOString() : clearSent ? null : (existing?.sent_at ?? null);
      const noticeNo = issueNumber
        ? existing?.notice_no ?? noticeNoInput ?? defaultNoticeNo(ym, memberId)
        : noticeNoInput ?? existing?.notice_no ?? null;

      const { error: upsertError } = await db
        .from("payout_notices")
        .upsert(
          {
            member_id: memberId,
            ym,
            sent_at: sentAt,
            notice_no: noticeNo,
            pdf_url: pdfUrl,
            total_yen: totalYen,
          },
          { onConflict: "member_id,ym" }
        );
      if (upsertError) throw upsertError;

      const after = await loadTargetData(ym);
      return NextResponse.json({ ok: true, updatedNoticeMemberId: memberId, ...after });
    } catch (err) {
      console.error("[admin payouts PATCH notice]", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  if (body.action === "issue_notice_pdf" || body.action === "preview_notice_pdf") {
    const previewOnly = body.action === "preview_notice_pdf";
    const memberId = textValue(body.memberId);
    if (!ym || !memberId) {
      return NextResponse.json({ ok: false, error: "ym and memberId are required" }, { status: 400 });
    }

    try {
      const db = createAdminClient();
      const data = await loadTargetData(ym);
      // 個別ボタン経由は常に force=true (= 既存PDFがあっても明示再発行できるように)。
      // 差分検出スキップが必要なケースは bulk / cron 側で処理する。
      const result = await generateNoticePdfForMember(db, data, {
        memberId,
        previewOnly,
        force: true,
      });

      if (result.status === "failed") {
        const code = result.reason === "no_member" ? 404 : 500;
        return NextResponse.json({ ok: false, error: result.error || "notice pdf failed" }, { status: code });
      }
      if (result.status === "skipped" && result.reason === "no_entries") {
        return NextResponse.json({ ok: false, error: "no payout entries for notice" }, { status: 409 });
      }

      const after = await loadTargetData(ym);
      return NextResponse.json({
        ok: true,
        previewOnly,
        issuedNotice: {
          memberId,
          noticeNo: result.noticeNo,
          pdfUrl: result.pdfUrl,
          totalYen: result.totalYen,
          lastGeneratedAt: result.lastGeneratedAt,
        },
        ...after,
      });
    } catch (err) {
      console.error("[admin payouts PATCH issue_notice_pdf]", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  if (body.action === "bulk_issue_notice_pdf" || body.action === "bulk_preview_notice_pdf") {
    const previewOnly = body.action === "bulk_preview_notice_pdf";
    const force = boolValue(body.force);
    const onlyMemberIds = Array.isArray(body.memberIds)
      ? (body.memberIds as unknown[]).map((value) => textValue(value)).filter((id) => !!id)
      : null;

    if (!ym) {
      return NextResponse.json({ ok: false, error: "ym is required" }, { status: 400 });
    }

    try {
      const db = createAdminClient();
      const data = await loadTargetData(ym);

      // 当月の支払対象メンバーを expectedEntries から抽出 (= aggregateNotices と同じロジック)。
      // 役員 / exclude_from_payout_notice を除外し、support_pay > 0 のメンバーだけ。
      const excludedMemberIds = new Set(
        (data.members as MemberRow[])
          .filter((member) => member.exclude_from_payout_notice || member.is_officer)
          .map((member) => member.member_id)
      );
      const totalByMember = new Map<string, number>();
      for (const entry of data.expectedEntries) {
        if (excludedMemberIds.has(entry.member_id)) continue;
        totalByMember.set(entry.member_id, (totalByMember.get(entry.member_id) ?? 0) + entry.total_pay);
      }
      let targetMemberIds = [...totalByMember.entries()]
        .filter(([, total]) => total > 0)
        .map(([memberId]) => memberId);
      if (onlyMemberIds && onlyMemberIds.length > 0) {
        const allowSet = new Set(onlyMemberIds);
        targetMemberIds = targetMemberIds.filter((memberId) => allowSet.has(memberId));
      }

      if (targetMemberIds.length === 0) {
        const after = await loadTargetData(ym);
        return NextResponse.json({
          ok: true,
          previewOnly,
          bulkResult: {
            targetCount: 0,
            generated: 0,
            skipped: 0,
            failed: 0,
            results: [],
          },
          ...after,
        });
      }

      const results = await generateNoticePdfBulk(db, data, {
        memberIds: targetMemberIds,
        previewOnly,
        force,
        concurrency: BULK_NOTICE_CONCURRENCY,
      });

      const summary = {
        targetCount: targetMemberIds.length,
        generated: results.filter((r) => r.status === "generated").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "failed").length,
        results,
      };

      const after = await loadTargetData(ym);
      return NextResponse.json({
        ok: true,
        previewOnly,
        bulkResult: summary,
        ...after,
      });
    } catch (err) {
      console.error("[admin payouts PATCH bulk_notice_pdf]", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  if (body.action === "manual_reward_override") {
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const sourceYm = cleanYm(typeof body.sourceYm === "string" ? body.sourceYm : null) ?? ym;
    const memberId = textValue(body.memberId);
    const totalPayYen = yenValue(body.totalPayYen);
    const note = textValue(body.note);
    if (!ym || !sourceYm || !projectId || !memberId || totalPayYen <= 0) {
      return NextResponse.json(
        { ok: false, error: "ym, sourceYm, projectId, memberId and positive totalPayYen are required" },
        { status: 400 }
      );
    }

    try {
      const db = createAdminClient();
      const [projectRes, memberRes, cycleRes] = await Promise.all([
        db
          .from("projects")
          .select("project_id, project_name, client_name, status, fee_type, fee_amount, start_ym, end_ym, freee_partner_id, payment_due_rule, payment_due_day")
          .eq("project_id", projectId)
          .maybeSingle(),
        db
          .from("members")
          .select("member_id, code_name, member_name, contractor_name, email, status, is_officer, exclude_from_payout_notice")
          .eq("member_id", memberId)
          .maybeSingle(),
        db
          .from("billing_cycles")
          .select("project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, invoice_ym, reward_summary_json")
          .eq("project_id", projectId)
          .eq("ym", sourceYm)
          .maybeSingle(),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (memberRes.error) throw memberRes.error;
      if (cycleRes.error) throw cycleRes.error;
      if (!projectRes.data) {
        return NextResponse.json({ ok: false, error: `project not found: ${projectId}` }, { status: 404 });
      }
      if (!memberRes.data) {
        return NextResponse.json({ ok: false, error: `member not found: ${memberId}` }, { status: 404 });
      }

      const existingCycle = (cycleRes.data ?? null) as BillingCycleRow | null;
      const currentBudgetYen = yenValue(existingCycle?.budget_yen);
      const member = memberRes.data as MemberRow;
      const memberName = textValue(member.code_name) || textValue(member.member_name) || memberId;
      const rewardSummary = mergeManualRewardMember({
        existingSummary: existingCycle?.reward_summary_json ?? null,
        projectId,
        sourceYm,
        memberId,
        memberName,
        totalPayYen,
        note,
        currentBudgetYen,
      });
      const totalPaySum = yenValue(rewardSummary.totalPaySum);
      const now = new Date().toISOString();

      const { error: upsertError } = await db
        .from("billing_cycles")
        .upsert(
          {
            project_id: projectId,
            ym: sourceYm,
            invoice_ym: ym,
            status: normalizeStatusAfterBudgetConfirm(existingCycle?.status ?? null),
            budget_yen: Math.max(currentBudgetYen, totalPaySum),
            reward_summary_json: rewardSummary,
            budget_confirmed_at: existingCycle?.budget_yen ? undefined : now,
            budget_confirmed_by: existingCycle?.budget_yen ? undefined : auth.user.email,
            updated_at: now,
          },
          { onConflict: "project_id,ym" }
        );
      if (upsertError) throw upsertError;

      const after = await loadTargetData(ym);
      return NextResponse.json({
        ok: true,
        manualRewardOverride: {
          projectId,
          sourceYm,
          memberId,
          totalPayYen,
        },
        ...after,
      });
    } catch (err) {
      console.error("[admin payouts PATCH manual_reward_override]", err);
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 }
      );
    }
  }

  const invoiceYm = cleanYm(typeof body.invoiceYm === "string" ? body.invoiceYm : null) ?? ym;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const sourceYms = Array.isArray(body.sourceYms)
    ? [...new Set(body.sourceYms.map((value) => cleanYm(String(value))).filter((value): value is string => !!value))]
    : [];
  const clientAmountYen = yenValue(body.clientAmountYen);
  const bufferYen = Math.max(0, yenValue(body.bufferYen));
  const extraPayoutBudgetYen = Math.max(0, yenValue(body.extraPayoutBudgetYen));

  if (!ym || !invoiceYm || !projectId || sourceYms.length === 0) {
    return NextResponse.json(
      { ok: false, error: "ym, invoiceYm, projectId and sourceYms are required" },
      { status: 400 }
    );
  }
  if (clientAmountYen <= 0) {
    return NextResponse.json({ ok: false, error: "clientAmountYen must be positive" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const [cyclesRes, projectRes, membersRes] = await Promise.all([
      db
        .from("billing_cycles")
        .select("project_id, ym, status, budget_yen, invoice_ym, reward_summary_json")
        .eq("project_id", projectId)
        .in("ym", sourceYms),
      db
        .from("projects")
        .select("project_id, project_name, client_name, status, fee_type, fee_amount, start_ym, end_ym, freee_partner_id, payment_due_rule, payment_due_day")
        .eq("project_id", projectId)
        .maybeSingle(),
      db
        .from("members")
        .select("member_id, is_officer, exclude_from_payout_notice")
        .or("is_officer.eq.true,exclude_from_payout_notice.eq.true"),
    ]);
    if (cyclesRes.error) throw cyclesRes.error;
    if (projectRes.error) throw projectRes.error;
    if (membersRes.error) throw membersRes.error;

    const project = projectRes.data as PaymentProjectRow | null;
    const cycles = ((cyclesRes.data ?? []) as BillingCycleRow[]).sort(cycleSort);
    if (cycles.length !== sourceYms.length) {
      return NextResponse.json(
        { ok: false, error: `target cycles not found (${cycles.length}/${sourceYms.length})` },
        { status: 404 }
      );
    }

    for (const cycle of cycles) {
      const actualInvoiceYm = effectivePaymentYmForCycle(cycle, project ?? undefined);
      if (actualInvoiceYm !== invoiceYm) {
        return NextResponse.json(
          { ok: false, error: `${cycle.project_id}:${cycle.ym} is linked to invoice_ym=${actualInvoiceYm}` },
          { status: 400 }
        );
      }
    }

    const payoutByYm = new Map<string, number>();
    const payoutExcludedMemberIds = new Set(((membersRes.data ?? []) as MemberRow[]).map((member) => member.member_id));
    for (const entry of buildPayoutEntries(cycles, payoutExcludedMemberIds)) {
      payoutByYm.set(entry.ym, (payoutByYm.get(entry.ym) ?? 0) + entry.total_pay);
    }

    const totalPayout = cycles.reduce((sum, cycle) => sum + (payoutByYm.get(cycle.ym) ?? 0), 0);
    const basePjBudgetTotal = Math.max(0, Math.round(clientAmountYen * 0.65) - bufferYen);
    const pjBudgetTotal = basePjBudgetTotal + extraPayoutBudgetYen;
    const weights = cycles.map((cycle) => {
      if (totalPayout > 0) return (payoutByYm.get(cycle.ym) ?? 0) / totalPayout;
      return 1 / cycles.length;
    });

    let allocatedBaseBudget = 0;
    let allocatedExtraPayoutBudget = 0;
    let allocatedReported = 0;
    let allocatedBuffer = 0;
    const now = new Date().toISOString();
    const updatedCycles: Array<{
      projectId: string;
      ym: string;
      budgetYen: number;
      baseBudgetYen: number;
      extraPayoutBudgetYen: number;
      reportedAmountYen: number;
      bufferYen: number;
    }> = [];

    for (let i = 0; i < cycles.length; i += 1) {
      const cycle = cycles[i];
      const isLast = i === cycles.length - 1;
      const baseBudgetYen = isLast ? basePjBudgetTotal - allocatedBaseBudget : Math.round(basePjBudgetTotal * weights[i]);
      const extraBudgetYen = isLast
        ? extraPayoutBudgetYen - allocatedExtraPayoutBudget
        : Math.round(extraPayoutBudgetYen * weights[i]);
      const budgetYen = baseBudgetYen + extraBudgetYen;
      const reportedAmountYen = isLast ? clientAmountYen - allocatedReported : Math.round(clientAmountYen * weights[i]);
      const cycleBufferYen = isLast ? bufferYen - allocatedBuffer : Math.round(bufferYen * weights[i]);
      allocatedBaseBudget += baseBudgetYen;
      allocatedExtraPayoutBudget += extraBudgetYen;
      allocatedReported += reportedAmountYen;
      allocatedBuffer += cycleBufferYen;

      const { error: updateError } = await db
        .from("billing_cycles")
        .update({
          status: normalizeStatusAfterBudgetConfirm(cycle.status),
          budget_yen: budgetYen,
          budget_reported_amount: reportedAmountYen,
          budget_buffer_amount: cycleBufferYen,
          budget_confirmed_at: now,
          budget_confirmed_by: auth.user.email,
        })
        .eq("project_id", cycle.project_id)
        .eq("ym", cycle.ym);
      if (updateError) throw updateError;

      updatedCycles.push({
        projectId: cycle.project_id,
        ym: cycle.ym,
        budgetYen,
        baseBudgetYen,
        extraPayoutBudgetYen: extraBudgetYen,
        reportedAmountYen,
        bufferYen: cycleBufferYen,
      });
    }

    const after = await loadTargetData(ym, { refreshRewards: true });
    return NextResponse.json({
      ok: true,
      clientAmountYen,
      basePjBudgetTotal,
      pjBudgetTotal,
      bufferYen,
      extraPayoutBudgetYen,
      updatedCycles,
      ...after,
    });
  } catch (err) {
    console.error("[admin payouts PATCH]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const ym = cleanYm(typeof body.ym === "string" ? body.ym : null);
  if (!ym) {
    return NextResponse.json({ ok: false, error: "valid ym is required" }, { status: 400 });
  }

  try {
    const before = await loadTargetData(ym, { refreshRewards: true });
    const db = createAdminClient();
    const entries = before.expectedEntries;
    const payoutExcludedMemberIds = ((before.members ?? []) as MemberRow[])
      .filter((member) => member.is_officer || member.exclude_from_payout_notice)
      .map((member) => member.member_id);
    const missingBudgetCycles = findMissingBudgetCycles(before.cycles as BillingCycleRow[], entries);
    if (missingBudgetCycles.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `PJ予算未設定のcycleがあるため保存できない: ${missingBudgetCycles
            .map((cycle) => `${cycle.project_id}:${cycle.ym}`)
            .join(", ")}`,
        },
        { status: 409 }
      );
    }
    const notices = aggregateNotices(ym, entries, before.members as MemberRow[]);
    const targetProjectIds = [...new Set((before.cycles as BillingCycleRow[]).map((cycle) => cycle.project_id))];
    const targetSourceYms = [...new Set((before.cycles as BillingCycleRow[]).map((cycle) => cycle.ym))];

    if (payoutExcludedMemberIds.length > 0 && targetProjectIds.length > 0 && targetSourceYms.length > 0) {
      const { error } = await db
        .from("monthly_reward_payout")
        .delete()
        .in("project_id", targetProjectIds)
        .in("ym", targetSourceYms)
        .in("member_id", payoutExcludedMemberIds);
      if (error) throw error;

      const { error: noticeDeleteError } = await db
        .from("payout_notices")
        .delete()
        .eq("ym", ym)
        .in("member_id", payoutExcludedMemberIds)
        .is("sent_at", null);
      if (noticeDeleteError) throw noticeDeleteError;
    }

    if (entries.length > 0) {
      const { error } = await db
        .from("monthly_reward_payout")
        .upsert(entries, { onConflict: "project_id,ym,member_id" });
      if (error) throw error;
    }

    // 金額が変わったメンバーの古い pdf_url / last_generated_at を NULL クリアして、
    // 次回 cron payout-notice-prebuild または UI 一括発行で差分検出が再生成を発火するようにする。
    // ただし sent_at が立っている (= 既にメンバーに送付済) 行は触らない (= 履歴保護)。
    const beforeNoticeByMember = new Map<string, number>();
    for (const row of (before.notices ?? []) as Array<{ member_id: string; total_yen: number | string | null }>) {
      beforeNoticeByMember.set(row.member_id, yenValue(row.total_yen));
    }
    const staleMemberIds = notices
      .filter((notice) => {
        const previous = beforeNoticeByMember.get(notice.member_id);
        return typeof previous === "number" && previous !== notice.total_yen;
      })
      .map((notice) => notice.member_id);
    let clearedStaleNoticePdfs = 0;
    if (staleMemberIds.length > 0) {
      const cleared = await clearStalePayoutNoticePdfs(db, ym, staleMemberIds);
      clearedStaleNoticePdfs = cleared.cleared;
    }

    if (notices.length > 0) {
      const { error } = await db
        .from("payout_notices")
        .upsert(notices, { onConflict: "member_id,ym" });
      if (error) throw error;
    }

    const after = await loadTargetData(ym);
    return NextResponse.json({
      ok: true,
      savedPayoutRows: entries.length,
      savedNoticeRows: notices.length,
      clearedStaleNoticePdfs,
      ...after,
    });
  } catch (err) {
    console.error("[admin payouts POST]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
