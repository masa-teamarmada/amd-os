import Link from "next/link";
import { DD_TAB_FORMAT, PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { COCKPIT_GROUP_LABELS } from "@/lib/cockpit-tabs";
import type { DdPageKey } from "@/lib/dd-pages";

// 他の2領域と同じ分類・ページ名。公開項目数でタブを増減させない。
export function DdNavigation({ slug, pageKey }: { slug: string; pageKey: DdPageKey }) {
  const base = `/dd/${encodeURIComponent(slug)}`;
  const selectedGroup = DD_TAB_FORMAT.find((group) => (group.tabs as readonly string[]).includes(pageKey)) ?? DD_TAB_FORMAT[0];
  const groupLabel = (key: string) => ({ "progress-group": COCKPIT_GROUP_LABELS.progress, "business-plan-group": COCKPIT_GROUP_LABELS.businessPlan, "documents-group": COCKPIT_GROUP_LABELS.documents, "company-information-group": COCKPIT_GROUP_LABELS.companyInformation } as Record<string, string>)[key];
  return (
    <div className="space-y-3 border-t border-[#d2d2d7] pt-3">
      <nav aria-label="DDパッケージの分類" data-testid="dd-group-navigation" className="space-y-1">
        {DD_TAB_FORMAT.map((group) => (
          <div key={group.group}>
          <Link href={`${base}?tab=${group.tabs[0]}`} aria-current={group.group === selectedGroup.group ? "true" : undefined}
            className={`flex min-h-11 items-center rounded-md px-3 text-[13px] font-semibold hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] ${group.group === selectedGroup.group ? "bg-[#eef6fd] text-[#0267b2]" : "text-[#6e6e73]"}`}>
            {groupLabel(group.group)}
          </Link>
          {group.group === selectedGroup.group && selectedGroup.tabs.length > 1 && <nav aria-label={`${groupLabel(selectedGroup.group)}の表示切り替え`} data-testid="dd-child-navigation" className="ml-3 mt-1 space-y-1 border-l border-[#d2d2d7] pl-2">
            {selectedGroup.tabs.map((tab) => <Link key={tab} href={`${base}?tab=${tab}`} aria-current={pageKey === tab ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 text-[12.5px] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] ${pageKey === tab ? "bg-[#f5f5f7] font-semibold text-[#1d1d1f]" : "text-[#6e6e73]"}`}>{PROJECT_PAGE_LABELS[tab]}</Link>)}
          </nav>}
          </div>
        ))}
      </nav>
    </div>
  );
}
