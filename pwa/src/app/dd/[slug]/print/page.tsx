import { DdConfidentialityNotice } from "@/components/dd/DdConfidentialityNotice";
import { notFound } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { DD_SECTIONS } from "@/lib/dd-package-core";
import { loadDdPackageRow, loadDdPublishedLive } from "@/lib/dd-package-server";
import { formatDdDate } from "@/lib/dd-format";
import { DdItemDetail } from "@/components/dd/DdItemDetail";
import { DdPrintToolbar } from "@/components/dd/DdPrintToolbar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 正式版（PDF）の印刷画面（AMD admin 限定）。2026-09-30 まさ「とある時点のバージョンを正式版として提出しなきゃいけないので、
// PDFとして出力できる機能」。公開中の項目を、いまの元データで、DDの閲覧画面と同じ部品を使って1つの文書に並べる。
// 「PDFに保存（印刷）」を押すと、出力の記録（どの項目を・いつの元データで）を残してから印刷画面を開く。

function nowInTokyo(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export default async function DdPrintPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveDdPackageAccess(slug);
  // 正式版の出力は管理者だけ（投資家へは、出力したPDFをまさが渡す）。
  if (!access || access.principal !== "internal_admin") notFound();
  const pkg = await loadDdPackageRow(access.packageId);
  if (!pkg) notFound();

  const loaded = await loadDdPublishedLive(pkg.id);
  const titleById = new Map(loaded.map(({ row }) => [row.id, row.title]));
  const topHref = `/dd/${encodeURIComponent(access.slug)}`;

  return (
    <div className="dd-print min-h-screen bg-white text-[#1d1d1f]">
      <style>{`
        @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
        @media print {
          .dd-print-toolbar { display: none !important; }
          .dd-print { font-size: 11px; }
          .dd-print * { overflow: visible !important; max-height: none !important; box-shadow: none !important; }
          .dd-print .sticky { position: static !important; }
          .dd-print-item { break-before: page; }
          .dd-print-item:first-of-type { break-before: auto; }
          .dd-print table { break-inside: auto; }
          .dd-print tr { break-inside: avoid; }
          .dd-print a { color: inherit; text-decoration: none; }
          .dd-print-no-print { display: none !important; }
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <DdPrintToolbar packageId={pkg.id} topHref={topHref} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-6">
        <header className="space-y-3 border-b-2 border-[#1d1d1f] pb-4">
          <p className="text-[11px] font-semibold text-[#6e6e73]">DD資料（正式版）</p>
          <DdConfidentialityNotice />
          <h1 className="text-[22px] font-semibold leading-8">{pkg.title}</h1>
          {pkg.notice_text && <p className="max-w-4xl text-[12.5px] leading-6 text-[#424245]">{pkg.notice_text}</p>}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#e5e5e7] bg-[#e5e5e7] text-[12px] sm:grid-cols-3">
            <div className="bg-white px-3 py-2">
              <dt className="text-[#6e6e73]">出力日時</dt>
              <dd className="mt-0.5 font-semibold">{nowInTokyo()}</dd>
            </div>
            <div className="bg-white px-3 py-2">
              <dt className="text-[#6e6e73]">掲載項目</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{loaded.length}件</dd>
            </div>
            <div className="bg-white px-3 py-2">
              <dt className="text-[#6e6e73]">この文書の内容</dt>
              <dd className="mt-0.5">出力日時点の各項目の内容。各項目の「元データの更新」はその時点の最終更新日。</dd>
            </div>
          </dl>
          <section aria-label="目次">
            <h2 className="mb-1 text-[13px] font-semibold">目次</h2>
            <ol className="grid gap-x-6 gap-y-0.5 text-[12px] sm:grid-cols-2">
              {DD_SECTIONS.map((section) => {
                const rows = loaded.filter(({ row }) => row.section_key === section.key);
                if (rows.length === 0) return null;
                return (
                  <li key={section.key}>
                    <span className="font-semibold">{section.label}</span>
                    <span className="text-[#6e6e73]">：{rows.map(({ row }) => row.title).join("、")}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        </header>

        {loaded.length === 0 ? (
          <p className="text-[13px] text-[#6e6e73]">公開中の項目がまだない。DDの管理で項目を「公開する」にしてから出力する。</p>
        ) : (
          loaded.map(({ row, live, meta }) => (
            <div key={row.id} className="dd-print-item">
              <DdConfidentialityNotice />
              <DdItemDetail
                headingLevel={2}
                topHref={null}
                fileHref={null}
                canDownload={false}
                adminPreview
                data={{
                  itemId: row.id,
                  itemKind: row.item_kind,
                  sectionKey: row.section_key,
                  title: row.title,
                  summary: row.summary,
                  isPublished: row.is_published,
                  live: live?.data ?? null,
                  liveError: meta.error,
                  sourceAsOf: meta.sourceAsOf,
                  unverifiedNotes: meta.unverifiedNotes,
                  evidence: row.evidence_item_ids
                    .filter((id) => titleById.has(id))
                    .map((id) => ({ href: null, title: titleById.get(id) ?? "" })),
                }}
              />
            </div>
          ))
        )}
        <p className="border-t border-[#e5e5e7] pt-3 text-[11px] text-[#6e6e73]">出力日時 {nowInTokyo()}・{pkg.title}・{formatDdDate(new Date().toISOString())}時点の内容</p>
      </main>
    </div>
  );
}
