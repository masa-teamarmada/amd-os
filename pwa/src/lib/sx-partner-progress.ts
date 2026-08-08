import type {
  SxBallSide,
  SxManagementPartner,
  SxMeetingMode,
  SxPartnerActivityState,
  SxPartnerClassification,
  SxPartnerStage,
  SxPocCategory,
  SxSampleStatus,
} from "./sx-management";
import {
  sxHoldingsForPartner,
  sxIsHoldingDueSoon,
  sxIsHoldingOverdue,
  sxPartnerDisplaySortKey,
  sxPartnerHasBlockedHolding,
  sxSortHoldingsByPriority,
  type SxHoldingItem,
  type SxHoldingSide,
} from "./sx-partner-holdings.ts";

/** 次回面談の形式ラベル。selectの並び順もこの配列を正本にする。 */
export const SX_MEETING_MODES: SxMeetingMode[] = [
  "onsite",
  "online",
  "hybrid",
  "phone",
];

export const SX_MEETING_MODE_LABEL: Record<SxMeetingMode, string> = {
  onsite: "現地訪問",
  online: "オンライン",
  hybrid: "現地+オンライン",
  phone: "電話",
};

/**
 * 全関係先で共有する比較軸。PoC固有の業務段階ではなく、関係形成の現在地を表す。
 * on_holdは到達段階ではないため、この7段階へ混ぜず状態として重ねる。
 */
export const SX_PARTNER_STAGE_ORDER = [
  "candidate",
  "first_contact",
  "information_exchange",
  "hearing",
  "meeting_coordination",
  "technical_review",
  "condition_alignment",
  "sample_acquisition",
  "validation_preparation",
  "agreement_confirmation",
  "executing",
] as const satisfies readonly SxPartnerStage[];

const PARTNER_STAGE_LABEL: Record<SxPartnerStage, string> = {
  candidate: "候補",
  first_contact: "初回接触",
  information_exchange: "情報交換",
  hearing: "ヒアリング",
  meeting_coordination: "面談調整",
  technical_review: "技術確認",
  condition_alignment: "条件整理",
  sample_acquisition: "試料調達",
  validation_preparation: "検証準備",
  agreement_confirmation: "合意確認",
  executing: "実行中",
  on_hold: "保留",
  declined: "見送り",
};

export function sxPartnerStageLabel(stage: SxPartnerStage): string {
  return PARTNER_STAGE_LABEL[stage] || "未確認";
}

/** 段階と独立した運用状態。到達度と混ぜず、待ち先と停滞の管制に使う。 */
export const SX_PARTNER_ACTIVITY_STATE_ORDER = [
  "active",
  "waiting_partner",
  "waiting_internal",
  "stalled",
  "on_hold",
  "dropped",
  "unknown",
] as const satisfies readonly SxPartnerActivityState[];

const PARTNER_ACTIVITY_STATE_LABEL: Record<SxPartnerActivityState, string> = {
  active: "対応中",
  waiting_partner: "先方待ち",
  waiting_internal: "社内待ち",
  stalled: "停滞",
  on_hold: "保留",
  dropped: "見送り",
  unknown: "状態未確認",
};

export function sxPartnerActivityStateLabel(
  state: SxPartnerActivityState,
): string {
  return PARTNER_ACTIVITY_STATE_LABEL[state] || "状態未確認";
}

export const SX_POC_CATEGORY_ORDER = [
  "poc_candidate",
  "tech_partner",
  "sample_provider",
  "sample_route",
] as const satisfies readonly SxPocCategory[];

const POC_CATEGORY_LABEL: Record<SxPocCategory, string> = {
  poc_candidate: "PoC候補先",
  tech_partner: "技術協力先",
  sample_provider: "試料提供元",
  sample_route: "試料提供ルート",
};

export function sxPocCategoryLabel(category: SxPocCategory): string {
  return POC_CATEGORY_LABEL[category] || "区分未確認";
}

/** 分類の表示順。モーダルのチェックボックス群と一覧の分類タブが同じ順で並ぶ。 */
export const SX_PARTNER_CLASSIFICATION_ORDER = [
  "poc_candidate",
  "tech_partner",
  "sample_provider",
  "sample_route",
  "vc",
] as const satisfies readonly SxPartnerClassification[];

export function sxPartnerClassificationLabel(
  classification: SxPartnerClassification,
): string {
  if (classification === "vc") return "VC";
  return POC_CATEGORY_LABEL[classification] || "分類未確認";
}

const SAMPLE_STATUS_LABEL: Record<SxSampleStatus, string> = {
  intent: "提供意向あり",
  negotiating: "条件調整中",
  agreed_pending: "合意済・未取得",
  scheduled: "採取予定",
  received: "受領済み",
  analyzed: "分析済み",
  unknown: "状態未確認",
};

export const SX_SAMPLE_STATUS_ORDER = [
  "intent",
  "negotiating",
  "agreed_pending",
  "scheduled",
  "received",
  "analyzed",
  "unknown",
] as const satisfies readonly SxSampleStatus[];

export function sxSampleStatusLabel(status: SxSampleStatus): string {
  return SAMPLE_STATUS_LABEL[status] || "状態未確認";
}

/** 1-11の関係段階。保留・見送りは到達度ではないためnull。 */
export function sxPartnerStageIndex(stage: SxPartnerStage): number | null {
  if (stage === "on_hold" || stage === "declined") return null;
  const index = SX_PARTNER_STAGE_ORDER.findIndex(
    (candidate) => candidate === stage,
  );
  return index >= 0 ? index + 1 : null;
}

/** relationship_stageと低優先フラグに分裂した既存データを、比較表示では一つの保留状態へ正規化する。 */
export function sxPartnerIsOnHold(
  partner: Pick<
    SxManagementPartner,
    "relationshipStage" | "deferredLowPriority"
  >,
): boolean {
  return (
    partner.relationshipStage === "on_hold" ||
    partner.relationshipStage === "declined" ||
    partner.deferredLowPriority
  );
}

/** 「接触済み」という解釈をroleLabelへ預けず、一覧で確認できる接点記録の有無だけを返す。 */
export function sxPartnerHasContactRecord(
  partner: Pick<SxManagementPartner, "interactions" | "lastContactDate">,
): boolean {
  return partner.interactions.length > 0 || partner.lastContactDate != null;
}

/** VC表示は保存済みroleだけで判定し、名称や自由記述から推測しない。 */
export function sxIsVcPartner(
  partner: Pick<SxManagementPartner, "roles">,
): boolean {
  return partner.roles.some(
    (role) => role.roleKind === "shareholder_investor",
  );
}

export type SxPartnerAttentionKey =
  | "blocked"
  | "overdue"
  | "due_soon"
  | "on_hold"
  | "stale"
  | "unknown"
  | "due_unset"
  | "clear";

export type SxPartnerAttention = {
  key: SxPartnerAttentionKey;
  label: string;
  rank: number;
};

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.max(0, Math.floor((toMs - fromMs) / 86_400_000));
}

/** 既存の管理OSと同じ14日基準。未確認確度も、進捗ではなく情報鮮度の要対応として扱う。 */
export function sxPartnerNeedsRefresh(
  partner: Pick<SxManagementPartner, "lastVerifiedAt" | "confidence">,
  today: string,
): boolean {
  return (
    partner.confidence === "unknown" ||
    !partner.lastVerifiedAt ||
    daysBetween(partner.lastVerifiedAt, today) > 14
  );
}

export function sxPartnerHasOverdue(
  partner: SxManagementPartner,
  today: string,
): boolean {
  return (
    sxHoldingsForPartner(partner).some((item) =>
      sxIsHoldingOverdue(item, today),
    ) ||
    Boolean(
      partner.dueDate &&
      partner.dueDatePrecision === "day" &&
      partner.dueDate < today,
    )
  );
}

export function sxPartnerHasDueSoon(
  partner: SxManagementPartner,
  today: string,
): boolean {
  return (
    sxIsHoldingDueSoon(
      { dueDate: partner.dueDate, dueDatePrecision: partner.dueDatePrecision },
      today,
    ) ||
    sxHoldingsForPartner(partner).some((item) =>
      sxIsHoldingDueSoon(item, today),
    )
  );
}

export function sxPartnerHasDataGap(partner: SxManagementPartner): boolean {
  return (
    partner.currentBallSide === "unknown" ||
    (partner.currentBallSide !== "none" &&
      !(partner.currentBallOwner || "").trim()) ||
    sxPartnerDisplaySortKey(partner) === "9999-12-31"
  );
}

/**
 * 「進み具合」と混ぜない独立した要対応判定。
 * 低い関係段階や接点の少なさだけを遅れと断定せず、明示された停止・期限・判定材料不足だけで判定する。
 */
export function sxPartnerAttention(
  partner: SxManagementPartner,
  today: string,
): SxPartnerAttention {
  if (sxPartnerHasBlockedHolding(partner)) {
    return { key: "blocked", label: "停止", rank: 0 };
  }

  const holdings = sxHoldingsForPartner(partner);
  const overdueDates = holdings
    .filter((item) => sxIsHoldingOverdue(item, today))
    .map((item) => item.dueDate)
    .filter((value): value is string => Boolean(value));
  if (
    partner.dueDate &&
    partner.dueDatePrecision === "day" &&
    partner.dueDate < today
  )
    overdueDates.push(partner.dueDate);
  if (sxPartnerHasOverdue(partner, today)) {
    const oldest = overdueDates.sort()[0];
    const days = daysBetween(oldest, today);
    return {
      key: "overdue",
      label: days > 0 ? `期限超過 ${days}日` : "期限超過",
      rank: 1,
    };
  }

  if (sxPartnerHasDueSoon(partner, today)) {
    return { key: "due_soon", label: "7日以内", rank: 2 };
  }

  // 保留は到達段階ではなく運用状態。危険な停止・期限は先に拾い、平常の保留は
  // 担当/期限不足へ誤分類しない。
  if (sxPartnerIsOnHold(partner)) {
    return {
      key: "on_hold",
      label: partner.relationshipStage === "declined" ? "見送り" : "保留",
      rank: 3,
    };
  }

  if (sxPartnerNeedsRefresh(partner, today)) {
    return { key: "stale", label: "情報更新要", rank: 4 };
  }

  if (
    partner.currentBallSide === "unknown" ||
    (partner.currentBallSide !== "none" &&
      !(partner.currentBallOwner || "").trim())
  ) {
    return { key: "unknown", label: "担当未確認", rank: 5 };
  }

  const displayDue = sxPartnerDisplaySortKey(partner);
  if (displayDue === "9999-12-31") {
    return { key: "due_unset", label: "期限未設定", rank: 6 };
  }
  return { key: "clear", label: "期限内", rank: 7 };
}

/**
 * 確度はPoC候補先スプシの語彙 (確認済み / 推定 / 要確認) をそのまま正本にする。
 * 保存値が空・未知のときだけ「未確認」へ落とし、推定を確認済みへ丸めない。
 */
export const SX_PARTNER_CONFIDENCE_ORDER = [
  "high",
  "medium",
  "low",
  "unknown",
] as const;
export type SxPartnerConfidence = (typeof SX_PARTNER_CONFIDENCE_ORDER)[number];

export function sxNormalizePartnerConfidence(
  value: string | null | undefined,
): SxPartnerConfidence {
  return (SX_PARTNER_CONFIDENCE_ORDER as readonly string[]).includes(
    value || "",
  )
    ? (value as SxPartnerConfidence)
    : "unknown";
}

export function sxPartnerConfidenceLabel(value: string | null | undefined) {
  const labels: Record<SxPartnerConfidence, string> = {
    high: "確認済み",
    medium: "推定",
    low: "要確認",
    unknown: "未確認",
  };
  return labels[sxNormalizePartnerConfidence(value)];
}

/** 確度の高い順 (確認済み→推定→要確認→未確認)。数値が小さいほど確度が高い。 */
export function sxPartnerConfidenceRank(value: string | null | undefined) {
  return SX_PARTNER_CONFIDENCE_ORDER.indexOf(
    sxNormalizePartnerConfidence(value),
  );
}

/**
 * 攻める順番の判断2軸。confidence (情報の確からしさ) とは別物で、
 * likelihood = PoCをやらせてもらえそうか、value = 顧客として金になりそうか
 * (2026-08-06 まさ「このリストの上の方を優先的にアタックしていく設計」)。
 */
export const SX_POC_JUDGMENT_ORDER = ["high", "medium", "low"] as const;
export type SxPocJudgmentValue = (typeof SX_POC_JUDGMENT_ORDER)[number];

export function sxNormalizePocJudgment(
  value: string | null | undefined,
): SxPocJudgmentValue | null {
  return (SX_POC_JUDGMENT_ORDER as readonly string[]).includes(value || "")
    ? (value as SxPocJudgmentValue)
    : null;
}

export function sxPocLikelihoodLabel(value: string | null | undefined) {
  const normalized = sxNormalizePocJudgment(value);
  if (!normalized) return "未評価";
  return { high: "高い", medium: "五分", low: "低い" }[normalized];
}

export function sxCustomerValueLabel(value: string | null | undefined) {
  const normalized = sxNormalizePocJudgment(value);
  if (!normalized) return "未評価";
  return { high: "有望", medium: "中", low: "薄い" }[normalized];
}

/**
 * 関係先リスト最左の評価。unratedは「未」で、推測で埋めない。
 * 2026-08-06 まで likelihood×value の合成で出していたが、それは
 * 「排液がもらえるか」を過大評価していた。まさの判断基準は
 * 顧客として見込みがあるかが第一優先で、軸は (1)ペインの高さ
 * (2)単価の高い（需要の高い）重金属が排出されているか の2つ。
 * 排液提供の可否はそれより大幅に劣後する。よって合成をやめ、
 * poc_grade を人が直接付ける独立カラムにした。
 */
export type SxPocPriorityTier = "s" | "a" | "b" | "x" | "unrated";

// ✕ は「顧客候補として適さないと判明済み」なので、まだ見込みが分からない未評価より下へ置く
// (2026-08-06 まさ指示)。評価セルの選択肢の並び (SX_POC_GRADE_CHOICES) は S/A/B/✕/未 のまま。
const PRIORITY_TIER_ORDER: SxPocPriorityTier[] = ["s", "a", "b", "unrated", "x"];

export function sxPocPriorityTier(
  partner: Pick<SxManagementPartner, "pocGrade">,
): SxPocPriorityTier {
  const grade = partner.pocGrade;
  return grade === "s" || grade === "a" || grade === "b" || grade === "x"
    ? grade
    : "unrated";
}

export function sxPocPriorityTierLabel(tier: SxPocPriorityTier) {
  return { s: "S", a: "A", b: "B", x: "✕", unrated: "未" }[tier];
}

export function sxPocPriorityTierDescription(tier: SxPocPriorityTier) {
  return {
    s: "最優先。ペインが大きく、単価の高い重金属も出ている",
    a: "優先。顧客として見込みがある",
    b: "決め手に欠ける。様子見",
    x: "顧客としての見込みは薄い",
    unrated: "未評価。顧客として見込みがあるかを入れると並び順が決まる",
  }[tier];
}

export const SX_POC_GRADE_CHOICES: SxPocPriorityTier[] = [
  "s",
  "a",
  "b",
  "x",
  "unrated",
];

export function sxPocPriorityRank(
  partner: Pick<SxManagementPartner, "pocGrade">,
): number {
  return PRIORITY_TIER_ORDER.indexOf(sxPocPriorityTier(partner));
}

export type SxPocComparisonSort =
  | "progress"
  | "attention"
  | "confidence"
  | "priority";

/** PoC/VC比較タブの表示順。attentionでは旧固定段階をtie-breakにも使わない。 */
export function sxComparePartnersForPoc(
  left: SxManagementPartner,
  right: SxManagementPartner,
  today: string,
  sort: SxPocComparisonSort,
): number {
  const leftStage = sxPartnerIsOnHold(left)
    ? -1
    : (sxPartnerStageIndex(left.relationshipStage) ?? -1);
  const rightStage = sxPartnerIsOnHold(right)
    ? -1
    : (sxPartnerStageIndex(right.relationshipStage) ?? -1);
  const leftAttention = sxPartnerAttention(left, today).rank;
  const rightAttention = sxPartnerAttention(right, today).rank;
  const leftBall = left.currentBallSide === "sx" ? 0 : 1;
  const rightBall = right.currentBallSide === "sx" ? 0 : 1;

  if (sort === "progress" && leftStage !== rightStage)
    return rightStage - leftStage;
  if (sort === "priority") {
    const priorityCompare =
      sxPocPriorityRank(left) - sxPocPriorityRank(right);
    if (priorityCompare !== 0) return priorityCompare;
    // 評価が同じなら情報が新しい方を上に置く (2026-08-06 まさ指示)。
    // 同評価の中では、直近で確認した先ほどアタックの判断材料が揃っている。
    const freshnessCompare = (right.lastVerifiedAt || "").localeCompare(
      left.lastVerifiedAt || "",
    );
    if (freshnessCompare !== 0) return freshnessCompare;
    const recentContactCompare = (right.lastContactDate || "").localeCompare(
      left.lastContactDate || "",
    );
    if (recentContactCompare !== 0) return recentContactCompare;
  }
  if (sort === "confidence") {
    const confidenceCompare =
      sxPartnerConfidenceRank(left.confidence) -
      sxPartnerConfidenceRank(right.confidence);
    if (confidenceCompare !== 0) return confidenceCompare;
  }
  if (leftAttention !== rightAttention) return leftAttention - rightAttention;
  if (leftBall !== rightBall) return leftBall - rightBall;

  const dueCompare = sxPartnerDisplaySortKey(left).localeCompare(
    sxPartnerDisplaySortKey(right),
  );
  if (dueCompare !== 0) return dueCompare;
  const contactCompare = (right.lastContactDate || "").localeCompare(
    left.lastContactDate || "",
  );
  return contactCompare || left.name.localeCompare(right.name, "ja");
}

/**
 * 一覧はすでに左端で関係先を特定できるため、同じ会社名だけを文脈相対の「先方」へ短縮する。
 * 保存値と詳細履歴は変更せず、第三者名や人名も触らない。
 */
export function sxCompactPartnerRowText(
  value: string,
  partnerName: string,
): string {
  let result = value.trim() === partnerName.trim() ? "先方" : value;
  const name = partnerName.trim();
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result
      .replace(new RegExp(`${escaped}[（(]担当者[）)]`, "g"), "先方担当")
      .replace(new RegExp(`${escaped}担当者?`, "g"), "先方担当")
      .replace(
        new RegExp(`${escaped}(から|へ|に|と|が|の|は|を|より)`, "g"),
        "先方$1",
      );
  }
  return result.replaceAll("相手側", "先方").replaceAll("SX側", "当方");
}

export function sxCompactBallSideLabel(side: SxBallSide): string {
  const labels: Record<SxBallSide, string> = {
    sx: "当方",
    partner: "先方",
    shared: "双方",
    none: "なし",
    unknown: "未確認",
  };
  return labels[side] || "未確認";
}

export type SxPrimaryInterventionRisk =
  "blocked" | "overdue" | "due_soon" | "waiting" | "clear";

/**
 * 関係先一覧で action / side / owner / due / gate を同じ管理単位から読むための表示モデル。
 * holding が無い場合だけ partner 本体を fallback にし、構造化データが無い事実を隠さない。
 */
export type SxPartnerPrimaryIntervention = {
  recordId: string;
  source: "holding" | "partner_fallback";
  title: string;
  side: SxHoldingSide;
  ownerLabel: string | null;
  status: string;
  dueDate: string | null;
  dueDatePrecision: SxManagementPartner["dueDatePrecision"];
  relatedMilestoneId: string | null;
  relatedMilestoneSlug: string | null;
  lastVerifiedAt: string;
  risk: SxPrimaryInterventionRisk;
  hasStructuredHolding: boolean;
  hasConcreteAction: boolean;
};

function holdingPriorityTier(item: SxHoldingItem, today: string): number {
  if (item.status === "blocked") return 0;
  if (sxIsHoldingOverdue(item, today)) return 1;
  if (item.dueDatePrecision === "day" && item.dueDate) return 2;
  if (item.dueDatePrecision === "month" && item.dueDate) return 3;
  return 4;
}

function holdingRisk(
  item: SxHoldingItem,
  today: string,
): SxPrimaryInterventionRisk {
  if (item.status === "blocked") return "blocked";
  if (sxIsHoldingOverdue(item, today)) return "overdue";
  if (sxIsHoldingDueSoon(item, today)) return "due_soon";
  if (item.status === "waiting" || item.status === "on_hold") return "waiting";
  return "clear";
}

/**
 * 主要対応事項を1件だけ選ぶ。
 * 停止 > 期限超過 > 日付確定 > 月精度 > 期限なしを守り、同じtier内だけ現在ボール側を優先する。
 * これにより、表示中の行動・担当・期限が別レコードから寄せ集められる事故を防ぐ。
 */
export function sxPartnerPrimaryIntervention(
  partner: SxManagementPartner,
  today: string,
): SxPartnerPrimaryIntervention {
  const sorted = sxSortHoldingsByPriority(sxHoldingsForPartner(partner), today);
  if (sorted.length > 0) {
    const topTier = holdingPriorityTier(sorted[0], today);
    const sameTier = sorted.filter(
      (item) => holdingPriorityTier(item, today) === topTier,
    );
    const ballSide =
      partner.currentBallSide === "none" ? null : partner.currentBallSide;
    const selected =
      (ballSide ? sameTier.find((item) => item.side === ballSide) : null) ||
      sameTier[0];
    return {
      recordId: selected.id,
      source: "holding",
      title: selected.title,
      side: selected.side,
      ownerLabel: selected.ownerLabel,
      status: selected.status,
      dueDate: selected.dueDate,
      dueDatePrecision: selected.dueDatePrecision,
      relatedMilestoneId: selected.relatedMilestoneId,
      relatedMilestoneSlug: null,
      lastVerifiedAt: selected.lastVerifiedAt,
      risk: holdingRisk(selected, today),
      hasStructuredHolding: true,
      hasConcreteAction: Boolean(selected.title.trim()),
    };
  }

  const fallbackTitle = partner.nextCommitment.trim();
  const fallbackSide: SxHoldingSide =
    partner.currentBallSide === "none" ? "unknown" : partner.currentBallSide;
  const fallbackOwner =
    (partner.currentBallOwner || partner.ownerLabel || "").trim() || null;
  const fallbackDue = {
    dueDate: partner.dueDate,
    dueDatePrecision: partner.dueDatePrecision,
  };
  const risk: SxPrimaryInterventionRisk = sxIsHoldingOverdue(fallbackDue, today)
    ? "overdue"
    : sxIsHoldingDueSoon(fallbackDue, today)
      ? "due_soon"
      : "clear";
  return {
    recordId: partner.id,
    source: "partner_fallback",
    title: fallbackTitle || "次の具体行動 未登録",
    side: fallbackSide,
    ownerLabel: fallbackOwner,
    status: "unstructured",
    dueDate: partner.dueDate,
    dueDatePrecision: partner.dueDatePrecision,
    relatedMilestoneId: null,
    // The partner-level fallback fields are independent facts. Do not attach an
    // arbitrary related gate and make it look like one structured holding.
    relatedMilestoneSlug: null,
    lastVerifiedAt: partner.lastVerifiedAt,
    risk,
    hasStructuredHolding: false,
    hasConcreteAction: Boolean(fallbackTitle),
  };
}

export type SxPartnerOwnerLoad = {
  ownerKey: string;
  ownerLabel: string;
  openCount: number;
  dangerCount: number;
  dueSoonCount: number;
  dataGapCount: number;
  partnerIds: string[];
};

function ownerDisplayLabel(value: string | null): string {
  const label = (value || "").trim();
  return !label || /未確認|未設定|未登録/.test(label) ? "担当未確認" : label;
}

/** 担当者別に未完了事項を集計する。holdingが無い先も管制情報不足として1件残す。 */
export function sxPartnerOwnerLoads(
  partners: SxManagementPartner[],
  today: string,
): SxPartnerOwnerLoad[] {
  const loads = new Map<
    string,
    Omit<SxPartnerOwnerLoad, "partnerIds"> & { partnerIds: Set<string> }
  >();
  for (const partner of partners) {
    const holdings = sxHoldingsForPartner(partner);
    const fallback =
      holdings.length === 0
        ? sxPartnerPrimaryIntervention(partner, today)
        : null;
    const items =
      holdings.length > 0
        ? holdings.map((item) => ({
            ownerLabel: item.ownerLabel,
            risk: holdingRisk(item, today),
            dataGap: false,
          }))
        : [
            {
              ownerLabel: fallback?.ownerLabel || null,
              risk: fallback?.risk || "clear",
              dataGap: true,
            },
          ];
    for (const item of items) {
      const ownerLabel = ownerDisplayLabel(item.ownerLabel);
      const ownerKey = ownerLabel;
      const current = loads.get(ownerKey) || {
        ownerKey,
        ownerLabel,
        openCount: 0,
        dangerCount: 0,
        dueSoonCount: 0,
        dataGapCount: 0,
        partnerIds: new Set<string>(),
      };
      current.openCount += 1;
      if (item.risk === "blocked" || item.risk === "overdue")
        current.dangerCount += 1;
      if (item.risk === "due_soon") current.dueSoonCount += 1;
      if (item.dataGap || ownerLabel === "担当未確認")
        current.dataGapCount += 1;
      current.partnerIds.add(partner.id);
      loads.set(ownerKey, current);
    }
  }
  return [...loads.values()]
    .map((load) => ({ ...load, partnerIds: [...load.partnerIds] }))
    .sort(
      (left, right) =>
        right.dangerCount - left.dangerCount ||
        right.dueSoonCount - left.dueSoonCount ||
        right.openCount - left.openCount ||
        left.ownerLabel.localeCompare(right.ownerLabel, "ja"),
    );
}
