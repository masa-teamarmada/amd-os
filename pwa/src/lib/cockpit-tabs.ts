/**
 * PJコックピットのタブ一覧と二階層ナビゲーション。
 *
 * 画面本体 (`CockpitView`) のタブ列も、URL の `?tab=` を受け付けるかどうかの判定
 * (`app/(app)/project/[projectId]/cockpit/page.tsx`) も、この1本から作る。
 * **タブを足すときはここだけを直す。**
 *
 * 2026-08-29: 資本政策表タブを足したとき、page.tsx 側に同じ一覧を手で書き写していたため
 * 入れ忘れ、タブを押しても既定タブ (進捗管理) へ戻される不具合を出した。二重管理をやめる。
 * `"use client"` を持たない素のモジュールに置くのは、server component から読んでも
 * 実体の配列が返るようにするため (client module の export は境界を越えると proxy になる)。
 */
export const COCKPIT_TABS = [
  "progress",
  "weekly",
  "gantt",
  "partners",
  "issues",
  "meetings",
  "score-detail",
  "technology",
  "business-plan",
  "cost-model",
  "regulations",
  "seeds",
  "ip",
  "documents",
  "overview",
  "capital-policy",
  "company",
] as const;

export type CockpitTab = (typeof COCKPIT_TABS)[number];

/** 既定タブ。URL に `?tab=` を付けないのはこれだけ。 */
export const DEFAULT_COCKPIT_TAB: CockpitTab = "progress";

/** `?tab=` に載せる (= 既定でない) タブ名の一覧。 */
export const NON_DEFAULT_COCKPIT_TABS: readonly string[] = COCKPIT_TABS.filter(
  (tab) => tab !== DEFAULT_COCKPIT_TAB,
);

export type CockpitGroupKey =
  | "progress-group"
  | "business-plan-group"
  | "project-management-group"
  | "seeds-group"
  | "regulations-group";

export type CockpitGroup = {
  key: CockpitGroupKey;
  label: string;
  children: readonly CockpitTab[];
};

/** 通常PJと研究機関PJで共有する、画面の分類正本。 */
export const COCKPIT_GROUPS: {
  normal: readonly CockpitGroup[];
  institution: readonly CockpitGroup[];
} = {
  normal: [
    {
      key: "progress-group",
      label: "進捗管理",
      children: ["progress", "meetings", "weekly", "gantt", "partners", "issues"],
    },
    {
      key: "business-plan-group",
      label: "事業計画",
      children: ["score-detail", "technology", "business-plan", "cost-model", "ip", "capital-policy"],
    },
    {
      key: "project-management-group",
      label: "PJ管理",
      children: ["overview", "documents", "company"],
    },
  ],
  institution: [
    {
      key: "progress-group",
      label: "進捗管理",
      children: ["progress", "meetings", "weekly", "gantt", "partners", "issues"],
    },
    { key: "seeds-group", label: "シーズリスト", children: ["seeds"] },
    { key: "regulations-group", label: "規程・内規", children: ["regulations"] },
    {
      key: "project-management-group",
      label: "PJ管理",
      children: ["overview", "documents", "company"],
    },
  ],
};

const INSTITUTION_ONLY_TABS = new Set<CockpitTab>(["seeds", "regulations"]);
const BUSINESS_PLAN_TABS = new Set<CockpitTab>([
  "score-detail",
  "technology",
  "business-plan",
  "cost-model",
  "ip",
  "capital-policy",
]);

/** URLに残っている旧フラットタブを、現在のPJ分類に合わせて解決する。 */
export function resolveCockpitTab(
  tab: CockpitTab,
  isInstitutionProject: boolean,
): CockpitTab {
  if (isInstitutionProject && BUSINESS_PLAN_TABS.has(tab)) return DEFAULT_COCKPIT_TAB;
  if (!isInstitutionProject && INSTITUTION_ONLY_TABS.has(tab)) return DEFAULT_COCKPIT_TAB;
  return tab;
}

export function cockpitGroupsForProject(isInstitutionProject: boolean): readonly CockpitGroup[] {
  return isInstitutionProject ? COCKPIT_GROUPS.institution : COCKPIT_GROUPS.normal;
}

export function cockpitGroupForTab(
  tab: CockpitTab,
  isInstitutionProject: boolean,
): CockpitGroup {
  const groups = cockpitGroupsForProject(isInstitutionProject);
  return groups.find((group) => group.children.includes(tab)) ?? groups[0];
}
