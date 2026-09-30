// DD画面の表示用の小さな整形（純関数）。

import type { DdLiveData } from "@/lib/dd-payload";

/** 日付を日本時間の「2026年9月30日」で出す。読めない値は「—」。 */
export function formatDdDate(value: string | null | undefined): string {
  if (!value) return "—";
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00+09:00` : value);
  if (!Number.isFinite(ms)) return "—";
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ms));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}年${pick("month")}月${pick("day")}日`;
}

export function formatDdBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 元データの説明（投資家向けの言葉）。社内の表名・IDは出さない。 */
export function ddSourceDescription(data: DdLiveData): string {
  switch (data.kind) {
    case "document":
      return "資料（資料室の最新のファイル）";
    case "tech_topic":
      return "技術台帳のページ（最新）";
    case "funding_plan":
      return data.plan.summary.asOf ? `資金計画（${data.plan.summary.asOf}改定の計画値）` : "資金計画";
    case "capital_policy":
      return data.basis === "frozen"
        ? `資本政策表（提出版 v${data.frozenVersion ?? "?"}）`
        : `資本政策表（作業中の案 第${data.planRevision ?? "?"}版・最新）`;
    case "cost_model": {
      const label = data.costKind === "fuel" ? "コスト試算（燃料）" : "コスト試算";
      return data.bundle.model.versionLabel ? `${label}（${data.bundle.model.versionLabel}版）` : label;
    }
  }
}
