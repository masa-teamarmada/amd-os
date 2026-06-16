/**
 * 別財布（別契約）売上 (billing_cycles.extra_revenue_json) の按分共通ロジック。
 *
 * 本契約 (定額/変動) とは別枠の単発受託売上を、開発期間 (period_start_ym〜period_end_ym)
 * で月次按分して各月へ展開する。pt 消化と同じ「期間で割る」思想 (B-a, 2026-06-16 まさ確定)。
 * PL 計上もキャッシュ入金も同じ按分月。period 未指定なら billing_cycles.ym へ一括 (後方互換)。
 *
 * この計算は PJ 収支を出す全コンポーネントで共有する。過去 (2026-06-17)、按分を
 * `/management-score` の live builder にだけ実装し `/admin/payouts` の独自 forecast に
 * 入れ忘れて横ばい表示になった事故があった。ロジックを 1 箇所に集約して両系統が同じ
 * 関数を呼ぶことで再発を防ぐ (詳細: pwa/BUGS.md 2026-06-17)。
 */

/** billing_cycles.extra_revenue_json の 1 要素 (= 別財布売上) */
export type ExtraRevenueEntry = {
  label?: string | null;
  amount_tax_excl?: number | string | null;
  freee_invoice_number?: string | null;
  billing_date?: string | null;
  memo?: string | null;
  /**
   * 開発期間按分 (B-a)。period_start_ym〜period_end_ym を指定すると amount_tax_excl を
   * 期間月数で割り、各月に均等配分する。端数は最終月に寄せる。形式は "YYYYMM" (例: "202605")。
   * 両方未指定なら従来どおり fallbackYm に一括計上 (後方互換)。
   */
  period_start_ym?: string | null;
  period_end_ym?: string | null;
};

function num(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function ymToInt(ym: string | number | null | undefined): number | null {
  if (ym == null) return null;
  const n = Number(ym);
  return Number.isFinite(n) ? n : null;
}

/** YYYYMM 整数の翌月 (年跨ぎ対応)。例: 202612 -> 202701 */
export function nextYmInt(ym: number): number {
  const y = Math.floor(ym / 100);
  const m = ym % 100;
  return m >= 12 ? (y + 1) * 100 + 1 : y * 100 + (m + 1);
}

/** start..end (両端含む) の月数。例: 202605..202610 = 6 */
export function monthsBetween(start: number, end: number): number {
  const ys = Math.floor(start / 100);
  const ms = start % 100;
  const ye = Math.floor(end / 100);
  const me = end % 100;
  return (ye - ys) * 12 + (me - ms) + 1;
}

/** 按分後の 1 月分 (= projectId × ym ごとに集約済み) */
export type ExpandedExtraRevenue = {
  projectId: string;
  ym: number;
  amount: number;
  /** 同 (projectId, ym) に複数 entry が乗る場合は label を連結 */
  labels: string[];
};

export type ExtraRevenueSourceRow = {
  project_id: string;
  /** 期間未指定 entry の一括計上先 (= billing_cycles.ym) */
  ym: string | number;
  extra_revenue_json: ExtraRevenueEntry[] | null;
};

export interface ExpandExtraRevenueOptions {
  /** この月以上だけ残す (シミュレーション/表示の開始月、YYYYMM 整数)。未指定なら下限なし */
  minYm?: number;
  /** この月以下だけ残す (終了月、YYYYMM 整数)。未指定なら上限なし */
  maxYm?: number;
}

/**
 * extra_revenue_json を持つ billing_cycles 行群を受け取り、period 按分を展開して
 * (projectId, ym) ごとに集約した別財布売上の配列を返す。
 *
 * 按分元行の ym と按分先 period は別月になりうる (例: ym=202603 の行に period 202605〜202610)。
 * そのため呼び出し側は「extra_revenue_json IS NOT NULL の全行」を渡すこと。表示期間で
 * 絞るのは minYm/maxYm で行う (按分元を期間で絞ると元データを取りこぼす)。
 */
export function expandExtraRevenue(
  rows: ExtraRevenueSourceRow[],
  options: ExpandExtraRevenueOptions = {}
): ExpandedExtraRevenue[] {
  const { minYm, maxYm } = options;
  const byPjYm = new Map<string, { amount: number; labels: Set<string> }>();

  const add = (projectId: string, ym: number, amount: number, label: string) => {
    if (minYm != null && ym < minYm) return;
    if (maxYm != null && ym > maxYm) return;
    if (!Number.isFinite(amount) || amount === 0) return;
    const key = `${projectId}:${ym}`;
    const cur = byPjYm.get(key) ?? { amount: 0, labels: new Set<string>() };
    cur.amount += amount;
    if (label) cur.labels.add(label);
    byPjYm.set(key, cur);
  };

  for (const row of rows) {
    const entries = Array.isArray(row.extra_revenue_json) ? row.extra_revenue_json : [];
    const fallbackYm = Number(row.ym);
    for (const e of entries) {
      const total = num(e?.amount_tax_excl);
      if (total <= 0) continue;
      const label = typeof e?.label === "string" && e.label.length > 0 ? e.label : "別財布売上";
      const pStart = ymToInt(e?.period_start_ym);
      const pEnd = ymToInt(e?.period_end_ym);
      if (pStart != null && pEnd != null && pEnd >= pStart) {
        // 開発期間で月次按分。端数は最終月に寄せる (pt 消化と同じ思想)。
        const periodMonths = monthsBetween(pStart, pEnd);
        const per = Math.floor(total / periodMonths);
        let ym = pStart;
        for (let i = 0; i < periodMonths; i++) {
          const amount = i === periodMonths - 1 ? total - per * (periodMonths - 1) : per;
          add(row.project_id, ym, amount, label);
          ym = nextYmInt(ym);
        }
      } else {
        // 期間指定なし → fallbackYm へ一括 (後方互換)。
        add(row.project_id, fallbackYm, total, label);
      }
    }
  }

  return [...byPjYm.entries()].map(([key, val]) => {
    const [projectId, ymStr] = key.split(":");
    return {
      projectId,
      ym: Number(ymStr),
      amount: val.amount,
      labels: [...val.labels],
    };
  });
}
