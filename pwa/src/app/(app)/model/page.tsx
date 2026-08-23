import Link from "next/link";
import { ModelFormula } from "@/components/model/ModelFormula";
import {
  loadModelCurrent,
  type ModelSeries,
  type ModelStatusTone,
} from "./model-data";

/**
 * /model — モデル index
 *
 * 教科書 (/bzm) は本の原稿、設計書 (/spec) は実装仕様、ここはモデルそのものの
 * 正本と版数台帳。「いま現行なのはどの式か」「その式の中身はどこで承認されたか」を
 * 1画面で確定させる。admin 限定 (= model/layout.tsx で保護)。
 */

const TONE_CLASSES: Record<ModelStatusTone, string> = {
  ok: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  muted: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export default async function ModelIndexPage() {
  const current = loadModelCurrent();

  if (!current) {
    return (
      <div data-testid="model-index" className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-bold">AMD OS — モデル</h1>
        <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
          台帳準備中。<code className="rounded bg-muted px-1">model/CURRENT.json</code> がまだ無いか、読み込みに失敗しました。
        </div>
      </div>
    );
  }

  return (
    <div data-testid="model-index" className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">AMD OS — モデル</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          教科書 (<Link href="/bzm" className="text-indigo-600 underline hover:opacity-80">/bzm</Link>) は本の原稿、
          設計書 (<Link href="/spec" className="text-indigo-600 underline hover:opacity-80">/spec</Link>) は実装仕様。
          ここは AMD OS が使っているモデルそのものの正本と版数台帳です。いまどの式が現行か、
          その式の中身は誰がいつ承認したかをここで確定します。admin 限定。
        </p>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-bold text-foreground">現在の正式版</h2>
          <Link
            href="/model/formulas"
            className="shrink-0 text-xs font-semibold text-indigo-600 underline hover:opacity-80"
          >
            BZM 2.2 の式を全部見る →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {current.series.map((series) => (
            <SeriesCard key={series.key} series={series} ledgerSlug={current.ledger_slug} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-bold text-foreground">版の系譜</h2>
        <div className="space-y-6">
          {current.series.map((series) => {
            const lineageAnchor = series.timeline.find((entry) => entry.anchor)?.anchor;
            return (
              <div key={series.key} className="rounded-lg border border-border bg-white p-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold text-foreground">{series.title}</h3>
                  {lineageAnchor ? (
                    <Link
                      href={`/model/${encodeURIComponent(current.ledger_slug)}#${lineageAnchor}`}
                      className="shrink-0 text-xs text-indigo-600 underline hover:opacity-80"
                    >
                      台帳の系譜へ
                    </Link>
                  ) : null}
                </div>
                <ol className="space-y-3 border-l border-border pl-4">
                  {series.timeline.map((entry, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[19px] top-1.5 size-2 rounded-full bg-slate-300" />
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{entry.date}</span>
                        <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                        {entry.formula ? (
                          <span className="font-mono text-xs text-muted-foreground">{entry.formula}</span>
                        ) : null}
                      </div>
                      {entry.note ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-bold text-foreground">文書棚</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DocShelf title="確定文書">
            {current.documents.canonical.map((doc) => (
              <DocRow key={doc.slug} doc={doc} sub={doc.status} />
            ))}
          </DocShelf>
          <DocShelf title="提案中">
            {current.documents.proposals.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                提案中の文書はありません。新しい概念はここに置かれ、まさの承認まで正本に入りません。
              </p>
            ) : (
              current.documents.proposals.map((doc) => (
                <DocRow key={doc.slug} doc={doc} sub={doc.date} />
              ))
            )}
          </DocShelf>
          <DocShelf title="撤回済み">
            {current.documents.withdrawn.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">撤回済みの文書はありません。</p>
            ) : (
              current.documents.withdrawn.map((doc) => (
                <DocRow key={doc.slug} doc={doc} sub={doc.date} />
              ))
            )}
          </DocShelf>
        </div>
      </section>

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href={`/model/${encodeURIComponent(current.ledger_slug)}#references`} className="text-indigo-600 underline hover:opacity-80">
          参考文献（台帳）
        </Link>
        <Link href="/model/APPROVALS" className="text-indigo-600 underline hover:opacity-80">
          承認台帳 APPROVALS
        </Link>
        <Link href="/model/README" className="text-indigo-600 underline hover:opacity-80">
          運用規約 README
        </Link>
      </div>
    </div>
  );
}

function SeriesCard({ series, ledgerSlug }: { series: ModelSeries; ledgerSlug: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">{series.title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[series.status.tone]}`}>
          {series.status.label}
        </span>
      </div>

      <div className="mb-2">
        <ModelFormula formula={series.formula} ledgerSlug={ledgerSlug} />
      </div>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{series.summary}</p>

      {series.key === "bzm" ? (
        <p className="mb-3 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900 ring-1 ring-amber-200">
          BZM 2.2 は前向き検証0件の pilot。投資判断・対外表示には使わない。
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-muted-foreground">
        {Object.entries(series.versions).map(([key, value]) => (
          <span key={key}>
            {key}={value}
          </span>
        ))}
      </div>

      {series.canonical.length > 0 ? (
        <ul className="space-y-1 border-t border-border pt-2">
          {series.canonical.map((doc) => (
            <li key={doc.slug}>
              <Link href={`/model/${encodeURIComponent(doc.slug)}`} className="text-xs text-indigo-600 underline hover:opacity-80">
                {doc.title}
              </Link>
              {doc.status ? <span className="ml-1.5 text-[10.5px] text-muted-foreground">({doc.status})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DocShelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="mb-2 text-xs font-bold text-foreground">{title}</h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function DocRow({ doc, sub }: { doc: { slug: string; title: string }; sub?: string }) {
  return (
    <li>
      <Link href={`/model/${encodeURIComponent(doc.slug)}`} className="block text-xs font-medium text-indigo-600 underline hover:opacity-80">
        {doc.title}
      </Link>
      {sub ? <span className="text-[10.5px] text-muted-foreground">{sub}</span> : null}
    </li>
  );
}
