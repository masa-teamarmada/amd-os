import Link from "next/link";
import { BzmMarkdown, BzmMathText } from "@/components/bzm/BzmMarkdown";
import {
  CANON_DOCS,
  type CanonDocKey,
  type FormulaCanon,
  type ModelSymbol,
  type ResolvedFormula,
  type ResolvedLayer,
} from "@/app/(app)/model/formula-canon";

/**
 * モデルページの本体 — すべての式とすべての記号。
 *
 * まさ確定 2026-08-23:
 *   「正本は UI 上のものを指してるよ」「UI 上にないとだめ」
 *   「すべての式とパラメータをここに並べて、それぞれ説明を添えて。
 *     このページを見れば、モデルの全体像がひと目で分かるようにして」
 *
 * したがって「文書を開けば書いてある」は正本として成立しない。モデルを構成する式と
 * 記号は、リンクの先ではなくこの画面の上に全部出す。
 *
 * 式も記号の意味も、この画面は持たない。正本 md から表示のたびに読む
 * (formula-canon.ts のポインタ経由)。画面がモデルについて述べる文も書かず、
 * 正本の一文を引用する。詳細は pwa/spec/5-11-model-canon-page-current-spec.md。
 */

function docHref(doc: CanonDocKey, anchor?: string) {
  const slug = encodeURIComponent(CANON_DOCS[doc].slug);
  return anchor ? `/model/${slug}#${anchor}` : `/model/${slug}`;
}

/** 正本の地の文を描く。太字・リンク・インライン数式が混ざるので Markdown として通す。 */
function CanonProse({ source, className }: { source: string; className?: string }) {
  return (
    <span className={`[&_p]:my-0 [&_p]:leading-relaxed [&_ul]:my-0 ${className ?? ""}`}>
      <BzmMarkdown source={source} compact />
    </span>
  );
}

export function ModelFormulaLayers({ canon }: { canon: FormulaCanon }) {
  const total = canon.layers.reduce((n, l) => n + l.entries.length, 0);

  return (
    <section id="formulas" className="mb-12 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-foreground">
          すべての式（{total}本）<span className="ml-2 text-xs font-normal text-muted-foreground">旧 BZM 2.2 系列</span>
        </h2>
        <a href="#symbols" className="text-xs text-indigo-600 underline hover:opacity-80">
          記号の一覧へ ↓
        </a>
      </div>

      {/* 2026-08-24: BZM 3.0 の採用で、この一覧が抽出している bzm/ の正本は旧系列になった
          (APPROVALS #2026-08-24-10・#2026-08-24-11)。抽出経路はそのまま残し、版だけを明示する。
          「現行の式」の顔で旧版が並ぶ状態を画面に作らないための札であって、内容は正本のまま。
          一覧の入れ替えは 735件の評価を盤面へ移す実装移行と同じ段で行う。 */}
      <div className="mb-4 rounded-md bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
        <span className="font-bold">この一覧は旧 BZM 2.2 系列の式です。</span>
        2026-08-24 に BZM 3.0 を採用したため退役しました。現行 BZM 3.0 の式（スコア・道筋の価値・関門を越える確率・
        担い手の充足係数・燃料の増減）は、このページ上部の「手順4 の成果 — BZM 3.0」と、
        <Link href="/model/2026-08-24_step4_scoring-model-v3" className="mx-1 text-indigo-700 underline hover:opacity-80">
          BZM 3.0 本文
        </Link>
        にあります。一覧の入れ替えは実装移行と同じ段で行います。
      </div>

      {canon.unresolved > 0 ? (
        <div className="mb-4 rounded-md bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-900 ring-1 ring-rose-200">
          <span className="font-bold">{canon.unresolved} 件を正本から取り出せていません。</span>
          正本の見出しか数式の並びが変わった可能性があります。該当箇所は下に赤で示しています。
        </div>
      ) : null}

      <nav className="mb-6 flex flex-wrap gap-1.5">
        {canon.layers.map((layer) => (
          <a
            key={layer.key}
            href={`#${layer.key}`}
            className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
          >
            {layer.title}
            <span className="ml-1 text-[10px] text-muted-foreground">{layer.entries.length}</span>
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {canon.layers.map((layer) => (
          <LayerBlock key={layer.key} layer={layer} />
        ))}
      </div>
    </section>
  );
}

function LayerBlock({ layer }: { layer: ResolvedLayer }) {
  return (
    <section id={layer.key} className="scroll-mt-20">
      <h3 className="mb-1 border-b border-border pb-1.5 text-sm font-bold text-foreground">
        {layer.title}
      </h3>
      {/* この層が何を決めているかは、画面で要約せず正本の一文をそのまま引く。
          画面用に書き直すと、正本にない限定や正本より強い主張が静かに混ざる
          (2026-08-23 まさ指摘)。引用であることが読み手にも分かる体裁にする。 */}
      {layer.quote_text ? (
        <blockquote className="mb-4 border-l-2 border-slate-300 pl-3 text-xs leading-relaxed text-muted-foreground">
          <CanonProse source={layer.quote_text} className="[&_p]:inline" />
          <Link
            href={docHref(layer.quote_doc, layer.quote_anchor)}
            className="ml-1.5 whitespace-nowrap text-[10.5px] text-indigo-600 underline hover:opacity-80"
          >
            正本 §{layer.quote.section}
          </Link>
        </blockquote>
      ) : (
        <p className="mb-4 rounded-md bg-rose-50 px-2.5 py-2 text-xs leading-relaxed text-rose-900 ring-1 ring-rose-200">
          正本の「{layer.quote.section}」から引用文（{layer.quote.match}）を取り出せませんでした。
        </p>
      )}
      <div className="space-y-5">
        {layer.entries.map((entry) => (
          <FormulaCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function FormulaCard({ entry }: { entry: ResolvedFormula }) {
  if (!entry.resolved) {
    return (
      <div id={entry.id} className="scroll-mt-20 rounded-lg border border-rose-300 bg-rose-50 p-4">
        <h4 className="mb-1 text-sm font-bold text-rose-900">{entry.label}</h4>
        <p className="text-xs leading-relaxed text-rose-800">{entry.problem}</p>
        <p className="mt-1.5 text-[11px] text-rose-700">
          正本の見出し「{entry.section}」の {entry.group} 番目を指しています。
        </p>
      </div>
    );
  }

  return (
    <div id={entry.id} className="scroll-mt-20 rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-bold text-foreground">{entry.label}</h4>
        <Link
          href={docHref(entry.source_doc, entry.source_anchor)}
          className="shrink-0 text-[11px] text-indigo-600 underline hover:opacity-80"
        >
          {CANON_DOCS[entry.source_doc].title} §{entry.section}
          {entry.source_line ? `（:${entry.source_line}）` : ""}
        </Link>
      </div>

      {entry.lead_text ? (
        <div className="mb-1 text-xs leading-relaxed text-muted-foreground">
          <CanonProse source={entry.lead_text} />
        </div>
      ) : null}

      <div className="my-2 overflow-x-auto rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
        {entry.tex.map((tex, i) => (
          <BzmMathText key={i} source={`$$${tex}$$`} />
        ))}
      </div>

      {entry.tail_text ? (
        <div className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground [&_table]:text-[11px]">
          <BzmMarkdown source={entry.tail_text} compact />
        </div>
      ) : null}
    </div>
  );
}

export function ModelSymbolIndex({ symbols }: { symbols: ModelSymbol[] }) {
  return (
    <section id="symbols" className="mb-12 scroll-mt-20">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-foreground">
          すべての記号（{symbols.length}個）<span className="ml-2 text-xs font-normal text-muted-foreground">旧 BZM 2.2 系列</span>
        </h2>
        <a href="#formulas" className="text-xs text-indigo-600 underline hover:opacity-80">
          式の一覧へ ↑
        </a>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        上の式に出てくる記号の意味です。説明はすべて正本の記号表から読んでいます。
        同じ記号を複数の正本が説明している場合は、どれも消さずに併記します。
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="w-[22%] px-3 py-2 text-[11px] font-bold text-slate-700">記号</th>
              <th className="px-3 py-2 text-[11px] font-bold text-slate-700">意味</th>
              <th className="w-[22%] px-3 py-2 text-[11px] font-bold text-slate-700">正本</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((sym) => (
              <tr key={sym.symbol + sym.section} className="border-b border-border last:border-b-0 align-top">
                <td className="px-3 py-2 text-[13px]">
                  <BzmMathText source={sym.symbol} />
                </td>
                <td className="px-3 py-2 text-[11.5px] leading-relaxed text-slate-800">
                  <CanonProse source={sym.meaning} />
                  {sym.also.map((alt, i) => (
                    <span key={i} className="mt-1 block border-l-2 border-slate-200 pl-2 text-[11px] text-muted-foreground">
                      <CanonProse source={alt.meaning} />
                      <Link
                        href={docHref(alt.doc, alt.anchor)}
                        className="ml-1 whitespace-nowrap text-[10px] text-indigo-600 underline hover:opacity-80"
                      >
                        {CANON_DOCS[alt.doc].title}
                      </Link>
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2 text-[10.5px] leading-snug">
                  <Link href={docHref(sym.doc, sym.anchor)} className="text-indigo-600 underline hover:opacity-80">
                    {CANON_DOCS[sym.doc].title}
                  </Link>
                  <span className="block text-muted-foreground">§{sym.section}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
