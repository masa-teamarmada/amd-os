"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Atom,
  Bot,
  Cpu,
  Dna,
  FileText,
  FlaskConical,
  ListFilter,
  Loader2,
  Plus,
  Recycle,
  RotateCcw,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { KuteSeedDetailModal } from "@/components/seeds/KuteSeedDetailModal";
import { SeedDetailModal } from "@/components/seeds/SeedDetailModal";
import {
  fetchResearchInstitutionSeedsForProject,
  fetchInternalResearchInstitutionSeedsForProject,
  fetchInstitutionIdForProject,
  fetchAllResearchInstitutionSeeds,
  fetchAllInternalResearchInstitutionSeeds,
  SEED_DOMAIN_LANE_LABEL,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
  formatOkuYen,
  compareSeedSortValues,
  countDistinctResearchers,
  countDistinctInstitutions,
  seedProjectLifecycle,
  seedProjectPriority,
  seedListPriority,
} from "@/lib/seeds-data";
import { projectStatusLifecycle } from "@/lib/institution-projects";
import { prefetchBzm30Model } from "@/lib/bzm30-model-client";
import { prefetchSeedBzm30, loadSeedBzm30Summaries } from "@/lib/bzm30-seed-client";
import type { SeedBzm30Summary } from "@/lib/bzm30/seed-score";
import { STAGE_LABEL } from "@/lib/bzm30/seed-inputs";
import type { SeedDomainLane, SeedInternalComparisonView, SeedPublicView } from "@/types/seeds";

type SortKey = "spsBand";
type StatusFilter = "all" | "assessed" | "unassessed";
type DisplaySeed = SeedPublicView | SeedInternalComparisonView;
type SeedColumnKey =
  | "seedNo" | "title" | "company" | "institution" | "researcher" | "value"
  | "stage" | "trl" | "brl" | "hrl" | "commercialization" | "useCase"
  | "customer" | "market" | "bottleneck" | "ip" | "verification" | "hypothesis" | "material";

const SEED_TABLE_WIDTHS_KEY = "amd-os:seed-table-column-widths:v1";
const SEED_COLUMN_DEFAULTS: Record<SeedColumnKey, number> = {
  seedNo: 72,
  title: 220,
  company: 180,
  institution: 140,
  researcher: 130,
  value: 190,
  stage: 150,
  trl: 52,
  brl: 52,
  hrl: 52,
  commercialization: 140,
  useCase: 180,
  customer: 180,
  market: 160,
  bottleneck: 200,
  ip: 150,
  verification: 200,
  hypothesis: 300,
  material: 70,
};

function initialSeedColumnWidths(): Record<SeedColumnKey, number> {
  if (typeof window === "undefined") return SEED_COLUMN_DEFAULTS;
  try {
    const stored = window.localStorage.getItem(SEED_TABLE_WIDTHS_KEY);
    if (!stored) return SEED_COLUMN_DEFAULTS;
    const parsed = JSON.parse(stored) as Partial<Record<SeedColumnKey, number>>;
    const next = { ...SEED_COLUMN_DEFAULTS };
    for (const key of Object.keys(next) as SeedColumnKey[]) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value)) next[key] = Math.max(48, Math.min(720, value));
    }
    return next;
  } catch {
    return SEED_COLUMN_DEFAULTS;
  }
}

const SORT_LABEL: Record<SortKey, string> = {
  spsBand: "産業創出価値(中央値)",
};

/** 評価状態の絞り込み。BZM 3.0 のスコアを持つかどうかで分ける。先頭が絞り込みなしの状態。 */
const EVALUATION_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "assessed", label: "評価済み" },
  { value: "unassessed", label: "最新版未評価" },
];

const SEED_DOMAIN_VISUAL: Record<SeedDomainLane, {
  Icon: LucideIcon;
  className: string;
}> = {
  gx_energy: { Icon: Zap, className: "border-amber-200 bg-amber-50 text-amber-700" },
  gx_circular: { Icon: Recycle, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  life: { Icon: Dna, className: "border-rose-200 bg-rose-50 text-rose-700" },
  materials: { Icon: Atom, className: "border-violet-200 bg-violet-50 text-violet-700" },
  robo: { Icon: Bot, className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  ict: { Icon: Cpu, className: "border-sky-200 bg-sky-50 text-sky-700" },
  other: { Icon: FlaskConical, className: "border-slate-200 bg-slate-50 text-slate-600" },
};

function SeedDomainIcon({ domain }: { domain: SeedDomainLane | null }) {
  const domainKey = domain ?? "other";
  const visual = SEED_DOMAIN_VISUAL[domainKey];
  const Icon = visual.Icon;
  const label = `技術領域: ${domain ? SEED_DOMAIN_LANE_LABEL[domainKey] : "未分類"}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-seed-domain={domain ?? "other"}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border align-middle ${visual.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

/**
 * 産業創出価値の列ソート値 = BZM 3.0 の中央値（50%点）。
 * まだ算出していないシーズと、天井が未調査で金額が出ないシーズは常に末尾。
 */
function bzm30SortValue(
  seed: SeedPublicView,
  scoresBySeedId: Map<string, SeedBzm30Summary>,
): number | null {
  const score = scoresBySeedId.get(seed.id);
  if (!score || score.score_median_yen === null) return null;
  return score.score_median_yen;
}

/** 通常PJコックピットで、institution_projects に属するPJだけ比較表を出す。 */
export function ProjectInstitutionSeeds({ projectId }: { projectId: string }) {
  const [isInstitutionProject, setIsInstitutionProject] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInstitutionIdForProject(projectId)
      .then((institutionId) => {
        if (!cancelled) setIsInstitutionProject(Boolean(institutionId));
      })
      .catch(() => {
        if (!cancelled) setIsInstitutionProject(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!isInstitutionProject) return null;
  return <CockpitKuteSeeds projectId={projectId} detailSurface="internal" />;
}

/**
 * 研究機関 PJ cockpit (KUTE / p25, EHM / p30 等) の進捗タブ向け: 対象研究機関シーズを、案件単位で横比較する
 * 意思決定テーブルとして表示する。global Seeds テーブルが唯一の source of truth。
 * 1行は「技術 × 応用先」の1案件であり、同じ研究者の複数シーズを統合・重複除外しない。
 * internal_notes / source_detail 等は fetchResearchInstitutionSeedsForProject 側で
 * select から除外済み (ホワイトリスト取得)。SPS の axis_evidence / evaluator は
 * データ層で既に落ちており、ここには一切渡らない。
 */
export function CockpitKuteSeeds({
  projectId,
  scope = "project",
  detailSurface,
}: {
  projectId?: string;
  scope?: "project" | "all";
  detailSurface: "internal" | "public";
}) {
  const [seeds, setSeeds] = useState<DisplaySeed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DisplaySeed | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("spsBand");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [columnWidths, setColumnWidths] = useState(SEED_COLUMN_DEFAULTS);
  // 全scope共通: BZM 3.0 の算出済みスコアをまとめて読む。
  const [scoresBySeedId, setScoresBySeedId] = useState<Map<string, SeedBzm30Summary>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const request = detailSurface === "internal"
      ? (scope === "all" ? fetchAllInternalResearchInstitutionSeeds() : fetchInternalResearchInstitutionSeedsForProject(projectId ?? ""))
      : (scope === "all" ? fetchAllResearchInstitutionSeeds() : fetchResearchInstitutionSeedsForProject(projectId ?? ""));
    request
      .then((data) => {
        if (!cancelled) setSeeds(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "シーズ一覧を読み込めなかった");
      });
    return () => {
      cancelled = true;
    };
  }, [detailSurface, projectId, scope, requestKey]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setColumnWidths(initialSeedColumnWidths()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const visibleColumnKeys = useMemo<SeedColumnKey[]>(() => [
    "seedNo", "title", "company", "institution", "researcher", "value", "stage",
    "trl", "brl", "hrl", "commercialization", "useCase", "customer", "market",
    "bottleneck", "ip", "verification",
    ...(detailSurface === "internal" ? ["hypothesis" as const] : []),
    "material",
  ], [detailSurface]);
  const tableWidth = visibleColumnKeys.reduce((sum, key) => sum + columnWidths[key], 0);

  function resizeColumn(key: SeedColumnKey, width: number) {
    setColumnWidths((current) => {
      const next = { ...current, [key]: Math.max(48, Math.min(720, Math.round(width))) };
      window.localStorage.setItem(SEED_TABLE_WIDTHS_KEY, JSON.stringify(next));
      return next;
    });
  }

  // スコアは参照系。lib/bzm30-seed-client.ts のキャッシュを通し、
  // 一覧 → 詳細 → 一覧 と行き来しても読み直さない。
  useEffect(() => {
    let cancelled = false;
    loadSeedBzm30Summaries({ force: requestKey > 0 })
      .then((scores) => {
        if (!cancelled) setScoresBySeedId(scores);
      })
      .catch(() => {
        // スコアは補助表示。取得失敗しても一覧本体は表示を続ける。
      });
    return () => {
      cancelled = true;
    };
  }, [scope, requestKey]);

  const scopedSeeds = useMemo(() => {
    if (!seeds) return [];
    return seeds;
  }, [seeds]);

  const materialCount = scopedSeeds.filter((seed) => seed.deep_dive_material_url).length;
  const scoredCount = scopedSeeds.filter((seed) => scoresBySeedId.has(seed.id)).length;
  const researcherCount = countDistinctResearchers(scopedSeeds);
  const institutionCount = countDistinctInstitutions(scopedSeeds);
  const realizedProjectSeedCount = scopedSeeds.filter((seed) => seedProjectPriority(seed) === 0).length;
  const consideringProjectSeedCount = scopedSeeds.filter((seed) => seedProjectPriority(seed) === 1).length;
  const unrealizedScoredSeedCount = scopedSeeds.filter((seed) => seedListPriority(seed) === 2).length;

  const filteredSeeds = useMemo(() => {
    return scopedSeeds.filter((seed) => {
      const evaluationStatus = scoresBySeedId.has(seed.id) ? "assessed" : "unassessed";
      if (statusFilter !== "all" && evaluationStatus !== statusFilter) return false;
      return true;
    });
  }, [scoresBySeedId, scopedSeeds, statusFilter]);

  const dir = sortDir === "asc" ? 1 : -1;

  const flatSeeds = useMemo(() => {
    return [...filteredSeeds].sort((a, b) => {
      // SPS(スクリーニング帯)ソート時はPJ優先4段を外してリスト全体をフラットに並べる
      // (まさ裁定 2026-08-15「全然ソーティングされない」への対応。他キーは従来どおり区分内ソート)
      const byScore = compareSeedSortValues(
        bzm30SortValue(a, scoresBySeedId),
        bzm30SortValue(b, scoresBySeedId),
        dir,
      );
      return byScore || a.title.localeCompare(b.title, "ja");
    });
  }, [filteredSeeds, dir, scoresBySeedId]);

  const isEmptyResult = flatSeeds.length === 0;

  // 表の下に余白を残さない。表より上にある見出しやタブの高さは画面幅と scope で変わるので、
  // 固定の 70vh ではなく、表の上端を実測して画面下端までをスクロール領域にする。
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      const element = tableRef.current;
      if (!element) return;
      // 高さ制限を外した状態で測ると、表の下に積まれている余白（ページの下パディング等）が
      // ページ全体の高さとの差として出る。その余白を残した残り全部を表の高さにする。
      const applied = element.style.maxHeight;
      element.style.maxHeight = "none";
      const rect = element.getBoundingClientRect();
      const below = Math.max(0, document.documentElement.scrollHeight - Math.round(rect.bottom + window.scrollY));
      element.style.maxHeight = applied;
      setTableMaxHeight(Math.max(320, Math.round(window.innerHeight - rect.top - below)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [seeds, error, isEmptyResult]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <section className="px-1 py-2">
      {scope === "all" && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950">シーズリスト</h2>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
              AMDとの契約有無に関係なく蓄積する全シーズ一覧。1行＝1シーズで、PJ化済み、PJ化検討中、PJなし・SPS評価済み、その他の順に並べる。
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
              「公開情報候補」は大学・研究者による確認前。SPSとXRLは評価が揃うまで未評価のまま表示する。
            </p>
            {seeds && (
              <p className="mt-1.5 text-[11px] text-slate-500" aria-label="シーズ集計">
                対象{scopedSeeds.length}件
                {`・機関${institutionCount}機関`}
                {`・PJ化済み${realizedProjectSeedCount}件`}
                {`・PJ化検討中${consideringProjectSeedCount}件`}
                {`・PJなし・SPS評価済み${unrealizedScoredSeedCount}件`}
                ・研究者{researcherCount}名・資料{materialCount}件
                {`・現行SPS評価済み${scoredCount}件`}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-3">
          {scope === "all" && (
            <Link
              href="/seeds/sensitivity"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              title="入力を1つずつ振ったときに産業創出価値がどう動くかを、つまみを動かして見る"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              入力を動かして見る
            </Link>
          )}
          {scope === "all" && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-semibold text-white hover:bg-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              新規シーズ
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSeeds(null);
              setError(null);
              setRequestKey((value) => value + 1);
            }}
            title="再読み込み"
            aria-label="再読み込み"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        {error ? (
          <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setSeeds(null);
                setError(null);
                setRequestKey((value) => value + 1);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 font-semibold hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              再読み込み
            </button>
          </div>
        ) : seeds === null ? (
          <div className="flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 px-3 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            読み込み中
          </div>
        ) : seeds.length === 0 ? (
          <div className="border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            対象のシーズがまだ登録されていない
          </div>
        ) : isEmptyResult ? (
          <div className="flex flex-col items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            <span>条件に合うシーズがない</span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              絞り込みを解除
            </button>
          </div>
        ) : (
          <div
            ref={tableRef}
            style={tableMaxHeight === null ? undefined : { maxHeight: tableMaxHeight }}
            className="max-h-[70vh] overflow-auto border border-slate-200"
          >
            <table className="table-fixed border-collapse text-[12px]" style={{ width: tableWidth }}>
              <colgroup>
                {visibleColumnKeys.map((key) => <col key={key} style={{ width: columnWidths[key] }} />)}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100 text-left text-[10px] font-semibold uppercase text-slate-500">
                  <ResizableTh columnKey="seedNo" width={columnWidths.seedNo} onResize={resizeColumn} onReset={() => resizeColumn("seedNo", SEED_COLUMN_DEFAULTS.seedNo)} stickyLeft={0}>シーズNo.</ResizableTh>
                  <ResizableTh columnKey="title" width={columnWidths.title} onResize={resizeColumn} onReset={() => resizeColumn("title", SEED_COLUMN_DEFAULTS.title)} stickyLeft={columnWidths.seedNo} desktopSticky>シーズ</ResizableTh>
                  <ResizableTh columnKey="company" width={columnWidths.company} onResize={resizeColumn} onReset={() => resizeColumn("company", SEED_COLUMN_DEFAULTS.company)}>会社名</ResizableTh>
                  <ResizableTh columnKey="institution" width={columnWidths.institution} onResize={resizeColumn} onReset={() => resizeColumn("institution", SEED_COLUMN_DEFAULTS.institution)}>研究機関</ResizableTh>
                  <ResizableTh columnKey="researcher" width={columnWidths.researcher} onResize={resizeColumn} onReset={() => resizeColumn("researcher", SEED_COLUMN_DEFAULTS.researcher)}>研究者 / PI</ResizableTh>
                  <ResizableTh columnKey="value" width={columnWidths.value} onResize={resizeColumn} onReset={() => resizeColumn("value", SEED_COLUMN_DEFAULTS.value)}>
                    <div className="flex items-center justify-between gap-1">
                      <SortButton label="産業創出価値(億円)" sortKey="spsBand" activeKey={sortKey} dir={sortDir} onSort={toggleSort} hint="BZM 3.0。中央値でソートする。天井が未調査の案件は金額が出ないので末尾" />
                      <ColumnFilter
                        label="評価状態"
                        value={statusFilter}
                        options={EVALUATION_FILTER_OPTIONS}
                        onChange={setStatusFilter}
                      />
                    </div>
                  </ResizableTh>
                  <ResizableTh columnKey="stage" width={columnWidths.stage} onResize={resizeColumn} onReset={() => resizeColumn("stage", SEED_COLUMN_DEFAULTS.stage)}>現在地・型</ResizableTh>
                  <ResizableTh columnKey="trl" width={columnWidths.trl} onResize={resizeColumn} onReset={() => resizeColumn("trl", SEED_COLUMN_DEFAULTS.trl)}>TRL</ResizableTh>
                  <ResizableTh columnKey="brl" width={columnWidths.brl} onResize={resizeColumn} onReset={() => resizeColumn("brl", SEED_COLUMN_DEFAULTS.brl)}>BRL</ResizableTh>
                  <ResizableTh columnKey="hrl" width={columnWidths.hrl} onResize={resizeColumn} onReset={() => resizeColumn("hrl", SEED_COLUMN_DEFAULTS.hrl)}>HRL</ResizableTh>
                  <ResizableTh columnKey="commercialization" width={columnWidths.commercialization} onResize={resizeColumn} onReset={() => resizeColumn("commercialization", SEED_COLUMN_DEFAULTS.commercialization)}>事業化タイプ</ResizableTh>
                  <ResizableTh columnKey="useCase" width={columnWidths.useCase} onResize={resizeColumn} onReset={() => resizeColumn("useCase", SEED_COLUMN_DEFAULTS.useCase)}>用途</ResizableTh>
                  <ResizableTh columnKey="customer" width={columnWidths.customer} onResize={resizeColumn} onReset={() => resizeColumn("customer", SEED_COLUMN_DEFAULTS.customer)}>最初の顧客</ResizableTh>
                  <ResizableTh columnKey="market" width={columnWidths.market} onResize={resizeColumn} onReset={() => resizeColumn("market", SEED_COLUMN_DEFAULTS.market)}>市場/確度</ResizableTh>
                  <ResizableTh columnKey="bottleneck" width={columnWidths.bottleneck} onResize={resizeColumn} onReset={() => resizeColumn("bottleneck", SEED_COLUMN_DEFAULTS.bottleneck)}>ネック</ResizableTh>
                  <ResizableTh columnKey="ip" width={columnWidths.ip} onResize={resizeColumn} onReset={() => resizeColumn("ip", SEED_COLUMN_DEFAULTS.ip)}>知財</ResizableTh>
                  <ResizableTh columnKey="verification" width={columnWidths.verification} onResize={resizeColumn} onReset={() => resizeColumn("verification", SEED_COLUMN_DEFAULTS.verification)}>次の検証</ResizableTh>
                  {detailSurface === "internal" && (
                    <ResizableTh columnKey="hypothesis" width={columnWidths.hypothesis} onResize={resizeColumn} onReset={() => resizeColumn("hypothesis", SEED_COLUMN_DEFAULTS.hypothesis)} title="AMD側の未検証な提案。研究成果や市場成立の確定情報ではない">追加研究による市場創出案</ResizableTh>
                  )}
                  <ResizableTh columnKey="material" width={columnWidths.material} onResize={resizeColumn} onReset={() => resizeColumn("material", SEED_COLUMN_DEFAULTS.material)}>資料</ResizableTh>
                </tr>
              </thead>
              <tbody>
                {flatSeeds.map((seed) => (
                  <SeedRow
                    key={seed.id}
                    seed={seed}
                    onOpen={() => setSelected(seed)}
                    bzm30={scoresBySeedId.get(seed.id) ?? null}
                    seedNoWidth={columnWidths.seedNo}
                    showHypothesis={detailSurface === "internal"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && detailSurface === "internal" && (
        <SeedDetailModal
          seedId={selected.id}
          createMode={false}
          onClose={() => setSelected(null)}
          onSaved={() => setRequestKey((value) => value + 1)}
        />
      )}
      {selected && detailSurface === "public" && (
        <KuteSeedDetailModal open seed={selected} onClose={() => setSelected(null)} />
      )}
      {scope === "all" && createOpen && (
        <SeedDetailModal
          seedId={null}
          createMode
          onClose={() => setCreateOpen(false)}
          onSaved={() => setRequestKey((value) => value + 1)}
        />
      )}
    </section>
  );
}

/**
 * 列見出しに付ける絞り込み。表の上に横帯を作らずに済むよう、対象の列の中で開閉する。
 * options の先頭を「絞り込みなし」として扱い、それ以外を選んでいる間はボタンを色で示す。
 */
function ColumnFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const active = value !== options[0].value;
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}で絞り込み`}
        title={`${label}で絞り込み（現在: ${current.label}）`}
        className={`inline-flex h-5 w-5 items-center justify-center rounded border ${active ? "border-sky-400 bg-sky-100 text-sky-700" : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800"}`}
      >
        <ListFilter className="h-3 w-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-6 z-50 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-left normal-case shadow-lg"
        >
          <span className="block px-2.5 pb-1 text-[10px] font-semibold text-slate-400">{label}</span>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full px-2.5 py-1.5 text-left text-[11px] ${option.value === value ? "bg-sky-50 font-semibold text-sky-800" : "font-normal text-slate-700 hover:bg-slate-50"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortButton({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  hint,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  /** タイトルツールチップへ追記する補足説明 (省略可) */
  hint?: string;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={hint ? `${SORT_LABEL[sortKey]}で並び替え。${hint}` : `${SORT_LABEL[sortKey]}で並び替え`}
        className={`inline-flex items-center gap-1 font-semibold ${active ? "text-sky-700" : "text-slate-500 hover:text-slate-800"}`}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

function ResizableTh({
  columnKey,
  width,
  onResize,
  onReset,
  stickyLeft,
  desktopSticky = false,
  title,
  children,
}: {
  columnKey: SeedColumnKey;
  width: number;
  onResize: (key: SeedColumnKey, width: number) => void;
  onReset: () => void;
  stickyLeft?: number;
  desktopSticky?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      className={`relative border-b border-r border-slate-200 bg-slate-100 px-3 py-2 ${stickyLeft !== undefined ? (desktopSticky ? "sm:sticky sm:z-30" : "sticky z-30") : ""}`}
      style={stickyLeft !== undefined ? { left: stickyLeft } : undefined}
      title={title}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`${typeof children === "string" ? children : "列"}の幅を変更`}
        aria-valuemin={48}
        aria-valuemax={720}
        aria-valuenow={width}
        tabIndex={0}
        className="absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize touch-none focus:outline-none focus-visible:bg-sky-500/50"
        onDoubleClick={(event) => {
          event.preventDefault();
          onReset();
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          onResize(columnKey, width + (event.key === "ArrowRight" ? 16 : -16));
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          const handle = event.currentTarget;
          handle.setPointerCapture(event.pointerId);
          handle.dataset.startX = String(event.clientX);
          handle.dataset.startWidth = String(width);
        }}
        onPointerMove={(event) => {
          const handle = event.currentTarget;
          if (!handle.hasPointerCapture(event.pointerId)) return;
          const startX = Number(handle.dataset.startX);
          const startWidth = Number(handle.dataset.startWidth);
          onResize(columnKey, startWidth + event.clientX - startX);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      />
    </th>
  );
}

function Cell({ value }: { value: string | null }) {
  return (
    <td className="border-b border-slate-100 px-3 py-2 align-top">
      <span className={`block whitespace-normal break-words leading-relaxed ${value ? "text-slate-700" : "text-slate-400"}`}>
        {value ?? "未確定"}
      </span>
    </td>
  );
}

function AxisCell({ value }: { value: number | null | undefined }) {
  return (
    <td className="border-b border-slate-100 px-2 py-2 align-top font-mono text-[11px] text-slate-700">
      {value == null ? <span className="text-slate-400">—</span> : value}
    </td>
  );
}

// 固定列（シーズNo. / シーズ）は横スクロールする列の上に重なるので、背景に半透明を使うと
// 下を流れる文字が透ける。ホバーとフォーカスの色は「行の地色に sky-50 を 60% 重ねた結果」を
// 不透明色として直接置き、非固定列の hover:bg-sky-50/60 と同じ見え方にそろえる。
const STICKY_CELL_BG = {
  realized: "bg-indigo-50 group-hover:bg-[#eff6ff] group-focus-visible:bg-[#eff6ff]",
  considering: "bg-amber-50 group-hover:bg-[#f6faf7] group-focus-visible:bg-[#f6faf7]",
  none: "bg-white group-hover:bg-[#f6fbff] group-focus-visible:bg-[#f6fbff]",
} as const;

function SeedRow({
  seed,
  onOpen,
  bzm30,
  seedNoWidth,
  showHypothesis,
}: {
  seed: DisplaySeed;
  onOpen: () => void;
  bzm30: SeedBzm30Summary | null;
  seedNoWidth: number;
  showHypothesis: boolean;
}) {
  const commercializationTypes = [
    seed.primary_commercialization_type,
    ...(seed.secondary_commercialization_types ?? []),
  ].filter((t): t is NonNullable<typeof t> => !!t);
  const marketText = seed.market_size_range
    ? `${seed.market_size_range}${seed.market_size_confidence ? ` / ${SEED_KUTE_MARKET_CONFIDENCE_LABEL[seed.market_size_confidence] ?? seed.market_size_confidence}` : ""}`
    : null;
  const projectLinks = seed.project_links ?? [];
  const lifecycle = seedProjectLifecycle(seed);
  const projectLink = projectLinks.find((link) => projectStatusLifecycle(link.project_status) === "realized")
    ?? projectLinks.find((link) => projectStatusLifecycle(link.project_status) === "considering")
    ?? projectLinks[0]
    ?? null;
  const realized = lifecycle === "realized";
  const considering = lifecycle === "considering";
  const companyName = projectLink?.venture_name ?? projectLink?.project_name ?? null;
  const companyLabel = companyName
    ? `${companyName}${projectLink?.commercialization_stage === "pre_incorporation" ? "（未設立）" : ""}`
    : "未設立";
  const stickyCellBg = realized ? STICKY_CELL_BG.realized : considering ? STICKY_CELL_BG.considering : STICKY_CELL_BG.none;
  const stickyCellBorder = realized ? "border-indigo-200" : considering ? "border-amber-200" : "border-slate-200";

  return (
    <tr
      onClick={onOpen}
      // クリックより先に詳細帯を温める。マウスが行に乗ってからクリックが届くまでの
      // 数百ミリ秒で取得が終わるので、モーダルは開いた時点で帯を持っている。
      // BZM 3.0 のモデル定義は全シーズ共通なので、最初の hover の1回だけ取りに行く。
      onMouseEnter={() => { prefetchBzm30Model(); prefetchSeedBzm30(seed.id); }}
      onFocus={() => { prefetchBzm30Model(); prefetchSeedBzm30(seed.id); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group cursor-pointer hover:bg-sky-50/60 focus-visible:bg-sky-50/60 ${realized ? "bg-indigo-50/45" : considering ? "bg-amber-50/35" : ""}`}
      role="button"
      tabIndex={0}
    >
      <td className={`sticky left-0 z-10 border-b border-r px-3 py-2 align-top font-mono text-[11px] font-semibold ${stickyCellBorder} ${stickyCellBg} ${realized ? "text-indigo-700" : considering ? "text-amber-700" : "text-slate-600"}`}>
        {seed.seed_no == null ? "—" : String(seed.seed_no).padStart(2, "0")}
      </td>
      <td style={{ left: seedNoWidth }} className={`border-b border-r px-3 py-2 align-top sm:sticky sm:z-10 ${stickyCellBorder} ${stickyCellBg}`}>
        <div className="whitespace-normal break-words font-semibold leading-snug text-slate-950">
          <SeedDomainIcon domain={seed.domain_lane} />
          <span className="ml-1">
            {seed.title}
          </span>
        </div>
        {seed.discovery_status === "discovered" && (
          <span className="mt-1.5 inline-flex whitespace-normal rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-800">
            公開情報候補
          </span>
        )}
      </td>
      <td className="relative border-b border-slate-100 px-3 py-2 align-top">
        <span className={`block whitespace-normal break-words pr-7 text-[13px] font-bold leading-snug ${companyName ? "text-slate-950" : "text-slate-400"}`}>
          {companyLabel}
        </span>
        {seed.company_note && (
          <span className="mt-1 block whitespace-normal break-words pr-7 text-[11px] font-medium leading-snug text-slate-500">
            {seed.company_note}
          </span>
        )}
        {projectLink && (
          <span
            title={`紐付くPJ: ${projectLink.project_name}`}
            className="absolute right-2 top-2 inline-flex items-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm"
          >
            PJ
          </span>
        )}
      </td>
      <Cell value={seed.org_name} />
      <Cell
        value={seed.researcher_name
          ? `${seed.researcher_name}${seed.researcher_title ? ` / ${seed.researcher_title}` : ""}`
          : null}
      />
      <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
          {bzm30 && bzm30.score_median_yen !== null ? (
            <span className="whitespace-nowrap">
              <span className={bzm30.current ? "font-semibold text-slate-950" : "font-semibold text-rose-700"}>
                {formatOkuYen(bzm30.score_median_yen)}
              </span>
              <span className="ml-1 text-[10px] text-slate-500">
                ({formatOkuYen(bzm30.score_lower_yen)}〜{formatOkuYen(bzm30.score_upper_yen)})
              </span>
              {bzm30.current ? null : (
                <span
                  className="ml-1 text-[10px] text-rose-700"
                  title="いまのモデル定義が変わったあと計算し直していない。他の行と並べて順位を読まない"
                >
                  古い定義
                </span>
              )}
            </span>
          ) : bzm30 ? (
            <span className="whitespace-nowrap text-[11px] text-amber-700">
              天井が未調査
              <span className="ml-1 text-[10px] text-slate-500">(天井1円あたり {bzm30.v_median.toFixed(3)})</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">未算出</span>
          )}
      </td>
      <td className="border-b border-slate-100 px-2 py-2 align-top text-[10px] leading-tight">
          {bzm30 ? (
            <>
              <div className="text-slate-700">
                {bzm30.evidence_stage === null ? "現在地 未入力" : (STAGE_LABEL[bzm30.evidence_stage] ?? `段階${bzm30.evidence_stage}`)}
              </div>
              <div className="font-mono text-slate-500">
                {bzm30.process_type ?? "—"}×{(bzm30.reg_class ?? "").replace("REG", "REG-")}
              </div>
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
      </td>
      <AxisCell value={seed.trl} />
      <AxisCell value={seed.brl} />
      <AxisCell value={seed.hrl} />
      <td className="border-b border-slate-100 px-3 py-2 align-top">
        {commercializationTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {commercializationTypes.map((t) => (
              <span
                key={t}
                className="whitespace-normal break-words rounded border border-slate-300 bg-slate-50 px-1 py-0.5 text-[10px] leading-tight text-slate-700"
              >
                {SEED_COMMERCIALIZATION_TYPE_LABEL[t] ?? t}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400">未確定</span>
        )}
      </td>
      <Cell value={seed.envisioned_use_case} />
      <Cell value={seed.first_customer_candidate} />
      <Cell value={marketText} />
      <Cell value={seed.biggest_bottleneck} />
      <Cell value={seed.ip_status} />
      <Cell value={seed.next_verification_step} />
      {showHypothesis && (
        <Cell value={("additional_research_hypothesis" in seed ? seed.additional_research_hypothesis : null) ?? null} />
      )}
      <td className="border-b border-slate-100 px-3 py-2 align-top">
        {seed.deep_dive_material_url ? (
          <span title="資料あり">
            <FileText className="h-4 w-4 text-sky-600" role="img" aria-label="資料あり" />
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}
