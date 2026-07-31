import type { SupabaseClient } from "@supabase/supabase-js";
import { freeeApi } from "@/lib/freee-client";
import { fetchWalletTxns, fetchFreeeAccountItems, type WalletTxn } from "@/lib/finance/freee-cash-balances";
import { loadOfficerReserve } from "@/lib/finance/officer-compensation";
import { currentYmJst } from "@/lib/payment-groups";
import {
  computeRunPhase,
  decideExecutorAction,
  detectAnomalousJournals,
  detectBalanceDeltas,
  detectInternalTransferCandidates,
  detectOfficerCompensationFindings,
  detectSyncIssues,
  detectUnprocessedEntries,
  weekWindowForRunDate,
  type ActionType,
  type Finding,
  type ManualJournalForAudit,
  type OfficerExpectedCompensation,
  type RunPhase,
  type WalletableForAudit,
  type WalletTxnForAudit,
} from "@/lib/finance/freee-reconciliation-engine";

const LOOKBACK_DAYS = 60;
const OFFICER_ACCOUNT_ITEM_PATTERN = /役員報酬/;

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function jstNowDate(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function walletTxnDirection(txn: WalletTxn): "income" | "expense" | null {
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
  last_balance?: number | string | null;
  walletable_balance?: number | string | null;
  sync_status?: string | null;
  last_synced_at?: string | null;
};

/** freee walletables を last_balance/walletable_balance/sync_status/last_synced_at 込みで取得する。 */
export async function fetchWalletablesFull(): Promise<WalletableRaw[]> {
  const params = new URLSearchParams({ with_sync_status: "true", with_last_synced_at: "true" });
  const data = (await freeeApi("GET", `/api/1/walletables?${params.toString()}`)) as { walletables?: WalletableRaw[] };
  return data.walletables ?? [];
}

function toWalletableForAudit(w: WalletableRaw): WalletableForAudit {
  return {
    id: w.id ?? "",
    type: String(w.type ?? ""),
    name: w.name || w.walletable_name || w.bank_name || null,
    lastBalance: w.last_balance == null ? null : yen(w.last_balance),
    walletableBalance: w.walletable_balance == null ? null : yen(w.walletable_balance),
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

// --- freee write (officer compensation reconciliation only) ----------------

type WalletTxnDetailRaw = {
  id?: number | string;
  account_item_id?: number | string | null;
  partner_id?: number | string | null;
  description?: string | null;
};

async function fetchWalletTxnById(id: string): Promise<WalletTxnDetailRaw | null> {
  try {
    const data = (await freeeApi("GET", `/api/1/wallet_txns/${id}`)) as { wallet_txn?: WalletTxnDetailRaw };
    return data.wallet_txn ?? null;
  } catch (error) {
    return { id, account_item_id: null, description: `fetch failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export type OfficerReconcileResult = {
  ok: boolean;
  before: WalletTxnDetailRaw | null;
  after: WalletTxnDetailRaw | null;
  error: string | null;
};

/**
 * 役員報酬の消込 = 対象wallet_txn（明細）の account_item_id を役員報酬勘定へ分類する。
 * freeeにはwallet_txnの「消込/処理済み」フラグを外部APIから変更する手段が無いため
 * (freee/freee-api-schema#541, 2026-07時点未実装)、二重計上を発生させない安全な表現として
 * 既存明細のaccount_item_id更新（PUT /api/1/wallet_txns/{id}）だけを行う。新規のcash側計上は作らない。
 */
export async function executeOfficerCompensationReconcile(
  walletTxnId: string,
  accountItemId: string
): Promise<OfficerReconcileResult> {
  const before = await fetchWalletTxnById(walletTxnId);
  try {
    await freeeApi("PUT", `/api/1/wallet_txns/${walletTxnId}`, { account_item_id: Number(accountItemId) });
  } catch (error) {
    return { ok: false, before, after: null, error: error instanceof Error ? error.message : String(error) };
  }
  const after = await fetchWalletTxnById(walletTxnId);
  return { ok: true, before, after, error: null };
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

async function upsertFindings(db: SupabaseClient, runId: string, findings: Finding[]): Promise<void> {
  if (findings.length === 0) return;
  const keys = findings.map((f) => f.findingKey);
  const { data: existingRows, error: existingError } = await db
    .from("freee_reconciliation_findings")
    .select("id, finding_key, review_status")
    .in("finding_key", keys);
  if (existingError) throw new Error(`upsertFindings select: ${existingError.message}`);
  const existingByKey = new Map((existingRows ?? []).map((r) => [r.finding_key as string, r]));

  const toInsert: Record<string, unknown>[] = [];
  const toUpdatePending: Array<{ id: string; row: Record<string, unknown> }> = [];
  const toTouchOnly: string[] = [];

  const nowIso = new Date().toISOString();
  for (const f of findings) {
    const existing = existingByKey.get(f.findingKey);
    const row = {
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
      last_seen_at: nowIso,
      updated_at: nowIso,
    };
    if (!existing) {
      toInsert.push({ ...row, review_status: "pending" });
    } else if (existing.review_status === "pending") {
      toUpdatePending.push({ id: existing.id as string, row });
    } else {
      toTouchOnly.push(existing.id as string);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await db.from("freee_reconciliation_findings").insert(toInsert);
    if (error) throw new Error(`upsertFindings insert: ${error.message}`);
  }
  for (const { id, row } of toUpdatePending) {
    const { error } = await db.from("freee_reconciliation_findings").update(row).eq("id", id);
    if (error) throw new Error(`upsertFindings update pending ${id}: ${error.message}`);
  }
  if (toTouchOnly.length > 0) {
    const { error } = await db
      .from("freee_reconciliation_findings")
      .update({ run_id: runId, last_seen_at: nowIso })
      .in("id", toTouchOnly);
    if (error) throw new Error(`upsertFindings touch: ${error.message}`);
  }
}

const ACTION_TYPE_BY_FINDING_TYPE: Partial<Record<Finding["findingType"], ActionType>> = {
  officer_compensation_unreconciled: "officer_compensation_reconcile",
  internal_transfer_candidate: "internal_transfer_reconcile",
};

async function applyExecutorForEligibleFindings(
  db: SupabaseClient,
  runId: string,
  phase: RunPhase,
  dryRun: boolean,
  findings: Finding[],
  accountItems: Map<string, string>
): Promise<{ autoAppliedCount: number; blockedCount: number }> {
  let autoAppliedCount = 0;
  let blockedCount = 0;
  if (phase !== "auto_apply_allowlist") return { autoAppliedCount, blockedCount };

  const officerAccountItemId = [...accountItems.entries()].find(([, name]) => OFFICER_ACCOUNT_ITEM_PATTERN.test(name))?.[0] ?? null;

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

    const { data: findingRow } = await db
      .from("freee_reconciliation_findings")
      .select("id, review_status")
      .eq("finding_key", finding.findingKey)
      .maybeSingle();
    const findingId = findingRow?.id as string | undefined;
    if (!findingId) continue;

    if (decision.mode === "blocked") {
      blockedCount += 1;
      const actionRow = {
        finding_id: findingId,
        run_id: runId,
        action_type: actionType,
        idempotency_key: idempotencyKey,
        mode: "blocked",
        freee_write_status: "not_attempted",
        blocked_reason: decision.blockedReason,
        executed_by: "system:auto_apply",
      };
      await db.from("freee_reconciliation_actions").upsert(actionRow, { onConflict: "idempotency_key" });
      if (!dryRun && findingRow?.review_status === "pending") {
        await db
          .from("freee_reconciliation_findings")
          .update({ review_status: "blocked", review_note: decision.blockedReason, reviewed_at: new Date().toISOString() })
          .eq("id", findingId);
      }
      continue;
    }

    if (decision.mode === "dry_run") {
      await db.from("freee_reconciliation_actions").upsert(
        {
          finding_id: findingId,
          run_id: runId,
          action_type: actionType,
          idempotency_key: idempotencyKey,
          mode: "dry_run",
          freee_write_status: "not_attempted",
          executed_by: "system:auto_apply",
        },
        { onConflict: "idempotency_key" }
      );
      continue;
    }

    // decision.mode === "would_execute" — officer_compensation_reconcile のみここに到達しうる
    if (actionType !== "officer_compensation_reconcile" || !officerAccountItemId || !finding.freeeEntityId) {
      await db.from("freee_reconciliation_actions").upsert(
        {
          finding_id: findingId,
          run_id: runId,
          action_type: actionType,
          idempotency_key: idempotencyKey,
          mode: "blocked",
          freee_write_status: "not_attempted",
          blocked_reason: "役員報酬account_itemが見つからない、またはfreee entityIdが無い",
          executed_by: "system:auto_apply",
        },
        { onConflict: "idempotency_key" }
      );
      continue;
    }

    const result = await executeOfficerCompensationReconcile(finding.freeeEntityId, officerAccountItemId);
    autoAppliedCount += result.ok ? 1 : 0;
    blockedCount += result.ok ? 0 : 1;
    await db.from("freee_reconciliation_actions").upsert(
      {
        finding_id: findingId,
        run_id: runId,
        action_type: actionType,
        idempotency_key: idempotencyKey,
        mode: "executed",
        freee_write_status: result.ok ? "succeeded" : "failed",
        freee_wallet_txn_id: finding.freeeEntityId,
        freee_account_item_id: officerAccountItemId,
        before_state_json: result.before ?? {},
        after_state_json: result.after ?? null,
        error_message: result.error,
        executed_by: "system:auto_apply",
        executed_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key" }
    );
    if (findingRow?.review_status === "pending") {
      await db
        .from("freee_reconciliation_findings")
        .update({
          review_status: result.ok ? "auto_applied" : "blocked",
          review_note: result.ok ? "system:auto_apply で役員報酬を消込済み" : `auto_apply失敗: ${result.error}`,
          reviewed_at: new Date().toISOString(),
          reviewed_by: "system:auto_apply",
        })
        .eq("id", findingId);
    }
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
      .select("id, status, phase, run_sequence, finding_count, auto_applied_count, blocked_count")
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
    if (existing?.status === "running") {
      return { ok: true, skipped: true, reason: "a run for this JST week is already in progress (concurrent/crashed run guard)", runId: existing.id as string, runKey, phase: null, runSequence: null, findingCount: 0, autoAppliedCount: 0, blockedCount: 0, error: null };
    }
    if (existing?.status === "failed") {
      runId = existing.id as string;
      const { error } = await db
        .from("freee_reconciliation_runs")
        .update({ status: "running", dry_run: options.dryRun, error_message: null, started_at: new Date().toISOString(), completed_at: null })
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

    const historyStartDate = (() => {
      const [y, m, d] = weekEndDate.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() - LOOKBACK_DAYS);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    })();

    const [walletablesRaw, rawTxns, accountItems, manualJournalsRaw, officerReserve] = await Promise.all([
      fetchWalletablesFull(),
      fetchWalletTxns(historyStartDate, weekEndDate),
      fetchFreeeAccountItems(),
      fetchManualJournalsForWindow(historyStartDate, weekEndDate),
      loadOfficerReserve(db, currentYmJst()),
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
        dealId: t.deal_id ?? null,
        transferId: t.transfer_id ?? null,
        description: t.description ?? null,
      }));
    const manualJournalsForAudit: ManualJournalForAudit[] = manualJournalsRaw.map(toManualJournalForAudit);
    const officerExpected: OfficerExpectedCompensation[] = officerReserve.entries.map((e) => ({
      memberId: e.memberId,
      memberName: e.memberName,
      projectId: e.projectId,
      projectName: e.projectName,
      sourceYm: e.sourceYm,
      amountYen: e.amountYen,
    }));

    const nowIso = new Date().toISOString();
    const findings: Finding[] = [
      ...detectBalanceDeltas(walletablesForAudit),
      ...detectSyncIssues(walletablesForAudit, nowIso),
      ...detectUnprocessedEntries(walletTxnsForAudit, nowIso),
      ...detectAnomalousJournals(manualJournalsForAudit),
      ...detectOfficerCompensationFindings(officerExpected, walletTxnsForAudit),
      ...detectInternalTransferCandidates(walletTxnsForAudit),
    ];

    await upsertFindings(db, runId, findings);
    const { autoAppliedCount, blockedCount } = await applyExecutorForEligibleFindings(
      db,
      runId,
      phase,
      options.dryRun,
      findings,
      accountItems
    );

    const summary = {
      weekStartDate,
      weekEndDate,
      walletableCount: walletablesForAudit.length,
      walletTxnCount: walletTxnsForAudit.length,
      manualJournalCount: manualJournalsForAudit.length,
      officerExpectedCount: officerExpected.length,
      findingsByType: findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.findingType] = (acc[f.findingType] ?? 0) + 1;
        return acc;
      }, {}),
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

export async function loadReconciliationOverview(db: SupabaseClient): Promise<ReconciliationOverview> {
  const [runsRes, findingsRes] = await Promise.all([
    db.from("freee_reconciliation_runs").select("*").order("started_at", { ascending: false }).limit(8),
    db
      .from("freee_reconciliation_findings")
      .select("*")
      .in("review_status", ["pending", "blocked"])
      .order("severity", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(200),
  ]);

  const runs = ((runsRes.data ?? []) as Record<string, unknown>[]).map(toRunSummary);
  const findingRows = ((findingsRes.data ?? []) as Record<string, unknown>[]).map(toFindingRow);
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
