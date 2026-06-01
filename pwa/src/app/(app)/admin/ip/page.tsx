import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "知財 / IP - AMD OS" } };

import { MarkdownView } from "@/components/cockpit/MarkdownView";
import { IP_REPORT_MD, IP_REPORT_UPDATED } from "./ip-report";
import { PATENT_DRAFT_DOCS } from "./patent-drafts.generated";

export default function AdminIpPage() {
  return (
    <div className="max-w-5xl">
      {/* ヘッダー (AMD ブランド: Armada Blue #1A8FE6 / Gray #4A4A4A / 白基調) */}
      <div className="mb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-[#1F2937]">知財 / IP</h1>
          <span className="text-sm text-[#6B7280]">
            AMD OS / AMDプロトコル 特許化レポート・出願案
          </span>
        </div>
        <div className="mt-1.5 h-[3px] w-16 rounded-full bg-[#1A8FE6]" />

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-[#E6F2FC] px-2.5 py-0.5 text-[11px] font-medium text-[#0B6FC2]">
            弁理士 初回相談 Ready
          </span>
          <span className="inline-flex items-center rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-medium text-[#4A4A4A]">
            出願前
          </span>
          <span className="inline-flex items-center rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-medium text-[#4A4A4A]">
            最終更新 {IP_REPORT_UPDATED}
          </span>
        </div>

        <div className="mt-3 rounded-md border border-[#D9DDE3] bg-[#F2F4F7] px-3 py-2 text-[12px] text-[#4A4A4A]">
          🔒 <strong className="font-semibold">機密 / NDA 前提</strong>。
          外部共有・公開・登壇・note 投稿の前に、コア部分は弁理士へ確認すること
          (出願前に公開すると新規性を失う)。このページには現状の請求項案・明細書案・図面案を含む。正本 md は{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] text-[#0B6FC2]">
            docs/ip/
          </code>{" "}
          配下。
        </div>
      </div>

      {/* レポート本体 */}
      <section className="rounded-lg border border-[#D9DDE3] bg-white px-5 py-4 shadow-sm">
        <MarkdownView source={IP_REPORT_MD} tone="light" />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1F2937]">現状の出願案</h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">
              請求項、明細書、図面案、対応表、現OS乖離監査をOS内で確認できる内部ビュー。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {PATENT_DRAFT_DOCS.map((doc) => (
              <a
                key={doc.id}
                href={`#${doc.id}`}
                className="rounded-full border border-[#D9DDE3] bg-white px-2.5 py-1 text-[#0B6FC2] hover:bg-[#E6F2FC]"
              >
                {doc.title}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {PATENT_DRAFT_DOCS.map((doc) => (
            <details
              key={doc.id}
              id={doc.id}
              open={doc.defaultOpen}
              className="rounded-lg border border-[#D9DDE3] bg-white shadow-sm"
            >
              <summary className="cursor-pointer list-none px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1F2937]">{doc.title}</h3>
                    <p className="mt-1 text-[12px] text-[#6B7280]">{doc.description}</p>
                  </div>
                  <code className="rounded bg-[#F2F4F7] px-2 py-1 text-[11px] text-[#4A4A4A]">
                    docs/ip/{doc.filename}
                  </code>
                </div>
              </summary>
              <div className="border-t border-[#E5E7EB] px-5 py-4">
                <MarkdownView source={doc.source} tone="light" />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
