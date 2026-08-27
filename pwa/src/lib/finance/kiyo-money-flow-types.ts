/**
 * きよ「00 お金の流れ」タブの型定義 (server / client 共有)。
 * server 側の実装は kiyo-money-flow.ts ("server-only")、ここは型だけなので
 * クライアントコンポーネントから直接 import してよい。
 *
 * 【この画面が答える2つの問い】
 * - 事業として儲かっているか = 損益 (pl)。freee会計の試算表と取引先別売上から作る
 * - 口座のお金は足りているか = 現金 (cash)。freee取引履歴の入出金と残高から作る
 * 同じ月でも両者は一致しない (入金の遅れ、費用でない出金、まだ出ていない費用)。
 */

export type KiyoMoneyFlowPeriodKind = "month" | "season" | "all";

export type KiyoMoneyFlowRange = {
  kind: KiyoMoneyFlowPeriodKind;
  label: string;
  startYm: string | null;
  endYm: string | null;
  /** 集計対象の月。実データがある月だけ */
  months: string[];
  seasonSource: "amd_plan_cycle" | "fallback_month" | null;
};

/** 売上の相手先 (freee取引の取引先)。PJ名ではなく請求先の名前 */
export type KiyoMoneyFlowRevenueRow = { name: string; amountYen: number; partnerId: string | null };

export type KiyoMoneyFlowCostRow = { name: string; amountYen: number };

export type KiyoMoneyFlowCostGroupKey = "officer" | "member" | "opex" | "tax";

export type KiyoMoneyFlowCostGroup = {
  key: KiyoMoneyFlowCostGroupKey;
  label: string;
  amountYen: number;
  rows: KiyoMoneyFlowCostRow[];
  note: string;
};

export type KiyoMoneyFlowMonthRow = {
  ym: string;
  revenueYen: number;
  costYen: number;
  profitYen: number;
  cashInYen: number;
  cashOutYen: number;
  cashNetYen: number;
  /** その月の給与仕訳が会計に入っていない (翌月25日払いの給与が未確定) */
  officerPayMissing: boolean;
};

export type KiyoMoneyFlowResult = {
  range: KiyoMoneyFlowRange;
  /** 事業のもうけ。freee会計に計上済みの売上と費用 */
  pl: {
    revenueTotalYen: number;
    revenueByPartner: KiyoMoneyFlowRevenueRow[];
    /** 営業外収益 (受取利息・雑収入)。どこから来たかには混ぜず、合計にだけ足す */
    otherIncomeYen: number;
    costTotalYen: number;
    costGroups: KiyoMoneyFlowCostGroup[];
    profitYen: number;
  };
  /** 口座のお金。損益とは別物 */
  cash: {
    inflowYen: number;
    outflowYen: number;
    netYen: number;
    balanceYen: number | null;
    balanceYm: string | null;
    /** 期間の全月ぶんの取引履歴が揃っているか */
    complete: boolean;
  };
  /** 月ごとの推移。期間が2か月以上のときだけ中身が入る */
  monthly: KiyoMoneyFlowMonthRow[];
  summaryText: string;
  note: string;
  warnings: string[];
  computedAtIso: string;
};

export type KiyoMoneyFlowResponse = { ok: true } & KiyoMoneyFlowResult | { ok: false; error: string };
