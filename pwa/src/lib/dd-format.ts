// DD画面の表示用の小さな整形（純関数）。

import type { DdItemKind } from "@/lib/dd-package-core";

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

/** 金額を本文用に「1億円」「5,000万円」で出す（表とグラフは百万円）。 */
export function formatDdYen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "未定";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}億円`;
  if (abs >= 1e4) return `${Math.round(value / 1e4).toLocaleString("ja-JP")}万円`;
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** 表用の百万円表記（小数1桁）。 */
export function formatDdMillion(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return (value / 1e6).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatDdPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatDdShares(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("ja-JP");
}

/** 元データの説明（投資家向けの言葉）。社内の表名・IDは出さない。 */
export function ddSourceDescription(kind: DdItemKind, payload: Record<string, unknown>): string {
  switch (kind) {
    case "document":
      return "資料（公開時点のファイルを固定）";
    case "tech_topic":
      return "技術台帳のページ";
    case "funding_plan": {
      const plan = payload.plan as { summary?: { version?: string; asOf?: string } } | undefined;
      return plan?.summary?.asOf ? `資金計画（${plan.summary.asOf}改定の計画値）` : "資金計画";
    }
    case "capital_policy": {
      if (payload.basis === "frozen") return `資本政策表（提出版 v${String(payload.frozenVersion ?? "?")}）`;
      return `資本政策表（作業中の案 第${String(payload.planRevision ?? "?")}版を固定）`;
    }
    case "cost_model": {
      const model = payload.model as { versionLabel?: string | null } | undefined;
      return model?.versionLabel ? `コスト試算（${model.versionLabel}）` : "コスト試算";
    }
  }
}
