/**
 * 事業計画・実績の月次試算表 (project_pl_monthly) から、その PJ 自身が生む年度別の
 * 国内付加価値を粗く求める。
 *
 * 【この量が何で、何でないか】
 * ここで出るのは「その PJ 1 社の付加価値」であって、SPS の P^ind (= その経路が到達した
 * ときに日本国内に生む付加価値の割引現在価値) ではない。両者は 3 点で別物:
 *   1. スコープ … P^ind は参入他社・部材サプライヤー・装置メーカー・雇用まで含む産業全体。
 *                 こちらは 1 社だけ。よって常に  P^ind >= (この量の割引現在価値)。
 *   2. 時間軸  … 事業計画は立ち上げ期の数年。P^ind は定常期を含む長期 (VA_年 × T)。
 *   3. 条件    … P^ind は「経路到達を所与にした条件付き価値」。到達確率 q は掛け算の相方
 *                 として別に持つ。事業計画は到達確率を織り込んでいない生の計画。
 * さらに P^ind の判断規律は「実績限定 (宣言・計画は根拠にしない)」(bzm/SEED_P_IND_JUDGMENT
 * _2026-08-16.md §方式)。したがって計画値を P^ind の算出根拠に使ってはいけない。
 *
 * 使ってよいのは 1 点だけ: 1 社は産業の部分集合なので P^ind >= P^firm が必ず成り立つ。
 * よって「P^ind の下限が、この PJ 単体の年次付加価値の何年分に相当するか」を出せば、
 * 下限が低すぎないかを読み手が自分で判定できる。年数を仮定せず割り算だけで出すので、
 * 恣意的なパラメータをひとつも増やさない。詳細は bzm/SPS_IND_PLAN_VALUE_CHECK_2026-08-21.md。
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { ProjectPlanValueCheck, ProjectPlanValueYear } from "@/types/project-plan-value";

export type { ProjectPlanValueCheck, ProjectPlanValueYear };

interface PlMonthlyRow {
  ym: string;
  revenue_yen: number | string | null;
  cogs_yen: number | string | null;
  personnel_yen: number | string | null;
  rd_yen: number | string | null;
  marketing_yen: number | string | null;
  other_opex_yen: number | string | null;
}

function toNumber(value: number | string | null): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 4 月始まりの会計年度。2026-03 は FY2025、2026-04 は FY2026。 */
function fiscalYearOf(ym: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return month >= 4 ? year : year - 1;
}

function currentYmJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function fetchProjectPlanValueCheck(projectId: string): Promise<ProjectPlanValueCheck> {
  const empty: ProjectPlanValueCheck = {
    project_id: projectId,
    has_data: false,
    years: [],
    peak: null,
    never_positive: false,
    revenue_all_zero: false,
  };
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("project_pl_monthly")
    .select("ym, revenue_yen, cogs_yen, personnel_yen, rd_yen, marketing_yen, other_opex_yen")
    .eq("project_id", projectId)
    .order("ym", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as PlMonthlyRow[];
  if (rows.length === 0) return empty;

  const nowYm = currentYmJst();
  const buckets = new Map<number, { months: number; past: number; future: number } & Omit<ProjectPlanValueYear, "fy" | "fy_label" | "months" | "kind">>();

  for (const row of rows) {
    const fy = fiscalYearOf(row.ym);
    if (fy == null) continue;
    const revenue = toNumber(row.revenue_yen);
    const personnel = toNumber(row.personnel_yen);
    const opex =
      toNumber(row.cogs_yen) + personnel + toNumber(row.rd_yen) + toNumber(row.marketing_yen) + toNumber(row.other_opex_yen);
    const operating = revenue - opex;
    const bucket = buckets.get(fy) ?? {
      months: 0,
      past: 0,
      future: 0,
      revenue_yen: 0,
      operating_income_yen: 0,
      personnel_yen: 0,
      value_added_yen: 0,
    };
    bucket.months += 1;
    if (row.ym <= nowYm) bucket.past += 1;
    else bucket.future += 1;
    bucket.revenue_yen += revenue;
    bucket.operating_income_yen += operating;
    bucket.personnel_yen += personnel;
    bucket.value_added_yen += operating + personnel;
    buckets.set(fy, bucket);
  }

  const years: ProjectPlanValueYear[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fy, bucket]) => ({
      fy,
      fy_label: `FY${fy}`,
      months: bucket.months,
      kind: bucket.future === 0 ? "actual" : bucket.past === 0 ? "plan" : "mixed",
      revenue_yen: bucket.revenue_yen,
      operating_income_yen: bucket.operating_income_yen,
      personnel_yen: bucket.personnel_yen,
      value_added_yen: bucket.value_added_yen,
    }));

  const fullYears = years.filter((year) => year.months === 12);
  const peak = fullYears.reduce<ProjectPlanValueYear | null>(
    (best, year) => (best == null || year.value_added_yen > best.value_added_yen ? year : best),
    null,
  );

  return {
    project_id: projectId,
    has_data: true,
    years,
    peak,
    never_positive: fullYears.length > 0 && fullYears.every((year) => year.value_added_yen <= 0),
    revenue_all_zero: years.every((year) => year.revenue_yen === 0),
  };
}
