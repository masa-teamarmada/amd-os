import { hasDdNdaConfirmation } from "@/lib/dd-nda-server";
import { redirect as redirectToNda } from "next/navigation";
import { ddContentHash } from "@/lib/dd-confidentiality-server";
import { notFound } from "next/navigation";
import { requireDdPageSession } from "@/lib/dd-page-session";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isDdSlug, isUuid } from "@/lib/dd-package-core";
import { loadDdItemView, loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { ddPageForItem } from "@/lib/dd-pages";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";
import { loadDdProjectPage } from "@/lib/dd-project-pages-server";
import { canEditProjectSurface } from "@/lib/project-surface-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 旧項目URLも同じページ構造で開く。未公開を開けるのは既存の内部管理者だけ。
export default async function DdItemPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  if (!isDdSlug(slug) || !isUuid(itemId)) notFound();
  await requireDdPageSession(`/dd/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}`);
  const access = await resolveDdPackageAccess(slug, { requireNdaConfirmation: false });
  if (!access) notFound();
  if (!await hasDdNdaConfirmation(access)) redirectToNda(`/dd/${encodeURIComponent(slug)}?returnTo=${encodeURIComponent(`/dd/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}`)}`);
  const view = await loadDdItemView(access, itemId);
  if (!view) notFound();
  const packageView = await loadDdPackageView(access);
  if (!packageView) notFound();
  const { item } = view;
  const selectedItem = {
    itemId, pageKey: ddPageForItem(item.item_kind, view.live?.data ?? null, item.source_key), live: view.live?.data ?? null,
    sectionKey: item.section_key, sortOrder: item.sort_order, itemKind: item.item_kind,
    title: item.title, summary: item.summary, sourceAsOf: view.live?.sourceAsOf ?? null,
    unverifiedNotes: view.unverifiedNotes, unavailable: !view.live,
  };
  const canonicalPage = selectedItem.pageKey === "documents" ? undefined : await loadDdProjectPage(access.projectId, selectedItem.pageKey);
  const canEditPocList = selectedItem.pageKey === "poc-list" && access.principal !== "workspace_account" && hasDdCapability(access, "dd.edit") &&
    (await canEditProjectSurface(access.projectId, "cockpit") || await canEditProjectSurface(access.projectId, "workspace"));
  await recordDdAccessEvent(access, "dd_item_viewed", { itemId, pageKey: selectedItem.pageKey, contentHash: ddContentHash(canonicalPage ?? view.live?.data), sourceAsOf: view.live?.sourceAsOf });
  return (
    <DdViewerShell access={access} projectName={packageView.projectName} pageKey={selectedItem.pageKey}>
      <DdPackageTop view={packageView} slug={access.slug} selectedItem={selectedItem} canonicalPage={canonicalPage} canEditPocList={canEditPocList} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
