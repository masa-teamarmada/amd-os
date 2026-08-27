// 年月（YYYYMM）の表示ヘルパーだけ。お金・支払ルールには一切関わらない。
//
// ここに「支払月 → 稼働月」の解決や支払日の計算を戻さないこと。
// それは AMD OS 本体の責務で、kiyo-admin は本体が確定させた結果を読むだけ。

export const YM_RE = /^[0-9]{6}$/;

function addMonths(ym: string, delta: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function cleanYm(value: string | null | undefined): string | null {
  const ym = (value ?? "").trim();
  return YM_RE.test(ym) ? ym : null;
}

/** JST の現在年月（YYYYMM） */
export function currentYmJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** YYYYMM を "2026年7月" 形式に */
export function ymLabel(ym: string): string {
  if (!YM_RE.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

export function shiftYm(ym: string, delta: number): string {
  return YM_RE.test(ym) ? addMonths(ym, delta) : ym;
}
