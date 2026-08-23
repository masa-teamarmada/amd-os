import Link from "next/link";
import { BzmMarkdown, BzmMathText } from "@/components/bzm/BzmMarkdown";
import { ModelSideNav, type ModelSideNavGroup } from "@/components/model/ModelSideNav";
import {
  loadBzmFormulaCanon,
  type ResolvedFormula,
  type ResolvedLayer,
} from "../formula-canon";
import { buildModelSideNavGroups, loadModelCurrent } from "../model-data";

/**
 * /model/formulas — BZM 2.2 の現行の式
 *
 * 教科書 (/bzm) は本の原稿、設計書 (/spec) は実装仕様、/model はモデル正本の層。
 * その中でここは「いま現行なのはどの式か」だけを、正本の並び順のまま並べる画面。
 *
 * 式は正本 md から毎回読む (formula-canon.ts のポインタ経由)。画面側は TeX を持たない。
 * 正本を変えられるのは model/README.md の承認手順だけで、この画面はその結果を映すだけ。
 * admin 限定 (= model/layout.tsx)。
 */

export default async function ModelFormulasPage() {
  const canon = loadBzmFormulaCanon();
  const current = loadModelCurrent();
  const navGroups: ModelSideNavGroup[] = current ? buildModelSideNavGroups(current) : [];
  const bzmSeries = current?.series.find((series) => series.key === "bzm");

  return (
    <section
      data-testid="model-formulas"
      className="grid gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]"
    >
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <ModelSideNav groups={navGroups} activeSlug="formulas" />
      </aside>

      <div className="min-w-0">
        <article className="mx-auto max-w-3xl">
          <Link
            href="/model"
            className="mb-4 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← モデル
          </Link>

          <h1 className="mb-2 text-2xl font-bold text-foreground">BZM 2.2 — 現行の式</h1>

          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            正本{" "}
            {canon ? (
              <Link
                href={`/model/${encodeURIComponent(canon.canon_slug)}`}
                className="text-indigo-600 underline hover:opacity-80"
              >
                BZM 2.2 — 戦略余力と推進力の動学
              </Link>
            ) : (
              "BZM 2.2 — 戦略余力と推進力の動学"
            )}{" "}
            に載っている現行の式を、正本の並び順のまま集めた一覧です。式と記号の説明は
            表示のたびに正本 md から読んでいるので、この画面が正本と別の式を持つことはありません。
            変更できるのは正本だけで、手順は{" "}
            <Link href="/model/README" className="text-indigo-600 underline hover:opacity-80">
              運用規約
            </Link>
            にあります。
          </p>

          <div className="mb-6 rounded-md bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            <span className="font-bold">
              {bzmSeries?.versions.model_version ?? "provisional-pilot-v0.1 / unvalidated"}
            </span>
            。前向き検証0件、本実装前（pilot 画面は内部 shadow 試算）。
            測定済みの q または q_rob、PJ間比較、投資判断、資源配分に使わない。
          </div>

          {!canon ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
              正本 <code className="rounded bg-muted px-1">bzm/bzm-2-2-strategic-slack-and-propulsion.md</code>{" "}
              を読み込めませんでした。
            </div>
          ) : (
            <>
              {canon.unresolved > 0 ? (
                <div className="mb-6 rounded-md bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-900 ring-1 ring-rose-200">
                  <span className="font-bold">{canon.unresolved} 件の式を正本から取り出せていません。</span>
                  正本の見出しか数式の並びが変わった可能性があります。該当箇所は下に赤で示しています。
                </div>
              ) : null}

              <nav className="mb-8 rounded-lg border border-border bg-slate-50 p-3">
                <p className="mb-2 text-[11px] font-bold text-muted-foreground">この画面の並び</p>
                <ul className="space-y-1.5">
                  {canon.layers.map((layer) => (
                    <li key={layer.key} className="text-xs leading-snug">
                      <a
                        href={`#${layer.key}`}
                        className="font-semibold text-indigo-600 underline hover:opacity-80"
                      >
                        {layer.title}
                      </a>
                      <span className="ml-2 text-muted-foreground">
                        {layer.entries.map((entry) => entry.label).join(" / ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="space-y-10">
                {canon.layers.map((layer) => (
                  <LayerBlock key={layer.key} layer={layer} canonSlug={canon.canon_slug} />
                ))}
              </div>

              <div className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                <p className="mb-1">
                  この一覧は正本 <code className="rounded bg-muted px-1">{canon.canon_path}</code>{" "}
                  の §4・§5・§6・§7・§9・§15・§16 に置かれた式を対象にしています。
                </p>
                <p className="mb-1">
                  一次選別で使う SPS（
                  <BzmMathText source={"$\\mathrm{SPS}=\\sum_o q_o P^{\\mathrm{ind}}_o$"} />
                  ）は、BZM の外にある別のモデルではなく、同じ BZM から出る別の出力です。
                  2.2 が置き換えた戦略余力の中身は、到達見込み{" "}
                  <BzmMathText source={"$q$"} /> の定義を通して SPS の入力にも及びます。
                  その構造と SPS の現行式は{" "}
                  <Link
                    href="/model/MODEL_VERSION_LEDGER#lineage-relation"
                    className="text-indigo-600 underline hover:opacity-80"
                  >
                    版数台帳 §5
                  </Link>
                  にあります。
                </p>
                <p>
                  版の系譜（1.x → 2.0 → 2.1 → 2.2）も{" "}
                  <Link
                    href="/model/MODEL_VERSION_LEDGER"
                    className="text-indigo-600 underline hover:opacity-80"
                  >
                    版数台帳
                  </Link>
                  にあります。
                </p>
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function LayerBlock({ layer, canonSlug }: { layer: ResolvedLayer; canonSlug: string }) {
  return (
    <section id={layer.key} className="scroll-mt-24">
      <h2 className="mb-1 border-b border-border pb-1.5 text-base font-bold text-foreground">
        {layer.title}
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{layer.intro}</p>
      <div className="space-y-5">
        {layer.entries.map((entry) => (
          <FormulaCard key={entry.id} entry={entry} canonSlug={canonSlug} />
        ))}
      </div>
    </section>
  );
}

function FormulaCard({ entry, canonSlug }: { entry: ResolvedFormula; canonSlug: string }) {
  if (!entry.resolved) {
    return (
      <div
        id={entry.id}
        className="scroll-mt-24 rounded-lg border border-rose-300 bg-rose-50 p-4"
      >
        <h3 className="mb-1 text-sm font-bold text-rose-900">{entry.label}</h3>
        <p className="text-xs leading-relaxed text-rose-800">{entry.problem}</p>
        <p className="mt-1.5 text-[11px] text-rose-700">
          正本の見出し「{entry.section}」の {entry.group} 番目を指しています。
        </p>
      </div>
    );
  }

  return (
    <div
      id={entry.id}
      className="scroll-mt-24 rounded-lg border border-border bg-white p-4 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-foreground">{entry.label}</h3>
        <Link
          href={`/model/${encodeURIComponent(canonSlug)}#${entry.source_anchor}`}
          className="shrink-0 text-[11px] text-indigo-600 underline hover:opacity-80"
        >
          正本 §{entry.section}
          {entry.source_line ? `（:${entry.source_line}）` : ""}
        </Link>
      </div>

      {entry.lead_text ? (
        <p className="mb-1 text-xs leading-relaxed text-muted-foreground">
          <BzmMathText source={entry.lead_text} />
        </p>
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
