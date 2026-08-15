"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Loader2, RotateCcw } from "lucide-react";
import { KuteSeedDetailModal } from "@/components/seeds/KuteSeedDetailModal";
import {
  fetchResearchInstitutionSeedsForProject,
  fetchInstitutionIdForProject,
  fetchAllResearchInstitutionSeeds,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
  SEED_STATUS_LABEL,
  SEED_EVIDENCE_LEVEL_LABEL,
  SEED_EVIDENCE_LEVEL_DESCRIPTION,
  formatOkuYen,
  seedComparisonSortValue,
  compareSeedSortValues,
  countDistinctResearchers,
  countDistinctInstitutions,
  seedProjectLifecycle,
  seedProjectPriority,
  seedListPriority,
  type SeedComparisonSortKey,
} from "@/lib/seeds-data";
import { projectStatusLifecycle } from "@/lib/institution-projects";
import type { SeedPublicView, SeedScreeningBandSummary } from "@/types/seeds";

type SortKey = SeedComparisonSortKey | "spsBand";
type ConfidenceFilter = "all" | "low" | "medium" | "high";
type StatusFilter = "all" | "ready" | "missing";

const SORT_LABEL: Record<SortKey, string> = {
  sps: "旧SPS",
  m: "M",
  p: "P",
  r: "R",
  s: "S",
  spsBand: "SPS帯",
};

/** SPS帯の列ソート値。既定は上限降順 (2026-08-15 まさ確定)。帯が無いシーズは常に末尾。 */
function screeningBandSortValue(
  seed: SeedPublicView,
  bandsBySeedId: Map<string, SeedScreeningBandSummary>,
): number | null {
  return bandsBySeedId.get(seed.id)?.sps_upper_yen ?? null;
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
  return <CockpitKuteSeeds projectId={projectId} />;
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
}: {
  projectId?: string;
  scope?: "project" | "all";
}) {
  const [seeds, setSeeds] = useState<SeedPublicView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SeedPublicView | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("sps");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // /seeds (scope="all") 限定: 一次選別スクリーニング帯 (SPS帯 + 根拠Lv)。他 scope の列・挙動は変えない。
  const [bandsBySeedId, setBandsBySeedId] = useState<Map<string, SeedScreeningBandSummary>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const request = scope === "all" ? fetchAllResearchInstitutionSeeds() : fetchResearchInstitutionSeedsForProject(projectId ?? "");
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
  }, [projectId, scope, requestKey]);

  useEffect(() => {
    if (scope !== "all") return;
    let cancelled = false;
    fetch("/api/seeds/screening-bands")
      .then((res) => res.json())
      .then((json: { ok: boolean; bands?: SeedScreeningBandSummary[] }) => {
        if (cancelled || !json.ok || !json.bands) return;
        setBandsBySeedId(new Map(json.bands.map((band) => [band.seed_id, band])));
      })
      .catch(() => {
        // スクリーニング帯は補助表示。取得失敗しても一覧本体は表示を続ける。
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
  const scoredCount = scopedSeeds.filter((seed) => seed.latest_sps?.status === "ready").length;
  const researcherCount = countDistinctResearchers(scopedSeeds);
  const institutionCount = countDistinctInstitutions(scopedSeeds);
  const realizedProjectSeedCount = scopedSeeds.filter((seed) => seedProjectPriority(seed) === 0).length;
  const consideringProjectSeedCount = scopedSeeds.filter((seed) => seedProjectPriority(seed) === 1).length;
  const unrealizedScoredSeedCount = scopedSeeds.filter((seed) => seedListPriority(seed) === 2).length;

  const filteredSeeds = useMemo(() => {
    return scopedSeeds.filter((seed) => {
      const sps = seed.latest_sps;
      const evaluationStatus = sps?.status ?? "missing";
      if (statusFilter !== "all" && evaluationStatus !== statusFilter) return false;
      if (confidenceFilter !== "all" && sps?.confidence !== confidenceFilter) return false;
      return true;
    });
  }, [scopedSeeds, statusFilter, confidenceFilter]);

  const dir = sortDir === "asc" ? 1 : -1;

  const flatSeeds = useMemo(() => {
    return [...filteredSeeds].sort((a, b) => {
      const lifecycle = scope === "all" ? seedListPriority(a) - seedListPriority(b) : 0;
      if (lifecycle !== 0) return lifecycle;
      const byScore = compareSeedSortValues(
        sortKey === "spsBand"
          ? screeningBandSortValue(a, bandsBySeedId)
          : seedComparisonSortValue(a, sortKey),
        sortKey === "spsBand"
          ? screeningBandSortValue(b, bandsBySeedId)
          : seedComparisonSortValue(b, sortKey),
        dir,
      );
      return byScore || a.title.localeCompare(b.title, "ja");
    });
  }, [filteredSeeds, scope, sortKey, dir, bandsBySeedId]);

  const isEmptyResult = flatSeeds.length === 0;

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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-950">{scope === "all" ? "シーズリスト" : "連携シーズ比較"}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
            {scope === "all"
              ? "AMDとの契約有無に関係なく蓄積する全シーズ一覧。1行＝1シーズで、PJ化済み、PJ化検討中、PJなし・SPS評価済み、その他の順に並べる。"
              : "優先順位と次の検証を決める候補一覧。1行＝技術 × 用途の1案件として比較する。"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
            「公開情報候補」は大学・研究者による確認前。SPSとXRLは評価が揃うまで未評価のまま表示する。
          </p>
          {seeds && (
            <p className="mt-1.5 text-[11px] text-slate-500" aria-label="シーズ集計">
              対象{scopedSeeds.length}件
              {scope === "all" && `・機関${institutionCount}機関`}
              {scope === "all" && `・PJ化済み${realizedProjectSeedCount}件`}
              {scope === "all" && `・PJ化検討中${consideringProjectSeedCount}件`}
              {scope === "all" && `・PJなし・SPS評価済み${unrealizedScoredSeedCount}件`}
              ・研究者{researcherCount}名・資料{materialCount}件・旧SPS{scoredCount}件
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-3">
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

      {seeds && seeds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
          <FilterSelect
            label="確度"
            value={confidenceFilter}
            onChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}
            options={[
              { value: "all", label: "すべて" },
              { value: "low", label: "低" },
              { value: "medium", label: "中" },
              { value: "high", label: "高" },
            ]}
          />
          <FilterSelect
            label="評価状態"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: "all", label: "すべて" },
              { value: "ready", label: "計算可" },
              { value: "missing", label: "未評価" },
            ]}
          />
        </div>
      )}

      <div className="mt-4">
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
          <div className="border border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            条件に合うシーズがない
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto border border-slate-200">
            <table className="w-full min-w-[1780px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100 text-left text-[10px] font-semibold uppercase text-slate-500">
                  <th className="sticky left-0 z-30 w-[160px] min-w-[160px] max-w-[160px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px]">
                    シーズ
                  </th>
                  <th className="min-w-[140px] border-b border-slate-200 px-3 py-2">研究機関</th>
                  <th className="min-w-[130px] border-b border-slate-200 px-3 py-2">研究者 / PI</th>
                  <th className="min-w-[150px] border-b border-slate-200 px-3 py-2">PJ状態</th>
                  {scope === "all" && (
                    <SortableTh
                      label="SPS帯(億円)"
                      sortKey="spsBand"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                  )}
                  {scope === "all" && (
                    <th
                      className="min-w-[70px] border-b border-slate-200 px-2 py-2"
                      title="根拠Lv = そのスコアが立脚する情報の深さ。Lv0=ネット情報のみ / Lv1=ヒアリング済 / Lv2=OSにPJ情報抽出済 / Lv3=月次試算表あり"
                    >
                      根拠Lv
                    </th>
                  )}
                  <SortableTh
                    label="旧SPS"
                    sortKey="sps"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh label="M" sortKey="m" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="P" sortKey="p" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="R" sortKey="r" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="S" sortKey="s" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">TRL</th>
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">BRL</th>
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">GRL</th>
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">SRL</th>
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">HRL</th>
                  <th className="min-w-[140px] border-b border-slate-200 px-3 py-2">事業化タイプ</th>
                  <th className="min-w-[160px] border-b border-slate-200 px-3 py-2">用途</th>
                  <th className="min-w-[160px] border-b border-slate-200 px-3 py-2">最初の顧客</th>
                  <th className="min-w-[160px] border-b border-slate-200 px-3 py-2">市場/確度</th>
                  <th className="min-w-[180px] border-b border-slate-200 px-3 py-2">ネック</th>
                  <th className="min-w-[140px] border-b border-slate-200 px-3 py-2">知財</th>
                  <th className="min-w-[180px] border-b border-slate-200 px-3 py-2">次の検証</th>
                  <th className="min-w-[70px] border-b border-slate-200 px-3 py-2">資料</th>
                </tr>
              </thead>
              <tbody>
                {flatSeeds.map((seed) => (
                  <SeedRow
                    key={seed.id}
                    seed={seed}
                    onOpen={() => setSelected(seed)}
                    screeningBand={scope === "all" ? (bandsBySeedId.get(seed.id) ?? null) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <KuteSeedDetailModal open={selected != null} seed={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-slate-600">
      <span className="font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th className="min-w-[64px] border-b border-slate-200 px-2 py-2">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`${SORT_LABEL[sortKey]}で並び替え`}
        className={`inline-flex items-center gap-1 font-semibold ${active ? "text-sky-700" : "text-slate-500 hover:text-slate-800"}`}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden="true" />
      </button>
    </th>
  );
}

function Cell({ value, widthClass = "max-w-[160px]" }: { value: string | null; widthClass?: string }) {
  return (
    <td className="border-b border-slate-100 px-3 py-2 align-top">
      <span className={`block whitespace-normal break-words leading-relaxed ${widthClass} ${value ? "text-slate-700" : "text-slate-400"}`}>
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

const EVIDENCE_LEVEL_BADGE_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: "border-slate-300 bg-slate-50 text-slate-500",
  1: "border-sky-300 bg-sky-50 text-sky-700",
  2: "border-amber-300 bg-amber-50 text-amber-800",
  3: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

/** 根拠Lv (スコア成熟度) バッジ。§6 確定13: 判定はDBから機械導出、上位が勝つ。 */
function EvidenceLevelBadge({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <span
      title={SEED_EVIDENCE_LEVEL_DESCRIPTION[level]}
      className={`inline-flex border px-1.5 py-0.5 text-[10px] font-bold ${EVIDENCE_LEVEL_BADGE_CLASS[level]}`}
    >
      {SEED_EVIDENCE_LEVEL_LABEL[level]}
    </span>
  );
}

function SeedRow({
  seed,
  onOpen,
  screeningBand,
}: {
  seed: SeedPublicView;
  onOpen: () => void;
  /** scope="all" のときだけ渡す。undefined なら列自体を出さない (他 scope の挙動は変えない)。 */
  screeningBand?: SeedScreeningBandSummary | null;
}) {
  const sps = seed.latest_sps;
  const axes = sps?.axes;
  const confidenceLabel = sps?.confidence ? SEED_KUTE_MARKET_CONFIDENCE_LABEL[sps.confidence] ?? sps.confidence : null;
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

  return (
    <tr
      onClick={onOpen}
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
      <td className={`sticky left-0 z-10 w-[160px] min-w-[160px] max-w-[160px] border-b border-r px-3 py-2 align-top group-hover:bg-sky-50/60 group-focus-visible:bg-sky-50/60 sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px] ${realized ? "border-indigo-200 bg-indigo-50" : considering ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
        <div className="whitespace-normal break-words font-semibold leading-snug text-slate-950">
          {seed.title}
        </div>
        {seed.status !== "candidate" && (
          <span className="mt-1.5 inline-flex border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            シーズ状態: {SEED_STATUS_LABEL[seed.status] ?? seed.status}
          </span>
        )}
        {seed.discovery_status === "discovered" && (
          <span className="mt-1.5 inline-flex whitespace-normal rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-800">
            公開情報候補
          </span>
        )}
      </td>
      <Cell value={seed.org_name} widthClass="max-w-[140px]" />
      <Cell
        value={seed.researcher_name
          ? `${seed.researcher_name}${seed.researcher_title ? ` / ${seed.researcher_title}` : ""}`
          : null}
        widthClass="max-w-[130px]"
      />
      <td className="border-b border-slate-100 px-3 py-2 align-top">
        <span className={`inline-flex border px-1.5 py-0.5 text-[10px] font-bold ${realized ? "border-indigo-300 bg-indigo-100 text-indigo-900" : considering ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          {realized ? "PJ化済み" : considering ? "PJ化検討中" : "未PJ化"}
        </span>
        {projectLink && (
          <span className="mt-1 block max-w-[150px] whitespace-normal break-words text-[10px] leading-relaxed text-slate-600">
            {projectLink.project_name} · {projectLink.project_status}
          </span>
        )}
      </td>
      {screeningBand !== undefined && (
        <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
          {screeningBand && (screeningBand.sps_lower_yen != null || screeningBand.sps_upper_yen != null) ? (
            <span className="text-slate-800">
              {formatOkuYen(screeningBand.sps_lower_yen)}〜{formatOkuYen(screeningBand.sps_upper_yen)}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
      )}
      {screeningBand !== undefined && (
        <td className="border-b border-slate-100 px-2 py-2 align-top">
          <EvidenceLevelBadge level={screeningBand?.evidence_level ?? 0} />
        </td>
      )}
      <td className="border-b border-slate-100 px-3 py-2 align-top">
        {sps?.status === "ready" ? (
          <div>
            <span className="font-mono font-semibold text-slate-950">{sps.score?.toFixed(2)}</span>
            {confidenceLabel && <span className="ml-1 text-[10px] text-slate-400">確度:{confidenceLabel}</span>}
          </div>
        ) : (
          <span className="text-slate-400" title={sps ? `未評価 (欠損: ${sps.missing_axes.join(", ")})` : "評価なし"}>
            未評価
          </span>
        )}
      </td>
      <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
        {sps?.components ? sps.components.macro.toFixed(2) : <span className="text-slate-400">—</span>}
      </td>
      <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
        {sps?.components ? sps.components.potential.toFixed(2) : <span className="text-slate-400">—</span>}
      </td>
      <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
        {sps?.components ? sps.components.reach.toFixed(2) : <span className="text-slate-400">—</span>}
      </td>
      <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
        {sps?.components ? sps.components.survival.toFixed(2) : <span className="text-slate-400">—</span>}
      </td>
      <AxisCell value={axes?.trl} />
      <AxisCell value={axes?.brl} />
      <AxisCell value={axes?.grl} />
      <AxisCell value={axes?.srl} />
      <AxisCell value={axes?.hrl} />
      <td className="border-b border-slate-100 px-3 py-2 align-top">
        {commercializationTypes.length > 0 ? (
          <div className="flex max-w-[140px] flex-wrap gap-1">
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
      <Cell value={seed.biggest_bottleneck} widthClass="max-w-[180px]" />
      <Cell value={seed.ip_status} />
      <Cell value={seed.next_verification_step} widthClass="max-w-[180px]" />
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
