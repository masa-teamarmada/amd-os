import Link from "next/link";
import { DD_ITEM_KIND_LABEL } from "@/lib/dd-payload";
import { formatDdDate } from "@/lib/dd-format";
import type { DdPackageView } from "@/lib/dd-package-server";

// DDトップ。先頭に全体の要約（公開中の項目数・最終更新・未確認事項・添付の数）を置き、
// その下に7区分をすべて同じ表の形で並べる（区分をタブで隠さない）。公開版のない項目は一切出さない。

export function DdPackageTop({ view, slug }: { view: DdPackageView; slug: string }) {
  const items = view.sections.flatMap((section) => section.items);
  const unverifiedTotal = items.reduce((sum, item) => sum + item.publication.unverified_notes.length, 0);
  const fileCount = items.filter((item) => item.publication.item_kind === "document").length;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-[20px] font-semibold leading-7 text-[#1d1d1f]">{view.package.title}</h1>
        {view.package.notice_text && (
          <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-[#424245]">{view.package.notice_text}</p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e5e7] bg-[#e5e5e7] text-[12px] sm:grid-cols-4">
          <div className="bg-white px-3 py-2.5">
            <dt className="text-[#6e6e73]">公開中の項目</dt>
            <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-[#1d1d1f]">{items.length}件</dd>
          </div>
          <div className="bg-white px-3 py-2.5">
            <dt className="text-[#6e6e73]">最終更新</dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-[#1d1d1f]">{formatDdDate(view.lastPublishedAt)}</dd>
          </div>
          <div className="bg-white px-3 py-2.5">
            <dt className="text-[#6e6e73]">未確認事項</dt>
            <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-[#475569]">{unverifiedTotal}件</dd>
          </div>
          <div className="bg-white px-3 py-2.5">
            <dt className="text-[#6e6e73]">添付資料</dt>
            <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-[#1d1d1f]">{fileCount}件</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-5 text-[#6e6e73]">
          各項目は公開日時点で確認した内容を固定したもの（公開版）。元データのその後の変更は、次の公開版を出すまで反映されない。
        </p>
      </section>

      <nav aria-label="区分" className="flex flex-wrap gap-1.5">
        {view.sections.map((section) => (
          <a
            key={section.key}
            href={`#section-${section.key}`}
            className="rounded border border-[#d2d2d7] px-2.5 py-1 text-[12px] text-[#1d1d1f] hover:border-[#027FDC] hover:text-[#027FDC]"
          >
            {section.label}
            <span className="ml-1 tabular-nums text-[#6e6e73]">{section.items.length}</span>
          </a>
        ))}
      </nav>

      {view.sections.map((section) => (
        <section key={section.key} id={`section-${section.key}`} className="scroll-mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1d1d1f] pb-1.5">
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">{section.label}</h2>
            <span className="text-[11px] text-[#6e6e73]">{section.description}</span>
          </div>
          {section.items.length === 0 ? (
            <p className="py-3 text-[12px] text-[#6e6e73]">この区分に公開中の項目はまだない。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] text-[#6e6e73]">
                    <th className="px-2 py-1.5 font-medium">項目</th>
                    <th className="w-[112px] px-2 py-1.5 font-medium">種類</th>
                    <th className="w-[64px] px-2 py-1.5 font-medium">公開版</th>
                    <th className="w-[120px] px-2 py-1.5 font-medium">公開日</th>
                    <th className="w-[120px] px-2 py-1.5 font-medium">元データの基準日</th>
                    <th className="w-[80px] px-2 py-1.5 text-right font-medium">未確認事項</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.itemId} className="border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]">
                      <td className="px-2 py-2">
                        <Link
                          href={`/dd/${encodeURIComponent(slug)}/items/${item.itemId}`}
                          className="font-semibold text-[#0267b2] hover:underline"
                        >
                          {item.publication.title}
                        </Link>
                        {item.publication.summary && (
                          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-[#6e6e73]">{item.publication.summary}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-[#424245]">{DD_ITEM_KIND_LABEL[item.publication.item_kind]}</td>
                      <td className="px-2 py-2 tabular-nums text-[#424245]">第{item.publication.revision}版</td>
                      <td className="px-2 py-2 text-[#424245]">{formatDdDate(item.publication.published_at)}</td>
                      <td className="px-2 py-2 text-[#424245]">{formatDdDate(item.publication.source_as_of)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#475569]">
                        {item.publication.unverified_notes.length > 0 ? `${item.publication.unverified_notes.length}件` : "なし"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
