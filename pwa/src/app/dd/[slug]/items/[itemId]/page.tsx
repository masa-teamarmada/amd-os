import { notFound } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { hasDdCapability, isUuid } from "@/lib/dd-package-core";
import { loadDdPublishedItem, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdItemDetail } from "@/components/dd/DdItemDetail";

export const dynamic = "force-dynamic";

// DDの項目1件。公開版がある有効な項目だけを開く。未公開・取り下げ・別パッケージの項目は「見つからない」として閉じる。
export default async function DdItemPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  if (!isUuid(itemId)) notFound();
  const access = await resolveDdPackageAccess(slug);
  if (!access) notFound();

  const loaded = await loadDdPublishedItem(access.packageId, itemId);
  if (!loaded) notFound();
  const { item, evidence } = loaded;
  const publication = item.publication;

  await recordDdAccessEvent(access, "dd_item_viewed", {
    itemId,
    publicationId: publication.id,
    revision: publication.revision,
  });

  const topHref = `/dd/${encodeURIComponent(access.slug)}`;
  return (
    <DdViewerShell access={access}>
      <DdItemDetail
        mode="published"
        topHref={topHref}
        fileHref={publication.item_kind === "document" ? `${topHref}/items/${itemId}/file` : null}
        canDownload={hasDdCapability(access, "dd.download")}
        data={{
          itemKind: publication.item_kind,
          sectionKey: publication.section_key,
          title: publication.title,
          summary: publication.summary,
          payload: publication.payload,
          revision: publication.revision,
          publishedAt: publication.published_at,
          sourceAsOf: publication.source_as_of,
          unverifiedNotes: publication.unverified_notes,
          evidence: evidence.map((link) => ({
            href: `${topHref}/items/${link.itemId}`,
            title: link.title,
            fileName: link.fileName,
          })),
        }}
      />
    </DdViewerShell>
  );
}
