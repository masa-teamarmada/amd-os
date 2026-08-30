// BZM 3.0「入力を動かして見る」のデータ契約。サーバとクライアントの両方が読む。
//
// 読み取り層（`sensitivity.ts`）は `server-only` なので、画面から値を import できない。
// 画面とサーバで共有する型と、パラメータの並び順だけをここに置く。
// テーブルの定義は migration `pwa/scripts/migrations/353_seed_bzm30_sensitivity.sql`、
// 曲線を書く実装は `model/tools/bzm30_sensitivity.cjs`。

import type { ProcessType, RegClass } from "./seed-inputs";

/**
 * 振ったパラメータ。`seed_bzm30_sensitivity.param` の CHECK 制約と1対1で、
 * この並び順がそのまま画面のつまみの並び順になる（migration 353 / bzm30_sensitivity.cjs の PARAMS）。
 */
export const BZM30_SENSITIVITY_PARAMS = [
  "free_cash",
  "burn",
  "ceiling",
  "evidence_stage",
  "e",
  "c",
  "quiet_months",
  "kappa_ip",
  "sigma",
] as const;

export type Bzm30SensitivityParam = (typeof BZM30_SENSITIVITY_PARAMS)[number];

export interface Bzm30SensitivityPoint {
  /** 曲線の上での位置。小さいほうから大きいほうへ */
  point_index: number;
  /** いま置いてある入力そのものの点か */
  is_base: boolean;
  param_value: number;
  /** 画面に出す表示文字列。数字の整形を画面側で作り直さない */
  param_label: string;
  v_median: number;
  /** 天井が未調査の案件は null */
  score_lower_yen: number | null;
  score_median_yen: number | null;
  score_upper_yen: number | null;
  p_reach_m4: number | null;
  months_to_m4: number | null;
}

export interface Bzm30SensitivityCurve {
  param: Bzm30SensitivityParam;
  /** point_index の昇順 */
  points: Bzm30SensitivityPoint[];
  /** `is_base` の点の配列上の位置。曲線に基準点が無ければ null */
  baseIndex: number | null;
}

/** 一覧の1行。案件ごとの現在の評価と、曲線が計算済みかどうか。 */
export interface Bzm30SensitivitySeedRow {
  seed_id: string;
  project_id: string | null;
  name: string;
  score_lower_yen: number | null;
  score_median_yen: number | null;
  score_upper_yen: number | null;
  v_median: number | null;
  ceiling_total_yen: number | null;
  p_reach_m4: number | null;
  months_to_m4: number | null;
  process_type: ProcessType | null;
  reg_class: RegClass | null;
  evidence_stage: number | null;
  incorporated: boolean | null;
  free_cash_yen: number | null;
  burn_rate_yen_month: number | null;
  /** 資金の残り月数 = 自由資金の残高 ÷ バーンレート */
  runway_months: number | null;
  /**
   * 資金の残り月数 ÷ 残るゲートまでの月数。
   * 1前後の案件は残高が価値をそのまま決める（model/cases/SCORES.md「気をつけて読むところ 9. 資金の崖」）。
   */
  cash_gate_ratio: number | null;
  model_version: string | null;
  approval_ref: string | null;
  /** その案件の曲線が、いまの評価と同じ版で計算済みか。false は「計算中」 */
  curves_ready: boolean;
}

export interface Bzm30SensitivityOverview {
  rows: Bzm30SensitivitySeedRow[];
  /** 評価に使った実装の版。行ごとに違う版が混ざったときは null */
  model_version: string | null;
  approval_ref: string | null;
  ready_count: number;
}

export interface Bzm30SensitivityDetail {
  seed_id: string;
  model_version: string | null;
  approval_ref: string | null;
  curves: Bzm30SensitivityCurve[];
  /** パラメータごとの根拠（seed_bzm30_inputs の *_reason。天井だけは用途の表から組み立てる） */
  reasons: Partial<Record<Bzm30SensitivityParam, string>>;
}
