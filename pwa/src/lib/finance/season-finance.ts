import { expandExtraRevenue, type ExtraRevenueEntry } from "@/lib/finance/extra-revenue";

export type SeasonExtraRevenueRow = {
  project_id?: string | null;
  ym?: string | number | null;
  extra_revenue_json?: unknown[] | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function yenNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function parseSeasonBufferTotal(value: unknown): number | null {
  const record = asRecord(value);
  if (!record) return null;
  const items = Array.isArray(record.items) ? record.items : [];
  let itemTotal = 0;
  for (const raw of items) {
    const item = asRecord(raw);
    if (!item) continue;
    itemTotal += Math.max(0, yenNumber(item.amount));
  }
  const total = itemTotal > 0 ? itemTotal : Math.max(0, yenNumber(record.total));
  return total > 0 ? total : null;
}

export function buildExtraRevenueByYm(
  rows: SeasonExtraRevenueRow[],
  options: { projectId: string; minYm: string | number; maxYm: string | number },
): Map<string, number> {
  const minYm = Number(options.minYm);
  const maxYm = Number(options.maxYm);
  const expanded = expandExtraRevenue(
    rows
      .filter((row) => row.project_id === options.projectId || !row.project_id)
      .map((row) => ({
        project_id: options.projectId,
        ym: row.ym ?? 0,
        extra_revenue_json: Array.isArray(row.extra_revenue_json) ? row.extra_revenue_json as ExtraRevenueEntry[] : null,
      })),
    {
      minYm: Number.isFinite(minYm) ? minYm : undefined,
      maxYm: Number.isFinite(maxYm) ? maxYm : undefined,
    },
  );
  const byYm = new Map<string, number>();
  for (const item of expanded) {
    const ym = String(item.ym);
    byYm.set(ym, (byYm.get(ym) ?? 0) + Math.max(0, Math.round(item.amount)));
  }
  return byYm;
}

export function allocateSeasonBufferByYm({
  months,
  totalBufferYen,
  regularClientAmountByYm,
}: {
  months: string[];
  totalBufferYen: number | null;
  regularClientAmountByYm: Map<string, number>;
}): Map<string, number> {
  const total = Math.max(0, yenNumber(totalBufferYen));
  if (total <= 0) return new Map();
  const targetMonths = months.filter((ym) => (regularClientAmountByYm.get(ym) ?? 0) > 0);
  if (targetMonths.length === 0) return new Map();
  const per = Math.floor(total / targetMonths.length);
  const byYm = new Map<string, number>();
  targetMonths.forEach((ym, index) => {
    const amount = index === targetMonths.length - 1 ? total - per * (targetMonths.length - 1) : per;
    byYm.set(ym, amount);
  });
  return byYm;
}
