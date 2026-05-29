import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "知財 / IP - AMD OS" } };

import { MarkdownView } from "@/components/cockpit/MarkdownView";
import { IP_REPORT_MD, IP_REPORT_UPDATED } from "./ip-report";

export default function AdminIpPage() {
  return (
    <div className="max-w-4xl">
      {/* ヘッダー (AMD ブランド: Armada Blue #1A8FE6 / Gray #4A4A4A / 白基調) */}
      <div className="mb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-[#1F2937]">知財 / IP</h1>
          <span className="text-sm text-[#6B7280]">
            AMD OS / AMDプロトコル 特許化レポート
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
          (出願前に公開すると新規性を失う)。詳細・全公報リスト・請求項全文は{" "}
          <code className="rounded bg-white px-1 py-0.5 text-[11px] text-[#0B6FC2]">
            docs/ip/
          </code>{" "}
          配下の正本 md / docx を参照。
        </div>
      </div>

      {/* レポート本体 */}
      <div className="rounded-lg border border-[#D9DDE3] bg-white px-5 py-4 shadow-sm">
        <MarkdownView source={IP_REPORT_MD} tone="light" />
      </div>
    </div>
  );
}
