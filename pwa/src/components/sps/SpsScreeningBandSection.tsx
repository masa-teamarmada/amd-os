"use client";

/**
 * SPS帯 (産業創出価値, sps-ind-v1) の「スコア詳細」表示の唯一の正本。
 *
 * /seeds のシーズ詳細モーダルと、PJ コックピットの「スコア詳細」タブは、どちらもここを呼ぶ。
 * 同じ sps-ind-v1 の帯なのに表示コンポーネントが 2 系統あり、中身が食い違っていた
 * (まさ指摘 2026-08-21「コックピットでのスコア詳細タブの中身とシーズリストのスコア詳細のところが
 * 全然違うね…。これ統一してほしい」)。片方だけ育って片方が取り残される事故を構造的に止めるため、
 * 帯の説明・数式・根拠をここ以外に書かない。追加したい表示は必ずこのセクションの中へ入れる。
 *
 * 並びの意味:
 *  1. SpsFormulaPanel  … SPS の定義式と各パラメータの実値、クリックで算出過程 (LaTeX)
 *  2. 使い方の制限     … 帯は優先順位づけの下書きであって評価額ではない、という毎回出す注意
 *  3. SpsBandRationale … 総合判断 (band.notes) と q 帯の要因別根拠 (band.q_evidence)
 *
 * notes は SpsFormulaPanel が扱わないので、ここで必ず併置する (落とすと判断記録が画面から消える)。
 *
 * 🚫 cyber HUD デザインコード (黒背景 / ネオン発光 / SVG コーナーフレーム / 英大文字トラッキング見出し)
 *    は使わない。通常の OS 画面のトークンで書く。まさ確定 2026-08-21。
 */

import { SpsBandRationale } from "@/components/sps/SpsBandRationale";
import { SpsFormulaPanel } from "@/components/sps/SpsFormulaPanel";

import type { ProjectPlanValueCheck } from "@/types/project-plan-value";
import type { SeedScreeningBandDetail } from "@/types/seeds";

export function SpsScreeningBandSection({
  band,
  planCheck = null,
  heading = null,
  className = "",
}: {
  band: SeedScreeningBandDetail;
  /** 対応 PJ の月次試算表から作った年度別付加価値。渡すと P^ind の算出過程に検算ステップが増える。 */
  planCheck?: ProjectPlanValueCheck | null;
  /** 見出しを出す場合の文字列。呼び出し側に別のヘッダがあるなら null のまま。 */
  heading?: string | null;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} data-testid="sps-screening-band-section">
      {heading ? (
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{heading}</h3>
      ) : null}
      <SpsFormulaPanel band={band} planCheck={planCheck} />
      <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
        この帯は接触と調査の優先順位づけの下書き。上限は楽観シナリオの包絡であり評価額ではない。投資判断・対外表示には使わない。
      </p>
      <SpsBandRationale notes={band.notes} qEvidence={band.q_evidence} />
    </div>
  );
}
