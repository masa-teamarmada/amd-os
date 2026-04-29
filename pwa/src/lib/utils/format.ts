/** JST (UTC+9) での現在年月を "YYYY-MM" で返す */
export function currentYmJST(): string {
  return new Date()
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .slice(0, 7);
}

/** 円表示: 1200000 → "¥1.2M", 800000 → "¥800K", 50000 → "¥50K" */
export function formatYen(amount: number | null): string {
  if (amount == null) return "—";
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `¥${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `¥${Math.round(amount / 1_000)}K`;
  }
  return `¥${amount.toLocaleString()}`;
}

/** 日付文字列を MM/DD に変換 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

/** JST 現在日 */
export function currentDayJST(): number {
  return new Date(
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
  ).getDate();
}
