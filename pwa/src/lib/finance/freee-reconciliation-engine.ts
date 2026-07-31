import { createHash } from "node:crypto";

/**
 * 週次freee会計照合の純関数エンジン。
 * I/O（Supabase / freee API）を一切持たない。cron routeがfreee/DBから取得した
 * plainオブジェクトを渡し、findingの配列を受け取る。
 */

export type FindingType =
  | "balance_delta"
  | "sync_stale"
  | "unprocessed_entry"
  | "anomalous_journal"
  | "officer_compensation_unreconciled"
  | "internal_transfer_candidate";

export type Severity = "info" | "warn" | "blocker";
export type MatchConfidence = "exact" | "high" | "ambiguous";

export type Finding = {
  findingKey: string;
  findingType: FindingType;
  severity: Severity;
  walletableType: string | null;
  walletableId: string | null;
  walletableName: string | null;
  freeeEntityType: string | null;
  freeeEntityId: string | null;
  memberId: string | null;
  amountYen: number | null;
  deltaYen: number | null;
  occurredOn: string | null;
  title: string;
  summaryJa: string;
  decisionReasonJa: string;
  matchConfidence: MatchConfidence;
  eligibleForAutoApply: boolean;
  evidence: Record<string, unknown>;
};

export type RunPhase = "review_only" | "auto_apply_allowlist";

const REVIEW_ONLY_RUN_COUNT = 4;

/** cronトリガの完了run数から、今回のrun_sequenceとphaseを決める純関数。 */
export function computeRunPhase(priorCompletedCronRunCount: number): { runSequence: number; phase: RunPhase } {
  const count = Number.isFinite(priorCompletedCronRunCount) && priorCompletedCronRunCount >= 0
    ? Math.floor(priorCompletedCronRunCount)
    : 0;
  const runSequence = count + 1;
  return {
    runSequence,
    phase: runSequence <= REVIEW_ONLY_RUN_COUNT ? "review_only" : "auto_apply_allowlist",
  };
}

function isValidJstDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00+09:00`));
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** 木曜10:00 JST run日を末日とする、直近7日間(trailing)のJST週窓を返す。 */
export function weekWindowForRunDate(jstRunDate: string): { weekStartDate: string; weekEndDate: string } {
  if (!isValidJstDate(jstRunDate)) throw new Error(`weekWindowForRunDate: invalid date ${jstRunDate}`);
  return {
    weekStartDate: addDaysToIsoDate(jstRunDate, -6),
    weekEndDate: jstRunDate,
  };
}

export function buildFindingKey(parts: Array<string | number | null | undefined>): string {
  const normalized = parts.map((part) => (part === null || part === undefined ? "" : String(part))).join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// --- balance_delta ---------------------------------------------------------

export type WalletableForAudit = {
  id: string | number;
  type: string;
  name: string | null;
  lastBalance: number | null; // freee: last_balance（freee帳簿残高）
  walletableBalance: number | null; // freee: walletable_balance（登録/同期残高）
  syncStatus: string | null;
  lastSyncedAt: string | null; // ISO
};

const SYNC_FAILURE_STATUSES = new Set(["error", "expired", "disconnected", "failed"]);

/**
 * 口座ごとの freee帳簿残高(last_balance) と 登録/同期残高(walletable_balance) の差を検出する。
 * 残高差の直接補正は絶対に自動化しない — このfindingは常にeligibleForAutoApply=falseで固定する。
 */
export function detectBalanceDeltas(walletables: WalletableForAudit[], toleranceYen = 0): Finding[] {
  const findings: Finding[] = [];
  for (const w of walletables) {
    if (w.lastBalance == null || w.walletableBalance == null) continue;
    const delta = yen(w.lastBalance) - yen(w.walletableBalance);
    if (Math.abs(delta) <= toleranceYen) continue;
    findings.push({
      findingKey: buildFindingKey(["balance_delta", w.type, w.id]),
      findingType: "balance_delta",
      severity: Math.abs(delta) >= 10_000 ? "blocker" : "warn",
      walletableType: w.type,
      walletableId: String(w.id),
      walletableName: w.name,
      freeeEntityType: "walletable",
      freeeEntityId: String(w.id),
      memberId: null,
      amountYen: yen(w.walletableBalance),
      deltaYen: delta,
      occurredOn: null,
      title: `${w.name ?? w.type}: 登録残高とfreee同期残高に差分`,
      summaryJa: `freee帳簿残高 ${yen(w.lastBalance).toLocaleString("ja-JP")}円 に対し、登録/同期残高 ${yen(w.walletableBalance).toLocaleString("ja-JP")}円。差額 ${delta.toLocaleString("ja-JP")}円。`,
      decisionReasonJa: "残高差は原因（未取込明細・時点ズレ・freee同期遅延等）を人が特定するまで自動補正しない。",
      matchConfidence: "ambiguous",
      eligibleForAutoApply: false,
      evidence: { walletableId: w.id, walletableType: w.type, lastBalance: w.lastBalance, walletableBalance: w.walletableBalance },
    });
  }
  return findings;
}

/** 口座同期の停止・古さを検出する。 */
export function detectSyncIssues(
  walletables: WalletableForAudit[],
  nowIso: string,
  staleDaysThreshold = 3
): Finding[] {
  const now = new Date(nowIso).getTime();
  const findings: Finding[] = [];
  for (const w of walletables) {
    const statusFailed = w.syncStatus != null && SYNC_FAILURE_STATUSES.has(String(w.syncStatus).toLowerCase());
    const lastSyncedMs = w.lastSyncedAt ? new Date(w.lastSyncedAt).getTime() : null;
    const staleDays = lastSyncedMs != null && Number.isFinite(lastSyncedMs)
      ? Math.floor((now - lastSyncedMs) / 86_400_000)
      : null;
    const isStale = staleDays != null && staleDays >= staleDaysThreshold;
    if (!statusFailed && !isStale && lastSyncedMs != null) continue;
    findings.push({
      findingKey: buildFindingKey(["sync_stale", w.type, w.id]),
      findingType: "sync_stale",
      severity: statusFailed ? "blocker" : "warn",
      walletableType: w.type,
      walletableId: String(w.id),
      walletableName: w.name,
      freeeEntityType: "walletable",
      freeeEntityId: String(w.id),
      memberId: null,
      amountYen: null,
      deltaYen: null,
      occurredOn: null,
      title: `${w.name ?? w.type}: 口座同期が${statusFailed ? "停止" : "古い"}`,
      summaryJa: statusFailed
        ? `sync_status=${w.syncStatus}。freee側の口座同期が失敗/停止している。`
        : `最終同期 ${w.lastSyncedAt ?? "不明"}（${staleDays ?? "?"}日前）。同期が滞っている可能性。`,
      decisionReasonJa: "口座同期の停止・古さは、この後の残高差・未処理明細検出の前提が崩れるため必ずレビュー対象にする。",
      matchConfidence: "ambiguous",
      eligibleForAutoApply: false,
      evidence: { syncStatus: w.syncStatus, lastSyncedAt: w.lastSyncedAt, staleDays },
    });
  }
  return findings;
}

// --- unprocessed_entry / anomalous_journal ----------------------------------

export type WalletTxnForAudit = {
  id: string | number;
  date: string; // YYYY-MM-DD
  walletableType: string;
  walletableId: string | number;
  walletableName: string | null;
  amountYen: number;
  direction: "income" | "expense" | null;
  dealId: string | number | null;
  transferId: string | number | null;
  description: string | null;
};

/** deal/transferにも紐付いていない明細（未処理）を検出する。 */
export function detectUnprocessedEntries(
  txns: WalletTxnForAudit[],
  nowIso: string,
  minAgeDays = 3
): Finding[] {
  const now = new Date(nowIso).getTime();
  const findings: Finding[] = [];
  for (const txn of txns) {
    if (txn.dealId != null || txn.transferId != null) continue;
    if (!txn.date) continue;
    const ageDays = Math.floor((now - new Date(`${txn.date}T00:00:00+09:00`).getTime()) / 86_400_000);
    if (ageDays < minAgeDays) continue;
    findings.push({
      findingKey: buildFindingKey(["unprocessed_entry", txn.walletableType, txn.walletableId, txn.id]),
      findingType: "unprocessed_entry",
      severity: "warn",
      walletableType: txn.walletableType,
      walletableId: String(txn.walletableId),
      walletableName: txn.walletableName,
      freeeEntityType: "wallet_txn",
      freeeEntityId: String(txn.id),
      memberId: null,
      amountYen: txn.amountYen,
      deltaYen: null,
      occurredOn: txn.date,
      title: `${txn.walletableName ?? txn.walletableType}: 未処理の明細（${ageDays}日経過）`,
      summaryJa: `${txn.date} ${txn.direction ?? "?"} ${txn.amountYen.toLocaleString("ja-JP")}円「${txn.description ?? "(摘要なし)"}」がdeal/振替どちらにも未紐付け。`,
      decisionReasonJa: "勘定科目の推測で自動仕訳しない。人が内容を確認してから登録する。",
      matchConfidence: "ambiguous",
      eligibleForAutoApply: false,
      evidence: { walletTxnId: txn.id, description: txn.description, ageDays },
    });
  }
  return findings;
}

export type ManualJournalDetailForAudit = {
  entrySide: "debit" | "credit" | string;
  accountItemId: string | number | null;
  amountYen: number;
};

export type ManualJournalForAudit = {
  id: string | number;
  issueDate: string;
  txnNumber: string | null;
  details: ManualJournalDetailForAudit[];
};

/** 借方貸方が合わない・勘定科目未設定・金額0など、明らかにおかしい仕訳を検出する。 */
export function detectAnomalousJournals(journals: ManualJournalForAudit[]): Finding[] {
  const findings: Finding[] = [];
  for (const journal of journals) {
    const debit = journal.details.filter((d) => d.entrySide === "debit").reduce((s, d) => s + yen(d.amountYen), 0);
    const credit = journal.details.filter((d) => d.entrySide === "credit").reduce((s, d) => s + yen(d.amountYen), 0);
    const missingAccountItem = journal.details.some((d) => d.accountItemId == null);
    const zeroAmount = journal.details.some((d) => yen(d.amountYen) === 0);
    const unbalanced = debit !== credit;
    if (!missingAccountItem && !zeroAmount && !unbalanced) continue;
    const reasons = [
      unbalanced ? `貸借不一致(借方${debit}円/貸方${credit}円)` : null,
      missingAccountItem ? "勘定科目未設定の明細行あり" : null,
      zeroAmount ? "金額0円の明細行あり" : null,
    ].filter((r): r is string => Boolean(r));
    findings.push({
      findingKey: buildFindingKey(["anomalous_journal", journal.id]),
      findingType: "anomalous_journal",
      severity: unbalanced ? "blocker" : "warn",
      walletableType: null,
      walletableId: null,
      walletableName: null,
      freeeEntityType: "manual_journal",
      freeeEntityId: String(journal.id),
      memberId: null,
      amountYen: Math.max(debit, credit),
      deltaYen: debit - credit,
      occurredOn: journal.issueDate,
      title: `振替伝票 ${journal.txnNumber ?? journal.id}: ${reasons[0]}`,
      summaryJa: reasons.join(" / "),
      decisionReasonJa: "変な仕訳は自動修正せず、freee上で人が確認・訂正するまでblocker扱いにする。",
      matchConfidence: "ambiguous",
      eligibleForAutoApply: false,
      evidence: { journalId: journal.id, debit, credit, reasons },
    });
  }
  return findings;
}

// --- officer_compensation_unreconciled --------------------------------------

export type OfficerExpectedCompensation = {
  memberId: string;
  memberName: string;
  projectId: string;
  projectName: string;
  sourceYm: string;
  amountYen: number;
};

/**
 * AMD OS側で確定している役員報酬期待額（members.is_officer + billing_cycles.reward_summary_json）
 * に対し、freee側で消込済み（役員報酬account_itemへ分類済み）のexpense wallet_txnが
 * 存在するかを突き合わせる。氏名の曖昧一致だけでは自動確定しない — 金額の完全一致でのみ判定する。
 */
export function detectOfficerCompensationFindings(
  expected: OfficerExpectedCompensation[],
  candidateTxns: WalletTxnForAudit[]
): Finding[] {
  const expenseCandidates = candidateTxns.filter((t) => t.direction === "expense" && t.dealId == null);
  const findings: Finding[] = [];

  for (const officer of expected) {
    const matches = expenseCandidates.filter((t) => t.amountYen === officer.amountYen);
    if (matches.length === 1) {
      // 同額を求める他の役員がいないか確認する（分割/手数料混在ではなく、単に"同額"の別人がいるケース）。
      const otherOfficersWithSameAmount = expected.filter(
        (o) => o !== officer && o.amountYen === officer.amountYen
      );
      const ambiguousAcrossOfficers = otherOfficersWithSameAmount.length > 0;
      findings.push({
        findingKey: buildFindingKey(["officer_compensation_unreconciled", officer.memberId, officer.projectId, officer.sourceYm]),
        findingType: "officer_compensation_unreconciled",
        severity: "warn",
        walletableType: matches[0].walletableType,
        walletableId: String(matches[0].walletableId),
        walletableName: matches[0].walletableName,
        freeeEntityType: "wallet_txn",
        freeeEntityId: String(matches[0].id),
        memberId: officer.memberId,
        amountYen: officer.amountYen,
        deltaYen: 0,
        occurredOn: matches[0].date,
        title: `${officer.memberName}の役員報酬: freee明細と一致候補あり（未消込）`,
        summaryJa: `${officer.projectName} ${officer.sourceYm} 分 ${officer.amountYen.toLocaleString("ja-JP")}円に、${matches[0].date}の明細1件が金額完全一致。`,
        decisionReasonJa: ambiguousAcrossOfficers
          ? "金額が同じ他の役員がいるため、単独一致でも自動反映しない。"
          : "単一の完全一致候補。5回目以降のrunでのみ自動反映の対象になりうる。",
        matchConfidence: ambiguousAcrossOfficers ? "ambiguous" : "exact",
        eligibleForAutoApply: !ambiguousAcrossOfficers,
        evidence: { walletTxnId: matches[0].id, amountYen: officer.amountYen, candidateCount: matches.length },
      });
    } else {
      findings.push({
        findingKey: buildFindingKey(["officer_compensation_unreconciled", officer.memberId, officer.projectId, officer.sourceYm]),
        findingType: "officer_compensation_unreconciled",
        severity: "warn",
        walletableType: null,
        walletableId: null,
        walletableName: null,
        freeeEntityType: null,
        freeeEntityId: null,
        memberId: officer.memberId,
        amountYen: officer.amountYen,
        deltaYen: null,
        occurredOn: null,
        title: `${officer.memberName}の役員報酬: ${matches.length === 0 ? "一致明細なし" : "同額候補が複数"}`,
        summaryJa:
          matches.length === 0
            ? `${officer.projectName} ${officer.sourceYm} 分 ${officer.amountYen.toLocaleString("ja-JP")}円に一致するfreee明細が見つからない。未払いまたは別期間の可能性。`
            : `${officer.projectName} ${officer.sourceYm} 分 ${officer.amountYen.toLocaleString("ja-JP")}円に一致するfreee明細が${matches.length}件あり、どれか一意に決められない。`,
        decisionReasonJa: "同額複数候補・0件は必ずレビュー対象にする。分割・手数料混在・時期ズレの可能性を人が確認する。",
        matchConfidence: "ambiguous",
        eligibleForAutoApply: false,
        evidence: { candidateCount: matches.length, candidateTxnIds: matches.map((m) => m.id) },
      });
    }
  }
  return findings;
}

// --- internal_transfer_candidate ---------------------------------------------

/**
 * 双方口座がAMD OS/freeeで特定済みの、未紐付け内部振替候補を検出する。
 * 同額・同日(または許容日差以内)のexpense/income対（別walletable）だけを対象にする。
 * 完全一致（同額・同日・1対1）のときだけeligibleForAutoApply=trueにする。
 */
export function detectInternalTransferCandidates(
  txns: WalletTxnForAudit[],
  allowedDayDiffDays = 1
): Finding[] {
  const orphanExpense = txns.filter((t) => t.direction === "expense" && t.dealId == null && t.transferId == null);
  const orphanIncome = txns.filter((t) => t.direction === "income" && t.dealId == null && t.transferId == null);
  const findings: Finding[] = [];
  const usedIncomeIds = new Set<string>();

  for (const expense of orphanExpense) {
    const candidates = orphanIncome.filter((income) => {
      if (String(income.walletableId) === String(expense.walletableId) && income.walletableType === expense.walletableType) return false;
      if (income.amountYen !== expense.amountYen) return false;
      const dayDiff = Math.abs(
        (new Date(`${income.date}T00:00:00+09:00`).getTime() - new Date(`${expense.date}T00:00:00+09:00`).getTime()) / 86_400_000
      );
      return dayDiff <= allowedDayDiffDays;
    });
    if (candidates.length === 0) continue;
    const unusedCandidates = candidates.filter((c) => !usedIncomeIds.has(String(c.id)));
    const sameDay = unusedCandidates.filter((c) => c.date === expense.date);
    const isExact = unusedCandidates.length === 1 && sameDay.length === 1;
    const chosen = unusedCandidates[0];
    if (isExact) usedIncomeIds.add(String(chosen.id));

    findings.push({
      findingKey: buildFindingKey(["internal_transfer_candidate", expense.walletableType, expense.walletableId, expense.id]),
      findingType: "internal_transfer_candidate",
      severity: "warn",
      walletableType: expense.walletableType,
      walletableId: String(expense.walletableId),
      walletableName: expense.walletableName,
      freeeEntityType: "wallet_txn",
      freeeEntityId: String(expense.id),
      memberId: null,
      amountYen: expense.amountYen,
      deltaYen: 0,
      occurredOn: expense.date,
      title: `${expense.walletableName ?? expense.walletableType} → ${chosen.walletableName ?? chosen.walletableType}: 内部振替候補`,
      summaryJa: `${expense.date} ${expense.amountYen.toLocaleString("ja-JP")}円の出金が、${chosen.date}の${chosen.walletableName ?? chosen.walletableType}への入金${unusedCandidates.length}件と対応しうる。`,
      decisionReasonJa: isExact
        ? "同額・同日・双方口座特定済みの単一対応。5回目以降のrunでのみ自動反映の対象になりうる。"
        : "候補が複数、または日差があるため自動反映しない。",
      matchConfidence: isExact ? "exact" : "ambiguous",
      eligibleForAutoApply: isExact,
      evidence: {
        expenseTxnId: expense.id,
        candidateIncomeTxnIds: unusedCandidates.map((c) => c.id),
        counterpartWalletableId: chosen.walletableId,
        counterpartTxnId: chosen.id,
      },
    });
  }
  return findings;
}

// --- executor decision -------------------------------------------------------

export type ActionType = "officer_compensation_reconcile" | "internal_transfer_reconcile";

/**
 * その action type を、freee公式APIで安全に（二重計上せず）表現できるか。
 * internal_transfer は、既存wallet_txnを事後的にtransferとして正式リンクする公開APIが無く
 * (transfer_idを外部から設定する手段がない)、manual_journal代替は二重計上リスクを排除できないため
 * 常にfalse固定にする。officer_compensationはwallet_txnのaccount_item_id更新（明細分類）で
 * 二重計上を発生させずに表現できる。
 */
export function isActionTypeSafelyExecutable(actionType: ActionType): boolean {
  if (actionType === "internal_transfer_reconcile") return false;
  return actionType === "officer_compensation_reconcile";
}

export type ExecutorDecision = {
  mode: "would_execute" | "dry_run" | "blocked";
  blockedReason: string | null;
};

/**
 * phase・finding適格性・action typeの安全性・env opt-inから、実行方針を決める純関数。
 * writesEnabled は呼び出し側がfreee書込用の明示的env killswitchを見て渡す。
 */
export function decideExecutorAction(params: {
  phase: RunPhase;
  finding: Pick<Finding, "findingType" | "eligibleForAutoApply" | "matchConfidence">;
  actionType: ActionType;
  dryRun: boolean;
  writesEnabled: boolean;
}): ExecutorDecision {
  const { phase, finding, actionType, dryRun, writesEnabled } = params;
  if (!finding.eligibleForAutoApply || finding.matchConfidence !== "exact") {
    return { mode: "blocked", blockedReason: "finding is not an exact, unambiguous auto-apply candidate" };
  }
  if (phase !== "auto_apply_allowlist") {
    return { mode: "blocked", blockedReason: "review-only phase (first 4 successful cron runs) — no auto-apply yet" };
  }
  if (!isActionTypeSafelyExecutable(actionType)) {
    return {
      mode: "blocked",
      blockedReason:
        actionType === "internal_transfer_reconcile"
          ? "freee APIには既存wallet_txnを内部振替として事後的に正式リンクする公開エンドポイントが無く、manual_journal代替は二重計上リスクを排除できないため書き込みを行わない"
          : "action type has no verified safe freee write endpoint",
    };
  }
  if (dryRun) return { mode: "dry_run", blockedReason: null };
  if (!writesEnabled) {
    return {
      mode: "blocked",
      blockedReason: "FREEE_RECONCILIATION_WRITES_ENABLED is not set — explicit env opt-in required even in the auto-apply phase",
    };
  }
  return { mode: "would_execute", blockedReason: null };
}
