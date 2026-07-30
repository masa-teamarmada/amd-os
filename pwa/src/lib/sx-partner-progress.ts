import type { SxBallSide, SxManagementPartner, SxPartnerStage } from "./sx-management";
import {
  sxHoldingsForPartner,
  sxIsHoldingDueSoon,
  sxIsHoldingOverdue,
  sxPartnerDisplaySortKey,
  sxPartnerHasBlockedHolding,
} from "./sx-partner-holdings.ts";

/**
 * 全関係先で共有する比較軸。PoC固有の業務段階ではなく、関係形成の現在地を表す。
 * on_holdは到達段階ではないため、この7段階へ混ぜず状態として重ねる。
 */
export const SX_PARTNER_STAGE_ORDER = [
  "candidate",
  "information_exchange",
  "condition_alignment",
  "meeting_coordination",
  "validation_preparation",
  "agreement_confirmation",
  "executing",
] as const satisfies readonly SxPartnerStage[];

const PARTNER_STAGE_LABEL: Record<SxPartnerStage, string> = {
  candidate: "候補",
  information_exchange: "情報交換",
  condition_alignment: "条件整理",
  meeting_coordination: "面談調整",
  validation_preparation: "検証準備",
  agreement_confirmation: "合意確認",
  executing: "実行中",
  on_hold: "保留",
};

export function sxPartnerStageLabel(stage: SxPartnerStage): string {
  return PARTNER_STAGE_LABEL[stage] || "未確認";
}

/** 1-7の関係段階。保留は到達度ではないためnull。 */
export function sxPartnerStageIndex(stage: SxPartnerStage): number | null {
  if (stage === "on_hold") return null;
  const index = SX_PARTNER_STAGE_ORDER.findIndex((candidate) => candidate === stage);
  return index >= 0 ? index + 1 : null;
}

/** relationship_stageと低優先フラグに分裂した既存データを、比較表示では一つの保留状態へ正規化する。 */
export function sxPartnerIsOnHold(partner: Pick<SxManagementPartner, "relationshipStage" | "deferredLowPriority">): boolean {
  return partner.relationshipStage === "on_hold" || partner.deferredLowPriority;
}

/** 「接触済み」という解釈をroleLabelへ預けず、一覧で確認できる接点記録の有無だけを返す。 */
export function sxPartnerHasContactRecord(partner: Pick<SxManagementPartner, "interactions" | "lastContactDate">): boolean {
  return partner.interactions.length > 0 || partner.lastContactDate != null;
}

export type SxPartnerAttentionKey = "blocked" | "overdue" | "due_soon" | "on_hold" | "stale" | "unknown" | "due_unset" | "clear";

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
  return partner.confidence === "unknown" || !partner.lastVerifiedAt || daysBetween(partner.lastVerifiedAt, today) > 14;
}

export function sxPartnerHasOverdue(partner: SxManagementPartner, today: string): boolean {
  return sxHoldingsForPartner(partner).some((item) => sxIsHoldingOverdue(item, today))
    || Boolean(partner.dueDate && partner.dueDatePrecision === "day" && partner.dueDate < today);
}

export function sxPartnerHasDueSoon(partner: SxManagementPartner, today: string): boolean {
  return sxIsHoldingDueSoon({ dueDate: partner.dueDate, dueDatePrecision: partner.dueDatePrecision }, today)
    || sxHoldingsForPartner(partner).some((item) => sxIsHoldingDueSoon(item, today));
}

export function sxPartnerHasDataGap(partner: SxManagementPartner): boolean {
  return partner.currentBallSide === "unknown"
    || (partner.currentBallSide !== "none" && !(partner.currentBallOwner || "").trim())
    || sxPartnerDisplaySortKey(partner) === "9999-12-31";
}

/**
 * 「進み具合」と混ぜない独立した要対応判定。
 * 低い関係段階や接点の少なさだけを遅れと断定せず、明示された停止・期限・判定材料不足だけで判定する。
 */
export function sxPartnerAttention(partner: SxManagementPartner, today: string): SxPartnerAttention {
  if (sxPartnerHasBlockedHolding(partner)) {
    return { key: "blocked", label: "停止", rank: 0 };
  }

  const holdings = sxHoldingsForPartner(partner);
  const overdueDates = holdings
    .filter((item) => sxIsHoldingOverdue(item, today))
    .map((item) => item.dueDate)
    .filter((value): value is string => Boolean(value));
  if (partner.dueDate && partner.dueDatePrecision === "day" && partner.dueDate < today) overdueDates.push(partner.dueDate);
  if (sxPartnerHasOverdue(partner, today)) {
    const oldest = overdueDates.sort()[0];
    const days = daysBetween(oldest, today);
    return { key: "overdue", label: days > 0 ? `期限超過 ${days}日` : "期限超過", rank: 1 };
  }

  if (sxPartnerHasDueSoon(partner, today)) {
    return { key: "due_soon", label: "7日以内", rank: 2 };
  }

  // 保留は到達段階ではなく運用状態。危険な停止・期限は先に拾い、平常の保留は
  // 担当/期限不足へ誤分類しない。
  if (sxPartnerIsOnHold(partner)) {
    return { key: "on_hold", label: "保留", rank: 3 };
  }

  if (sxPartnerNeedsRefresh(partner, today)) {
    return { key: "stale", label: "情報更新要", rank: 4 };
  }

  if (
    partner.currentBallSide === "unknown"
    || (partner.currentBallSide !== "none" && !(partner.currentBallOwner || "").trim())
  ) {
    return { key: "unknown", label: "担当未確認", rank: 5 };
  }

  const displayDue = sxPartnerDisplaySortKey(partner);
  if (displayDue === "9999-12-31") {
    return { key: "due_unset", label: "期限未設定", rank: 6 };
  }
  return { key: "clear", label: "期限内", rank: 7 };
}

export type SxPocComparisonSort = "progress" | "attention";

/** PoC比較レンズ専用の表示順。母データや役割分類は変えない。 */
export function sxComparePartnersForPoc(
  left: SxManagementPartner,
  right: SxManagementPartner,
  today: string,
  sort: SxPocComparisonSort,
): number {
  const leftStage = sxPartnerIsOnHold(left) ? -1 : (sxPartnerStageIndex(left.relationshipStage) ?? -1);
  const rightStage = sxPartnerIsOnHold(right) ? -1 : (sxPartnerStageIndex(right.relationshipStage) ?? -1);
  const leftAttention = sxPartnerAttention(left, today).rank;
  const rightAttention = sxPartnerAttention(right, today).rank;
  const leftBall = left.currentBallSide === "sx" ? 0 : 1;
  const rightBall = right.currentBallSide === "sx" ? 0 : 1;

  if (sort === "progress" && leftStage !== rightStage) return rightStage - leftStage;
  if (leftAttention !== rightAttention) return leftAttention - rightAttention;
  if (leftBall !== rightBall) return leftBall - rightBall;
  if (sort === "attention" && leftStage !== rightStage) return rightStage - leftStage;

  const dueCompare = sxPartnerDisplaySortKey(left).localeCompare(sxPartnerDisplaySortKey(right));
  if (dueCompare !== 0) return dueCompare;
  const contactCompare = (right.lastContactDate || "").localeCompare(left.lastContactDate || "");
  return contactCompare || left.name.localeCompare(right.name, "ja");
}

/**
 * 一覧はすでに左端で関係先を特定できるため、同じ会社名だけを文脈相対の「先方」へ短縮する。
 * 保存値と詳細履歴は変更せず、第三者名や人名も触らない。
 */
export function sxCompactPartnerRowText(value: string, partnerName: string): string {
  let result = value.trim() === partnerName.trim() ? "先方" : value;
  const name = partnerName.trim();
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result
      .replace(new RegExp(`${escaped}[（(]担当者[）)]`, "g"), "先方担当")
      .replace(new RegExp(`${escaped}担当者?`, "g"), "先方担当")
      .replace(new RegExp(`${escaped}(から|へ|に|と|が|の|は|を|より)`, "g"), "先方$1");
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
