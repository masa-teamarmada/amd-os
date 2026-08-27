"use client";

/**
 * PortfolioPulse — /dashboard ホーム上段の研究ポートフォリオ優先キュー。
 *
 * 研究機関・シーズをOSの主たる母集団、PJを契約成立後の運用レイヤーとして扱う新IA
 * (旧 /portfolio-preview を2026-08-02にホームへ正式採用)。研究機関・シーズの全件は
 * 出さず (`/institutions` / `/seeds` が正本一覧)、今日判断・着手できる上位候補だけを
 * 密度高く並べる。ECR (研究機関環境) と SPS (個別シーズ) は別集計のまま合算しない。
 * 2026-08-27: パネルは2枚 (研究機関PJ / シーズPJ)。稼働中PJの再掲は、すぐ下のPJ一覧と
 * 統計stripの「PJ運用」セルに同じものが出ていて三重になっていたので外した。
 * 旧コメント: PJは3番目 — 研究機関・シーズという母集団を先に見せ、PJは契約成立後の運用レイヤーとして
 * その下に置く (2026-08-02 まさ追加監査反映)。
 *
 * データは server-side service client 経由の /api/dashboard/portfolio-pulse から取る。
 * migration 213 で anon/default browser client の institutions/seeds read が閉じているため、
 * default client を直接叩かない。ECRとシーズは個別に成否を扱い、片方の障害でもう片方まで
 * 消さない (障害分離)。
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Building2, Sprout, type LucideIcon } from "lucide-react";
import type { ErsBundle } from "@/lib/ers-data";
import { seedProjectLifecycle } from "@/lib/kute-seeds-scoring";
import {
  buildPortfolioPulseModel,
  type PortfolioPulseModel,
} from "@/lib/portfolio-pulse";
import type { DashProject } from "@/lib/supabase-data";
import type { SeedPublicView, SeedScreeningBandSummary } from "@/types/seeds";

const EMPTY_ERS_BUNDLE: ErsBundle = {
  institutions: [],
  axes: [],
  criteria: [],
  assessmentsByInstitution: {},
  assessmentHistoryByInstitution: {},
  institutionProjectsByInstitution: {},
  seedCountByInstitution: {},
  institutionProjectIds: [],
};

type PulseApiResponse = {
  ok: boolean;
  institutionBundle: ErsBundle | null;
  institutionError: boolean;
  seeds: SeedPublicView[] | null;
  seedsError: boolean;
  screeningBands: SeedScreeningBandSummary[] | null;
  screeningBandsError: boolean;
};

type FetchState = {
  status: "loading" | "ready" | "error";
  institutionBundle: ErsBundle | null;
  institutionError: boolean;
  seeds: SeedPublicView[] | null;
  seedsError: boolean;
  screeningBands: SeedScreeningBandSummary[] | null;
  screeningBandsError: boolean;
};

export function PortfolioPulse({ projects }: { projects: DashProject[] }) {
  const [state, setState] = useState<FetchState>({
    status: "loading",
    institutionBundle: null,
    institutionError: false,
    seeds: null,
    seedsError: false,
    screeningBands: null,
    screeningBandsError: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/portfolio-pulse", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<PulseApiResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((json) => {
        if (cancelled) return;
        setState({
          status: "ready",
          institutionBundle: json.institutionBundle,
          institutionError: json.institutionError,
          seeds: json.seeds,
          seedsError: json.seedsError,
          screeningBands: json.screeningBands,
          screeningBandsError: json.screeningBandsError,
        });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, status: "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo<PortfolioPulseModel | null>(() => {
    if (state.status !== "ready") return null;
    return buildPortfolioPulseModel({
      institutionBundle: state.institutionBundle ?? EMPTY_ERS_BUNDLE,
      seeds: state.seeds ?? [],
      screeningBands: state.screeningBands ?? [],
      projects,
    });
  }, [state, projects]);

  if (state.status === "error") {
    return (
      <section className="dashboard-desk-section px-3 py-3 text-[13px] text-[var(--desk-muted)]">
        PJポートフォリオを読み込めなかった。再読み込みしてね。
      </section>
    );
  }

  if (state.status === "loading" || !model) {
    return (
      <section className="dashboard-desk-section px-3 py-4 text-center text-[13px] text-[var(--desk-muted)]">
        PJポートフォリオを読み込み中…
      </section>
    );
  }

  const institutionCandidates = model.institutionRows.filter((row) => row.lifecycle === "considering").slice(0, 6);
  const seedConsidering = model.seedRows.filter((seed) => seedProjectLifecycle(seed) === "considering");

  return (
    <section className="dashboard-desk-section" data-testid="portfolio-pulse">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="dashboard-desk-section-title !mb-0">PJポートフォリオ — 今日動かす対象</h2>
        <p className="text-[11px] text-[var(--desk-muted)]">
          PJになる前の候補を、研究機関から来たものとシーズから来たものに分けて出す。稼働中のPJは下のPJ運用。
        </p>
      </div>

      <StatStrip model={model} />

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <QueuePanel
          title="研究機関PJ — PJ化検討中"
          count={model.counts.institutionConsidering}
          actionLabel="研究機関を開く"
          actionHref="/institutions"
          icon={Building2}
          tone="navy"
          errored={state.institutionError}
          errorLabel="研究機関を読み込めなかった"
        >
          {institutionCandidates.length ? (
            institutionCandidates.map((row) => (
              <CandidateRow
                key={row.institutionId}
                icon={Building2}
                label={row.name}
                meta={`所属シーズ ${row.seedCount}件`}
                badge="機関"
                href={
                  row.projectLink
                    ? `/institutions/${encodeURIComponent(row.institutionId)}/cockpit`
                    : `/institutions/${encodeURIComponent(row.institutionId)}`
                }
              />
            ))
          ) : (
            <EmptyQueue label="検討中の研究機関はない" />
          )}
        </QueuePanel>

        <QueuePanel
          title="シーズPJ — PJ化検討中"
          count={model.counts.seedConsidering}
          actionLabel="シーズを開く"
          actionHref="/seeds"
          icon={Sprout}
          tone="cyan"
          errored={state.seedsError}
          errorLabel="シーズを読み込めなかった"
        >
          {seedConsidering.length ? (
            seedConsidering.slice(0, 6).map((seed) => (
              <CandidateRow
                key={seed.id}
                icon={Sprout}
                label={seed.title}
                meta={`${seed.org_name} ・ ${seed.researcher_name || "PI未登録"}`}
                badge="検討中"
                href={`/seeds/${encodeURIComponent(seed.id)}`}
              />
            ))
          ) : (
            <EmptyQueue label="PJ化を検討中のシーズはない" />
          )}
        </QueuePanel>

      </div>
    </section>
  );
}

function StatStrip({ model }: { model: PortfolioPulseModel }) {
  const items: Array<{ label: string; value: number; denom?: number; href: string; warning?: boolean }> = [
    { label: "研究機関", value: model.counts.institutions, href: "/institutions" },
    { label: "ECR評価済み", value: model.counts.institutionEcrReady, denom: model.counts.institutions, href: "/institutions" },
    { label: "シーズ", value: model.counts.seeds, href: "/seeds" },
    { label: "SPS評価済み", value: model.counts.seedSpsReady, denom: model.counts.seeds, href: "/seeds" },
    { label: "PJ運用", value: model.counts.projects, href: "#pj-operations" },
    {
      label: "由来要確認PJ",
      value: model.counts.unclassifiedProjects,
      href: "#pj-operations",
      warning: model.counts.unclassifiedProjects > 0,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`rounded border px-2 py-2 transition-colors hover:bg-[var(--desk-blue-soft)] ${
            item.warning
              ? "border-[var(--desk-amber)]/40 bg-[var(--desk-amber-soft)]"
              : "border-[var(--desk-line)] bg-[var(--desk-sheet)]"
          }`}
        >
          <div className="text-[11px] font-mono uppercase text-[var(--desk-muted)]">{item.label}</div>
          <div className="text-base font-bold leading-tight text-[var(--desk-ink)]">
            {item.value.toLocaleString("ja-JP")}
            {item.denom != null ? (
              <span className="text-[11px] font-normal text-[var(--desk-muted)]"> / {item.denom}</span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

const TONE_BORDER: Record<"blue" | "navy" | "cyan", string> = {
  blue: "border-l-[var(--desk-blue)]",
  navy: "border-l-[#081b2b]",
  cyan: "border-l-[#00a6e6]",
};

function QueuePanel({
  title,
  count,
  actionLabel,
  actionHref,
  icon: Icon,
  tone,
  errored = false,
  errorLabel,
  children,
}: {
  title: string;
  count: number;
  actionLabel: string;
  actionHref: string;
  icon: LucideIcon;
  tone: "blue" | "navy" | "cyan";
  errored?: boolean;
  errorLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded border border-[var(--desk-line)] border-l-4 ${TONE_BORDER[tone]} bg-[var(--desk-sheet)] p-2`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--desk-ink)]">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {title}
          <span className="font-mono text-[11px] font-normal text-[var(--desk-muted)]">{count}</span>
        </div>
        <Link href={actionHref} className="flex items-center gap-1 text-[11px] font-medium text-[var(--desk-blue)] hover:underline">
          {actionLabel}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      {errored ? (
        <p className="mb-2 rounded border border-[var(--desk-amber)]/40 bg-[var(--desk-amber-soft)] px-2 py-1 text-[11px] text-[var(--desk-amber)]">
          {errorLabel || "読み込めなかった"}
        </p>
      ) : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CandidateRow({
  icon: Icon,
  label,
  meta,
  badge,
  href,
}: {
  icon: LucideIcon;
  label: string;
  meta: string;
  badge: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded border border-[var(--desk-line)] px-2 py-2 text-[13px] hover:bg-[var(--desk-blue-soft)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--desk-muted)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[var(--desk-ink)]">{label}</span>
        <span className="block truncate text-[11px] text-[var(--desk-muted)]">{meta}</span>
      </span>
      <span className="shrink-0 rounded border border-[var(--desk-line)] px-1 py-0.5 text-[11px] text-[var(--desk-muted)]">
        {badge}
      </span>
    </Link>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return <p className="px-1 py-2 text-[13px] text-[var(--desk-muted)]">{label}</p>;
}

