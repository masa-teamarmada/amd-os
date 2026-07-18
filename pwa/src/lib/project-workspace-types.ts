export type OsAccessScope = "portfolio" | "project";
export type EffortCategory = "basic" | "applied" | "development" | "su" | "coordination";

export const EFFORT_CATEGORIES: Array<{
  key: EffortCategory;
  label: string;
  shortLabel: string;
}> = [
  { key: "basic", label: "基礎研究", shortLabel: "基礎" },
  { key: "applied", label: "応用研究", shortLabel: "応用" },
  { key: "development", label: "開発", shortLabel: "開発" },
  { key: "su", label: "SU活動", shortLabel: "SU" },
  { key: "coordination", label: "調整・運営", shortLabel: "調整" },
];

export type ProjectNavItem = {
  projectId: string;
  projectName: string;
};
