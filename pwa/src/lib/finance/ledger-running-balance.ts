/**
 * 口座の入出金明細から残高を積み上げる純関数。DB も fetch も触らない。
 * 正本は pwa/manual/6-13-cash-and-loans-spec.md の「残高はその場で積み上げ直す」。
 *
 * `/admin/cash` の画面 (cash-and-loans.ts) と、月末残高の取り込み (freee-cash-balances.ts) の
 * 両方から呼ぶ。商工中金のように freee とつなげない口座は、ここで積み上げた残高が正になる。
 */

export type LedgerRow = {
  id: string;
  entry_date: string;
  seq: number;
  deposit: number | string | null;
  withdrawal: number | string | null;
  balance: number | string | null;
  source: string;
  source_row: number | null;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 残高の積み上げは日付順。同じ日の中だけ、取り込み元の行番号 (無ければ seq) で並べる。
 * OS 上で足した行が正しい位置に入るようにするため、ここは日付を主にする。
 */
export function sortLedgerRows<T extends LedgerRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    const ao = a.source_row ?? a.seq + 1_000_000;
    const bo = b.source_row ?? b.seq + 1_000_000;
    return ao - bo;
  });
}

export type LedgerRunning = {
  /** 日付順 (同じ日は取り込み元の行番号順) に並べた行。 */
  ordered: LedgerRow[];
  /** 行ごとの、その行までを積み上げた残高。 */
  runningById: Map<string, number>;
  /** その行で新しく生じたズレ。スプレッドシートの残高と積み上げが食い違う行だけに入る。 */
  gapStepById: Map<string, number>;
};

export function computeLedgerRunning(rows: LedgerRow[]): LedgerRunning {
  const ordered = sortLedgerRows(rows);

  // 期首残高: 残高が入っている最初の行から、そこまでの増減を差し引いて逆算する。
  const first = ordered.find((r) => r.balance != null);
  let opening = first ? num(first.balance) - num(first.deposit) + num(first.withdrawal) : 0;
  if (first) {
    for (const r of ordered) {
      if (r.id === first.id) break;
      opening -= num(r.deposit) - num(r.withdrawal);
    }
  }

  // freee 由来の行だけは、そこに書かれている残高 (銀行の実残高) で積み上げを合わせ直す。
  const runningById = new Map<string, number>();
  const gapStepById = new Map<string, number>();
  let acc = opening;
  let previousGap = 0;
  for (const r of ordered) {
    const moved = num(r.deposit) - num(r.withdrawal);
    if (r.source === "freee" && r.balance != null) {
      const before = acc + moved;
      const diff = num(r.balance) - before;
      if (diff !== 0) gapStepById.set(r.id, diff);
      acc = num(r.balance);
      previousGap = 0;
    } else {
      acc += moved;
      if (r.balance != null) {
        const gap = num(r.balance) - acc;
        gapStepById.set(r.id, gap - previousGap);
        previousGap = gap;
      }
    }
    runningById.set(r.id, acc);
  }
  return { ordered, runningById, gapStepById };
}

/** その日の終わりの残高。その日までに1行も無ければ null。 */
export function ledgerBalanceOn(running: LedgerRunning, date: string): number | null {
  let balance: number | null = null;
  for (const r of running.ordered) {
    if (r.entry_date > date) break;
    balance = running.runningById.get(r.id) ?? balance;
  }
  return balance;
}
