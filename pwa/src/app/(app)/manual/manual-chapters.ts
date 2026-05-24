export interface ManualSectionConfig {
  key: string;
  title: string;
  description: string;
  slugs: string[];
}

export const MANUAL_SECTIONS: ManualSectionConfig[] = [
  {
    key: "usage",
    title: "まず使う人向け",
    description: "AMD メンバーがざっくり使い方を掴むための章。画面の見方、日常業務、月次運用を優先。",
    slugs: [
      "00-intro",
      "08-member-quick-start",
      "09-research-assets-quick-start",
      "01-pj-cockpit",
      "02-amd-cockpit",
      "04-admin-ops",
    ],
  },
  {
    key: "system",
    title: "全体設計・細かい仕様",
    description: "データ構造、判断ロジック、自動処理、開発・運用の正本。えいみ / 開発者 / admin が仕様確認に使う。",
    slugs: [
      "20-system-architecture",
      "07-atlas-protocol-score-macrotrend",
      "21-amd-score-spec",
      "22-notifications-and-tsukuyomi",
      "23-hud-and-venture-map-spec",
      "24-operations-settings-spec",
      "03-data-and-extraction",
      "05-decisions-and-history",
      "06-developer",
    ],
  },
];

const order = new Map(MANUAL_SECTIONS.flatMap((section, sectionIdx) =>
  section.slugs.map((slug, slugIdx) => [slug, sectionIdx * 100 + slugIdx] as const),
));

export function sortManualSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const aOrder = order.get(a);
    const bOrder = order.get(b);
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.localeCompare(b);
  });
}
