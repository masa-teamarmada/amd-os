"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  ExternalLink,
  FlaskConical,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { computeErs, INSTITUTION_TYPE_LABEL } from "@/lib/ers";
import type { ErsBundle } from "@/lib/ers-data";
import {
  institutionProjectLifecycle,
  projectLifecyclePriority,
  projectStatusLifecycle,
  selectPrimaryInstitutionProject,
  type InstitutionProjectLink,
  type ProjectLifecycle,
} from "@/lib/institution-projects";
import { seedListPriority, seedProjectLifecycle } from "@/lib/seeds-data";
import type { DashProject } from "@/lib/supabase-data";
import type { SeedPublicView } from "@/types/seeds";
import { BUILD_VERSION } from "@/lib/build-info";
import styles from "./portfolio-preview.module.css";

type PreviewView = "overview" | "institutions" | "seeds" | "projects";

export type PortfolioPreviewData = {
  institutionBundle: ErsBundle;
  seeds: SeedPublicView[];
  projects: DashProject[];
};

type InstitutionRow = {
  institutionId: string;
  name: string;
  shortName: string | null;
  type: string;
  region: string | null;
  lifecycle: ProjectLifecycle;
  projectLink: InstitutionProjectLink | null;
  seedCount: number;
  ecr: number | null;
  assessedCriteria: number;
  totalCriteria: number;
};

type ProjectOrigin = {
  kind: "institution" | "seed";
  id: string;
  label: string;
  parentLabel?: string;
  href: string;
};

type ProjectRow = {
  project: DashProject;
  origins: ProjectOrigin[];
  lifecycle: ProjectLifecycle;
  needsClassification: boolean;
};

type PreviewModel = {
  institutionRows: InstitutionRow[];
  seedRows: SeedPublicView[];
  projectRows: ProjectRow[];
  counts: {
    institutions: number;
    institutionRealized: number;
    institutionConsidering: number;
    institutionEcrReady: number;
    seeds: number;
    seedRealized: number;
    seedConsidering: number;
    seedScoredWithoutProject: number;
    seedSpsReady: number;
    projects: number;
    activeProjects: number;
    consideringProjects: number;
    unclassifiedProjects: number;
  };
};

const NAV_ITEMS: Array<{
  view: PreviewView;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    view: "overview",
    label: "ホーム",
    description: "今日動かす対象",
    icon: LayoutDashboard,
  },
  {
    view: "institutions",
    label: "研究機関",
    description: "関係を育てる母集団",
    icon: Building2,
  },
  {
    view: "seeds",
    label: "シーズ",
    description: "事業化候補の母集団",
    icon: Sprout,
  },
  {
    view: "projects",
    label: "PJ運用",
    description: "契約・実行レイヤー",
    icon: FlaskConical,
  },
];

const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "稼働中",
  sales: "PJ化検討中",
  draft: "PJ化検討中",
  ended: "終了",
  frozen: "停止中",
  advisor: "アドバイザー",
};

const LIFECYCLE_LABEL: Record<ProjectLifecycle, string> = {
  realized: "PJ化済み",
  considering: "PJ化検討中",
  none: "PJなし",
};

function normalizeQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja");
}

function includesQuery(
  values: Array<string | null | undefined>,
  query: string,
) {
  if (!query) return true;
  return values
    .filter((value): value is string => Boolean(value))
    .some((value) =>
      value.normalize("NFKC").toLocaleLowerCase("ja").includes(query),
    );
}

function projectStatusPriority(status: string) {
  if (status === "active") return 0;
  if (status === "sales" || status === "draft") return 1;
  if (status === "frozen") return 2;
  if (status === "ended") return 3;
  return 4;
}

function buildPreviewModel(data: PortfolioPreviewData): PreviewModel {
  const { institutionBundle, seeds, projects } = data;
  const institutionRows = institutionBundle.institutions
    .map((institution): InstitutionRow => {
      const projectLink = selectPrimaryInstitutionProject(
        institutionBundle.institutionProjectsByInstitution[
          institution.institutionId
        ],
      );
      const result = computeErs(
        institutionBundle.axes,
        institutionBundle.criteria,
        institutionBundle.assessmentsByInstitution[institution.institutionId] ??
          [],
      );

      return {
        institutionId: institution.institutionId,
        name: institution.name,
        shortName: institution.shortName,
        type: institution.type,
        region: institution.region,
        lifecycle: institutionProjectLifecycle(
          projectLink,
          institution.contractStatus,
        ),
        projectLink,
        seedCount:
          institutionBundle.seedCountByInstitution[institution.institutionId] ??
          0,
        ecr: result.ers,
        assessedCriteria: result.assessedCriteria,
        totalCriteria: result.totalCriteria,
      };
    })
    .sort((a, b) => {
      const priority =
        projectLifecyclePriority(a.lifecycle) -
        projectLifecyclePriority(b.lifecycle);
      return priority || a.name.localeCompare(b.name, "ja");
    });

  const seedRows = [...seeds].sort((a, b) => {
    const priority = seedListPriority(a) - seedListPriority(b);
    if (priority) return priority;
    const aScore = a.latest_sps?.status === "ready" ? a.latest_sps.score : null;
    const bScore = b.latest_sps?.status === "ready" ? b.latest_sps.score : null;
    if (aScore == null && bScore != null) return 1;
    if (aScore != null && bScore == null) return -1;
    if (aScore != null && bScore != null && aScore !== bScore) {
      return bScore - aScore;
    }
    return a.title.localeCompare(b.title, "ja");
  });

  const originByProject = new Map<string, ProjectOrigin[]>();
  const addOrigin = (projectId: string, origin: ProjectOrigin) => {
    const current = originByProject.get(projectId);
    if (current) current.push(origin);
    else originByProject.set(projectId, [origin]);
  };

  for (const institution of institutionBundle.institutions) {
    for (const link of institutionBundle.institutionProjectsByInstitution[
      institution.institutionId
    ] ?? []) {
      addOrigin(link.projectId, {
        kind: "institution",
        id: institution.institutionId,
        label: institution.name,
        href: `/institutions/${encodeURIComponent(institution.institutionId)}/cockpit`,
      });
    }
  }

  for (const seed of seeds) {
    for (const link of seed.project_links ?? []) {
      addOrigin(link.project_id, {
        kind: "seed",
        id: seed.id,
        label: seed.title,
        parentLabel: seed.org_name,
        href: `/seeds/${encodeURIComponent(seed.id)}`,
      });
    }
  }

  const projectRows = projects
    .filter((project) => project.projectId !== "p00")
    .map((project): ProjectRow => {
      const origins = originByProject.get(project.projectId) ?? [];
      return {
        project,
        origins,
        lifecycle: projectStatusLifecycle(project.status),
        needsClassification: origins.length === 0,
      };
    })
    .sort((a, b) => {
      const priority =
        projectStatusPriority(a.project.status) -
        projectStatusPriority(b.project.status);
      return (
        priority ||
        a.project.projectName.localeCompare(b.project.projectName, "ja")
      );
    });

  const seedRealized = seedRows.filter(
    (seed) => seedProjectLifecycle(seed) === "realized",
  ).length;
  const seedConsidering = seedRows.filter(
    (seed) => seedProjectLifecycle(seed) === "considering",
  ).length;

  return {
    institutionRows,
    seedRows,
    projectRows,
    counts: {
      institutions: institutionRows.length,
      institutionRealized: institutionRows.filter(
        (row) => row.lifecycle === "realized",
      ).length,
      institutionConsidering: institutionRows.filter(
        (row) => row.lifecycle === "considering",
      ).length,
      institutionEcrReady: institutionRows.filter((row) => row.ecr != null)
        .length,
      seeds: seedRows.length,
      seedRealized,
      seedConsidering,
      seedScoredWithoutProject: seedRows.filter(
        (seed) => seedListPriority(seed) === 2,
      ).length,
      seedSpsReady: seedRows.filter(
        (seed) => seed.latest_sps?.status === "ready",
      ).length,
      projects: projectRows.length,
      activeProjects: projectRows.filter(
        (row) => row.project.status === "active",
      ).length,
      consideringProjects: projectRows.filter((row) =>
        ["sales", "draft"].includes(row.project.status),
      ).length,
      unclassifiedProjects: projectRows.filter((row) => row.needsClassification)
        .length,
    },
  };
}

export function PortfolioPreview({
  displayName,
  initialData,
}: {
  displayName: string;
  initialData: PortfolioPreviewData;
}) {
  const router = useRouter();
  const [view, setView] = useState<PreviewView>("overview");
  const [query, setQuery] = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const model = useMemo(() => buildPreviewModel(initialData), [initialData]);
  const normalizedQuery = normalizeQuery(deferredQuery);

  const changeView = (nextView: PreviewView) => {
    setView(nextView);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reload = () => {
    startRefresh(() => router.refresh());
  };

  return (
    <div
      className={styles.shell}
      data-testid="portfolio-preview"
      data-preview-mode="read-only"
    >
      <aside className={styles.sidebar} aria-label="仮設ナビゲーション">
        <div className={styles.brandBlock}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/amd-logo.png" alt="AMD" className={styles.logo} />
          <div>
            <p className={styles.brandName}>AMD OS</p>
            <p className={styles.brandMeta}>構造プレビュー / {BUILD_VERSION}</p>
          </div>
        </div>

        <nav className={styles.primaryNav} aria-label="研究ポートフォリオ">
          <p className={styles.navGroupLabel}>研究ポートフォリオ</p>
          {NAV_ITEMS.map((item) => (
            <PreviewNavButton
              key={item.view}
              item={item}
              active={view === item.view}
              onClick={() => changeView(item.view)}
            />
          ))}
        </nav>

        <div className={styles.secondaryNav}>
          <p className={styles.navGroupLabel}>探索・開拓</p>
          <SecondaryNavItem icon={MapIcon} label="Atlas / Scholar" />
          <SecondaryNavItem icon={Network} label="PoC / VC" />
          <p className={styles.navGroupLabel}>社内運営</p>
          <SecondaryNavItem icon={Bell} label="通知 / 立替" />
          <SecondaryNavItem icon={ShieldCheck} label="Management / Admin" />
        </div>

        <div className={styles.sidebarFooter}>
          <Link href="/dashboard" className={styles.currentOsLink}>
            現行OSへ戻る
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className={styles.userChip}>
            <CircleUserRound className="h-4 w-4" aria-hidden="true" />
            <span>{displayName}</span>
          </div>
        </div>
      </aside>

      <div className={styles.mobileHeader}>
        <div className={styles.mobileBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/amd-logo.png" alt="AMD" className={styles.mobileLogo} />
          <div>
            <p>AMD OS</p>
            <span>構造プレビュー</span>
          </div>
        </div>
        <Link href="/dashboard" className={styles.mobileReturn}>
          現行OS
        </Link>
      </div>

      <nav className={styles.mobileNav} aria-label="研究ポートフォリオ">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            onClick={() => changeView(item.view)}
            aria-current={view === item.view ? "page" : undefined}
            className={view === item.view ? styles.mobileNavActive : ""}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrowRow}>
              <span className={styles.previewBadge}>仮設IA</span>
              <span className={styles.readOnlyBadge}>読み取り専用</span>
            </div>
            <h1>{NAV_ITEMS.find((item) => item.view === view)?.label}</h1>
            <p>
              {view === "overview"
                ? "研究機関とシーズを母集団として育て、契約後の仕事だけをPJ運用へ重ねる。"
                : view === "institutions"
                  ? "契約前から蓄積する研究機関の全件リスト。PJ化しても同じ行に残す。"
                  : view === "seeds"
                    ? "技術×用途の事業化候補を、PJ化の前後を通じて同じ行で追う。"
                    : "研究機関またはシーズから生まれた契約・実行レイヤーを横断管理する。"}
            </p>
          </div>
          <div className={styles.headerActions}>
            {view !== "overview" ? (
              <label className={styles.searchField}>
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">現在の一覧を検索</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="この一覧を検索"
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={reload}
              className={styles.refreshButton}
              aria-label="実データを再読み込み"
              aria-busy={isRefreshing}
              title="実データを再読み込み"
            >
              <RefreshCcw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        {view === "overview" ? (
          <OverviewView model={model} onViewChange={changeView} />
        ) : view === "institutions" ? (
          <InstitutionsView model={model} query={normalizedQuery} />
        ) : view === "seeds" ? (
          <SeedsView model={model} query={normalizedQuery} />
        ) : (
          <ProjectsView model={model} query={normalizedQuery} />
        )}
      </main>
    </div>
  );
}

function PreviewNavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${styles.navButton} ${active ? styles.navButtonActive : ""}`}
    >
      <span className={styles.navIcon}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span>
        <strong>{item.label}</strong>
        <small>{item.description}</small>
      </span>
    </button>
  );
}

function SecondaryNavItem({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className={styles.secondaryNavItem} aria-disabled="true">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function OverviewView({
  model,
  onViewChange,
}: {
  model: PreviewModel;
  onViewChange: (view: PreviewView) => void;
}) {
  const institutionCandidates = model.institutionRows
    .filter((row) => row.lifecycle === "considering")
    .slice(0, 3);
  const seedCandidates = model.seedRows
    .filter((seed) => [1, 2].includes(seedListPriority(seed)))
    .slice(0, 5);
  const activeProjects = model.projectRows
    .filter((row) => row.project.status === "active")
    .slice(0, 6);

  return (
    <div className={styles.viewStack} data-testid="portfolio-preview-overview">
      <section className={styles.relationshipPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionKicker}>AMDの仕事が生まれる構造</p>
            <h2>母集団から契約・実行へ</h2>
          </div>
          <p>カタログ行はPJ化後も移動・複製せず、その上に運用情報を重ねる。</p>
        </div>

        <div className={styles.relationshipStage}>
          <div className={styles.sourceStack}>
            <RelationshipNode
              icon={Building2}
              label="研究機関"
              value={model.counts.institutions}
              meta={`PJ化済み ${model.counts.institutionRealized} / 検討中 ${model.counts.institutionConsidering}`}
              tone="institution"
              onClick={() => onViewChange("institutions")}
            />
            <div className={styles.containsLine} aria-hidden="true">
              <span>所属・連携</span>
              <ChevronDown className="h-4 w-4" />
            </div>
            <RelationshipNode
              icon={Sprout}
              label="シーズ"
              value={model.counts.seeds}
              meta={`PJ化済み ${model.counts.seedRealized} / SPS評価済み ${model.counts.seedSpsReady}`}
              tone="seed"
              onClick={() => onViewChange("seeds")}
            />
          </div>

          <div className={styles.mergeConnector} aria-hidden="true">
            <span>契約成立</span>
            <ArrowRight className="h-5 w-5" />
          </div>

          <RelationshipNode
            icon={FlaskConical}
            label="PJ運用"
            value={model.counts.projects}
            meta={`稼働中 ${model.counts.activeProjects} / 検討中 ${model.counts.consideringProjects}`}
            tone="project"
            onClick={() => onViewChange("projects")}
            large
          />
        </div>
      </section>

      <section className={styles.metricRail} aria-label="ポートフォリオ集計">
        <MetricStrip
          label="ECR評価済み"
          value={model.counts.institutionEcrReady}
          denominator={model.counts.institutions}
          detail="研究機関環境"
        />
        <MetricStrip
          label="SPS評価済み"
          value={model.counts.seedSpsReady}
          denominator={model.counts.seeds}
          detail="個別シーズ"
        />
        <MetricStrip
          label="SPS済み・PJなし"
          value={model.counts.seedScoredWithoutProject}
          detail="次の検討候補"
          emphasis
        />
        <MetricStrip
          label="由来要確認PJ"
          value={model.counts.unclassifiedProjects}
          detail="機関・シーズ未分類"
          warning={model.counts.unclassifiedProjects > 0}
        />
      </section>

      <div className={styles.queueGrid}>
        <QueuePanel
          title="稼働中PJ"
          count={model.counts.activeProjects}
          actionLabel="PJ運用を開く"
          onAction={() => onViewChange("projects")}
        >
          {activeProjects.length ? (
            activeProjects.map((row) => (
              <ProjectQueueRow key={row.project.projectId} row={row} />
            ))
          ) : (
            <EmptyQueue label="稼働中PJはない" />
          )}
        </QueuePanel>

        <QueuePanel
          title="PJ化検討中"
          count={
            model.counts.institutionConsidering + model.counts.seedConsidering
          }
          actionLabel="研究機関を開く"
          onAction={() => onViewChange("institutions")}
        >
          {institutionCandidates.map((row) => (
            <CandidateRow
              key={row.institutionId}
              icon={Building2}
              label={row.name}
              meta={`研究機関 ・ シーズ ${row.seedCount}件`}
              badge="機関"
              href={`/institutions/${encodeURIComponent(row.institutionId)}`}
            />
          ))}
          {seedCandidates
            .filter((seed) => seedProjectLifecycle(seed) === "considering")
            .slice(0, Math.max(0, 5 - institutionCandidates.length))
            .map((seed) => (
              <CandidateRow
                key={seed.id}
                icon={Sprout}
                label={seed.title}
                meta={`${seed.org_name} ・ ${seed.researcher_name || "PI未登録"}`}
                badge="シーズ"
                href={`/seeds/${encodeURIComponent(seed.id)}`}
              />
            ))}
          {!institutionCandidates.length &&
          !seedCandidates.some(
            (seed) => seedProjectLifecycle(seed) === "considering",
          ) ? (
            <EmptyQueue label="検討中の対象はない" />
          ) : null}
        </QueuePanel>

        <QueuePanel
          title="SPS評価済み・PJなし"
          count={model.counts.seedScoredWithoutProject}
          actionLabel="シーズを開く"
          onAction={() => onViewChange("seeds")}
        >
          {seedCandidates
            .filter((seed) => seedListPriority(seed) === 2)
            .slice(0, 5)
            .map((seed) => (
              <CandidateRow
                key={seed.id}
                icon={Sprout}
                label={seed.title}
                meta={`${seed.org_name} ・ SPS ${formatScore(seed.latest_sps?.score)}`}
                badge="評価済み"
                href={`/seeds/${encodeURIComponent(seed.id)}`}
              />
            ))}
          {!seedCandidates.some((seed) => seedListPriority(seed) === 2) ? (
            <EmptyQueue label="該当するシーズはない" />
          ) : null}
        </QueuePanel>
      </div>

      <section className={styles.previewNote}>
        <BookOpen className="h-5 w-5" aria-hidden="true" />
        <div>
          <strong>このページは構造確認用</strong>
          <p>
            現行トップ、サイドバー、研究機関・シーズ・PJコックピットは変更していない。ここで方向を固めてから本体へ移す。
          </p>
        </div>
      </section>
    </div>
  );
}

function RelationshipNode({
  icon: Icon,
  label,
  value,
  meta,
  tone,
  onClick,
  large = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  meta: string;
  tone: "institution" | "seed" | "project";
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.relationshipNode} ${styles[`relationshipNode_${tone}`]} ${large ? styles.relationshipNodeLarge : ""}`}
    >
      <span className={styles.relationshipIcon}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={styles.relationshipCopy}>
        <small>{label}</small>
        <strong>{value.toLocaleString("ja-JP")}</strong>
        <span>{meta}</span>
      </span>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function MetricStrip({
  label,
  value,
  denominator,
  detail,
  emphasis = false,
  warning = false,
}: {
  label: string;
  value: number;
  denominator?: number;
  detail: string;
  emphasis?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`${styles.metricStrip} ${emphasis ? styles.metricStripEmphasis : ""} ${warning ? styles.metricStripWarning : ""}`}
    >
      <p>{label}</p>
      <strong>
        {value.toLocaleString("ja-JP")}
        {denominator != null ? <span> / {denominator}</span> : null}
      </strong>
      <small>{detail}</small>
    </div>
  );
}

function QueuePanel({
  title,
  count,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.queuePanel}>
      <header>
        <div>
          <h2>{title}</h2>
          <span>{count.toLocaleString("ja-JP")}</span>
        </div>
        <button type="button" onClick={onAction}>
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>
      <div className={styles.queueRows}>{children}</div>
    </section>
  );
}

function ProjectQueueRow({ row }: { row: ProjectRow }) {
  return (
    <Link
      href={`/project/${encodeURIComponent(row.project.projectId)}/cockpit`}
      className={styles.queueRow}
    >
      <div className={styles.queueRowMain}>
        <strong>{row.project.projectName}</strong>
        <OriginRibbon origins={row.origins} compact />
      </div>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
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
    <Link href={href} className={styles.queueRow}>
      <span className={styles.candidateIcon}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className={styles.queueRowMain}>
        <strong>{label}</strong>
        <small>{meta}</small>
      </div>
      <span className={styles.queueBadge}>{badge}</span>
    </Link>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return <p className={styles.emptyQueue}>{label}</p>;
}

function InstitutionsView({
  model,
  query,
}: {
  model: PreviewModel;
  query: string;
}) {
  const rows = model.institutionRows.filter((row) =>
    includesQuery(
      [row.name, row.shortName, row.region, row.projectLink?.projectLabel],
      query,
    ),
  );

  return (
    <div
      className={styles.viewStack}
      data-testid="portfolio-preview-institutions"
    >
      <ListSummary
        items={[
          ["研究機関", model.counts.institutions],
          ["PJ化済み", model.counts.institutionRealized],
          ["PJ化検討中", model.counts.institutionConsidering],
          ["ECR評価済み", model.counts.institutionEcrReady],
        ]}
        note="ECRは研究機関環境の評価。シーズのSPSとは合算しない。"
      />
      <section className={styles.dataPanel}>
        <DataHeader
          columns={[
            "研究機関",
            "種別・地域",
            "所属シーズ",
            "ECR",
            "AMDとの関係",
          ]}
          variant="institutions"
        />
        <div className={styles.dataRows}>
          {rows.map((row) => (
            <Link
              key={row.institutionId}
              href={
                row.projectLink
                  ? `/institutions/${encodeURIComponent(row.institutionId)}/cockpit`
                  : `/institutions/${encodeURIComponent(row.institutionId)}`
              }
              className={`${styles.dataRow} ${styles.dataRowInstitutions} ${styles[`dataRow_${row.lifecycle}`]}`}
            >
              <RowCell label="研究機関" primary>
                <span className={styles.entityTitle}>
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {row.name}
                </span>
              </RowCell>
              <RowCell label="種別・地域">
                {INSTITUTION_TYPE_LABEL[row.type] ?? row.type}
                <small>{row.region || "地域未登録"}</small>
              </RowCell>
              <RowCell label="所属シーズ">
                <strong className={styles.tabularValue}>
                  {row.seedCount}件
                </strong>
              </RowCell>
              <RowCell label="ECR">
                <strong className={styles.tabularValue}>
                  {row.ecr != null ? `${Math.round(row.ecr)}%` : "未評価"}
                </strong>
                <small>
                  {row.assessedCriteria}/{row.totalCriteria}項目
                </small>
              </RowCell>
              <RowCell label="AMDとの関係">
                <LifecycleBadge lifecycle={row.lifecycle} />
                <small>
                  {row.projectLink?.projectLabel || "契約前の母集団"}
                </small>
              </RowCell>
            </Link>
          ))}
          {!rows.length ? <ListEmpty /> : null}
        </div>
      </section>
    </div>
  );
}

function SeedsView({ model, query }: { model: PreviewModel; query: string }) {
  const rows = model.seedRows.filter((seed) =>
    includesQuery(
      [
        seed.title,
        seed.org_name,
        seed.researcher_name,
        seed.envisioned_use_case,
        seed.next_verification_step,
      ],
      query,
    ),
  );

  return (
    <div className={styles.viewStack} data-testid="portfolio-preview-seeds">
      <ListSummary
        items={[
          ["シーズ", model.counts.seeds],
          ["PJ化済み", model.counts.seedRealized],
          ["PJ化検討中", model.counts.seedConsidering],
          ["PJなし・SPS済み", model.counts.seedScoredWithoutProject],
        ]}
        note="PJ化後も元のシーズ行を残し、契約・実行情報だけを重ねる。"
      />
      <section className={styles.dataPanel}>
        <DataHeader
          columns={["シーズ", "研究機関・PI", "AMDとの関係", "SPS", "次の検証"]}
          variant="seeds"
        />
        <div className={styles.dataRows}>
          {rows.map((seed) => {
            const lifecycle = seedProjectLifecycle(seed);
            const priority = seedListPriority(seed);
            return (
              <Link
                key={seed.id}
                href={`/seeds/${encodeURIComponent(seed.id)}`}
                className={`${styles.dataRow} ${styles.dataRowSeeds} ${styles[`dataRow_${lifecycle}`]}`}
              >
                <RowCell label="シーズ" primary>
                  <span className={styles.entityTitle}>
                    <Sprout className="h-4 w-4" aria-hidden="true" />
                    {seed.title}
                  </span>
                  <small>{seed.envisioned_use_case || "用途未登録"}</small>
                </RowCell>
                <RowCell label="研究機関・PI">
                  {seed.org_name}
                  <small>{seed.researcher_name || "PI未登録"}</small>
                </RowCell>
                <RowCell label="AMDとの関係">
                  <LifecycleBadge lifecycle={lifecycle} />
                  <small>
                    {seed.project_links?.[0]?.project_name ||
                      (priority === 2 ? "SPS評価済み" : "契約前の母集団")}
                  </small>
                </RowCell>
                <RowCell label="SPS">
                  <strong className={styles.tabularValue}>
                    {formatScore(seed.latest_sps?.score)}
                  </strong>
                  <small>
                    {seed.latest_sps?.status === "ready"
                      ? "評価済み"
                      : "未評価"}
                  </small>
                </RowCell>
                <RowCell label="次の検証">
                  {seed.next_verification_step || "未登録"}
                </RowCell>
              </Link>
            );
          })}
          {!rows.length ? <ListEmpty /> : null}
        </div>
      </section>
    </div>
  );
}

function ProjectsView({
  model,
  query,
}: {
  model: PreviewModel;
  query: string;
}) {
  const rows = model.projectRows.filter((row) =>
    includesQuery(
      [
        row.project.projectName,
        row.project.clientName,
        row.project.roleLine,
        ...row.origins.flatMap((origin) => [origin.label, origin.parentLabel]),
      ],
      query,
    ),
  );

  return (
    <div className={styles.viewStack} data-testid="portfolio-preview-projects">
      <ListSummary
        items={[
          ["PJ運用", model.counts.projects],
          ["稼働中", model.counts.activeProjects],
          ["PJ化検討中", model.counts.consideringProjects],
          ["由来要確認", model.counts.unclassifiedProjects],
        ]}
        note="PJは独立した母集団ではなく、研究機関またはシーズへ契約・月次・タスクを重ねた運用ビュー。"
      />
      <section className={styles.dataPanel}>
        <DataHeader
          columns={["PJ", "由来", "状態・期間", "担当", "実行面"]}
          variant="projects"
        />
        <div className={styles.dataRows}>
          {rows.map((row) => (
            <Link
              key={row.project.projectId}
              href={`/project/${encodeURIComponent(row.project.projectId)}/cockpit`}
              className={`${styles.dataRow} ${styles.dataRowProjects} ${styles[`dataRow_${row.lifecycle}`]}`}
            >
              <RowCell label="PJ" primary>
                <span className={styles.entityTitle}>
                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  {row.project.projectName}
                </span>
                <small>
                  {row.project.projectId} ・{" "}
                  {row.project.clientName || "依頼元未登録"}
                </small>
              </RowCell>
              <RowCell label="由来">
                <OriginRibbon origins={row.origins} />
              </RowCell>
              <RowCell label="状態・期間">
                <ProjectStatusBadge status={row.project.status} />
                <small>
                  {row.project.startYm || "開始未登録"} –{" "}
                  {row.project.endYm || "終了未登録"}
                </small>
              </RowCell>
              <RowCell label="担当">
                {row.project.roleLine || "担当未登録"}
              </RowCell>
              <RowCell label="実行面">
                <span className={styles.executionLinks}>
                  契約・月次・タスク・資料
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </RowCell>
            </Link>
          ))}
          {!rows.length ? <ListEmpty /> : null}
        </div>
      </section>
    </div>
  );
}

function ListSummary({
  items,
  note,
}: {
  items: Array<[string, number]>;
  note: string;
}) {
  return (
    <section className={styles.listSummary}>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value.toLocaleString("ja-JP")}</dd>
          </div>
        ))}
      </dl>
      <p>{note}</p>
    </section>
  );
}

function DataHeader({
  columns,
  variant,
}: {
  columns: string[];
  variant: "institutions" | "seeds" | "projects";
}) {
  return (
    <div className={`${styles.dataHeader} ${styles[`dataHeader_${variant}`]}`}>
      {columns.map((column) => (
        <span key={column}>{column}</span>
      ))}
    </div>
  );
}

function RowCell({
  label,
  children,
  primary = false,
}: {
  label: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <div
      className={`${styles.rowCell} ${primary ? styles.rowCellPrimary : ""}`}
    >
      <span className={styles.mobileCellLabel}>{label}</span>
      {children}
    </div>
  );
}

function LifecycleBadge({ lifecycle }: { lifecycle: ProjectLifecycle }) {
  return (
    <span
      className={`${styles.lifecycleBadge} ${styles[`lifecycle_${lifecycle}`]}`}
    >
      {LIFECYCLE_LABEL[lifecycle]}
    </span>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const lifecycle = projectStatusLifecycle(status);
  return (
    <span
      className={`${styles.lifecycleBadge} ${styles[`lifecycle_${lifecycle}`]}`}
    >
      {PROJECT_STATUS_LABEL[status] || status || "未確認"}
    </span>
  );
}

function OriginRibbon({
  origins,
  compact = false,
}: {
  origins: ProjectOrigin[];
  compact?: boolean;
}) {
  if (!origins.length) {
    return (
      <span className={`${styles.originRibbon} ${styles.originRibbonMissing}`}>
        <span>由来要確認</span>
      </span>
    );
  }

  const visible = origins.slice(0, compact ? 1 : 2);
  return (
    <span
      className={`${styles.originRibbon} ${compact ? styles.originRibbonCompact : ""}`}
    >
      {visible.map((origin, index) => (
        <span
          key={`${origin.kind}-${origin.id}`}
          className={styles.originSegment}
        >
          {index > 0 ? <span className={styles.originDivider}>+</span> : null}
          {origin.kind === "institution" ? (
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>
            {origin.parentLabel ? <small>{origin.parentLabel}</small> : null}
            <strong>{origin.label}</strong>
          </span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      ))}
      {origins.length > visible.length ? (
        <span className={styles.originMore}>
          +{origins.length - visible.length}
        </span>
      ) : null}
    </span>
  );
}

function ListEmpty() {
  return (
    <div className={styles.listEmpty}>
      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      条件に合う項目はない
    </div>
  );
}

function formatScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "未評価";
  return Math.round(value).toLocaleString("ja-JP");
}
