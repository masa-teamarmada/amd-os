// Pure two-lane aggregation/classification functions for the SX partner ledger, split out of
// sx-visual-shared.tsx so they can be unit-tested directly with `node --experimental-strip-types`
// (that loader does not parse JSX, so a .tsx file cannot be imported by the lightweight test scripts
// this repo uses for src/lib/*.ts). This file has no "server-only" / "use client" boundary — it is
// safe to import from both server code and client components.

import type {
  SxConfidence,
  SxDatePrecision,
  SxPartnerCommitment,
  SxPartnerRole,
  SxPartnerRoleKind,
  SxPartnerWorkItem,
  SxRelationshipState,
  SxSourceKind,
} from "./sx-management";

const WORK_ITEM_KIND_LABEL: Record<string, string> = {
  task: "タスク", question: "質問", deliverable: "成果物", decision: "意思決定", approval: "承認", response: "回答",
};

export function sxWorkItemKindLabel(kind: string) {
  return WORK_ITEM_KIND_LABEL[kind] || "項目未確認";
}

const ROLE_KIND_LABEL: Record<string, string> = {
  joint_development: "共同開発", contract_manufacturing: "製造委託", customer: "顧客", shareholder_investor: "株主・投資",
  government: "自治体", media: "メディア", financial_institution: "金融機関", university_research: "大学・研究機関",
  support_organization: "支援機関", other: "その他", unclassified: "未分類",
};

export function sxPartnerRoleKindLabel(kind: SxPartnerRoleKind) {
  return ROLE_KIND_LABEL[kind] || "未分類";
}

const RELATIONSHIP_STATE_LABEL: Record<string, string> = {
  candidate: "候補", in_progress: "進行中", established: "成立", on_hold: "保留", ended: "終了", unconfirmed: "未確認",
};

export function sxRelationshipStateLabel(state: string) {
  return RELATIONSHIP_STATE_LABEL[state] || "未確認";
}

/** Combines role + state into "共同開発先" / "共同開発候補先" for candidate/in_progress/established.
 * on_hold/ended/unconfirmed keep the bare role name — state is shown as a separate small badge there.
 * unclassified always compounds with the state ("未分類・候補" / "未分類・成立" / ...) — a bare "未分類"
 * would read as "confirmed to have no role", which is never true; the state must always be visible so
 * unclassified/candidate and unclassified/established never collapse into the same label (2026-07-24). */
export function sxRoleDisplayLabel(roleKind: SxPartnerRoleKind, state: string): string {
  const roleName = ROLE_KIND_LABEL[roleKind] || "未分類";
  if (roleKind === "unclassified") return `未分類・${sxRelationshipStateLabel(state)}`;
  if (state === "candidate") return `${roleName}候補先`;
  if (state === "in_progress" || state === "established") return `${roleName}先`;
  return roleName;
}

/** True when a partner's primary role classification is ended. Computed from partner.roles directly
 * (never from a server-derived flag) so it stays independent of deferredLowPriority (which only ever
 * reflects on_hold). ended and on_hold are separate units — a partner is never both at once, since
 * both read the same single primary role row. */
export function sxIsPartnerEnded(partner: { roles: SxPartnerRole[] }): boolean {
  return (partner.roles.find((role) => role.isPrimary)?.relationshipState || "unconfirmed") === "ended";
}

function isMissingOwnerLabel(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return !trimmed || trimmed.includes("未確認") || trimmed.includes("未設定") || trimmed.includes("未登録");
}

function addDaysStr(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type SxHoldingSide = "sx" | "partner" | "shared" | "unknown";

/** One "who holds what" row for the two-lane current-holdings view — either a work item or a still-active commitment normalized to the same shape.
 * detail/completedOn/completionEvidence/acceptedBy/acceptedOn carry the full audit trail (2026-07-24) so both the
 * open-only lane preview and the all-statuses audit listing (sxAllHoldingsForPartnerAudit) share one shape.
 * sourceEvidence and completionEvidence are deliberately separate claims (2026-07-24 P1): sourceEvidence is the
 * primary backing for the item itself (a commitment's "一次根拠" — evidence a promise exists/was made, present
 * regardless of status), while completionEvidence is proof the item is DONE (only ever populated for work items
 * that actually satisfy migration 192's completion CHECK — status=completed with a non-blank value). Commitments
 * have no distinct completion-evidence field of their own, so their completionEvidence here is always null; work
 * items have no distinct source-evidence field, so their sourceEvidence here is always null. A caller must never
 * merge the two into one "証拠" line — that's exactly the "一次根拠 displayed as 完了の証拠" bug this split fixes. */
export type SxHoldingItem = {
  id: string;
  partnerId: string;
  side: SxHoldingSide;
  itemKindLabel: string;
  title: string;
  detail: string | null;
  status: string;
  dueDate: string | null;
  dueDatePrecision: SxDatePrecision;
  ownerLabel: string | null;
  handoffTo: string | null;
  completionCriteria: string | null;
  completedOn: string | null;
  completionEvidence: string | null;
  /** Primary evidence backing the item itself (e.g. a commitment's 一次根拠) — present regardless of
   * completion status. Never conflated with completionEvidence (proof the item is done). */
  sourceEvidence: string | null;
  acceptedBy: string | null;
  acceptedOn: string | null;
  relatedMilestoneId: string | null;
  /** Provenance for the item itself — both work items and commitments carry their own source_ref
   * column, so this is always transcribed from the underlying record, never fabricated
   * (2026-07-24: 出典/最終確認/確度 audit fields normalized onto both origins). */
  sourceKind: SxSourceKind;
  sourceRef: string | null;
  lastVerifiedAt: string;
  confidence: SxConfidence;
};

const SOURCE_KIND_LABEL: Record<SxSourceKind, string> = {
  current_truth: "現在の基準情報",
  manual: "手動確認",
  imported: "取込データ",
};

export function sxSourceKindLabel(kind: SxSourceKind): string {
  return SOURCE_KIND_LABEL[kind] || "未確認";
}

/** Safe display label for a holding item's raw source_ref — never renders the raw value verbatim.
 * A raw URL is collapsed to a generic label (spec: raw URL/secretは表示しない); an internal tracking-key
 * shape like "user:2026-07-23#partner-progress" is reformatted into a short human label instead of
 * leaking the internal id/topic syntax; anything else long enough to look internal is truncated. */
export function sxSourceRefDisplayLabel(sourceRef: string | null): string | null {
  if (!sourceRef) return null;
  if (/^https?:\/\//i.test(sourceRef)) return "外部リンク（詳細は編集画面で確認）";
  const trackingKeyMatch = sourceRef.match(/^user:(\d{4}-\d{2}-\d{2})#(.+)$/);
  if (trackingKeyMatch) return `手動記録 ${trackingKeyMatch[1]}`;
  return sourceRef.length > 24 ? `${sourceRef.slice(0, 24)}…` : sourceRef;
}

const OPEN_WORK_ITEM_STATUSES = new Set(["open", "in_progress", "waiting", "blocked", "on_hold"]);
const OPEN_COMMITMENT_STATUSES = new Set(["open", "in_progress", "blocked"]);

function workItemToHoldingItem(item: SxPartnerWorkItem): SxHoldingItem {
  return {
    id: item.id, partnerId: item.partnerId, side: item.side, itemKindLabel: sxWorkItemKindLabel(item.itemKind),
    title: item.title, detail: item.detail, status: item.status, dueDate: item.dueDate, dueDatePrecision: item.dueDatePrecision,
    ownerLabel: item.ownerLabel, handoffTo: item.handoffTo, completionCriteria: item.completionCriteria,
    completedOn: item.completedOn, completionEvidence: item.completionEvidence, sourceEvidence: null,
    acceptedBy: item.acceptedBy, acceptedOn: item.acceptedOn,
    relatedMilestoneId: item.relatedMilestoneId,
    sourceKind: item.sourceKind, sourceRef: item.sourceRef, lastVerifiedAt: item.lastVerifiedAt, confidence: item.confidence,
  };
}

function commitmentToHoldingItem(commitment: SxPartnerCommitment): SxHoldingItem {
  return {
    id: commitment.id, partnerId: commitment.partnerId,
    side: commitment.commitmentKind === "counterparty_promise" ? "partner" : "sx",
    itemKindLabel: commitment.commitmentKind === "counterparty_promise" ? "相手の約束" : "SX側の次アクション",
    title: commitment.title, detail: commitment.commitmentText, status: commitment.status, dueDate: commitment.dueDate,
    dueDatePrecision: commitment.dueDate ? "day" : "unknown",
    ownerLabel: commitment.commitmentKind === "counterparty_promise" ? commitment.counterpartyOwner : commitment.sxOwner,
    // commitment.evidence is 一次根拠 (primary backing for the promise), never "proof this is done" — a
    // commitment has no separate completion-evidence field, so completionEvidence stays null here even
    // once status=completed (2026-07-24 P1 fix: this used to be mis-mapped onto completionEvidence).
    handoffTo: null, completionCriteria: null, completedOn: commitment.completedOn, completionEvidence: null,
    sourceEvidence: commitment.evidence,
    acceptedBy: null, acceptedOn: null, relatedMilestoneId: null,
    sourceKind: commitment.sourceKind, sourceRef: commitment.sourceRef, lastVerifiedAt: commitment.lastVerifiedAt, confidence: commitment.confidence,
  };
}

/** Merges the work-item ledger with still-active commitments into one "who holds what" list per side.
 * Does not alter project_management_partner_commitments or its counterparty_promise/sx_followup
 * boundary — commitments are only normalized here for display alongside work items. */
export function sxHoldingsForPartner(partner: {
  id: string;
  workItems: SxPartnerWorkItem[];
  commitments: SxPartnerCommitment[];
}): SxHoldingItem[] {
  const fromWorkItems = partner.workItems.filter((item) => OPEN_WORK_ITEM_STATUSES.has(item.status)).map(workItemToHoldingItem);
  const fromCommitments = partner.commitments.filter((commitment) => OPEN_COMMITMENT_STATUSES.has(commitment.status)).map(commitmentToHoldingItem);
  return [...fromWorkItems, ...fromCommitments];
}

/** Every work item regardless of status (open through completed/cancelled), for the always-visible
 * "台帳の詳細" audit listing — a completed/cancelled item must stay readable as audit history, not
 * disappear once it leaves the open-holdings lane view above. Commitments are intentionally excluded
 * here: their full history is already rendered unconditionally elsewhere (the 約束・次アクション
 * section), so merging them in here would duplicate that listing. */
export function sxAllHoldingsForPartnerAudit(partner: { workItems: SxPartnerWorkItem[] }): SxHoldingItem[] {
  return partner.workItems.map(workItemToHoldingItem);
}

/** Overdue/due-soon only ever apply to day-precision due dates — a month-precision due date
 * ("2026年8月") has no confirmed day to compare against today, so it must never render red. */
export function sxIsHoldingOverdue(item: Pick<SxHoldingItem, "dueDate" | "dueDatePrecision">, today: string): boolean {
  return item.dueDatePrecision === "day" && item.dueDate != null && item.dueDate < today;
}

export function sxIsHoldingDueSoon(item: Pick<SxHoldingItem, "dueDate" | "dueDatePrecision">, today: string, sevenDaysOut = addDaysStr(today, 7)): boolean {
  return item.dueDatePrecision === "day" && item.dueDate != null && item.dueDate >= today && item.dueDate <= sevenDaysOut;
}

/** Month-precision due dates form their own bucket ("月精度期限") — distinct from day-precision
 * overdue/due-soon and from fully-unset dates. */
export function sxIsHoldingMonthPrecision(item: Pick<SxHoldingItem, "dueDate" | "dueDatePrecision">): boolean {
  return item.dueDatePrecision === "month" && item.dueDate != null;
}

export function sxIsHoldingDueUnset(item: Pick<SxHoldingItem, "dueDate" | "dueDatePrecision">): boolean {
  return item.dueDate == null || item.dueDatePrecision === "unknown";
}

const UNSET_DUE_SORT_SENTINEL = "9999-12-31";

/** Priority tier for the holdings display order: blocked always leads (never pushed out of a "top 2"
 * slice by a status with an earlier/no due date), then day-precision overdue, then day-precision
 * due-soon-or-later, then month precision, then fully unset last. Within a tier, nearest due date
 * first. status=blocked is unconditionally tier 0 regardless of its own due date. */
function sxHoldingPriorityTier(item: Pick<SxHoldingItem, "status" | "dueDate" | "dueDatePrecision">, today: string): number {
  if (item.status === "blocked") return 0;
  if (sxIsHoldingOverdue(item, today)) return 1;
  if (item.dueDatePrecision === "day" && item.dueDate != null) return 2;
  if (sxIsHoldingMonthPrecision(item)) return 3;
  return 4;
}

export function sxSortHoldingsByPriority<T extends Pick<SxHoldingItem, "status" | "dueDate" | "dueDatePrecision">>(items: T[], today: string): T[] {
  return [...items].sort((a, b) => {
    const tierDiff = sxHoldingPriorityTier(a, today) - sxHoldingPriorityTier(b, today);
    if (tierDiff !== 0) return tierDiff;
    return (a.dueDate || UNSET_DUE_SORT_SENTINEL).localeCompare(b.dueDate || UNSET_DUE_SORT_SENTINEL);
  });
}

export type SxControlBandCounts = {
  /** Partner-unit "quality" metrics: every relationship, deferred/on_hold/ended included. */
  totalPartners: number;
  activePartners: number;
  deferredPartners: number;
  /** relationship_state=ended partners — a distinct unit from deferredPartners (on_hold), never merged
   * into it, and excluded from activePartners (spec: endedは対応中除外。全件には含め、保留/終了を別単位). */
  endedPartners: number;
  unclassifiedPartners: number;
  bothSidesHeldPartners: number;
  /** A lane (sx or partner side) with zero open holdings can never be read as "confirmed zero" — it
   * may simply not have been organized/surveyed yet. unorganizedPartners counts active partners with
   * at least one such empty lane; organizedCoveragePct is the share of active partners with holdings
   * confirmed on both lanes. */
  unorganizedPartners: number;
  organizedCoveragePct: number;
  /** Holdings-unit metrics: computed only over active (non-deferred, non-ended) partners' open holdings. */
  totalHoldings: number;
  sxHeld: number;
  partnerHeld: number;
  sharedHeld: number;
  sideUnknown: number;
  blockedHoldings: number;
  overdue: number;
  dueSoon: number;
  dueMonthPrecision: number;
  dueUnset: number;
  ownerUnconfirmed: number;
};

type CountablePartner = {
  id: string;
  deferredLowPriority: boolean;
  workItems: SxPartnerWorkItem[];
  commitments: SxPartnerCommitment[];
  roles: SxPartnerRole[];
};

/** The control band's metrics, split by unit (spec COO集計): totalPartners/deferredPartners/
 * endedPartners/activePartners/unclassifiedPartners are partner-quality metrics computed over EVERY
 * partner (deferred/on_hold/ended included, never excluded — a partner does not stop existing just
 * because it's low-priority or the relationship ended). Every other metric is an urgency/holdings
 * metric computed only over active (non-deferred, non-ended) partners' open holdings — those partners
 * are excluded from those denominators by design, but never removed from the underlying ledger; the
 * caller still renders them in their own trailing groups. */
export function sxComputeControlBandCounts(
  partners: CountablePartner[],
  today: string,
): SxControlBandCounts {
  const totalPartners = partners.length;
  const deferredPartners = partners.filter((partner) => partner.deferredLowPriority).length;
  const endedPartners = partners.filter((partner) => !partner.deferredLowPriority && sxIsPartnerEnded(partner)).length;
  const activePartners = totalPartners - deferredPartners - endedPartners;
  const unclassifiedPartners = partners.filter((partner) => (partner.roles.find((role) => role.isPrimary)?.roleKind || "unclassified") === "unclassified").length;

  const activePartnerList = partners.filter((partner) => !partner.deferredLowPriority && !sxIsPartnerEnded(partner));
  const holdingsByPartner = activePartnerList.map((partner) => sxHoldingsForPartner(partner));
  const holdings = holdingsByPartner.flat();
  const sevenDaysOut = addDaysStr(today, 7);
  const bothSidesHeldPartners = holdingsByPartner.filter(
    (partnerHoldings) => partnerHoldings.some((item) => item.side === "sx") && partnerHoldings.some((item) => item.side === "partner"),
  ).length;
  const unorganizedPartners = holdingsByPartner.filter(
    (partnerHoldings) => !partnerHoldings.some((item) => item.side === "sx") || !partnerHoldings.some((item) => item.side === "partner"),
  ).length;
  const organizedCoveragePct = activePartnerList.length > 0 ? Math.round(((activePartnerList.length - unorganizedPartners) / activePartnerList.length) * 100) : 0;

  return {
    totalPartners,
    activePartners,
    deferredPartners,
    endedPartners,
    unclassifiedPartners,
    bothSidesHeldPartners,
    unorganizedPartners,
    organizedCoveragePct,
    totalHoldings: holdings.length,
    sxHeld: holdings.filter((item) => item.side === "sx").length,
    partnerHeld: holdings.filter((item) => item.side === "partner").length,
    sharedHeld: holdings.filter((item) => item.side === "shared").length,
    sideUnknown: holdings.filter((item) => item.side === "unknown").length,
    blockedHoldings: holdings.filter((item) => item.status === "blocked").length,
    overdue: holdings.filter((item) => sxIsHoldingOverdue(item, today)).length,
    dueSoon: holdings.filter((item) => sxIsHoldingDueSoon(item, today, sevenDaysOut)).length,
    dueMonthPrecision: holdings.filter((item) => sxIsHoldingMonthPrecision(item)).length,
    dueUnset: holdings.filter((item) => sxIsHoldingDueUnset(item)).length,
    ownerUnconfirmed: holdings.filter((item) => isMissingOwnerLabel(item.ownerLabel)).length,
  };
}

/** Counts EVERY partner (deferred/on_hold and ended included) by their primary role classification,
 * for the category nav. A role kind whose only partners happen to be deferred/ended must still show a
 * chip with a real count — excluding them would make that chip permanently unreachable (count always
 * 0, so CategoryNav never renders it), even though selecting the filter would still correctly surface
 * those partners in their trailing 保留/終了 sections (spec P1: 保留/終了を含む全partnerでrole集計し
 * filter到達可能, 2026-07-24). A partner with no primary role row is counted as unclassified. */
export function sxPrimaryRoleKindCounts(
  partners: Array<{ deferredLowPriority: boolean; roles: SxPartnerRole[] }>,
): Partial<Record<SxPartnerRoleKind, number>> {
  const counts: Partial<Record<SxPartnerRoleKind, number>> = {};
  for (const partner of partners) {
    const kind = partner.roles.find((role) => role.isPrimary)?.roleKind || "unclassified";
    counts[kind] = (counts[kind] || 0) + 1;
  }
  return counts;
}

type GroupablePartner = {
  dueDate: string | null;
  roles: SxPartnerRole[];
  workItems: SxPartnerWorkItem[];
  commitments: SxPartnerCommitment[];
  deferredLowPriority: boolean;
  /** 現在ボールの側。当方（sx）ボールは「持ったまま待つ」を許さないため並び順でも前へ出す。 */
  currentBallSide?: string;
};

const UNSET_SORT_SENTINEL = "9999-12-31";

/** The single "display due date" sort key used both for within-group ordering and for what's
 * actually painted in the row (spec: 表示ソートキーは表示期限に一致させる — sort and display must
 * never diverge). Priority: nearest still-open holding's due date, then the partner-level due date,
 * then unset last. */
export function sxPartnerDisplaySortKey(partner: GroupablePartner): string {
  const holdingDates = sxHoldingsForPartner({ id: "", ...partner })
    .map((item) => item.dueDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (holdingDates[0]) return holdingDates[0];
  if (partner.dueDate) return partner.dueDate;
  return UNSET_SORT_SENTINEL;
}

/** True when a partner currently holds at least one blocked-status item, on either lane. Display-
 * ordering signal only — never changes what's counted where (spec P1: blocked partner最優先). */
export function sxPartnerHasBlockedHolding(partner: { workItems: SxPartnerWorkItem[]; commitments: SxPartnerCommitment[] }): boolean {
  return sxHoldingsForPartner({ id: "", ...partner }).some((item) => item.status === "blocked");
}

/** Display-sort key used for both within-group partner ordering and group-level ordering (the group
 * order is derived from its first partner's key, so this single function drives both — spec P1:
 * partner/group sortもblocked partner最優先). Blocked-holding partners always sort into tier "0"
 * ahead of everyone else; within a tier the ordering is identical to sxPartnerDisplaySortKey (nearest
 * due date first). Never diverges from sxPartnerDisplaySortKey's date value — only prefixes a tier
 * digit so plain string sort keeps blocked partners at the top regardless of their own due date. */
export function sxPartnerPrioritySortKey(partner: GroupablePartner): string {
  // tier 0 = 停止保有あり、tier 1 = 当方（SX）ボール、tier 2 = その他。
  // 当方ボールは待ち時間がそのままPJの遅れになるため、期限順より先に持ち上げる（2026-07-25 まさ確定:
  // 「ボール持ったまま待つことは基本的に許されない」）。
  const tier = sxPartnerHasBlockedHolding(partner) ? "0" : partner.currentBallSide === "sx" ? "1" : "2";
  return `${tier}-${sxPartnerDisplaySortKey(partner)}`;
}

export type SxPartnerGroup<P> = {
  key: string;
  roleKind: SxPartnerRoleKind;
  relationshipState: SxRelationshipState;
  label: string;
  partners: P[];
};

/** True when at least one partner in the group currently holds a blocked-status item. Since a
 * group's partners are already sorted by sxPartnerPrioritySortKey ascending (blocked partners
 * always land in tier "0" ahead of tier "1"), checking the first partner's key is equivalent to
 * checking every partner in the group — cheaper than re-scanning, but the semantics are "does this
 * group contain a blocked partner," not "is the first partner's own key blocked." */
function sxGroupHasBlockedPartner<P extends GroupablePartner>(group: { partners: P[] }): boolean {
  const first = group.partners[0];
  return first != null && sxPartnerPrioritySortKey(first).startsWith("0-");
}

/** Groups active (non-deferred, non-ended) partners by primary role_kind x relationship_state — e.g.
 * "共同開発先" and "共同開発候補先" are always distinct groups, never merged (spec B). Each group is
 * sorted by the shared display-due-date sort key. Groups themselves sort with a blocked-holding
 * group always first (spec P1: group sortもblockedを最優先にし、unclassified lastの判定より前に
 * 効かせる — 未分類groupにblocked partnerがいる場合も通常groupより上に出す。unclassifiedのみを常に
 * 最後に送る旧ロジックは、未分類×blockedをunclassified-last側に押し込め、緊急度の高いgroupを画面末尾
 * に隠してしまっていた), then unclassified last among the remaining (non-blocked) groups (an
 * unconfirmed classification should never crowd out confirmed groups just because a date happens to
 * be set), then nearest due date. Deferred/low-priority and ended partners are intentionally excluded
 * here — the caller renders each as its own separate trailing group with the same row UI (spec:
 * 保留/終了を別単位). */
export function sxGroupPartnersByPrimaryClassification<P extends GroupablePartner>(
  partners: P[],
): Array<SxPartnerGroup<P>> {
  const active = partners.filter((partner) => !partner.deferredLowPriority && !sxIsPartnerEnded(partner));
  const groups = new Map<string, { roleKind: SxPartnerRoleKind; relationshipState: SxRelationshipState; partners: P[] }>();
  for (const partner of active) {
    const primary = partner.roles.find((role) => role.isPrimary) || null;
    const roleKind: SxPartnerRoleKind = primary?.roleKind || "unclassified";
    const relationshipState: SxRelationshipState = primary?.relationshipState || "unconfirmed";
    const key = `${roleKind}::${relationshipState}`;
    if (!groups.has(key)) groups.set(key, { roleKind, relationshipState, partners: [] });
    groups.get(key)!.partners.push(partner);
  }
  const result: Array<SxPartnerGroup<P>> = Array.from(groups.values()).map(({ roleKind, relationshipState, partners: groupPartners }) => ({
    key: `${roleKind}::${relationshipState}`,
    roleKind,
    relationshipState,
    label: sxRoleDisplayLabel(roleKind, relationshipState),
    partners: [...groupPartners].sort((a, b) => sxPartnerPrioritySortKey(a).localeCompare(sxPartnerPrioritySortKey(b))),
  }));
  return result.sort((a, b) => {
    const aBlocked = sxGroupHasBlockedPartner(a);
    const bBlocked = sxGroupHasBlockedPartner(b);
    if (aBlocked !== bBlocked) return aBlocked ? -1 : 1;
    if (a.roleKind === "unclassified" && b.roleKind !== "unclassified") return 1;
    if (b.roleKind === "unclassified" && a.roleKind !== "unclassified") return -1;
    const aKey = a.partners[0] ? sxPartnerPrioritySortKey(a.partners[0]) : UNSET_SORT_SENTINEL;
    const bKey = b.partners[0] ? sxPartnerPrioritySortKey(b.partners[0]) : UNSET_SORT_SENTINEL;
    return aKey.localeCompare(bKey) || a.label.localeCompare(b.label);
  });
}
