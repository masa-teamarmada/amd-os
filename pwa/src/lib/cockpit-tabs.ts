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
  "objective-structure",
  "partners",
  "issues",
  "tasks",
  "meetings",
  "slack",
  "score-detail",
  "technology",
  // 競合比較。技術台帳の区分「競合比較」のトピックを持つPJだけに出す (表示条件は CockpitView)。
  "competition",
  // ビジネスモデル。技術台帳の区分「ビジネスモデル」のトピックを持つPJだけに出す (表示条件は CockpitView)。
  "business-model",
  "business-plan",
  "cost-model",
  // コスト試算（燃料）。燃料の試算 (project_cost_models.case_kind = 'biodiesel') を持つPJだけに出す (表示条件は CockpitView)。
  "cost-fuel",
  "regulations",
  "seeds",
  "ip",
  "documents",
  "overview",
  "project-contracts",
  "project-finance",
  "capital-policy",
  "company",
  "activity",
] as const;

export type CockpitTab = (typeof COCKPIT_TABS)[number];

/**
 * 既定タブ。URL に `?tab=` を付けないのはこれだけ。
 * ゴールツリー（2026-09-13 まさ「進捗グループを使うときは最初に論点タブを開く」）。
 * 進捗管理グループの一番左と揃える。揃えないと、PJを開いた瞬間に左から4番目が選ばれた状態になる。
 */
export const DEFAULT_COCKPIT_TAB: CockpitTab = "issues";

/** `?tab=` に載せる (= 既定でない) タブ名の一覧。 */
export const NON_DEFAULT_COCKPIT_TABS: readonly string[] = COCKPIT_TABS.filter(
  (tab) => tab !== DEFAULT_COCKPIT_TAB,
);

export type CockpitGroupKey =
  | "progress-group"
  | "business-plan-group"
  | "documents-group"
  | "project-management-group"
  | "company-information-group"
  | "seeds-group"
  | "regulations-group";

export type CockpitGroup = {
  key: CockpitGroupKey;
  label: string;
  children: readonly CockpitTab[];
};

/** コックピットとPJワークスペースで共通に使う、利用者向けのグループ名。 */
export const COCKPIT_GROUP_LABELS = {
  progress: "進捗管理",
  businessPlan: "事業計画",
  documents: "ドライブ",
  projectManagement: "PJ管理",
  companyInformation: "会社情報",
  seeds: "シーズリスト",
  regulations: "規程・内規",
} as const;

/** 通常PJと研究機関PJで共有する、画面の分類正本。 */
export const COCKPIT_GROUPS: {
  normal: readonly CockpitGroup[];
  institution: readonly CockpitGroup[];
} = {
  normal: [
    {
      key: "progress-group",
      label: COCKPIT_GROUP_LABELS.progress,
      // ゴールツリー → タスク → ガント → 残りは元の順（2026-09-13 まさ）
      children: ["issues", "tasks", "gantt", "progress", "meetings", "slack", "weekly", "partners"],
    },
    {
      key: "business-plan-group",
      label: COCKPIT_GROUP_LABELS.businessPlan,
      // コスト試算（燃料）はコスト試算の右隣（2026-09-14 まさ「事業計画グループ内に置いてほしかった。
      // 元々ある『コスト試算』は『コスト試算（廃液）』に変えて、それの右に並べて」）。
      // 競合比較は技術の右隣（2026-09-14 まさ「この競合比較は、技術タブの中じゃなくて事業計画グループの直下に置いてほしい」）。
      // ビジネスモデルは競合比較の右隣（2026-09-14 まさ「事業計画グループの中に「ビジネスモデル」っていうタブを新たに追加して」）。
      children: ["score-detail", "technology", "competition", "business-model", "business-plan", "cost-model", "cost-fuel", "ip"],
    },
    { key: "documents-group", label: COCKPIT_GROUP_LABELS.documents, children: ["documents"] },
    {
      key: "project-management-group",
      label: COCKPIT_GROUP_LABELS.projectManagement,
      children: ["overview", "project-contracts", "project-finance"],
    },
    { key: "company-information-group", label: COCKPIT_GROUP_LABELS.companyInformation, children: ["company", "capital-policy", "activity"] },
  ],
  institution: [
    {
      key: "progress-group",
      label: COCKPIT_GROUP_LABELS.progress,
      // ゴールツリー → タスク → ガント → 残りは元の順（2026-09-13 まさ）
      children: ["issues", "tasks", "gantt", "progress", "meetings", "slack", "weekly", "partners"],
    },
    { key: "seeds-group", label: COCKPIT_GROUP_LABELS.seeds, children: ["seeds"] },
    { key: "regulations-group", label: COCKPIT_GROUP_LABELS.regulations, children: ["regulations"] },
    { key: "documents-group", label: COCKPIT_GROUP_LABELS.documents, children: ["documents"] },
    {
      key: "project-management-group",
      label: COCKPIT_GROUP_LABELS.projectManagement,
      children: ["overview", "project-contracts", "project-finance"],
    },
    { key: "company-information-group", label: COCKPIT_GROUP_LABELS.companyInformation, children: ["company", "capital-policy", "activity"] },
  ],
};

const INSTITUTION_ONLY_TABS = new Set<CockpitTab>(["seeds", "regulations"]);
const BUSINESS_PLAN_TABS = new Set<CockpitTab>([
  "score-detail",
  "technology",
  "competition",
  "business-model",
  "business-plan",
  "cost-model",
  "cost-fuel",
  "ip",
]);

/** URLに残っている旧フラットタブを、現在のPJ分類に合わせて解決する。 */
export function resolveCockpitTab(
  tab: CockpitTab,
  isInstitutionProject: boolean,
): CockpitTab {
  // 目的構造はガントの左側タスク階層へ統合。共有済みの旧URLはガントへ着地させる。
  if (tab === "objective-structure") return "gantt";
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
