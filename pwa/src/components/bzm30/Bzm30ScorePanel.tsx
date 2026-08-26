"use client";

/**
 * BZM 3.0 — 産業創出価値 V の算出パネル。
 *
 * まさ 2026-08-27:「シーズリストの各シーズをクリックしたときに出てくるモーダルの中の計算式を
 * 『一次選別スクリーニング』なんていう存在しないスクリーニング方法にせずに BZM3.0 の SPS 算出の
 * モデルを入れてほしい。そのモデルの各数式を書いて、そこに入るパラメータの数値をすべて記して、
 * そのパラメータの算出根拠も書く仕様に直してほしい」。
 *
 * 【このパネルが守ること】
 * 1. **式は正本から取る。画面で書き起こさない。** モデルページ（model/MODEL_VERSION_LEDGER.md）の
 *    $$…$$ をそのまま出す。正本の式が変われば画面も変わる。
 * 2. **係数の値は参照実装から取る。** model/tools/bzm30_forward.cjs の CFG が唯一の出どころで、
 *    根拠レベルと正本の節を添えて全件出す（73件）。
 * 3. **埋まっていない入力を既定値で埋めたことにしない。** どこまでが観測で、どこからが
 *    Tier 0 の既定か、何を調べれば円のスコアが出るのかを表に出す。
 *
 * 🚫 cyber HUD デザインコード（黒背景 / ネオン発光 / SVG コーナーフレーム）は使わない
 * （まさ確定 2026-08-21）。モーダルの他セクションに溶け込ませる。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Tex } from "@/components/venture-map/Tex";
import { BzmMathText } from "@/components/bzm/BzmMarkdown";
import { FormulaPanelShell } from "@/components/formula/FormulaPanelKit";
import { loadBzm30Model, peekBzm30Model, type Bzm30Model } from "@/lib/bzm30-model-client";
import {
  buildSeedInputs,
  inputSummary,
  PROCESS_TYPE_LABEL,
  REG_CLASS_LABEL,
  type Bzm30SeedInput,
  type ProcessType,
  type RegClass,
} from "@/lib/bzm30/seed-inputs";
import type { Seed, SeedDetail, SeedScreeningBandDetail } from "@/types/seeds";

const ORIGIN_TONE: Record<Bzm30SeedInput["origin"], string> = {
  観測: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Tier 0 既定": "border-border bg-muted/60 text-muted-foreground",
  未調査: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  承認待ち: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

const LEVEL_NOTE: Record<string, string> = {
  A: "公開統計または AMD の実測値から、その数字が直接引ける",
  B: "制度の設計・文献から水準が導出されている",
  C: "暫定の置き（較正前）",
  規約: "値そのものが規約で決まっており、較正の対象ではない",
  確定: "まさの承認で確定した値",
};


/** 係数がどの量に効くかの記号を、日本語の呼び名へ。値は tier0.json の usedIn。 */
const USED_IN_LABEL: Record<string, string> = {
  "Π": "価値",
  v: "スコア",
  q_o: "9区分の確率",
  C: "継続価値",
  y: "売上",
  "p^adv": "ゲートの前進",
  "η": "担い手の充足",
  "φ": "採択",
  "φ_u": "取り分",
  "ν": "到来率",
  "ν_k": "実現の申し出",
  "ν_c": "受託の申し出",
  "s^f": "自由資金",
  "s^r": "使途制限資金",
  "ι": "会社化",
  "m_θ": "経済性の乗数",
  "χ": "受託契約",
  "ρ": "受託の工数",
  n: "成否の履歴",
  "p^res": "権利・承認の解決",
  R: "権利・承認の残件",
  "λ": "消失",
  "λ^comp": "競合による消失",
};

const pc = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${(100 * x).toFixed(1)}%`);

export function Bzm30ScorePanel({
  seed,
  detail,
  band,
  model: modelProp,
}: {
  seed: Seed;
  detail: SeedDetail | null;
  band: SeedScreeningBandDetail | null;
  /** サーバコンポーネントから渡す場合。省略時はクライアントの参照系キャッシュから読む。 */
  model?: Bzm30Model;
}) {
  const [fetched, setFetched] = useState<Bzm30Model | undefined>(() => modelProp ?? peekBzm30Model());
  const model = modelProp ?? fetched;

  useEffect(() => {
    if (model) return;
    let cancelled = false;
    loadBzm30Model()
      .then((m) => {
        if (!cancelled) setFetched(m);
      })
      .catch(() => {
        /* 補助表示。取得に失敗してもシーズ詳細本体は落とさない。 */
      });
    return () => {
      cancelled = true;
    };
  }, [model]);

  const inputs = buildSeedInputs(seed, detail, band);
  const summary = inputSummary(inputs);

  if (!model) {
    return (
      <div className="rounded border border-border bg-card px-4 py-4" aria-busy="true">
        <div className="text-[14px] font-semibold text-foreground">BZM 3.0 — 産業創出価値 V の算出</div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <FormulaPanelShell
      testId="bzm30-score-panel"
      title="BZM 3.0 — 産業創出価値 V の算出"
      lead={
        <>
          スコアは、この案件が<strong className="font-semibold text-foreground">国内に生む付加価値の純増</strong>を、
          起こりうるシナリオの確率と案件パラメータの不確かさの両方で重ね合わせ、社会的割引率で現在価値に直した金額（円）。
          出資の持ち分でも、倒産の確率でもない。式・記号の意味・係数の値は、すべて
          <Link href="/model" className="text-indigo-600 underline hover:opacity-80">モデルページ</Link>
          と参照実装から取っている（画面が書き起こしたものは無い）。
        </>
      }
      badge={
        <>
          <div>{model.model_version}</div>
          <div>承認 #{model.approval_ref}</div>
          <div className="mt-1 text-[10px]">V は有効数字2桁</div>
        </>
      }
    >
      <SeedInputBlock inputs={inputs} summary={summary} />
      <ScoreDefinitionBlock model={model} inputs={inputs} />
      <GridBlock model={model} />
      <FormulaListBlock model={model} />
      <ParamListBlock model={model} />
      <ApproximationBlock model={model} />
    </FormulaPanelShell>
  );
}

// ───────────────────────────────── このシーズの入力

function SeedInputBlock({
  inputs,
  summary,
}: {
  inputs: Bzm30SeedInput[];
  summary: { filled: number; total: number; blockers: string[] };
}) {
  return (
    <section className="min-w-0 rounded border border-border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-[13px] font-semibold text-foreground">
          このシーズで、式に入る値がいくつ埋まっているか
        </h4>
        <span className="font-mono text-[11px] text-muted-foreground">
          観測から {summary.filled} / {summary.total} 件
        </span>
      </div>
      {summary.blockers.length > 0 ? (
        <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
          <strong className="font-semibold">円のスコアはまだ出せない。</strong>{" "}
          {summary.blockers.join(" / ")} が埋まっていないため。とくに<strong className="font-semibold">天井</strong>
          （用途ごとの国内の年額の付加価値）は価値の式に直接入る量で、これが無いと金額にならない。
          埋まっていない項目は、下の「出どころ」の列に何を調べればよいかを書いてある。
        </p>
      ) : null}
      <div className="w-0 min-w-full overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
              <th className="w-[15%] px-2 py-1 font-medium">記号</th>
              <th className="w-[22%] px-2 py-1 font-medium">入力</th>
              <th className="w-[25%] px-2 py-1 font-medium">このシーズの値</th>
              <th className="w-[10%] px-2 py-1 font-medium">出どころ</th>
              <th className="w-[28%] px-2 py-1 font-medium">根拠 / 何を調べれば埋まるか</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((i) => (
              <tr key={i.key} className="border-b border-border/40 align-top">
                <td className="px-2 py-1.5 font-mono text-[11px] text-foreground">
                  {i.symbol ? <Tex tex={i.symbol} /> : "—"}
                </td>
                <td className="px-2 py-1.5 leading-snug text-foreground">{i.name}</td>
                <td className={`px-2 py-1.5 leading-snug ${i.filled ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                  {i.value}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] ${ORIGIN_TONE[i.origin]}`}>
                    {i.origin}
                  </span>
                </td>
                <td className="px-2 py-1.5 leading-snug text-muted-foreground">{i.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ───────────────────────────────── スコアの定義と、円にする道筋

function ScoreDefinitionBlock({ model, inputs }: { model: Bzm30Model; inputs: Bzm30SeedInput[] }) {
  const score = model.formulas.find((f) => f.id === "score");
  const report = model.formulas.find((f) => f.id === "report");
  const value = model.formulas.find((f) => f.id === "value");
  const ceilingKnown = inputs.find((i) => i.key === "P_bar")?.filled ?? false;

  return (
    <section className="min-w-0 rounded border border-border bg-muted/20 p-3">
      <h4 className="mb-2 text-[13px] font-semibold text-foreground">スコアの定義と、金額になるまでの道筋</h4>

      <div className="space-y-2">
        {score ? <FormulaCard f={score} /> : null}
        {report ? <FormulaCard f={report} /> : null}
        {value ? <FormulaCard f={value} /> : null}
      </div>

      <div className="mt-3 rounded border border-border bg-background/60 px-3 py-2.5">
        <div className="text-[11px] font-semibold text-foreground">この式を、いまのシーズに当てはめる順番</div>
        <ol className="mt-1.5 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">1. 工程の型 × 規制属性を決める。</strong>{" "}
            ゲートの列（何をいくつ越える必要があるか）と、その所要月数・バーンレート・自走力の既定値がここで決まる。
          </li>
          <li>
            <strong className="text-foreground">2. 評価日の証拠水準を決める。</strong>{" "}
            列のどこから始めるか。同じ案件でも、始点が違えば量産へ届く確率は大きく変わる。
          </li>
          <li>
            <strong className="text-foreground">3. 前向きに計算して、天井 1 円あたりの現在価値 v を出す。</strong>{" "}
            1 と 2 が決まればここは自動で出る（下の表）。月ごとに前進・補給・支出・消失・申し出を判定し、
            シナリオを9区分のどれかへ落として、実現した月ごとの価値を割り引いて積む。
          </li>
          <li>
            <strong className="text-foreground">4. 天井を掛けて金額にする。</strong>
            <span className="ml-1 inline-block align-middle">
              <Tex tex="V \;=\; \big(\bar P_u - \delta_u\big)\times v" />
            </span>
            {ceilingKnown ? null : (
              <span className="ml-1 text-rose-600 dark:text-rose-400">— 天井が未調査なので、この段はまだ踏めない。</span>
            )}
          </li>
        </ol>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          天井は<strong>用途ごとに年額の一つの数</strong>で置き、幅を持たせない（モデルページ §5.3 改訂 M1）。
          到達の不確かさはシナリオの確率が担っているので、天井にも幅を置くと同じ不確かさを二回数えることになる。
        </p>
      </div>
    </section>
  );
}

function FormulaCard({ f }: { f: Bzm30Model["formulas"][number] }) {
  return (
    <div className="rounded border border-border bg-background/60 px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[11px] font-semibold text-foreground">{f.title}</span>
        <Link href={`/model#${f.anchor}`} className="font-mono text-[10px] text-indigo-600 underline hover:opacity-80">
          正本 {f.section}
        </Link>
      </div>
      <div className="mt-1.5 w-0 min-w-full overflow-x-auto">
        <Tex tex={f.tex} display />
      </div>
      {f.symbols.length > 0 ? (
        <div className="mt-1.5 space-y-0.5 text-[10px] leading-snug text-muted-foreground">
          {f.symbols.map((s, i) => (
            <div key={i} className="flex gap-1">
              <span className="shrink-0 whitespace-nowrap">
                <BzmMathText source={s.symbol} />
              </span>
              <span className="shrink-0">=</span>
              <span className="min-w-0 flex-1">
                <BzmMathText source={s.meaning} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}


// ───────────────────────────────── 型 × 規制 × 証拠水準の格子

function GridBlock({ model }: { model: Bzm30Model }) {
  if (model.grid.length === 0) {
    return (
      <Foldable title="型 × 規制属性 × 証拠水準ごとの v（天井1円あたりの現在価値）" summary="計算結果が未生成">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          前向き計算の結果がまだ書き出されていない。
          <code className="mx-1 break-all rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
            node model/tools/bzm30_export.cjs --grid
          </code>
          で生成する。
        </p>
      </Foldable>
    );
  }

  const types = Array.from(new Set(model.grid.map((r) => r.type))) as ProcessType[];
  return (
    <Foldable
      title="型 × 規制属性 × 証拠水準ごとの v（天井1円あたりの現在価値）"
      summary={`${model.grid.length} 通り`}
    >
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        天井を 1 に正規化した現在価値。<strong className="text-foreground">このシーズの型・規制・証拠水準が決まると、この表の1行が確定する。</strong>
        あとは天井（年額の国内純増）を掛ければ金額になる。V の下限は10%点・中央は50%点・上限は90%点で、
        幅は<strong className="text-foreground">この案件についてまだ分かっていないことの大きさ</strong>を表す。
        {model.numeric_error}。
      </p>
      <div className="w-0 min-w-full overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] text-muted-foreground">
              <th className="px-1.5 py-1 font-medium">型</th>
              <th className="px-1.5 py-1 font-medium">規制</th>
              <th className="px-1.5 py-1 font-medium">証拠水準</th>
              <th className="px-1.5 py-1 font-medium">次のゲート</th>
              <th className="px-1.5 py-1 text-right font-medium">量産到達</th>
              <th className="px-1.5 py-1 text-right font-medium">到達月数</th>
              <th className="px-1.5 py-1 text-right font-medium">v 下限</th>
              <th className="px-1.5 py-1 text-right font-medium">v 中央</th>
              <th className="px-1.5 py-1 text-right font-medium">v 上限</th>
              <th className="px-1.5 py-1 text-right font-medium">幅の倍率</th>
              <th className="px-1.5 py-1 text-right font-medium">資本自立</th>
              <th className="px-1.5 py-1 text-right font-medium">ライセンス</th>
              <th className="px-1.5 py-1 text-right font-medium">M&A</th>
              <th className="px-1.5 py-1 text-right font-medium">用途転換</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) =>
              model.grid
                .filter((r) => r.type === t)
                .map((r, i) => (
                  <tr key={`${r.type}-${r.reg}-${r.stage}`} className={`border-b border-border/40 ${i === 0 ? "border-t border-border" : ""}`}>
                    <td className="px-1.5 py-1 font-mono text-foreground">{r.type}</td>
                    <td className="px-1.5 py-1 font-mono text-muted-foreground">{r.reg.replace("REG", "REG-")}</td>
                    <td className="px-1.5 py-1 text-muted-foreground">段階{r.stage}</td>
                    <td className="px-1.5 py-1 font-mono text-[10px] text-muted-foreground">{r.gate}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{pc(r.pM4)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{r.m4mean ?? "—"}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{r.v10.toFixed(3)}</td>
                    <td className="px-1.5 py-1 text-right font-semibold tabular-nums text-foreground">{r.v50.toFixed(3)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{r.v90.toFixed(3)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">
                      {r.v10 > 0 ? `${(r.v90 / r.v10).toFixed(1)}倍` : "—"}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">
                      {pc((r.outcome.indep_in ?? 0) + (r.outcome.indep_out ?? 0))}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{pc(r.outcome.lic)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{pc(r.outcome.ma)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums text-muted-foreground">{pc(r.outcome.pivot)}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
        <div>
          型: {(Object.keys(PROCESS_TYPE_LABEL) as ProcessType[]).map((k) => PROCESS_TYPE_LABEL[k]).join(" ／ ")}
        </div>
        <div>
          規制: {(Object.keys(REG_CLASS_LABEL) as RegClass[]).map((k) => REG_CLASS_LABEL[k]).join(" ／ ")}
        </div>
        <div>
          9区分のうち撤退・清算・未決着は列を省いている。
          <strong className="text-foreground">SPS は産業創出価値を測るものであって、倒産の確率を測るものではない</strong>
          （まさ 2026-08-27、承認 #{model.approval_ref}）。自走が続かなくなった案件は、用途転換・出口クラスの転換・
          ライセンスへの畳み込み・研究への返却の四経路へ分かれる。
        </div>
      </div>
    </Foldable>
  );
}

// ───────────────────────────────── 式の一覧

function FormulaListBlock({ model }: { model: Bzm30Model }) {
  return (
    <Foldable title="モデルの式（正本から）" summary={`${model.formulas.length} 本`}>
      <div className="w-0 min-w-full overflow-x-auto rounded border border-border">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/60 text-left text-[10px] text-muted-foreground">
              <th className="w-[33%] px-2 py-1 font-medium">式</th>
              <th className="w-[22%] px-2 py-1 font-medium">何を決めている式か</th>
              <th className="w-[45%] px-2 py-1 font-medium">記号の意味 / 案件ごとの入力</th>
            </tr>
          </thead>
          <tbody>
            {model.formulas.map((f) => (
              <tr key={f.id} className="border-t border-border/40 align-top">
                <td className="px-2 py-1.5">
                  <div className="w-0 min-w-full overflow-x-auto [&_.katex-display]:my-0 [&_.katex-display]:text-left">
                    <Tex tex={f.tex} display />
                  </div>
                </td>
                <td className="px-2 py-1.5 leading-snug">
                  <div className="font-medium text-foreground">{f.title}</div>
                  <Link href={`/model#${f.anchor}`} className="font-mono text-[10px] text-indigo-600 underline hover:opacity-80">
                    正本 {f.section}
                  </Link>
                </td>
                <td className="px-2 py-1.5 leading-snug text-[10px] text-muted-foreground">
                  <div className="space-y-0.5">
                    {f.symbols.map((s, i) => (
                      <div key={i} className="flex gap-1">
                        <span className="shrink-0 whitespace-nowrap">
                          <BzmMathText source={s.symbol} />
                        </span>
                        <span className="shrink-0">=</span>
                        <span className="min-w-0 flex-1">
                          <BzmMathText source={s.meaning} />
                        </span>
                      </div>
                    ))}
                  </div>
                  {f.seedInputs ? (
                    <div className="mt-1 text-emerald-700 dark:text-emerald-300">
                      案件ごとの入力: {f.seedInputs.join(" / ")}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Foldable>
  );
}

// ───────────────────────────────── 係数の実値

function ParamListBlock({ model }: { model: Bzm30Model }) {
  const groups: { group: string; params: Bzm30Model["params"] }[] = [];
  for (const p of model.params) {
    const last = groups[groups.length - 1];
    if (last && last.group === p.group) last.params.push(p);
    else groups.push({ group: p.group, params: [p] });
  }

  return (
    <Foldable title="式に入る係数の実値と、その根拠" summary={`${model.params.length} 件`}>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        値はすべて参照実装（<code className="break-all rounded bg-muted px-1 font-mono text-[10px]">{model.reference_impl}</code>）から取っている。
        画面が書き起こした数字は無い。根拠レベルは
        <strong className="text-foreground"> A</strong> = 公開統計・実測から直接引ける、
        <strong className="text-foreground"> B</strong> = 制度・文献から水準が導出されている、
        <strong className="text-foreground"> C</strong> = 暫定の置き。
        <strong className="text-foreground">いまは大半が C</strong>（較正前）で、実績が積まれるほど動く。
      </p>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.group} className="w-0 min-w-full overflow-x-auto rounded border border-border">
            <div className="bg-muted/60 px-2 py-1 text-[11px] font-semibold text-foreground">
              {g.group}
              <span className="ml-1.5 font-normal text-muted-foreground">{g.params.length} 件</span>
            </div>
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {g.params.map((p) => (
                  <tr key={p.key} className="border-t border-border/40 align-top">
                    <td className="w-[13%] px-2 py-1.5 font-mono text-foreground">
                      {p.symbol ? <Tex tex={p.symbol} /> : "—"}
                    </td>
                    <td className="w-[22%] px-2 py-1.5 leading-snug text-foreground">{p.name}</td>
                    <td className="w-[27%] px-2 py-1.5 leading-snug font-medium text-foreground">{p.display}</td>
                    <td className="w-[8%] px-2 py-1.5">
                      <span
                        className="inline-block whitespace-nowrap rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        title={LEVEL_NOTE[p.level] ?? ""}
                      >
                        {p.level}
                      </span>
                    </td>
                    <td className="w-[30%] px-2 py-1.5 leading-snug text-[10px] text-muted-foreground">
                      {p.note}
                      <div className="mt-0.5 flex flex-wrap gap-x-2">
                        <span className="font-mono">正本 §{p.section}</span>
                        {p.usedIn.length > 0 ? (
                          <span>効く先: {p.usedIn.map((u) => USED_IN_LABEL[u] ?? u).join(" / ")}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Foldable>
  );
}

// ───────────────────────────────── 宣言している近似

function ApproximationBlock({ model }: { model: Bzm30Model }) {
  return (
    <Foldable title="計算が置いている近似と、数値の誤差" summary={`${model.approximations.length} 件`}>
      <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        {model.approximations.map((a, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-border">・</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 rounded border border-border bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {model.numeric_error}。計算法は格子上の数値計算で、乱数の試行は使っていない（同じ入力なら必ず同じ値が出る）。
      </p>
    </Foldable>
  );
}

// ───────────────────────────────── 折りたたみ

function Foldable({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="group min-w-0 rounded border border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-[13px] font-semibold text-foreground">{title}</span>
        <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="min-w-0 border-t border-border px-3 py-2.5">{children}</div>
    </details>
  );
}
