/**
 * BZM 3.0 の係数表と、型 × 規制属性 × 証拠水準ごとの計算結果。
 *
 * 中身は `model/tools/bzm30_export.cjs` が書き出した JSON。値の出どころは参照実装
 * `model/tools/bzm30_forward.cjs` の CFG 一本で、画面はここを読むだけ（書き起こさない）。
 * 前向き計算は1件あたり数分かかるので、リクエストの中では走らせず、この表を引く。
 */

import raw from "./tier0.json";
import type { ProcessType, RegClass } from "./seed-inputs";

/** 較正の根拠の強さ（モデルページ §6.I-1-2）。 */
export type EvidenceLevel = "A" | "B" | "C" | "規約" | "確定";

export interface Bzm30Param {
  /** 画面での折りたたみの単位 */
  group: string;
  key: string;
  symbol: string | null;
  name: string;
  /** 値（単位つきの表示形） */
  display: string;
  level: EvidenceLevel | string;
  /** 正本の節番号 */
  section: string;
  note: string;
  /** どの式に入るか */
  usedIn: string[];
}

/** 9区分（モデルページ §5.8）の確率。 */
export interface Bzm30Outcome {
  /** 期限（60か月）内の資本自立 */
  indep_in: number;
  /** 期限後の資本自立 */
  indep_out: number;
  /** うち量産契約の到達によるもの */
  indep_m4: number;
  /** うち反復収入（受託・サービス）によるもの */
  indep_rev: number;
  lic: number;
  ma: number;
  ips: number;
  pivot: number;
  exit: number;
  liq: number;
  cont: number;
}

export interface Bzm30GridRow {
  type: ProcessType;
  reg: RegClass;
  /** 評価日の証拠水準（0〜6） */
  stage: number;
  /** その段階から次に越えるゲート */
  gate: string;
  nGates: number;
  /** 天井を1に正規化した現在価値。10%点・中央・90%点と、期待値 */
  v10: number;
  v50: number;
  v90: number;
  v: number;
  /** 評価期間内に量産契約へ届く確率 */
  pM4: number;
  /** 届いたシナリオに条件づけた到達月数の平均 */
  m4mean: number | null;
  /** 価値のうち評価期間の先（継続価値）が占める比率 */
  cRatio: number | null;
  outcome: Bzm30Outcome;
}

export interface Bzm30StageDef {
  stage: number;
  label: string;
  note: string;
}

export interface Bzm30Tier0 {
  model_version: string;
  approval_ref: string;
  canon: string;
  reference_impl: string;
  note: string;
  approximations: string[];
  numeric_error: string;
  stages: Bzm30StageDef[];
  params: Bzm30Param[];
  grid: Bzm30GridRow[];
}

export const BZM30_TIER0 = raw as unknown as Bzm30Tier0;

/** 型 × 規制 × 証拠水準の1行を引く。無ければ null。 */
export function gridRow(type: ProcessType, reg: RegClass, stage: number): Bzm30GridRow | null {
  return (
    BZM30_TIER0.grid.find((r) => r.type === type && r.reg === reg && r.stage === stage) ??
    null
  );
}

/** 係数をグループごとにまとめる（画面の折りたたみの単位）。 */
export function paramsByGroup(): { group: string; params: Bzm30Param[] }[] {
  const map = new Map<string, Bzm30Param[]>();
  for (const p of BZM30_TIER0.params) {
    const list = map.get(p.group);
    if (list) list.push(p);
    else map.set(p.group, [p]);
  }
  return Array.from(map.entries()).map(([group, params]) => ({ group, params }));
}
