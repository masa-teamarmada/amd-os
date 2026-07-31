import { createHash } from "node:crypto";

/**
 * 週次freee会計照合の純関数エンジン。
 * I/O（Supabase / freee API / Google Sheets）を一切持たない。cron routeがfreee/DBから取得した
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

/** YYYY-MM-DD → YYYYMM。役員報酬照合の対象月（run日を含む月）を求めるのに使う。 */
export function ymFromIsoDate(isoDate: string): string {
  if (!isValidJstDate(isoDate)) throw new Error(`ymFromIsoDate: invalid date ${isoDate}`);
  return `${isoDate.slice(0, 4)}${isoDate.slice(5, 7)}`;
}

function dateYm(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  return match ? `${match[1]}${match[2]}` : null;
}

export function buildFindingKey(parts: Array<string | number | null | undefined>): string {
  const normalized = parts.map((part) => (part === null || part === undefined ? "" : String(part))).join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// --- stale-running run recovery --------------------------------------------

/**
 * cronがrunningのまま落ちた場合の再開判定。staleThresholdMinutes(既定30分)を超えるrunningは
 * クラッシュとみなして同じrunを安全に再開してよい。それ以内は本当に並行実行中の可能性があるため
 * skipする。
 */
export function isRunStale(startedAtIso: string, nowIso: string, staleThresholdMinutes = 30): boolean {
  const startedAt = new Date(startedAtIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  return now - startedAt > staleThresholdMinutes * 60_000;
}

// --- balance_delta -----------------------------------------------------------

export type WalletableForAudit = {
  id: string | number;
  type: string;
  name: string | null;
  /** freee `last_balance` — 銀行同期の実残高（同期残高）。 */
  syncedBalance: number | null;
  /** freee `walletable_balance` — freee帳簿上の登録残高。 */
  registeredBalance: number | null;
  syncStatus: string | null;
  lastSyncedAt: string | null; // ISO
};

const SYNC_FAILURE_STATUSES = new Set(["error", "expired", "disconnected", "failed"]);

/**
 * 口座ごとの freee登録残高(walletable_balance) と 銀行同期残高(last_balance) の差を検出する。
 * 残高差の直接補正は絶対に自動化しない — このfindingは常にeligibleForAutoApply=falseで固定する。
 */
export function detectBalanceDeltas(walletables: WalletableForAudit[], toleranceYen = 0): Finding[] {
  const findings: Finding[] = [];
  for (const w of walletables) {
    if (w.registeredBalance == null || w.syncedBalance == null) continue;
    const delta = yen(w.registeredBalance) - yen(w.syncedBalance);
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
      amountYen: yen(w.registeredBalance),
      deltaYen: delta,
      occurredOn: null,
      title: `${w.name ?? w.type}: 登録残高と銀行同期残高に差分`,
      summaryJa: `freee登録残高(walletable_balance) ${yen(w.registeredBalance).toLocaleString("ja-JP")}円 に対し、銀行同期残高(last_balance) ${yen(w.syncedBalance).toLocaleString("ja-JP")}円。差額 ${delta.toLocaleString("ja-JP")}円。`,
      decisionReasonJa: "残高差は原因（未取込明細・時点ズレ・freee同期遅延等）を人が特定するまで自動補正しない。",
      matchConfidence: "ambiguous",
      eligibleForAutoApply: false,
      evidence: { walletableId: w.id, walletableType: w.type, syncedBalance: w.syncedBalance, registeredBalance: w.registeredBalance },
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
//
// 役員報酬期待額の正本は billing_cycles.reward_summary_json（PJ報酬reserve）ではなく、
// company_finance_recurring_items の item_kind='salary' または category='executive' の
// 明示分類（pwa/manual/4-5 の契約）。member紐付けは payload.memberId / payload.member_id の
// 明示指定を最優先し、無ければ表示名/支払先とmember_name/code_nameの一意一致を
// レビュー候補として扱うが、その一致だけではauto eligibleにしない（氏名の曖昧一致で自動確定しない）。

export type OfficerForMatching = {
  memberId: string;
  memberName: string;
  codeName: string;
};

export type RecurringItemForMatching = {
  id: string;
  displayName: string | null;
  vendorName: string | null;
  amountYen: number;
  frequency: string | null;
  withdrawalAccount: string | null;
  /** company_finance_recurring_items.payload.memberId / member_id が officer の member_id と一致する場合のみ設定 */
  explicitMemberId: string | null;
};

export type MappingStatus = "explicit" | "explicit_conflict" | "name_match_single" | "name_match_ambiguous" | "missing";

export type OfficerRecurringMapping = {
  memberId: string;
  memberName: string;
  codeName: string;
  mappingStatus: MappingStatus;
  recurringItemId: string | null;
  candidateRecurringItemIds: string[];
  amountYen: number | null;
  frequency: string | null;
  withdrawalAccount: string | null;
  displayName: string | null;
  vendorName: string | null;
};

function normalizeNameToken(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[ 　\t\r\n]/g, "")
    .trim();
}

/**
 * 全active役員 × company_finance_recurring_items(salary/executive) の紐付けを決める純関数。
 * 明示mapping(payload.memberId)を最優先。無ければ表示名/支払先の一意一致だけを
 * name_match_singleとして候補にする（2件以上一致・conflict・0件はambiguous/missingにする）。
 */
export function buildOfficerRecurringMappings(
  officers: OfficerForMatching[],
  items: RecurringItemForMatching[]
): OfficerRecurringMapping[] {
  const explicitByMember = new Map<string, RecurringItemForMatching[]>();
  for (const item of items) {
    if (!item.explicitMemberId) continue;
    const list = explicitByMember.get(item.explicitMemberId) ?? [];
    list.push(item);
    explicitByMember.set(item.explicitMemberId, list);
  }
  const itemsWithoutExplicit = items.filter((i) => !i.explicitMemberId);

  return officers.map((officer): OfficerRecurringMapping => {
    const base = { memberId: officer.memberId, memberName: officer.memberName, codeName: officer.codeName };
    const explicitItems = explicitByMember.get(officer.memberId) ?? [];

    if (explicitItems.length === 1) {
      const item = explicitItems[0];
      return {
        ...base,
        mappingStatus: "explicit",
        recurringItemId: item.id,
        candidateRecurringItemIds: [item.id],
        amountYen: item.amountYen,
        frequency: item.frequency,
        withdrawalAccount: item.withdrawalAccount,
        displayName: item.displayName,
        vendorName: item.vendorName,
      };
    }
    if (explicitItems.length > 1) {
      return {
        ...base,
        mappingStatus: "explicit_conflict",
        recurringItemId: null,
        candidateRecurringItemIds: explicitItems.map((i) => i.id),
        amountYen: null,
        frequency: null,
        withdrawalAccount: null,
        displayName: null,
        vendorName: null,
      };
    }

    const officerTokens = new Set(
      [normalizeNameToken(officer.memberName), normalizeNameToken(officer.codeName)].filter((t) => t.length > 0)
    );
    const nameMatches = itemsWithoutExplicit.filter((item) => {
      const displayTok = normalizeNameToken(item.displayName);
      const vendorTok = normalizeNameToken(item.vendorName);
      return (displayTok.length > 0 && officerTokens.has(displayTok)) || (vendorTok.length > 0 && officerTokens.has(vendorTok));
    });

    if (nameMatches.length === 1) {
      const item = nameMatches[0];
      return {
        ...base,
        mappingStatus: "name_match_single",
        recurringItemId: item.id,
        candidateRecurringItemIds: [item.id],
        amountYen: item.amountYen,
        frequency: item.frequency,
        withdrawalAccount: item.withdrawalAccount,
        displayName: item.displayName,
        vendorName: item.vendorName,
      };
    }
    if (nameMatches.length > 1) {
      return {
        ...base,
        mappingStatus: "name_match_ambiguous",
        recurringItemId: null,
        candidateRecurringItemIds: nameMatches.map((i) => i.id),
        amountYen: null,
        frequency: null,
        withdrawalAccount: null,
        displayName: null,
        vendorName: null,
      };
    }
    return {
      ...base,
      mappingStatus: "missing",
      recurringItemId: null,
      candidateRecurringItemIds: [],
      amountYen: null,
      frequency: null,
      withdrawalAccount: null,
      displayName: null,
      vendorName: null,
    };
  });
}

function withdrawalAccountMatches(configured: string | null, walletableName: string | null): boolean {
  const a = normalizeNameToken(configured);
  if (a.length === 0) return true; // 未設定なら条件をスキップ
  const b = normalizeNameToken(walletableName);
  if (b.length === 0) return false;
  return a.includes(b) || b.includes(a);
}

function hasMatchingDescriptionToken(description: string | null, tokens: Array<string | null | undefined>, minLength = 2): boolean {
  const desc = normalizeNameToken(description);
  if (desc.length === 0) return false;
  return tokens
    .map((t) => normalizeNameToken(t))
    .filter((t) => t.length >= minLength)
    .some((t) => desc.includes(t));
}

const MAPPING_ISSUE_LABEL: Record<Exclude<MappingStatus, "explicit" | "name_match_single">, string> = {
  missing: "紐付くrecurring itemが無い",
  explicit_conflict: "複数のrecurring itemが同じ役員を明示指定していて曖昧",
  name_match_ambiguous: "表示名/支払先が複数のrecurring itemと一致して曖昧",
};

/**
 * 役員報酬の未消込を検出する。mapping自体が無い/曖昧な役員は即blocker。
 * 解決済みmapping（explicit or name_match_single）は当該支払月内のexpense明細と、
 * 金額完全一致・withdrawal_account一致（設定時）・description token一致を突き合わせる。
 * deal紐付け済みの単一候補だけなら解消済みとしてfindingを出さない。transfer紐付けや
 * deal済み/未処理の重複があれば、誤消込・二重支払いの可能性としてblockerにする。
 * eligibleForAutoApply=trueになるのは mappingStatus==='explicit' かつ単一exact一致かつ
 * 他役員との金額衝突が無いときだけ（氏名一致だけのname_match_singleは常にauto対象外）。
 */
export function detectOfficerCompensationFindings(
  mappings: OfficerRecurringMapping[],
  candidateTxns: WalletTxnForAudit[],
  targetYm: string
): Finding[] {
  const monthExpenseTxns = candidateTxns.filter((t) => t.direction === "expense" && dateYm(t.date) === targetYm);
  const resolvedMappings = mappings.filter((m) => m.mappingStatus === "explicit" || m.mappingStatus === "name_match_single");
  const findings: Finding[] = [];

  for (const mapping of mappings) {
    if (mapping.mappingStatus !== "explicit" && mapping.mappingStatus !== "name_match_single") {
      const issueKey = mapping.mappingStatus as Exclude<MappingStatus, "explicit" | "name_match_single">;
      findings.push({
        findingKey: buildFindingKey(["officer_compensation_unreconciled", mapping.memberId, targetYm]),
        findingType: "officer_compensation_unreconciled",
        severity: "blocker",
        walletableType: null,
        walletableId: null,
        walletableName: null,
        freeeEntityType: null,
        freeeEntityId: null,
        memberId: mapping.memberId,
        amountYen: null,
        deltaYen: null,
        occurredOn: null,
        title: `${mapping.memberName}の役員報酬: ${MAPPING_ISSUE_LABEL[issueKey]}`,
        summaryJa: `company_finance_recurring_items（item_kind='salary' または category='executive'）から ${mapping.memberName} への紐付けが確定できない（${mapping.mappingStatus}、候補${mapping.candidateRecurringItemIds.length}件）。`,
        decisionReasonJa: "recurring itemの紐付けが無い/曖昧な役員は、金額突き合わせの前に必ず人が確認する。",
        matchConfidence: "ambiguous",
        eligibleForAutoApply: false,
        evidence: { mappingStatus: mapping.mappingStatus, candidateRecurringItemIds: mapping.candidateRecurringItemIds },
      });
      continue;
    }

    const matchingTxns = monthExpenseTxns.filter(
      (t) =>
        t.amountYen === mapping.amountYen &&
        t.walletableName != null &&
        withdrawalAccountMatches(mapping.withdrawalAccount, t.walletableName) &&
        hasMatchingDescriptionToken(t.description, [mapping.memberName, mapping.codeName, mapping.vendorName, mapping.displayName])
    );
    const reconciledDealTxns = matchingTxns.filter((t) => t.dealId != null && t.transferId == null);
    const transferLinkedTxns = matchingTxns.filter((t) => t.transferId != null);
    const candidates = matchingTxns.filter((t) => t.dealId == null && t.transferId == null);
    const crossOfficerCollision = resolvedMappings.some((other) => other !== mapping && other.amountYen === mapping.amountYen);
    const isSingleCandidate = candidates.length === 1;
    const isExplicit = mapping.mappingStatus === "explicit";
    const eligible = isSingleCandidate && !crossOfficerCollision && isExplicit;

    if (reconciledDealTxns.length === 1 && transferLinkedTxns.length === 0 && candidates.length === 0) {
      continue;
    }

    if (reconciledDealTxns.length > 0 || transferLinkedTxns.length > 0) {
      const reasons = [
        reconciledDealTxns.length > 1 ? `deal紐付け済み明細が${reconciledDealTxns.length}件` : null,
        reconciledDealTxns.length === 1 && candidates.length > 0 ? `deal紐付け済み1件と未処理${candidates.length}件が重複` : null,
        transferLinkedTxns.length > 0 ? `内部振替扱いの明細が${transferLinkedTxns.length}件` : null,
      ].filter((reason): reason is string => Boolean(reason));
      findings.push({
        findingKey: buildFindingKey(["officer_compensation_unreconciled", mapping.memberId, targetYm]),
        findingType: "officer_compensation_unreconciled",
        severity: "blocker",
        walletableType: null,
        walletableId: null,
        walletableName: null,
        freeeEntityType: null,
        freeeEntityId: null,
        memberId: mapping.memberId,
        amountYen: mapping.amountYen,
        deltaYen: null,
        occurredOn: null,
        title: `${mapping.memberName}の役員報酬: 消込状態が競合`,
        summaryJa: `${targetYm} 分 ${mapping.amountYen?.toLocaleString("ja-JP")}円について、${reasons.join(" / ")}。`,
        decisionReasonJa: "消込済み明細と未処理明細の重複、または内部振替扱いは、誤分類・二重支払いの可能性があるため自動処理しない。",
        matchConfidence: "ambiguous",
        eligibleForAutoApply: false,
        evidence: {
          mappingStatus: mapping.mappingStatus,
          reconciledDealTxnIds: reconciledDealTxns.map((t) => t.id),
          transferLinkedTxnIds: transferLinkedTxns.map((t) => t.id),
          unresolvedTxnIds: candidates.map((t) => t.id),
        },
      });
      continue;
    }

    if (isSingleCandidate) {
      const match = candidates[0];
      findings.push({
        findingKey: buildFindingKey(["officer_compensation_unreconciled", mapping.memberId, targetYm]),
        findingType: "officer_compensation_unreconciled",
        severity: "warn",
        walletableType: match.walletableType,
        walletableId: String(match.walletableId),
        walletableName: match.walletableName,
        freeeEntityType: "wallet_txn",
        freeeEntityId: String(match.id),
        memberId: mapping.memberId,
        amountYen: mapping.amountYen,
        deltaYen: 0,
        occurredOn: match.date,
        title: `${mapping.memberName}の役員報酬: freee明細と一致候補あり（未消込）`,
        summaryJa: `${targetYm} 分 ${mapping.amountYen?.toLocaleString("ja-JP")}円に、${match.date}の明細1件が完全一致（口座・金額・摘要トークン・deal/振替未紐付けの全条件を満たす）。`,
        decisionReasonJa: crossOfficerCollision
          ? "金額が同じ他役員のrecurring itemがあるため、単独一致でも自動反映しない。"
          : isExplicit
            ? "mapping=explicit・単一の完全一致候補。将来、安全な公式endpointが確認できればauto-apply対象になりうる。"
            : "member紐付けが氏名一致（name_match_single）由来のため、金額が一致してもauto-apply対象にしない。",
        matchConfidence: eligible ? "exact" : "high",
        eligibleForAutoApply: eligible,
        evidence: { walletTxnId: match.id, amountYen: mapping.amountYen, mappingStatus: mapping.mappingStatus, candidateCount: candidates.length },
      });
    } else {
      findings.push({
        findingKey: buildFindingKey(["officer_compensation_unreconciled", mapping.memberId, targetYm]),
        findingType: "officer_compensation_unreconciled",
        severity: "warn",
        walletableType: null,
        walletableId: null,
        walletableName: null,
        freeeEntityType: null,
        freeeEntityId: null,
        memberId: mapping.memberId,
        amountYen: mapping.amountYen,
        deltaYen: null,
        occurredOn: null,
        title: `${mapping.memberName}の役員報酬: ${candidates.length === 0 ? "一致明細なし" : "一致候補が複数"}`,
        summaryJa:
          candidates.length === 0
            ? `${targetYm} 分 ${mapping.amountYen?.toLocaleString("ja-JP")}円（口座・摘要トークン・deal/振替未紐付けを含む全条件）に一致するfreee明細が見つからない。未払いまたは条件不一致の可能性。`
            : `${targetYm} 分 ${mapping.amountYen?.toLocaleString("ja-JP")}円に一致するfreee明細が${candidates.length}件あり、どれか一意に決められない。`,
        decisionReasonJa: "同額複数候補・0件は必ずレビュー対象にする。分割・手数料混在・時期ズレ・摘要不一致の可能性を人が確認する。",
        matchConfidence: "ambiguous",
        eligibleForAutoApply: false,
        evidence: { candidateCount: candidates.length, candidateTxnIds: candidates.map((m) => m.id), mappingStatus: mapping.mappingStatus },
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
    const sameDay = candidates.filter((c) => c.date === expense.date);
    const chosen = sameDay[0] ?? candidates[0];
    const reciprocalExpenses = orphanExpense.filter((otherExpense) => {
      if (String(otherExpense.walletableId) === String(chosen.walletableId) && otherExpense.walletableType === chosen.walletableType) return false;
      if (otherExpense.amountYen !== chosen.amountYen) return false;
      const dayDiff = Math.abs(
        (new Date(`${chosen.date}T00:00:00+09:00`).getTime() - new Date(`${otherExpense.date}T00:00:00+09:00`).getTime()) / 86_400_000
      );
      return dayDiff <= allowedDayDiffDays;
    });
    const isExact = candidates.length === 1 && sameDay.length === 1 && reciprocalExpenses.length === 1;

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
      summaryJa: `${expense.date} ${expense.amountYen.toLocaleString("ja-JP")}円の出金が、${chosen.date}の${chosen.walletableName ?? chosen.walletableType}への入金${candidates.length}件と対応しうる。`,
      decisionReasonJa: isExact
        ? "同額・同日・双方口座特定済みの単一対応。ただしfreee書込みは常にblocked固定（下記executor参照）。"
        : "候補が複数、または日差があるため自動反映しない。",
      matchConfidence: isExact ? "exact" : "ambiguous",
      eligibleForAutoApply: isExact,
      evidence: {
        expenseTxnId: expense.id,
        candidateIncomeTxnIds: candidates.map((c) => c.id),
        reciprocalExpenseTxnIds: reciprocalExpenses.map((c) => c.id),
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
 * その action type を、freee公式APIで安全に（二重計上せず、かつ意味論が検証済みの形で）
 * 表現できるか。2026-07時点でどちらもfalse固定:
 * - internal_transfer: 既存wallet_txnを事後的にtransferとして正式リンクする公開APIが無く
 *   (transfer_idを外部から設定する手段がない)、manual_journal代替は二重計上リスクを排除できない。
 * - officer_compensation: wallet_txnのaccount_item_id更新が「消込」を正しく表現することが
 *   公式に検証できていない。freee/freee-api-schema#541はwallet_txnの「処理済み/無視」状態を
 *   変更するAPIが無いことを確認しているのみで、account_item_id更新の意味論（二重計上しないか、
 *   実際に消込として扱われるか）は未検証。安全な公式endpointが確認できるまでは書き込まない。
 */
export function isActionTypeSafelyExecutable(actionType: ActionType): boolean {
  void actionType;
  return false;
}

export type ExecutorDecision = {
  mode: "would_execute" | "dry_run" | "blocked";
  blockedReason: string | null;
};

const NO_SAFE_ENDPOINT_REASON: Record<ActionType, string> = {
  internal_transfer_reconcile:
    "freee APIには既存wallet_txnを内部振替として事後的に正式リンクする公開エンドポイントが無く、manual_journal代替は二重計上リスクを排除できないため書き込みを行わない",
  officer_compensation_reconcile:
    "wallet_txnのaccount_item_id更新が「役員報酬の消込」を正しく表現することを公式に検証できていない（freee/freee-api-schema#541は消込状態変更APIの不在のみ確認、account_item_id更新の意味論は未検証）ため、安全な公式endpointが確認できるまで書き込みを行わない",
};

/**
 * phase・finding適格性・action typeの安全性・env opt-inから、実行方針を決める純関数。
 * writesEnabled は呼び出し側がfreee書込用の明示的env killswitchを見て渡す。
 * 2026-07時点ではisActionTypeSafelyExecutableが両typeともfalse固定のため、
 * このプロジェクト全体を通してmodeが"would_execute"になることはない
 * （安全な公式endpointが確認・実装されるまでの意図的な制約）。
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
    return { mode: "blocked", blockedReason: NO_SAFE_ENDPOINT_REASON[actionType] };
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

// --- read-only reference sheet snapshot (きよの収支スプシ) --------------------
//
// 収支スプシはread-only参考資料。AMD OS/freeeへの書込みには一切使わず、正本を上書きしない。
// I/O(googleapis呼び出し)はfreee-reconciliation-client.tsに閉じ込め、ここでは
// skip判定とsanitized summary生成だけを純関数として持つ（テストでmock不要）。

export type SheetReferenceRangeSummary = { range: string; rowCount: number; nonEmptyCellCount: number };
export type SheetReferenceSnapshot =
  | { status: "skipped"; reason: string }
  | { status: "ok"; spreadsheetId: string; fetchedAt: string; ranges: SheetReferenceRangeSummary[] };

/** env未設定・Google OAuth未設定のいずれかがあれば、skip理由を返す（無ければnull）。 */
export function decideSheetReferenceSkip(params: {
  spreadsheetId: string | null;
  ranges: string[];
  hasGoogleAuth: boolean;
}): string | null {
  if (!params.spreadsheetId) return "AMD_FINANCE_REFERENCE_SHEET_ID not set";
  if (params.ranges.length === 0) return "AMD_FINANCE_REFERENCE_SHEET_RANGES not set";
  if (!params.hasGoogleAuth) return "Google OAuth not configured (GOOGLE_OAUTH_* / GOOGLE_SERVICE_ACCOUNT_JSON missing)";
  return null;
}

/** セル値そのものは保存せず、rangeごとの行数・非空セル数だけを残すsanitized summaryを作る。 */
export function summarizeSheetRangeValues(range: string, values: string[][]): SheetReferenceRangeSummary {
  const nonEmptyCellCount = values.reduce(
    (sum, row) => sum + row.filter((cell) => String(cell ?? "").trim() !== "").length,
    0
  );
  return { range, rowCount: values.length, nonEmptyCellCount };
}
