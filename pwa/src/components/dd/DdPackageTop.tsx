import { DdProjectPageBody } from "./DdProjectPageBody";
import type { DdLiveProjectPage } from "@/lib/dd-project-page-types";
import { DdDocumentsPage } from "./DdDocumentsPage";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { DD_PAGE_KEYS, type DdPageKey } from "@/lib/dd-pages";
import type { DdPackageView, DdViewItem } from "@/lib/dd-package-server";

// ページを選ぶと本文を直接表示。DD専用の一覧・概要・公開状態の枠を挟まない。
export function DdPackageTop({ view, slug, tab, sectionKey, canDownload = false, selectedItem, canonicalPage }: {
  view: DdPackageView; slug: string; tab?: string; sectionKey?: string; canDownload?: boolean; selectedItem?: DdViewItem; canonicalPage?: DdLiveProjectPage;
}) {
  const items = view.sections.flatMap((section) => section.items);
  const legacyPage = view.sections.find((section) => section.key === sectionKey)?.items[0]?.pageKey;
  const pageKey = (selectedItem?.pageKey ?? (tab && DD_PAGE_KEYS.includes(tab) ? tab : legacyPage) ?? "technology") as DdPageKey;
  const pageItems = items.filter((item) => item.pageKey === pageKey);
  if (selectedItem && !pageItems.some((item) => item.itemId === selectedItem.itemId)) pageItems.push(selectedItem);
  return (
    <div className="space-y-3">
      <section className="min-w-0 space-y-3" aria-label={PROJECT_PAGE_LABELS[pageKey]} data-testid="dd-page-body">
        {pageKey !== "documents" ? (
          canonicalPage ? <DdProjectPageBody key={`${view.package.project_id}:${pageKey}`} data={canonicalPage} canDownload={canDownload} /> : <p role="alert">このページはいま表示できない。</p>
        ) : <DdDocumentsPage projectId={view.package.project_id} projectName={view.projectName} slug={slug} items={pageItems} canDownload={canDownload} />}
      </section>
    </div>
  );
}
