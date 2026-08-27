// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。

/** 万円丸め表示。ドリルダウンの明細だけ円表示にするので円用フォーマッタも用意する。 */
export function formatManYen(yen: number): string {
  return `${Math.round(yen / 10000).toLocaleString("ja-JP")}万円`;
}

export function formatYen(yen: number): string {
  return `${Math.round(yen).toLocaleString("ja-JP")}円`;
}

export function formatYmLabel(ym: string | null | undefined): string {
  if (!ym || !/^\d{6}$/.test(ym)) return "";
  return `${ym.slice(0, 4)}年${ym.slice(4, 6)}月`;
}
