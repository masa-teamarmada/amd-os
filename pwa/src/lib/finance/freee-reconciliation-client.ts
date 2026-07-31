import type { SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { freeeApi } from "@/lib/freee-client";
import { fetchWalletTxns } from "@/lib/finance/freee-cash-balances";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import {
  computeRunPhase,
  decideExecutorAction,
  decideSheetReferenceSkip,
  detectAnomalousJournals,
  detectBalanceDeltas,
  detectInternalTransferCandidates,
  detectOfficerCompensationFindings,
  detectSyncIssues,
  detectUnprocessedEntries,
  buildOfficerRecurringMappings,
  buildAuditSourceUnavailableFinding,
  findingKeysToResolve,
  isRunStale,
  summarizeSheetRangeValues,
  weekWindowForRunDate,
  ymFromIsoDate,
  type ActionType,
  type Finding,
  type ManualJournalForAudit,
  type OfficerForMatching,
  type OfficerRecurringMapping,
  type RecurringItemForMatching,
  type RunPhase,
  type SheetReferenceSnapshot,
  type WalletableForAudit,
  type WalletTxnForAudit,
} from "@/lib/finance/freee-reconciliation-engine";

const LOOKBACK_DAYS = 60;
const STALE_RUNNING_THRESHOLD_MINUTES = 30;

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function jstNowDate(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function walletTxnDirection(txn: { entry_side?: string | null }): "income" | "expense" | null {
  const side = String(txn.entry_side ?? "").trim().toLowerCase();
  if (["income", "deposit", "credit"].includes(side)) return "income";
  if (["expense", "withdrawal", "withdraw", "debit"].includes(side)) return "expense";
  return null;
}

// --- freee reads (raw fetchers, official field names as specified) --------

export type WalletableRaw = {
  id?: number | string;
  type?: string;
  name?: string;
  walletable_name?: string;
  bank_name?: string;
  /** freee公式: 銀行同期の実残高（同期残高） */
  last_balance?: number | string | null;
  /** freee公式: freee帳簿上の登録残高 */
  walletable_balance?: number | string | null;
  sync_status?: string | null;
  last_synced_at?: string | null;
};

/** freee walletables を last_balance/walletable_balance/sync_status/last_synced_at 込みで取得する。 */
export async function fetchWalletablesFull(): Promise<WalletableRaw[]> {
  const params = new URLSearchParams({ with_balance: "true", with_sync_status: "true", with_last_synced_at: "true" });
  const data = (await freeeApi("GET", `/api/1/walletables?${params.toString()}`)) as { walletables?: WalletableRaw[] };
  return data.walletables ?? [];
}

function toWalletableForAudit(w: WalletableRaw): WalletableForAudit {
  return {
    id: w.id ?? "",
    type: String(w.type ?? ""),
    name: w.name || w.walletable_name || w.bank_name || null,
    syncedBalance: w.last_balance == null ? null : yen(w.last_balance),
    registeredBalance: w.walletable_balance == null ? null : yen(w.walletable_balance),
    syncStatus: w.sync_status ?? null,
    lastSyncedAt: w.last_synced_at ?? null,
  };
}

type ManualJournalRaw = {
  id?: number | string;
  issue_date?: string;
  txn_number?: string | null;
  details?: Array<{ entry_side?: string; account_item_id?: number | string | null; amount?: number | string }>;
};

type ManualJournalSourceResult =
  | { status: "ok"; journals: ManualJournalRaw[]; reason: null }
  | { status: "unavailable"; journals: []; reason: string };

/** freee manual_journals（振替伝票）を期間指定で取得する（read-only、書込みには使わない）。 */
export async function fetchManualJournalsForWindow(startDate: string, endDate: string): Promise<ManualJournalRaw[]> {
  const journals: ManualJournalRaw[] = [];
  const limit = 100;
  for (let offset = 0; offset < 3000; offset += limit) {
    const params = new URLSearchParams({
      start_issue_date: startDate,
      end_issue_date: endDate,
      limit: String(limit),
      offset: String(offset),
    });
    const data = (await freeeApi("GET", `/api/1/manual_journals?${params.toString()}`)) as { manual_journals?: ManualJournalRaw[] };
    const page = data.manual_journals ?? [];
    journals.push(...page);
    if (page.length < limit) break;
  }
  return journals;
}

async function loadManualJournalSource(startDate: string, endDate: string): Promise<ManualJournalSourceResult> {
  try {
    return { status: "ok", journals: await fetchManualJournalsForWindow(startDate, endDate), reason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("/api/1/manual_journals") && message.includes("403") && message.includes("access_denied")) {
      return {
        status: "unavailable",
        journals: [],
        reason: "freeeアプリに振替伝票一覧（manual_journals）の参照権限がないため、貸借不一致・勘定科目未設定・0円行の検査を実施できない。",
      };
    }
    throw error;
  }
}

function toManualJournalForAudit(j: ManualJournalRaw): ManualJournalForAudit {
  return {
    id: j.id ?? "",
    issueDate: j.issue_date ?? "",
    txnNumber: j.txn_number ?? null,
    details: (j.details ?? []).map((d) => ({
      entrySide: (d.entry_side ?? "") as "debit" | "credit",
      accountItemId: d.account_item_id ?? null,
      amountYen: yen(d.amount),
    })),
  };
}

// --- officer compensation mapping (company_finance_recurring_items が正本) ---

type RecurringItemRow = {
  id: string;
  display_name: string | null;
  vendor_name: string | null;
  amount_yen: number | string | null;
  frequency: string | null;
  withdrawal_account: string | null;
  item_kind: string | null;
  category: string | null;
  start_ym: string | null;
  end_ym: string | null;
  payload: unknown;
};

function isOfficerCompensationItem(item: RecurringItemRow): boolean {
  return item.item_kind === "salary" || item.category === "executive";
}

function isActiveForYm(item: RecurringItemRow, targetYm: string): boolean {
  if (item.start_ym && item.start_ym > targetYm) return false;
  if (item.end_ym && item.end_ym < targetYm) return false;
  return true;
}

function explicitMemberIdFromPayload(item: RecurringItemRow, officerIds: Set<string>): string | null {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const raw = payload.memberId ?? payload.member_id;
  const value = typeof raw === "string" ? raw : null;
  return value && officerIds.has(value) ? value : null;
}

/**
 * 全active役員 × company_finance_recurring_items(item_kind='salary' or category='executive',
 * targetYm時点でactive)の紐付けを取得する。会計照合の役員報酬正本はこれで、
 * /admin/finance の既存 loadOfficerReserve（billing_cycles.reward_summary_json 由来のPJ報酬reserve）
 * とは別用途・別正本。
 */
export async function loadOfficerRecurringMappings(db: SupabaseClient, targetYm: string): Promise<OfficerRecurringMapping[]> {
  const [membersRes, itemsRes] = await Promise.all([
    db.from("members").select("member_id, code_name, member_name").eq("is_officer", true).eq("status", "active"),
    db
      .from("company_finance_recurring_items")
      .select("id, display_name, vendor_name, amount_yen, frequency, withdrawal_account, item_kind, category, start_ym, end_ym, payload")
      .eq("status", "active"),
  ]);
  if (membersRes.error) throw new Error(`loadOfficerRecurringMappings members: ${membersRes.error.message}`);
  if (itemsRes.error) throw new Error(`loadOfficerRecurringMappings items: ${itemsRes.error.message}`);

  const officers: OfficerForMatching[] = (membersRes.data ?? []).map((m) => ({
    memberId: m.member_id as string,
    memberName: (m.member_name as string | null) || (m.code_name as string | null) || (m.member_id as string),
    codeName: (m.code_name as string | null) || (m.member_id as string),
  }));
  const officerIds = new Set(officers.map((o) => o.memberId));

  const items: RecurringItemForMatching[] = ((itemsRes.data ?? []) as RecurringItemRow[])
    .filter((item) => isOfficerCompensationItem(item) && isActiveForYm(item, targetYm))
    .map((item) => ({
      id: item.id,
      displayName: item.display_name,
      vendorName: item.vendor_name,
      amountYen: yen(item.amount_yen),
      frequency: item.frequency,
      withdrawalAccount: item.withdrawal_account,
      explicitMemberId: explicitMemberIdFromPayload(item, officerIds),
    }));

  return buildOfficerRecurringMappings(officers, items);
}

// --- read-only reference sheet (きよの収支スプシ) -----------------------------
// read-only参考資料。AMD OS/freeeへは一切書き込まない。セル値そのものは保存せず、
// range毎のrowCount/非空セル数だけをsanitized summaryとしてrun summary_jsonへ残す。

async function defaultFetchRangeValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) throw new Error("Google auth unavailable");
  const sheets = google.sheets({ version: "v4", auth: googleAuth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []) as string[][];
}

export async function loadFinanceReferenceSheetSnapshot(
  fetchRangeValues: (spreadsheetId: string, range: string) => Promise<string[][]> = defaultFetchRangeValues
): Promise<SheetReferenceSnapshot> {
  const spreadsheetId = process.env.AMD_FINANCE_REFERENCE_SHEET_ID || null;
  const ranges = (process.env.AMD_FINANCE_REFERENCE_SHEET_RANGES || "").split(",").map((r) => r.trim()).filter(Boolean);
  const googleAuth = await getGoogleAuthAsync();
  const skipReason = decideSheetReferenceSkip({ spreadsheetId, ranges, hasGoogleAuth: Boolean(googleAuth) });
  if (skipReason) return { status: "skipped", reason: skipReason };
  try {
    const summaries = [];
    for (const range of ranges) {
      const values = await fetchRangeValues(spreadsheetId as string, range);
      summaries.push(summarizeSheetRangeValues(range, values));
    }
    return { status: "ok", spreadsheetId: spreadsheetId as string, fetchedAt: new Date().toISOString(), ranges: summaries };
  } catch (error) {
    return { status: "skipped", reason: `sheet read failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// --- orchestration -----------------------------------------------------------

export type RunOptions = {
  triggeredBy: "cron" | "admin_manual";
  dryRun: boolean;
  jstRunDate?: string;
};

export type RunResult = {
  ok: boolean;
  skipped: boolean;
  reason: string | null;
  runId: string | null;
  runKey: string | null;
  phase: RunPhase | null;
  runSequence: number | null;
  findingCount: number;
  autoAppliedCount: number;
  blockedCount: number;
  error: string | null;
};

function writesEnabled(): boolean {
  return process.env.FREEE_RECONCILIATION_WRITES_ENABLED === "1";
}

async function countPriorCompletedCronRuns(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("freee_reconciliation_runs")
    .select("id", { count: "exact", head: true })
    .eq("triggered_by", "cron")
    .eq("status", "completed");
  if (error) throw new Error(`countPriorCompletedCronRuns: ${error.message}`);
  return count ?? 0;
}

/** このrunが検出した全findingを、run_id+finding_key単位の新規occurrenceとしてinsertする。 */
async function insertFindingOccurrences(db: SupabaseClient, runId: string, findings: Finding[]): Promise<Map<string, string>> {
  const findingIdByKey = new Map<string, string>();
  if (findings.length === 0) return findingIdByKey;
  const nowIso = new Date().toISOString();
  const rows = findings.map((f) => ({
    run_id: runId,
    finding_key: f.findingKey,
    finding_type: f.findingType,
    severity: f.severity,
    walletable_type: f.walletableType,
    walletable_id: f.walletableId,
    walletable_name: f.walletableName,
    freee_entity_type: f.freeeEntityType,
    freee_entity_id: f.freeeEntityId,
    member_id: f.memberId,
    amount_yen: f.amountYen,
    delta_yen: f.deltaYen,
    occurred_on: f.occurredOn,
    title: f.title,
    summary_ja: f.summaryJa,
    decision_reason_ja: f.decisionReasonJa,
    match_confidence: f.matchConfidence,
    eligible_for_auto_apply: f.eligibleForAutoApply,
    evidence_json: f.evidence,
    review_status: "pending",
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    updated_at: nowIso,
  }));
  const { data, error } = await db.from("freee_reconciliation_findings").insert(rows).select("id, finding_key");
  if (error) throw new Error(`insertFindingOccurrences: ${error.message}`);
  for (const row of data ?? []) findingIdByKey.set(row.finding_key as string, row.id as string);
  return findingIdByKey;
}

/**
 * 今回きちんと評価できたfinding typeについて、再現しなかった過去pending/blocked occurrenceを
 * resolvedへ閉じる。行は削除せず週次証跡を保持する。読取ソースがunavailableなtypeは呼出側で
 * evaluatedTypesから外し、未検査を解消扱いにしない。
 */
async function resolveMissingFindingOccurrences(
  db: SupabaseClient,
  runId: string,
  findings: Finding[],
  evaluatedTypes: Finding["findingType"][]
): Promise<number> {
  const { data, error } = await db
    .from("freee_reconciliation_findings")
    .select("id, finding_key")
    .in("finding_type", evaluatedTypes)
    .in("review_status", ["pending", "blocked"])
    .neq("run_id", runId);
  if (error) throw new Error(`resolveMissingFindingOccurrences select: ${error.message}`);

  const previousRows = (data ?? []) as Array<{ id: string; finding_key: string }>;
  const keysToResolve = new Set(
    findingKeysToResolve(previousRows.map((row) => row.finding_key), findings.map((finding) => finding.findingKey))
  );
  const ids = previousRows.filter((row) => keysToResolve.has(row.finding_key)).map((row) => row.id);
  const nowIso = new Date().toISOString();
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { error: updateError } = await db
      .from("freee_reconciliation_findings")
      .update({
        review_status: "resolved",
        reviewed_by: "system:weekly_reconciliation",
        reviewed_at: nowIso,
        review_note: "次回の同種照合で再現しなかったため解消済み",
        updated_at: nowIso,
      })
      .in("id", chunk);
    if (updateError) throw new Error(`resolveMissingFindingOccurrences update: ${updateError.message}`);
  }
  return ids.length;
}

const ACTION_TYPE_BY_FINDING_TYPE: Partial<Record<Finding["findingType"], ActionType>> = {
  officer_compensation_unreconciled: "officer_compensation_reconcile",
  internal_transfer_candidate: "internal_transfer_reconcile",
};

/**
 * eligible findingについてexecutor判定を記録する。2026-07時点ではisActionTypeSafelyExecutableが
 * 両action typeともfalse固定のため、decision.modeは常に"blocked"（安全な公式endpointが
 * 確認・実装されるまでの意図的な制約）。freeeへの実書込みはこの関数からは一切発生しない。
 */
async function applyExecutorForEligibleFindings(
  db: SupabaseClient,
  runId: string,
  phase: RunPhase,
  dryRun: boolean,
  findings: Finding[],
  findingIdByKey: Map<string, string>
): Promise<{ autoAppliedCount: number; blockedCount: number }> {
  const autoAppliedCount = 0;
  let blockedCount = 0;
  if (phase !== "auto_apply_allowlist") return { autoAppliedCount, blockedCount };

  for (const finding of findings) {
    if (!finding.eligibleForAutoApply || finding.matchConfidence !== "exact") continue;
    const actionType = ACTION_TYPE_BY_FINDING_TYPE[finding.findingType];
    if (!actionType) continue;

    const decision = decideExecutorAction({ phase, finding, actionType, dryRun, writesEnabled: writesEnabled() });
    const idempotencyKey = `${finding.findingKey}:${actionType}`;

    const { data: existingAction } = await db
      .from("freee_reconciliation_actions")
      .select("id, mode, freee_write_status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingAction && (existingAction.freee_write_status === "succeeded" || existingAction.mode === "executed")) {
      continue; // 再実行防止: すでに成功済みの action は二度と実行しない
    }

    const findingId = findingIdByKey.get(finding.findingKey);
    if (!findingId) continue;

    blockedCount += 1;
    await db.from("freee_reconciliation_actions").upsert(
      {
        finding_id: findingId,
        run_id: runId,
        action_type: actionType,
        idempotency_key: idempotencyKey,
        mode: decision.mode,
        freee_write_status: "not_attempted",
        blocked_reason: decision.blockedReason,
        executed_by: "system:auto_apply",
      },
      { onConflict: "idempotency_key" }
    );
    await db
      .from("freee_reconciliation_findings")
      .update({ review_status: "blocked", review_note: decision.blockedReason })
      .eq("id", findingId)
      .eq("review_status", "pending");
  }

  return { autoAppliedCount, blockedCount };
}

export async function runWeeklyReconciliation(db: SupabaseClient, options: RunOptions): Promise<RunResult> {
  const jstRunDate = options.jstRunDate ?? jstNowDate();
  const { weekStartDate, weekEndDate } = weekWindowForRunDate(jstRunDate);
  const runKey = options.triggeredBy === "cron"
    ? `freee-weekly:${weekStartDate}`
    : `freee-weekly-manual:${weekStartDate}:${crypto.randomUUID()}`;

  let runId: string;
  if (options.triggeredBy === "cron") {
    const { data: existing, error: existingError } = await db
      .from("freee_reconciliation_runs")
      .select("id, status, phase, run_sequence, finding_count, auto_applied_count, blocked_count, started_at")
      .eq("run_key", runKey)
      .maybeSingle();
    if (existingError) {
      return { ok: false, skipped: false, reason: null, runId: null, runKey, phase: null, runSequence: null, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: existingError.message };
    }
    if (existing?.status === "completed") {
      return {
        ok: true,
        skipped: true,
        reason: "this JST week already has a completed cron run (re-run prevention)",
        runId: existing.id as string,
        runKey,
        phase: existing.phase as RunPhase,
        runSequence: existing.run_sequence as number,
        findingCount: existing.finding_count as number,
        autoAppliedCount: existing.auto_applied_count as number,
        blockedCount: existing.blocked_count as number,
        error: null,
      };
    }
    const stale = existing?.status === "running" && isRunStale(existing.started_at as string, new Date().toISOString(), STALE_RUNNING_THRESHOLD_MINUTES);
    if (existing?.status === "running" && !stale) {
      return { ok: true, skipped: true, reason: "a run for this JST week is already in progress (concurrent run guard, <30min old)", runId: existing.id as string, runKey, phase: null, runSequence: null, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: null };
    }
    if (existing?.status === "failed" || stale) {
      runId = existing!.id as string;
      const { error } = await db
        .from("freee_reconciliation_runs")
        .update({ status: "running", dry_run: options.dryRun, error_message: stale ? "previous run exceeded 30min and was recovered as stale" : null, started_at: new Date().toISOString(), completed_at: null })
        .eq("id", runId);
      if (error) return { ok: false, skipped: false, reason: null, runId, runKey, phase: null, runSequence: null, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: error.message };
    } else {
      const priorCount = await countPriorCompletedCronRuns(db);
      const { runSequence, phase } = computeRunPhase(priorCount);
      const { data: inserted, error } = await db
        .from("freee_reconciliation_runs")
        .insert({
          run_key: runKey,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          triggered_by: "cron",
          dry_run: options.dryRun,
          status: "running",
          phase,
          run_sequence: runSequence,
        })
        .select("id")
        .single();
      if (error || !inserted) return { ok: false, skipped: false, reason: null, runId: null, runKey, phase, runSequence, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: error?.message ?? "insert failed" };
      runId = inserted.id as string;
    }
  } else {
    const priorCount = await countPriorCompletedCronRuns(db);
    const { runSequence, phase } = computeRunPhase(priorCount);
    const { data: inserted, error } = await db
      .from("freee_reconciliation_runs")
      .insert({
        run_key: runKey,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        triggered_by: "admin_manual",
        dry_run: options.dryRun,
        status: "running",
        phase,
        run_sequence: runSequence,
      })
      .select("id")
      .single();
    if (error || !inserted) return { ok: false, skipped: false, reason: null, runId: null, runKey, phase, runSequence, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: error?.message ?? "insert failed" };
    runId = inserted.id as string;
  }

  try {
    const { data: runRow, error: runRowError } = await db
      .from("freee_reconciliation_runs")
      .select("phase, run_sequence")
      .eq("id", runId)
      .single();
    if (runRowError || !runRow) throw new Error(runRowError?.message ?? "run row missing after insert");
    const phase = runRow.phase as RunPhase;
    const runSequence = runRow.run_sequence as number;
    const targetYm = ymFromIsoDate(weekEndDate);

    const historyStartDate = (() => {
      const [y, m, d] = weekEndDate.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() - LOOKBACK_DAYS);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    })();

    const [walletablesRaw, rawTxns, manualJournalSource, officerMappings, sheetReference] = await Promise.all([
      fetchWalletablesFull(),
      fetchWalletTxns(historyStartDate, weekEndDate),
      loadManualJournalSource(historyStartDate, weekEndDate),
      loadOfficerRecurringMappings(db, targetYm),
      loadFinanceReferenceSheetSnapshot(),
    ]);

    const walletablesForAudit: WalletableForAudit[] = walletablesRaw.map(toWalletableForAudit);
    const walletableNameById = new Map(walletablesForAudit.map((w) => [`${w.type}:${w.id}`, w.name]));
    const walletTxnsForAudit: WalletTxnForAudit[] = rawTxns
      .filter((t) => t.date && t.walletable_type && t.walletable_id != null && t.amount != null)
      .map((t) => ({
        id: t.id ?? "",
        date: String(t.date),
        walletableType: String(t.walletable_type),
        walletableId: t.walletable_id as string | number,
        walletableName: walletableNameById.get(`${t.walletable_type}:${t.walletable_id}`) ?? null,
        amountYen: yen(t.amount),
        direction: walletTxnDirection(t),
        processingStatus: t.status == null ? null : Number(t.status),
        dealId: t.deal_id ?? null,
        transferId: t.transfer_id ?? null,
        description: t.description ?? null,
      }));
    const manualJournalsForAudit: ManualJournalForAudit[] = manualJournalSource.journals.map(toManualJournalForAudit);

    const nowIso = new Date().toISOString();
    const findings: Finding[] = [
      ...detectBalanceDeltas(walletablesForAudit),
      ...detectSyncIssues(walletablesForAudit, nowIso),
      ...detectUnprocessedEntries(walletTxnsForAudit, nowIso),
      ...(manualJournalSource.status === "unavailable"
        ? [buildAuditSourceUnavailableFinding("freee manual_journals", manualJournalSource.reason)]
        : []),
      ...detectAnomalousJournals(manualJournalsForAudit),
      ...detectOfficerCompensationFindings(officerMappings, walletTxnsForAudit, targetYm),
      ...detectInternalTransferCandidates(walletTxnsForAudit),
    ];

    const findingIdByKey = await insertFindingOccurrences(db, runId, findings);
    const evaluatedTypes: Finding["findingType"][] = [
      "balance_delta",
      "sync_stale",
      "unprocessed_entry",
      "audit_source_unavailable",
      "officer_compensation_unreconciled",
      "internal_transfer_candidate",
    ];
    if (manualJournalSource.status === "ok") evaluatedTypes.push("anomalous_journal");
    const resolvedCount = await resolveMissingFindingOccurrences(db, runId, findings, evaluatedTypes);
    const { autoAppliedCount, blockedCount } = await applyExecutorForEligibleFindings(
      db,
      runId,
      phase,
      options.dryRun,
      findings,
      findingIdByKey
    );

    const summary = {
      weekStartDate,
      weekEndDate,
      targetYm,
      walletableCount: walletablesForAudit.length,
      walletTxnCount: walletTxnsForAudit.length,
      manualJournalCount: manualJournalsForAudit.length,
      manualJournalCheck: {
        status: manualJournalSource.status,
        reason: manualJournalSource.reason,
      },
      officerCount: officerMappings.length,
      findingsByType: findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.findingType] = (acc[f.findingType] ?? 0) + 1;
        return acc;
      }, {}),
      resolvedCount,
      sheetReference,
    };

    await db
      .from("freee_reconciliation_runs")
      .update({
        status: "completed",
        finding_count: findings.length,
        auto_applied_count: autoAppliedCount,
        blocked_count: blockedCount,
        summary_json: summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      ok: true,
      skipped: false,
      reason: null,
      runId,
      runKey,
      phase,
      runSequence,
      findingCount: findings.length,
      autoAppliedCount,
      blockedCount,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("freee_reconciliation_runs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", runId);
    return { ok: false, skipped: false, reason: null, runId, runKey, phase: null, runSequence: null, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: message };
  }
}

// --- admin overview read ------------------------------------------------------

export type ReconciliationRunSummary = {
  id: string;
  runKey: string;
  weekStartDate: string;
  weekEndDate: string;
  triggeredBy: string;
  dryRun: boolean;
  status: string;
  phase: string;
  runSequence: number | null;
  findingCount: number;
  autoAppliedCount: number;
  blockedCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type ReconciliationFindingRow = {
  id: string;
  findingType: string;
  severity: string;
  walletableName: string | null;
  memberId: string | null;
  amountYen: number | null;
  deltaYen: number | null;
  occurredOn: string | null;
  title: string;
  summaryJa: string;
  decisionReasonJa: string;
  matchConfidence: string;
  eligibleForAutoApply: boolean;
  reviewStatus: string;
  reviewNote: string | null;
  lastSeenAt: string;
};

export type ReconciliationOverview = {
  latestRun: ReconciliationRunSummary | null;
  runHistory: ReconciliationRunSummary[];
  findingsByType: Record<string, ReconciliationFindingRow[]>;
};

function toRunSummary(row: Record<string, unknown>): ReconciliationRunSummary {
  return {
    id: row.id as string,
    runKey: row.run_key as string,
    weekStartDate: row.week_start_date as string,
    weekEndDate: row.week_end_date as string,
    triggeredBy: row.triggered_by as string,
    dryRun: Boolean(row.dry_run),
    status: row.status as string,
    phase: row.phase as string,
    runSequence: (row.run_sequence as number | null) ?? null,
    findingCount: (row.finding_count as number) ?? 0,
    autoAppliedCount: (row.auto_applied_count as number) ?? 0,
    blockedCount: (row.blocked_count as number) ?? 0,
    errorMessage: (row.error_message as string | null) ?? null,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

function toFindingRow(row: Record<string, unknown>): ReconciliationFindingRow {
  return {
    id: row.id as string,
    findingType: row.finding_type as string,
    severity: row.severity as string,
    walletableName: (row.walletable_name as string | null) ?? null,
    memberId: (row.member_id as string | null) ?? null,
    amountYen: (row.amount_yen as number | null) ?? null,
    deltaYen: (row.delta_yen as number | null) ?? null,
    occurredOn: (row.occurred_on as string | null) ?? null,
    title: row.title as string,
    summaryJa: row.summary_ja as string,
    decisionReasonJa: row.decision_reason_ja as string,
    matchConfidence: row.match_confidence as string,
    eligibleForAutoApply: Boolean(row.eligible_for_auto_apply),
    reviewStatus: row.review_status as string,
    reviewNote: (row.review_note as string | null) ?? null,
    lastSeenAt: row.last_seen_at as string,
  };
}

/**
 * finding_keyは週次runごとにoccurrence（別行）を持つため、一覧表示は
 * finding_keyごとの最新occurrence1件だけに絞る（過去runの証跡自体はテーブルに残り続ける）。
 */
export async function loadReconciliationOverview(db: SupabaseClient): Promise<ReconciliationOverview> {
  const [runsRes, findingsRes] = await Promise.all([
    db.from("freee_reconciliation_runs").select("*").order("started_at", { ascending: false }).limit(8),
    db.from("freee_reconciliation_findings").select("*").order("created_at", { ascending: false }).limit(1000),
  ]);

  const runs = ((runsRes.data ?? []) as Record<string, unknown>[]).map(toRunSummary);

  const latestByKey = new Map<string, Record<string, unknown>>();
  for (const row of (findingsRes.data ?? []) as Record<string, unknown>[]) {
    const key = row.finding_key as string;
    if (!latestByKey.has(key)) latestByKey.set(key, row); // created_at desc順なので最初に見えたものがlatest occurrence
  }
  const findingRows = [...latestByKey.values()]
    .filter((row) => row.review_status === "pending" || row.review_status === "blocked")
    .map(toFindingRow)
    .sort((a, b) => {
      const severityRank: Record<string, number> = { blocker: 2, warn: 1, info: 0 };
      const rankDiff = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
      if (rankDiff !== 0) return rankDiff;
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    });

  const findingsByType: Record<string, ReconciliationFindingRow[]> = {};
  for (const row of findingRows) {
    (findingsByType[row.findingType] ??= []).push(row);
  }

  return {
    latestRun: runs[0] ?? null,
    runHistory: runs,
    findingsByType,
  };
}
