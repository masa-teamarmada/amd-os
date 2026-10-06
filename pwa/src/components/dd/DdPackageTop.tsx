import { DdProjectPageBody } from "./DdProjectPageBody";
import type { DdLiveProjectPage } from "@/lib/dd-project-page-types";
import { DdDocumentsPage } from "./DdDocumentsPage";
import Link from "next/link";
import { DD_ITEM_PAGES, PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { DD_PAGE_KEYS, ddPageLabel, type DdPageKey } from "@/lib/dd-pages";
import type { DdPackageView, DdViewItem } from "@/lib/dd-package-server";
import density from "./DdDocumentDensity.module.css";

// ページを選ぶと本文を直接表示。DD専用の一覧・概要・公開状態の枠を挟まない。
export function DdPackageTop({ view, slug, tab, sectionKey, canDownload = false, selectedItem, canonicalPage }: {
  view: DdPackageView; slug: string; tab?: string; sectionKey?: string; canDownload?: boolean; selectedItem?: DdViewItem; canonicalPage?: DdLiveProjectPage;
}) {
  const items = view.sections.flatMap((section) => section.items);
  const legacyPage = view.sections.find((section) => section.key === sectionKey)?.items[0]?.pageKey;
  const pageKey = (selectedItem?.pageKey ?? (tab && DD_PAGE_KEYS.includes(tab) ? tab : legacyPage) ?? "company") as DdPageKey;
  const pageItems = items.filter((item) => item.pageKey === pageKey);
  if (selectedItem && !pageItems.some((item) => item.itemId === selectedItem.itemId)) pageItems.push(selectedItem);
  const definition = DD_ITEM_PAGES.find((item) => item.key === pageKey);
  return (
    <div className="space-y-3">
      <section className={`min-w-0 space-y-2 ${density.document}`} aria-label={ddPageLabel(pageKey)} data-testid="dd-page-body" data-document-density="compact">
        <nav aria-label="関連する既存ページ">
          {definition && definition.related.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="text-[#6e6e73]">関連する既存ページ</span>
            {definition.related.map((page) => <Link key={page} href={`/dd/${encodeURIComponent(slug)}?tab=${page}`} className="inline-flex min-h-9 items-center text-[#0267b2] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#027FDC]">{PROJECT_PAGE_LABELS[page]}</Link>)}
          </div>}
        </nav>
        {pageKey !== "documents" ? (
          canonicalPage ? <DdProjectPageBody key={`${view.package.project_id}:${pageKey}`} data={canonicalPage} canDownload={canDownload} /> : <p role="alert">このページはいま表示できない。</p>
        ) : <DdDocumentsPage projectId={view.package.project_id} projectName={view.projectName} slug={slug} items={pageItems} canDownload={canDownload} />}
      </section>
    </div>
  );
}
