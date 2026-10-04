import Link from "next/link";
import { DD_TAB_FORMAT, PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { COCKPIT_GROUP_LABELS } from "@/lib/cockpit-tabs";
import type { DdPageKey } from "@/lib/dd-pages";

// 他の2領域と同じ分類・ページ名。公開項目数でタブを増減させない。
export function DdNavigation({ slug, pageKey }: { slug: string; pageKey: DdPageKey }) {
  const base = `/dd/${encodeURIComponent(slug)}`;
  const selectedGroup = DD_TAB_FORMAT.find((group) => (group.tabs as readonly string[]).includes(pageKey)) ?? DD_TAB_FORMAT[0];
  const groupLabel = (key: string) => key === "business-plan-group" ? COCKPIT_GROUP_LABELS.businessPlan : COCKPIT_GROUP_LABELS.documents;
  return (
    <div className="space-y-2">
      <nav aria-label="DDパッケージの分類" data-testid="dd-group-navigation" className="grid grid-cols-2 gap-1 rounded-xl border border-[#bfc0c7] bg-[#f5f5f7] p-1">
        {DD_TAB_FORMAT.map((group) => (
          <Link key={group.group} href={`${base}?tab=${group.tabs[0]}`} aria-current={group.group === selectedGroup.group ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-[13px] font-bold sm:min-h-9 ${group.group === selectedGroup.group ? "bg-white text-slate-950 shadow-[inset_0_-2px_0_#0f172a]" : "text-slate-500 hover:bg-white/80 hover:text-slate-900"}`}>
            {groupLabel(group.group)}
          </Link>
        ))}
      </nav>
      {selectedGroup.tabs.length > 1 && <nav aria-label={`${groupLabel(selectedGroup.group)}の表示切り替え`} data-testid="dd-child-navigation" className="flex gap-1 overflow-x-auto rounded-lg border border-[#d6d6da] bg-white p-1">
        {selectedGroup.tabs.map((tab) => (
          <Link key={tab} href={`${base}?tab=${tab}`} aria-current={pageKey === tab ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-[12px] font-semibold sm:min-h-8 ${pageKey === tab ? "bg-[#f5f5f7] text-slate-950 shadow-[inset_0_-2px_0_#0f172a]" : "text-slate-600 hover:bg-[#f5f5f7] hover:text-slate-900"}`}>
            {PROJECT_PAGE_LABELS[tab]}
          </Link>
        ))}
      </nav>}
    </div>
  );
}
