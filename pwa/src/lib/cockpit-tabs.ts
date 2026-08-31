/**
 * PJコックピットのタブ一覧。
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
  "themes",
  "weekly",
  "gantt",
  "partners",
  "issues",
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
