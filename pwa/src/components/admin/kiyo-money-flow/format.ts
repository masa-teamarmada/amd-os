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
