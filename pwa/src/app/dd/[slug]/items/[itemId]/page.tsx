import { notFound } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isUuid } from "@/lib/dd-package-core";
import { loadDdItemView, loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdNavigation } from "@/components/dd/DdNavigation";
import { DdItemDetail } from "@/components/dd/DdItemDetail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// DDの項目1件。閲覧のたびに元データの最新を、ワークスペースと同じ部品で描く。
// 閲覧者には公開中の有効な項目だけを開く。未公開・外した項目・別パッケージの項目は「見つからない」として閉じる。
// 管理者のプレビューでは未公開の項目も開ける（公開前の確認）。
export default async function DdItemPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  if (!isUuid(itemId)) notFound();
  const access = await resolveDdPackageAccess(slug);
  if (!access) notFound();

  const view = await loadDdItemView(access, itemId);
  if (!view) notFound();
  const { item } = view;
  const packageView = await loadDdPackageView(access);
  if (!packageView) notFound();

  await recordDdAccessEvent(access, "dd_item_viewed", { itemId });

  const topHref = `/dd/${encodeURIComponent(access.slug)}`;
  const adminPreview = access.principal === "internal_admin";
  return (
    <DdViewerShell access={access}>
      <DdNavigation view={packageView} slug={access.slug} sectionKey={item.section_key} itemId={itemId} />
      <div className="mt-3">
      <DdItemDetail
        topHref={topHref}
        fileHref={item.item_kind === "document" ? `${topHref}/items/${itemId}/file` : null}
        canDownload={hasDdCapability(access, "dd.download")}
        adminPreview={adminPreview}
        data={{
          itemId,
          itemKind: item.item_kind,
          sectionKey: item.section_key,
          title: item.title,
          summary: item.summary,
          isPublished: item.is_published,
          live: view.live?.data ?? null,
          liveError: adminPreview ? view.liveError : null,
          sourceAsOf: view.live?.sourceAsOf ?? null,
          unverifiedNotes: view.unverifiedNotes,
          evidence: view.evidence.map((link) => ({ href: `${topHref}/items/${link.itemId}`, title: link.title })),
        }}
      />
      </div>
    </DdViewerShell>
  );
}
