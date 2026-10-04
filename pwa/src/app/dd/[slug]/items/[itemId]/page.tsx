import { notFound } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isUuid } from "@/lib/dd-package-core";
import { loadDdItemView, loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { ddPageForItem } from "@/lib/dd-pages";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";
import { loadDdProjectPage } from "@/lib/dd-project-pages-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 旧項目URLも同じページ構造で開く。未公開を開けるのは既存の内部管理者だけ。
export default async function DdItemPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  if (!isUuid(itemId)) notFound();
  const access = await resolveDdPackageAccess(slug);
  if (!access) notFound();
  const view = await loadDdItemView(access, itemId);
  if (!view) notFound();
  const packageView = await loadDdPackageView(access);
  if (!packageView) notFound();
  const { item } = view;
  await recordDdAccessEvent(access, "dd_item_viewed", { itemId });
  const selectedItem = {
    itemId, pageKey: ddPageForItem(item.item_kind, view.live?.data ?? null, item.source_key), live: view.live?.data ?? null,
    sectionKey: item.section_key, sortOrder: item.sort_order, itemKind: item.item_kind,
    title: item.title, summary: item.summary, sourceAsOf: view.live?.sourceAsOf ?? null,
    unverifiedNotes: view.unverifiedNotes, unavailable: !view.live,
  };
  const canonicalPage = selectedItem.pageKey === "documents" ? undefined : await loadDdProjectPage(access.projectId, selectedItem.pageKey);
  return (
    <DdViewerShell access={access} projectName={packageView.projectName}>
      <DdPackageTop view={packageView} slug={access.slug} selectedItem={selectedItem} canonicalPage={canonicalPage} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
