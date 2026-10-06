import { DD_TAB_FORMAT, DD_ITEM_PAGES, PROJECT_PAGE_LABELS } from "./project-formats.ts";
import { techLedgerTabOf } from "./project-tech.ts";
import type { DdLiveData } from "./dd-payload";
import { isDdSharedPageKey, type DdItemKind } from "./dd-package-core.ts";

export type DdPageKey = (typeof DD_TAB_FORMAT)[number]["tabs"][number] | (typeof DD_ITEM_PAGES)[number]["key"];
export const DD_PAGE_KEYS: readonly string[] = [...new Set([
  ...DD_ITEM_PAGES.map((page) => page.key),
  ...DD_TAB_FORMAT.flatMap((group) => [...group.tabs]),
])];

export const DD_EMPTY_PAGE_KEYS = ["founding-background", "organization-chart", "shareholder-register", "next-round-term-sheet", "governance", "technical-evidence", "manufacturing", "team", "regulatory", "disputes", "articles-of-incorporation", "corporate-register", "internal-rules", "development-plan", "market-research", "sales-partners", "product-description", "quality-control", "supply-chain", "university-rights", "safety-assessment", "related-party-transactions", "financial-statements", "tax-returns"] as const;
export type DdEmptyPageKey = (typeof DD_EMPTY_PAGE_KEYS)[number];
export function isDdEmptyPageKey(page: string): page is DdEmptyPageKey {
  return (DD_EMPTY_PAGE_KEYS as readonly string[]).includes(page);
}
export function ddPageLabel(page: string): string {
  return DD_ITEM_PAGES.find((item) => item.key === page)?.label ?? PROJECT_PAGE_LABELS[page] ?? page;
}

/** 掲載用区分や表題でページを推測せず、他領域と同じ元データの種類・技術区分で決める。 */
export function ddPageForItem(kind: DdItemKind, live: DdLiveData | null, sourceKey?: string): DdPageKey {
  switch (kind) {
    case "project_page": {
      const key = live?.kind === "project_page" ? live.page : sourceKey?.replace(/^project_page:/, "");
      if (!key || !isDdSharedPageKey(key)) throw new Error("Invalid DD project page");
      return key;
    }
    case "document": return "documents";
    case "funding_plan": return "monthly-trial";
    case "capital_policy": return "capital-plan";
    case "cost_model": return "cost-model";
    case "tech_topic": return live?.kind === "tech_topic" ? techLedgerTabOf(live.topic) : "technology";
  }
}
