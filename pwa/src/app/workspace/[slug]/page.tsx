import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";
import { getInstitutionWorkspaceData, type InstitutionWorkspaceData } from "@/lib/institution-workspace-data";
import { projectStatusLifecycle } from "@/lib/institution-projects";
import { INSTITUTION_TYPE_LABEL } from "@/lib/ers";

// Independent shell (no shared app-chrome layout) for external institution-workspace
// principals. Access is DB-revalidated every request via resolveWorkspaceAccess() —
// a stale/tampered cookie must never grant access. Unauthorized/nonexistent slugs
// resolve to notFound() (never a redirect) to avoid leaking workspace existence.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "研究機関ワークスペース" };
}

const INSTITUTION_ROLE_LABEL: Record<"owner" | "member" | "readonly", string> = {
  owner: "オーナー",
  member: "メンバー",
  readonly: "閲覧のみ",
};

const SEED_STATUS_LABEL: Record<string, string> = {
  candidate: "候補",
  investigating: "調査中",
  contacted: "接触済",
  discussing: "協議中",
  declined: "見送り",
  spun_off: "事業化進行",
};

const EHIME_UNIVERSITY_PROJECT_ID = "p30";
const EHIME_UNIVERSITY_SCOPE_LABELS = ["研究機関PJ", "愛媛大全体"];

type SeedProjectBadge = { label: string };

function seedProjectBadges(
  project: InstitutionWorkspaceData["seeds"][number]["projects"][number],
): SeedProjectBadge[] {
  const badges: SeedProjectBadge[] = [];
  const lifecycle = projectStatusLifecycle(project.status);
  if (lifecycle === "realized") badges.push({ label: "AMD PJ化済み" });
  else if (lifecycle === "considering") badges.push({ label: "PJ化検討中" });
  if (project.projectId === "p21" || project.commercializationStage === "pre_incorporation") {
    badges.push({ label: "会社未設立" });
  }
  return badges;
}

function ProjectCardMeta({ project }: { project: InstitutionWorkspaceData["projects"][number] }) {
  if (project.projectId === EHIME_UNIVERSITY_PROJECT_ID) {
    return (
      <span className="flex flex-col items-end gap-1 text-right">
        <span className="flex flex-wrap justify-end gap-1">
          {EHIME_UNIVERSITY_SCOPE_LABELS.map((label) => (
            <span
              key={label}
              className="rounded-full border border-[#e4ddcd] bg-[#f4f1e7] px-2 py-0.5 text-[10px] font-semibold text-[#5c584d]"
            >
              {label}
            </span>
          ))}
        </span>
        {project.ecosystemGoal ? <span className="text-xs text-[#8a8574]">{project.ecosystemGoal}</span> : null}
      </span>
    );
  }
  return (
    <span className="text-xs text-[#8a8574]">
      {project.targetUnit ?? project.engagementScope ?? project.status}
    </span>
  );
}

export default async function InstitutionWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const scopeSummary = await resolveWorkspaceAccess();
  if (!scopeSummary) notFound();

  const membership = scopeSummary.institutionWorkspaces.find((workspace) => workspace.slug === slug);
  if (!membership) notFound();

  const authorizedProjectIds = scopeSummary.projects.map((project) => project.projectId);
  const data = await getInstitutionWorkspaceData(slug, authorizedProjectIds);
  if (!data) notFound();

  const seeds = data.seeds;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#faf8f2] pb-24 text-[#26251f] sm:pb-10">
      <header className="sticky top-0 z-40 border-b border-[#e4ddcd] bg-[#faf8f2]/95 px-4 py-3 backdrop-blur sm:px-6" role="banner">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.institution.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#8a8574]">
              <span>{INSTITUTION_TYPE_LABEL[data.institution.type] ?? data.institution.type}</span>
              {data.institution.region ? <span>・{data.institution.region}</span> : null}
              <span className="rounded-full border border-[#c7c0e0] bg-[#ecebf7] px-2 py-0.5 font-semibold text-[#4338ca]">
                {INSTITUTION_ROLE_LABEL[membership.role]}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <Link
              href="/workspaces"
              className="inline-flex min-h-11 items-center rounded-md border border-[#e4ddcd] px-3 py-2 text-[#5c584d] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
            >
              ワークスペース一覧
            </Link>
            <Link
              href="/auth/logout"
              className="inline-flex min-h-11 items-center rounded-md border border-[#e4ddcd] px-3 py-2 text-[#5c584d] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
            >
              ログアウト
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6">
        <section id="projects" aria-labelledby="projects-heading" className="scroll-mt-20 space-y-4">
          <h2 id="projects-heading" className="text-sm font-semibold text-[#4338ca]">
            AMD PJ
          </h2>
          {data.projects.length === 0 ? (
            <p className="text-sm text-[#5c584d]">関連するAMD PJはまだありません。</p>
          ) : (
            <ul className="divide-y divide-[#e4ddcd] rounded-lg border border-[#e4ddcd] bg-white">
              {data.projects.map((project) =>
                project.sharedSurface === "workspace" ? (
                  <li key={project.projectId}>
                    <Link
                      href={`/workspace/${encodeURIComponent(slug)}/project/${encodeURIComponent(project.projectId)}`}
                      className="flex min-h-11 flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-[#f4f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                    >
                      <span className="font-medium">{project.projectName}</span>
                      <ProjectCardMeta project={project} />
                    </Link>
                  </li>
                ) : (
                  <li key={project.projectId} className="flex min-h-11 flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                    <span className="font-medium">{project.projectName}</span>
                    <ProjectCardMeta project={project} />
                  </li>
                ),
              )}
            </ul>
          )}
        </section>

        <section id="seeds" aria-labelledby="seeds-heading" className="scroll-mt-20 space-y-4">
          <h2 id="seeds-heading" className="text-sm font-semibold text-[#4338ca]">
            研究シーズ
          </h2>
          {seeds.length === 0 ? (
            <p className="text-sm text-[#5c584d]">公開中の研究シーズはまだありません。</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {seeds.map((seed) => (
                <li key={seed.id} className="rounded-lg border border-[#e4ddcd] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{seed.title}</p>
                      <p className="mt-1 text-xs text-[#8a8574]">
                        研究機関: {seed.orgName}
                        {seed.researcherName ? ` ・ ${seed.researcherName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#e4ddcd] px-2 py-0.5 text-[11px] text-[#5c584d]">
                      {SEED_STATUS_LABEL[seed.status] ?? seed.status}
                    </span>
                  </div>

                  {seed.projects.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {seed.projects.map((project) => (
                        <li key={project.projectId} className="flex flex-wrap items-center gap-2 text-xs">
                          {project.richLinkAllowed ? (
                            <Link
                              href={`/workspace/${encodeURIComponent(slug)}/project/${encodeURIComponent(project.projectId)}`}
                              className="font-medium text-[#4338ca] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                            >
                              {project.ventureName ?? project.projectName}
                            </Link>
                          ) : (
                            <span className="font-medium">{project.ventureName ?? project.projectName}</span>
                          )}
                          {seedProjectBadges(project).map((badge) => (
                            <span
                              key={badge.label}
                              className="rounded-full border border-[#e4ddcd] bg-[#f4f1e7] px-2 py-0.5 text-[10px] font-semibold text-[#5c584d]"
                            >
                              {badge.label}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {seed.sps ? (
                    <div className="mt-3 rounded-md border border-[#e4ddcd] bg-[#faf8f2] px-3 py-2 text-xs text-[#5c584d]">
                      <span className="font-semibold text-[#26251f]">
                        SPS: {seed.sps.score != null ? seed.sps.score.toFixed(1) : "評価中"}
                      </span>
                      <span className="ml-2">{seed.sps.status}</span>
                      {seed.sps.confidence ? <span className="ml-2">確度: {seed.sps.confidence}</span> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="ecr" aria-labelledby="ecr-heading" className="scroll-mt-20 space-y-4">
          <h2 id="ecr-heading" className="text-sm font-semibold text-[#4338ca]">
            ECR（エコシステム構築度）
          </h2>
          <div className="rounded-lg border border-[#e4ddcd] bg-white p-4">
            <p className="text-2xl font-semibold">{data.ecr.score != null ? data.ecr.score.toFixed(1) : "評価中"}</p>
            <p className="mt-1 text-xs text-[#8a8574]">
              評価済み {data.ecr.assessedCriteria} / {data.ecr.totalCriteria} 項目
              {data.ecr.evaluatedAt ? ` ・ 最終評価 ${data.ecr.evaluatedAt.slice(0, 10)}` : ""}
            </p>
            <ul className="mt-4 flex flex-col gap-2 border-t border-[#e4ddcd] pt-4">
              {data.ecr.axes.map((axis) => (
                <li key={axis.axisNo} className="flex items-center justify-between gap-3 text-sm">
                  <span>{axis.name}</span>
                  <span className="text-xs text-[#8a8574]">
                    {axis.score != null ? axis.score.toFixed(1) : "評価中"}（{axis.assessedCount}/{axis.totalCount}）
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="materials" aria-labelledby="materials-heading" className="scroll-mt-20 space-y-4">
          <h2 id="materials-heading" className="text-sm font-semibold text-[#4338ca]">
            資料
          </h2>
          <Link
            href={`/workspace/${encodeURIComponent(slug)}/files`}
            className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-[#e4ddcd] bg-white p-4 text-sm text-[#5c584d] transition-colors hover:bg-[#f4f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
          >
            <span>
              <span className="block font-semibold text-[#26251f]">{data.institution.name} 資料室</span>
              <span className="mt-1 block text-xs text-[#8a8574]">研究機関全体で共有する資料を確認する</span>
            </span>
            <span className="shrink-0 font-semibold text-[#4338ca]">開く →</span>
          </Link>
        </section>
      </main>

      <nav
        aria-label="セクションナビゲーション"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e4ddcd] bg-[#faf8f2]/95 backdrop-blur sm:hidden"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {[
            { href: "#projects", label: "PJ" },
            { href: "#seeds", label: "シーズ" },
            { href: "#ecr", label: "ECR" },
            { href: `/workspace/${encodeURIComponent(slug)}/files`, label: "資料" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center justify-center px-2 py-2 text-xs font-semibold text-[#5c584d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
