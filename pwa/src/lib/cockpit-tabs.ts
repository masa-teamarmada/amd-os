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
 *
 * 2026-10-03: どのタブを出すかはPJタイプごとの標準フォーマット（src/lib/project-formats.ts、鍵付き）が正本。
 * ここはタブの名前の一覧と、旧URLの読み替えだけを持つ。
 */
import { COCKPIT_TAB_FORMATS, DEFAULT_TABS, type ProjectFormatType } from "./project-formats.ts";

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
  "development-issues",
  "financial-projection",
  "capital-plan",
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
  "monthly-reports",
  "capital-policy",
  "company",
  "organization-chart",
  "employee-register",
  "contracts",
  "killer-factors",
  "activity",
  // 旧 ?tab=dd の互換解析専用。独立したDDへ送る。分類には含めない。
  "dd",
] as const;

export type CockpitTab = (typeof COCKPIT_TABS)[number];

/**
 * 既定タブ。URL に `?tab=` を付けないのはこれだけ。全PJ同じ（src/lib/project-formats.ts の DEFAULT_TABS）。
 * ゴールツリー（2026-09-13 まさ「進捗グループを使うときは最初に論点タブを開く」）。
 * 進捗管理グループの一番左と揃える。揃えないと、PJを開いた瞬間に左から4番目が選ばれた状態になる。
 */
export const DEFAULT_COCKPIT_TAB: CockpitTab = DEFAULT_TABS.cockpit;

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
  | "dd-group"
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
  dd: "DDパッケージ",
  seeds: "シーズリスト",
  regulations: "規程・内規",
} as const;

const GROUP_LABEL_BY_KEY: Record<CockpitGroupKey, string> = {
  "progress-group": COCKPIT_GROUP_LABELS.progress,
  "business-plan-group": COCKPIT_GROUP_LABELS.businessPlan,
  "documents-group": COCKPIT_GROUP_LABELS.documents,
  "project-management-group": COCKPIT_GROUP_LABELS.projectManagement,
  "company-information-group": COCKPIT_GROUP_LABELS.companyInformation,
  "dd-group": COCKPIT_GROUP_LABELS.dd,
  "seeds-group": COCKPIT_GROUP_LABELS.seeds,
  "regulations-group": COCKPIT_GROUP_LABELS.regulations,
};

/**
 * PJタイプごとのタブの並び。正本は src/lib/project-formats.ts の COCKPIT_TAB_FORMATS（鍵付き）。
 * データの有無ではタブを出し分けない（2026-10-03 まさ「全部統一してないとだめ。OSの大原則」）。
 */
export function cockpitGroupsForType(type: ProjectFormatType): readonly CockpitGroup[] {
  return COCKPIT_TAB_FORMATS[type].map((group) => ({
    key: group.group as CockpitGroupKey,
    label: GROUP_LABEL_BY_KEY[group.group as CockpitGroupKey],
    children: group.tabs as readonly CockpitTab[],
  }));
}

/** 旧URLのタブ名。今のタブへ読み替える（共有済みのリンクを壊さない）。 */
const TAB_ALIASES: Partial<Record<CockpitTab, CockpitTab>> = {
  // 目的構造はガントの左側タスク階層へ統合。
  "objective-structure": "gantt",
  // コスト試算（燃料）は「コスト試算」タブの中の切り替えへ統合（2026-10-03）。
  "cost-fuel": "cost-model",
};

/** URLのタブを、このPJタイプの形にあるタブへ解決する。形に無いタブは既定タブへ落とす。 */
export function resolveCockpitTabForType(tab: CockpitTab, type: ProjectFormatType): CockpitTab {
  const aliased = TAB_ALIASES[tab] ?? tab;
  return COCKPIT_TAB_FORMATS[type].some((group) => group.tabs.includes(aliased)) ? aliased : DEFAULT_COCKPIT_TAB;
}

export function cockpitGroupForTabInType(tab: CockpitTab, type: ProjectFormatType): CockpitGroup {
  const groups = cockpitGroupsForType(type);
  const aliased = TAB_ALIASES[tab] ?? tab;
  return groups.find((group) => group.children.includes(aliased)) ?? groups[0];
}
