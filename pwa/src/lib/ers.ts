/**
 * ECR — Ecosystem Construction Rate (エコシステム構築率)
 * 旧称 ERS (Ecosystem Readiness Score) は 2026-07-11 廃止 (pwa/bzm/terminology_glossary.md §1.5)。
 * ファイル名・型名・関数名の ers/Ers は内部識別子として据え置き。
 *
 * 設計正本: pwa/design/institution_readiness.md
 *
 * 苗床/土壌レイヤー: 研究機関が「ベンチャーを生み育てる装置」としてどれだけ整備されているか。
 * AMD Score (個体レイヤー / Cobb-Douglas) とは別ロジック。欠損が掛け算で消えないよう
 * 加重和 (充足率) を採る。σ_SU 経由でのみ概念連動し、AMD Score 計算式には足し込まない。
 *
 * 集計:
 *   サブ軸正規化  s = (level - 1) / 4         → Lv1=0.00 .. Lv5=1.00
 *   軸スコア      A_k = mean(評価済みサブ軸 s)  (N/A・未評価は分母から除外、なければ null)
 *   ECR          100 · Σ_k w_k·A_k / Σ_k w_k   (評価済み軸のみで重み正規化、なければ null)
 */

export interface ErsInstitution {
  institutionId: string;
  name: string;
  shortName: string | null;
  type: string; // 'university' | 'research_institute' | 'other'
  description: string | null;
  region: string | null;
  contractStatus: string; // 'active' | 'prospect' | 'past'
  sortOrder: number;
}

export interface ErsAxis {
  axisId: string;
  axisNo: number;
  name: string;
  correspondsXrl: string | null;
  weight: number;
  sortOrder: number;
}

export interface ErsCriterion {
  criterionId: string;
  axisId: string;
  code: string;
  name: string;
  rubric: Record<string, string>; // {"1":..,"2":..,"3":..,"4":..,"5":..}
  sortOrder: number;
}

export interface ErsAssessment {
  criterionId: string;
  level: number | null; // 1..5
  na: boolean;
  note: string | null;
  evaluatedAt: string;
}

export interface ErsAxisScore {
  axisId: string;
  axisNo: number;
  name: string;
  correspondsXrl: string | null;
  weight: number;
  score: number | null; // 0..1, null = 未評価
  assessedCount: number; // 評価済みサブ軸数
  totalCount: number; // N/A を除く対象サブ軸数
}

export interface ErsResult {
  ers: number | null; // 0..100, null = 全く未評価
  axisScores: ErsAxisScore[];
  assessedCriteria: number;
  totalCriteria: number; // N/A 除く
}

/** Lv (1..5) を 0..1 に正規化。Lv1=0, Lv5=1。 */
export function normalizeLevel(level: number): number {
  return Math.max(0, Math.min(1, (level - 1) / 4));
}

export function computeErs(
  axes: ErsAxis[],
  criteria: ErsCriterion[],
  assessments: ErsAssessment[],
): ErsResult {
  const assessByCriterion = new Map<string, ErsAssessment>();
  for (const a of assessments) assessByCriterion.set(a.criterionId, a);

  const critByAxis = new Map<string, ErsCriterion[]>();
  for (const c of criteria) {
    const arr = critByAxis.get(c.axisId);
    if (arr) arr.push(c);
    else critByAxis.set(c.axisId, [c]);
  }

  let assessedCriteria = 0;
  let totalCriteria = 0;

  const axisScores: ErsAxisScore[] = [...axes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((axis) => {
      const crits = critByAxis.get(axis.axisId) ?? [];
      const scored: number[] = [];
      let counted = 0; // N/A 除く対象数
      for (const c of crits) {
        const a = assessByCriterion.get(c.criterionId);
        if (a && a.na) continue; // N/A は分母から除外
        counted += 1;
        if (a && a.level != null) scored.push(normalizeLevel(a.level));
      }
      assessedCriteria += scored.length;
      totalCriteria += counted;
      const score = scored.length
        ? scored.reduce((s, v) => s + v, 0) / scored.length
        : null;
      return {
        axisId: axis.axisId,
        axisNo: axis.axisNo,
        name: axis.name,
        correspondsXrl: axis.correspondsXrl,
        weight: axis.weight,
        score,
        assessedCount: scored.length,
        totalCount: counted,
      };
    });

  const scoredAxes = axisScores.filter((a) => a.score != null);
  const wSum = scoredAxes.reduce((s, a) => s + a.weight, 0);
  const ers =
    scoredAxes.length && wSum > 0
      ? (scoredAxes.reduce((s, a) => s + a.weight * (a.score as number), 0) / wSum) * 100
      : null;

  return { ers, axisScores, assessedCriteria, totalCriteria };
}

/** 0..1 のスコアを赤(0)→琥珀(0.5)→緑(1) の HSL 色に。null は未評価グレー。 */
export function ersScoreColor(score: number | null): string {
  if (score == null) return "#d4d4d8"; // zinc-300
  const hue = Math.round(score * 120); // 0=red .. 120=green
  return `hsl(${hue} 65% 45%)`;
}

export const INSTITUTION_TYPE_LABEL: Record<string, string> = {
  university: "大学",
  research_institute: "研究所",
  other: "その他",
};
