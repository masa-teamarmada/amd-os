"use client";

import { useEffect, useMemo, useState } from "react";
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
  Loader2,
  Plus,
  Recycle,
  RotateCcw,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { KuteSeedDetailModal } from "@/components/seeds/KuteSeedDetailModal";
import { SeedDetailModal } from "@/components/seeds/SeedDetailModal";
import {
  fetchResearchInstitutionSeedsForProject,
  fetchInstitutionIdForProject,
  fetchAllResearchInstitutionSeeds,
  SEED_DOMAIN_LANE_LABEL,
  SEED_COMMERCIALIZATION_TYPE_LABEL,
  SEED_KUTE_MARKET_CONFIDENCE_LABEL,
  SEED_EVIDENCE_LEVEL_LABEL,
  SEED_EVIDENCE_LEVEL_DESCRIPTION,
  formatOkuYen,
  seedScreeningBandMedianYen,
  compareSeedSortValues,
  countDistinctResearchers,
  countDistinctInstitutions,
  seedProjectLifecycle,
  seedProjectPriority,
  seedListPriority,
} from "@/lib/seeds-data";
import { projectStatusLifecycle } from "@/lib/institution-projects";
import {
  loadSeedScreeningBandSummaries,
  prefetchSeedScreeningBandDetail,
} from "@/lib/seed-screening-bands-client";
import { prefetchBzm30Model } from "@/lib/bzm30-model-client";
import { prefetchSeedBzm30 } from "@/lib/bzm30-seed-client";
import type { SeedDomainLane, SeedPublicView, SeedScreeningBandSummary } from "@/types/seeds";

type SortKey = "spsBand";
type StatusFilter = "all" | "assessed" | "unassessed";

const SORT_LABEL: Record<SortKey, string> = {
  spsBand: "SPS(中央値)",
};

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
 * SPS列の列ソート値 = 帯の中央値 (下限+上限)/2。仮置き実装 (まさ裁定 2026-08-15:
 * 「帯にしちゃってるからソーティングがきかない。一旦仮置きで中央値をSPSとして」「中央値でソーティング」)。
 * 帯が無い、または上限・下限どちらかが欠けているシーズは常に末尾。
 */
function screeningBandSortValue(
  seed: SeedPublicView,
  bandsBySeedId: Map<string, SeedScreeningBandSummary>,
): number | null {
  const band = bandsBySeedId.get(seed.id);
  if (!band) return null;
  return seedScreeningBandMedianYen(band.sps_lower_yen, band.sps_upper_yen);
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
  const [seeds, setSeeds] = useState<SeedPublicView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SeedPublicView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("spsBand");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // 全scope共通: 現行SPSの完全一致・凍結評価だけをAPIから読む。
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

  // 帯は参照系。lib/seed-screening-bands-client.ts のキャッシュを通し、
  // 一覧 → 詳細 → 一覧 と行き来しても読み直さない。
  useEffect(() => {
    let cancelled = false;
    loadSeedScreeningBandSummaries({ force: requestKey > 0 })
      .then((bands) => {
        if (!cancelled) setBandsBySeedId(bands);
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
  const scoredCount = scopedSeeds.filter((seed) => bandsBySeedId.get(seed.id)?.assessment_id).length;
  const researcherCount = countDistinctResearchers(scopedSeeds);
  const institutionCount = countDistinctInstitutions(scopedSeeds);
  const realizedProjectSeedCount = scopedSeeds.filter((seed) => seedProjectPriority(seed) === 0).length;
  const consideringProjectSeedCount = scopedSeeds.filter((seed) => seedProjectPriority(seed) === 1).length;
  const unrealizedScoredSeedCount = scopedSeeds.filter((seed) => seedListPriority(seed) === 2).length;

  const filteredSeeds = useMemo(() => {
    return scopedSeeds.filter((seed) => {
      const evaluationStatus = bandsBySeedId.get(seed.id)?.assessment_id ? "assessed" : "unassessed";
      if (statusFilter !== "all" && evaluationStatus !== statusFilter) return false;
      return true;
    });
  }, [bandsBySeedId, scopedSeeds, statusFilter]);

  const dir = sortDir === "asc" ? 1 : -1;

  const flatSeeds = useMemo(() => {
    return [...filteredSeeds].sort((a, b) => {
      // SPS(スクリーニング帯)ソート時はPJ優先4段を外してリスト全体をフラットに並べる
      // (まさ裁定 2026-08-15「全然ソーティングされない」への対応。他キーは従来どおり区分内ソート)
      const byScore = compareSeedSortValues(
        screeningBandSortValue(a, bandsBySeedId),
        screeningBandSortValue(b, bandsBySeedId),
        dir,
      );
      return byScore || a.title.localeCompare(b.title, "ja");
    });
  }, [filteredSeeds, dir, bandsBySeedId]);

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
              ・研究者{researcherCount}名・資料{materialCount}件
              {`・現行SPS評価済み${scoredCount}件`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-3">
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

      {seeds && seeds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
          <FilterSelect
            label="評価状態"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: "all", label: "すべて" },
              { value: "assessed", label: "評価済み" },
              { value: "unassessed", label: "最新版未評価" },
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
            <table className="w-full min-w-[1500px] border-collapse text-[12px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100 text-left text-[10px] font-semibold uppercase text-slate-500">
                  <th className="sticky left-0 z-30 w-[160px] min-w-[160px] max-w-[160px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px]">
                    シーズ
                  </th>
                  <th className="min-w-[180px] border-b border-slate-200 px-3 py-2">会社名</th>
                  <th className="min-w-[140px] border-b border-slate-200 px-3 py-2">研究機関</th>
                  <th className="min-w-[130px] border-b border-slate-200 px-3 py-2">研究者 / PI</th>
                  <SortableTh label="現行SPS(億円)" sortKey="spsBand" activeKey={sortKey} dir={sortDir} onSort={toggleSort} hint="sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1。完全一致した凍結評価のみ" widthClass="min-w-[190px]" />
                  <th className="min-w-[70px] border-b border-slate-200 px-2 py-2">根拠Lv</th>
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">TRL</th>
                  <th className="min-w-[52px] border-b border-slate-200 px-2 py-2">BRL</th>
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
                    screeningBand={bandsBySeedId.get(seed.id) ?? null}
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
  hint,
  widthClass,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  /** タイトルツールチップへ追記する補足説明 (省略可) */
  hint?: string;
  /** 列幅の上書き (省略時は従来の min-w-[64px]) */
  widthClass?: string;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th className={`${widthClass ?? "min-w-[64px]"} border-b border-slate-200 px-2 py-2`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={hint ? `${SORT_LABEL[sortKey]}で並び替え。${hint}` : `${SORT_LABEL[sortKey]}で並び替え`}
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
  screeningBand: SeedScreeningBandSummary | null;
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

  return (
    <tr
      onClick={onOpen}
      // クリックより先に詳細帯を温める。マウスが行に乗ってからクリックが届くまでの
      // 数百ミリ秒で取得が終わるので、モーダルは開いた時点で帯を持っている。
      // BZM 3.0 のモデル定義は全シーズ共通なので、最初の hover の1回だけ取りに行く。
      onMouseEnter={() => { prefetchSeedScreeningBandDetail(seed.id); prefetchBzm30Model(); prefetchSeedBzm30(seed.id); }}
      onFocus={() => { prefetchSeedScreeningBandDetail(seed.id); prefetchBzm30Model(); prefetchSeedBzm30(seed.id); }}
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
        <span className={`block max-w-[156px] whitespace-normal break-words pr-7 text-[13px] font-bold leading-snug ${companyName ? "text-slate-950" : "text-slate-400"}`}>
          {companyLabel}
        </span>
        {projectLink && (
          <span
            title={`紐付くPJ: ${projectLink.project_name}`}
            className="absolute right-2 top-2 inline-flex items-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm"
          >
            PJ
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
      <td className="border-b border-slate-100 px-3 py-2 align-top font-mono">
          {screeningBand && (screeningBand.sps_lower_yen != null || screeningBand.sps_upper_yen != null) ? (
            <span className="whitespace-nowrap">
              <span className="font-semibold text-slate-950">
                {formatOkuYen(seedScreeningBandMedianYen(screeningBand.sps_lower_yen, screeningBand.sps_upper_yen))}
              </span>
              <span className="ml-1 text-[10px] text-slate-500">
                ({formatOkuYen(screeningBand.sps_lower_yen)}〜{formatOkuYen(screeningBand.sps_upper_yen)})
              </span>
            </span>
          ) : (
            <span className="text-amber-700">最新版未評価</span>
          )}
      </td>
      <td className="border-b border-slate-100 px-2 py-2 align-top">
          <EvidenceLevelBadge level={screeningBand?.evidence_level ?? 0} />
      </td>
      <AxisCell value={seed.trl} />
      <AxisCell value={seed.brl} />
      <AxisCell value={seed.hrl} />
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
