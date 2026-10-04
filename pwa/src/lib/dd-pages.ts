import { DD_TAB_FORMAT } from "./project-formats.ts";
import { techLedgerTabOf } from "./project-tech.ts";
import type { DdLiveData } from "./dd-payload";
import { isDdSharedPageKey, type DdItemKind } from "./dd-package-core.ts";

export type DdPageKey = (typeof DD_TAB_FORMAT)[number]["tabs"][number];
export const DD_PAGE_KEYS: readonly string[] = DD_TAB_FORMAT.flatMap((group) => [...group.tabs]);

/** 掲載用区分や表題でページを推測せず、他領域と同じ元データの種類・技術区分で決める。 */
export function ddPageForItem(kind: DdItemKind, live: DdLiveData | null, sourceKey?: string): DdPageKey {
  switch (kind) {
    case "project_page": {
      const key = live?.kind === "project_page" ? live.page : sourceKey?.replace(/^project_page:/, "");
      if (!key || !isDdSharedPageKey(key)) throw new Error("Invalid DD project page");
      return key;
    }
    case "document": return "documents";
    case "funding_plan": return "financial-projection";
    case "capital_policy": return "capital-plan";
    case "cost_model": return "cost-model";
    case "tech_topic": return live?.kind === "tech_topic" ? techLedgerTabOf(live.topic) : "technology";
  }
}
