/**
 * 現預金アンカー (freee 実残高でモデル残高を置き換える起点) の単一正本。
 *
 * ## なぜ「締まった月」に限定するか
 * `company_actual_monthly` の `category='cash_balance'` は freee 口座取引から日次で
 * 取り込まれる。つまり**当月の行は「月中のある日の残高」**であって月末残高ではない。
 * これをアンカーにすると、アンカー月の netCashFlow を丸ごと捨てるため、
 * その月にこれから起きる支払い (支払義務・消費税納付・役員報酬など) が
 * 全部消えて現預金が過大に出る。
 *
 * 例 (2026-08-16 実測): 当月アンカーだと 2027-03 末 3,781,084 円、
 * 締まった月 (2026-07 末 2,214,797 円) アンカーだと 2,199,236 円。差 約158万円。
 *
 * よって既定は「当月より前の最新の実績月」= 月末が確定した月をアンカーにする。
 * 締まった月の実績が1件も無いときだけ当月残高にフォールバックし、
 * `kind: "in_month_balance"` を立てて画面側で注記できるようにする。
 */

export type CashAnchorKind = "settled_month_end" | "in_month_balance";

export type CashAnchorSourceRow = {
  ym: number | string;
  /** freee 実残高 (無い月は null) */
  actualCash: number | null | undefined;
  /** モデル上の月末残高 */
  modelCash: number;
};

export type CashAnchorPoint = {
  index: number;
  ym: number;
  actualCash: number;
  modelCash: number;
  /** 実残高 − モデル残高 */
  variance: number;
  kind: CashAnchorKind;
};

/** JST の当月を YYYYMM の数値で返す */
export function currentYmJst(now: Date = new Date()): number {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCFullYear() * 100 + (jst.getUTCMonth() + 1);
}

function toYmNumber(ym: number | string): number {
  const n = Number(ym);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * アンカーにする行を決める。
 * 1. 実績があり ym < 当月 の最新月 → "settled_month_end" (既定)
 * 2. それが無ければ実績のある最新月 → "in_month_balance" (劣化モード)
 */
export function resolveCashAnchor(
  rows: CashAnchorSourceRow[],
  currentYm: number = currentYmJst()
): CashAnchorPoint | null {
  let settled = -1;
  let latest = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const cash = rows[index].actualCash;
    if (cash == null || !Number.isFinite(Number(cash))) continue;
    latest = index;
    const ym = toYmNumber(rows[index].ym);
    if (Number.isFinite(ym) && ym < currentYm) settled = index;
  }
  const index = settled >= 0 ? settled : latest;
  if (index < 0) return null;
  const row = rows[index];
  const actualCash = Number(row.actualCash);
  return {
    index,
    ym: toYmNumber(row.ym),
    actualCash,
    modelCash: row.modelCash,
    variance: actualCash - row.modelCash,
    kind: settled >= 0 ? "settled_month_end" : "in_month_balance",
  };
}

/**
 * アンカー以降の現預金残高を前進計算する。
 * 戻り値はモデル行と同じ長さ。アンカーより前は null (= モデル値をそのまま使う)。
 * アンカー月は実残高そのもの (月末確定値)。以降は `+= netCashFlow`。
 */
export function projectCashFromAnchor(
  netCashFlows: number[],
  anchor: CashAnchorPoint | null
): (number | null)[] {
  const out: (number | null)[] = netCashFlows.map(() => null);
  if (!anchor || anchor.index < 0 || anchor.index >= netCashFlows.length) return out;
  let running = anchor.actualCash;
  out[anchor.index] = running;
  for (let index = anchor.index + 1; index < netCashFlows.length; index += 1) {
    running += Number(netCashFlows[index] ?? 0);
    out[index] = running;
  }
  return out;
}
