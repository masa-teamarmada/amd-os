"use client";

/**
 * 入力を動かして見る — BZM 3.0 の産業創出価値の感応。
 *
 * まさ 2026-08-30「全案件のスコアが表形式で並んでて、右側の列にずらーっと各パラメータが並んでて、
 * それらのパラメータを変えたときにSPSが変わる様子がUI上で見れるといいかもって思った。」
 *
 * 【この画面が守ること】
 * 1. **前向き計算をここで走らせない。** 1件10秒〜数分かかる（model/README.md (g)）。
 *    `model/tools/bzm30_sensitivity.cjs` が先に計算した曲線（seed_bzm30_sensitivity）の上を滑るだけ。
 * 2. **数字の整形を画面側で作り直さない。** つまみの目盛りの表示は DB の param_label をそのまま出す。
 * 3. **近似であることを隠さない。** 曲線は入力を1本ずつ振ったもの。2つ以上を同時に動かした結果は
 *    それぞれの倍率を掛け合わせた近似で、厳密な計算ではない。画面にそう書く。
 * 4. **空欄を作らない。** 天井が未調査なら「天井が未調査」、曲線がまだ無ければ「計算中」と出す。
 *
 * 🚫 cyber HUD デザインコード（黒背景 / ネオン発光）は使わない。シーズリストの見た目に揃える。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Undo2 } from "lucide-react";
import {
  loadBzm30SensitivityDetail,
  loadBzm30SensitivityOverview,
  peekBzm30SensitivityDetail,
  peekBzm30SensitivityOverview,
  prefetchBzm30SensitivityDetail,
} from "@/lib/bzm30-sensitivity-client";
import type {
  Bzm30SensitivityCurve,
  Bzm30SensitivityDetail,
  Bzm30SensitivityOverview,
  Bzm30SensitivityParam,
  Bzm30SensitivityPoint,
  Bzm30SensitivitySeedRow,
} from "@/lib/bzm30/sensitivity-types";
import { BZM30_SENSITIVITY_PARAMS } from "@/lib/bzm30/sensitivity-types";
import { STAGE_LABEL, PROCESS_TYPE_LABEL, REG_CLASS_LABEL } from "@/lib/bzm30/seed-inputs";

/** AMD の基調色。この画面だけの独自色を作らない。 */
const AMD_BLUE = "#027FDC";

/**
 * つまみ1本ぶんの説明。振る値そのものと目盛りの表示は DB 側（model/tools/bzm30_sensitivity.cjs の
 * PARAMS）が持つ。ここに置くのは画面に出す呼び名と一言の説明だけ。
 */
const PARAM_META: Record<Bzm30SensitivityParam, { label: string; hint: string }> = {
  free_cash: {
    label: "自由資金の残高",
    hint: "使い道の縛りが無い手元資金。前進の速度と、申し出が来るまで生きていられる長さに効く",
  },
  burn: {
    label: "バーンレート（月）",
    hint: "毎月出ていく金額。残高をこれで割ると資金の残り月数になる",
  },
  ceiling: {
    label: "用途の天井（年額の純増）",
    hint: "国内で年あたりに生む付加価値の上限。金額に直接掛かるうえ、経済性を通して到達確率にも効く",
  },
  evidence_stage: {
    label: "評価日の証拠水準",
    hint: "どこまで実証が進んでいるか。段階が上がるほど、量産までに残るゲートが減る",
  },
  e: {
    label: "担い手（機能1 エバンジェリスト）",
    hint: "事業を前へ運ぶ人がどれだけ埋まっているか。0〜1",
  },
  c: {
    label: "変換能力",
    hint: "かけた費用がどれだけ戦略余力へ変わるか。分野の基準 1.0 に対する倍率",
  },
  quiet_months: {
    label: "無風期間",
    hint: "ポジティブな公開の動きが出ていない月数。長いほどライセンス・M&A の引き合いが来にくくなる",
  },
  kappa_ip: { label: "専有可能性", hint: "権利でどれだけ囲えるか。0〜1" },
  sigma: { label: "産官学モメンタム", hint: "追い風・中立・向かい風の3段" },
};

// ───────────────────────────────────────────────────────────── 表示の整形

/**
 * 1億円未満は万円で出す。億へ丸めると、天井を絞ったあとの小さい額がすべて「0億」に潰れて
 * 案件どうしの差が読めなくなる（model/tools/bzm30_scores_md.cjs と同じ規則）。
 */
function yenLabel(yen: number | null | undefined): string {
  if (yen === null || yen === undefined || !Number.isFinite(yen)) return "—";
  if (Math.abs(yen) >= 1e8) return `${(yen / 1e8).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}億`;
  return `${Math.round(yen / 1e4).toLocaleString("ja-JP")}万`;
}

const pctLabel = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : `${(100 * x).toFixed(1)}%`;

const monthLabel = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : `${x.toFixed(1)}か月`;

const ratioLabel = (x: number | null | undefined) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(2);

function laneLabel(row: Bzm30SensitivitySeedRow): string {
  if (!row.process_type || !row.reg_class) return "未判定";
  return `${row.process_type}×${row.reg_class.replace("REG", "REG-")}`;
}

function stageLabel(row: Bzm30SensitivitySeedRow): string {
  const stage = row.evidence_stage === null ? "未入力" : `段階${row.evidence_stage}`;
  return `${stage}${row.incorporated ? "・会社化済み" : ""}`;
}

// ───────────────────────────────────────────────────────────── 曲線の上を滑る

interface CurveValue {
  param_value: number;
  label: string;
  /** 目盛りの上に乗っているか。乗っていれば計算した点そのもの */
  onTick: boolean;
  score_lower_yen: number | null;
  score_median_yen: number | null;
  score_upper_yen: number | null;
  p_reach_m4: number | null;
  months_to_m4: number | null;
}

const lerp = (a: number | null, b: number | null, f: number): number | null =>
  a === null || b === null ? null : a + (b - a) * f;

function pointValue(p: Bzm30SensitivityPoint): CurveValue {
  return {
    param_value: p.param_value,
    label: p.param_label,
    onTick: true,
    score_lower_yen: p.score_lower_yen,
    score_median_yen: p.score_median_yen,
    score_upper_yen: p.score_upper_yen,
    p_reach_m4: p.p_reach_m4,
    months_to_m4: p.months_to_m4,
  };
}

/** 目盛り `t`（点の並びの上の位置。小数可）での値。点と点のあいだは線形補間する。 */
function valueAt(curve: Bzm30SensitivityCurve, t: number): CurveValue {
  const points = curve.points;
  const last = points.length - 1;
  const clamped = Math.min(Math.max(t, 0), last);
  const i = Math.floor(clamped);
  const f = clamped - i;
  if (f < 1e-6) return pointValue(points[i]);
  if (i >= last) return pointValue(points[last]);
  const a = points[i];
  const b = points[i + 1];
  return {
    param_value: a.param_value + (b.param_value - a.param_value) * f,
    // 補間した点の表示は、計算した2点のあいだであることをそのまま出す。
    // 数字の整形を画面側で作り直さない（param_label は DB のものだけを使う）。
    label: `${a.param_label} 〜 ${b.param_label} のあいだ`,
    onTick: false,
    score_lower_yen: lerp(a.score_lower_yen, b.score_lower_yen, f),
    score_median_yen: lerp(a.score_median_yen, b.score_median_yen, f),
    score_upper_yen: lerp(a.score_upper_yen, b.score_upper_yen, f),
    p_reach_m4: lerp(a.p_reach_m4, b.p_reach_m4, f),
    months_to_m4: lerp(a.months_to_m4, b.months_to_m4, f),
  };
}

type Metric = "score_lower_yen" | "score_median_yen" | "score_upper_yen" | "p_reach_m4" | "months_to_m4";

export interface AppliedResult {
  moved: Bzm30SensitivityParam[];
  /** 2つ以上動かしているか。1つだけなら計算した値そのもので、近似ではない */
  approximate: boolean;
  score_lower_yen: number | null;
  score_median_yen: number | null;
  score_upper_yen: number | null;
  p_reach_m4: number | null;
  months_to_m4: number | null;
  free_cash_yen: number | null;
  burn_rate_yen_month: number | null;
  runway_months: number | null;
  cash_gate_ratio: number | null;
}

/**
 * つまみの位置から、その案件の結果を出す。
 *
 * **1本だけ動かしているあいだは計算した値そのもの。** 2本以上動かしたときは、
 * それぞれの倍率（その点の値 ÷ いまの入力の点の値）を掛け合わせた近似で、厳密な計算ではない。
 * 曲線は1本ずつ振ったものしか無いので、同時に動かした組み合わせは計算されていない。
 */
export function applyPositions(
  row: Bzm30SensitivitySeedRow,
  curves: Bzm30SensitivityCurve[],
  positions: Partial<Record<Bzm30SensitivityParam, number>>,
): AppliedResult {
  const moved: Bzm30SensitivityParam[] = [];
  const factors: Record<Metric, number | null> = {
    score_lower_yen: 1,
    score_median_yen: 1,
    score_upper_yen: 1,
    p_reach_m4: 1,
    months_to_m4: 1,
  };
  let freeCash = row.free_cash_yen;
  let burn = row.burn_rate_yen_month;

  for (const curve of curves) {
    const base = curve.baseIndex;
    const t = positions[curve.param];
    if (base === null || t === undefined || Math.abs(t - base) < 1e-6) continue;
    moved.push(curve.param);

    const here = valueAt(curve, t);
    const there = pointValue(curve.points[base]);
    if (curve.param === "free_cash") freeCash = here.param_value;
    if (curve.param === "burn") burn = here.param_value;

    for (const metric of Object.keys(factors) as Metric[]) {
      const denom = there[metric];
      const numer = here[metric];
      if (factors[metric] === null) continue;
      if (denom === null || numer === null || denom === 0) {
        factors[metric] = null; // 基準が0か未調査だと倍率を作れない。近似しない
        continue;
      }
      factors[metric] = (factors[metric] as number) * (numer / denom);
    }
  }

  const applied = (metric: Metric): number | null => {
    const anchor = row[metric];
    const factor = factors[metric];
    if (anchor === null || factor === null) return moved.length === 0 ? anchor : null;
    return anchor * factor;
  };

  const pReach = applied("p_reach_m4");
  const months = applied("months_to_m4");
  const runway = freeCash !== null && burn !== null && burn > 0 ? freeCash / burn : null;

  return {
    moved,
    approximate: moved.length >= 2,
    score_lower_yen: applied("score_lower_yen"),
    score_median_yen: applied("score_median_yen"),
    score_upper_yen: applied("score_upper_yen"),
    p_reach_m4: pReach === null ? null : Math.min(1, Math.max(0, pReach)),
    months_to_m4: months,
    free_cash_yen: freeCash,
    burn_rate_yen_month: burn,
    runway_months: runway,
    cash_gate_ratio: runway !== null && months !== null && months > 0 ? runway / months : null,
  };
}

/** 中央値の降順の順位。金額が出ない案件（天井が未調査）は順位を持たない。 */
export function ranksByMedian(entries: { seed_id: string; median: number | null }[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => (b.median ?? -1) - (a.median ?? -1));
  const out = new Map<string, number>();
  let rank = 0;
  for (const e of sorted) {
    if (e.median === null) continue;
    rank += 1;
    out.set(e.seed_id, rank);
  }
  return out;
}

// ───────────────────────────────────────────────────────────── 画面

export function Bzm30SensitivityBoard() {
  const [overview, setOverview] = useState<Bzm30SensitivityOverview | undefined>(() =>
    peekBzm30SensitivityOverview(),
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [loadedDetail, setLoadedDetail] = useState<Bzm30SensitivityDetail | null>(null);
  const [failedSeedIds, setFailedSeedIds] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * つまみを動かした結果だけを持つ。動かしていないパラメータの位置は曲線の基準点から導く。
   * 位置そのものを state に写すと、案件を選び直すたびに effect の中で state を書き直す形になる。
   */
  const [moves, setMoves] = useState<{
    seedId: string | null;
    values: Partial<Record<Bzm30SensitivityParam, number>>;
  }>({ seedId: null, values: {} });

  useEffect(() => {
    let cancelled = false;
    loadBzm30SensitivityOverview()
      .then((value) => {
        if (cancelled) return;
        setOverview(value);
        setSelectedSeedId((current) => current ?? value.rows.find((r) => r.curves_ready)?.seed_id ?? null);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "曲線を読み込めなかった");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const seedId = selectedSeedId;
    if (!seedId || peekBzm30SensitivityDetail(seedId)) return;
    let cancelled = false;
    loadBzm30SensitivityDetail(seedId)
      .then((value) => {
        if (!cancelled) setLoadedDetail(value);
      })
      .catch(() => {
        // 曲線が無いだけなら「計算中」と出す。一覧は落とさない。
        if (!cancelled) setFailedSeedIds((prev) => new Set(prev).add(seedId));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeedId]);

  const rows = useMemo(() => overview?.rows ?? [], [overview]);

  const detail = useMemo(() => {
    if (!selectedSeedId) return null;
    if (loadedDetail?.seed_id === selectedSeedId) return loadedDetail;
    return peekBzm30SensitivityDetail(selectedSeedId) ?? null;
  }, [selectedSeedId, loadedDetail]);

  const detailPending = Boolean(selectedSeedId) && !detail && !failedSeedIds.has(selectedSeedId ?? "");

  const selectedRow = useMemo(
    () => rows.find((r) => r.seed_id === selectedSeedId) ?? null,
    [rows, selectedSeedId],
  );

  const curves = useMemo(() => detail?.curves ?? [], [detail]);

  const positions = useMemo(() => {
    const base = detail ? basePositions(detail) : {};
    return moves.seedId === selectedSeedId ? { ...base, ...moves.values } : base;
  }, [detail, moves, selectedSeedId]);

  const applied = useMemo(
    () => (selectedRow ? applyPositions(selectedRow, curves, positions) : null),
    [selectedRow, curves, positions],
  );

  const baseRanks = useMemo(
    () => ranksByMedian(rows.map((r) => ({ seed_id: r.seed_id, median: r.score_median_yen }))),
    [rows],
  );

  const liveRanks = useMemo(
    () =>
      ranksByMedian(
        rows.map((r) => ({
          seed_id: r.seed_id,
          median:
            applied && r.seed_id === selectedSeedId && applied.moved.length > 0
              ? applied.score_median_yen
              : r.score_median_yen,
        })),
      ),
    [rows, applied, selectedSeedId],
  );

  const moveParam = useCallback(
    (param: Bzm30SensitivityParam, t: number) => {
      setMoves((prev) =>
        prev.seedId === selectedSeedId
          ? { seedId: selectedSeedId, values: { ...prev.values, [param]: t } }
          : { seedId: selectedSeedId, values: { [param]: t } },
      );
    },
    [selectedSeedId],
  );

  const resetParam = useCallback((param: Bzm30SensitivityParam) => {
    setMoves((prev) => {
      const values = { ...prev.values };
      delete values[param];
      return { seedId: prev.seedId, values };
    });
  }, []);

  const resetAll = useCallback(() => setMoves({ seedId: selectedSeedId, values: {} }), [selectedSeedId]);

  const movedCount = applied?.moved.length ?? 0;

  if (error) {
    return (
      <div className="border border-amber-200 bg-amber-50 px-4 py-4 text-[13px] text-amber-900">
        曲線を読み込めなかった。{error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader overview={overview} />

      {/* 上段: 全案件の一覧 */}
      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-bold text-slate-950">全案件の産業創出価値</h2>
          <p className="text-[11px] text-slate-500">
            行をクリックすると、下の操作盤がその案件に切り替わる。つまみを動かすと、その案件の金額と全体の順位がその場で動く。
          </p>
        </div>
        {overview === undefined ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-auto border border-slate-200">
            <table className="w-full min-w-[1320px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 text-left text-[10px] font-semibold text-slate-500">
                  <th className="w-[78px] border-b border-slate-200 px-2 py-2">順位</th>
                  <th className="w-[54px] border-b border-slate-200 px-2 py-2">PJ</th>
                  <th className="min-w-[176px] border-b border-slate-200 px-2 py-2">案件</th>
                  <th className="w-[66px] border-b border-slate-200 px-2 py-2 text-right">下限</th>
                  <th className="w-[132px] border-b border-slate-200 px-2 py-2 text-right">中央</th>
                  <th className="w-[66px] border-b border-slate-200 px-2 py-2 text-right">上限</th>
                  <th className="w-[96px] border-b border-slate-200 px-2 py-2 text-right" title="国内で年あたりに生む付加価値の上限（純増）">
                    天井（年額の純増）
                  </th>
                  <th className="w-[82px] border-b border-slate-200 px-2 py-2 text-right" title="天井1円あたりの現在価値。天井の大きさを外して案件の筋の良さを比べる">
                    天井1円あたり
                  </th>
                  <th className="w-[84px] border-b border-slate-200 px-2 py-2">型×規制</th>
                  <th className="w-[116px] border-b border-slate-200 px-2 py-2">現在地</th>
                  <th className="w-[74px] border-b border-slate-200 px-2 py-2 text-right" title="自力で量産採用まで届く確率。0の案件は価値がライセンス・M&A・知財売却の裾から立っている">
                    自力の量産到達率
                  </th>
                  <th className="w-[80px] border-b border-slate-200 px-2 py-2 text-right" title="いまの現在地から量産採用までにかかる平均の月数">
                    残るゲートまで
                  </th>
                  <th className="w-[104px] border-b border-slate-200 px-2 py-2 text-right" title="資金の残り月数 ÷ 残るゲートまでの月数。1前後の案件は残高が価値をそのまま決める">
                    資金の残り ÷ ゲートまで
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <OverviewRow
                    key={row.seed_id}
                    row={row}
                    selected={row.seed_id === selectedSeedId}
                    applied={row.seed_id === selectedSeedId ? applied : null}
                    baseRank={baseRanks.get(row.seed_id) ?? null}
                    liveRank={liveRanks.get(row.seed_id) ?? null}
                    onSelect={() => setSelectedSeedId(row.seed_id)}
                    onPrefetch={() => prefetchBzm30SensitivityDetail(row.seed_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          「資金の残り ÷ ゲートまで」が 1.5 以下の案件は、残高が価値をそのまま決める。ここに乗っている案件の残高は、推定ではなく会社の資料で取る必要がある。
          自力の量産到達率が 0 の案件は、価値がライセンス・M&amp;A・知財売却の裾から立っているので、この比は出ない。
        </p>
      </section>

      {/* 下段: 選んだ案件のつまみ */}
      <ParameterPanel
        row={selectedRow}
        detail={detail}
        loading={detailPending}
        positions={positions}
        applied={applied}
        movedCount={movedCount}
        baseRank={selectedRow ? baseRanks.get(selectedRow.seed_id) ?? null : null}
        liveRank={selectedRow ? liveRanks.get(selectedRow.seed_id) ?? null : null}
        onChange={moveParam}
        onResetParam={resetParam}
        onResetAll={resetAll}
      />
    </div>
  );
}

function basePositions(detail: Bzm30SensitivityDetail): Partial<Record<Bzm30SensitivityParam, number>> {
  const out: Partial<Record<Bzm30SensitivityParam, number>> = {};
  for (const curve of detail.curves) {
    if (curve.baseIndex !== null) out[curve.param] = curve.baseIndex;
  }
  return out;
}

// ───────────────────────────────────────────────────────────── 見出し

function PageHeader({ overview }: { overview: Bzm30SensitivityOverview | undefined }) {
  const total = overview?.rows.length ?? null;
  const ready = overview?.ready_count ?? null;
  return (
    <header>
      <h1 className="text-lg font-bold text-slate-950">入力を動かして見る</h1>
      <p className="mt-1 max-w-5xl text-sm leading-relaxed text-slate-600">
        BZM 3.0 の入力を1つずつ振ったときに、産業創出価値がどう動くかを先に計算して置いてある。
        下の操作盤でつまみを動かすと、上の表のその案件の金額と、全案件の順位がその場で変わる。
      </p>
      <div className="mt-2 border-l-2 border-amber-400 bg-amber-50/70 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
        <span className="font-semibold">この画面の値は、1本ずつ振った曲線の上を滑らせたもの。</span>
        つまみを1本だけ動かしているあいだは、計算した値そのもの。
        <span className="font-semibold">2本以上を同時に動かした結果は、それぞれの倍率を掛け合わせた近似で、厳密な計算ではない。</span>
        入力を組み合わせて動かしたときの正確な値は、計算をやり直さないと出ない。
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        {overview ? (
          <>
            計算に使った実装: {overview.model_version ?? "案件ごとに異なる"}
            {overview.approval_ref ? `・承認 ${overview.approval_ref}` : ""}
            {total !== null && ready !== null ? `・全${total}件のうち曲線が計算済み ${ready}件` : ""}
          </>
        ) : (
          "計算に使った実装を読み込み中"
        )}
      </p>
    </header>
  );
}

function TableSkeleton() {
  return (
    <div className="border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-500">
        順位・PJ・案件・下限・中央・上限・天井・天井1円あたり・型×規制・現在地・自力の量産到達率・残るゲートまで・資金の残り ÷ ゲートまで
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <span className="h-3 w-full animate-pulse bg-slate-100" />
        </div>
      ))}
      <div className="flex items-center justify-center gap-2 px-3 py-3 text-[12px] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        読み込み中
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── 一覧の行

function OverviewRow({
  row,
  selected,
  applied,
  baseRank,
  liveRank,
  onSelect,
  onPrefetch,
}: {
  row: Bzm30SensitivitySeedRow;
  selected: boolean;
  applied: AppliedResult | null;
  baseRank: number | null;
  liveRank: number | null;
  onSelect: () => void;
  onPrefetch: () => void;
}) {
  const moved = (applied?.moved.length ?? 0) > 0;
  const rankChanged = baseRank !== null && liveRank !== null && baseRank !== liveRank;
  const delta = rankChanged ? baseRank - (liveRank as number) : 0;

  const median = moved ? applied?.score_median_yen ?? null : row.score_median_yen;
  const lower = moved ? applied?.score_lower_yen ?? null : row.score_lower_yen;
  const upper = moved ? applied?.score_upper_yen ?? null : row.score_upper_yen;
  const pReach = moved ? applied?.p_reach_m4 ?? null : row.p_reach_m4;
  const months = moved ? applied?.months_to_m4 ?? null : row.months_to_m4;
  const ratio = moved ? applied?.cash_gate_ratio ?? null : row.cash_gate_ratio;

  const ceilingUnknown = row.ceiling_total_yen === null;

  return (
    <tr
      onClick={onSelect}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer border-b border-slate-100 align-middle focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
        selected ? "bg-sky-50/80" : "hover:bg-slate-50"
      }`}
      style={selected ? { boxShadow: `inset 3px 0 0 0 ${AMD_BLUE}` } : undefined}
    >
      <td className="px-2 py-1.5 tabular-nums">
        {liveRank === null ? (
          <span className="text-slate-400">—</span>
        ) : rankChanged ? (
          <span className="font-semibold" style={{ color: AMD_BLUE }}>
            {baseRank} → {liveRank}
            <span className={`ml-1 text-[10px] ${delta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {delta > 0 ? `＋${delta}` : delta}
            </span>
          </span>
        ) : (
          <span className="font-semibold text-slate-700">{liveRank}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-slate-600">{row.project_id ?? "—"}</td>
      <td className="max-w-[240px] truncate px-2 py-1.5 font-medium text-slate-900" title={row.name}>
        {row.name}
        {!row.curves_ready && (
          <span className="ml-1.5 whitespace-nowrap border border-slate-300 bg-white px-1 py-px text-[9px] font-semibold text-slate-500" title="曲線をまだ計算していない。計算が終わるとつまみが出る">
            計算中
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
        {ceilingUnknown ? "—" : yenLabel(lower)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {ceilingUnknown ? (
          <span className="text-[11px] text-amber-700">天井が未調査</span>
        ) : moved ? (
          <span className="whitespace-nowrap">
            <span className="text-slate-400 line-through">{yenLabel(row.score_median_yen)}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className="font-bold" style={{ color: AMD_BLUE }}>
              {yenLabel(median)}
            </span>
          </span>
        ) : (
          <span className="font-bold text-slate-950">{yenLabel(median)}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
        {ceilingUnknown ? "—" : yenLabel(upper)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
        {ceilingUnknown ? <span className="text-amber-700">未調査</span> : `${yenLabel(row.ceiling_total_yen)}／年`}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
        {row.v_median === null ? "—" : row.v_median.toFixed(3)}
      </td>
      <td
        className="px-2 py-1.5 text-slate-600"
        title={
          row.process_type && row.reg_class
            ? `${PROCESS_TYPE_LABEL[row.process_type]} / ${REG_CLASS_LABEL[row.reg_class]}`
            : "工程の型または規制属性が未判定"
        }
      >
        {laneLabel(row)}
      </td>
      <td
        className="px-2 py-1.5 text-slate-600"
        title={row.evidence_stage === null ? "証拠水準が未入力" : STAGE_LABEL[row.evidence_stage] ?? ""}
      >
        {stageLabel(row)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{pctLabel(pReach)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
        {months === null ? (
          <span className="text-slate-400" title="自力の量産到達がほぼ無いので、到達までの月数が出ない">
            —
          </span>
        ) : (
          monthLabel(months)
        )}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {ratio === null ? (
          <span className="text-slate-400" title="残るゲートまでの月数が出ないので、この比は出せない">
            —
          </span>
        ) : (
          <span
            className={ratio <= 1.5 ? "font-semibold text-amber-700" : "text-slate-600"}
            title={
              ratio <= 1.5
                ? "資金の長さと、残るゲートを越えるのに要る時間がほぼ同じ。残高が動くと価値が直接動く"
                : "資金の長さに余裕がある。残高が動いても価値はあまり動かない"
            }
          >
            {ratioLabel(ratio)}
          </span>
        )}
      </td>
    </tr>
  );
}

// ───────────────────────────────────────────────────────────── 操作盤

function ParameterPanel({
  row,
  detail,
  loading,
  positions,
  applied,
  movedCount,
  baseRank,
  liveRank,
  onChange,
  onResetParam,
  onResetAll,
}: {
  row: Bzm30SensitivitySeedRow | null;
  detail: Bzm30SensitivityDetail | null;
  loading: boolean;
  positions: Partial<Record<Bzm30SensitivityParam, number>>;
  applied: AppliedResult | null;
  movedCount: number;
  baseRank: number | null;
  liveRank: number | null;
  onChange: (param: Bzm30SensitivityParam, t: number) => void;
  onResetParam: (param: Bzm30SensitivityParam) => void;
  onResetAll: () => void;
}) {
  if (!row) {
    return (
      <section className="border border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-500">
        上の表から案件を1つ選ぶと、その案件のつまみが出る。
      </section>
    );
  }

  const curveByParam = new Map(detail?.curves.map((c) => [c.param, c]) ?? []);
  const rankDelta = baseRank !== null && liveRank !== null ? baseRank - liveRank : 0;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-slate-950">
            {row.name}
            <span className="ml-2 text-[12px] font-normal text-slate-500">{row.project_id ?? "PJ未設定"}</span>
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            つまみは計算した点の上を動く。点と点のあいだは直線でつないだ値を出す。青い目盛りが、いま置いてある入力そのもの。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {applied && movedCount > 0 && (
            <div className="border border-slate-200 bg-white px-3 py-1.5 text-[12px]">
              <span className="text-slate-500">いまの操作の結果</span>
              <span className="mx-2 tabular-nums">
                <span className="text-slate-400 line-through">{yenLabel(row.score_median_yen)}</span>
                <span className="mx-1 text-slate-400">→</span>
                <span className="font-bold" style={{ color: AMD_BLUE }}>
                  {row.ceiling_total_yen === null ? "天井が未調査" : yenLabel(applied.score_median_yen)}
                </span>
              </span>
              {rankDelta !== 0 && (
                <span className={`text-[11px] font-semibold ${rankDelta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  （{rankDelta > 0 ? `＋${rankDelta}` : rankDelta}位）
                </span>
              )}
              {applied.approximate && (
                <span
                  className="ml-2 border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800"
                  title="2本以上のつまみを同時に動かしている。それぞれの倍率を掛け合わせた近似で、厳密な計算ではない"
                >
                  近似（{movedCount}本を同時に操作）
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onResetAll}
            disabled={movedCount === 0}
            className="inline-flex h-9 items-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            ぜんぶ元に戻す
          </button>
        </div>
      </div>

      {loading && !detail ? (
        <div className="flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 px-3 py-8 text-[13px] text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          この案件の曲線を読み込み中
        </div>
      ) : !detail || detail.curves.length === 0 ? (
        <div className="border border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-600">
          <span className="font-semibold">計算中。</span>
          この案件の曲線はまだ計算が終わっていない。1件あたり10秒〜数分かかるので、順に埋まっていく。
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200">
          <table className="w-full min-w-[1080px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-100 text-left text-[10px] font-semibold text-slate-500">
                <th className="w-[220px] border-b border-slate-200 px-3 py-2">パラメータ</th>
                <th className="w-[210px] border-b border-slate-200 px-3 py-2">いまの値</th>
                <th className="w-[300px] border-b border-slate-200 px-3 py-2">つまみ</th>
                <th className="w-[168px] border-b border-slate-200 px-3 py-2 text-right">その点での金額</th>
                <th className="border-b border-slate-200 px-3 py-2">根拠</th>
              </tr>
            </thead>
            <tbody>
              {BZM30_SENSITIVITY_PARAMS.map((param) => (
                <ParameterRow
                  key={param}
                  param={param}
                  curve={curveByParam.get(param) ?? null}
                  position={positions[param]}
                  baseMedianYen={row.score_median_yen}
                  ceilingUnknown={row.ceiling_total_yen === null}
                  reason={detail.reasons[param] ?? null}
                  onChange={(t) => onChange(param, t)}
                  onReset={() => onResetParam(param)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ParameterRow({
  param,
  curve,
  position,
  baseMedianYen,
  ceilingUnknown,
  reason,
  onChange,
  onReset,
}: {
  param: Bzm30SensitivityParam;
  curve: Bzm30SensitivityCurve | null;
  position: number | undefined;
  baseMedianYen: number | null;
  ceilingUnknown: boolean;
  reason: string | null;
  onChange: (t: number) => void;
  onReset: () => void;
}) {
  const meta = PARAM_META[param];

  if (!curve || curve.points.length < 2) {
    return (
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2">
          <div className="font-medium text-slate-500">{meta.label}</div>
          <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{meta.hint}</div>
        </td>
        <td colSpan={3} className="px-3 py-2 text-slate-500">
          この案件では入力が無いので振っていない
        </td>
        <td className="px-3 py-2 text-slate-400">
          <span className="line-clamp-2 leading-snug">{reason ?? "—"}</span>
        </td>
      </tr>
    );
  }

  const last = curve.points.length - 1;
  const base = curve.baseIndex;
  const t = position ?? base ?? 0;
  const here = valueAt(curve, t);
  const atBase = base !== null && Math.abs(t - base) < 1e-6;
  const baseValue = base !== null ? curve.points[base] : null;
  const multiplier =
    baseValue?.score_median_yen && here.score_median_yen !== null && baseValue.score_median_yen !== 0
      ? here.score_median_yen / baseValue.score_median_yen
      : null;

  return (
    <tr className={`border-b border-slate-100 ${atBase ? "" : "bg-sky-50/40"}`}>
      <td className="px-3 py-2 align-top">
        <div className="font-medium text-slate-900">{meta.label}</div>
        <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{meta.hint}</div>
      </td>
      <td className="px-3 py-2 align-top">
        {atBase ? (
          <span className="font-semibold text-slate-900">{baseValue?.param_label ?? here.label}</span>
        ) : (
          <span className="leading-snug">
            <span className="text-slate-400 line-through">{baseValue?.param_label ?? "—"}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className="font-semibold" style={{ color: AMD_BLUE }}>
              {here.label}
            </span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={last}
            step={0.01}
            value={t}
            onChange={(e) => onChange(snapToTick(Number(e.target.value), last))}
            aria-label={`${meta.label}を動かす`}
            className="h-4 w-full cursor-pointer accent-[#027FDC]"
          />
          <div className="pointer-events-none relative mt-0.5 h-2">
            {curve.points.map((p, i) => (
              <span
                key={p.point_index}
                className={`absolute top-0 block h-2 w-px ${p.is_base ? "h-2.5 w-0.5" : ""}`}
                style={{
                  left: `${last === 0 ? 0 : (i / last) * 100}%`,
                  backgroundColor: p.is_base ? AMD_BLUE : "#CBD5E1",
                }}
              />
            ))}
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] leading-none text-slate-400">
            <span className="truncate pr-2">{curve.points[0].param_label}</span>
            <span className="truncate pl-2 text-right">{curve.points[last].param_label}</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-right align-top tabular-nums">
        {ceilingUnknown ? (
          <span className="text-[11px] text-amber-700">天井が未調査</span>
        ) : (
          <>
            <div className={atBase ? "font-semibold text-slate-900" : "font-bold"} style={atBase ? undefined : { color: AMD_BLUE }}>
              {yenLabel(here.score_median_yen)}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              {atBase
                ? "いまの入力の点"
                : multiplier === null
                  ? `いまは ${yenLabel(baseMedianYen)}`
                  : `いまの ${multiplier.toFixed(2)} 倍`}
              {!here.onTick && <span className="ml-1 text-slate-400">（点のあいだ・直線でつないだ値）</span>}
            </div>
          </>
        )}
        {!atBase && (
          <button
            type="button"
            onClick={onReset}
            className="mt-1 inline-flex items-center gap-1 border border-slate-300 bg-white px-1.5 py-px text-[10px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Undo2 className="h-3 w-3" aria-hidden="true" />
            元に戻す
          </button>
        )}
      </td>
      <td className="px-3 py-2 align-top text-slate-600">
        <span className="line-clamp-2 leading-snug" title={reason ?? undefined}>
          {reason ?? "根拠が未記入"}
        </span>
      </td>
    </tr>
  );
}

/** 目盛りの近くではその点に吸い付かせる。計算した点そのものへ確実に止められるようにする。 */
function snapToTick(t: number, last: number): number {
  const nearest = Math.round(t);
  if (nearest >= 0 && nearest <= last && Math.abs(t - nearest) <= 0.08) return nearest;
  return t;
}
