import Link from "next/link";
import { ModelFormulaLayers, ModelPurpose, ModelSymbolIndex } from "@/components/model/ModelCanonSections";
import { BzmMarkdown } from "@/components/bzm/BzmMarkdown";
import { loadBzmFormulaCanon } from "./formula-canon";
import { getModelMarkdownSource, loadModelCurrent } from "./model-data";

/**
 * /model — モデル
 *
 * **このページには、まさが合意した内容だけを出す。**
 *
 * 2026-08-22 に、えいみが構成した表示物（現行版カード、SPS と BZM の系譜、構造の説明、
 * 文書棚）をすべて外した。どれも正本 md から抽出した内容ではあるが、抽出と構成を
 * えいみが行っており、まさの合意を経ていなかった（まさ指示「現状モデルページに書いて
 * あるすべての内容は、一度削除した方がいい。合意したものだけを書こう」
 * → model/APPROVALS.md #2026-08-22-7）。
 *
 * 本文は model/MODEL_VERSION_LEDGER.md をそのまま描画する。画面側で要約や再構成を
 * しない。合意が増えたら台帳へ書けば、ここは何もしなくても追随する。
 *
 * 式と記号は残す。こちらは正本 bzm md から抽出したものを出しており、
 * まさ確定 2026-08-23「正本は UI 上のものを指してる」「UI 上にないとだめ」に基づく。
 * えいみが構成した表示物ではない。
 *
 * 表示物を足すときは、先に model/APPROVALS.md へまさの合意を記録すること。
 */
export default async function ModelIndexPage() {
  const source = getModelMarkdownSource("MODEL_VERSION_LEDGER");
  const canon = loadBzmFormulaCanon();
  const current = loadModelCurrent();

  return (
    <div data-testid="model-index" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          教科書 (<Link href="/bzm" className="text-indigo-600 underline hover:opacity-80">/bzm</Link>) は本の原稿、
          設計書 (<Link href="/spec" className="text-indigo-600 underline hover:opacity-80">/spec</Link>) は実装仕様。
          ここはモデルの正本です。admin 限定。
        </p>
      </div>

      {source ? (
        <article className="mb-10">
          <BzmMarkdown source={source} />
        </article>
      ) : (
        <div className="mb-10 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
          <code className="rounded bg-muted px-1">model/MODEL_VERSION_LEDGER.md</code> を読み込めませんでした。
        </div>
      )}

      {canon ? (
        <>
          <ModelPurpose purpose={canon.purpose} />
          <ModelFormulaLayers canon={canon} />
          <ModelSymbolIndex symbols={canon.symbols} />
        </>
      ) : (
        <div className="mb-10 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-muted-foreground">
          式と記号を正本から読み込めませんでした。
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link href="/model/APPROVALS" className="text-indigo-600 underline hover:opacity-80">
          承認台帳 APPROVALS
        </Link>
        <Link href="/model/README" className="text-indigo-600 underline hover:opacity-80">
          運用規約 README
        </Link>
        {current ? <span>更新 {current.updated}</span> : null}
      </div>
    </div>
  );
}
