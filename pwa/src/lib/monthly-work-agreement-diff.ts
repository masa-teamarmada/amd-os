import type {
  ExpectedRewardChangeExplanation,
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

// ---------------------------------------------------------------------------
// 予定額が変わった理由を、OSが自分で説明する
//
// 予定額は「当月のMS消化pt × share × 予算」に繰越と支払枠を通した自動計算の結果で、
// 人が意図して動かしたものではない月がほとんど。それでも 2026-08-28 までは
// 「予定額が1円でも変わったPJは、管理側が8文字以上の理由を書くまで本人が合意できない」
// 仕様になっていた。書く人は計算過程を知らないので誰も書けず、合意が止まり、
// 合意が止まると支払通知書が発行できないまま復旧できなくなる。
//
// 実際、2026-08-27 に合意額の定義を「当月発生分」から「実際に払う額（過去の未払いの
// 返済分を含む）」へ変えた時点で、全メンバー・全PJの hash が一斉に変わり、
// 数十件の理由入力が同時に必要になって支払が止まった。
//
// 要因は snapshot の中に数値として全部ある。OSが説明できるものはOSが説明する。
// ---------------------------------------------------------------------------

function ptText(value: number | null | undefined): string {
  if (value == null) return "未計算";
  return `${Math.round(value * 100) / 100}pt`;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * 「合意額」の意味が変わった移行かどうか。
 *
 * 前回の記録に `currentMonthAccrualYen` が無く、今回はある場合、前回の `expectedRewardYen` は
 * 旧定義（当月のMS消化から発生する分）で、今回の `expectedRewardYen` は新定義（実際に払う額）。
 * 同じ欄の数字が別のものを指しているだけで、その人の稼働条件は何も変わっていない。
 */
function isExpectedRewardDefinitionMigration(
  previous: MonthlyWorkAgreementProject,
  current: MonthlyWorkAgreementProject,
): boolean {
  return previous.currentMonthAccrualYen == null && current.currentMonthAccrualYen != null;
}

function explainProjectPair(
  previous: MonthlyWorkAgreementProject | null,
  current: MonthlyWorkAgreementProject | null,
  projectId: string,
): ExpectedRewardChangeExplanation {
  const projectName = current?.projectName ?? previous?.projectName ?? projectId;
  const beforeYen = numberOrNull(previous?.expectedRewardYen);
  const afterYen = numberOrNull(current?.expectedRewardYen);

  if (!previous && current) {
    return {
      projectId,
      projectName,
      beforeYen: null,
      afterYen,
      headline: `${projectName} が今回から合意の対象に入りました`,
      details: [`このPJの予定額 ${yenText(afterYen)} が今回から加わっています。`],
      explained: true,
    };
  }
  if (previous && !current) {
    return {
      projectId,
      projectName,
      beforeYen,
      afterYen: null,
      headline: `${projectName} が今回の合意の対象から外れました`,
      details: [`前回は ${yenText(beforeYen)} でしたが、今回はこのPJの予定額がありません。`],
      explained: true,
    };
  }
  if (!previous || !current) {
    return {
      projectId,
      projectName,
      beforeYen,
      afterYen,
      headline: `${projectName} の予定額が変わりました`,
      details: [],
      explained: false,
    };
  }

  const details: string[] = [];
  let explained = false;

  if (isExpectedRewardDefinitionMigration(previous, current)) {
    details.push(
      "合意する金額の意味が変わりました。前回は「今月の稼働から発生する分」を出していましたが、いまは「今月あなたにお支払いする額」を出しています。あなたの稼働条件そのものが変わったわけではありません。",
    );
    explained = true;
  }

  const accrualYen = numberOrNull(current.currentMonthAccrualYen);
  const payYen = numberOrNull(current.expectedRewardYen);
  const previousAccrualYen = numberOrNull(previous.currentMonthAccrualYen);
  if (previousAccrualYen != null && accrualYen != null && previousAccrualYen !== accrualYen) {
    details.push(
      `今月の稼働から発生する分が ${yenText(previousAccrualYen)} → ${yenText(accrualYen)} に変わりました。`,
    );
    explained = true;
  }

  // 今月払う額と、今月の稼働から発生する額の差がどこから来ているか。
  // 差そのものが「過去の未払いの返済」か「支払枠に収まらない繰越」なので、内訳を出せた時点で
  // 額の構成は説明できている。ここで explained を立てないと、pt も繰越も動いていないのに
  // 支払枠だけで額が動いた月に、誰も書けない理由入力を待って支払が止まる。
  if (accrualYen != null && payYen != null) {
    explained = true;
    const gap = payYen - accrualYen;
    if (gap > 0) {
      details.push(
        `内訳は、今月の稼働から発生する分 ${yenText(accrualYen)} ＋ 過去の未払いからの返済 ${yenText(gap)} ＝ 今月のお支払い ${yenText(payYen)} です。`,
      );
    } else if (gap < 0) {
      details.push(
        `今月の稼働から発生する分 ${yenText(accrualYen)} のうち、月々の支払枠に収まる ${yenText(payYen)} を今月お支払いします。残り ${yenText(-gap)} は翌月以降の支払枠で順にお支払いします。`,
      );
    } else {
      details.push(`今月の稼働から発生する分 ${yenText(accrualYen)} を、そのまま今月お支払いします。`);
    }
  }

  if (previous.earnedPt !== current.earnedPt) {
    details.push(`今月の消化ptが ${ptText(previous.earnedPt)} → ${ptText(current.earnedPt)} に変わりました。`);
    explained = true;
  }
  if (previous.roleLabel !== current.roleLabel) {
    details.push(`担当が「${textOrUnset(previous.roleLabel)}」から「${textOrUnset(current.roleLabel)}」に変わりました。`);
    explained = true;
  }
  if (previous.carryInYen !== current.carryInYen) {
    details.push(
      `前月からの繰越（まだ払えていない分）が ${yenText(previous.carryInYen)} → ${yenText(current.carryInYen)} に変わりました。`,
    );
    explained = true;
  }
  if (previous.grossDueYen !== current.grossDueYen) {
    details.push(
      `今月の支払対象額（繰越＋当月発生）が ${yenText(previous.grossDueYen)} → ${yenText(current.grossDueYen)} に変わりました。`,
    );
    explained = true;
  }

  const stockYen = numberOrNull(current.stockYen) ?? 0;
  if (stockYen > 0) {
    details.push(`今月末の時点でまだお支払いできていない残りは ${yenText(stockYen)} です。翌月以降の支払枠で順にお支払いします。`);
  }

  const headline = explained
    ? `${projectName} の予定額 ${yenText(beforeYen)} → ${yenText(afterYen)}`
    : `${projectName} の予定額が ${yenText(beforeYen)} → ${yenText(afterYen)} に変わった理由を確認中です`;

  return { projectId, projectName, beforeYen, afterYen, headline, details, explained };
}

/**
 * 予定額が変わった全PJについて、OSが組み立てた説明を返す。
 * 前回 snapshot が比較できない場合は、説明できない（= 管理側の理由入力が要る）扱いにする。
 */
export function explainExpectedRewardChanges(
  previous: unknown,
  current: MonthlyWorkAgreementSnapshot,
): ExpectedRewardChangeExplanation[] {
  const changedProjectIds = projectIdsWithExpectedRewardChange(previous, current);
  if (changedProjectIds.length === 0) return [];

  if (!isV2Snapshot(previous)) {
    return changedProjectIds.map((projectId) => {
      const project = current.projects.find((item) => item.projectId === projectId) ?? null;
      return {
        projectId,
        projectName: project?.projectName ?? projectId,
        beforeYen: null,
        afterYen: numberOrNull(project?.expectedRewardYen),
        headline: `${project?.projectName ?? projectId} の予定額を前回と比べられません`,
        details: ["前回合意した時点の記録が残っていないか、記録の形式が古いため、変わった理由を出せません。"],
        explained: false,
      };
    });
  }

  const prevProjects = new Map(previous.projects.map((project) => [project.projectId, project]));
  const curProjects = new Map(current.projects.map((project) => [project.projectId, project]));
  return changedProjectIds.map((projectId) =>
    explainProjectPair(prevProjects.get(projectId) ?? null, curProjects.get(projectId) ?? null, projectId),
  );
}
