import { DdNavigation } from "./DdNavigation";
import { DdLiveBody } from "./DdItemDetail";
import { DdDocumentBody } from "./DdItemBodies";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { DD_PAGE_KEYS, type DdPageKey } from "@/lib/dd-pages";
import type { DdPackageView, DdViewItem } from "@/lib/dd-package-server";

// ページを選ぶと本文を直接表示。DD専用の一覧・概要・公開状態の枠を挟まない。
export function DdPackageTop({ view, slug, tab, sectionKey, canDownload = false, selectedItem }: {
  view: DdPackageView; slug: string; tab?: string; sectionKey?: string; canDownload?: boolean; selectedItem?: DdViewItem;
}) {
  const items = view.sections.flatMap((section) => section.items);
  const legacyPage = view.sections.find((section) => section.key === sectionKey)?.items[0]?.pageKey;
  const pageKey = (selectedItem?.pageKey ?? (tab && DD_PAGE_KEYS.includes(tab) ? tab : legacyPage) ?? "technology") as DdPageKey;
  const pageItems = items.filter((item) => item.pageKey === pageKey);
  if (selectedItem && !pageItems.some((item) => item.itemId === selectedItem.itemId)) pageItems.push(selectedItem);
  return (
    <div className="space-y-3">
      <DdNavigation slug={slug} pageKey={pageKey} />
      <section className="min-w-0 space-y-3" aria-label={PROJECT_PAGE_LABELS[pageKey]} data-testid="dd-page-body">
        {pageItems.length === 0 ? (
          <div className="rounded-xl border border-[#e5e5e7] bg-white p-4 text-[13px] text-[#6e6e73]">{PROJECT_PAGE_LABELS[pageKey]}は未登録。</div>
        ) : pageItems.map((item) => (
          <div key={item.itemId} id={`dd-item-${item.itemId}`} className="min-w-0 scroll-mt-16">
            {!item.live ? <p className="rounded-xl border border-[#e5e5e7] bg-white p-4 text-[13px] text-[#6e6e73]">この内容はいま表示できない。</p>
              : item.live.kind === "document" ? <DdDocumentBody payload={item.live} fileHref={`/dd/${encodeURIComponent(slug)}/items/${item.itemId}/file`} canDownload={canDownload} previewNote="この画面からは開けない。" />
              : <DdLiveBody live={item.live} canDownload={canDownload} />}
          </div>
        ))}
      </section>
    </div>
  );
}
