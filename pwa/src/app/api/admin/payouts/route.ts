import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  candidateSourceYmsForPaymentYm,
  effectivePaymentYmForCycle,
  type PaymentProjectRow,
} from "@/lib/payment-groups";
import { syncRewardSummariesForBillingCycles } from "@/lib/reward-summary";

export const runtime = "nodejs";

const YM_RE = /^[0-9]{6}$/;

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

type RewardMemberRow = {
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
};

type RewardSummary = {
  members?: RewardMemberRow[];
  monthlyBudget65?: unknown;
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

type MemberRow = {
  member_id: string;
  code_name?: string | null;
  member_name?: string | null;
  email?: string | null;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
};

type LoadTargetDataOptions = {
  refreshRewards?: boolean;
};

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

async function loadTargetData(ym: string, options: LoadTargetDataOptions = {}) {
  const db = createAdminClient();
  const cycleSelect =
    "project_id, ym, status, budget_yen, budget_reported_amount, budget_buffer_amount, invoice_ym, reward_summary_json, payout_notice_uploaded_at, payment_confirmed_at, reward_paid_at";

  const candidateYms = candidateSourceYmsForPaymentYm(ym);
  const [membersRes, projectsRes, invoiceCyclesRes, unsetInvoiceCyclesRes] = await Promise.all([
    db
      .from("members")
          .select("member_id, code_name, member_name, email, status, is_officer, exclude_from_payout_notice")
      .eq("status", "active")
      .order("code_name"),
    db
      .from("projects")
      .select("project_id, project_name, client_name, status, freee_partner_id, payment_due_rule, payment_due_day")
      .order("project_name"),
    db
      .from("billing_cycles")
      .select(cycleSelect)
      .eq("invoice_ym", ym),
    db
      .from("billing_cycles")
      .select(cycleSelect)
      .in("ym", candidateYms)
      .is("invoice_ym", null),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (invoiceCyclesRes.error) throw invoiceCyclesRes.error;
  if (unsetInvoiceCyclesRes.error) throw unsetInvoiceCyclesRes.error;

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
  if (options.refreshRewards) {
    const syncedRewards = await syncRewardSummariesForBillingCycles(db, cycles);
    for (const cycle of cycles) {
      const synced = syncedRewards.get(cycleKey(cycle));
      if (synced) {
        cycle.reward_summary_json = synced;
        if (Number(cycle.budget_yen ?? 0) <= 0 && Number(synced.monthlyBudget65 ?? 0) > 0) {
          cycle.budget_yen = Math.round(Number(synced.monthlyBudget65));
        }
      }
    }
  } else {
    for (const cycle of cycles) {
      const cached = asRewardSummary(cycle.reward_summary_json);
      const cachedBudget = numberValue(cached?.monthlyBudget65);
      if (Number(cycle.budget_yen ?? 0) <= 0 && cachedBudget > 0) {
        cycle.budget_yen = Math.round(cachedBudget);
      }
    }
  }
  const officerMemberIds = new Set(
    ((membersRes.data ?? []) as MemberRow[])
      .filter((member) => member.is_officer)
      .map((member) => member.member_id)
  );

  const sourceYms = [...new Set(cycles.map((cycle) => cycle.ym))];
  const projectIds = [...new Set(cycles.map((cycle) => cycle.project_id))];

  const [payoutsRes, noticesRes] = await Promise.all([
    sourceYms.length > 0 && projectIds.length > 0
      ? db
          .from("monthly_reward_payout")
          .select("*")
          .in("ym", sourceYms)
          .in("project_id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("payout_notices").select("*").eq("ym", ym),
  ]);

  if (payoutsRes.error) throw payoutsRes.error;
  if (noticesRes.error) throw noticesRes.error;

  return {
    ym,
    members: membersRes.data ?? [],
    projects: projectsRes.data ?? [],
    cycles,
    payouts: payoutsRes.data ?? [],
    notices: noticesRes.data ?? [],
    expectedEntries: buildPayoutEntries(cycles, officerMemberIds),
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
      const member = findMember(memberId, data.members);
      if (!member) {
        return NextResponse.json({ ok: false, error: `member not found: ${memberId}` }, { status: 404 });
      }

      const entries = expectedNoticeEntriesForMember(memberId, data);
      const totalYen = entries.reduce((sum, entry) => sum + entry.total_pay, 0);
      if (entries.length === 0 || totalYen <= 0) {
        return NextResponse.json({ ok: false, error: "no payout entries for notice" }, { status: 409 });
      }

      const { data: existing, error: existingError } = await db
        .from("payout_notices")
        .select("member_id, ym, sent_at, notice_no, pdf_url, total_yen")
        .eq("member_id", memberId)
        .eq("ym", ym)
        .maybeSingle();
      if (existingError) throw existingError;

      const { count, error: countError } = await db
        .from("payout_notices")
        .select("member_id", { count: "exact", head: true })
        .eq("ym", ym)
        .not("notice_no", "is", null);
      if (countError) throw countError;

      const noticeNo = previewOnly
        ? `PREVIEW-${ym}-${memberId}`
        : textValue(existing?.notice_no) || generatedNoticeNo(ym, (count ?? 0) + 1);
      const payeeName = textValue(member.member_name) || textValue(member.code_name) || memberId;
      const issuedAt = new Date().toISOString();

      const gasResult = await callGasPayoutNoticePdf({
        ym,
        memberId,
        noticeNo,
        payeeName,
        payeeEmail: textValue(member.email),
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

      const pdfUrl = textValue(gasResult.pdfUrl) || textValue(gasResult.pdf_url);
      if (!pdfUrl) throw new Error("GAS did not return pdfUrl");
      const actualNoticeNo = textValue(gasResult.noticeNo) || textValue(gasResult.freeeNoticeNo) || noticeNo;

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
            },
            { onConflict: "member_id,ym" }
          );
        if (upsertError) throw upsertError;
      }

      const after = await loadTargetData(ym);
      return NextResponse.json({
        ok: true,
        previewOnly,
        issuedNotice: {
          memberId,
          noticeNo: actualNoticeNo,
          pdfUrl,
          totalYen: Math.round(totalYen),
          issuedAtJst: textValue(gasResult.issuedAtJst),
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

  const invoiceYm = cleanYm(typeof body.invoiceYm === "string" ? body.invoiceYm : null) ?? ym;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const sourceYms = Array.isArray(body.sourceYms)
    ? [...new Set(body.sourceYms.map((value) => cleanYm(String(value))).filter((value): value is string => !!value))]
    : [];
  const clientAmountYen = yenValue(body.clientAmountYen);
  const bufferYen = Math.max(0, yenValue(body.bufferYen));

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
        .select("project_id, project_name, client_name, status, freee_partner_id, payment_due_rule, payment_due_day")
        .eq("project_id", projectId)
        .maybeSingle(),
      db
        .from("members")
        .select("member_id, is_officer")
        .eq("is_officer", true),
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
    const officerMemberIds = new Set(((membersRes.data ?? []) as MemberRow[]).map((member) => member.member_id));
    for (const entry of buildPayoutEntries(cycles, officerMemberIds)) {
      payoutByYm.set(entry.ym, (payoutByYm.get(entry.ym) ?? 0) + entry.total_pay);
    }

    const totalPayout = cycles.reduce((sum, cycle) => sum + (payoutByYm.get(cycle.ym) ?? 0), 0);
    const pjBudgetTotal = Math.max(0, Math.round(clientAmountYen * 0.65) - bufferYen);
    const weights = cycles.map((cycle) => {
      if (totalPayout > 0) return (payoutByYm.get(cycle.ym) ?? 0) / totalPayout;
      return 1 / cycles.length;
    });

    let allocatedBudget = 0;
    let allocatedReported = 0;
    let allocatedBuffer = 0;
    const now = new Date().toISOString();
    const updatedCycles: Array<{ projectId: string; ym: string; budgetYen: number; reportedAmountYen: number; bufferYen: number }> = [];

    for (let i = 0; i < cycles.length; i += 1) {
      const cycle = cycles[i];
      const isLast = i === cycles.length - 1;
      const budgetYen = isLast ? pjBudgetTotal - allocatedBudget : Math.round(pjBudgetTotal * weights[i]);
      const reportedAmountYen = isLast ? clientAmountYen - allocatedReported : Math.round(clientAmountYen * weights[i]);
      const cycleBufferYen = isLast ? bufferYen - allocatedBuffer : Math.round(bufferYen * weights[i]);
      allocatedBudget += budgetYen;
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
        reportedAmountYen,
        bufferYen: cycleBufferYen,
      });
    }

    const after = await loadTargetData(ym, { refreshRewards: true });
    return NextResponse.json({
      ok: true,
      clientAmountYen,
      pjBudgetTotal,
      bufferYen,
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
    const officerMemberIds = ((before.members ?? []) as MemberRow[])
      .filter((member) => member.is_officer)
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

    if (officerMemberIds.length > 0 && targetProjectIds.length > 0 && targetSourceYms.length > 0) {
      const { error } = await db
        .from("monthly_reward_payout")
        .delete()
        .in("project_id", targetProjectIds)
        .in("ym", targetSourceYms)
        .in("member_id", officerMemberIds);
      if (error) throw error;

      const { error: noticeDeleteError } = await db
        .from("payout_notices")
        .delete()
        .eq("ym", ym)
        .in("member_id", officerMemberIds)
        .is("sent_at", null);
      if (noticeDeleteError) throw noticeDeleteError;
    }

    if (entries.length > 0) {
      const { error } = await db
        .from("monthly_reward_payout")
        .upsert(entries, { onConflict: "project_id,ym,member_id" });
      if (error) throw error;
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
