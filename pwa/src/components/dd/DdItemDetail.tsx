import { DdProjectPageBody } from "./DdProjectPageBody";
import Link from "next/link";
import { ddSectionLabel, type DdSectionKey } from "@/lib/dd-package-core";
import { DD_ITEM_KIND_LABEL, type DdItemKind, type DdLiveData } from "@/lib/dd-payload";
import { ddSourceDescription, formatDdDate } from "@/lib/dd-format";
import { DdDocumentBody } from "@/components/dd/DdItemBodies";
import { DdCapitalPolicyLive, DdCostModelLive, DdFundingPlanLive, DdTechTopicLive } from "@/components/dd/DdLiveBodies";

// DDの項目1件。先頭に「公開の状態・元データの更新・元データの種類」を置き、本文、根拠資料、未確認事項の順に出す。
// 本文は、ワークスペース（とコックピット）と同じ部品で、元データの最新を描く（公開した時点で固定しない）。
// 投資家の閲覧、管理者のプレビュー、正式版（PDF）の印刷画面で同じ部品を使う。

export type DdItemDetailData = {
  itemId: string;
  itemKind: DdItemKind;
  sectionKey: DdSectionKey;
  title: string;
  summary: string | null;
  isPublished: boolean;
  live: DdLiveData | null;
  /** 元データを読めなかったときの説明（管理者のプレビューでだけ出す）。 */
  liveError: string | null;
  sourceAsOf: string | null;
  unverifiedNotes: string[];
  evidence: Array<{ href: string | null; title: string }>;
};

export function DdLiveBody({ live, canDownload = false }: { live: DdLiveData; canDownload?: boolean }) {
  switch (live.kind) {
    case "project_page": return <DdProjectPageBody data={live} canDownload={canDownload} />;
    case "tech_topic":
      return <DdTechTopicLive data={live} />;
    case "funding_plan":
      return <DdFundingPlanLive data={live} />;
    case "capital_policy":
      return <DdCapitalPolicyLive data={live} />;
    case "cost_model":
      return <DdCostModelLive data={live} />;
    case "document":
      return null;
  }
}

export function DdItemDetail({
  data,
  topHref,
  fileHref,
  canDownload,
  adminPreview,
  headingLevel = 1,
}: {
  data: DdItemDetailData;
  topHref: string | null;
  fileHref: string | null;
  canDownload: boolean;
  /** 管理者のプレビュー（未公開の項目も開ける。元データを読めない理由をそのまま出す）。 */
  adminPreview: boolean;
  /** 印刷画面では項目を h2 にする（パッケージ名が h1）。 */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <article className="space-y-5">
      <div>
        {topHref && (
          <nav aria-label="現在地" className="mb-2 text-[12px] text-[#6e6e73] print:hidden">
            <Link href={topHref} className="text-[#0267b2] hover:underline">DDトップ</Link>
            <span className="mx-1.5">/</span>
            <Link href={`${topHref}#section-${data.sectionKey}`} className="text-[#0267b2] hover:underline">
              {ddSectionLabel(data.sectionKey)}
            </Link>
          </nav>
        )}
        <Heading className="text-[20px] font-semibold leading-7 text-[#1d1d1f]">{data.title}</Heading>
        {data.summary && <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#424245]">{data.summary}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e5e7] bg-[#e5e5e7] text-[12px] sm:grid-cols-4">
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">区分</dt>
            <dd className="mt-0.5 font-semibold text-[#1d1d1f]">{ddSectionLabel(data.sectionKey)}</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">公開の状態</dt>
            <dd className={`mt-0.5 font-semibold ${data.isPublished ? "text-[#1d1d1f]" : "text-[#a15c00]"}`}>
              {data.isPublished ? "公開中（最新を表示）" : "非公開（管理者だけのプレビュー）"}
            </dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">元データの更新</dt>
            <dd className="mt-0.5 font-semibold text-[#1d1d1f]">{formatDdDate(data.sourceAsOf)}</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">種類・元データ</dt>
            <dd className="mt-0.5 text-[#1d1d1f]">
              {DD_ITEM_KIND_LABEL[data.itemKind]}
              {data.live && <span className="block text-[11px] text-[#6e6e73]">{ddSourceDescription(data.live)}</span>}
            </dd>
          </div>
        </dl>
      </div>

      <section aria-label="本文" className="min-w-0">
        {!data.live ? (
          <p className="rounded-md border border-[#f3d9a4] bg-[#fff8e8] px-3 py-2 text-[12.5px] text-[#7a4b00]">
            {adminPreview && data.liveError
              ? `元データを読めない：${data.liveError}`
              : "この項目はいま表示できない。"}
          </p>
        ) : data.live.kind === "document" ? (
          <DdDocumentBody
            payload={data.live}
            fileHref={fileHref}
            canDownload={canDownload}
            previewNote="この画面からは開けない。"
          />
        ) : (
          <DdLiveBody live={data.live} />
        )}
      </section>

      <section aria-labelledby={`dd-evidence-${data.itemId}`} className="border-t border-[#e5e5e7] pt-3">
        <h3 id={`dd-evidence-${data.itemId}`} className="text-[13px] font-semibold text-[#1d1d1f]">根拠資料</h3>
        {data.evidence.length === 0 ? (
          <p className="mt-1 text-[12px] text-[#6e6e73]">この項目に結び付けた根拠資料はない。</p>
        ) : (
          <ul className="mt-1.5 divide-y divide-[#f0f0f2] rounded-lg border border-[#e5e5e7]">
            {data.evidence.map((evidence) => (
              <li key={evidence.title} className="px-3 py-2 text-[12.5px]">
                {evidence.href ? (
                  <Link href={evidence.href} className="font-semibold text-[#0267b2] hover:underline">{evidence.title}</Link>
                ) : (
                  <span className="font-semibold text-[#1d1d1f]">{evidence.title}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`dd-unverified-${data.itemId}`} className="border-t border-[#e5e5e7] pt-3">
        <h3 id={`dd-unverified-${data.itemId}`} className="text-[13px] font-semibold text-[#1d1d1f]">
          未確認事項
          <span className="ml-1.5 rounded border border-[#cbd5e1] bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#475569]">
            {data.unverifiedNotes.length}件
          </span>
        </h3>
        {data.unverifiedNotes.length === 0 ? (
          <p className="mt-1 text-[12px] text-[#6e6e73]">登録された未確認事項はない。</p>
        ) : (
          <ul className="mt-1.5 space-y-1 text-[12.5px] leading-6 text-[#334155]">
            {data.unverifiedNotes.map((note, index) => (
              <li key={`${index}-${note}`} className="flex gap-2">
                <span className="mt-[3px] shrink-0 rounded border border-[#cbd5e1] bg-[#f8fafc] px-1 text-[10.5px] leading-4 text-[#475569]">未確認</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
