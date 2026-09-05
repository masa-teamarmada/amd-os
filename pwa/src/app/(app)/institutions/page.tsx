"use client";

/**
 * /institutions — 契約有無に依存しない研究機関カタログ。
 * ECR比較は同じ正本データの別表示とし、一覧の主役にはしない。
 * SU関連規程と支援プログラム比較は同じ institutions マスタを行にするので、機関を足せば両方に出る。
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Building2, Search } from "lucide-react";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import {
  computeErs,
  INSTITUTION_TYPE_LABEL,
  type ErsInstitution,
} from "@/lib/ers";
import {
  institutionProjectLifecycle,
  projectLifecyclePriority,
  selectPrimaryInstitutionProject,
  type InstitutionProjectLink,
  type ProjectLifecycle,
} from "@/lib/institution-projects";
import { RegulationMatrix } from "@/components/institutions/InstitutionRegulations";
import { SupportProgramMatrix } from "@/components/institutions/InstitutionSupportPrograms";
import { SupportProgramAnalysis } from "@/components/institutions/InstitutionSupportAnalysis";
import { prefetchInstitutionSupportPrograms } from "@/lib/institution-support-programs-client";

type ViewMode = "catalog" | "regulations" | "support" | "analysis" | "ecr";

/** ヒートマップ用 単色 (indigo) 濃淡。score 0..1、高いほど濃い。null=未評価グレー。 */
function heatCell(score: number | null): { background: string; color: string } {
  if (score == null) return { background: "#f4f4f5", color: "#71717a" };
  const s = Math.max(0, Math.min(1, score));
  const lightness = 93 - s * 61;
  return {
    background: `hsl(243 58% ${lightness}%)`,
    color: lightness < 62 ? "rgba(255,255,255,0.96)" : "hsl(243 45% 30%)",
  };
}

export default function InstitutionsPage() {
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("catalog");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchErsBundle()
      .then(setBundle)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "研究機関を読み込めなかった",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    if (!bundle) return [];
    return bundle.institutions.map((institution) => {
      const assessments =
        bundle.assessmentsByInstitution[institution.institutionId] ?? [];
      const projectLink = selectPrimaryInstitutionProject(
        bundle.institutionProjectsByInstitution[institution.institutionId],
      );
      return {
        institution,
        projectLink,
        lifecycle: institutionProjectLifecycle(
          projectLink,
          institution.contractStatus,
        ),
        result: computeErs(bundle.axes, bundle.criteria, assessments),
        latestEvaluatedAt:
          assessments
            .map((assessment) => assessment.evaluatedAt)
            .sort()
            .at(-1) ?? null,
        seedCount:
          bundle.seedCountByInstitution[institution.institutionId] ?? 0,
      };
    });
  }, [bundle]);

  const catalogRows = useMemo(() => {
    const normalizedQuery = query
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("ja");
    return results
      .filter(({ institution, projectLink }) => {
        if (!normalizedQuery) return true;
        return [
          institution.name,
          institution.shortName,
          institution.region,
          projectLink?.projectLabel,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .normalize("NFKC")
              .toLocaleLowerCase("ja")
              .includes(normalizedQuery),
          );
      })
      .sort((a, b) => {
        const relationPriority =
          projectLifecyclePriority(a.lifecycle) -
          projectLifecyclePriority(b.lifecycle);
        return (
          relationPriority ||
          a.institution.name.localeCompare(b.institution.name, "ja")
        );
      });
  }, [results, query]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (error || !bundle) {
    return (
      <div className="p-6 text-sm text-amber-800">
        {error || "研究機関を読み込めなかった"}
      </div>
    );
  }

  const realizedProjectCount = results.filter(
    ({ lifecycle }) => lifecycle === "realized",
  ).length;
  const consideringProjectCount = results.filter(
    ({ lifecycle }) => lifecycle === "considering",
  ).length;
  const linkedSeedCount = Object.values(bundle.seedCountByInstitution).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
      <header className="space-y-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-indigo-700">
              研究機関カタログ
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">研究機関</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
              AMDとの契約有無に関係なく蓄積する正本一覧。契約した機関には、同じ行へPJ運用レイヤーを重ねる。
            </p>
          </div>
          <Link
            href="/institutions/assess"
            className="inline-flex min-h-10 items-center rounded-md border border-indigo-300 bg-indigo-50 px-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
          >
            ECR評価を入力・編集
          </Link>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 py-3 sm:max-w-3xl sm:grid-cols-4 sm:divide-y-0">
          <SummaryMetric
            label="研究機関"
            value={`${bundle.institutions.length}機関`}
          />
          <SummaryMetric
            label="PJ化済み"
            value={`${realizedProjectCount}機関`}
          />
          <SummaryMetric
            label="PJ化検討中"
            value={`${consideringProjectCount}機関`}
          />
          <SummaryMetric label="所属シーズ" value={`${linkedSeedCount}件`} />
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-grid grid-cols-5 rounded-md border border-slate-300 bg-slate-100 p-0.5"
            role="tablist"
            aria-label="研究機関の表示切り替え"
          >
            <ViewButton
              active={viewMode === "catalog"}
              onClick={() => setViewMode("catalog")}
            >
              一覧
            </ViewButton>
            <ViewButton
              active={viewMode === "regulations"}
              onClick={() => setViewMode("regulations")}
            >
              SU関連規程
            </ViewButton>
            <ViewButton
              active={viewMode === "support"}
              onClick={() => setViewMode("support")}
              onPrefetch={prefetchInstitutionSupportPrograms}
            >
              支援プログラム比較
            </ViewButton>
            <ViewButton
              active={viewMode === "analysis"}
              onClick={() => setViewMode("analysis")}
              onPrefetch={prefetchInstitutionSupportPrograms}
            >
              分析
            </ViewButton>
            <ViewButton
              active={viewMode === "ecr"}
              onClick={() => setViewMode("ecr")}
            >
              ECR比較
            </ViewButton>
          </div>
          {viewMode !== "ecr" && viewMode !== "analysis" && (
            <label className="relative block w-full sm:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <span className="sr-only">研究機関を検索</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="機関名・地域・PJ名で検索"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </label>
          )}
        </div>
      </header>

      {viewMode === "catalog" ? (
        <InstitutionCatalog rows={catalogRows} />
      ) : viewMode === "regulations" ? (
        <RegulationMatrix institutions={bundle.institutions} query={query} />
      ) : viewMode === "support" ? (
        <SupportProgramMatrix institutions={bundle.institutions} query={query} />
      ) : viewMode === "analysis" ? (
        <SupportProgramAnalysis institutions={bundle.institutions} />
      ) : (
        <EcrComparison bundle={bundle} results={results} />
      )}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0">
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  onPrefetch,
  children,
}: {
  active: boolean;
  onClick: () => void;
  /** タブを開く前に裏でデータを温める (参照系タブの hover / focus 先読み)。 */
  onPrefetch?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={`min-h-9 rounded px-4 text-xs font-semibold ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
    >
      {children}
    </button>
  );
}

function InstitutionCatalog({
  rows,
}: {
  rows: Array<{
    institution: ErsInstitution;
    projectLink: InstitutionProjectLink | null;
    lifecycle: ProjectLifecycle;
    result: ReturnType<typeof computeErs>;
    seedCount: number;
  }>;
}) {
  if (!rows.length) {
    return (
      <div className="border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        条件に合う研究機関がない
      </div>
    );
  }
  return (
    <div className="overflow-hidden border border-slate-200 bg-white">
      <div className="hidden grid-cols-[minmax(240px,1.5fr)_140px_120px_120px_minmax(220px,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold text-slate-500 lg:grid">
        <span>研究機関</span>
        <span>種別・地域</span>
        <span>所属シーズ</span>
        <span>ECR</span>
        <span>AMD PJ</span>
      </div>
      <div className="divide-y divide-slate-200">
        {rows.map(
          ({ institution, projectLink, lifecycle, result, seedCount }) => {
            const realized = lifecycle === "realized";
            const considering = lifecycle === "considering";
            return (
              <Link
                key={institution.institutionId}
                href={
                  projectLink
                    ? `/institutions/${institution.institutionId}/cockpit`
                    : `/institutions/${institution.institutionId}`
                }
                className={`group relative block px-4 py-4 transition-colors hover:bg-slate-50 ${realized ? "bg-indigo-50/35" : considering ? "bg-amber-50/35" : "bg-white"}`}
              >
                {lifecycle !== "none" && (
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${realized ? "bg-indigo-600" : "bg-amber-500"}`}
                    aria-hidden="true"
                  />
                )}
                <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.5fr)_140px_120px_120px_minmax(220px,1fr)] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2
                        className="h-4 w-4 text-slate-400"
                        aria-hidden="true"
                      />
                      <h2 className="font-semibold text-slate-950 group-hover:text-indigo-800">
                        {institution.name}
                      </h2>
                      {institution.identityStatus === "candidate" && (
                        <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          名称未確認
                        </span>
                      )}
                      {(institution.contractStatus === "active" ||
                        institution.contractStatus === "past") &&
                        !projectLink && (
                          <span className="border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            PJ紐付け要確認
                          </span>
                        )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    {INSTITUTION_TYPE_LABEL[institution.type] ??
                      institution.type}
                    {institution.region ? (
                      <span className="block text-slate-400">
                        {institution.region}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-800">
                    {seedCount}件
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-800">
                    {result.ers != null
                      ? `${Math.round(result.ers)}%`
                      : "未評価"}
                    <span className="block text-[10px] font-normal text-slate-400">
                      {result.assessedCriteria}/{result.totalCriteria}項目
                    </span>
                  </p>
                  {lifecycle !== "none" ? (
                    <div
                      className={`border-l-2 pl-3 ${realized ? "border-indigo-400" : "border-amber-400"}`}
                    >
                      <p
                        className={`flex items-center gap-1.5 text-[10px] font-semibold ${realized ? "text-indigo-700" : "text-amber-800"}`}
                      >
                        <BriefcaseBusiness
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {realized ? "PJ化済み" : "PJ化検討中"}
                      </p>
                      {projectLink ? (
                        <>
                          <p className="mt-0.5 text-sm font-semibold text-slate-950">
                            {projectLink.projectLabel}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {projectLink.relationLabel} ·{" "}
                            {projectLink.projectStatus}
                          </p>
                        </>
                      ) : (
                        <p className="mt-0.5 text-xs font-medium text-amber-800">
                          関連PJの紐付け要確認
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">未PJ化</p>
                  )}
                </div>
              </Link>
            );
          },
        )}
      </div>
    </div>
  );
}

type EvaluatedRow = {
  institution: ErsInstitution;
  projectLink: InstitutionProjectLink | null;
  lifecycle: ProjectLifecycle;
  result: ReturnType<typeof computeErs>;
  latestEvaluatedAt: string | null;
};

function lifecycleLabel(lifecycle: ProjectLifecycle): string {
  return lifecycle === "realized"
    ? "PJ化済み"
    : lifecycle === "considering"
      ? "PJ化検討中"
      : "未PJ化";
}

function lifecycleTextClass(lifecycle: ProjectLifecycle): string {
  return lifecycle === "realized"
    ? "text-indigo-700"
    : lifecycle === "considering"
      ? "text-amber-800"
      : "text-slate-400";
}

function EcrComparison({
  bundle,
  results,
}: {
  bundle: ErsBundle;
  results: Array<{
    institution: ErsInstitution;
    projectLink: InstitutionProjectLink | null;
    lifecycle: ProjectLifecycle;
    result: ReturnType<typeof computeErs>;
    latestEvaluatedAt: string | null;
  }>;
}) {
  const evaluated = results
    .filter(({ result }) => result.ers != null)
    .sort((a, b) => {
      const lifecycle =
        projectLifecyclePriority(a.lifecycle) -
        projectLifecyclePriority(b.lifecycle);
      return (
        lifecycle || a.institution.name.localeCompare(b.institution.name, "ja")
      );
    });
  const sortedAxes = [...bundle.axes].sort((a, b) => a.sortOrder - b.sortOrder);
  const [target1, setTarget1] = useState<string>("");
  const [target2, setTarget2] = useState<string>("");

  useEffect(() => {
    if (!evaluated.some((row) => row.institution.institutionId === target1)) {
      setTarget1(evaluated[0]?.institution.institutionId ?? "");
    }
    if (
      target2 &&
      !evaluated.some((row) => row.institution.institutionId === target2)
    ) {
      setTarget2("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluated.map((row) => row.institution.institutionId).join(",")]);

  if (!evaluated.length) {
    return (
      <div className="border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        ECR評価済みの研究機関がない
      </div>
    );
  }

  const mobileColumns = [target1, target2]
    .filter(Boolean)
    .map((id) => evaluated.find((row) => row.institution.institutionId === id))
    .filter((row): row is EvaluatedRow => Boolean(row));

  return (
    <section className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600">
        ECRは研究機関の環境だけを比較する。シーズのSPSやPJのスコアとは合算しない。未評価機関は比較表から外し、一覧には残す。
      </p>

      {/* desktop/tablet: 全機関を横スクロールで比較 */}
      <div className="hidden overflow-hidden border border-slate-200 sm:block">
        <div className="max-h-[80vh] overflow-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[168px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium">
                  評価軸
                </th>
                {evaluated.map(
                  ({ institution, lifecycle, result, latestEvaluatedAt }) => (
                    <th
                      key={institution.institutionId}
                      className="sticky top-0 z-20 min-w-[150px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium"
                    >
                      <Link
                        href={`/institutions/${institution.institutionId}`}
                        className="block truncate font-semibold text-slate-950 hover:text-indigo-800 hover:underline"
                      >
                        {institution.name}
                      </Link>
                      <span
                        className={`mt-0.5 block text-[10px] font-semibold ${lifecycleTextClass(lifecycle)}`}
                      >
                        {lifecycleLabel(lifecycle)}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                        {latestEvaluatedAt ?? "日付未登録"} ·{" "}
                        {result.assessedCriteria}/{result.totalCriteria}項目
                      </span>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-800">
                  総合 ECR
                </th>
                {evaluated.map(({ institution, result }) => (
                  <td
                    key={institution.institutionId}
                    className="border-b border-r border-slate-200 px-3 py-3 text-center font-mono text-xl font-extrabold"
                    style={heatCell((result.ers ?? 0) / 100)}
                  >
                    {Math.round(result.ers ?? 0)}%
                  </td>
                ))}
              </tr>
              {sortedAxes.map((axis) => (
                <tr key={axis.axisId}>
                  <th
                    title={axis.name}
                    className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-3 text-left font-normal"
                  >
                    <span className="block font-mono text-[10px] text-slate-400">
                      A{axis.axisNo}
                    </span>
                    <span className="block truncate font-medium text-slate-700">
                      {axis.name}
                    </span>
                  </th>
                  {evaluated.map(({ institution, result }) => {
                    const axisResult = result.axisScores.find(
                      (score) => score.axisId === axis.axisId,
                    );
                    return (
                      <td
                        key={institution.institutionId}
                        className="border-b border-r border-slate-200 px-3 py-3 text-center font-mono text-sm"
                        style={heatCell(axisResult?.score ?? null)}
                      >
                        {axisResult?.score != null
                          ? `${Math.round(axisResult.score * 100)}%`
                          : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile: 評価済み機関から最大2件を選んで比較 */}
      <div className="space-y-3 sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold text-slate-500">
              比較対象1
            </span>
            <select
              value={target1}
              onChange={(event) => {
                const value = event.target.value;
                setTarget1(value);
                if (value && value === target2) setTarget2("");
              }}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {evaluated.map(({ institution }) => (
                <option
                  key={institution.institutionId}
                  value={institution.institutionId}
                >
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold text-slate-500">
              比較対象2（任意）
            </span>
            <select
              value={target2}
              onChange={(event) => setTarget2(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <option value="">未選択</option>
              {evaluated
                .filter(
                  ({ institution }) => institution.institutionId !== target1,
                )
                .map(({ institution }) => (
                  <option
                    key={institution.institutionId}
                    value={institution.institutionId}
                  >
                    {institution.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {mobileColumns.length === 0 ? (
          <div className="border border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
            比較対象を選ぶとECRを表示する
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-200">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-[30%] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-left font-medium">
                    評価軸
                  </th>
                  {mobileColumns.map(
                    ({ institution, lifecycle, result, latestEvaluatedAt }) => (
                      <th
                        key={institution.institutionId}
                        className="border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-left font-medium last:border-r-0"
                      >
                        <Link
                          href={`/institutions/${institution.institutionId}`}
                          className="block truncate font-semibold text-slate-950 hover:text-indigo-800 hover:underline"
                        >
                          {institution.name}
                        </Link>
                        <span
                          className={`mt-0.5 block text-[10px] font-semibold ${lifecycleTextClass(lifecycle)}`}
                        >
                          {lifecycleLabel(lifecycle)}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-normal text-slate-400">
                          {latestEvaluatedAt ?? "日付未登録"} ·{" "}
                          {result.assessedCriteria}/{result.totalCriteria}項目
                        </span>
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left font-semibold text-slate-800">
                    総合 ECR
                  </th>
                  {mobileColumns.map(({ institution, result }) => (
                    <td
                      key={institution.institutionId}
                      className="border-b border-r border-slate-200 px-2 py-3 text-center font-mono text-lg font-extrabold last:border-r-0"
                      style={heatCell((result.ers ?? 0) / 100)}
                    >
                      {Math.round(result.ers ?? 0)}%
                    </td>
                  ))}
                </tr>
                {sortedAxes.map((axis) => (
                  <tr key={axis.axisId}>
                    <th
                      title={axis.name}
                      className="border-b border-r border-slate-200 bg-white px-2 py-3 text-left font-normal"
                    >
                      <span className="block font-mono text-[10px] text-slate-400">
                        A{axis.axisNo}
                      </span>
                      <span className="block truncate font-medium text-slate-700">
                        {axis.name}
                      </span>
                    </th>
                    {mobileColumns.map(({ institution, result }) => {
                      const axisResult = result.axisScores.find(
                        (score) => score.axisId === axis.axisId,
                      );
                      return (
                        <td
                          key={institution.institutionId}
                          className="border-b border-r border-slate-200 px-2 py-3 text-center font-mono text-xs last:border-r-0"
                          style={heatCell(axisResult?.score ?? null)}
                        >
                          {axisResult?.score != null
                            ? `${Math.round(axisResult.score * 100)}%`
                            : "–"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
