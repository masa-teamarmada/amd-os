import Link from "next/link";
import { ddSectionLabel, type DdSectionKey } from "@/lib/dd-package-core";
import { DD_ITEM_KIND_LABEL, type DdItemKind } from "@/lib/dd-payload";
import type {
  DdCapitalPolicyPayload,
  DdCostModelPayload,
  DdDocumentPayload,
  DdFundingPlanPayload,
  DdTechTopicPayload,
} from "@/lib/dd-payload";
import { ddSourceDescription, formatDdDate } from "@/lib/dd-format";
import {
  DdCapitalPolicyBody,
  DdCostModelBody,
  DdDocumentBody,
  DdFundingPlanBody,
  DdTechTopicBody,
} from "@/components/dd/DdItemBodies";

// DDの項目1件。先頭に「公開版・公開日・元データの基準日・元データの種類」を置き、本文、根拠資料、未確認事項の順に出す。
// 公開版の閲覧と、管理者の下書きプレビュー（mode="draft"）の両方で同じ部品を使う。

export type DdItemDetailData = {
  itemKind: DdItemKind;
  sectionKey: DdSectionKey;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  revision: number | null;
  publishedAt: string | null;
  sourceAsOf: string | null;
  unverifiedNotes: string[];
  evidence: Array<{ href: string | null; title: string; fileName: string | null }>;
};

export function DdItemDetail({
  data,
  topHref,
  fileHref,
  canDownload,
  mode,
}: {
  data: DdItemDetailData;
  topHref: string | null;
  fileHref: string | null;
  canDownload: boolean;
  mode: "published" | "draft";
}) {
  return (
    <article className="space-y-5">
      <div>
        {topHref && (
          <nav aria-label="現在地" className="mb-2 text-[12px] text-[#6e6e73]">
            <Link href={topHref} className="text-[#0267b2] hover:underline">DDトップ</Link>
            <span className="mx-1.5">/</span>
            <Link href={`${topHref}#section-${data.sectionKey}`} className="text-[#0267b2] hover:underline">
              {ddSectionLabel(data.sectionKey)}
            </Link>
          </nav>
        )}
        <h1 className="text-[20px] font-semibold leading-7 text-[#1d1d1f]">{data.title}</h1>
        {data.summary && <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#424245]">{data.summary}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e5e7] bg-[#e5e5e7] text-[12px] sm:grid-cols-4">
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">公開版</dt>
            <dd className="mt-0.5 font-semibold text-[#1d1d1f]">
              {mode === "draft" ? "下書き（未公開）" : `第${data.revision}版`}
            </dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">公開日</dt>
            <dd className="mt-0.5 font-semibold text-[#1d1d1f]">{mode === "draft" ? "—" : formatDdDate(data.publishedAt)}</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">元データの基準日</dt>
            <dd className="mt-0.5 font-semibold text-[#1d1d1f]">{formatDdDate(data.sourceAsOf)}</dd>
          </div>
          <div className="bg-white px-3 py-2">
            <dt className="text-[#6e6e73]">種類・元データ</dt>
            <dd className="mt-0.5 text-[#1d1d1f]">
              {DD_ITEM_KIND_LABEL[data.itemKind]}
              <span className="block text-[11px] text-[#6e6e73]">{ddSourceDescription(data.itemKind, data.payload)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <section aria-label="本文">
        {data.itemKind === "document" && (
          <DdDocumentBody
            payload={data.payload as unknown as DdDocumentPayload}
            fileHref={fileHref}
            canDownload={canDownload}
            previewNote={mode === "draft" ? "下書きでは添付を開けない。公開すると、公開時点のファイルを固定して開けるようになる。" : undefined}
          />
        )}
        {data.itemKind === "tech_topic" && <DdTechTopicBody payload={data.payload as unknown as DdTechTopicPayload} />}
        {data.itemKind === "funding_plan" && <DdFundingPlanBody payload={data.payload as unknown as DdFundingPlanPayload} />}
        {data.itemKind === "capital_policy" && <DdCapitalPolicyBody payload={data.payload as unknown as DdCapitalPolicyPayload} />}
        {data.itemKind === "cost_model" && <DdCostModelBody payload={data.payload as unknown as DdCostModelPayload} />}
      </section>

      <section aria-labelledby="dd-evidence" className="border-t border-[#e5e5e7] pt-3">
        <h2 id="dd-evidence" className="text-[13px] font-semibold text-[#1d1d1f]">根拠資料</h2>
        {data.evidence.length === 0 ? (
          <p className="mt-1 text-[12px] text-[#6e6e73]">この項目に結び付けた根拠資料はない。</p>
        ) : (
          <ul className="mt-1.5 divide-y divide-[#f0f0f2] rounded-lg border border-[#e5e5e7]">
            {data.evidence.map((evidence) => (
              <li key={`${evidence.title}-${evidence.fileName}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                {evidence.href ? (
                  <Link href={evidence.href} className="font-semibold text-[#0267b2] hover:underline">{evidence.title}</Link>
                ) : (
                  <span className="font-semibold text-[#1d1d1f]">{evidence.title}</span>
                )}
                {evidence.fileName && <span className="text-[11px] text-[#6e6e73]">{evidence.fileName}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dd-unverified" className="border-t border-[#e5e5e7] pt-3">
        <h2 id="dd-unverified" className="text-[13px] font-semibold text-[#1d1d1f]">
          未確認事項
          <span className="ml-1.5 rounded border border-[#cbd5e1] bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#475569]">
            {data.unverifiedNotes.length}件
          </span>
        </h2>
        {data.unverifiedNotes.length === 0 ? (
          <p className="mt-1 text-[12px] text-[#6e6e73]">公開時点で登録された未確認事項はない。</p>
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
