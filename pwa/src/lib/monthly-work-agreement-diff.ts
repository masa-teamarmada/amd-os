import type {
  MonthlyAgreementChangeGroup,
  MonthlyAgreementChangeItem,
  MonthlyAgreementSnapshotDiff,
  MonthlyWorkAgreementMember,
  MonthlyWorkAgreementMilestone,
  MonthlyWorkAgreementPayoutScheduleEntry,
  MonthlyWorkAgreementProject,
  MonthlyWorkAgreementSnapshot,
} from "@/lib/monthly-work-agreement-types";

export type {
  MonthlyAgreementChangeGroup,
  MonthlyAgreementChangeItem,
  MonthlyAgreementSnapshotDiff,
} from "@/lib/monthly-work-agreement-types";

const OVERALL_GROUP_ID = "__all__";
const OVERALL_GROUP_NAME = "全体";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMilestoneLike(value: unknown): value is MonthlyWorkAgreementMilestone {
  if (!isRecord(value)) return false;
  return typeof value.milestoneId === "string" && typeof value.title === "string";
}

function isPayoutEntryLike(value: unknown): value is MonthlyWorkAgreementPayoutScheduleEntry {
  if (!isRecord(value)) return false;
  return typeof value.sourceYm === "string" && typeof value.paymentYm === "string";
}

function isProjectLike(value: unknown): value is MonthlyWorkAgreementProject {
  if (!isRecord(value)) return false;
  if (typeof value.projectId !== "string" || typeof value.projectName !== "string") return false;
  if (!Array.isArray(value.milestones) || !value.milestones.every(isMilestoneLike)) return false;
  if (!Array.isArray(value.payoutSchedule) || !value.payoutSchedule.every(isPayoutEntryLike)) return false;
  return true;
}

function isV2Snapshot(value: unknown): value is MonthlyWorkAgreementSnapshot {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== "monthly_work_agreement.v2") return false;
  if (!Array.isArray(value.projects) || !value.projects.every(isProjectLike)) return false;
  if (!isRecord(value.member)) return false;
  if (!isRecord(value.totals)) return false;
  return true;
}

function yenText(value: number | null | undefined): string {
  if (value == null) return "未計算";
  return `¥${Math.round(value).toLocaleString()}`;
}

function shareText(value: number | null | undefined): string {
  if (value == null) return "未設定";
  return `${Math.round(value * 100)}%`;
}

function textOrUnset(value: unknown): string {
  if (value == null) return "未設定";
  const trimmed = (typeof value === "string" ? value : String(value)).trim();
  return trimmed.length > 0 ? trimmed : "未設定";
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "稼働中",
  sales: "営業中",
  ended: "終了",
  frozen: "凍結",
  lost: "失注",
  unknown: "不明",
};

const BILLING_STATUS_LABELS: Record<string, string> = {
  not_started: "未開始",
  budget_reported: "予算入力済み",
  budget_confirmed: "予算確認済み",
  budget_rejected: "予算却下",
  allocation_confirmed: "アロケーション確定済み",
  report_fixed: "報告書確定",
  invoice_issued: "請求書作成済み",
  invoice_sent: "請求書送付済み",
  payment_confirmed: "入金確認済み",
  reward_paid: "報酬支払い済み",
  confirmed: "確認済み",
  reported: "入力済み",
  not_set: "未設定",
};

const ALLOCATION_STATUS_LABELS: Record<string, string> = {
  confirmed: "確定済み",
  reported: "報告済み",
  not_set: "未設定",
};

const AMOUNT_SOURCE_LABELS: Record<string, string> = {
  actual_paid: "実支払済み",
  unverified_paid: "未確認支払",
  payout_snapshot: "支払スナップショット",
  protected_reward_cache: "保護対象の報酬キャッシュ",
  reward_cache: "報酬キャッシュ",
};

function labelText(value: unknown, labels: Record<string, string>): string {
  if (value == null) return "未設定";
  const key = String(value);
  return labels[key] ?? textOrUnset(value);
}

function projectStatusText(value: unknown): string {
  return labelText(value, PROJECT_STATUS_LABELS);
}

function billingStatusText(value: unknown): string {
  return labelText(value, BILLING_STATUS_LABELS);
}

function allocationStatusText(value: unknown): string {
  return labelText(value, ALLOCATION_STATUS_LABELS);
}

function amountSourceText(value: unknown): string {
  return labelText(value, AMOUNT_SOURCE_LABELS);
}

function boolText(value: boolean | null | undefined): string {
  return value ? "あり" : "なし";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function stringArrayText(value: string[] | null | undefined, sameCount: boolean): string {
  const count = value?.length ?? 0;
  if (count === 0) return "0件";
  return sameCount ? `${count}件（内容変更）` : `${count}件・更新あり`;
}

function pushIfDiffer<T>(
  changes: MonthlyAgreementChangeItem[],
  label: string,
  prev: T,
  cur: T,
  format: (value: T) => string,
) {
  if (prev === cur) return;
  changes.push({ label, before: format(prev), after: format(cur) });
}

function pushIfArrayDiffer(
  changes: MonthlyAgreementChangeItem[],
  label: string,
  prev: unknown,
  cur: unknown,
) {
  const prevList = normalizeStringArray(prev);
  const curList = normalizeStringArray(cur);
  if (prevList.length === curList.length && prevList.every((v, i) => v === curList[i])) return;
  const sameCount = prevList.length === curList.length;
  changes.push({
    label,
    before: stringArrayText(prevList, sameCount),
    after: stringArrayText(curList, sameCount),
  });
}

function diffMemberAndTotals(
  previous: MonthlyWorkAgreementSnapshot,
  current: MonthlyWorkAgreementSnapshot,
): MonthlyAgreementChangeItem[] {
  const changes: MonthlyAgreementChangeItem[] = [];
  const prevMember: MonthlyWorkAgreementMember = previous.member;
  const curMember: MonthlyWorkAgreementMember = current.member;

  pushIfDiffer(changes, "対象月", previous.ym, current.ym, (v) => v);
  pushIfDiffer(changes, "メンバーID", prevMember.memberId, curMember.memberId, (v) => v);
  pushIfDiffer(changes, "コードネーム", prevMember.codeName, curMember.codeName, (v) => v);
  pushIfDiffer(changes, "メールアドレス", prevMember.email ?? null, curMember.email ?? null, textOrUnset);
  pushIfDiffer(
    changes,
    "管理者権限",
    Boolean(prevMember.isAdmin),
    Boolean(curMember.isAdmin),
    boolText,
  );
  pushIfDiffer(
    changes,
    "支払通知の対象外設定",
    Boolean(prevMember.excludeFromPayoutNotice),
    Boolean(curMember.excludeFromPayoutNotice),
    boolText,
  );

  const prevTotals = previous.totals;
  const curTotals = current.totals;
  pushIfDiffer(changes, "もらえる予定額 (合計)", prevTotals.expectedRewardYen, curTotals.expectedRewardYen, yenText);
  pushIfDiffer(changes, "ストック (合計)", prevTotals.stockYen, curTotals.stockYen, yenText);
  pushIfDiffer(
    changes,
    "実支払済 (合計)",
    prevTotals.paidActualYen ?? null,
    curTotals.paidActualYen ?? null,
    yenText,
  );
  pushIfDiffer(
    changes,
    "未確認支払 (合計)",
    prevTotals.unverifiedPaidYen ?? null,
    curTotals.unverifiedPaidYen ?? null,
    yenText,
  );
  pushIfDiffer(
    changes,
    "将来支払予定 (合計)",
    prevTotals.futurePayoutYen ?? null,
    curTotals.futurePayoutYen ?? null,
    yenText,
  );
  pushIfDiffer(changes, "プロジェクト数", prevTotals.projectCount, curTotals.projectCount, (v) => `${v}件`);
  pushIfDiffer(
    changes,
    "要確認件数",
    prevTotals.reviewRequiredCount,
    curTotals.reviewRequiredCount,
    (v) => `${v}件`,
  );

  return changes;
}

function diffPayoutSchedule(
  prev: MonthlyWorkAgreementPayoutScheduleEntry[],
  cur: MonthlyWorkAgreementPayoutScheduleEntry[],
): MonthlyAgreementChangeItem[] {
  const changes: MonthlyAgreementChangeItem[] = [];
  const prevMap = new Map(prev.map((entry) => [entry.sourceYm, entry]));
  const curMap = new Map(cur.map((entry) => [entry.sourceYm, entry]));
  const sourceYms = Array.from(new Set([...prevMap.keys(), ...curMap.keys()])).sort();

  for (const sourceYm of sourceYms) {
    const pe = prevMap.get(sourceYm) ?? null;
    const ce = curMap.get(sourceYm) ?? null;

    if (!pe && ce) {
      changes.push({ label: `支払予定「${sourceYm}」`, before: "未登録", after: "新規登録" });
      continue;
    }
    if (pe && !ce) {
      changes.push({ label: `支払予定「${sourceYm}」`, before: "登録あり", after: "削除" });
      continue;
    }
    if (!pe || !ce) continue;

    pushIfDiffer(changes, `「${sourceYm}」の支払月`, pe.paymentYm, ce.paymentYm, (v) => v);
    pushIfDiffer(changes, `「${sourceYm}」のステータス`, pe.status ?? null, ce.status ?? null, billingStatusText);
    pushIfDiffer(changes, `「${sourceYm}」の基本支払額`, pe.basePayYen, ce.basePayYen, yenText);
    pushIfDiffer(changes, `「${sourceYm}」の繰越額`, pe.carryInYen, ce.carryInYen, yenText);
    pushIfDiffer(changes, `「${sourceYm}」の支払確定前総額`, pe.grossDueYen, ce.grossDueYen, yenText);
    pushIfDiffer(changes, `「${sourceYm}」の支払総額`, pe.totalPayYen, ce.totalPayYen, yenText);
    pushIfDiffer(
      changes,
      `「${sourceYm}」の税込支払総額`,
      pe.totalPayTaxIncludedYen,
      ce.totalPayTaxIncludedYen,
      yenText,
    );
    pushIfDiffer(changes, `「${sourceYm}」のストック額`, pe.stockYen, ce.stockYen, yenText);
    pushIfDiffer(changes, `「${sourceYm}」の当月フラグ`, pe.isCurrentYm, ce.isCurrentYm, boolText);
    pushIfDiffer(changes, `「${sourceYm}」の保護フラグ`, pe.isProtected, ce.isProtected, boolText);
    pushIfDiffer(changes, `「${sourceYm}」の実支払済フラグ`, pe.isActualPaid, ce.isActualPaid, boolText);
    pushIfDiffer(changes, `「${sourceYm}」の金額根拠`, pe.amountSource, ce.amountSource, amountSourceText);
  }

  return changes;
}

function diffProjectPair(
  prev: MonthlyWorkAgreementProject | null,
  cur: MonthlyWorkAgreementProject | null,
): MonthlyAgreementChangeItem[] {
  const changes: MonthlyAgreementChangeItem[] = [];

  if (!prev && cur) {
    changes.push({ label: "対象プロジェクト", before: "対象外", after: "対象" });
    return changes;
  }
  if (prev && !cur) {
    changes.push({ label: "対象プロジェクト", before: "対象", after: "対象外" });
    return changes;
  }
  if (!prev || !cur) return changes;

  pushIfDiffer(changes, "プロジェクト名", prev.projectName, cur.projectName, (v) => v);
  pushIfDiffer(changes, "プロジェクトステータス", prev.projectStatus, cur.projectStatus, projectStatusText);
  pushIfDiffer(changes, "役割", prev.roleLabel, cur.roleLabel, textOrUnset);
  pushIfDiffer(changes, "PM担当", prev.isPm, cur.isPm, boolText);
  pushIfDiffer(changes, "PL担当", prev.isPl, cur.isPl, boolText);
  pushIfDiffer(changes, "請求ステータス", prev.billingStatus, cur.billingStatus, billingStatusText);
  pushIfDiffer(changes, "アロケーションステータス", prev.allocationStatus, cur.allocationStatus, allocationStatusText);
  pushIfDiffer(changes, "もらえる予定額", prev.expectedRewardYen, cur.expectedRewardYen, yenText);
  pushIfDiffer(changes, "支払額", prev.payoutYen, cur.payoutYen, yenText);
  pushIfDiffer(changes, "当サイクル支払額", prev.currentCyclePayoutYen, cur.currentCyclePayoutYen, yenText);
  pushIfDiffer(changes, "支払月", prev.paymentYm, cur.paymentYm, textOrUnset);
  pushIfDiffer(changes, "ストック額", prev.stockYen, cur.stockYen, yenText);
  pushIfDiffer(changes, "支払確定前総額", prev.grossDueYen, cur.grossDueYen, yenText);
  pushIfDiffer(changes, "繰越額", prev.carryInYen, cur.carryInYen, yenText);
  pushIfDiffer(changes, "獲得pt", prev.earnedPt, cur.earnedPt, (v) => (v == null ? "未計算" : `${v}pt`));
  pushIfDiffer(changes, "確認状態", prev.conditionState, cur.conditionState, (v) =>
    v === "ready" ? "確認済み" : "要確認",
  );
  pushIfArrayDiffer(changes, "条件", prev.conditions, cur.conditions);
  pushIfArrayDiffer(changes, "要確認理由", prev.reviewReasons, cur.reviewReasons);
  pushIfArrayDiffer(changes, "ルーティン期待値", prev.routineExpectations, cur.routineExpectations);

  const prevMilestones = new Map(prev.milestones.map((ms) => [ms.milestoneId, ms]));
  const curMilestones = new Map(cur.milestones.map((ms) => [ms.milestoneId, ms]));
  const milestoneIds = Array.from(
    new Set([...prevMilestones.keys(), ...curMilestones.keys()]),
  ).sort();

  for (const milestoneId of milestoneIds) {
    const pm = prevMilestones.get(milestoneId) ?? null;
    const cm = curMilestones.get(milestoneId) ?? null;
    const title = cm?.title ?? pm?.title ?? milestoneId;

    if (!pm && cm) {
      changes.push({ label: `担当MS「${title}」`, before: "未担当", after: "新規担当" });
      continue;
    }
    if (pm && !cm) {
      changes.push({ label: `担当MS「${title}」`, before: "担当中", after: "担当外" });
      continue;
    }
    if (!pm || !cm) continue;

    pushIfDiffer(changes, `「${title}」の名称`, pm.title, cm.title, (v) => v);
    pushIfDiffer(changes, `「${title}」のポイント`, pm.points, cm.points, (v) => `${v}pt`);
    pushIfDiffer(changes, `「${title}」の担当割合`, pm.plannedShare, cm.plannedShare, shareText);
    pushIfDiffer(changes, `「${title}」の役割`, pm.role, cm.role, textOrUnset);
    pushIfDiffer(changes, `「${title}」の作業内容`, pm.taskDescription, cm.taskDescription, textOrUnset);
    pushIfDiffer(
      changes,
      `「${title}」の進捗率`,
      pm.progressPct,
      cm.progressPct,
      (v) => (v == null ? "未計算" : `${Math.round(v)}%`),
    );
    pushIfDiffer(
      changes,
      `「${title}」の当月進捗率`,
      pm.monthlyProgressPct,
      cm.monthlyProgressPct,
      (v) => (v == null ? "未計算" : `${Math.round(v)}%`),
    );
    pushIfDiffer(changes, `「${title}」の予定額`, pm.expectedRewardYen, cm.expectedRewardYen, yenText);
    pushIfDiffer(
      changes,
      `「${title}」の獲得pt`,
      pm.earnedPt,
      cm.earnedPt,
      (v) => (v == null ? "未計算" : `${v}pt`),
    );
    pushIfArrayDiffer(changes, `「${title}」の条件`, pm.conditions, cm.conditions);
    pushIfDiffer(changes, `「${title}」の状態`, pm.state, cm.state, (v) =>
      v === "ready" ? "確認済み" : "要確認",
    );
  }

  const payoutChanges = diffPayoutSchedule(prev.payoutSchedule, cur.payoutSchedule);
  changes.push(...payoutChanges);

  return changes;
}

/**
 * 前回snapshotと比べて「もらえる予定額」が実際に変わったprojectIdだけを返す。
 * PJ追加・削除も前回/今回のいずれかの額が変わったものとして含める。
 * 前回が比較不能(v1/形式不明/存在しない)な場合は、現在額があるprojectを全て変更扱いにする
 * (=比較基準が無い以上、保守的に「理由が必要」側へ倒す)。
 */
export function projectIdsWithExpectedRewardChange(
  previous: unknown,
  current: MonthlyWorkAgreementSnapshot,
): string[] {
  if (!isV2Snapshot(previous)) {
    return current.projects.filter((project) => project.expectedRewardYen != null).map((project) => project.projectId);
  }
  const prevExpectedByProject = new Map(previous.projects.map((project) => [project.projectId, project.expectedRewardYen]));
  const currentExpectedByProject = new Map(current.projects.map((project) => [project.projectId, project.expectedRewardYen]));
  const projectIds = new Set([...prevExpectedByProject.keys(), ...currentExpectedByProject.keys()]);
  return [...projectIds]
    .filter((projectId) => prevExpectedByProject.get(projectId) !== currentExpectedByProject.get(projectId))
    .sort();
}

export function diffMonthlyAgreementSnapshots(
  previous: unknown,
  current: MonthlyWorkAgreementSnapshot,
): MonthlyAgreementSnapshotDiff {
  if (!isV2Snapshot(previous)) {
    return {
      comparable: false,
      count: 0,
      groups: [],
      note:
        previous == null
          ? "前回合意時の記録が見つからないため、変更点の詳細比較はできません。"
          : "前回合意時の記録形式が古いため、変更点の詳細比較はできません。内容は更新されています。",
    };
  }

  const groups: MonthlyAgreementChangeGroup[] = [];

  const overallChanges = diffMemberAndTotals(previous, current);
  if (overallChanges.length > 0) {
    groups.push({
      projectId: OVERALL_GROUP_ID,
      projectName: OVERALL_GROUP_NAME,
      changes: overallChanges,
    });
  }

  const prevProjects = new Map(previous.projects.map((project) => [project.projectId, project]));
  const curProjects = new Map(current.projects.map((project) => [project.projectId, project]));
  const projectIds = Array.from(new Set([...prevProjects.keys(), ...curProjects.keys()])).sort();

  for (const projectId of projectIds) {
    const prev = prevProjects.get(projectId) ?? null;
    const cur = curProjects.get(projectId) ?? null;
    const changes = diffProjectPair(prev, cur);
    if (changes.length === 0) continue;
    groups.push({
      projectId,
      projectName: cur?.projectName ?? prev?.projectName ?? projectId,
      changes,
    });
  }

  const count = groups.reduce((sum, group) => sum + group.changes.length, 0);

  return { comparable: true, count, groups, note: null };
}
