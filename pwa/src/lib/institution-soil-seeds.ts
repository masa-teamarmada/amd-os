/**
 * 「土壌×シーズ」タブ (研究機関 ECR × 所属シーズ SPS の観測時点断面) 用の純粋関数群。
 * Supabase import なし・副作用なし。データ取得は institution-soil-seeds-data.ts が担当する。
 *
 * 設計上の絶対制約 (terminology_glossary.md §4 / BZM_2_0_REVISION_REQUIREMENTS.md §3-5):
 *   ECR (機関の生態系構築度) と SPS (シーズの事業化見込み) は同じ機関に属していても
 *   足し合わせて単一スコアにしない。本ファイルは両者を並べて観測するための統計・整列のみを提供し、
 *   相関/因果/予測を主張する値は一切計算しない。n が小さいこと、同一機関内の反復、交絡、
 *   ECR level と SPS 構成軸に順序尺度を含むことを踏まえ、相関係数や回帰係数は算出しない。
 */

export interface SpsDistributionStats {
  n: number;
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
}

/**
 * 分位点は線形補間法 (R-7 / Excel PERCENTILE.INC 相当) で計算する。
 * 位置 = (n-1) * p, p in [0,1]。他の分位点定義 (R-6 等) より単純で
 * 説明しやすいためこれを採用 (このコードベースに他の前例が無いため明記)。
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  const frac = pos - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * frac;
}

/** SPS スコア配列 (null は除外済みの前提) から n/min/Q1/中央値/Q3/max を計算する。空配列は全て null (n=0)。 */
export function computeSpsDistributionStats(scores: (number | null)[]): SpsDistributionStats {
  const values = scores.filter((v): v is number => v !== null).slice().sort((a, b) => a - b);
  if (values.length === 0) {
    return { n: 0, min: null, q1: null, median: null, q3: null, max: null };
  }
  return {
    n: values.length,
    min: values[0],
    q1: percentile(values, 0.25),
    median: percentile(values, 0.5),
    q3: percentile(values, 0.75),
    max: values[values.length - 1],
  };
}

export interface RankableSeedSps {
  seedId: string;
  score: number | null;
}

export interface SeedSpsRank {
  seedId: string;
  score: number | null;
  /** score が null (SPS 未評価) の場合は null。同点は同順位 (competition ranking, 1224 方式)。 */
  rank: number | null;
}

/** シーズを最新 SPS スコア降順でランク付けする。SPS 未評価 (null) は末尾かつ rank=null。 */
export function rankSeedsBySps(seeds: RankableSeedSps[]): SeedSpsRank[] {
  const scored = seeds.filter((s) => s.score !== null) as { seedId: string; score: number }[];
  const unscored = seeds.filter((s) => s.score === null);

  const sorted = scored.slice().sort((a, b) => b.score - a.score);
  const ranked: SeedSpsRank[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((s, i) => {
    if (s.score !== lastScore) {
      lastRank = i + 1;
      lastScore = s.score;
    }
    ranked.push({ seedId: s.seedId, score: s.score, rank: lastRank });
  });

  unscored.forEach((s) => ranked.push({ seedId: s.seedId, score: null, rank: null }));
  return ranked;
}

export interface EcrSnapshotRef {
  evaluatedAt: string; // ISO date (yyyy-mm-dd)
  evaluationVersion: string;
}

export interface SeedSpsSnapshotRef {
  seedId: string;
  evaluatedAt: string; // ISO date
}

export interface CrossSectionAlignment<T extends { evaluatedAt: string }> {
  asOfDate: string;
  /** asOfDate 以前で最新の1件。無ければ null (捏造しない)。 */
  selected: T | null;
}

/**
 * asOfDate 以前で最新の1件を選ぶ。ECR/SPS 共通のロジックだが、呼び出し側は必ず別々に呼び、
 * 結果を合成しない (ECR側とSPS側、それぞれ独立した CrossSectionAlignment を返すだけ)。
 */
export function selectLatestAsOf<T extends { evaluatedAt: string }>(
  snapshots: T[],
  asOfDate: string
): CrossSectionAlignment<T> {
  const eligible = snapshots.filter((s) => s.evaluatedAt <= asOfDate);
  if (eligible.length === 0) return { asOfDate, selected: null };
  const latest = eligible.reduce((acc, cur) => (cur.evaluatedAt > acc.evaluatedAt ? cur : acc));
  return { asOfDate, selected: latest };
}

/**
 * as-of 日以前の履歴から、キーごとに最新の1件を選ぶ。
 * ECR の criterion 単位 carry-forward に使う。観測日と元評価日は呼び出し側で別表示する。
 */
export function selectLatestPerKeyAsOf<T extends { evaluatedAt: string }>(
  snapshots: T[],
  asOfDate: string,
  keyOf: (snapshot: T) => string
): T[] {
  const latest = new Map<string, T>();
  for (const snapshot of snapshots) {
    if (snapshot.evaluatedAt > asOfDate) continue;
    const key = keyOf(snapshot);
    const current = latest.get(key);
    if (!current || snapshot.evaluatedAt > current.evaluatedAt) latest.set(key, snapshot);
  }
  return Array.from(latest.values());
}

/**
 * ECR と SPS の実観測日を union して新しい順に返す。
 * 今日の日付など、データに存在しない擬似断面は生成しない。
 */
export function collectObservationDates(
  ecrDates: string[],
  spsDates: string[]
): string[] {
  return Array.from(new Set([...ecrDates, ...spsDates].filter(Boolean))).sort((a, b) => b.localeCompare(a));
}

/** 複数の元評価日を、単日または最古〜最新の範囲として表示する。 */
export function formatSourceDateRange(dates: string[]): string {
  const sorted = Array.from(new Set(dates.filter(Boolean))).sort();
  if (sorted.length === 0) return "—";
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]}〜${sorted[sorted.length - 1]}`;
}

/**
 * 機関の ECR 断面と、所属シーズ群の SPS 断面を「同じ as-of 日付」で並べて返す。
 * これは「同日に測った」という意味ではない。返り値は両系列の元評価日を保持したまま
 * ECR と SPS を別フィールドに分け、単一値へは絶対に合成しない。
 */
export interface SoilSeedsCrossSection<
  E extends { evaluatedAt: string },
  S extends { evaluatedAt: string; seedId: string }
> {
  asOfDate: string;
  ecr: CrossSectionAlignment<E>;
  seedSps: Map<string, CrossSectionAlignment<S>>;
}

export function alignSoilSeedsCrossSection<
  E extends { evaluatedAt: string },
  S extends { evaluatedAt: string; seedId: string }
>(ecrSnapshots: E[], seedSpsBySeed: Map<string, S[]>, asOfDate: string): SoilSeedsCrossSection<E, S> {
  const ecr = selectLatestAsOf(ecrSnapshots, asOfDate);
  const seedSps = new Map<string, CrossSectionAlignment<S>>();
  for (const [seedId, snapshots] of seedSpsBySeed.entries()) {
    seedSps.set(seedId, selectLatestAsOf(snapshots, asOfDate));
  }
  return { asOfDate, ecr, seedSps };
}
