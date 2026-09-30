import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { isUuid, readDdIncludedParts } from "@/lib/dd-package-core";
import { loadDdItem } from "@/lib/dd-package-server";
import { buildDdPublicationDraft, mergeDdUnverifiedNotes } from "@/lib/dd-sources";
import { DdItemDetail } from "@/components/dd/DdItemDetail";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 公開前の下書き（いまの元データで公開版を作ったらどう見えるか）を、投資家向けと同じ部品で描く。AMD admin 限定。
// 添付の実体は読まない（下書きでは開けない）。ここで見えている内容は、どこにも保存しない。
export default async function DdDraftPreviewPage({ params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const { projectId, itemId } = await params;
  const member = await getCurrentMemberAccess();
  if (!member?.isAdmin || member.scope !== "portfolio") notFound();
  if (!isUuid(itemId)) notFound();
  const item = await loadDdItem(itemId);
  if (!item || item.project_id !== projectId) notFound();

  const draft = await buildDdPublicationDraft(
    { projectId, itemKind: item.item_kind, sourceKey: item.source_key, sourceOptions: item.source_options ?? {} },
    { withFile: false },
  );
  const unverified = mergeDdUnverifiedNotes(item.unverified_notes, draft.autoUnverified, item.source_options?.autoUnverified !== false);
  const included = readDdIncludedParts(item.source_options);
  const excludedParts = included ? (draft.optionChoices?.parts ?? []).filter((part) => !included.has(part.key)).length : 0;

  const db = createAdminClient();
  const { data: evidenceRows } = item.evidence_item_ids.length > 0
    ? await db.from("dd_package_items").select("id,title,source_key").in("id", item.evidence_item_ids)
    : { data: [] as Array<{ id: string; title: string; source_key: string }> };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[#f3d9a4] bg-[#fff8e8] px-3 py-2 text-[12px] leading-5 text-[#7a4b00]">
        下書きのプレビュー。いまの元データで公開版を作るとこう見える。まだ誰にも公開されていない。
        {excludedParts > 0 && `載せる範囲で外した節・行（${excludedParts}件）は表示していない。`}
        <Link href={`/project/${encodeURIComponent(projectId)}/dd`} className="ml-2 font-semibold underline">DDの管理画面へ戻る</Link>
      </div>
      <DdItemDetail
        mode="draft"
        topHref={null}
        fileHref={null}
        canDownload={false}
        data={{
          itemKind: item.item_kind,
          sectionKey: item.section_key,
          title: item.title,
          summary: item.summary,
          payload: draft.payload,
          revision: null,
          publishedAt: null,
          sourceAsOf: draft.sourceAsOf,
          unverifiedNotes: unverified,
          evidence: (evidenceRows ?? []).map((row) => ({ href: null, title: String(row.title), fileName: null })),
        }}
      />
    </div>
  );
}
